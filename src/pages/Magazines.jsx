import { Check } from 'lucide-react';

import MagazineCustomiser from '../components/MagazineCustomiser';
import usePageMeta from '../hooks/usePageMeta';
import { getByCategory, getProductById, MAGAZINE_THEMES } from '../data/products';
import { useText } from '../context/SiteConfigContext';

export default function Magazines() {
  /* The heading on the page is a picture, so the editable title
     names that picture for a screen reader and titles the browser
     tab. Editing it in the panel will not redraw the artwork. */
  const title = useText('magazines.title', 'Personalised Magazines');

  usePageMeta(
    title,
    'Personalised photo magazines in A4 (₹300 for 4 pages, ₹550 for 8) and A5 (₹200 for 4 pages, ₹400 for 8). Choose a theme, send photos, approve the PDF preview.'
  );

  /* The customiser is the page's ending, in place of the cards that
     used to be its opening: the A4 four-page magazine is what it
     starts on, and every other size is a click inside it. */
  const start = getProductById('magazine-a4-4') || getByCategory('magazine')[0];

  /* Only the themes we have finished pages for get a lookbook card;
     the rest stay in the list above until there is work to show. */
  const lookbook = MAGAZINE_THEMES.filter((theme) => theme.samples?.length);


  return (
    <div className="shell">
      <header className="page-head">
        <h1 className="page-head__art">
          <img src="/images/headings/magazines.webp" alt={title} width="1200" height="379" />
        </h1>
        <p>{useText('magazines.subtitle', 'Turn your favourite memories into a magazine made just for you.')}</p>
      </header>

      {lookbook.length > 0 && (
        <section className="section theme-look" aria-labelledby="theme-look-title">
          <h2 className="section-title" id="theme-look-title">
            Themes we have made
          </h2>
          <p className="theme-look__intro">
            Real magazines from the studio. Your photographs, your names and your dates go in their place — the
            layouts are designed again for every order.
          </p>

          <div className="theme-look__grid">
            {lookbook.map((theme) => (
              <article className="theme-look__card" key={theme.id}>
                <header className="theme-look__head">
                  <h3>{theme.name}</h3>
                  <p>{theme.blurb}</p>
                </header>
                <div className="theme-look__shots">
                  {theme.samples.map((shot) => (
                    <figure className="theme-look__shot" key={shot.src}>
                      <img src={shot.src} alt={shot.alt} loading="lazy" decoding="async" />
                    </figure>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="section two-col" aria-label="How magazines work">
        <div className="info-card">
          <h3>How your magazine is made</h3>
          <ol className="numbered">
            <li>Choose the size — A4 or A5, in 4 pages / 8 sides or 8 pages / 16 sides.</li>
            <li>Choose a theme from the list, or ask for a custom one.</li>
            <li>Share your photographs to suit the size you picked.</li>
            <li>We design and edit the pages by hand.</li>
            <li>You get a PDF preview to look over.</li>
            <li>Printing starts only after you approve that preview.</li>
            <li>The magazine is packed carefully and shipped to you.</li>
          </ol>
          <p className="form-note">
            Share your photographs according to the selected magazine size. Choose a theme, and your magazine pages
            will be designed and provided as a PDF preview. After your approval, the magazine can be printed and
            shipped. Design, printing and shipping are handled by our team after you place the order — this website
            does not generate the PDF automatically.
          </p>
        </div>

        <div className="info-card">
          <h3>Themes you can pick</h3>
          <ul className="pdp__list">
            {MAGAZINE_THEMES.map((theme) => (
              <li key={theme.id}>
                <Check size={15} />
                <span>
                  <strong style={{ color: 'var(--ink)' }}>{theme.name}</strong> — {theme.blurb}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {start && (
        <section className="section" aria-label="Customise your magazine">
          <MagazineCustomiser product={start} />
        </section>
      )}
    </div>
  );
}
