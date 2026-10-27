import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

import { BOX_COLOURS, LINING_COLOURS, RIBBON_COLOURS, getBoxVariant, getMaterial, getSwatch } from '../../data/hamperKit';

/* ===========================================================
   The box itself: a base, four walls, a lining, a hinged lid with
   its locating lip, the hinges, and the ribbon across it.

   Built from geometry rather than a GLB because the shop has no 3D
   models — the box has to change size, colour, finish and ribbon
   style from a saved record, which a baked model could not do. If
   modelled boxes arrive later, this component is the only thing that
   has to change: everything else works from the design record.

   One unit is one centimetre, and the dimensions are the real ones.
   The outer box is exactly the size the catalogue quotes: an
   8 × 8 × 4 inch hamper is drawn 20.32 cm long, 20.32 cm wide and
   10.16 cm tall, and every part below is cut out of that. Nothing is
   scaled per-axis to flatter the viewport — the camera moves
   instead, in HamperScene.

   The parts and their thicknesses come from the variant's
   construction, which src/data/hamperBoxes.js computes the interior
   from. The two have to agree, so neither invents a number: this
   file draws what that file measured.
   =========================================================== */

function usePanelMaterial(hex, materialId) {
  const material = getMaterial(materialId);
  return useMemo(
    () => ({ color: hex, roughness: material.roughness, metalness: material.metalness }),
    [hex, material.roughness, material.metalness]
  );
}

/* The crinkle paper the gifts sit in. A low ridged surface reads as
   packing paper at a glance and costs one buffer, where real shredded
   paper would cost thousands of instances. */
