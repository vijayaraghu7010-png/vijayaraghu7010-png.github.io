import { Suspense, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

import HamperBox from './HamperBox';
import GiftMesh from './GiftMesh';
import { CARD_FONTS, getBoxVariant } from '../../data/hamperKit';

/* ===========================================================
   The scene: camera, light, controls, and the box with everything
   in it.

   Two things here are less obvious than they look.

   `frameloop="demand"` means the scene is only redrawn when
   something changed. A gift box sitting still should not keep a
   phone's GPU at 60fps — and the lid animation and a gift flying to
   its new place ask for frames explicitly while they need them.

   `preserveDrawingBuffer` is on because the checkout takes a
   snapshot of the canvas for the order summary, and without it the
   buffer is already cleared by the time toDataURL runs.
   =========================================================== */

/* Drei is not a dependency — `three` ships OrbitControls itself, and
   this is the whole of what wrapping it takes. */
function Controls({ onRest, enabled, target, span }) {
  const { camera, gl, invalidate } = useThree();
  const controls = useRef(null);

  useEffect(() => {
    const instance = new OrbitControls(camera, gl.domElement);
    instance.enableDamping = true;
    instance.dampingFactor = 0.08;
    /* Both limits come from the box rather than being fixed numbers.
       A 15 cm box and a 46 cm box want very different distances, and
       a floor of 22 cm would have the small one wedged against the
       near clip while the large one could never be seen whole. */
    instance.minDistance = span * 0.55;
    instance.maxDistance = span * 3.4;
    /* Stops short of the horizon and of straight down: below the
       first you are under the table, past the second the box reads as
       a flat rectangle. */
    instance.minPolarAngle = 0.18;
    instance.maxPolarAngle = Math.PI / 2 - 0.06;
    instance.target.set(target[0], target[1], target[2]);
    /* One finger turns the camera, two fingers pan. */
    instance.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
    instance.update();

    controls.current = instance;

    const onChange = () => invalidate();
    const onEnd = () => {
      onRest?.({
        position: [camera.position.x, camera.position.y, camera.position.z],
        target: [instance.target.x, instance.target.y, instance.target.z]
      });
    };
    instance.addEventListener('change', onChange);
    instance.addEventListener('end', onEnd);

    return () => {
      instance.removeEventListener('change', onChange);
      instance.removeEventListener('end', onEnd);
      instance.dispose();
      controls.current = null;
    };
  }, [camera, gl, invalidate, onRest, target, span]);

  useEffect(() => {
    if (controls.current) controls.current.enabled = enabled;
  }, [enabled]);

  /* Damping needs a frame to settle into, and only while it is
     settling. */
  useFrame(() => {
    controls.current?.update();
  });

  return null;
}

/* Keeps asking for frames while the lid is still swinging. Cheaper
   than running the loop always, and the lid is the only thing that
   animates on its own. */
function LidFrames({ lidOpen }) {
  const { invalidate } = useThree();
  const until = useRef(0);

  useEffect(() => {
    until.current = performance.now() + 1200;
    invalidate();
  }, [lidOpen, invalidate]);

  useFrame(() => {
    if (performance.now() < until.current) invalidate();
  });

  return null;
}

function Lights({ boxSize }) {
  const [width, , depth] = boxSize;
  const reach = Math.max(width, depth);

  return (
    <>
      <ambientLight intensity={0.55} />
      {/* the key light, which is the one that casts the shadow */}
      <directionalLight
        position={[reach * 0.9, reach * 1.5, reach * 0.8]}
        intensity={2.1}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0006}
      >
        <orthographicCamera attach="shadow-camera" args={[-reach, reach, reach, -reach, 1, reach * 5]} />
      </directionalLight>
      {/* fill from the other side, so the shadow side is not black */}
      <directionalLight position={[-reach, reach * 0.8, -reach * 0.6]} intensity={0.5} color="#FFF3E8" />
      {/* a warm bounce off the table */}
      <hemisphereLight args={['#FFF6EC', '#E5D9D1', 0.45]} />
    </>
  );
}

/* The surface the box stands on. Takes the shadow, which is most of
   what makes the box look like an object rather than a drawing. */
function Table({ boxSize }) {
  const reach = Math.max(boxSize[0], boxSize[2]) * 2.4;
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
      <circleGeometry args={[reach, 48]} />
      <meshStandardMaterial color="#F1E8E2" roughness={0.95} />
    </mesh>
  );
}

/* Frames the box, and re-frames it when the box changes size.

   Two things to get right at once. The angle has to look down into
   the box, because a customer choosing gifts needs to see the floor
   of it rather than a handsome three-quarter view of a closed lid.
   And the distance has to leave the whole box in frame, which at a
   38° field of view means standing a little over the box's own
   diagonal back.

   What it must not do is take the camera off a customer who has
   moved it. So on a size change the direction they are looking from
   is kept exactly and only the distance is rescaled — the box grows
   or shrinks in frame and the view does not jump. The box itself is
   never scaled per-axis to fit: it is a real size, and the camera is
   the thing that moves.
   =========================================================== */
