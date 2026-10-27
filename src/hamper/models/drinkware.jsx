import * as THREE from 'three';

/* ===========================================================
   The two glass tumblers.

   One component, two products: they are the same object — a glass
   barrel, a band around the middle, a lid and a straw through it —
   with different materials for the band, the lid and the straw.
   The kind's `tumbler` block says which.

   Glass is the one material here that genuinely needs transparency,
   and it is worth the cost: an opaque tumbler in a gift box reads
   as a tin.
   =========================================================== */

const LIDS = {
  bamboo: { colour: '#C9A87C', roughness: 0.75, metalness: 0 },
  glass: { colour: '#C98B4B', roughness: 0.08, metalness: 0.1, clear: true }
};

const SLEEVES = {
  leather: { roughness: 0.68, metalness: 0.02, ribbed: false },
  silicone: { roughness: 0.92, metalness: 0, ribbed: true }
};

export default function Tumbler({ kind, colour }) {
  const spec = kind.tumbler || {};
  const [w, h, d] = kind.size;

  const r = Math.min(w, d) * 0.42;
  const glassH = h * 0.72;
  const lidH = h * 0.06;
  const strawH = h * 0.46;

  const lid = LIDS[spec.lid] || LIDS.bamboo;
  const sleeve = SLEEVES[spec.sleeve] || SLEEVES.leather;
  const sleeveColour = colour || '#B5793F';

  return (
    <group>
      {/* the drink inside, so the glass has something to be clear
          about */}
      <mesh position={[0, glassH * 0.38, 0]}>
        <cylinderGeometry args={[r * 0.9, r * 0.9, glassH * 0.68, 24]} />
        <meshStandardMaterial
          color={spec.glass || '#C98B4B'}
          roughness={0.1}
          transparent
          opacity={0.55}
        />
      </mesh>

      {/* the barrel */}
      <mesh castShadow receiveShadow position={[0, glassH / 2, 0]}>
        <cylinderGeometry args={[r, r * 0.97, glassH, 28, 1, true]} />
        <meshStandardMaterial
          color="#EDF2F5"
          roughness={0.05}
          metalness={0.08}
          transparent
          opacity={0.3}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* the base, which is thick on these and catches the light */}
      <mesh receiveShadow position={[0, 0.25, 0]}>
        <cylinderGeometry args={[r * 0.97, r * 0.94, 0.5, 28]} />
        <meshStandardMaterial color="#E6EDF1" roughness={0.12} transparent opacity={0.62} />
      </mesh>

      {/* the sleeve or grip band around the middle */}
      <mesh castShadow position={[0, glassH * 0.56, 0]}>
        <cylinderGeometry args={[r * 1.05, r * 1.05, glassH * 0.42, 28, 1, true]} />
        <meshStandardMaterial
          color={sleeveColour}
          roughness={sleeve.roughness}
          metalness={sleeve.metalness}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* a silicone band is ribbed; a leather sleeve has a stitched
          seam instead */}
      {sleeve.ribbed
        ? Array.from({ length: 9 }).map((_, i) => (
            <mesh key={i} position={[0, glassH * 0.38 + i * (glassH * 0.042), 0]}>
              <torusGeometry args={[r * 1.06, 0.045, 6, 28]} />
              <meshStandardMaterial color={sleeveColour} roughness={0.95} />
            </mesh>
          ))
        : [-1, 1].map((side) => (
            <mesh key={side} position={[0, glassH * (0.56 + 0.2 * side), 0]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[r * 1.06, 0.05, 6, 30]} />
              <meshStandardMaterial color="#8A5A2E" roughness={0.8} />
            </mesh>
          ))}

      {/* the lid */}
      <mesh castShadow position={[0, glassH + lidH / 2, 0]}>
        <cylinderGeometry args={[r * 1.04, r * 1.04, lidH, 28]} />
        <meshStandardMaterial
          color={lid.colour}
          roughness={lid.roughness}
          metalness={lid.metalness}
          transparent={Boolean(lid.clear)}
          opacity={lid.clear ? 0.55 : 1}
        />
      </mesh>

      {/* the straw, leaning out of the hole in the lid */}
      <group position={[r * 0.3, glassH + lidH, 0]} rotation={[0, 0, -0.26]}>
        <mesh castShadow position={[0, strawH / 2, 0]}>
          <cylinderGeometry args={[0.28, 0.28, strawH, 12]} />
          <meshStandardMaterial
            color={spec.straw || '#C9A87C'}
            roughness={spec.lid === 'bamboo' ? 0.8 : 0.1}
            metalness={spec.lid === 'bamboo' ? 0 : 0.1}
            transparent={spec.lid !== 'bamboo'}
            opacity={spec.lid === 'bamboo' ? 1 : 0.7}
          />
        </mesh>
        {/* the bend at the top of a glass straw */}
        {spec.lid !== 'bamboo' && (
          <mesh position={[-0.55, strawH * 0.96, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.55, 0.28, 8, 14, Math.PI / 2]} />
            <meshStandardMaterial color={spec.straw || '#B5793F'} roughness={0.1} transparent opacity={0.7} />
          </mesh>
        )}
      </group>
    </group>
  );
}
