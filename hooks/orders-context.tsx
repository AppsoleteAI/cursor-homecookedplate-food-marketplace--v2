import createContextHook from '@nkzw/create-context-hook';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Order, Meal, OrderMessage, CartItem } from '@/types';
import { mockMeals, mockOrders } from '@/mocks/data';
import { useAuth } from '@/hooks/auth-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { captureException } from '@/lib/sentry';
import { trpc, trpcProxyClient } from '@/lib/trpc';

interface OrdersState {
  orders: Order[];
  isLoading: boolean;
  refresh: () => Promise<void>;
  activeOrdersCount: number;
  todayEarnings: number;
  weekEarnings: number;
  totalReviews: number;
  getOrder: (id: string) => Order | undefined;
  setOrderStatus: (id: string, status: Order['status']) => void;
  addMessage: (orderId: string, message: Omit<OrderMessage, 'id' | 'createdAt'> & { text: string }) => Promise<void>;
  getMessages: (orderId: string) => OrderMessage[];
  syncMessages: (orderId: string) => Promise<void>;
  createPaidOrdersFromCart: (items: CartItem[], plateTaker: { id: string; username?: string }) => Order[];
  bellCount: number;
  markBellSeen: () => Promise<void>;
  getNotificationItems: () => { id: string; title: string; body: string; date: string }[];
}

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setHours(0, 0, 0, 0);
  d.setDate(diff);
  return d;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function hydrateOrders(src: Order[], meals: Meal[], plateMakerId?: string | null): Order[] {
  const now = new Date();
  return src
    .filter(o => (o.paid ?? false) === true)
    .filter(o => !plateMakerId || o.plateMakerId === plateMakerId)
    .map((o, i) => {
      const base = new Date(now);
      base.setHours(now.getHours() - (i * 3));
      const pickup = new Date(base);
      pickup.setHours(base.getHours() + 4);
      return {
        ...o,
        orderDate: base,
        pickupTime: o.pickupTime ?? pickup,
      };
    });
}

