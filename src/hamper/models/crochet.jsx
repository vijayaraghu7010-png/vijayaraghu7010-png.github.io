import * as THREE from 'three';

import { BeadEyes, KeyRing, MaskEyes, YARN } from './parts';

/* ===========================================================
   The crocheted things.

   All of them are amigurumi: a stuffed ball worked in a spiral,
   with smaller balls and tubes sewn on. That is a kind description
   and a modelling instruction at the same time, which is why these
   reconstruct better from a photograph than most products do —
   there are no flat faces to get wrong and no printing to misplace.

   What a photograph cannot give is the back. Every one of these is
   symmetrical about the front-to-back axis here, which is true of
   the real thing for the body and an assumption for the face.
   =========================================================== */

/* The overall proportions of an amigurumi doll, as fractions of the
   product's height: a head nearly as big as the body, which is the
   whole look. */
const HEAD_RATIO = 0.42;

function Ears({ shape, colour, headR, headY }) {
  if (!shape || shape === 'none') return null;

  if (shape === 'horns') {
    /* Batman's cowl: two short cones leaning back. */
    return (
      <>
        {[-1, 1].map((side) => (
          <mesh
            key={side}
            castShadow
            position={[headR * 0.5 * side, headY + headR * 0.95, -headR * 0.1]}
            rotation={[-0.25, 0, -0.2 * side]}
          >
            <coneGeometry args={[headR * 0.2, headR * 0.85, 10]} />
            <meshStandardMaterial color={colour} {...YARN} />
          </mesh>
        ))}
      </>
    );
  }

  if (shape === 'long') {
    /* Bunny ears: tall flattened ovals. */
    return (
      <>
        {[-1, 1].map((side) => (
          <mesh
            key={side}
            castShadow
            position={[headR * 0.46 * side, headY + headR * 1.1, 0]}
            rotation={[0, 0, -0.22 * side]}
            scale={[headR * 0.3, headR * 0.95, headR * 0.22]}
          >
            <sphereGeometry args={[1, 12, 12]} />
            <meshStandardMaterial color={colour} {...YARN} />
          </mesh>
        ))}
      </>
    );
  }

  if (shape === 'pointed') {
    /* Cat ears: small triangles sitting on the crown. */
    return (
      <>
        {[-1, 1].map((side) => (
          <mesh
            key={side}
            castShadow
            position={[headR * 0.55 * side, headY + headR * 0.82, 0]}
            rotation={[0, 0, -0.3 * side]}
          >
            <coneGeometry args={[headR * 0.26, headR * 0.5, 4]} />
            <meshStandardMaterial color={colour} {...YARN} />
          </mesh>
        ))}
      </>
    );
  }

  /* round — bear and panda */
  return (
    <>
      {[-1, 1].map((side) => (
        <mesh key={side} castShadow position={[headR * 0.68 * side, headY + headR * 0.68, 0]}>
          <sphereGeometry args={[headR * 0.3, 14, 12]} />
          <meshStandardMaterial color={colour} {...YARN} />
        </mesh>
      ))}
    </>
  );
}

/* The spider across the mask, and the webbing. Six short bars from
   the middle of the face is not the real web pattern — it is what
   reads as one at 5 cm across. */
function Webbing({ headR, headY }) {
  return (
    <group position={[0, headY, 0]}>
      {Array.from({ length: 8 }).map((_, i) => {
        const a = (i / 8) * Math.PI * 2;
        return (
          <mesh
            key={i}
            position={[Math.cos(a) * headR * 0.52, Math.sin(a) * headR * 0.52, headR * 0.72]}
            rotation={[0, 0, a]}
          >
            <boxGeometry args={[headR * 0.62, 0.045, 0.045]} />
            <meshStandardMaterial color="#141414" roughness={1} />
          </mesh>
        );
      })}
    </group>
  );
}

/* A doll: head, body, arms, legs, ears, face. One component covers
   Spider-Man, Batman, the panda and the bear/bunny/cat, because
   they are the same object with different numbers. */
