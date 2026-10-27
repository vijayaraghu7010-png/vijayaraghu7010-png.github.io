import * as THREE from 'three';

import { useTextTexture } from './parts';

/* ===========================================================
   The shop's own products, as they sit in a hamper.

   These four were here before the photographed catalogue was: they
   are the polaroids, frame, bouquet and magazine the shop already
   sells, and they carry the customer's own photograph rather than a
   product texture. Moved here unchanged when the models were split
   out of GiftMesh, so a saved design from before still renders the
   same way.
   =========================================================== */

function Caption({ text, width, y, z }) {
  const texture = useTextTexture(text, { colour: '#603D42', size: 44 });
  return (
    <mesh position={[0, y, z]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[width, width * 0.22]} />
      <meshStandardMaterial map={texture} transparent roughness={0.9} />
    </mesh>
  );
}

export function PhotoStack({ kind, colour, texture }) {
  const [w, h, d] = kind.size;
  return (
    <group>
      {[0, 1, 2].map((i) => (
        <mesh
          key={i}
          castShadow
          receiveShadow
          position={[i * 0.3, h * 0.2 + i * 0.5, i * 0.2]}
          rotation={[0, i * 0.06, 0]}
        >
          <boxGeometry args={[w, 0.4, d]} />
          <meshStandardMaterial color={colour} roughness={0.85} />
        </mesh>
      ))}
      {/* the top print, face up, carrying the customer's photo */}
      <mesh position={[0.6, h * 0.2 + 1.3, 0.4]} rotation={[-Math.PI / 2, 0, 0.12]}>
        <planeGeometry args={[w * 0.82, d * 0.72]} />
        <meshStandardMaterial color={texture ? '#ffffff' : '#D9CFC8'} map={texture || null} roughness={0.8} />
      </mesh>
    </group>
  );
}

export function PhotoFrame({ kind, colour, texture, text }) {
  const [w, h, d] = kind.size;
  return (
    <group>
      <mesh castShadow receiveShadow position={[0, h / 2, 0]}>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={colour} roughness={0.5} />
      </mesh>
      {/* the mount and the picture inside it */}
      <mesh position={[0, h + 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[w * 0.88, d * 0.9]} />
        <meshStandardMaterial color="#FBF6F0" roughness={0.9} />
      </mesh>
      <mesh position={[0, h + 0.04, text ? -d * 0.06 : 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[w * 0.72, d * (text ? 0.62 : 0.74)]} />
        <meshStandardMaterial color={texture ? '#ffffff' : '#CFC3BC'} map={texture || null} roughness={0.75} />
      </mesh>
      {text ? <Caption text={text} width={w * 0.78} y={h + 0.05} z={d * 0.32} /> : null}
    </group>
  );
}

export function Bouquet({ kind, colour }) {
  const [w, h, d] = kind.size;
  return (
    <group>
      {/* the wrap */}
      <mesh castShadow receiveShadow position={[0, h * 0.34, 0]}>
        <coneGeometry args={[w / 2, h * 0.68, 6, 1, true]} />
        <meshStandardMaterial color={colour} roughness={0.55} side={THREE.DoubleSide} />
      </mesh>
      {/* the blooms */}
      {Array.from({ length: 9 }).map((_, i) => {
        const angle = (i / 9) * Math.PI * 2;
        const radius = (i % 3) * (w * 0.12) + w * 0.1;
        return (
          <mesh
            key={i}
            castShadow
            position={[Math.cos(angle) * radius, h * 0.72 + (i % 3) * 0.6, Math.sin(angle) * radius]}
          >
            <sphereGeometry args={[w * 0.11, 12, 10]} />
            <meshStandardMaterial color={i % 2 ? '#F6EDE3' : '#E7BFBD'} roughness={0.95} />
          </mesh>
        );
      })}
      {/* keeps the depth argument honest for the bounds maths */}
      <mesh visible={false}>
        <boxGeometry args={[w, h, d]} />
      </mesh>
    </group>
  );
}

export function Magazine({ kind, colour, texture, text }) {
  const [w, h, d] = kind.size;
  return (
    <group>
      <mesh castShadow receiveShadow position={[0, h / 2, 0]}>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={colour} roughness={0.65} />
      </mesh>
      {/* pages along one edge */}
      <mesh position={[w * 0.46, h / 2, 0]}>
        <boxGeometry args={[0.2, h * 0.82, d * 0.96]} />
        <meshStandardMaterial color="#F6F1EA" roughness={0.95} />
      </mesh>
      <mesh position={[0, h + 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[w * 0.74, d * 0.62]} />
        <meshStandardMaterial color={texture ? '#ffffff' : '#E9DED5'} map={texture || null} roughness={0.8} />
      </mesh>
      {text ? <Caption text={text} width={w * 0.8} y={h + 0.03} z={d * 0.38} /> : null}
    </group>
  );
}
