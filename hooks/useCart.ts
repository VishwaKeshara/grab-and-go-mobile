import { createContext, createElement, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { PropsWithChildren } from "react";
import { getProfile } from "@/services/authService";
import { cartTotals, initialDraft, loadCart, loadDraft, newCheckoutId, saveCart, saveDraft } from "@/services/cartService";
import { createOrder, loadOrders, setOrderStatus } from "@/services/orderService";
import { processDemoPayment } from "@/services/paymentService";
import type { CartItem, CheckoutDraft, GroceryProduct, SubstitutePreference } from "@/types/cart";
import type { Order, OrderStatus } from "@/types/order";

type Store = {
  cart: CartItem[]; draft: CheckoutDraft; orders: Order[]; loading: boolean; error: string;
  submitting: boolean; totals: ReturnType<typeof cartTotals>;
  setQuantity: (id: string, quantity: number) => void;
  removeItem: (id: string) => void;
  addItem: (product: GroceryProduct) => void;
  clearCart: () => void;
  setSubstitution: (id: string, value: SubstitutePreference) => void;
  updateDraft: (value: Partial<CheckoutDraft>) => void;
  submitOrder: () => Promise<Order>;
  changeStatus: (id: string, status: OrderStatus) => Promise<void>;
  reorder: (order: Order) => void;
  reload: () => Promise<void>;
};

const Context = createContext<Store | null>(null);

export function OrderingProvider({ children }: PropsWithChildren) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [draft, setDraft] = useState<CheckoutDraft>(initialDraft);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const lock = useRef(false);
  const ready = useRef(false);

  const reload = async () => {
    setLoading(true); setError("");
    try {
      const [savedCart, savedDraft, savedOrders] = await Promise.all([loadCart(), loadDraft(), loadOrders()]);
      setCart(savedCart); setDraft(savedDraft); setOrders(savedOrders);
      ready.current = true;
      getProfile().then(profile => {
        if (!profile) return;
        setDraft(previous => ({ ...previous, customerName: previous.customerName || profile.full_name || "", phone: previous.phone || profile.phone || "" }));
      }).catch(() => undefined);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load your order data.");
    } finally { setLoading(false); }
  };
  useEffect(() => { void reload(); }, []);
  useEffect(() => { if (ready.current) saveCart(cart).catch(() => setError("Could not save your cart.")); }, [cart]);
  useEffect(() => { if (ready.current) saveDraft(draft).catch(() => setError("Could not save checkout details.")); }, [draft]);

  const setQuantity = (id: string, quantity: number) => setCart(previous => previous.map(item => item.product.id === id ? { ...item, quantity: Math.max(1, quantity) } : item));
  const removeItem = (id: string) => setCart(previous => previous.filter(item => item.product.id !== id));
  const addItem = (product: GroceryProduct) => setCart(previous => previous.some(item => item.product.id === product.id) ? previous.map(item => item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item) : [...previous, { product, quantity: 1, substitution: { type: "call" } }]);
  const clearCart = () => setCart([]);
  const setSubstitution = (id: string, value: SubstitutePreference) => setCart(previous => previous.map(item => item.product.id === id ? { ...item, substitution: value } : item));
  const updateDraft = (value: Partial<CheckoutDraft>) => setDraft(previous => ({ ...previous, ...value }));
  const submitOrder = async () => {
    if (lock.current) throw new Error("Your order is already being placed.");
    lock.current = true; setSubmitting(true);
    try {
      await processDemoPayment(draft.paymentMethod);
      const order = await createOrder(cart, draft);
      setOrders(previous => [order, ...previous.filter(value => value.id !== order.id)]);
      setCart([]); setDraft(previous => ({ ...initialDraft, checkoutId: newCheckoutId(), customerName: previous.customerName, phone: previous.phone }));
      return order;
    } finally { lock.current = false; setSubmitting(false); }
  };
  const changeStatus = async (id: string, status: OrderStatus) => {
    const updated = await setOrderStatus(id, status); setOrders(updated);
  };
  const reorder = (order: Order) => {
    setCart(previous => {
      const result = previous.map(item => ({ ...item }));
      for (const item of order.items) {
        const existing = result.find(value => value.product.id === item.product.id);
        if (existing) existing.quantity += item.quantity;
        else result.push({ ...item, substitution: { type: "call" } });
      }
      return result;
    });
    setDraft(previous => ({ ...previous, pickupSlot: null }));
  };
  const totals = useMemo(() => cartTotals(cart), [cart]);
  return createElement(Context.Provider, { value: { cart, draft, orders, loading, error, submitting, totals, setQuantity, removeItem, addItem, clearCart, setSubstitution, updateDraft, submitOrder, changeStatus, reorder, reload } }, children);
}

export function useCart() {
  const store = useContext(Context);
  if (!store) throw new Error("useCart must be used inside OrderingProvider");
  return store;
}
