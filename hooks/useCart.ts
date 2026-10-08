import type { PropsWithChildren } from "react";
import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { Alert } from "react-native";

import { ShopSwitchModal } from "@/components/ShopSwitchModal";

import { getProfile } from "@/services/authService";
import {
  cartTotals,
  changeCart,
  initialDraft,
  loadCart,
  loadCatalog,
  loadDraft,
  newCheckoutId,
  saveDraft,
} from "@/services/cartService";
import {
  addItemsToOrder,
  createOrder,
  loadOrders,
  setOrderStatus,
} from "@/services/orderService";
import { processDemoPayment } from "@/services/paymentService";

import type {
  CartItem,
  CheckoutDraft,
  GroceryProduct,
  GroceryShop,
  SubstitutePreference,
} from "@/types/cart";

import type {
  Order,
  OrderAdditionItem,
  OrderStatus,
} from "@/types/order";

import { addProductToCart } from "@/utils/ordering";
import { describeError } from "@/utils/errors";

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
  addItem: (product: GroceryProduct) => Promise<AddToCartResult>;
  clearCart: () => void;
  setSubstitution: (id: string, value: SubstitutePreference) => void;
  updateDraft: (value: Partial<CheckoutDraft>) => void;
  submitOrder: () => Promise<Order>;
  changeStatus: (id: string, status: OrderStatus) => Promise<void>;
  addMoreItems: (
    id: string,
    requestId: string,
    items: OrderAdditionItem[],
    subtotal: number,
    currentTotal: number,
  ) => Promise<void>;
  reorder: (order: Order) => void;
  reload: () => Promise<void>;
  reloadOrders: () => Promise<void>;
};

/**
 * What one Add tap produced.
 *
 * `reason` used to be read off the store's `error` state at the call site, which
 * is the value from the render that started the tap -- addItem's own setError
 * lands in a later render, so every caller read "" and fell back to "We could not
 * add that to your cart", hiding the server's actual complaint ("Product inventory
 * unavailable", "Cart contains products from another shop"). Returning the reason
 * directly is what makes a failed add diagnosable.
 *
 * `reason` is absent when the shopper declined the shop-switch prompt. That is a
 * choice, not an error, so callers show no banner.
 */
export type AddToCartResult = {
  added: boolean;
  reason?: string;
};

const Context = createContext<Store | null>(null);

/**
 * A failure message the shopper can act on.
 *
 * The `instanceof Error` test that used to sit here was wrong for every database
 * failure: supabase-js rejects with plain objects (PostgrestError), never Error
 * instances, so `cause instanceof Error` was false and the generic fallback was
 * shown while the server's actual complaint -- "Product inventory unavailable",
 * "Cart contains products from another shop" -- was thrown away. That is why a
 * failed add could only ever read "We could not add that to your cart".
 * describeError exists for exactly this; see utils/errors.ts.
 */
function cartErrorMessage(cause: unknown, fallback: string): string {
  const code = (cause as { code?: string } | null)?.code;

  if (
    code === "PGRST205" ||
    code === "PGRST202" ||
    code === "42P01" ||
    code === "42883"
  ) {
    return "Ordering is unavailable right now. Please try again later.";
  }

  // change_customer_cart and place_customer_order raise plain sentences, and they
  // are more specific than anything this layer could invent, so they are passed
  // through rather than replaced.
  return describeError(cause, fallback);
}

class InitialOrderingLoadError extends Error {
  constructor(
    readonly stage: "cart" | "catalog",
    readonly original: unknown,
  ) {
    super(
      stage === "cart"
        ? "Could not load your cart."
        : "Could not load ordering products.",
    );
  }
}

function logInitialLoadError(
  stage: "cart" | "catalog" | "unknown",
  cause: unknown,
): void {
  if (!__DEV__) return;

  const error = cause as {
    code?: unknown;
    message?: unknown;
    details?: unknown;
    hint?: unknown;
  } | null;

  console.warn("[Ordering load] Initial request failed", {
    stage,
    code: error?.code,
    message: error?.message,
    details: error?.details,
    hint: error?.hint,
  });
}

async function loadInitialStage<T>(
  stage: "cart" | "catalog",
  request: () => Promise<T>,
): Promise<T> {
  try {
    return await request();
  } catch (cause) {
    logInitialLoadError(stage, cause);
    throw new InitialOrderingLoadError(stage, cause);
  }
}