export function Amigurumi({ kind, colour, figure = {} }) {
  const [w, h, d] = kind.size;
  const f = figure;

  const headR = h * HEAD_RATIO * 0.5;
  const bodyR = Math.min(w, d) * 0.42;
  /* Everything here hangs off a ring except the Batman doll, which
     is sold as a doll. */
  const hasKeyring = f.keyring !== false;

  /* The doll stands on its feet, so everything is measured up from
     zero and the keyring sits above the head. */
  const legH = h * 0.14;
  const bodyH = h * 0.3;
  const bodyY = legH + bodyH * 0.5;
  const headY = legH + bodyH + headR * 0.82;

  const skin = f.head || colour;
  const torso = f.body || colour;
  const limbs = f.limbs || colour;
  const earColour = f.earColour || skin;

  return (
    <group>
      {/* legs */}
      {[-1, 1].map((side) => (
        <mesh key={side} castShadow receiveShadow position={[bodyR * 0.45 * side, legH * 0.5, 0]}>
          <capsuleGeometry args={[bodyR * 0.3, legH * 0.6, 4, 10]} />
          <meshStandardMaterial color={limbs} {...YARN} />
        </mesh>
      ))}

      {/* body */}
      <mesh castShadow receiveShadow position={[0, bodyY, 0]} scale={[1, bodyH / (bodyR * 2), 0.88]}>
        <sphereGeometry args={[bodyR, 18, 16]} />
        <meshStandardMaterial color={torso} {...YARN} />
      </mesh>

      {/* a panda's black chest, a cat's heart */}
      {f.patch && (
        <mesh position={[0, bodyY, bodyR * 0.74]} scale={[bodyR * 0.8, bodyH * 0.42, bodyR * 0.3]}>
          <sphereGeometry args={[1, 14, 12]} />
          <meshStandardMaterial color={f.patch} {...YARN} />
        </mesh>
      )}
      {f.heart && (
        <mesh position={[0, bodyY, bodyR * 0.8]} rotation={[0, 0, Math.PI / 4]}>
          <boxGeometry args={[bodyR * 0.4, bodyR * 0.4, 0.12]} />
          <meshStandardMaterial color={f.heart} {...YARN} />
        </mesh>
      )}

      {/* Batman's belt and emblem */}
      {f.belt && (
        <mesh position={[0, bodyY - bodyH * 0.34, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[bodyR * 0.92, bodyR * 0.11, 8, 24]} />
          <meshStandardMaterial color={f.belt} roughness={0.5} metalness={0.3} />
        </mesh>
      )}
      {f.emblem && (
        <mesh position={[0, bodyY + bodyH * 0.1, bodyR * 0.8]}>
          <circleGeometry args={[bodyR * 0.38, 18]} />
          <meshStandardMaterial color={f.emblem} roughness={0.6} side={THREE.DoubleSide} />
        </mesh>
      )}
      {f.cape && (
        <mesh castShadow position={[0, bodyY + bodyH * 0.1, -bodyR * 0.82]} rotation={[0.12, 0, 0]}>
          <boxGeometry args={[bodyR * 1.9, bodyH * 1.5, 0.16]} />
          <meshStandardMaterial color={f.cape} {...YARN} side={THREE.DoubleSide} />
        </mesh>
      )}

      {/* arms */}
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          castShadow
          position={[bodyR * 1.0 * side, bodyY + bodyH * 0.1, 0]}
          rotation={[0, 0, 0.5 * side]}
        >
          <capsuleGeometry args={[bodyR * 0.26, bodyH * 0.5, 4, 10]} />
          <meshStandardMaterial color={limbs} {...YARN} />
        </mesh>
      ))}

      {/* head */}
      <mesh castShadow receiveShadow position={[0, headY, 0]}>
        <sphereGeometry args={[headR, 20, 18]} />
        <meshStandardMaterial color={skin} {...YARN} />
      </mesh>

      {f.muzzle && (
        <mesh position={[0, headY - headR * 0.22, headR * 0.78]} scale={[0.55, 0.42, 0.4]}>
          <sphereGeometry args={[headR, 14, 12]} />
          <meshStandardMaterial color="#FBF6F0" {...YARN} />
        </mesh>
      )}

      <Ears shape={f.ears} colour={earColour} headR={headR} headY={headY} />
      {f.web && <Webbing headR={headR} headY={headY} />}

      {f.eyes === 'spider' && (
        <MaskEyes
          y={headY + headR * 0.08}
          spread={headR * 0.42}
          z={headR * 0.82}
          w={headR * 0.36}
          h={headR * 0.26}
          tilt={0.45}
        />
      )}
      {f.eyes === 'slits' && (
        <MaskEyes
          y={headY + headR * 0.12}
          spread={headR * 0.38}
          z={headR * 0.84}
          w={headR * 0.3}
          h={headR * 0.12}
          tilt={0.18}
        />
      )}
      {f.eyes === 'patches' && (
        <>
          {[-1, 1].map((side) => (
            <mesh
              key={side}
              position={[headR * 0.42 * side, headY + headR * 0.05, headR * 0.76]}
              rotation={[0, 0, 0.3 * side]}
              scale={[headR * 0.3, headR * 0.4, headR * 0.2]}
            >
              <sphereGeometry args={[1, 12, 10]} />
              <meshStandardMaterial color={f.patch || '#1A1A1E'} {...YARN} />
            </mesh>
          ))}
          <BeadEyes y={headY + headR * 0.05} spread={headR * 0.42} z={headR * 0.9} size={headR * 0.13} />
        </>
      )}
      {f.eyes === 'beads' && (
        <BeadEyes y={headY + headR * 0.05} spread={headR * 0.36} z={headR * 0.86} size={headR * 0.15} />
      )}

      {hasKeyring && <KeyRing y={headY + headR} scale={Math.min(w, d) / 5} />}

      {/* Spider-Man comes with a second mask charm on the ring */}
      {f.charm === 'ball' && (
        <group position={[w * 0.42, headY + headR * 0.2, -d * 0.1]}>
          <mesh castShadow>
            <sphereGeometry args={[headR * 0.62, 16, 14]} />
            <meshStandardMaterial color={skin} {...YARN} />
          </mesh>
          <MaskEyes
            y={0}
            spread={headR * 0.26}
            z={headR * 0.52}
            w={headR * 0.24}
            h={headR * 0.17}
            tilt={0.45}
          />
        </group>
      )}
    </group>
  );
}

