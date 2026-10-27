import * as THREE from 'three';

import useProductTexture from './textures';
import { BOARD, CrimpedEnds, GOLD, PrintedBox } from './parts';

/* ===========================================================
   The chocolates.

   A chocolate bar is a rectangle with a photograph on the lid of
   it, and saying so out loud is the point: the recognizable part of
   a KitKat is the wrapper artwork, not the geometry. So these are
   honest boxes with the product's own printing mapped onto the face
   that carries it, plus the details the silhouette needs — crimped
   foil ends, a carton's crisp edges, a gold tray under a clear lid.
   =========================================================== */

/* A foil-wrapped bar, lying on its back with the printed face up.
   That is how it goes into a hamper and it is the face the customer
   recognises from above. */
export function WrappedBar({ kind, colour }) {
  const wrapper = kind.wrapper || {};
  const texture = useProductTexture(wrapper.texture);
  const [w, h, d] = kind.size;
  const base = colour || wrapper.base || '#4B2A7B';

  return (
    <PrintedBox size={[w, h, d]} texture={texture} base={base} face="top" sheen={wrapper.sheen ?? 0.35}>
      {wrapper.crimped && <CrimpedEnds width={w} height={h} depth={d} colour={base} />}
      {/* The seam down the back, which is how a flow-wrapped bar is
          actually closed. Barely visible from above and the reason
          the bar does not read as a solid block when it is turned. */}
      <mesh position={[0, -h / 2 - 0.01, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[w * 0.98, d * 0.2]} />
        <meshStandardMaterial color={base} roughness={0.6} metalness={0.3} side={THREE.DoubleSide} />
      </mesh>
    </PrintedBox>
  );
}

/* A board carton rather than a foil wrapper: Bournville. Same idea,
   squarer edges, no crimp, and a matte surface instead of a shine. */
export function CartonBar({ kind, colour }) {
  const wrapper = kind.wrapper || {};
  const texture = useProductTexture(wrapper.texture);
  const [w, h, d] = kind.size;
  const base = colour || wrapper.base || '#1E1A17';

  return (
    <PrintedBox size={[w, h, d]} texture={texture} base={base} face="top" sheen={wrapper.sheen ?? 0.12}>
      {/* the glued edge seams that give a carton its corners */}
      {[-1, 1].map((side) => (
        <mesh key={side} position={[0, 0, (d / 2) * side]}>
          <boxGeometry args={[w * 1.004, h * 1.004, 0.06]} />
          <meshStandardMaterial color={base} {...BOARD} />
        </mesh>
      ))}
    </PrintedBox>
  );
}

/* The gold Ferrero tray: four foil spheres in gold cups under a
   clear plastic lid, with the brown ribbon printed along the side. */
export function FerreroBox({ kind, colour }) {
  const [w, h, d] = kind.size;
  const gold = colour || '#C9A227';
  const ballR = Math.min(h, d) * 0.34;
  const trayH = h * 0.45;

  return (
    <group>
      {/* the tray */}
      <mesh castShadow receiveShadow position={[0, trayH / 2, 0]}>
        <boxGeometry args={[w, trayH, d]} />
        <meshStandardMaterial color={gold} roughness={0.35} metalness={0.65} />
      </mesh>

      {/* the clear lid over it */}
      <mesh position={[0, trayH + (h - trayH) / 2, 0]}>
        <boxGeometry args={[w * 0.996, h - trayH, d * 0.996]} />
        <meshStandardMaterial
          color="#F2F4F5"
          roughness={0.06}
          metalness={0.05}
          transparent
          opacity={0.26}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* the chocolates, in their fluted cups */}
      {[0, 1, 2, 3].map((i) => {
        const x = (i / 3 - 0.5) * (w - ballR * 2.6);
        return (
          <group key={i} position={[x, trayH + ballR * 0.78, 0]}>
            <mesh castShadow>
              <sphereGeometry args={[ballR, 16, 14]} />
              <meshStandardMaterial color="#D9B65A" roughness={0.3} metalness={0.8} />
            </mesh>
            {/* the brown paper cup under it */}
            <mesh position={[0, -ballR * 0.72, 0]}>
              <cylinderGeometry args={[ballR * 0.95, ballR * 0.7, ballR * 0.5, 16]} />
              <meshStandardMaterial color="#6B4A2A" {...BOARD} />
            </mesh>
            {/* the little paper flag on top */}
            <mesh position={[0, ballR * 0.96, 0]} rotation={[0, 0.4, 0]}>
              <circleGeometry args={[ballR * 0.42, 14]} />
              <meshStandardMaterial color="#FBF6EC" roughness={0.85} side={THREE.DoubleSide} />
            </mesh>
          </group>
        );
      })}

      {/* the white band and brown ribbon print across the middle */}
      <mesh position={[0, trayH * 0.55, d / 2 + 0.01]}>
        <planeGeometry args={[w * 0.3, trayH * 0.8]} />
        <meshStandardMaterial color="#FBF6EC" roughness={0.8} />
      </mesh>
      <mesh position={[w * 0.36, trayH * 0.55, d / 2 + 0.02]} rotation={[0, 0, 0.4]}>
        <planeGeometry args={[w * 0.1, trayH * 0.5]} />
        <meshStandardMaterial {...GOLD} color="#8A5A2E" metalness={0.2} roughness={0.7} />
      </mesh>
    </group>
  );
}
