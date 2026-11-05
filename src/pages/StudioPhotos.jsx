import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Download, Loader2, TriangleAlert } from 'lucide-react';

import usePageMeta from '../hooks/usePageMeta';
import { callCustomerFunction } from '../lib/customerClient';

/* The link the studio gets when a customer's photographs arrive.

   One job: fetch that order's pictures and save them. It starts by
   itself, because somebody who clicked "download them" in an email
   has already said what they want, and offers the button again if
   it fails or if they want a second copy.

   The token is in the address, so it is taken out of the bar as soon
   as it has been used - the same thing the tracking and payment
   pages do. A URL gets copied into messages, and this one fetches
   somebody's photographs.                                          */

const STATE = { WORKING: 'working', DONE: 'done', FAILED: 'failed' };

export default function StudioPhotos() {
  usePageMeta('Download order photographs', 'The studio’s download link.');

  const { token: linkToken } = useParams();
  const [token, setToken] = useState('');
  const [state, setState] = useState(STATE.WORKING);
  const [error, setError] = useState('');
  const [filename, setFilename] = useState('');
  const started = useRef(false);

  const fetchZip = useCallback(async (value) => {
    setState(STATE.WORKING);
    setError('');
    try {
      /* The shop's own key plus the token, which is how every other
         token-carrying page here talks to its function. */
      const res = await callCustomerFunction('photos-zip', { token: value }, { raw: true });

      const name = res.headers.get('X-Zip-Filename') || 'order-photographs.zip';
      const blob = await res.blob();

      const href = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = href;
      link.download = name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(href);

      setFilename(name);
      setState(STATE.DONE);
    } catch (err) {
      setError(err.message || 'That download link is not valid any more.');
      setState(STATE.FAILED);
    }
  }, []);

  useEffect(() => {
    if (!linkToken || started.current) return;
    started.current = true;
    setToken(linkToken);
    fetchZip(linkToken);
    try {
      window.history.replaceState(null, '', '/studio/photos');
    } catch {
      /* a browser that will not rewrite history is not a reason to fail */
    }
  }, [linkToken, fetchZip]);

  return (
    <div className="shell">
      <header className="page-head">
        <h1>Order photographs</h1>
      </header>

      <div className="section">
        <section className="info-card track-card">
          {state === STATE.WORKING ? (
            <p>
              <Loader2 size={16} className="spin" /> Packing the photographs into one file. Larger
              orders take a moment.
            </p>
          ) : null}

          {state === STATE.DONE ? (
            <>
              <p>
                Saved as <strong>{filename}</strong>.
              </p>
              <p className="admin__hint">
                If your browser did not keep it, download it again below. This link works for
                fourteen days from the message it came in.
              </p>
              <p className="track-pay">
                <button className="btn btn--primary btn--sm" type="button" onClick={() => fetchZip(token)}>
                  <Download size={14} /> Download again
                </button>
              </p>
            </>
          ) : null}

          {state === STATE.FAILED ? (
            <>
              <p className="form-error">
                <TriangleAlert size={15} /> {error}
              </p>
              <p className="admin__hint">
                Links last fourteen days. After that, open the order in the studio panel and use the
                download there.
              </p>
              {token ? (
                <p className="track-pay">
                  <button className="btn btn--quiet btn--sm" type="button" onClick={() => fetchZip(token)}>
                    Try again
                  </button>
                </p>
              ) : null}
            </>
          ) : null}
        </section>
      </div>
    </div>
  );
}