async function loadWithTimeout<T>(request: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      request,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(
            new Error(
              "Cart loading timed out. Check your connection and try again.",
            ),
          );
        }, 15000);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function OrderingProvider({ children }: PropsWithChildren) {
  const [cart, setCart] = useState<CartItem[]>([]);
  // The shop customer_carts is scoped to. Not the same as the shop of the items
  // on screen: the column outlives an emptied cart, and change_customer_cart
  // compares against it. See LoadedCart.
  const [cartShopId, setCartShopId] = useState<string | null>(null);
  const [draft, setDraft] = useState<CheckoutDraft>(initialDraft);
  const [orders, setOrders] = useState<Order[]>([]);
  const [shop, setShop] = useState<GroceryShop | null>(null);
  const [products, setProducts] = useState<GroceryProduct[]>([]);
  const [alternatives, setAlternatives] = useState<
    Record<string, GroceryProduct[]>
  >({});
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

      if (version === orderLoadVersion.current) {
        setOrders(latest);
      }
    } catch (cause) {
      if (version === orderLoadVersion.current) {
        setError(describeError(cause, "Could not load your orders."));
      }
    }
  }, []);

  const reload = async () => {
    setLoading(true);
    setError("");
    ready.current = false;

    try {
      const { savedCart, catalog } = await loadWithTimeout(
        (async () => {
          await cartQueue.current;

          const savedCart = await loadInitialStage("cart", loadCart);

          // Preserve the loaded cart if catalog loading fails.
          setCart(savedCart.items);
          setCartShopId(savedCart.shopId);

          const catalog = await loadInitialStage("catalog", loadCatalog);

          return { savedCart, catalog };
        })(),
      );

      setShop(catalog.shop);
      setProducts(catalog.products);
      setAlternatives(catalog.alternatives);
      setCart(savedCart.items);
      ready.current = true;

      if (__DEV__) {
        console.log("[Cart] initial load succeeded", {
          shopId: catalog.shop.id,
          catalogCount: catalog.products.length,
          cartCount: savedCart.items.length,
          cartShopId: savedCart.shopId,
        });
      }

      void loadDraft()
        .then((savedDraft) => {
          setDraft(savedDraft);

          void getProfile()
            .then((profile) => {
              if (!profile) return;

              setDraft((previous) => ({
                ...previous,
                customerName: previous.customerName || profile.full_name || "",
                phone: previous.phone || profile.phone || "",
              }));
            })
            .catch(() => undefined);
        })
        .catch(() => {
          setError("Could not load checkout details.");
        });

      void reloadOrders();
    } catch (cause) {
      const failure = cause instanceof InitialOrderingLoadError ? cause : null;

      const original = failure?.original ?? cause;

      if (!failure) {
        logInitialLoadError("unknown", original);
      }

      setError(
        cartErrorMessage(
          original,
          failure?.message ?? "Could not load your cart.",
        ),
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
  }, []);

  useEffect(() => {
    if (ready.current) {
      void saveDraft(draft).catch(() => {
        setError("Could not save checkout details.");
      });
    }
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
      setCart(remote.items);
      setCartShopId(remote.shopId);
    }
  };

  const mutationFailed = (
    cause: unknown,
    version: number,
    snapshot?: CartItem[],
  ) => {
    const message = cartErrorMessage(cause, "Could not update your cart.");

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
        item.product.id === id ? { ...item, quantity: value } : item,
      ),
    );

    void enqueue(() => changeCart("set", id, value))
      .then(() => {
        void syncCart(version).catch(() => undefined);
      })
      .catch((cause) => {
        mutationFailed(cause, version, snapshot);
      });
  };

  const removeItem = (id: string) => {
    if (!ready.current || lock.current) return;

    const snapshot = cart;
    const version = ++cartVersion.current;

    setCart((previous) => previous.filter((item) => item.product.id !== id));

    void enqueue(() => changeCart("remove", id))
      .then(() => {
        void syncCart(version).catch(() => undefined);
      })
      .catch((cause) => {
        mutationFailed(cause, version, snapshot);
      });
  };

  const addItem = async (requested: GroceryProduct): Promise<AddToCartResult> => {
    let product = products.find((value) => value.id === requested.id);

    if (__DEV__) {
      console.log("[Cart] addItem entered", {
        productId: requested.id,
        loading,
        adding: addInFlight.current,
        locked: lock.current,
        ready: ready.current,
        catalogCount: products.length,
        productInCatalog: !!product,
        requestedShopId: requested.shopId,
        catalogShopId: shop?.id,
        error,
      });
    }

    const blocked = (
      reason: string,
      title: string,
      message: string,
    ): AddToCartResult => {
      if (__DEV__) {
        console.warn("[Cart] add blocked", {
          reason,
          productId: requested.id,
        });
      }

      setError(message);
      Alert.alert(title, message);
      return { added: false, reason: message };
    };

    if (loading) {
      return blocked(
        "loading",
        "Cart loading",
        "Please wait for your cart to load and try again.",
      );
    }

    if (addInFlight.current) {
      if (__DEV__) {
        console.log("[Cart] add blocked", {
          reason: "add-in-flight",
          productId: requested.id,
        });
      }

      return {
        added: false,
        reason: "Another item is being added to your cart. Try again in a moment.",
      };
    }

    if (lock.current) {
      return blocked(
        "checkout-locked",
        "Cart unavailable",
        "Please wait until your order has finished processing.",
      );
    }

    if (!ready.current) {
      return blocked(
        "catalog-not-ready",
        "Cart unavailable",
        error || "Could not load the ordering catalog.",
      );
    }

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
      return blocked(
        "product-not-in-catalog",
        "Product unavailable",
        "This product is not available in the ordering catalog.",
      );
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

    // The switch check used to be `cart.length > 0 && cart[0].product.shopId !==
    // targetShopId`, which read the cart's shop off its first item. That missed
    // the case the RPC actually rejects: a cart that is empty on screen but still
    // scoped to a shop on the server, because customer_carts.shop_id is only reset
    // by 'clear' or by removing the last line. No items meant no prompt, and the
    // add came straight back as 'Cart contains products from another shop'.
    // cartShopId is the server's own column, so it is used directly.
    const currentShopId = cartShopId ?? cart[0]?.product.shopId ?? null;

    if (currentShopId && targetShopId && currentShopId !== targetShopId) {
      const currentShopName = shop && shop.id === currentShopId ? shop.name : "another shop";
      const newShopName = (requested as any).shop_name || "this shop";

        const confirmed = await askToSwitchShop(currentShopName, newShopName);

        if (!confirmed) {
          // The shopper declined, so there is nothing to report. Callers show no
          // banner when `reason` is absent.
          return { added: false };
        }

        try {
          addInFlight.current = true;
          setAdding(true);

          await enqueue(() => changeCart("clear"));
          setCart([]);
          setCartShopId(null);

          if (__DEV__) {
            console.log("[Cart] sending add RPC (switch)", product!.id);
          }
          await enqueue(() => changeCart("add", product!.id, 1));

          await reload();

          setCartSheetOpen(true);
          return { added: true };
        } catch (e) {
          mutationFailed(e, ++cartVersion.current);
          return {
            added: false,
            reason: cartErrorMessage(e, "Could not add that to your cart."),
          };
        } finally {
          addInFlight.current = false;
          setAdding(false);
        }
    }

    // Keep shop/cart rules enforced by the server RPC.
    // Do not replace another shop's cart locally.
    addInFlight.current = true;
    setAdding(true);
    setError("");

    const version = ++cartVersion.current;
    const wasEmpty = cart.length === 0;

    try {
      if (__DEV__) {
        console.log("[Cart] sending add RPC", product!.id);
      }

      await enqueue(() => changeCart("add", product!.id, 1));

      if (__DEV__) {
        console.log("[Cart] add RPC succeeded", product!.id);
      }

      setCart((previous) => addProductToCart(previous, product!));

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

      return { added: true };
    } catch (cause) {
      if (__DEV__) {
        console.warn("[Cart] add failed", cause);
      }

      mutationFailed(cause, version);
      return {
        added: false,
        reason: cartErrorMessage(cause, "Could not add that to your cart."),
      };
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
      .catch((cause) => {
        mutationFailed(cause, version, snapshot);
      });
  };

  const setSubstitution = (id: string, value: SubstitutePreference) => {
    if (!ready.current || lock.current) return;

    const snapshot = cart;
    const version = ++cartVersion.current;

    setCart((previous) =>
      previous.map((item) =>
        item.product.id === id ? { ...item, substitution: value } : item,
      ),
    );

    void enqueue(() => changeCart("substitute", id, undefined, value))
      .then(() => {
        void syncCart(version).catch(() => undefined);
      })
      .catch((cause) => {
        mutationFailed(cause, version, snapshot);
      });
  };

  const updateDraft = (value: Partial<CheckoutDraft>) => {
    setDraft((previous) => ({
      ...previous,
      ...value,
    }));
  };

  const submitOrder = async (): Promise<Order> => {
    if (lock.current) {
      throw new Error("Your order is already being placed.");
    }

    if (!shop) {
      throw new Error("Ordering shop is unavailable.");
    }

    lock.current = true;
    ++cartVersion.current;
    setSubmitting(true);

    try {
      await cartQueue.current;

      const remoteCart = await loadCart();
      const displayed = new Map(
        cart.map((item) => [item.product.id, item] as const),
      );

      if (
        remoteCart.items.length &&
        (remoteCart.items.length !== cart.length ||
          remoteCart.items.some((item) => {
            const current = displayed.get(item.product.id);

            return (
              !current ||
              current.quantity !== item.quantity ||
              current.product.price !== item.product.price ||
              JSON.stringify(current.substitution) !==
                JSON.stringify(item.substitution)
            );
          }))
      ) {
        setCart(remoteCart.items);
        throw new Error(
          "Your cart changed. Review it before placing your order.",
        );
      }

      await processDemoPayment(draft.paymentMethod);

      const order = await createOrder(
        remoteCart.items,
        draft,
        shop,
        cartTotals(cart).subtotal,
      );

      const [remainingCart, savedOrders] = await Promise.all([
        loadCart(),
        loadOrders(),
      ]);

      setOrders(savedOrders);
      setCart(remainingCart.items);
      setCartShopId(remainingCart.shopId);
      setCartSheetOpen(false);

      // Rotate the checkout ID only after confirming the saved
      // order and remaining cart. Preserve it on uncertain failures.
      const nextDraft: CheckoutDraft = {
        ...initialDraft,
        checkoutId: newCheckoutId(),
        customerName: draft.customerName,
        phone: draft.phone,
      };

      setDraft(nextDraft);

      try {
        await saveDraft(nextDraft);
      } catch {
        setError(
          "Your order was placed, but the next checkout details could not be saved on this device.",
        );
      }

      return order;
    } catch (cause) {
      try {
        const refreshed = await loadCart();
        setCart(refreshed.items);
        setCartShopId(refreshed.shopId);
      } catch {
        // Keep the displayed cart if the refresh fails.
      }

      throw cause;
    } finally {
      lock.current = false;
      setSubmitting(false);
    }
  };

  const changeStatus = async (
    id: string,
    status: OrderStatus,
  ): Promise<void> => {
    await setOrderStatus(id, status);

    ++orderLoadVersion.current;

    setOrders((previous) =>
      previous.map((order) =>
        order.id === id ? { ...order, status: "cancelled" } : order,
      ),
    );

    void reloadOrders();
  };

  const addMoreItems = async (
    id: string,
    requestId: string,
    items: OrderAdditionItem[],
    subtotal: number,
    currentTotal: number,
  ): Promise<void> => {
    await addItemsToOrder(id, requestId, items, subtotal, currentTotal);

    const version = ++orderLoadVersion.current;

    try {
      const latest = await loadOrders();

      if (!latest.some((order) => order.id === id)) {
        throw new Error("Order missing after update");
      }

      if (version === orderLoadVersion.current) {
        setOrders(latest);
      }
    } catch {
      throw new Error(
        "Your request may have saved, but the order could not be refreshed. Retry the same selection to check safely.",
      );
    }
  };

  const reorder = (order: Order) => {
    if (!ready.current || lock.current) return;

    const version = ++cartVersion.current;

    void enqueue(async () => {
      for (const item of order.items) {
        if (!item.product.id) continue;

        await changeCart("add", item.product.id, item.quantity);
      }
    })
      .then(() => {
        void syncCart(version).catch(() => undefined);
      })
      .catch((cause) => {
        mutationFailed(cause, version);
      });

    setDraft((previous) => ({
      ...previous,
      pickupSlot: null,
    }));
  };

  const totals = useMemo(() => cartTotals(cart), [cart]);

  const value: Store = {
    cart,
    draft,
    orders,
    shop,
    products,
    alternatives,
    loading,
    adding,
    error,
    submitting,
    totals,
    cartSheetOpen,
    openCartSheet: () => setCartSheetOpen(true),
    closeCartSheet: () => setCartSheetOpen(false),
    setQuantity,
    removeItem,
    addItem,
    clearCart,
    setSubstitution,
    updateDraft,
    submitOrder,
    changeStatus,
    addMoreItems,
    reorder,
    reload,
    reloadOrders,
  };

  return createElement(Context.Provider, { value },
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

export function useCart(): Store {
  const store = useContext(Context);

  if (!store) {
    throw new Error("useCart must be used inside OrderingProvider");
  }

  return store;
}
