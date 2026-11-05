import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronLeft, Download, FileText, Image, RefreshCw, Trash2, Truck } from 'lucide-react';

import {
  deleteOrderPhotos,
  downloadOrderPhotosPdf,
  getOrder,
  getPhotoDownloadUrls,
  listOrders,
  removeOrder,
  setOrderStatus
} from '../../lib/adminOrders';
import { formatRupees } from '../../utils/currency';

/* The orders.

   Everything this panel can do is also decided by the server: the list
   it is given, the statuses it may set, and above all the deletion. It
   asks politely and is told no when it should be.                   */

const STATUSES = [
  { id: '', label: 'All' },
  { id: 'pending', label: 'Pending' },
  { id: 'paid', label: 'Paid' },
  { id: 'in_progress', label: 'Being made' },
  { id: 'completed', label: 'Completed' },
  { id: 'cancelled', label: 'Cancelled' }
];

/* Where an order may go next. The same table lives in the function
   that performs the change; this one only decides which buttons are
   worth showing. */
const NEXT = {
  pending: ['paid', 'cancelled'],
  /* 'completed' is not offered here from 'paid'. Closing a paid order
     is the two-step finish below - Complete, then Shipped - because
     completing it also clears the customer's photographs, and that is
     not something to hang off a button sitting in a row of five. */
  paid: ['in_progress', 'cancelled'],
  in_progress: ['cancelled'],
  completed: [],
  cancelled: []
};

const LABEL = {
  pending: 'Pending',
  paid: 'Paid',
  in_progress: 'Being made',
  completed: 'Completed',
  cancelled: 'Cancelled'
};

const rupees = (paise) => formatRupees((Number(paise) || 0) / 100);
const when = (iso) => (iso ? new Date(iso).toLocaleString('en-IN') : '—');
const mb = (bytes) => `${((Number(bytes) || 0) / 1048576).toFixed(1)} MB`;