/* The bow. Two loops, a knot and two tails, worked in ribbed rows —
   the ribbing is what stops it reading as a plastic bow. */
export function CrochetBow({ kind, colour }) {
  const [w, h, d] = kind.size;
  const loopW = w * 0.44;
  const loopH = h * 0.3;
  const knotY = h * 0.62;

  return (
    <group>
      {/* the two tails, hanging below the knot */}
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          castShadow
          receiveShadow
          position={[w * 0.13 * side, h * 0.3, 0]}
          rotation={[0, 0, 0.16 * side]}
        >
          <boxGeometry args={[w * 0.2, h * 0.6, d * 0.55]} />
          <meshStandardMaterial color={colour} {...YARN} />
        </mesh>
      ))}

      {/* the loops */}
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          castShadow
          receiveShadow
          position={[loopW * 0.62 * side, knotY, 0]}
          rotation={[0, 0, 0.1 * side]}
          scale={[loopW * 0.62, loopH, d * 0.4]}
        >
          <sphereGeometry args={[1, 16, 12]} />
          <meshStandardMaterial color={colour} {...YARN} />
        </mesh>
      ))}

      {/* the ribbing across the loops */}
      {Array.from({ length: 6 }).map((_, i) => (
        <mesh key={i} position={[0, knotY - loopH * 0.6 + (i / 5) * loopH * 1.2, d * 0.22]}>
          <boxGeometry args={[w * 0.86, 0.07, 0.07]} />
          <meshStandardMaterial color={colour} roughness={1} />
        </mesh>
      ))}

      {/* the knot */}
      <mesh castShadow position={[0, knotY, 0]} scale={[w * 0.1, loopH * 0.62, d * 0.46]}>
        <sphereGeometry args={[1, 14, 12]} />
        <meshStandardMaterial color={colour} {...YARN} />
      </mesh>

      <KeyRing y={knotY + loopH * 1.1} scale={w / 9} />
    </group>
  );
}

