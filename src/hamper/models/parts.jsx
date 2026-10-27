import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

/* ===========================================================
   Pieces more than one product is made of.

   Every model in this folder is built to the same contract: it is
   drawn in centimetres, it stands on the origin, it spans
   -w/2..w/2 across, 0..h up and -d/2..d/2 along, and it never
   rotates or offsets itself at load. The bounds maths in
   src/lib/giftBounds.js assumes exactly that box, so a model that
   drew itself centred on its middle would be clamped against a
   shape it does not have.
   =========================================================== */

/* How the yarn surface reads. Crochet is matte and slightly furry;
   the roughness is what stops nine crocheted animals looking like
   nine plastic ones. */
export const YARN = { roughness: 0.98, metalness: 0, flatShading: false };
export const FOIL = { roughness: 0.3, metalness: 0.55 };
export const BOARD = { roughness: 0.85, metalness: 0 };
export const GLASSY = { roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.45 };
export const GOLD = { color: '#C9A227', roughness: 0.22, metalness: 0.9 };

/* The split ring and chain every keyring hangs from. Drawn at the
   top of the product so the thing reads as a keyring rather than a
   toy, and small enough not to dominate a 5 cm panda. */
export function KeyRing({ y, scale = 1 }) {
  const r = 0.75 * scale;
  return (
    <group position={[0, y, 0]}>
      <mesh castShadow rotation={[Math.PI / 2, 0, 0]} position={[0, r * 2.2, 0]}>
        <torusGeometry args={[r, r * 0.17, 8, 22]} />
        <meshStandardMaterial color="#C7CBD1" roughness={0.25} metalness={0.95} />
      </mesh>
      {/* the few links between the ring and the product */}
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[0, r * 1.2 - i * r * 0.5, 0]} rotation={[Math.PI / 2, (i * Math.PI) / 2, 0]}>
          <torusGeometry args={[r * 0.26, r * 0.08, 6, 14]} />
          <meshStandardMaterial color="#C7CBD1" roughness={0.3} metalness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

/* A pair of plastic safety eyes, which is what the crocheted animals
   actually have. Black, glossy and slightly proud of the face. */
export function BeadEyes({ y, spread, z, size = 0.3 }) {
  return (
    <group position={[0, y, z]}>
      {[-spread, spread].map((x) => (
        <mesh key={x} position={[x, 0, 0]}>
          <sphereGeometry args={[size, 12, 10]} />
          <meshStandardMaterial color="#121212" roughness={0.12} metalness={0.2} />
        </mesh>
      ))}
    </group>
  );
}

/* The big white mask eyes on the Spider-Man and Batman dolls:
   teardrops, not circles, which is most of what makes them read as
   the right character. */
export function MaskEyes({ y, spread, z, w, h, colour = '#FFFFFF', tilt = 0.35 }) {
  return (
    <group position={[0, y, z]}>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[spread * side, 0, 0]} rotation={[0, 0, tilt * side]} scale={[w, h, 0.5]}>
          <sphereGeometry args={[1, 14, 12]} />
          <meshStandardMaterial color={colour} roughness={0.75} />
        </mesh>
      ))}
    </group>
  );
}

/* Short customer text, drawn to a canvas. The words change as they
   are typed and a canvas needs no font files shipped. */
export function useTextTexture(
  text,
  { width = 512, height = 128, size = 54, colour = '#2E2425', family = 'Georgia, serif' } = {}
) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = colour;
    ctx.font = `${size}px ${family}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    let shown = String(text);
    while (ctx.measureText(shown).width > width - 24 && shown.length > 3) {
      shown = shown.slice(0, -2);
    }
    ctx.fillText(shown, width / 2, height / 2);

    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    return map;
  }, [text, width, height, size, colour, family]);

  const previous = useRef(null);
  if (previous.current && previous.current !== texture) previous.current.dispose();
  previous.current = texture;

  useEffect(() => () => texture.dispose(), [texture]);

  return texture;
}

/* A box whose front face carries the product's artwork and whose
   other five are the pack's base colour.

   Six materials in face order — right, left, top, bottom, front,
   back — which is how BoxGeometry groups them. Giving the wrapper
   texture to all six would wrap a photograph of a bar around the
   ends of the bar, and it looks exactly as wrong as it sounds. */
export function PrintedBox({ size, texture, base, face = 'top', sheen = 0.3, children }) {
  const [w, h, d] = size;

  const materials = useMemo(() => {
    const plain = () => new THREE.MeshStandardMaterial({ color: base, roughness: 1 - sheen, metalness: sheen * 0.5 });
    const printed = () =>
      new THREE.MeshStandardMaterial({
        color: texture ? '#ffffff' : base,
        map: texture || null,
        roughness: 1 - sheen,
        metalness: sheen * 0.4
      });

    /* right, left, top, bottom, front, back */
    const faces = ['right', 'left', 'top', 'bottom', 'front', 'back'];
    return faces.map((name) => (name === face ? printed() : plain()));
  }, [base, texture, sheen, face]);

  useEffect(() => () => materials.forEach((m) => m.dispose()), [materials]);

  return (
    <group position={[0, h / 2, 0]}>
      <mesh castShadow receiveShadow material={materials}>
        <boxGeometry args={[w, h, d]} />
      </mesh>
      {children}
    </group>
  );
}

/* The crimped ends of a foil wrapper — a flat fan at each end of a
   bar. Cheap, and the difference between a chocolate bar and a
   rectangle.

   Drawn about its own middle, because it goes inside PrintedBox,
   whose children are positioned from the middle of the box. */
export function CrimpedEnds({ width, height, depth, colour }) {
  const flap = Math.max(0.6, width * 0.07);
  return (
    <>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[(width / 2 + flap / 2) * side, 0, 0]} castShadow>
          <boxGeometry args={[flap, height * 0.5, depth * 0.96]} />
          <meshStandardMaterial color={colour} roughness={0.5} metalness={0.35} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </>
  );
}

/* Anything whose model is missing or has not been built yet. It is
   deliberately plain and deliberately not pretending: a kind that
   renders as this is marked `placeholder` in the kit, and the panel
   says so rather than letting it pass as the product. */
export function Placeholder({ kind, colour }) {
  const [w, h, d] = kind.size;
  return (
    <group>
      <mesh castShadow receiveShadow position={[0, h / 2, 0]}>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={colour} roughness={0.8} wireframe={false} />
      </mesh>
      <mesh position={[0, h / 2, 0]}>
        <boxGeometry args={[w * 1.01, h * 1.01, d * 1.01]} />
        <meshBasicMaterial color="#2E2425" wireframe transparent opacity={0.3} />
      </mesh>
    </group>
  );
}
