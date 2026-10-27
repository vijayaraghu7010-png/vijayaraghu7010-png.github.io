import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Box,
  ChevronRight,
  Gift,
  Info,
  Loader2,
  Package,
  PenLine,
  Save,
  ShoppingBag,
  Sparkles,
  X
} from 'lucide-react';

import usePageMeta from '../hooks/usePageMeta';
import '../styles/hamper.css';
import useHamperDesign, { PHASE } from '../hooks/useHamperDesign';
import HamperScene from '../hamper/scene/HamperScene';
import AppearancePanel from '../hamper/panels/AppearancePanel';
import GiftCatalogPanel from '../hamper/panels/GiftCatalogPanel';
import SelectedGiftsPanel from '../hamper/panels/SelectedGiftsPanel';
import ArrangementBar from '../hamper/panels/ArrangementBar';
import MessagePanel from '../hamper/panels/MessagePanel';
import PricePanel from '../hamper/panels/PricePanel';
import SavedDesignsPanel from '../hamper/panels/SavedDesignsPanel';
import SaveStatus from '../hamper/panels/SaveStatus';
import { priceDesign, pricingDrift } from '../lib/designPricing';
import { prepareOrder } from '../lib/designCheckout';
import { describeDesign } from '../lib/designSchema';
import { arrangementSummary } from '../lib/packing';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useSiteConfig } from '../context/SiteConfigContext';
import { formatRupees } from '../utils/currency';

/* ===========================================================
   The hamper studio.

   The 3D box is the page; the panels are a column beside it on a
   desktop and a sheet of expanders beneath it on a phone. Nothing is
   rendered until the saved design has been read back, because a
   blank box that fills in a second later is indistinguishable from
   the site having lost the design.
   =========================================================== */

const TABS = [
  { id: 'gifts', label: 'Add gifts', icon: Gift },
  { id: 'inside', label: "What's inside", icon: Package },
  { id: 'box', label: 'The box', icon: Box },
  { id: 'message', label: 'Message', icon: PenLine },
  { id: 'saved', label: 'Saved', icon: Save }
];

function Notice({ notice, onDismiss }) {
  return (
    <div className={`studio-notice studio-notice--${notice.tone}`} role={notice.tone === 'info' ? 'status' : 'alert'}>
      {notice.tone === 'info' ? <Info size={16} aria-hidden="true" /> : <AlertTriangle size={16} aria-hidden="true" />}
      <div>
        <p className="studio-notice__title">{notice.title}</p>
        <p className="studio-notice__body">{notice.body}</p>
      </div>
      <button type="button" aria-label="Dismiss" onClick={() => onDismiss(notice.id)}>
        <X size={15} />
      </button>
    </div>
  );
}

