import { useEffect } from 'react';

/* Per-route <title> and meta description — basic SEO without pulling
   in a helmet dependency. */
export default function usePageMeta(title, description) {
  useEffect(() => {
    const full = title ? `${title} — WrappedStudio` : 'WrappedStudio — Personalised Magazines, Polaroids & Bouquets';
    document.title = full;

    if (!description) return;
    let tag = document.querySelector('meta[name="description"]');
    if (!tag) {
      tag = document.createElement('meta');
      tag.setAttribute('name', 'description');
      document.head.appendChild(tag);
    }
    tag.setAttribute('content', description);
  }, [title, description]);
}
