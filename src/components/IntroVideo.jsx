import { useEffect, useRef, useState } from 'react';

/* Opening video. Plays once per browser tab the first time the site is
   opened, then hands over to the page underneath. It runs to the end —
   there is no skip and no controls.

   Sound: a browser will not let a page start audio on its own until it
   trusts the site, so the clip asks for sound immediately, and if it is
   refused it keeps asking — on a short retry loop and on the first real
   interaction of any kind (tap, click, key, scroll). The moment one of
   those lands, the sound comes on by itself. */

const SEEN_KEY = 'ws-intro-seen';

function alreadySeen() {
  try {
    return sessionStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

function remember() {
  try {
    sessionStorage.setItem(SEEN_KEY, '1');
  } catch {
    /* private window — the intro simply plays again next time */
  }
}

export default function IntroVideo() {
  const videoRef = useRef(null);
  const dismissed = useRef(false);
  const [show, setShow] = useState(() => {
    if (typeof window === 'undefined') return false;
    if (alreadySeen()) return false;
    return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });
  const [leaving, setLeaving] = useState(false);

  /* hold the page still while the intro is up */
  useEffect(() => {
    if (!show) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [show]);

  useEffect(() => {
    if (!show) return undefined;
    const video = videoRef.current;
    if (!video) return undefined;

    let cancelled = false;
    let retry = 0;

    function finish() {
      if (dismissed.current) return;
      dismissed.current = true;
      remember();
      setLeaving(true);
      window.setTimeout(() => setShow(false), 500);
    }

    /* Ask for sound. Resolves true once the clip is audibly playing. */
    async function wantSound() {
      const el = videoRef.current;
      if (!el || cancelled) return true;
      el.volume = 1;
      el.muted = false;
      try {
        await el.play();
        return !el.muted && !el.paused;
      } catch {
        /* refused — stay silent but keep the picture running */
        el.muted = true;
        el.play().catch(() => {});
        return false;
      }
    }

    async function start() {
      const gotSound = await wantSound();
      if (cancelled) return;
      if (!gotSound && videoRef.current && videoRef.current.paused) {
        /* even muted playback was refused: nothing to show */
        finish();
      }
    }

    start();

    /* keep asking: some browsers grant audio a moment after playback
       has settled, and any real interaction grants it outright */
    async function tryAgain() {
      if (cancelled || !videoRef.current) return;
      if (!videoRef.current.muted) {
        window.clearInterval(timer);
        return;
      }
      retry += 1;
      if (retry > 40) window.clearInterval(timer);
      await wantSound();
    }

    const timer = window.setInterval(tryAgain, 250);

    const events = ['pointerdown', 'pointerup', 'touchstart', 'touchend', 'click', 'keydown', 'scroll', 'wheel'];
    events.forEach((type) =>
      document.addEventListener(type, tryAgain, { capture: true, passive: true })
    );

    const failsafe = window.setTimeout(finish, 20000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.clearTimeout(failsafe);
      events.forEach((type) => document.removeEventListener(type, tryAgain, { capture: true }));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show]);

  function dismiss() {
    if (dismissed.current) return;
    dismissed.current = true;
    remember();
    setLeaving(true);
    window.setTimeout(() => setShow(false), 500);
  }

  if (!show) return null;

  return (
    <div className={`intro${leaving ? ' is-leaving' : ''}`} role="presentation">
      <video
        ref={videoRef}
        className="intro__video"
        src="/intro.mp4"
        poster="/intro-poster.jpg"
        autoPlay
        playsInline
        preload="auto"
        onEnded={dismiss}
        onError={dismiss}
      />
    </div>
  );
}