export default function HamperStudio() {
  usePageMeta(
    'Build Your Own Hamper',
    'Build a gift hamper in 3D — choose the box, fill it, write the card, and pick up where you left off. Your design saves itself on your device.'
  );

  const studio = useHamperDesign();
  const { design, phase, change, flush, retry, notices, dismissNotice, missingAssets, addNotice } = studio;

  const { offers } = useSiteConfig();
  const { addItem, openCart } = useCart();
  const { isSignedIn } = useAuth();
  const navigate = useNavigate();

  const [tab, setTab] = useState('gifts');
  const [ordering, setOrdering] = useState(false);
  const [orderProblems, setOrderProblems] = useState([]);
  const [tick, setTick] = useState(0);
  const canvas = useRef(null);

  /* The price is derived, never stored-and-trusted. */
  const pricing = useMemo(() => priceDesign(design, offers), [design, offers]);
  const drift = useMemo(() => pricingDrift(design, pricing), [design, pricing]);

  /* What the customer was shown, noted on the design for the saved
     list. Cosmetic, so it does not count as an unsaved change. */
  const notedPrice = useRef(null);
  useEffect(() => {
    if (phase !== PHASE.READY) return;
    if (notedPrice.current === pricing.payable) return;
    notedPrice.current = pricing.payable;
    change({
      type: 'pricing-shown',
      pricing: { subtotal: pricing.subtotal, payable: pricing.payable, computedAt: pricing.computedAt }
    });
  }, [pricing.payable, pricing.subtotal, pricing.computedAt, phase, change]);

  /* Keeps "saved 2 minutes ago" honest without a render loop. */
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 30000);
    return () => clearInterval(id);
  }, []);

  const onSelect = useCallback((uid) => change({ type: 'select', uid }), [change]);

  const onCameraRest = useCallback((camera) => change({ type: 'camera', camera }), [change]);
  const onCanvasReady = useCallback((element) => {
    canvas.current = element;
  }, []);

  const toOrder = async () => {
    setOrderProblems([]);

    /* Nothing goes in the bag that the studio could not pack. The
       check is repeated in prepareOrder against the stored design;
       this is the one that keeps the button honest. */
    const arrangement = arrangementSummary(design);
    if (!arrangement.ok) {
      setOrderProblems([
        `${arrangement.unplaced.length === 1 ? 'One gift does' : `${arrangement.unplaced.length} gifts do`} not fit in this box yet. Choose a larger box or take something out, then try again.`
      ]);
      return;
    }

    setOrdering(true);

    try {
      /* Everything outstanding is on disk before an order is raised
         against it, so the reference in the bag always points at a
         design this browser actually holds. */
      await flush();

      const result = await prepareOrder(design, { offers, canvas: canvas.current });

      if (!result.ok) {
        setOrderProblems(result.errors);
        return;
      }

      change({ type: 'ordered', orderedAs: result.orderedAs });
      addItem(result.cartProduct, { quantity: 1, config: result.cartConfig });

      if (result.warnings.length) {
        addNotice({
          tone: 'warn',
          title: 'Added to your bag, with a note',
          body: result.warnings.join(' ')
        });
      }

      openCart();
      navigate('/cart');
    } catch (err) {
      setOrderProblems([
        'Your hamper could not be added to your bag. Nothing has been lost — try again in a moment.'
      ]);
      /* The design is untouched and still on screen. */
      void err;
    } finally {
      setOrdering(false);
    }
  };

  /* ------------------------------------------------------- loading */

  if (phase === PHASE.LOADING) {
    return (
      <div className="shell">
        <div className="studio-loading" role="status">
          <Loader2 size={26} className="spin" aria-hidden="true" />
          <p>Opening your hamper…</p>
          <p className="field-hint">Checking this device for a design you were working on.</p>
        </div>
      </div>
    );
  }

  const activeTab = TABS.find((t) => t.id === tab) || TABS[0];
  const arrangement = arrangementSummary(design);
  const giftCount = design.gifts.reduce((n, g) => n + g.quantity, 0);

  return (
    <div className="shell hamper-studio">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link to="/">Home</Link>
        <ChevronRight size={13} aria-hidden="true" />
        <Link to="/hampers">Hampers</Link>
        <ChevronRight size={13} aria-hidden="true" />
        <span aria-current="page">Build your own</span>
      </nav>

      <header className="studio-head">
        <div>
          <p className="eyebrow">
            <Sparkles size={13} aria-hidden="true" /> Build your own
          </p>
          <label className="studio-head__name">
            <span className="sr-only">Name this hamper</span>
            <input
              type="text"
              value={design.name}
              maxLength={60}
              aria-label="Name this hamper"
              onChange={(e) => change({ type: 'rename', name: e.target.value })}
            />
          </label>
          <p className="studio-head__summary">{describeDesign(design)}</p>
        </div>

        <div className="studio-head__side">
          <SaveStatus save={studio.save} phase={phase} onRetry={retry} tick={tick} />
        </div>
      </header>

      {notices.length > 0 && (
        <div className="studio-notices">
          {notices.map((notice) => (
            <Notice key={notice.id} notice={notice} onDismiss={dismissNotice} />
          ))}
        </div>
      )}

      <div className="studio-grid">
        <section className="studio-stage" aria-label="Your hamper in 3D">
          <div className="studio-canvas">
            <HamperScene
              design={design}
              onSelect={onSelect}
              onCameraRest={onCameraRest}
              onCanvasReady={onCanvasReady}
            />
          </div>

          <div className="studio-stage__bar">
            <button
              className={`btn btn--sm ${design.box.lidOpen ? 'btn--ghost' : 'btn--primary'}`}
              type="button"
              onClick={() => change({ type: 'lid', open: !design.box.lidOpen })}
            >
              {design.box.lidOpen ? 'Close the box' : 'Open the box'}
            </button>
            <p className="studio-stage__hint">
              {design.box.lidOpen
                ? 'Drag to turn the view, pinch or scroll to zoom. The studio packs the box for you.'
                : 'Closed, ribbon and all — open it to keep arranging.'}
            </p>
          </div>

          {/* How the packing went, and the one control that changes
              it. There are no direction buttons: the studio decides
              where each gift goes, so what belongs here is whether
              it managed and a way to ask it to try again. */}
          <ArrangementBar design={design} change={change} />
        </section>

        <aside className="studio-panels" aria-label="Customise your hamper">
          <div className="studio-tabs" role="tablist" aria-label="Customisation">
            {TABS.map((t) => {
              const Icon = t.icon;
              const on = t.id === tab;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  id={`studio-tab-${t.id}`}
                  aria-selected={on}
                  aria-controls="studio-tabpanel"
                  className={`studio-tab${on ? ' is-on' : ''}`}
                  onClick={() => setTab(t.id)}
                >
                  <Icon size={15} aria-hidden="true" />
                  <span>{t.label}</span>
                  {t.id === 'inside' && giftCount > 0 && <em className="studio-tab__count">{giftCount}</em>}
                </button>
              );
            })}
          </div>

          {/* One panel is mounted at a time, but the design lives in
              the hook — so switching tabs never loses what was being
              edited, on a phone or anywhere else. */}
          <div
            className="studio-tabpanel"
            id="studio-tabpanel"
            role="tabpanel"
            aria-labelledby={`studio-tab-${activeTab.id}`}
          >
            {tab === 'gifts' && <GiftCatalogPanel design={design} change={change} />}
            {tab === 'inside' && (
              <SelectedGiftsPanel design={design} change={change} missing={missingAssets} />
            )}
            {tab === 'box' && <AppearancePanel design={design} change={change} />}
            {tab === 'message' && <MessagePanel design={design} change={change} />}
            {tab === 'saved' && <SavedDesignsPanel studio={studio} isSignedIn={isSignedIn} />}
          </div>

          <div className="studio-order">
            <PricePanel pricing={pricing} drift={drift} />

            {orderProblems.length > 0 && (
              <ul className="studio-order__problems" role="alert">
                {orderProblems.map((problem) => (
                  <li key={problem} className="field-error">
                    {problem}
                  </li>
                ))}
              </ul>
            )}

            <button
              className="btn btn--primary btn--block"
              type="button"
              disabled={ordering || !design.gifts.length || !arrangement.ok}
              onClick={toOrder}
            >
              {ordering ? <Loader2 size={16} className="spin" /> : <ShoppingBag size={16} />}{' '}
              {ordering
                ? 'Checking your hamper…'
                : arrangement.ok
                  ? `Continue to order · ${formatRupees(pricing.payable)}`
                  : 'Everything has to fit first'}
            </button>

            <p className="form-note">
              Nothing is charged here. Your hamper goes in your bag with a reference we can look up, and we reply
              with the shipping cost and how to pay. Your photographs stay on this device until you send us the
              order.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
