import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

/* The wide frames banner that sits under the three category cards.

   The artwork is not in the repository yet. Rather than ship a broken
   picture onto the home page while it is missing, the image reports a
   failure to load and the banner falls back to the painted panel it
   sits on - the words and the button are unaffected either way. Drop
   the file at the path below and it appears. */
const ART = '/images/photo-frames.jpg';

export default function PhotoFramesBanner() {
  const [hasArt, setHasArt] = useState(true);

  return (
    <aside className={`frames-banner${hasArt ? '' : ' frames-banner--plain'}`} aria-labelledby="frames-title">
      {hasArt ? (
        <img
          src={ART}
          alt="Framed photographs of a couple at sunset, propped among dried flowers"
          loading="lazy"
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