/* A sunflower standing in a little pot. */
export function PottedFlower({ kind, colour }) {
  const [w, h] = kind.size;
  const potH = h * 0.32;
  const potR = w * 0.38;
  const stemH = h * 0.34;
  const headY = potH + stemH;
  const headR = w * 0.36;

  return (
    <group>
      {/* the pot */}
      <mesh castShadow receiveShadow position={[0, potH / 2, 0]}>
        <cylinderGeometry args={[potR, potR * 0.86, potH, 20]} />
        <meshStandardMaterial color="#D6C09A" {...YARN} />
      </mesh>
      {/* the soil it is planted in */}
      <mesh position={[0, potH - 0.1, 0]}>
        <cylinderGeometry args={[potR * 0.92, potR * 0.92, 0.3, 18]} />
        <meshStandardMaterial color="#6B5236" roughness={1} />
      </mesh>

      {/* stem */}
      <mesh castShadow position={[0, potH + stemH / 2, 0]}>
        <cylinderGeometry args={[0.14, 0.17, stemH, 8]} />
        <meshStandardMaterial color="#4E7A3A" {...YARN} />
      </mesh>
      {/* two leaves */}
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          castShadow
          position={[w * 0.17 * side, potH + stemH * 0.45, 0]}
          rotation={[0, 0, -0.9 * side]}
          scale={[w * 0.2, 0.09, w * 0.1]}
        >
          <sphereGeometry args={[1, 10, 8]} />
          <meshStandardMaterial color="#4E7A3A" {...YARN} />
        </mesh>
      ))}

      {/* petals around a brown centre */}
      <group position={[0, headY, 0]}>
        {Array.from({ length: 12 }).map((_, i) => {
          const a = (i / 12) * Math.PI * 2;
          return (
            <mesh
              key={i}
              castShadow
              position={[Math.cos(a) * headR * 0.62, Math.sin(a) * headR * 0.62, 0]}
              rotation={[0, 0, a]}
              scale={[headR * 0.4, headR * 0.17, 0.1]}
            >
              <sphereGeometry args={[1, 10, 8]} />
              <meshStandardMaterial color={colour} {...YARN} />
            </mesh>
          );
        })}
        <mesh castShadow>
          <sphereGeometry args={[headR * 0.42, 16, 12]} />
          <meshStandardMaterial color="#6B4A2A" {...YARN} />
        </mesh>
      </group>

      <KeyRing y={headY + headR * 1.1} scale={w / 6} />
    </group>
  );
}

/* The bouquet charm: a cone of wrapping with a cluster of tiny
   roses in the mouth of it and a frill around the rim. */
export function CrochetBouquet({ kind, colour }) {
  const [w, h] = kind.size;
  const coneH = h * 0.55;
  const rimR = w * 0.42;

  return (
    <group>
      <mesh castShadow receiveShadow position={[0, coneH / 2, 0]}>
        <cylinderGeometry args={[rimR, rimR * 0.3, coneH, 16]} />
        <meshStandardMaterial color={colour} {...YARN} />
      </mesh>

      {/* the white frill around the rim */}
      {Array.from({ length: 14 }).map((_, i) => {
        const a = (i / 14) * Math.PI * 2;
        return (
          <mesh key={i} castShadow position={[Math.cos(a) * rimR, coneH, Math.sin(a) * rimR]}>
            <sphereGeometry args={[rimR * 0.26, 10, 8]} />
            <meshStandardMaterial color="#F7F2EA" {...YARN} />
          </mesh>
        );
      })}

      {/* the roses */}
      {Array.from({ length: 9 }).map((_, i) => {
        const a = (i / 9) * Math.PI * 2;
        const r = (i % 3) * rimR * 0.22;
        return (
          <mesh
            key={i}
            castShadow
            position={[Math.cos(a) * r, coneH + rimR * 0.3 + (i % 3) * 0.2, Math.sin(a) * r]}
          >
            <sphereGeometry args={[rimR * 0.24, 12, 10]} />
            <meshStandardMaterial color={i % 2 ? '#E79AB0' : '#7FA86A'} {...YARN} />
          </mesh>
        );
      })}

      <KeyRing y={coneH + rimR * 0.9} scale={w / 6} />
    </group>
  );
}

