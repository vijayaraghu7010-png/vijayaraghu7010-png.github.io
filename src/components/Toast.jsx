import { useEffect } from 'react';
import { Check } from 'lucide-react';
import { useCart } from '../context/CartContext';

export default function Toast() {
  const { toast, dismissToast } = useCart();

  useEffect(() => {
    if (!toast) return undefined;
    const t = window.setTimeout(dismissToast, 2600);
    return () => window.clearTimeout(t);
  }, [toast, dismissToast]);

  if (!toast) return null;

  return (
    <div className="toast" role="status" aria-live="polite">
      <Check size={16} />
      {toast.message}
    </div>
  );
}