export default function OrdersPanel() {
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await listOrders({ status: status || undefined, search: search || undefined });
      setRows(data.orders || []);
    } catch (err) {
      setError(err.message || 'Those orders could not be read');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [status, search]);

  useEffect(() => {
    load();
  }, [load]);

  if (openId) {
    return (
      <OrderDetail
        orderId={openId}
        onBack={() => {
          setOpenId(null);
          load();
        }}
      />
    );
  }

  return (
    <section className="admin__panel">
      <div className="admin__panel-head">
        <div>
          <h2>Orders</h2>
          <p className="admin__hint">
            Every order the shop has taken. Customer photographs are deleted only from an order you
            have marked completed, and only after you confirm it.
          </p>
        </div>
        <div className="admin__panel-actions">
          <button type="button" className="admin__ghost" onClick={load} disabled={loading}>
            <RefreshCw size={15} /> Refresh
          </button>
        </div>
      </div>

      <div className="admin__row">
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          {STATUSES.map((s) => (
            <option key={s.id || 'all'} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
        <input
          className="admin__search"
          type="search"
          placeholder="Order code, name or email"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {error ? <p className="admin__error">{error}</p> : null}

      {loading ? (
        <p className="admin__hint">Reading the orders…</p>
      ) : rows.length === 0 ? (
        <p className="admin__hint">No orders yet.</p>
      ) : (
        <table className="admin__orders">
          <thead>
            <tr>
              <th>Order</th>
              <th>Placed</th>
              <th>Customer</th>
              <th>Total</th>
              <th>Photos</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((order) => (
              <tr key={order.id}>
                <td data-label="Order">
                  <span className="admin__cellv">
                    <strong>{order.order_code}</strong>
                  </span>
                </td>
                <td data-label="Placed">
                  <span className="admin__cellv">{when(order.created_at)}</span>
                </td>
                <td data-label="Customer">
                  <span className="admin__cellv">
                    {order.customer_name}
                    <br />
                    <span className="admin__hint">{order.customer_email}</span>
                  </span>
                </td>
                <td data-label="Total">
                  <span className="admin__cellv">{rupees(order.total_paise)}</span>
                </td>
                <td data-label="Photos">
                  <span className="admin__cellv">
                    {order.photos_deleted_at ? (
                      <span className="admin__hint">deleted</span>
                    ) : (
                      <>
                        {order.photo_count}{' '}
                        <span className="admin__hint">{mb(order.photo_bytes_total)}</span>
                      </>
                    )}
                  </span>
                </td>
                <td data-label="Status">
                  <span className="admin__cellv">
                    <span className="admin__badge">{LABEL[order.status] || order.status}</span>
                  </span>
                </td>
                <td data-label="">
                  <span className="admin__cellv">
                    <button type="button" className="admin__ghost" onClick={() => setOpenId(order.id)}>
                      Open
                    </button>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function OrderDetail({ orderId, onBack }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState('');
  const [note, setNote] = useState('');
  const [fetching, setFetching] = useState(null);

  /* The two-step finish: 'complete' clears the photographs, 'remove'
     takes the order off the books. Kept apart from `confirming`,
     which is the photographs-only delete that has always been here. */
  const [finishing, setFinishing] = useState(null);
  const [finishTyped, setFinishTyped] = useState('');
  const [zipping, setZipping] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      setData(await getOrder(orderId));
    } catch (err) {
      setError(err.message || 'That order could not be read');
    }
  }, [orderId]);

  useEffect(() => {
    load();
  }, [load]);

  if (error && !data) {
    return (
      <section className="admin__panel">
        <button type="button" className="admin__ghost" onClick={onBack}>
          <ChevronLeft size={15} /> Back
        </button>
        <p className="admin__error">{error}</p>
      </section>
    );
  }

  if (!data) return <p className="admin__hint">Reading that order…</p>;

  const { order, items, photos, events } = data;
  const live = photos.filter((p) => !p.deleted_at);
  const canDelete = order.status === 'completed' && !order.photos_deleted_at && live.length > 0;

  /* Only a confirmed upload is in the bucket to be zipped. One that
     was started and never finished has a row and no object. */
  const uploaded = live.filter((p) => p.upload_status === 'uploaded');

  /* Payment confirmed, so the job can be closed. */
  const canComplete = order.status === 'paid' || order.status === 'in_progress';
  /* Completed and nothing of the customer's left in storage. Only
     then is there nothing to strand by deleting the row. */
  const canRemove = order.status === 'completed' && Boolean(order.photos_deleted_at);

  async function move(next) {
    setBusy(true);
    setError('');
    setNote('');
    try {
      await setOrderStatus(order.id, next);
      await load();
      setNote(`Marked ${LABEL[next] || next}.`);
    } catch (err) {
      setError(err.message || 'That could not be changed');
    } finally {
      setBusy(false);
    }
  }

  /* One photograph, one click, one URL. The URL is asked for at the
     moment it is used and is never held in state: it is good for five
     minutes, and a page left open all afternoon should not be sitting
     on a key to somebody's photographs.

     The browser is sent to the URL rather than fetching it, which is
     deliberate. A navigation is not subject to CORS, so the bucket
     goes on allowing PUT and nothing else, and the file arrives named
     as the customer named it because the signed URL says so.

     It goes to a new tab rather than this one. The response is an
     attachment, so that tab downloads and closes itself and the
     studio keeps the order it was looking at. Sending this tab there
     worked, but anything that went wrong - an expired URL, a refusal -
     replaced the panel with Cloudflare's error page, and the way back
     was the browser's back button.

     A browser that blocks the new tab is told about, not worked
     around: nothing here claims the photograph arrived, because from
     this side there is no way to know that it did.                */
  async function download(photo) {
    setFetching(photo.id);
    setError('');
    setNote('');
    try {
      const [ready] = await getPhotoDownloadUrls(order.id, [photo.id]);
      if (!ready?.url) throw new Error('That photograph could not be fetched');

      const opened = window.open(ready.url, '_blank', 'noopener,noreferrer');
      if (!opened) {
        setError(
          `This browser blocked the download window for ${photo.original_filename}. ` +
            'Allow pop-ups for this site and try again.'
        );
      }
    } catch (err) {
      setError(err.message || 'That photograph could not be fetched');
    } finally {
      setFetching(null);
    }
  }

  /* Completing an order is also what clears the customer's
     photographs - the studio has them printed by then, and holding
     somebody's pictures after the job is done is the thing this shop
     tries hardest not to do.

     The status moves first because the server will not delete
     photographs from an order that is not completed. If the delete
     then fails, the order is simply completed with its photographs
     still there, and the ordinary delete button below is how that is
     finished off. */
  async function completeAndClear() {
    setBusy(true);
    setError('');
    setNote('');
    try {
      if (order.status !== 'completed') await setOrderStatus(order.id, 'completed');

      const result = await deleteOrderPhotos(order.id, order.order_code);
      setFinishing(null);
      await load();
      setNote(
        result.complete
          ? `Completed. ${result.deleted} photographs cleared.`
          : `Completed, but ${result.remaining} photographs would not delete. Try clearing them again.`
      );
    } catch (err) {
      await load();
      setError(err.message || 'That could not be completed');
    } finally {
      setBusy(false);
    }
  }

  /* And this is the end of it. The row goes, and everything hanging
     off it goes with it. */
  async function removeForGood() {
    setBusy(true);
    setError('');
    setNote('');
    try {
      await removeOrder(order.id, finishTyped.trim());
      /* Straight back to the list, which reloads - there is nothing
         left here to show. */
      onBack();
    } catch (err) {
      setError(err.message || 'That order could not be removed');
      setBusy(false);
    }
  }

  /* The whole order in one file.

     A PDF rather than a zip: one page per photograph, printable as
     it is, and nothing to unpack. It is built by the server and
     arrives finished, so there is nothing to assemble here - the
     blob is handed to a link and the browser saves it. The object URL is revoked
     straight afterwards: it pins the file in memory until it is, and
     this one can be hundreds of megabytes.

     Deliberately not window.open: the request carries the
     administrator's token, which a navigation cannot. */
  async function downloadAll() {
    setZipping(true);
    setError('');
    setNote('');
    try {
      const { blob, filename } = await downloadOrderPhotosPdf(order.id);

      const href = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = href;
      link.download = filename || `${order.order_code}-photos.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(href);

      setNote(`${uploaded.length} photographs saved as ${link.download}.`);
    } catch (err) {
      setError(err.message || 'Those photographs could not be fetched');
    } finally {
      setZipping(false);
    }
  }

  async function reallyDelete() {
    setBusy(true);
    setError('');
    setNote('');
    try {
      const result = await deleteOrderPhotos(order.id, typed.trim());
      setConfirming(false);
      setTyped('');
      await load();
      setNote(
        result.complete
          ? `${result.deleted} photographs deleted. The order itself is kept.`
          : `${result.deleted} deleted, ${result.remaining} would not go. Try again.`
      );
    } catch (err) {
      setError(err.message || 'Nothing was deleted');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="admin__panel">
      <div className="admin__panel-head">
        <div>
          <button type="button" className="admin__ghost" onClick={onBack}>
            <ChevronLeft size={15} /> All orders
          </button>
          <h2>{order.order_code}</h2>
          <p className="admin__hint">
            Placed {when(order.created_at)} · <span className="admin__badge">{LABEL[order.status]}</span> ·
            payment {order.payment_status}
          </p>
        </div>
        <div className="admin__panel-actions">
          {(NEXT[order.status] || []).map((next) => (
            <button
              key={next}
              type="button"
              className={next === 'cancelled' ? 'admin__ghost admin__ghost--danger' : 'admin__btn'}
              disabled={busy}
              onClick={() => move(next)}
            >
              Mark {LABEL[next]}
            </button>
          ))}

          {/* The close-out, in the order it happens: finish the job
              and clear the pictures, then once it is sent, take the
              order off the books. The second button does not appear
              until the first has been used, because removing the row
              is what makes anything left in storage unreachable. */}
          {canComplete ? (
            <button type="button" className="admin__btn" disabled={busy}
              onClick={() => { setFinishing('complete'); setError(''); setNote(''); }}>
              <CheckCircle2 size={15} /> Complete
            </button>
          ) : null}

          {canRemove ? (
            <button type="button" className="admin__ghost admin__ghost--danger" disabled={busy}
              onClick={() => { setFinishing('remove'); setFinishTyped(''); setError(''); setNote(''); }}>
              <Truck size={15} /> Shipped — remove order
            </button>
          ) : null}
        </div>
      </div>

      {finishing === 'complete' ? (
        <div className="admin__notice">
          <p>
            <AlertTriangle size={16} /> Mark <strong>{order.order_code}</strong> completed and
            permanently delete the {live.length} photograph{live.length === 1 ? '' : 's'} this
            customer uploaded.
          </p>
          <p className="admin__hint">
            The order, the customer details, the prices and the history all stay. Once it has been
            sent you can remove the order itself.
          </p>
          <div className="admin__row">
            <button type="button" className="admin__btn" disabled={busy} onClick={completeAndClear}>
              {busy ? 'Completing…' : 'Complete and clear photos'}
            </button>
            <button type="button" className="admin__ghost" disabled={busy}
              onClick={() => setFinishing(null)}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {finishing === 'remove' ? (
        <div className="admin__notice">
          <p>
            <AlertTriangle size={16} /> This removes <strong>{order.order_code}</strong> from the
            shop entirely — the order, its lines, its payments and its history. The customer&rsquo;s
            tracking link stops working. It cannot be undone and nothing is kept but a line in the
            audit log.
          </p>
          <label htmlFor="remove-code">
            Type <strong>{order.order_code}</strong> to confirm
          </label>
          <input
            id="remove-code"
            type="text"
            value={finishTyped}
            autoComplete="off"
            onChange={(e) => setFinishTyped(e.target.value)}
          />
          <div className="admin__row">
            <button
              type="button"
              className="admin__ghost admin__ghost--danger"
              disabled={busy || finishTyped.trim().toUpperCase() !== order.order_code.toUpperCase()}
              onClick={removeForGood}
            >
              {busy ? 'Removing…' : 'Remove this order for good'}
            </button>
            <button type="button" className="admin__ghost" disabled={busy}
              onClick={() => setFinishing(null)}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {note ? <p className="admin__ok">{note}</p> : null}
      {error ? <p className="admin__error">{error}</p> : null}

      <div className="admin__pair">
        <div className="admin__card">
          <h3>Customer</h3>
          <p>
            <strong>{order.customer_name}</strong>
            <br />
            {order.customer_email}
            <br />
            {order.customer_phone}
          </p>
          <h3>Delivery</h3>
          <p>
            {order.address_line1}
            {order.address_line2 ? (
              <>
                <br />
                {order.address_line2}
              </>
            ) : null}
            <br />
            {order.city}, {order.state} {order.pincode}
          </p>
          {order.notes ? (
            <>
              <h3>Their note</h3>
              <p>{order.notes}</p>
            </>
          ) : null}
        </div>

        <div className="admin__card">
          <h3>What was ordered</h3>
          <table className="admin__orders admin__orders--lines">
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>{item.product_name}</strong>
                    <br />
                    <span className="admin__hint">× {item.quantity}</span>
                    <Config config={item.config} />
                  </td>
                  <td>{rupees(item.line_total_paise)}</td>
                </tr>
              ))}
              <tr>
                <th scope="row">Total</th>
                <td>
                  <strong>{rupees(order.total_paise)}</strong>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="admin__card">
        <h3>
          <Image size={16} /> Photographs
        </h3>
        {order.photos_deleted_at ? (
          <p className="admin__hint">
            Deleted {when(order.photos_deleted_at)}. The order and its details are kept.
          </p>
        ) : (
          <p className="admin__hint">
            {live.length} held · {mb(order.photo_bytes_total)} ·{' '}
            {live.filter((p) => p.upload_status === 'uploaded').length} confirmed,{' '}
            {live.filter((p) => p.upload_status !== 'uploaded').length} not
          </p>
        )}

        {uploaded.length > 0 && !order.photos_deleted_at ? (
          <button
            type="button"
            className="admin__btn"
            disabled={zipping || busy}
            onClick={downloadAll}
          >
            <FileText size={15} />
            {zipping
              ? 'Building the file…'
              : `Download all ${uploaded.length} as one PDF`}
          </button>
        ) : null}

        {zipping ? (
          <p className="admin__hint">
            The studio server is fetching each photograph and laying them out, one to a page.
            Larger orders take a moment — this does not stop if you look at another tab.
          </p>
        ) : null}

        {live.length > 0 && !order.photos_deleted_at ? (
          <ul className="admin__checks admin__photo-list">
            {live.slice(0, 200).map((photo) => (
              <li key={photo.id}>
                {photo.original_filename}{' '}
                <span className="admin__hint">
                  {mb(photo.byte_size)} · {photo.upload_status}
                </span>
                {photo.upload_status === 'uploaded' ? (
                  <button
                    type="button"
                    className="admin__ghost admin__ghost--sm"
                    onClick={() => download(photo)}
                    disabled={fetching === photo.id}
                    aria-label={`Download ${photo.original_filename}`}
                  >
                    <Download size={14} />{' '}
                    {fetching === photo.id ? 'Fetching…' : 'Download'}
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}

        {canDelete && !confirming ? (
          <button
            type="button"
            className="admin__ghost admin__ghost--danger"
            onClick={() => setConfirming(true)}
          >
            <Trash2 size={15} /> Delete customer photos
          </button>
        ) : null}

        {!canDelete && !order.photos_deleted_at ? (
          <p className="admin__hint">
            {order.status === 'completed'
              ? 'Nothing left to delete.'
              : 'Mark the order completed first.'}
          </p>
        ) : null}

        {confirming ? (
          <div className="admin__notice">
            <p>
              <AlertTriangle size={16} /> This permanently deletes the {live.length} photographs this
              customer uploaded. It cannot be undone. The order, the customer details, the prices and
              the history all stay.
            </p>
            <label htmlFor="confirm-code">
              Type <strong>{order.order_code}</strong> to confirm
            </label>
            <input
              id="confirm-code"
              type="text"
              value={typed}
              autoComplete="off"
              onChange={(e) => setTyped(e.target.value)}
            />
            <div className="admin__row">
              <button
                type="button"
                className="admin__ghost admin__ghost--danger"
                disabled={busy || typed.trim().toUpperCase() !== order.order_code.toUpperCase()}
                onClick={reallyDelete}
              >
                {busy ? 'Deleting…' : 'Delete them permanently'}
              </button>
              <button
                type="button"
                className="admin__ghost"
                disabled={busy}
                onClick={() => {
                  setConfirming(false);
                  setTyped('');
                }}
              >
                Keep them
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <div className="admin__card">
        <h3>History</h3>
        {/* A log is a column. `admin__checks` is a flex row for
            inline checkboxes, and borrowing it ran the entries
            across the card on a narrow screen. */}
        <ul className="admin__stack">
          {events.map((event) => (
            <li key={event.id}>
              <strong>{event.event}</strong> <span className="admin__hint">{when(event.created_at)} · {event.actor}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* Names the studio uses, for the ones where the key is not one.
   Anything missing here is turned into words from its own key, so a
   customiser that grows a field does not need this list edited. */
const CONFIG_LABELS = {
  photoCount: 'Photographs',
  photoNames: 'Files',
  border: 'Border',
  frameTheme: 'Frame design',
  sizeId: 'Size',
  setId: 'Set',
  paperId: 'Paper',
  variantId: 'Option',
  productId: 'Product',
  boxId: 'Box',
  wrapColour: 'Wrap colour',
  messageCard: 'Message card'
};

const configLabel = (key) =>
  CONFIG_LABELS[key] ||
  String(key)
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/^./, (c) => c.toUpperCase());

/* What the customer chose, as the customiser recorded it.

   Everything is shown - this is the instruction the studio works
   from, and a summary could leave something out - but it is shown as
   words rather than as the shape it is stored in. It used to print
   the raw key and JSON.stringify anything that was not a string, so
   a polaroid order read `photoNames: ["1000169043.png"]`, and the
   list carried `admin__checks`, which is a flex row meant for
   checkboxes. On a phone the labels lined up across the top like a
   table header with the values beneath them, which is not a table and
   did not read as one. */
function Config({ config, depth = 0 }) {
  const entries = Object.entries(config || {}).filter(
    ([, v]) => v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0)
  );
  if (!entries.length) return null;

  return (
    <ul className="admin__config">
      {entries.map(([key, value]) => {
        const label = configLabel(key);

        /* A list of plain values reads as a list, not as JSON. */
        if (Array.isArray(value) && value.every((v) => v === null || typeof v !== 'object')) {
          return (
            <li key={key}>
              <span className="admin__config-key">{label}</span>
              <span className="admin__config-value">{value.join(', ')}</span>
            </li>
          );
        }

        /* A hamper's gifts, or anything else shaped like them. Each
           one is its own block rather than a count, because the count
           is not what gets packed. */
        if (Array.isArray(value)) {
          return (
            <li key={key}>
              <span className="admin__config-key">{label}</span>
              {depth < 2 ? (
                <ol className="admin__config-list">
                  {value.map((entry, i) => (
                    <li key={i}>
                      <Config config={entry} depth={depth + 1} />
                    </li>
                  ))}
                </ol>
              ) : (
                <span className="admin__config-value">{value.length} items</span>
              )}
            </li>
          );
        }

        if (typeof value === 'object') {
          return (
            <li key={key}>
              <span className="admin__config-key">{label}</span>
              {depth < 2 ? (
                <Config config={value} depth={depth + 1} />
              ) : (
                <span className="admin__config-value">{JSON.stringify(value)}</span>
              )}
            </li>
          );
        }

        return (
          <li key={key}>
            <span className="admin__config-key">{label}</span>
            <span className="admin__config-value">
              {typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