function Lining({ width, depth, y, crease, hex, sheen }) {
  const geometry = useMemo(() => {
    /* Segmented by size rather than by a fixed count: 28 × 28 on a
       10 cm box is a wasted buffer, and on a 45 cm one the creases
       stretch into stripes. */
    const segments = Math.max(10, Math.min(36, Math.round(Math.max(width, depth) / 1.2)));
    const geo = new THREE.PlaneGeometry(width, depth, segments, segments);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i += 1) {
      const x = pos.getX(i);
      const y2 = pos.getY(i);
      /* Two offset waves, so the creases do not read as a grid. The
         amplitude is the lining's own thickness, so a thin paper in
         a small box does not ripple like a duvet. */
      pos.setZ(
        i,
        (Math.sin(x * 1.1) * 0.22 + Math.cos(y2 * 1.6) * 0.18 + Math.sin((x + y2) * 0.7) * 0.12) *
          (crease / 0.6)
      );
    }
    geo.computeVertexNormals();
    return geo;
  }, [width, depth, crease]);

  return (
    <mesh geometry={geometry} rotation={[-Math.PI / 2, 0, 0]} position={[0, y, 0]} receiveShadow>
      <meshStandardMaterial
        color={hex}
        roughness={sheen ? 0.4 : 0.95}
        metalness={sheen ? 0.06 : 0}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function Ribbon({ outer, lid, styleId, hex }) {
  if (styleId === 'none') return null;

  const [width, height, depth] = outer;

  /* The ribbon is cut to the box: a 2.6 cm grosgrain band looks
     right across a 30 cm hamper and looks like a bandage across a
     15 cm one. Clamped at both ends so it stays plausible ribbon. */
  const band = Math.max(1.2, Math.min(3.4, Math.min(width, depth) * 0.1));
  const thickness = Math.max(0.12, band * 0.085);

  /* The lid slab is drawn from its group's y=0 up to y=lid, so the
     ribbon has to sit on top of the slab — not on top of its centre.
     Half a lid lower and the bands are inside the lid, where the
     only part of the ribbon anybody can see is the bow. */
  const onTop = lid + thickness / 2;

  /* How far the bands run down the outside of the box. Short of the
     table, so the ribbon reads as tied round the box rather than as
     a stripe painted down to the ground. */
  const drop = Math.min(height * 0.55, height - lid);

  const material = (
    <meshStandardMaterial color={hex} roughness={0.32} metalness={0.12} side={THREE.DoubleSide} />
  );

  /* The ribbon is parented to the lid, so it swings with it rather
     than hanging in the air once the box is open. */
  const bands = [];

  if (styleId === 'cross-bow' || styleId === 'band' || styleId === 'single-bow') {
    bands.push(
      <mesh key="across" position={[0, onTop, 0]} castShadow>
        <boxGeometry args={[width + thickness * 2, thickness, band]} />
        {material}
      </mesh>
    );
    /* and down the sides, so a band reads as tied round the box
       rather than painted on the lid */
    bands.push(
      <mesh key="across-left" position={[-(width / 2 + thickness / 2), -drop / 2, 0]} castShadow>
        <boxGeometry args={[thickness, drop, band]} />
        {material}
      </mesh>,
      <mesh key="across-right" position={[width / 2 + thickness / 2, -drop / 2, 0]} castShadow>
        <boxGeometry args={[thickness, drop, band]} />
        {material}
      </mesh>
    );
  }
  if (styleId === 'cross-bow') {
    bands.push(
      <mesh key="along" position={[0, onTop, 0]} castShadow>
        <boxGeometry args={[band, thickness, depth + thickness * 2]} />
        {material}
      </mesh>,
      <mesh key="along-front" position={[0, -drop / 2, depth / 2 + thickness / 2]} castShadow>
        <boxGeometry args={[band, drop, thickness]} />
        {material}
      </mesh>,
      <mesh key="along-back" position={[0, -drop / 2, -(depth / 2 + thickness / 2)]} castShadow>
        <boxGeometry args={[band, drop, thickness]} />
        {material}
      </mesh>
    );
  }

  const bow = styleId === 'cross-bow' || styleId === 'single-bow';
  /* The bow scales with the band it is tied from, so it is a bow on
     every box rather than a pompom on the small one. */
  const r = band * 0.48;

  return (
    <group>
      {bands}
      {bow && (
        <group position={[0, onTop + r * 0.36, 0]}>
          {/* Two loops, a knot and two tails.

              The loops are flattened spheres rather than upright
              rings: a ribbon loop lies roughly in the plane of the
              lid, and a torus standing on its edge reads as a thin
              arc from the one angle customers look from most. */}
          <mesh scale={[1.9, 0.42, 1.15]} rotation={[0, 0.38, 0.16]} position={[-r * 1.6, r * 0.2, r * 0.16]} castShadow>
            <sphereGeometry args={[r, 18, 12]} />
            {material}
          </mesh>
          <mesh scale={[1.9, 0.42, 1.15]} rotation={[0, -0.38, -0.16]} position={[r * 1.6, r * 0.2, r * 0.16]} castShadow>
            <sphereGeometry args={[r, 18, 12]} />
            {material}
          </mesh>

          {/* the knot */}
          <mesh scale={[1, 0.8, 1]} position={[0, r * 0.32, 0]} castShadow>
            <sphereGeometry args={[r * 0.62, 16, 12]} />
            {material}
          </mesh>

          {/* tails, falling away across the lid */}
          <mesh rotation={[0, 0.5, 0.1]} position={[-r * 1.12, -0.06, r * 1.9]} castShadow>
            <boxGeometry args={[r * 2.9, thickness, band * 0.42]} />
            {material}
          </mesh>
          <mesh rotation={[0, -0.5, -0.1]} position={[r * 1.12, -0.06, r * 1.9]} castShadow>
            <boxGeometry args={[r * 2.9, thickness, band * 0.42]} />
            {material}
          </mesh>
        </group>
      )}
    </group>
  );
}

/* The hinges along the back seam. Small, and the only reason they
   are drawn at all is that a lid which swings on nothing reads as a
   lid that has been taken off and put behind the box. Their size is
   the construction's hinge clearance, which is the same number the
   usable height is reduced by. */
function Hinges({ width, hinge, lid }) {
  const r = Math.max(0.12, hinge);
  const length = Math.min(width * 0.16, 3.4);
  const at = width * 0.3;

  return (
    <>
      {[-at, at].map((x) => (
        <mesh key={x} position={[x, lid / 2, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[r, r, length, 10]} />
          <meshStandardMaterial color="#9B8C6E" roughness={0.45} metalness={0.5} />
        </mesh>
      ))}
    </>
  );
}

/* The card tucked into the lid. The message is drawn to a canvas
   texture rather than rendered as 3D text, which avoids shipping a
   font file and lets the customer's own words appear as they type. */
function MessageCard({ width, depth, message, fonts }) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 700;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#FFFCF9';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#E5D9D1';
    ctx.lineWidth = 8;
    ctx.strokeRect(22, 22, canvas.width - 44, canvas.height - 44);

    const font = fonts.find((f) => f.id === message.fontId) || fonts[0];
    const family = font.id === 'script' ? 'Caveat, cursive' : font.id === 'serif' ? 'Georgia, serif' : 'Inter, sans-serif';

    ctx.fillStyle = '#603D42';
    ctx.textAlign = 'center';

    if (message.to.trim()) {
      ctx.font = `44px ${family}`;
      ctx.fillText(`For ${message.to.trim()}`.slice(0, 40), canvas.width / 2, 120);
    }

    ctx.fillStyle = '#2E2425';
    ctx.font = `${font.id === 'script' ? 58 : 40}px ${family}`;

    /* Wrapped by measurement, so a long word cannot run off the card. */
    const words = (message.body || 'Your message will appear here.').split(/\s+/);
    const lines = [];
    let line = '';
    words.forEach((word) => {
      const candidate = line ? `${line} ${word}` : word;
      if (ctx.measureText(candidate).width > canvas.width - 180 && line) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    });
    if (line) lines.push(line);

    const lineHeight = font.id === 'script' ? 70 : 54;
    const start = canvas.height / 2 - ((Math.min(lines.length, 6) - 1) * lineHeight) / 2;
    lines.slice(0, 6).forEach((text, i) => {
      ctx.fillText(text, canvas.width / 2, start + i * lineHeight);
    });

    if (message.from.trim()) {
      ctx.fillStyle = '#827674';
      ctx.font = `38px ${family}`;
      ctx.fillText(`— ${message.from.trim()}`.slice(0, 40), canvas.width / 2, canvas.height - 90);
    }

    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 4;
    return map;
  }, [message.to, message.from, message.body, message.fontId, fonts]);

  /* The texture owns a GPU allocation; redrawing it on every keystroke
     without disposing the old one is a steady leak on a long message. */
  const previous = useRef(null);
  if (previous.current && previous.current !== texture) previous.current.dispose();
  previous.current = texture;

  const w = Math.min(width * 0.72, 17);
  const h = Math.min(w * 0.68, depth * 0.8);

  /* Tucked against the *inside* face of the lid, which is the face
     turned towards the customer once the box is open. On the outside
     it would be hidden by the lid itself exactly when it matters.

     Turned +90° rather than -90° so the card's printed face is the
     one pointing out of the lid. The other way round the writing is
     legible only as a mirror image, which is a thing you notice
     immediately and cannot unsee. */
  return (
    <mesh position={[0, -0.06, 0]} rotation={[Math.PI / 2, 0, 0]}>
      <planeGeometry args={[w, h]} />
      <meshStandardMaterial map={texture} roughness={0.85} side={THREE.DoubleSide} />
    </mesh>
  );
}

