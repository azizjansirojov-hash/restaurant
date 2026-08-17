/**
 * ORDER PLACEMENT PATH (real vs local fallback)
 * =============================================
 *
 * Real checkout (Supabase configured):
 *   CheckoutScreen.onPay
 *     → useOrderActions.placeOrderRemote (src/hooks/useAppActions.ts)
 *     → useCreateOrder mutation (this file)
 *     → supabase.rpc('create_order', { p_payload })  ← server persists order
 *     → createPaymentIntent edge function
 *     → Stripe PaymentSheet
 *     → supabase.rpc('confirm_order_payment')
 *
 * Local fallback only (isLocalFallbackMode() === true):
 *   CheckoutScreen.onPay
 *     → simulatorActions.placeOrder (src/domain/storeSimulator.ts)
 *     → placeOrderDomain (src/domain/orderService.ts)  ← in-memory only, never hits Supabase
 *
 * placeOrderDomain is NEVER called from this module or useCreateOrder.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getSupabase } from '../lib/supabase';
import { isLocalFallbackMode } from '../lib/env';
import { mapOrder, mapOrderItem } from './mappers';
import { queryKeys } from '../providers/QueryProvider';
import type { Order } from '../types';
import type { SelectedModifier } from '../types';

function assertRealOrderPath() {
  if (isLocalFallbackMode()) {
    throw new Error(
      'create_order RPC invoked in local fallback mode. Use simulatorActions.placeOrder instead.'
    );
  }
}

async function fetchOrders(): Promise<Order[]> {
  if (isLocalFallbackMode()) return [];
  const sb = getSupabase();
  const { data: orders, error } = await sb
    .from('orders')
    .select('*')
    .neq('status', 'pending_payment')
    .order('created_at', { ascending: false });
  if (error) throw error;
  if (!orders?.length) return [];

  const ids = orders.map((o) => o.id);
  const { data: items, error: itemsErr } = await sb
    .from('order_items')
    .select('*')
    .in('order_id', ids);
  if (itemsErr) throw itemsErr;

  const byOrder = new Map<string, ReturnType<typeof mapOrderItem>[]>();
  (items ?? []).forEach((row) => {
    const mapped = mapOrderItem(row);
    const list = byOrder.get(row.order_id) ?? [];
    list.push(mapped);
    byOrder.set(row.order_id, list);
  });

  return orders.map((o) => mapOrder(o, byOrder.get(o.id) ?? []));
}

export function useOrders() {
  return useQuery({ queryKey: queryKeys.orders, queryFn: fetchOrders });
}

export function useOrder(orderId: string | undefined) {
  const { data: orders } = useOrders();
  return orders?.find((o) => o.id === orderId);
}

export function useBumpOrderStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (orderId: string) => {
      assertRealOrderPath();
      const { data, error } = await getSupabase().rpc('bump_order_status', {
        p_order_id: orderId,
      });
      if (error) throw error;
      const result = data as { ok: boolean; error?: string; status?: string; notify_ready?: boolean };
      if (!result.ok) throw new Error(result.error ?? 'Failed to bump status');
      return result;
    },
    onMutate: async (orderId) => {
      await qc.cancelQueries({ queryKey: queryKeys.orders });
      const prev = qc.getQueryData<Order[]>(queryKeys.orders);
      const flow = ['received', 'preparing', 'ready', 'completed'] as const;
      qc.setQueryData<Order[]>(queryKeys.orders, (old) =>
        (old ?? []).map((o) => {
          if (o.id !== orderId) return o;
          const idx = flow.indexOf(o.status as (typeof flow)[number]);
          if (idx < 0 || idx >= flow.length - 1) return o;
          const next = flow[idx + 1];
          const now = new Date().toISOString();
          return {
            ...o,
            status: next,
            readyAt: next === 'ready' ? now : o.readyAt,
            completedAt: next === 'completed' ? now : o.completedAt,
          };
        })
      );
      return { prev };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(queryKeys.orders, ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: queryKeys.orders }),
  });
}

export function useCancelOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ orderId, reason }: { orderId: string; reason: string }) => {
      assertRealOrderPath();
      const { data, error } = await getSupabase().rpc('cancel_order', {
        p_order_id: orderId,
        p_reason: reason,
      });
      if (error) throw error;
      const result = data as { ok: boolean; error?: string };
      if (!result.ok) throw new Error(result.error ?? 'Failed to cancel');
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.orders });
      qc.invalidateQueries({ queryKey: queryKeys.profile });
    },
  });
}

/** Payload sent to create_order RPC. Prices are computed server-side; client prices are ignored. */
export interface CreateOrderPayload {
  items: {
    menu_item_id: string;
    name_snapshot: string;
    modifiers_snapshot: SelectedModifier[];
    quantity: number;
  }[];
  fulfillment_type: string;
  tip_percent: number;
  discount_mode: string;
  promo_code_id?: string;
  loyalty_blocks: number;
}

export function useCreateOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateOrderPayload) => {
      assertRealOrderPath();
      const { data, error } = await getSupabase().rpc('create_order', {
        p_payload: payload as unknown as import('../lib/database.types').Json,
      });
      if (error) throw error;
      const result = data as {
        ok: boolean;
        error?: string;
        order_id?: string;
        subtotal_som?: number;
        total_som?: number;
        requires_payment?: boolean;
      };
      if (!result.ok) throw new Error(result.error ?? 'Failed to create order');
      return result;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.orders });
      qc.invalidateQueries({ queryKey: queryKeys.profile });
    },
  });
}

export function useConfirmOrderPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      orderId,
      paymentIntentId,
    }: {
      orderId: string;
      paymentIntentId: string;
    }) => {
      assertRealOrderPath();
      const { data, error } = await getSupabase().rpc('confirm_order_payment', {
        p_order_id: orderId,
        p_payment_intent_id: paymentIntentId,
      });
      if (error) throw error;
      const result = data as { ok: boolean; error?: string };
      if (!result.ok) throw new Error(result.error ?? 'Payment confirmation failed');
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.orders }),
  });
}
