import * as THREE from 'three';

import useProductTexture from './textures';
import { BOARD, PrintedBox } from './parts';

/* ===========================================================
   Lip products.

   All three are small, which is the thing to get right: a lip gloss
   next to a 13 cm chocolate bar should look like a lip gloss, so
   they are modelled at their real sizes and not scaled up to be
   easier to see. The invisible drag handle in GiftMesh is what
   makes them easy to pick up instead.
   =========================================================== */

/* The MARS gloss: a clear barrel of tinted gloss under a tall
   polished cap, with the applicator wand inside the cap. */
export function LipGloss({ kind, colour }) {
  const [w, h] = kind.size;
  const r = w * 0.42;
  const barrelH = h * 0.56;
  const capH = h * 0.44;
  const tint = colour || '#B5505F';

  return (
    <group>
      {/* the gloss itself, seen through the barrel */}
      <mesh castShadow position={[0, barrelH * 0.46, 0]}>
        <cylinderGeometry args={[r * 0.82, r * 0.82, barrelH * 0.86, 20]} />
        <meshStandardMaterial color={tint} roughness={0.15} metalness={0.05} />
      </mesh>

      {/* the clear barrel */}
      <mesh position={[0, barrelH / 2, 0]}>
        <cylinderGeometry args={[r, r, barrelH, 22]} />
        <meshStandardMaterial
          color="#F4F6F8"
          roughness={0.05}
          metalness={0.08}
          transparent
          opacity={0.32}
        />
      </mesh>

      {/* the collar between barrel and cap */}
      <mesh position={[0, barrelH + 0.12, 0]}>
        <cylinderGeometry args={[r * 0.72, r * 0.72, 0.3, 18]} />
        <meshStandardMaterial color="#FBF6F0" roughness={0.4} />
      </mesh>

      {/* the cap: rose gold, which is the part you recognise */}
      <mesh castShadow position={[0, barrelH + capH / 2, 0]}>
        <cylinderGeometry args={[r * 0.78, r * 0.86, capH, 22]} />
        <meshStandardMaterial color="#D9A98A" roughness={0.18} metalness={0.85} />
      </mesh>
    </group>
  );
}

/* Lakmé Lip Love: a twist stick standing in front of its printed
   card. The card is the recognisable part, so it carries the
   photograph and stands up behind the stick the way it does in the
   blister pack. */
export function CardedBalm({ kind, colour }) {
  const wrapper = kind.wrapper || {};
  const texture = useProductTexture(wrapper.texture);
  const [w, h, d] = kind.size;
  const stickH = h * 0.62;
  const stickR = Math.min(w, d) * 0.21;
  const base = colour || wrapper.base || '#E2231A';

  return (
    <group>
      {/* the printed card, leaning back a little so it stands */}
      <group position={[0, 0, -d * 0.28]} rotation={[-0.12, 0, 0]}>
        <mesh castShadow receiveShadow position={[0, h / 2, 0]}>
          <boxGeometry args={[w, h, 0.18]} />
          <meshStandardMaterial color={texture ? '#ffffff' : '#F6EDE3'} map={texture || null} {...BOARD} />
        </mesh>
        {/* the back of the card is plain board, not the artwork */}
        <mesh position={[0, h / 2, -0.1]}>
          <planeGeometry args={[w, h]} />
          <meshStandardMaterial color="#EFE6DC" {...BOARD} side={THREE.BackSide} />
        </mesh>
      </group>

      {/* the stick itself */}
      <group position={[0, 0, d * 0.22]}>
        <mesh castShadow receiveShadow position={[0, stickH * 0.42, 0]}>
          <cylinderGeometry args={[stickR, stickR, stickH * 0.84, 18]} />
          <meshStandardMaterial color={base} roughness={0.3} metalness={0.08} />
        </mesh>
        {/* the cap */}
        <mesh castShadow position={[0, stickH * 0.88, 0]}>
          <cylinderGeometry args={[stickR * 1.04, stickR * 1.04, stickH * 0.38, 18]} />
          <meshStandardMaterial color={base} roughness={0.22} metalness={0.12} />
        </mesh>
        {/* the clear blister holding it to the card */}
        <mesh position={[0, stickH * 0.5, 0]}>
          <cylinderGeometry args={[stickR * 1.5, stickR * 1.5, stickH, 18]} />
          <meshStandardMaterial
            color="#EEF2F4"
            roughness={0.05}
            transparent
            opacity={0.18}
            side={THREE.DoubleSide}
          />
        </mesh>
      </group>
    </group>
  );
}

/* Lakmé Peptide Lip I.V.: a squeeze tube lying beside its carton,
   which is how the product is photographed and how it packs flat
   into a hamper. */
export function TubeAndCarton({ kind, colour }) {
  const wrapper = kind.wrapper || {};
  const texture = useProductTexture(wrapper.texture);
  const [w, h, d] = kind.size;
  const base = colour || wrapper.base || '#C77E86';

  const cartonW = w * 0.42;
  const cartonH = h * 0.92;
  const tubeR = d * 0.34;
  const tubeH = h * 0.78;

  return (
    <group>
      {/* the carton, standing on its end with the print facing up
          the way it lies in a box */}
      <group position={[-w * 0.26, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <PrintedBox
          size={[cartonW, d * 0.9, cartonH]}
          texture={texture}
          base={base}
          face="front"
          sheen={wrapper.sheen ?? 0.2}
        />
      </group>

      {/* the tube beside it, lying down */}
      <group position={[w * 0.26, tubeR, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <mesh castShadow receiveShadow>
          <cylinderGeometry args={[tubeR, tubeR * 0.92, tubeH * 0.82, 20]} />
          <meshStandardMaterial color={base} roughness={0.52} metalness={0.05} />
        </mesh>
        {/* the gloss cap at one end */}
        <mesh castShadow position={[0, -tubeH * 0.47, 0]}>
          <cylinderGeometry args={[tubeR * 0.96, tubeR * 0.96, tubeH * 0.2, 20]} />
          <meshStandardMaterial color={base} roughness={0.12} metalness={0.25} />
        </mesh>
        {/* the crimped seam at the other */}
        <mesh position={[0, tubeH * 0.44, 0]}>
          <boxGeometry args={[tubeR * 2, tubeH * 0.08, 0.14]} />
          <meshStandardMaterial color={base} roughness={0.6} />
        </mesh>
      </group>
    </group>
  );
}
