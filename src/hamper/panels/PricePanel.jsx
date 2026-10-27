import { Info } from 'lucide-react';

import { formatRupees } from '../../utils/currency';

/* The price, always as just recomputed from the catalogue — never the
   number that happened to be saved in the design. */
export default function PricePanel({ pricing, drift }) {
  return (
    <div className="stack">
      <table className="summary-table">
        <tbody>
          {pricing.lines.map((line) => (
            <tr key={line.uid || line.id}>
              <th scope="row">
                {line.label}
                {line.quantity > 1 ? ` × ${line.quantity}` : ''}
              </th>
              <td>{formatRupees(line.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="totals">
        <div className="totals__row">
          <span>Hamper subtotal</span>
          <span>{formatRupees(pricing.subtotal)}</span>
        </div>
        {pricing.savings > 0 && (
          <div className="totals__row totals__row--save">
            <span>{pricing.offer?.title || 'Offer applied'}</span>
            <span>− {formatRupees(pricing.savings)}</span>
          </div>
        )}
        <div className="totals__row">
          <span>Shipping</span>
          <span>Charged separately</span>
        </div>
        <div className="totals__row totals__row--grand">
          <span>Total</span>
          <span>{formatRupees(pricing.payable)}</span>
        </div>
      </div>

      {drift && (
        <p className="field-hint" role="status">
          <Info size={13} style={{ verticalAlign: '-2px', marginRight: 5, color: 'var(--coral)' }} />
          Prices have changed since you last had this hamper open — it was {formatRupees(drift.was)}, and the total
          above is today's.
        </p>
      )}

      {pricing.problems.length > 0 && (
        <p className="field-error" role="alert">
          {pricing.problems.length} item{pricing.problems.length === 1 ? '' : 's'} in this hamper could not be
          priced and {pricing.problems.length === 1 ? 'is' : 'are'} not in the total. Remove{' '}
          {pricing.problems.length === 1 ? 'it' : 'them'} before ordering.
        </p>
      )}
    </div>
  );
}