export const [OrdersProvider, useOrders] = createContextHook<OrdersState>(() => {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const mountedRef = useRef<boolean>(true);
  const messagesRef = useRef<Record<string, OrderMessage[]>>({});
  const MSG_KEY_PREFIX = 'order_messages_';
  const BELL_SEEN_PREFIX = 'bell_last_seen_';
  const [bellLastSeen, setBellLastSeen] = useState<Date | null>(null);

  // Internal Gating: Only fetch orders and load data after authentication
  // This reduces TTR on login screen by deferring expensive operations
  useEffect(() => {
    mountedRef.current = true;
    
    // Gate: Wait for auth to finish loading, then only proceed if authenticated
    if (authLoading) {
      return; // Wait for auth state to resolve
    }
    
    if (!isAuthenticated || !user?.id) {
      // Not authenticated - skip expensive operations
      if (mountedRef.current) {
        setIsLoading(false);
        setOrders([]);
      }
      return;
    }
    
    // Authenticated - proceed with data fetching
    refresh();
    (async () => {
      try {
        if (user?.id) {
          const key = `${BELL_SEEN_PREFIX}${user.role}_${user.id}`;
          const raw = await AsyncStorage.getItem(key);
          if (raw) {
            const d = new Date(raw);
            if (!Number.isNaN(d.getTime())) setBellLastSeen(d);
          }
        }
      } catch (e) {
        captureException(e as Error, { context: 'load bellLastSeen', userId: user?.id });
      }
    })();
    return () => {
      mountedRef.current = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.role, isAuthenticated, authLoading]);

  const refresh = useCallback(async () => {
    try {
      setIsLoading(true);
      const hydrated = hydrateOrders(mockOrders, mockMeals, user?.role === 'platemaker' ? user?.id : undefined);
      if (mountedRef.current) {
        setOrders(hydrated);
        // Load persisted messages asynchronously in background without blocking
        setTimeout(() => {
          hydrated.forEach(async (o) => {
            try {
              const raw = await AsyncStorage.getItem(MSG_KEY_PREFIX + o.id);
              if (raw) {
                const parsed = JSON.parse(raw) as {
                  id: string;
                  orderId: string;
                  senderId: string;
                  senderRole: 'platemaker' | 'platetaker';
                  text: string;
                  createdAt: string;
                }[];
                messagesRef.current[o.id] = parsed.map(m => ({
                  ...m,
                  createdAt: new Date(m.createdAt),
                }));
              } else if (!messagesRef.current[o.id]) {
                messagesRef.current[o.id] = [];
              }
            } catch (err) {
              captureException(err as Error, { context: 'load order messages', orderId: o.id });
              if (!messagesRef.current[o.id]) messagesRef.current[o.id] = [];
            }
          });
        }, 0);
      }
    } catch (e) {
      captureException(e as Error, { context: 'orders refresh', userId: user?.id, role: user?.role });
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  }, [user?.id, user?.role]);

  const activeOrdersCount = useMemo(() => orders.filter(o => o.status !== 'completed' && o.status !== 'cancelled').length, [orders]);

  const role = user?.role;
  const myUserId = user?.id ?? '';

  const readyForBuyerCount = useMemo(() => {
    if (!role) return 0;
    if (role !== 'platetaker') return 0;
    return orders.filter(o => o.plateTakerId === myUserId && o.status === 'ready').length;
  }, [orders, role, myUserId]);

  const readyToMakeCount = useMemo(() => {
    if (!role) return 0;
    if (role !== 'platemaker') return 0;
    return orders.filter(o => o.plateMakerId === myUserId && o.paid === true && (o.status === 'accepted')).length;
  }, [orders, role, myUserId]);

  const newMessagesSinceLastSeen = useMemo(() => {
    if (!bellLastSeen || !role) return 0;
    let count = 0;
    for (const order of orders) {
      const msgs = messagesRef.current[order.id] ?? [];
      count += msgs.filter(m => m.createdAt > bellLastSeen && m.senderRole !== role).length;
    }
    return count;
  }, [orders, bellLastSeen, role]);

  const paymentsSinceLastSeen = useMemo(() => {
    if (!bellLastSeen || role !== 'platemaker') return 0;
    return orders.filter(o => o.plateMakerId === myUserId && o.paid === true && (o.orderDate > bellLastSeen)).length;
  }, [orders, bellLastSeen, role, myUserId]);

  const bellCount = useMemo(() => {
    if (!role) return 0;
    if (role === 'platetaker') {
      return readyForBuyerCount + newMessagesSinceLastSeen;
    }
    return readyToMakeCount + paymentsSinceLastSeen + newMessagesSinceLastSeen;
  }, [role, readyForBuyerCount, newMessagesSinceLastSeen, readyToMakeCount, paymentsSinceLastSeen]);

  // CRITICAL SECURITY: Only call backend procedure if user is platemaker
  // This prevents API calls from platetakers and ensures frontend never attempts to fetch data for non-platemakers
  const dashboardStats = trpc.platemaker.getDashboardStats.useQuery(undefined, {
    enabled: user?.role === 'platemaker' && isAuthenticated,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
  });

  const todayEarnings = useMemo(() => {
    // Use backend data if available (for platemakers only)
    if (user?.role === 'platemaker' && dashboardStats.data) {
      return dashboardStats.data.todayTakeHome; // Use take-home, not gross revenue
    }
    // Fallback to frontend calculation (only for platemakers, never expose to platetakers)
    if (user?.role !== 'platemaker') {
      return 0; // Never expose earnings to platetakers
    }
    const today = new Date();
    return orders
      .filter(o => o.status === 'completed' && isSameDay(o.orderDate, today))
      .reduce((sum, o) => sum + (o.totalPrice ?? 0), 0);
  }, [orders, user?.role, dashboardStats.data]);

  const weekEarnings = useMemo(() => {
    // Use backend data if available (for platemakers only)
    if (user?.role === 'platemaker' && dashboardStats.data) {
      return dashboardStats.data.weekTakeHome; // Use take-home, not gross revenue
    }
    // Fallback to frontend calculation (only for platemakers, never expose to platetakers)
    if (user?.role !== 'platemaker') {
      return 0; // Never expose earnings to platetakers
    }
    const start = startOfWeek(new Date());
    return orders
      .filter(o => o.status === 'completed' && (o.orderDate >= start))
      .reduce((sum, o) => sum + (o.totalPrice ?? 0), 0);
  }, [orders, user?.role, dashboardStats.data]);

  const totalReviews = useMemo(() => {
    if (!user || user.role !== 'platemaker') return 0;
    return mockMeals.filter(m => m.plateMakerId === user.id).reduce((sum, m) => sum + (m.reviewCount ?? 0), 0);
  }, [user]);

  const getOrder = useCallback((id: string) => orders.find(o => o.id === id), [orders]);

  const setOrderStatus = useCallback((id: string, status: Order['status']) => {
    setOrders(prev => prev.map(o => (o.id === id ? { ...o, status } : o)));
  }, []);

  const sendMessageMutation = trpc.messages.send.useMutation();

  const syncMessages = useCallback(async (orderId: string) => {
    try {
      const data = await trpcProxyClient.messages.list.query({ orderId });
      const messages = data.map((m: {
        id: string;
        orderId: string;
        senderId: string;
        senderRole: 'platemaker' | 'platetaker';
        text: string;
        createdAt: string;
      }) => ({
        id: m.id,
        orderId: m.orderId,
        senderId: m.senderId,
        senderRole: m.senderRole,
        text: m.text,
        createdAt: new Date(m.createdAt),
      }));
      messagesRef.current[orderId] = messages;
      const persist = messages.map((m: OrderMessage) => ({ ...m, createdAt: m.createdAt.toISOString() }));
      await AsyncStorage.setItem(MSG_KEY_PREFIX + orderId, JSON.stringify(persist));
    } catch (err) {
      captureException(err as Error, { context: 'sync messages', orderId });
    }
  }, []);

  const addMessage = useCallback(async (orderId: string, message: Omit<OrderMessage, 'id' | 'createdAt'> & { text: string }) => {
    try {
      const result = await sendMessageMutation.mutateAsync({
        orderId,
        text: message.text,
      });
      
      const msg: OrderMessage = {
        id: result.id,
        orderId: result.orderId,
        senderId: result.senderId,
        senderRole: result.senderRole as 'platemaker' | 'platetaker',
        text: result.text,
        createdAt: new Date(result.createdAt),
      };
      
      const bucket = messagesRef.current[orderId] ?? [];
      const next = [...bucket, msg].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      messagesRef.current[orderId] = next;
      
      const persist = next.map(m => ({ ...m, createdAt: m.createdAt.toISOString() }));
      await AsyncStorage.setItem(MSG_KEY_PREFIX + orderId, JSON.stringify(persist));
    } catch (err) {
      captureException(err as Error, { context: 'send message', orderId });
      throw err;
    }
  }, [sendMessageMutation]);

  const getMessages = useCallback((orderId: string) => {
    const list = messagesRef.current[orderId] ?? [];
    return [...list].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }, []);

  const createPaidOrdersFromCart = useCallback((items: CartItem[], plateTaker: { id: string; username?: string }) => {
    const now = new Date();
    const created: Order[] = items.map((ci, idx) => ({
      id: `ord_${now.getTime()}_${idx}`,
      mealId: ci.meal.id,
      mealName: ci.meal.name,
      mealImage: ci.meal.images[0] ?? '',
      plateTakerId: plateTaker.id,
      plateTakerName: plateTaker.username,
      plateMakerId: ci.meal.plateMakerId,
      plateMakerName: ci.meal.plateMakerName,
      status: 'accepted',
      quantity: ci.quantity,
      totalPrice: ci.meal.price * ci.quantity,
      paid: true,
      specialInstructions: ci.specialInstructions,
      cookingTemperature: ci.cookingTemperature,
      allergies: ci.allergies,
      orderDate: new Date(),
      pickupTime: new Date(new Date().getTime() + 2 * 60 * 60 * 1000),
    }));
    setOrders(prev => [...created, ...prev]);
    return created;
  }, []);

  const markBellSeen = useCallback(async () => {
    try {
      const now = new Date();
      setBellLastSeen(now);
      if (user?.id) {
        const key = `${BELL_SEEN_PREFIX}${user.role}_${user.id}`;
        await AsyncStorage.setItem(key, now.toISOString());
      }
    } catch (e) {
      captureException(e as Error, { context: 'markBellSeen', userId: user?.id });
    }
  }, [user?.id, user?.role]);

  const getNotificationItems = useCallback(() => {
    const items: { id: string; title: string; body: string; date: string }[] = [];
    if (!role) return items;
    if (role === 'platetaker') {
      for (const o of orders) {
        if (o.plateTakerId === myUserId && o.status === 'ready') {
          items.push({ id: `${o.id}-ready`, title: 'Meal Ready', body: `${o.mealName} is ready for pickup`, date: o.pickupTime?.toISOString?.() ?? new Date().toISOString() });
        }
      }
    } else {
      for (const o of orders) {
        if (o.plateMakerId === myUserId && o.paid === true && o.status === 'accepted') {
          items.push({ id: `${o.id}-to-make`, title: 'New Paid Order', body: `${o.mealName} is ready to be made`, date: o.orderDate.toISOString() });
        }
      }
    }
    if (bellLastSeen) {
      for (const o of orders) {
        const msgs = messagesRef.current[o.id] ?? [];
        for (const m of msgs) {
          if (m.createdAt > bellLastSeen && m.senderRole !== role) {
            items.push({ id: `${o.id}-msg-${m.id}` , title: 'New Order Message', body: m.text, date: m.createdAt.toISOString() });
          }
        }
      }
    }
    return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [orders, role, myUserId, bellLastSeen]);

  return useMemo(() => ({
    orders,
    isLoading,
    refresh,
    activeOrdersCount,
    todayEarnings,
    weekEarnings,
    totalReviews,
    getOrder,
    setOrderStatus,
    addMessage,
    getMessages,
    createPaidOrdersFromCart,
    bellCount,
    markBellSeen,
    getNotificationItems,
    syncMessages,
  }), [orders, isLoading, refresh, activeOrdersCount, todayEarnings, weekEarnings, totalReviews, getOrder, setOrderStatus, addMessage, getMessages, createPaidOrdersFromCart, bellCount, markBellSeen, getNotificationItems, syncMessages]);
});