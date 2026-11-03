import { useEffect, useRef, useState } from 'react';

/* Opening video. Plays once per browser tab the first time the site is
   opened, then hands over to the page underneath.

   It is never allowed to be the reason the site feels slow. The clip
   used to be a 1.3 MB file with preload="auto" behind a full-screen
   overlay that locked scrolling, no skip, and a twenty-second failsafe:
   on a phone on mobile data that is ten seconds of staring at a still
   frame before the shop can be touched. So now:

     · the file is 340 KB (720p30 rather than 1080p60)
     · a slow connection, or data saver, skips it outright
     · if playback has not actually begun within 2.5s, it gives up and
       lets the visitor through
     · a stall of more than 3s mid-clip does the same

   There is deliberately no skip: the clip runs, and the two watchdogs
   above are what keep a slow network from trapping anybody behind it.

   Sound: a browser will not let a page start audio on its own until it
   trusts the site. The clip asks once, and asks again on the first real
   interaction of any kind (tap, click, key) - that is what actually
   grants audio. The old 250ms retry loop called play() forty times
   during the one moment the main thread was busiest, and never once
   won audio that an interaction would not have granted anyway. */

const SEEN_KEY = 'ws-intro-seen';

/* how long to wait for the first frame before giving up on the intro */
const START_BUDGET_MS = 2500;
/* how long a mid-clip stall is tolerated before handing over */
const STALL_BUDGET_MS = 3000;

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
    /* private window - the intro simply plays again next time */
  }
}

/* A visitor on a slow link should get the shop, not a loading screen
   with a video behind it. */
function connectionTooSlow() {
  const c =
    navigator.connection || navigator.mozConnection || navigator.webkitConnection || null;
  if (!c) return false;
  if (c.saveData) return true;
  return ['slow-2g', '2g', '3g'].includes(c.effectiveType);
}

export default function IntroVideo() {
  const videoRef = useRef(null);
  const dismissed = useRef(false);
  const [show, setShow] = useState(() => {
    if (typeof window === 'undefined') return false;
    if (alreadySeen()) return false;
    if (connectionTooSlow()) return false;
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
    let startTimer = 0;
    let stallTimer = 0;

    function finish() {
      if (dismissed.current) return;
      dismissed.current = true;
      remember();
      setLeaving(true);
      window.setTimeout(() => setShow(false), 500);
    }

    /* Ask for sound. Falls back to a silent picture if refused. */
    function wantSound() {
      const el = videoRef.current;
      if (!el || cancelled) return;
      el.volume = 1;
      el.muted = false;
      el.play().catch(() => {
        if (cancelled || !videoRef.current) return;
        videoRef.current.muted = true;
        videoRef.current.play().catch(finish);
      });
    }

    wantSound();

    /* The clip has this long to put a frame on screen. If the network
       is not keeping up, the shop is more use than the intro. */
    startTimer = window.setTimeout(() => {
      if (!cancelled && videoRef.current && videoRef.current.currentTime === 0) finish();
    }, START_BUDGET_MS);

    function onPlaying() {
      window.clearTimeout(startTimer);
      window.clearTimeout(stallTimer);
    }

    /* Buffering mid-clip: give it a moment, then hand over rather than
       leave the visitor looking at a frozen frame. */
    function onWaiting() {
      window.clearTimeout(stallTimer);
      stallTimer = window.setTimeout(finish, STALL_BUDGET_MS);
    }

    video.addEventListener('playing', onPlaying);
    video.addEventListener('waiting', onWaiting);
    video.addEventListener('stalled', onWaiting);

    /* A real tap, click or key is what grants audio. One listener each,
       removed as soon as it has done its job. */
    const events = ['pointerdown', 'click', 'keydown'];
    function onInteract() {
      if (cancelled || !videoRef.current) return;
      if (videoRef.current.muted) wantSound();
      events.forEach((type) => document.removeEventListener(type, onInteract, { capture: true }));
    }
    events.forEach((type) =>
      document.addEventListener(type, onInteract, { capture: true, passive: true })
    );

    return () => {
      cancelled = true;
      window.clearTimeout(startTimer);
      window.clearTimeout(stallTimer);
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('waiting', onWaiting);
      video.removeEventListener('stalled', onWaiting);
      events.forEach((type) => document.removeEventListener(type, onInteract, { capture: true }));
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
