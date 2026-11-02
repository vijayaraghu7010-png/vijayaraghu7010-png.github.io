import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, ChevronLeft, Download, Image, RefreshCw, Trash2 } from 'lucide-react';

import {
  deleteOrderPhotos,
  getOrder,
  getPhotoDownloadUrls,
  listOrders,
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
  paid: ['in_progress', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
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
                  <strong>{order.order_code}</strong>
                </td>
                <td data-label="Placed">{when(order.created_at)}</td>
                <td data-label="Customer">
                  {order.customer_name}
                  <br />
                  <span className="admin__hint">{order.customer_email}</span>
                </td>
                <td data-label="Total">{rupees(order.total_paise)}</td>
                <td data-label="Photos">
                  {order.photos_deleted_at ? (
                    <span className="admin__hint">deleted</span>
                  ) : (
                    <>
                      {order.photo_count} <span className="admin__hint">{mb(order.photo_bytes_total)}</span>
                    </>
                  )}
                </td>
                <td data-label="Status">
                  <span className="admin__badge">{LABEL[order.status] || order.status}</span>
                </td>
                <td data-label="">
                  <button type="button" className="admin__ghost" onClick={() => setOpenId(order.id)}>
                    Open
                  </button>
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
        </div>
      </div>

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
        <ul className="admin__checks">
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

/* What the customer chose, as the customiser recorded it. Shown as it
   is rather than prettified: this is the instruction the studio works
   from, and a summary could leave something out. */
function Config({ config }) {
  const entries = Object.entries(config || {}).filter(
    ([, v]) => v !== null && v !== undefined && v !== ''
  );
  if (!entries.length) return null;

  return (
    <ul className="admin__checks">
      {entries.map(([key, value]) => (
        <li key={key}>
          <span className="admin__hint">{key}:</span>{' '}
          {typeof value === 'object' ? JSON.stringify(value) : String(value)}
        </li>
      ))}
    </ul>
  );
}