function FitCamera({ span, target, saved }) {
  const { camera, invalidate } = useThree();
  const first = useRef(true);

  /* The distance at which a box of this diagonal sits comfortably in
     a 38° frame, with room for the open lid above it. */
  const distance = span * 1.5;

  useEffect(() => {
    if (first.current) {
      first.current = false;

      if (saved) {
        camera.position.set(saved.position[0], saved.position[1], saved.position[2]);

        /* A saved camera was framed against whatever box the design
           had when it was put down, and that may not be this one —
           a hamper saved before the studio moved onto the real
           catalogue sizes is the obvious case. The angle they chose
           is kept; the distance is pulled back into a range that
           has the whole box in frame. */
        const centre = new THREE.Vector3(...target);
        const offset = camera.position.clone().sub(centre);
        const reach = THREE.MathUtils.clamp(offset.length(), span * 0.8, span * 2.2);
        camera.position.copy(offset.normalize().multiplyScalar(reach).add(centre));
      } else {
        /* The house angle, as a direction, scaled to the box. */
        const dir = new THREE.Vector3(0.86, 1.6, 1.24).normalize();
        camera.position.copy(dir.multiplyScalar(distance).add(new THREE.Vector3(...target)));
      }
      camera.updateProjectionMatrix();
      invalidate();
      return;
    }

    /* A different box. Keep the direction, change the reach. */
    const centre = new THREE.Vector3(...target);
    const dir = camera.position.clone().sub(centre);
    if (dir.lengthSq() < 1e-6) dir.set(0.86, 1.6, 1.24);
    camera.position.copy(dir.normalize().multiplyScalar(distance).add(centre));
    camera.updateProjectionMatrix();
    invalidate();
    /* `saved` and `span` are deliberately not dependencies: both are
       first-mount concerns, and `distance` already carries every
       change of box size that this effect should react to. Reacting
       to a saved camera later would undo a customer's own orbit. */
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [camera, distance, target, invalidate]);

  return null;
}

export default function HamperScene({ design, onSelect, onCameraRest, onCanvasReady }) {
  const variant = getBoxVariant(design.box);
  /* The real outer box, in centimetres. The lights, the table, the
     camera distance and the orbit limits are all cut from it, which
     is what keeps a 6-inch box and an 18-inch one both framed
     correctly without either being drawn at the wrong scale. */
  const boxSize = variant.outer;

  /* The camera is the only thing a pointer moves now: the studio
     arranges the box, so there is no drag to keep clear of the
     orbit and no live position to hold outside the design. */
  /* A touch above the floor of the box: low enough to be looking
     into it, high enough that the open lid is not cropped off the top
     of the frame. */
  const target = useMemo(() => [0, boxSize[1] * 0.75, 0], [boxSize]);

  /* The box's own diagonal, which is the only honest measure of how
     much frame it needs: a long shallow hamper and a tall square one
     can quote the same largest side and want quite different
     distances. */
  const span = useMemo(() => Math.hypot(boxSize[0], boxSize[1], boxSize[2]), [boxSize]);

  return (
    <Canvas
      /* Only drawn when something asks for a frame. */
      frameloop="demand"
      shadows
      dpr={[1, 2]}
      camera={{ fov: 38, near: 0.5, far: 600, position: [30, 28, 40] }}
      gl={{
        antialias: true,
        /* the checkout's order snapshot reads the canvas back */
        preserveDrawingBuffer: true,
        alpha: true
      }}
      onCreated={({ gl, scene }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.05;
        scene.background = null;
        onCanvasReady?.(gl.domElement);
      }}
      onPointerMissed={() => onSelect?.(null)}
    >
      <Suspense fallback={null}>
        <Lights boxSize={boxSize} />
        <Table boxSize={boxSize} />
        <FitCamera span={span} target={target} saved={design.camera} />
        <LidFrames lidOpen={design.box.lidOpen} />

        <HamperBox box={design.box} message={design.message} cardFonts={CARD_FONTS}>
          {design.gifts.map((gift, index) => (
            <GiftMesh
              key={gift.uid}
              gift={gift}
              box={design.box}
              /* staggers the flight when the box is re-packed */
              index={index}
              selected={design.editing.selectedGiftUid === gift.uid}
              locked={!design.box.lidOpen}
              onSelect={onSelect}
            />
          ))}
        </HamperBox>

        <Controls enabled target={target} span={span} onRest={onCameraRest} />
      </Suspense>
    </Canvas>
  );
}
