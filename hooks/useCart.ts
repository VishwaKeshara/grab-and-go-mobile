import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { PropsWithChildren } from "react";
import { Alert } from "react-native";
import { ShopSwitchModal } from "@/components/ShopSwitchModal";
import { getProfile } from "@/services/authService";
import { cartTotals, changeCart, initialDraft, loadCart, loadCatalog, loadDraft, newCheckoutId, saveDraft } from "@/services/cartService";
import { createOrder, loadOrders, setOrderStatus } from "@/services/orderService";
import { processDemoPayment } from "@/services/paymentService";
import type { CartItem, CheckoutDraft, GroceryProduct, GroceryShop, SubstitutePreference } from "@/types/cart";
import type { Order, OrderStatus } from "@/types/order";
import { addProductToCart } from "@/utils/ordering";

type Store = {
  cart: CartItem[];
  draft: CheckoutDraft;
  orders: Order[];
  shop: GroceryShop | null;
  products: GroceryProduct[];
  alternatives: Record<string, GroceryProduct[]>;
  loading: boolean;
  adding: boolean;
  error: string;
  submitting: boolean;
  totals: ReturnType<typeof cartTotals>;
  cartSheetOpen: boolean;
  openCartSheet: () => void;
  closeCartSheet: () => void;
  setQuantity: (id: string, quantity: number) => void;
  removeItem: (id: string) => void;
  addItem: (product: GroceryProduct) => Promise<boolean>;
  clearCart: () => void;
  setSubstitution: (id: string, value: SubstitutePreference) => void;
  updateDraft: (value: Partial<CheckoutDraft>) => void;
  submitOrder: () => Promise<Order>;
  changeStatus: (id: string, status: OrderStatus) => Promise<void>;
  reorder: (order: Order) => void;
  reload: () => Promise<void>;
  reloadOrders: () => Promise<void>;
};

const Context = createContext<Store | null>(null);

function cartErrorMessage(cause: unknown, fallback: string) {
  const code = (cause as { code?: string } | null)?.code;
  if (code === "PGRST205" || code === "PGRST202" || code === "42P01" || code === "42883") {
    return "Ordering is unavailable right now. Please try again later.";
  }
  return cause instanceof Error ? cause.message : fallback;
}

