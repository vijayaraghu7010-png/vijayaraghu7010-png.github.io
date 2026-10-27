import * as THREE from 'three';

import useProductTexture from './textures';
import { BOARD } from './parts';

/* ===========================================================
   The perfumes.

   A flacon is glass with juice in it, and the two have to be
   separate meshes or the colour reads as paint rather than
   contents. The label is the product's own, mapped onto the front
   face only: wrapping it round the bottle would put the brand name
   on the back as well, which no bottle does.
   =========================================================== */

export function PerfumeBottle({ kind, colour }) {
  const spec = kind.bottle || {};
  const texture = useProductTexture(spec.label);
  const [w, h, d] = kind.size;

  const bodyH = h * 0.72;
  const neckH = h * 0.08;
  const capH = h * 0.2;
  const juice = colour || spec.juice || '#C98B3B';

  return (
    <group>
      {/* the juice, a touch inside the glass */}
      <mesh position={[0, bodyH * 0.44, 0]}>
        <boxGeometry args={[w * 0.86, bodyH * 0.82, d * 0.8]} />
        <meshStandardMaterial color={juice} roughness={0.1} metalness={0.05} transparent opacity={0.92} />
      </mesh>

      {/* the flacon */}
      <mesh castShadow receiveShadow position={[0, bodyH / 2, 0]}>
        <boxGeometry args={[w, bodyH, d]} />
        <meshStandardMaterial
          color="#F0F4F6"
          roughness={0.04}
          metalness={0.1}
          transparent
          opacity={0.34}
        />
      </mesh>

      {/* the front label, which is the part you recognise */}
      <mesh position={[0, bodyH * 0.5, d / 2 + 0.02]}>
        <planeGeometry args={[w * 0.82, bodyH * 0.66]} />
        <meshStandardMaterial
          color={texture ? '#ffffff' : '#F6EDE3'}
          map={texture || null}
          roughness={0.7}
          transparent
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* the neck */}
      <mesh position={[0, bodyH + neckH / 2, 0]}>
        <cylinderGeometry args={[w * 0.17, w * 0.2, neckH, 16]} />
        <meshStandardMaterial color="#D8DDE0" roughness={0.2} metalness={0.3} transparent opacity={0.6} />
      </mesh>

      {/* the cap, polished gold and heavier than it looks */}
      <mesh castShadow position={[0, bodyH + neckH + capH / 2, 0]}>
        <boxGeometry args={[w * 0.56, capH, d * 0.72]} />
        <meshStandardMaterial color={spec.cap || '#C9A227'} roughness={0.16} metalness={0.92} />
      </mesh>
    </group>
  );
}

/* The two-bottle gift set: a cream board sleeve standing open with
   a slim bottle either side of the divider. */
export function PerfumeDuo({ kind, colour }) {
  const [w, h, d] = kind.size;
  const boxH = h * 0.94;
  const sleeve = colour || '#F4F0E8';

  const bottleW = w * 0.26;
  const bottleH = h * 0.62;
  const capH = h * 0.14;

  const BOTTLES = [
    { x: -w * 0.21, juice: '#2BB3B3' },
    { x: w * 0.21, juice: '#2E5FA3' }
  ];

  return (
    <group>
      {/* the sleeve, open at the front */}
      <mesh castShadow receiveShadow position={[0, boxH / 2, -d * 0.22]}>
        <boxGeometry args={[w, boxH, d * 0.4]} />
        <meshStandardMaterial color={sleeve} {...BOARD} />
      </mesh>
      {/* the base the bottles stand on */}
      <mesh receiveShadow position={[0, 0.2, d * 0.08]}>
        <boxGeometry args={[w, 0.4, d * 0.56]} />
        <meshStandardMaterial color={sleeve} {...BOARD} />
      </mesh>
      {/* the divider between them */}
      <mesh position={[0, boxH * 0.4, d * 0.02]}>
        <boxGeometry args={[w * 0.08, boxH * 0.8, d * 0.5]} />
        <meshStandardMaterial color={sleeve} {...BOARD} />
      </mesh>
      {/* the gold brand line across the front of the sleeve */}
      <mesh position={[0, boxH * 0.86, -d * 0.02]}>
        <planeGeometry args={[w * 0.4, boxH * 0.1]} />
        <meshStandardMaterial color="#C9A227" roughness={0.3} metalness={0.7} />
      </mesh>

      {BOTTLES.map((bottle) => (
        <group key={bottle.juice} position={[bottle.x, 0.4, d * 0.1]}>
          <mesh position={[0, bottleH * 0.46, 0]}>
            <boxGeometry args={[bottleW * 0.84, bottleH * 0.84, bottleW * 0.62]} />
            <meshStandardMaterial color={bottle.juice} roughness={0.12} transparent opacity={0.9} />
          </mesh>
          <mesh castShadow position={[0, bottleH / 2, 0]}>
            <boxGeometry args={[bottleW, bottleH, bottleW * 0.74]} />
            <meshStandardMaterial
              color="#EFF4F6"
              roughness={0.05}
              metalness={0.1}
              transparent
              opacity={0.32}
            />
          </mesh>
          <mesh castShadow position={[0, bottleH + capH / 2, 0]}>
            <cylinderGeometry args={[bottleW * 0.33, bottleW * 0.33, capH, 16]} />
            <meshStandardMaterial color="#C9A227" roughness={0.18} metalness={0.9} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