export default function HamperBox({ box, message, cardFonts, children }) {
  const variant = getBoxVariant(box);

  /* The quoted box, exactly: [length, height, width] in cm, and
     [X, Y, Z] in the scene. Everything below is cut out of this —
     nothing is drawn larger than the box the customer chose. */
  const [outerX, outerY, outerZ] = variant.outer;
  const build = variant.construction;

  /* The cavity, which is what the packer is given. Read from the
     variant rather than recomputed here, so there is exactly one
     outer-to-inner sum in the app. */
  const [cavityX, , cavityZ] = variant.inner;

  /* The walls stop where the lid slab begins, and the lid's locating
     lip drops back down into the cavity by the hinge clearance. That
     clearance is already off the usable height, so a closed lid
     cannot touch the tallest gift standing in the box. */
  const wallHeight = Math.max(0.2, outerY - build.base - build.lid);
  const liningTop = build.base + build.lining;

  const boxHex = getSwatch(BOX_COLOURS, box.boxColourId).hex;
  const lining = getSwatch(LINING_COLOURS, box.liningColourId);
  const ribbonHex = getSwatch(RIBBON_COLOURS, box.ribbonColourId).hex;
  const panel = usePanelMaterial(boxHex, box.boxMaterialId);

  /* The lid is hinged along the back edge. Animated towards its target
     rather than snapped, and left exactly at the target once it is
     close enough so the frame loop is not running forever.

     Just past upright, not flat back: a lid thrown all the way over
     puts its ribbon and bow underneath the box, through the table it
     is standing on. This is also how somebody actually opens a gift
     box they intend to close again. */
  const lid = useRef(null);
  const target = box.lidOpen ? -Math.PI * 0.46 : 0;

  useFrame((_, delta) => {
    if (!lid.current) return;
    const current = lid.current.rotation.x;
    const diff = target - current;
    if (Math.abs(diff) < 0.001) {
      lid.current.rotation.x = target;
      return;
    }
    /* Framerate-independent easing: the same swing on a 60Hz laptop
       and a 120Hz phone. */
    lid.current.rotation.x = current + diff * Math.min(1, delta * 7);
  });

  const lipDrop = Math.max(build.hinge, 0.15);

  return (
    <group position={[0, 0, 0]}>
      {/* the base slab */}
      <mesh position={[0, build.base / 2, 0]} receiveShadow castShadow>
        <boxGeometry args={[outerX, build.base, outerZ]} />
        <meshStandardMaterial {...panel} />
      </mesh>

      {/* The four walls, inside the quoted footprint. The back and
          front run the full length; the sides fill what is left
          between them, so the corners meet rather than overlap. */}
      {[
        {
          key: 'back',
          pos: [0, build.base + wallHeight / 2, -(outerZ / 2 - build.wall / 2)],
          size: [outerX, wallHeight, build.wall]
        },
        {
          key: 'front',
          pos: [0, build.base + wallHeight / 2, outerZ / 2 - build.wall / 2],
          size: [outerX, wallHeight, build.wall]
        },
        {
          key: 'left',
          pos: [-(outerX / 2 - build.wall / 2), build.base + wallHeight / 2, 0],
          size: [build.wall, wallHeight, cavityZ]
        },
        {
          key: 'right',
          pos: [outerX / 2 - build.wall / 2, build.base + wallHeight / 2, 0],
          size: [build.wall, wallHeight, cavityZ]
        }
      ].map((wall) => (
        <mesh key={wall.key} position={wall.pos} castShadow receiveShadow>
          <boxGeometry args={wall.size} />
          <meshStandardMaterial {...panel} />
        </mesh>
      ))}

      <Lining
        width={cavityX}
        depth={cavityZ}
        y={liningTop}
        crease={build.lining}
        hex={lining.hex}
        sheen={lining.sheen}
      />

      {/* The gifts live in the box's space, standing on the lining.
          This is the same datum src/lib/giftBounds.js measures the
          interior from: y = 0 here is the top of the paper. */}
      <group position={[0, liningTop, 0]}>{children}</group>

      {/* The lid, and everything that travels with it. The group sits
          at the hinge — the back top edge of the walls — so rotating
          it about X opens the box. */}
      <group ref={lid} position={[0, outerY - build.lid, -(outerZ / 2)]}>
        <group position={[0, 0, outerZ / 2]}>
          <mesh position={[0, build.lid / 2, 0]} castShadow receiveShadow>
            <boxGeometry args={[outerX, build.lid, outerZ]} />
            <meshStandardMaterial {...panel} />
          </mesh>

          {/* The locating lip: inside the walls, not over them, so the
              closed box is exactly the size the catalogue quotes. */}
          {[
            {
              key: 'lb',
              pos: [0, -lipDrop / 2, -(cavityZ / 2 - build.wall / 2)],
              size: [cavityX, lipDrop, build.wall]
            },
            {
              key: 'lf',
              pos: [0, -lipDrop / 2, cavityZ / 2 - build.wall / 2],
              size: [cavityX, lipDrop, build.wall]
            },
            {
              key: 'll',
              pos: [-(cavityX / 2 - build.wall / 2), -lipDrop / 2, 0],
              size: [build.wall, lipDrop, cavityZ - build.wall * 2]
            },
            {
              key: 'lr',
              pos: [cavityX / 2 - build.wall / 2, -lipDrop / 2, 0],
              size: [build.wall, lipDrop, cavityZ - build.wall * 2]
            }
          ].map((lip) => (
            <mesh key={lip.key} position={lip.pos} castShadow>
              <boxGeometry args={lip.size} />
              <meshStandardMaterial {...panel} />
            </mesh>
          ))}

          <Ribbon outer={variant.outer} lid={build.lid} styleId={box.ribbonStyleId} hex={ribbonHex} />

          {message.showCard && (
            <MessageCard width={cavityX} depth={cavityZ} message={message} fonts={cardFonts} />
          )}
        </group>

        <Hinges width={outerX} hinge={build.hinge} lid={build.lid} />
      </group>
    </group>
  );
}
