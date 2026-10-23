import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import useLocalStorage from '../hooks/useLocalStorage';
import { cartCount, cartSubtotal, clampQuantity, makeLineKey } from '../utils/cartCalculations';
import { getProductById } from '../data/products';

const CartContext = createContext(null);

const STORAGE_KEY = 'wrappedstudio.cart.v1';

export function CartProvider({ children }) {
  const [items, setItems] = useLocalStorage(STORAGE_KEY, []);
  const [isOpen, setOpen] = useState(false);
  const [toast, setToast] = useState(null);

  const notify = useCallback((message) => {
    setToast({ message, at: Date.now() });
  }, []);

  const addItem = useCallback(
    (product, { quantity = 1, config = null, silent = false } = {}) => {
      if (!product) return;
      const qty = clampQuantity(product, quantity);
      const key = makeLineKey(product.id, config);

      setItems((prev) => {
        const existing = prev.find((item) => item.key === key);
        if (existing) {
          return prev.map((item) =>
            item.key === key ? { ...item, quantity: Math.min(999, item.quantity + qty) } : item
          );
        }
        return [
          ...prev,
          {
            key,
            productId: product.id,
            name: product.name,
            slug: product.slug,
            image: product.image,
            alt: product.alt,
            unitPrice: product.price,
            unitLabel: product.unitLabel || '',
            categoryLabel: product.categoryLabel,
            quantity: qty,
            config: config || null
          }
        ];
      });

      if (!silent) notify(`${product.name} added to your bag`);
    },
    [notify, setItems]
  );

  const removeItem = useCallback(
    (key) => {
      setItems((prev) => prev.filter((item) => item.key !== key));
    },
    [setItems]
  );

  const setQuantity = useCallback(
    (key, quantity) => {
      setItems((prev) =>
        prev.map((item) => {
          if (item.key !== key) return item;
          const product = getProductById(item.productId);
          return { ...item, quantity: clampQuantity(product, quantity) };
        })
      );
    },
    [setItems]
  );

  const increment = useCallback(
    (key, by = 1) => {
      setItems((prev) =>
        prev.map((item) => {
          if (item.key !== key) return item;
          const product = getProductById(item.productId);
          return { ...item, quantity: clampQuantity(product, item.quantity + by) };
        })
      );
    },
    [setItems]
  );

  const clear = useCallback(() => setItems([]), [setItems]);

  const value = useMemo(
    () => ({
      items,
      count: cartCount(items),
      lineCount: items.length,
      subtotal: cartSubtotal(items),
      isOpen,
      openCart: () => setOpen(true),
      closeCart: () => setOpen(false),
      addItem,
      removeItem,
      setQuantity,
      increment,
      clear,
      toast,
      notify,
      dismissToast: () => setToast(null)
    }),
    [items, isOpen, addItem, removeItem, setQuantity, increment, clear, toast, notify]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside CartProvider');
  return ctx;
}

export default CartContext;
