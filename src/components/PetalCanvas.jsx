import { useEffect, useRef } from 'react';

/* Petals drifting over the whole page, and a scatter of them thrown
   from wherever the page is tapped or clicked. Everything is drawn on
   one fixed canvas that never takes pointer events, so it cannot get
   in the way of a button. Skipped entirely under reduced motion. */

/* tints pulled from the brand palette in variables.css */
const TINTS = [
  [241, 232, 226], // soft beige
  [229, 217, 209], // border beige
  [96, 61, 66], // burgundy
  [250, 246, 242], // warm ivory
  [185, 130, 133], // dusty rose
  [216, 200, 190]
];

export default function PetalCanvas() {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !canvas.getContext) return undefined;

    const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return undefined;

    const ctx = canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    let w = 0;
    let h = 0;
    let drifting = [];
    let pops = [];
    let raf = 0;
    let running = false;

    function resize() {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function seed(p, above) {
      const t = TINTS[(Math.random() * TINTS.length) | 0];
      p.x = Math.random() * w;
      p.y = above ? -20 - Math.random() * h * 0.6 : Math.random() * h;
      p.size = 7 + Math.random() * 11;
      p.speed = 0.28 + Math.random() * 0.62;
      p.sway = 14 + Math.random() * 30;
      p.phase = Math.random() * Math.PI * 2;
      p.drift = 0.0045 + Math.random() * 0.0075;
      p.spin = (Math.random() - 0.5) * 0.016;
      p.angle = Math.random() * Math.PI * 2;
      p.flip = 0.45 + Math.random() * 0.55;
      p.alpha = 0.3 + Math.random() * 0.4;
      p.rgb = `rgba(${t[0]},${t[1]},${t[2]},`;
      return p;
    }

    function build() {
      /* a phone gets fewer petals than a desktop */
      const want = Math.max(10, Math.min(30, Math.round(w / 52)));
      drifting = [];
      for (let i = 0; i < want; i += 1) drifting.push(seed({}, false));
    }

    /* petals thrown from a tap: own velocity, gravity and a fade */
    function burst(x, y) {
      const n = 7 + ((Math.random() * 5) | 0);
      if (pops.length > 90) pops.splice(0, pops.length - 90);

      for (let i = 0; i < n; i += 1) {
        const p = seed({}, false);
        const dir = (i / n) * Math.PI * 2 + Math.random() * 0.6;
        const push = 1.5 + Math.random() * 3.2;

        p.x = x;
        p.y = y;
        p.vx = Math.cos(dir) * push;
        p.vy = Math.sin(dir) * push - 1.6;
        p.life = 1;
        p.fade = 0.006 + Math.random() * 0.007;
        p.alpha = 0.5 + Math.random() * 0.45;
        p.spin = (Math.random() - 0.5) * 0.09;
        pops.push(p);
      }
      go();
    }

    function shape(p) {
      const s = p.size;
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.5);
      ctx.bezierCurveTo(s * 0.55, -s * 0.34, s * 0.46, s * 0.4, 0, s * 0.5);
      ctx.bezierCurveTo(-s * 0.46, s * 0.4, -s * 0.55, -s * 0.34, 0, -s * 0.5);
      ctx.closePath();
    }

    function frame() {
      ctx.clearRect(0, 0, w, h);

      for (let i = 0; i < drifting.length; i += 1) {
        const p = drifting[i];
        p.phase += p.drift;
        p.angle += p.spin;
        p.y += p.speed;

        const x = p.x + Math.sin(p.phase) * p.sway;
        if (p.y - p.size > h) {
          seed(p, true);
          continue;
        }

        ctx.save();
        ctx.translate(x, p.y);
        ctx.rotate(p.angle);
        /* squash across the sway so the petal reads as turning over */
        ctx.scale(Math.max(0.22, Math.abs(Math.cos(p.phase * 1.6)) * p.flip + 0.2), 1);
        ctx.fillStyle = p.rgb + p.alpha.toFixed(3) + ')';
        shape(p);
        ctx.fill();
        ctx.restore();
      }

      for (let j = pops.length - 1; j >= 0; j -= 1) {
        const q = pops[j];
        q.vy += 0.055; /* gravity */
        q.vx *= 0.987; /* air */
        q.vy *= 0.993;
        q.x += q.vx;
        q.y += q.vy;
        q.angle += q.spin;
        q.life -= q.fade;

        if (q.life <= 0 || q.y - q.size > h) {
          pops.splice(j, 1);
          continue;
        }

        ctx.save();
        ctx.translate(q.x, q.y);
        ctx.rotate(q.angle);
        ctx.scale(Math.max(0.25, Math.abs(Math.cos(q.angle * 1.3))), 1);
        ctx.fillStyle = q.rgb + (q.alpha * q.life).toFixed(3) + ')';
        shape(q);
        ctx.fill();
        ctx.restore();
      }

      raf = window.requestAnimationFrame(frame);
    }

    function go() {
      if (running || document.hidden) return;
      running = true;
      raf = window.requestAnimationFrame(frame);
    }

    function stop() {
      running = false;
      window.cancelAnimationFrame(raf);
    }

    /* a tap, click or drag anywhere scatters petals from that point */
    let last = 0;
    function scatter(x, y) {
      const now = Date.now();
      if (now - last < 90) return; /* keep a drag from flooding */
      last = now;
      burst(x, y);
    }

    const onPointer = (e) => scatter(e.clientX, e.clientY);
    const onTouch = (e) => {
      const t = e.changedTouches && e.changedTouches[0];
      if (t) scatter(t.clientX, t.clientY);
    };

    /* keyboard users get the same moment from whatever they activate */
    const onKey = (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const el = document.activeElement;
      if (!el || !el.getBoundingClientRect) return;
      const tag = el.tagName;
      if (tag !== 'BUTTON' && tag !== 'A') return; /* never while typing */
      const r = el.getBoundingClientRect();
      if (r.width) scatter(r.left + r.width / 2, r.top + r.height / 2);
    };

    const onResize = () => {
      resize();
      build();
    };

    const onVisibility = () => {
      if (document.hidden) stop();
      else go();
    };

    resize();
    build();
    go();

    /* small hook so the animation can be inspected and tested */
    window.__petals = { burst, scattered: () => pops.length, drifting: () => drifting.length };

    window.addEventListener('resize', onResize);
    document.addEventListener('visibilitychange', onVisibility);
    if (window.PointerEvent) {
      document.addEventListener('pointerdown', onPointer, { passive: true });
    } else {
      document.addEventListener('touchstart', onTouch, { passive: true });
      document.addEventListener('mousedown', onPointer, { passive: true });
    }
    document.addEventListener('keydown', onKey);

    return () => {
      stop();
      delete window.__petals;
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVisibility);
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('touchstart', onTouch);
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  return <canvas className="petals" ref={ref} aria-hidden="true" />;
}
