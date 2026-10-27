import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

/* The wide frames banner that sits under the three category cards.

   It carries the couple eye frame for now - a tall photograph in a
   wide band, so it is held to the right of the copy and cropped to
   the frames themselves rather than the plant behind them. If the
   banner artwork from the design turns up, point ART at it instead.

   The image still reports a failure to load, and the banner falls
   back to the painted panel it sits on, so a missing or renamed file
   never ships a broken picture to the home page. */
const ART = '/images/frames/couple-eye-frame.jpg';

export default function PhotoFramesBanner() {
  const [hasArt, setHasArt] = useState(true);

  return (
    <aside className={`frames-banner${hasArt ? '' : ' frames-banner--plain'}`} aria-labelledby="frames-title">
      {hasArt ? (
        <img
          src={ART}
          alt="Two framed prints of a couple’s eyes, held up beside a houseplant"
          loading="lazy" decoding="async"
          onError={() => setHasArt(false)}
        />
      ) : null}

      <div className="frames-banner__copy">
        <h2 className="frames-banner__title" id="frames-title">
          Photo
          <br />
          Frames
        </h2>
        <p className="frames-banner__text">
          Turn your favourite moments into beautiful frames for your space.
        </p>
        <Link className="btn btn--primary btn--sm" to="/photo-frames">
          Explore Photo Frames <ArrowRight className="arrow" size={15} />
        </Link>
      </div>

      <p className="frames-banner__script" aria-hidden="true">
        Moments
        <br />
        Look Better
        <br />
        on Your Walls <span className="heart">♥</span>
      </p>
    </aside>
  );
}
