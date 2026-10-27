/* ===========================================================
   Textures the product models share.

   Two gifts of the same kind in one box are two meshes, but there
   is only ever one KitKat wrapper on the GPU: textures are cached
   by url and reference-counted, so putting four bars in and taking
   three out again does not leave three copies of a 512-pixel image
   resident.

   Nothing is fetched until a model actually asks for it, which is
   what keeps the studio from pulling twenty photographs down the
   moment the page opens.
   =========================================================== */

import { useEffect, useState } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';

/* url -> { texture, count, promise } */
const cache = new Map();

/* Textures of gifts that have been taken out of the box are kept for
   a moment rather than destroyed: putting one back is a common thing
   to do, and re-decoding the image for it would show a grey mesh for
   a frame. Anything still unused after this long is disposed. */
const LINGER_MS = 30000;
const pending = new Map();

function loadTexture(url) {
  return new Promise((resolve, reject) => {
    new THREE.TextureLoader().load(
      url,
      (map) => {
        map.colorSpace = THREE.SRGBColorSpace;
        map.anisotropy = 4;
        /* The product photographs are square crops; the faces they go
           on are not, so the texture is told to fill rather than tile
           past its edge. */
        map.wrapS = THREE.ClampToEdgeWrapping;
        map.wrapT = THREE.ClampToEdgeWrapping;
        resolve(map);
      },
      undefined,
      () => reject(new Error(`texture failed: ${url}`))
    );
  });
}

export function acquireTexture(url) {
  if (!url) return Promise.resolve(null);

  const waiting = pending.get(url);
  if (waiting) {
    clearTimeout(waiting);
    pending.delete(url);
  }

  let entry = cache.get(url);
  if (!entry) {
    entry = { texture: null, count: 0, promise: null };
    cache.set(url, entry);
  }

  entry.count += 1;

  if (entry.texture) return Promise.resolve(entry.texture);

  if (!entry.promise) {
    entry.promise = loadTexture(url).then(
      (map) => {
        entry.texture = map;
        entry.promise = null;
        /* Released while it was still loading. Nothing wants it. */
        if (entry.count <= 0) {
          map.dispose();
          cache.delete(url);
          return null;
        }
        return map;
      },
      (err) => {
        entry.promise = null;
        cache.delete(url);
        throw err;
      }
    );
  }

  return entry.promise;
}

export function releaseTexture(url) {
  const entry = cache.get(url);
  if (!entry) return;

  entry.count -= 1;
  if (entry.count > 0) return;

  const timer = setTimeout(() => {
    pending.delete(url);
    const current = cache.get(url);
    if (!current || current.count > 0) return;
    current.texture?.dispose();
    cache.delete(url);
  }, LINGER_MS);

  pending.set(url, timer);
}

/* A product's own artwork, on the face that carries it. Returns null
   until it has loaded and if it never does — every model draws its
   plain colour underneath, so a texture that fails to decode costs
   the branding and nothing else. */
export default function useProductTexture(url) {
  const [texture, setTexture] = useState(null);
  const { invalidate } = useThree();

  useEffect(() => {
    if (!url) {
      setTexture(null);
      return undefined;
    }

    let live = true;

    acquireTexture(url)
      .then((map) => {
        if (!live || !map) return;
        setTexture(map);
        /* The scene only draws on demand, so a texture that arrives
           after the last frame has to ask for another one. */
        invalidate();
      })
      .catch(() => {
        /* left plain; the panel reports the model's status */
      });

    return () => {
      live = false;
      setTexture(null);
      releaseTexture(url);
    };
  }, [url, invalidate]);

  return texture;
}

/* For tests and for teardown in development. */
export function disposeAllTextures() {
  pending.forEach((timer) => clearTimeout(timer));
  pending.clear();
  cache.forEach((entry) => entry.texture?.dispose());
  cache.clear();
}
