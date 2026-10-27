import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

import { getBoxVariant, getGiftKind } from '../../data/hamperKit';
import { acquireAssetUrl, releaseAssetUrl } from '../../lib/designAssets';
import { orientedBounds, interior } from '../../lib/giftBounds';
import ProductModel from '../models/registry';

/* ===========================================================
   One gift in the box: the product itself, its photograph if it
   carries one, and the flight it takes when the packer moves it.

   Nothing here writes a position. The studio arranges the box, so
   a gift's job in the scene is to be visible, be selectable, and
   travel to wherever the packer has decided it goes. Tapping one
   selects it and nothing more.

   The travel is staged — up, across, down — rather than a straight
   line between two points, and the stages are offset gift by gift.
   A straight line between two valid arrangements passes through
   invalid ones, and a box of gifts sliding through each other on
   the way to a tidy result looks like a bug even though the result
   is correct. Lifting clear of everything first costs nothing and
   cannot intersect.
   =========================================================== */

/* The photograph on a frame, a print or a magazine cover. The texture
   comes from a Blob in IndexedDB by way of a fresh object URL, which
   is why a restored design shows the real photo and not a dead
   blob: reference. */
function usePhotoTexture(assetId) {
  const [texture, setTexture] = useState(null);
  const { invalidate } = useThree();

  useEffect(() => {
    if (!assetId) {
      setTexture(null);
      return undefined;
    }

    let cancelled = false;
    let made = null;

    acquireAssetUrl(assetId).then((entry) => {
      if (!entry) return;
      if (cancelled) {
        releaseAssetUrl(assetId);
        return;
      }
      const loader = new THREE.TextureLoader();
      loader.load(
        entry.url,
        (map) => {
          if (cancelled) {
            map.dispose();
            releaseAssetUrl(assetId);
            return;
          }
          map.colorSpace = THREE.SRGBColorSpace;
          map.anisotropy = 4;
          made = map;
          setTexture(map);
          invalidate();
        },
        undefined,
        () => {
          /* The blob is there but will not decode. The gift still
             renders in its plain colour; the panel says the photo
             could not be shown. */
          releaseAssetUrl(assetId);
        }
      );
    });

    return () => {
      cancelled = true;
      if (made) made.dispose();
      releaseAssetUrl(assetId);
      setTexture(null);
    };
  }, [assetId, invalidate]);

  return texture;
}

/* What selection looks like in the scene: the gift's real bounds,
   drawn as a cage. A ring on the floor was enough when every gift
   stood on the floor; one that has been lifted or tipped over needs
   an outline that goes where it went. */
function SelectionCage({ kind, scale, rotation, tone }) {
  const { half, centre } = useMemo(
    () => orientedBounds(kind, { scale, rotation }),
    [kind, scale, rotation]
  );

  return (
    <group position={centre}>
      <mesh>
        <boxGeometry args={[half[0] * 2 + 0.3, half[1] * 2 + 0.3, half[2] * 2 + 0.3]} />
        <meshBasicMaterial color={tone} wireframe transparent opacity={0.75} />
      </mesh>
    </group>
  );
}

/* A gift the packer could not fit sits where it was, tinted, so it
   is obviously not part of the arrangement. The panel says why. */
function NotPlacedMark({ bounds, tone }) {
  return (
    <group position={bounds.centre}>
      <mesh>
        <boxGeometry args={[bounds.half[0] * 2 + 0.4, bounds.half[1] * 2 + 0.4, bounds.half[2] * 2 + 0.4]} />
        <meshBasicMaterial color={tone} wireframe transparent opacity={0.55} />
      </mesh>
    </group>
  );
}

/* Moves the group to where the packer put it, the long way round.

   `delay` staggers the gifts so two of them are never crossing the
   box at the same moment, which is the other half of keeping the
   transition free of apparent collisions. A gift that has only just
   been added skips the flight and simply appears where it belongs:
   it was nowhere before, so there is nothing to travel from. */
const RISE = 0.3;
const CRUISE = 0.72;
const SPEED = 0.0016; /* progress per millisecond — about 620ms */