async function loadWithTimeout<T>(request: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      request,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error("Cart loading timed out. Check your connection and try again.")), 15000);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function OrderingProvider({ children }: PropsWithChildren) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [draft, setDraft] = useState<CheckoutDraft>(initialDraft);
  const [orders, setOrders] = useState<Order[]>([]);
  const [shop, setShop] = useState<GroceryShop | null>(null);
  const [products, setProducts] = useState<GroceryProduct[]>([]);
  const [alternatives, setAlternatives] = useState<Record<string, GroceryProduct[]>>({});
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [cartSheetOpen, setCartSheetOpen] = useState(false);

  type ShopSwitchPrompt = { currentShopName: string; newShopName: string } | null;
  const [shopSwitchPrompt, setShopSwitchPrompt] = useState<ShopSwitchPrompt>(null);
  const shopSwitchResolver = useRef<((confirmed: boolean) => void) | null>(null);

  const askToSwitchShop = (currentShopName: string, newShopName: string): Promise<boolean> =>
    new Promise((resolve) => {
      shopSwitchResolver.current = resolve;
      setShopSwitchPrompt({ currentShopName, newShopName });
    });

  const lock = useRef(false);
  const addInFlight = useRef(false);
  const ready = useRef(false);
  const cartQueue = useRef<Promise<void>>(Promise.resolve());
  const cartVersion = useRef(0);
  const orderLoadVersion = useRef(0);

  const reloadOrders = useCallback(async () => {
    const version = ++orderLoadVersion.current;
    try {
      const latest = await loadOrders();
      if (version === orderLoadVersion.current) setOrders(latest);
    } catch (cause) {
      if (version === orderLoadVersion.current) {
        setError(cause instanceof Error ? cause.message : "Could not load your orders.");
      }
    }
  }, []);

  const reload = async () => {
    setLoading(true);
    setError("");
    ready.current = false;
    try {
      const { savedCart, catalog } = await loadWithTimeout((async () => {
        await cartQueue.current;
        const savedCart = await loadCart();
        const catalog = await loadCatalog();
        return { savedCart, catalog };
      })());
      setShop(catalog.shop);
      setProducts(catalog.products);
      setAlternatives(catalog.alternatives);
      setCart(savedCart);
      ready.current = true;
      void loadDraft().then(savedDraft => {
        setDraft(savedDraft);
        void getProfile().then(profile => {
          if (!profile) return;
          setDraft(previous => ({
            ...previous,
            customerName: previous.customerName || profile.full_name || "",
            phone: previous.phone || profile.phone || "",
          }));
        }).catch(() => undefined);
      }).catch(() => setError("Could not load checkout details."));
      void reloadOrders();
    } catch (cause) {
      if (__DEV__) console.warn("[Cart] initial load failed", cause);
      setError(cartErrorMessage(cause, "Could not load your cart."));
    } finally { setLoading(false); }
  };
  useEffect(() => { void reload(); }, []);
  useEffect(() => {
    if (ready.current) saveDraft(draft).catch(() => setError("Could not save checkout details."));
  }, [draft]);

  const enqueue = (operation: () => Promise<void>) => {
    const task = cartQueue.current.then(operation);
    cartQueue.current = task.catch(() => undefined);
    return task;
  };

  const syncCart = async (version: number) => {
    if (version !== cartVersion.current) return;

    const remote = await loadCart();

    if (version === cartVersion.current) {
      setCart(remote);
    }
  };

  const mutationFailed = (
    cause: unknown,
    version: number,
    snapshot?: CartItem[],
  ) => {
    const message = cartErrorMessage(
      cause,
      "Could not update your cart.",
    );

    setError(message);

    if (snapshot && version === cartVersion.current) {
      setCart(snapshot);
    }

    Alert.alert("Cart update failed", message);

    void syncCart(version).catch(() => undefined);
  };

  const setQuantity = (id: string, quantity: number) => {
    if (!ready.current || lock.current) return;

    const snapshot = cart;
    const value = Math.max(1, quantity);
    const version = ++cartVersion.current;

    setCart((previous) =>
      previous.map((item) =>
        item.product.id === id
          ? { ...item, quantity: value }
          : item,
      ),
    );

    void enqueue(() => changeCart("set", id, value))
      .then(() => {
        void syncCart(version).catch(() => undefined);
      })
      .catch((cause) =>
        mutationFailed(cause, version, snapshot),
      );
  };

  const removeItem = (id: string) => {
    if (!ready.current || lock.current) return;

    const snapshot = cart;
    const version = ++cartVersion.current;

    setCart((previous) =>
      previous.filter((item) => item.product.id !== id),
    );

    void enqueue(() => changeCart("remove", id))
      .then(() => {
        void syncCart(version).catch(() => undefined);
      })
      .catch((cause) =>
        mutationFailed(cause, version, snapshot),
      );
  };

  const addItem = async (
    requested: GroceryProduct,
  ): Promise<boolean> => {
    if (__DEV__) {
      console.log("[Cart] addItem entered", {
        productId: requested.id,
        loading,
        adding: addInFlight.current,
      });
    }

    if (loading) {
      Alert.alert(
        "Cart loading",
        "Please wait for your cart to load and try again.",
      );
      return false;
    }

    if (addInFlight.current) {
      return false;
    }

    if (lock.current) {
      Alert.alert(
        "Cart unavailable",
        "Please wait until your order has finished processing.",
      );
      return false;
    }

    if (!ready.current) {
      Alert.alert(
        "Cart unavailable",
        error || "Could not load the ordering catalog.",
      );
      return false;
    }

    let product = products.find(
      (value) => value.id === requested.id,
    );

    const targetShopId = product?.shopId || requested.shopId || (requested as any).shop_id;

    if (__DEV__) {
      console.log("[Cart] add item check:", {
        requestedId: requested.id,
        requestedShopId: requested.shopId,
        requestedAsAnyShopId: (requested as any).shop_id,
        requestedAsAnyShopName: (requested as any).shop_name,
        currentCartShopId: cart.length > 0 ? cart[0].product.shopId : "empty",
        targetShopId,
      });
    }

    if (!product && !targetShopId) {
      setError(
        "This product is not available in the ordering catalog.",
      );

      Alert.alert(
        "Product unavailable",
        "This product is not available in the ordering catalog.",
      );

      return false;
    }

    if (!product) {
      product = {
        id: requested.id,
        shopId: targetShopId,
        name: requested.name,
        unit: requested.unit || (requested as any).unit || "",
        price: requested.price || (requested as any).price_lkr || 0,
        regularPrice: requested.regularPrice || (requested as any).regular_price_lkr || 0,
        image: requested.image || (requested as any).image_url || ""
      };
    }

    if (cart.length > 0) {
      const currentShopId = cart[0].product.shopId;
      if (currentShopId && targetShopId && currentShopId !== targetShopId) {
        const currentShopName = shop && shop.id === currentShopId ? shop.name : "another shop";
        const newShopName = (requested as any).shop_name || "this shop";

        const confirmed = await askToSwitchShop(currentShopName, newShopName);

        if (!confirmed) {
          return false;
        }

        try {
          addInFlight.current = true;
          setAdding(true);

          await enqueue(() => changeCart("clear"));
          setCart([]);

          if (__DEV__) {
            console.log("[Cart] sending add RPC (switch)", product!.id);
          }
          await enqueue(() => changeCart("add", product!.id, 1));

          await reload();

          setCartSheetOpen(true);
          return true;
        } catch (e) {
          mutationFailed(e, ++cartVersion.current);
          return false;
        } finally {
          addInFlight.current = false;
          setAdding(false);
        }
      }
    }

    addInFlight.current = true;
    setAdding(true);
    setError("");

    const version = ++cartVersion.current;
    const wasEmpty = cart.length === 0;

    try {
      if (__DEV__) {
        console.log(
          "[Cart] sending add RPC",
          product.id,
        );
      }

      await enqueue(() =>
        changeCart("add", product.id, 1),
      );

      if (__DEV__) {
        console.log(
          "[Cart] add RPC succeeded",
          product.id,
        );
      }

      setCart((previous) =>
        addProductToCart(previous, product),
      );

      try {
        await loadWithTimeout(
          (async () => {
            await syncCart(version);
            if (wasEmpty) {
              const catalog = await loadCatalog();
              if (version === cartVersion.current) {
                setShop(catalog.shop);
                setProducts(catalog.products);
                setAlternatives(catalog.alternatives);
              }
            }
          })()
        );
      } catch (e) {
        if (__DEV__) console.warn("Could not refresh shop on first add", e);
        if (version === cartVersion.current) {
          setError(
            "Added to cart, but the cart could not be refreshed. Please try again.",
          );
        }
      }

      setCartSheetOpen(true);

      return true;
    } catch (cause) {
      if (__DEV__) {
        console.warn("[Cart] add failed", cause);
      }

      mutationFailed(cause, version);

      return false;
    } finally {
      addInFlight.current = false;
      setAdding(false);
    }
  };

  const clearCart = () => {
    if (!ready.current || lock.current) return;

    const snapshot = cart;
    const version = ++cartVersion.current;

    setCart([]);

    void enqueue(() => changeCart("clear"))
      .then(() => {
        void syncCart(version).catch(() => undefined);
      })
      .catch((cause) =>
        mutationFailed(cause, version, snapshot),
      );
  };

  const setSubstitution = (
    id: string,
    value: SubstitutePreference,
  ) => {
    if (!ready.current || lock.current) return;

    const snapshot = cart;
    const version = ++cartVersion.current;

    setCart((previous) =>
      previous.map((item) =>
        item.product.id === id
          ? { ...item, substitution: value }
          : item,
      ),
    );

    void enqueue(() =>
      changeCart(
        "substitute",
        id,
        undefined,
        value,
      ),
    )
      .then(() => {
        void syncCart(version).catch(() => undefined);
      })
      .catch((cause) =>
        mutationFailed(cause, version, snapshot),
      );
  };

  const updateDraft = (
    value: Partial<CheckoutDraft>,
  ) =>
    setDraft((previous) => ({
      ...previous,
      ...value,
    }));
  const submitOrder = async () => {
    if (lock.current) throw new Error("Your order is already being placed.");
    if (!shop) throw new Error("Ordering shop is unavailable.");
    lock.current = true;
    ++cartVersion.current;
    setSubmitting(true);
    try {
      await cartQueue.current;
      const remoteCart = await loadCart();
      const displayed = new Map(cart.map(item => [item.product.id, item]));
      if (remoteCart.length && (
        remoteCart.length !== cart.length || remoteCart.some(item => {
          const current = displayed.get(item.product.id);
          return !current || current.quantity !== item.quantity
            || current.product.price !== item.product.price
            || JSON.stringify(current.substitution) !== JSON.stringify(item.substitution);
        })
      )) {
        setCart(remoteCart);
        throw new Error("Your cart changed. Review it before placing your order.");
      }
      await processDemoPayment(draft.paymentMethod);
      const order = await createOrder(remoteCart, draft, shop, cartTotals(cart).subtotal);
      const [remainingCart, savedOrders] = await Promise.all([loadCart(), loadOrders()]);
      setOrders(savedOrders);
      setCart(remainingCart);
      setCartSheetOpen(false);
      setDraft(previous => ({
        ...initialDraft, checkoutId: newCheckoutId(),
        customerName: previous.customerName, phone: previous.phone,
      }));
      return order;
    } catch (cause) {
      try { setCart(await loadCart()); } catch { /* Keep the displayed cart if offline. */ }
      throw cause;
    } finally { lock.current = false; setSubmitting(false); }
  };
  const changeStatus = async (id: string, status: OrderStatus) => {
    await setOrderStatus(id, status);
    ++orderLoadVersion.current;
    setOrders(previous => previous.map(order =>
      order.id === id ? { ...order, status: "cancelled" } : order));
    void reloadOrders();
  };
  const reorder = (order: Order) => {
    if (!ready.current || lock.current) return;
    const version = ++cartVersion.current;
    void enqueue(async () => {
      for (const item of order.items) {
        await changeCart("add", item.product.id, item.quantity);
      }
    }).then(() => { void syncCart(version).catch(() => undefined); })
      .catch(cause => mutationFailed(cause, version));
    setDraft(previous => ({ ...previous, pickupSlot: null }));
  };
  const totals = useMemo(() => cartTotals(cart), [cart]);
  return createElement(Context.Provider, { value: {
    cart, draft, orders, shop, products, alternatives, loading, adding, error, submitting, totals,
    cartSheetOpen, openCartSheet: () => setCartSheetOpen(true),
    closeCartSheet: () => setCartSheetOpen(false),
    setQuantity, removeItem, addItem, clearCart, setSubstitution, updateDraft,
    submitOrder, changeStatus, reorder, reload, reloadOrders,
  } },
    children,
    createElement(ShopSwitchModal, {
      visible: !!shopSwitchPrompt,
      currentShopName: shopSwitchPrompt?.currentShopName || "",
      newShopName: shopSwitchPrompt?.newShopName || "",
      onConfirm: () => {
        if (shopSwitchResolver.current) shopSwitchResolver.current(true);
        setShopSwitchPrompt(null);
        shopSwitchResolver.current = null;
      },
      onCancel: () => {
        if (shopSwitchResolver.current) shopSwitchResolver.current(false);
        setShopSwitchPrompt(null);
        shopSwitchResolver.current = null;
      }
    })
  );
}

export function useCart() {
  const store = useContext(Context);
  if (!store) throw new Error("useCart must be used inside OrderingProvider");
  return store;
}
