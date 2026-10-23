import { createContext, useCallback, useContext, useMemo } from 'react';
import useLocalStorage from '../hooks/useLocalStorage';

const WishlistContext = createContext(null);

const STORAGE_KEY = 'wrappedstudio.wishlist.v1';

export function WishlistProvider({ children }) {
  const [ids, setIds] = useLocalStorage(STORAGE_KEY, []);

  const has = useCallback((id) => ids.includes(id), [ids]);

  const toggle = useCallback(
    (id) => {
      let added = false;
      setIds((prev) => {
        if (prev.includes(id)) return prev.filter((x) => x !== id);
        added = true;
        return [...prev, id];
      });
      return added;
    },
    [setIds]
  );

  const remove = useCallback((id) => setIds((prev) => prev.filter((x) => x !== id)), [setIds]);
  const clear = useCallback(() => setIds([]), [setIds]);

  const value = useMemo(
    () => ({ ids, count: ids.length, has, toggle, remove, clear }),
    [ids, has, toggle, remove, clear]
  );

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlist() {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error('useWishlist must be used inside WishlistProvider');
  return ctx;
}

export default WishlistContext;