function useArrival(group, target, cruiseY, delay) {
  const { invalidate } = useThree();
  const flight = useRef(null);
  const at = useRef(null);

  useEffect(() => {
    const from = at.current;

    if (!from) {
      /* First time this gift has been drawn. */
      at.current = [...target];
      if (group.current) group.current.position.set(...target);
      invalidate();
      return;
    }

    const moved = target.some((n, i) => Math.abs(n - from[i]) > 0.01);
    if (!moved) return;

    flight.current = { from: [...from], to: [...target], started: performance.now() + delay };
    invalidate();
  }, [target[0], target[1], target[2], delay, group, invalidate]);

  useFrame(() => {
    const run = flight.current;
    if (!run) return;

    const now = performance.now();
    if (now < run.started) {
      invalidate();
      return;
    }

    const t = Math.min(1, (now - run.started) * SPEED);
    const { from, to } = run;

    /* up, across, down */
    let x = from[0];
    let z = from[2];
    let y;

    if (t < RISE) {
      y = from[1] + (cruiseY - from[1]) * (t / RISE);
    } else if (t < CRUISE) {
      const k = (t - RISE) / (CRUISE - RISE);
      const eased = k * k * (3 - 2 * k);
      x = from[0] + (to[0] - from[0]) * eased;
      z = from[2] + (to[2] - from[2]) * eased;
      y = cruiseY;
    } else {
      const k = (t - CRUISE) / (1 - CRUISE);
      x = to[0];
      z = to[2];
      y = cruiseY + (to[1] - cruiseY) * (k * k * (3 - 2 * k));
    }

    group.current?.position.set(x, y, z);
    at.current = [x, y, z];

    if (t >= 1) {
      flight.current = null;
      at.current = [...to];
      group.current?.position.set(...to);
    }

    invalidate();
  });
}


export default function GiftMesh({ gift, box, index = 0, onSelect, selected, locked }) {
  const kind = getGiftKind(gift.kindId);
  const texture = usePhotoTexture(kind?.supportsPhoto ? gift.assetId : null);

  const group = useRef(null);
  const [hover, setHover] = useState(false);

  const variant = getBoxVariant(box);
  const scale = kind?.supportsScale ? gift.scale : 1;
  const rotation = gift.rotation;

  /* Above everything the box can hold, so the flight across the top
     cannot clip the tallest gift standing in it. */
  const cruiseY = interior(variant).ceiling + 2;
  const target = gift.position;

  useArrival(group, target, cruiseY, index * 70);

  if (!kind) return null;

  const bounds = orientedBounds(kind, { scale, rotation });
  /* A generous invisible handle around a small gift: a 2.4 cm lip
     gloss is impossible to tap otherwise. */
  const handle = [
    Math.max(bounds.half[0] * 2, 5),
    Math.max(bounds.half[1] * 2, 4),
    Math.max(bounds.half[2] * 2, 5)
  ];

  const unplaced = gift.placed === false;
  const tone = unplaced ? '#C25B49' : selected ? '#B98285' : '#C9A227';

  return (
    /* Two groups, and the split matters: the product turns and
       resizes, the outline does not. The outline is drawn in world
       axes from the same bounds maths the packer uses, so what is
       highlighted is exactly what was tested against the walls. */
    <group ref={group}>
      <group rotation={rotation} scale={scale}>
        <ProductModel
          kind={kind}
          colour={gift.colour}
          texture={texture}
          text={gift.text}
          variantId={gift.variantId}
        />

        {/* A second and third of the same thing, set back and to the
            side, so "quantity 3" is visible in the box rather than
            only in the panel. The packer knows about them: a gift's
            collision boxes grow with its quantity. */}
        {gift.quantity > 1 && (
          <group position={[kind.size[0] * 0.52, 0, -kind.size[2] * 0.42]} rotation={[0, 0.4, 0]} scale={0.94}>
            <ProductModel kind={kind} colour={gift.colour} texture={texture} text="" variantId={gift.variantId} />
          </group>
        )}
        {gift.quantity > 2 && (
          <group position={[-kind.size[0] * 0.5, 0, -kind.size[2] * 0.46]} rotation={[0, -0.5, 0]} scale={0.9}>
            <ProductModel kind={kind} colour={gift.colour} texture={texture} text="" variantId={gift.variantId} />
          </group>
        )}
      </group>

      {/* Tapping selects. Nothing here moves a gift — the studio
          decides where each one goes. */}
      <mesh
        position={bounds.centre}
        visible={false}
        onPointerDown={(event) => {
          if (locked) return;
          event.stopPropagation();
          onSelect(gift.uid);
        }}
        onPointerOver={() => setHover(true)}
        onPointerOut={() => setHover(false)}
      >
        <boxGeometry args={handle} />
      </mesh>

      {unplaced && <NotPlacedMark bounds={bounds} tone={tone} />}
      {!unplaced && (selected || hover) && (
        <SelectionCage kind={kind} scale={scale} rotation={rotation} tone={tone} />
      )}
    </group>
  );
}