/* Two cherries on a pearl chain, with a leaf bow above them. */
export function CrochetCherries({ kind, colour }) {
  const [w, h] = kind.size;
  const cherryR = w * 0.22;
  const stemTop = h * 0.78;

  return (
    <group>
      {[-1, 1].map((side) => (
        <group key={side} position={[w * 0.21 * side, cherryR, 0]}>
          <mesh castShadow receiveShadow>
            <sphereGeometry args={[cherryR, 16, 14]} />
            <meshStandardMaterial color={colour} {...YARN} />
          </mesh>
          {/* the stalk, curving up to where the bow is */}
          <mesh position={[(-w * 0.1 * side) / 2, (stemTop - cherryR) / 2, 0]} rotation={[0, 0, 0.3 * side]}>
            <cylinderGeometry args={[0.07, 0.07, stemTop - cherryR, 6]} />
            <meshStandardMaterial color="#2F5A2E" {...YARN} />
          </mesh>
        </group>
      ))}

      {/* the leaf bow */}
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          castShadow
          position={[w * 0.14 * side, stemTop, 0]}
          rotation={[0, 0, -0.7 * side]}
          scale={[w * 0.17, 0.12, w * 0.07]}
        >
          <sphereGeometry args={[1, 10, 8]} />
          <meshStandardMaterial color="#2F5A2E" {...YARN} />
        </mesh>
      ))}

      {/* the pearl chain, looped between the stalks */}
      {Array.from({ length: 10 }).map((_, i) => (
        <mesh key={i} position={[w * 0.3 - i * w * 0.012, stemTop - 0.2 - i * 0.18, 0]}>
          <sphereGeometry args={[0.16, 10, 8]} />
          <meshStandardMaterial color="#F7F3EA" roughness={0.18} metalness={0.25} />
        </mesh>
      ))}

      <KeyRing y={stemTop + 0.5} scale={w / 7} />
    </group>
  );
}

/* The rainbow turtle: a domed shell worked in a pastel spiral, over
   a flat white body with four flippers and a head. */
const SHELL_RAINBOW = ['#F2A8B8', '#F6C9A0', '#F6E6A0', '#B6DDA8', '#A8CFE8', '#C4B4DE'];

export function CrochetTurtle({ kind, colour }) {
  const [w, h, d] = kind.size;
  const bodyR = w * 0.34;
  const shellR = w * 0.42;
  const shellH = h * 0.62;

  return (
    <group>
      {/* the body disc the flippers come off */}
      <mesh castShadow receiveShadow position={[0, h * 0.16, 0]} scale={[1, 0.42, 1.06]}>
        <sphereGeometry args={[bodyR * 1.25, 18, 14]} />
        <meshStandardMaterial color={colour} {...YARN} />
      </mesh>

      {/* head */}
      <mesh castShadow position={[0, h * 0.2, d * 0.42]}>
        <sphereGeometry args={[bodyR * 0.62, 16, 14]} />
        <meshStandardMaterial color={colour} {...YARN} />
      </mesh>
      <BeadEyes y={h * 0.26} spread={bodyR * 0.26} z={d * 0.42 + bodyR * 0.5} size={0.16} />

      {/* four flippers */}
      {[
        [-1, 1],
        [1, 1],
        [-1, -1],
        [1, -1]
      ].map(([sx, sz], i) => (
        <mesh
          key={i}
          castShadow
          position={[w * 0.38 * sx, h * 0.15, d * 0.26 * sz]}
          rotation={[0, (-0.6 * sx * sz) + (sz < 0 ? Math.PI : 0), 0]}
          scale={[bodyR * 0.52, bodyR * 0.2, bodyR * 0.34]}
        >
          <sphereGeometry args={[1, 10, 8]} />
          <meshStandardMaterial color={colour} {...YARN} />
        </mesh>
      ))}

      {/* the shell, as stacked rings of colour — a crocheted spiral
          read from above is rings, and rings are what this is */}
      <group position={[0, h * 0.22, 0]}>
        {SHELL_RAINBOW.map((hex, i) => {
          const t = i / (SHELL_RAINBOW.length - 1);
          const r = shellR * (1 - t * 0.82);
          const y = shellH * t * 0.78;
          return (
            <mesh key={hex} castShadow position={[0, y, 0]}>
              <cylinderGeometry args={[r * 0.88, r, shellH * 0.2, 20]} />
              <meshStandardMaterial color={hex} {...YARN} />
            </mesh>
          );
        })}
      </group>

      <KeyRing y={h * 0.22 + shellH * 0.85} scale={w / 8} />
    </group>
  );
}
