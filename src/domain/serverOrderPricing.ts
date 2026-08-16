/**
 * Faithful TypeScript mirror of create_order RPC pricing logic (002_fix_order_price_trust.sql).
 * Used by QA tests to assert server-side price trust without a live Postgres instance.
 * Keep in sync with public.validate_modifiers_and_unit_price + public.create_order.
 */
import type { MenuItem, Modifier, PromoCode, RestaurantSettings, SelectedModifier } from '../types';
import { calcTax, calcTip } from '../utils/money';

export interface CreateOrderRpcItem {
  menu_item_id: string;
  name_snapshot?: string;
  /** Ignored by server — present only to simulate tampering in QA tests */
  unit_price_cents?: number;
  modifiers_snapshot: SelectedModifier[];
  quantity: number;
}

export interface CreateOrderRpcPayload {
  items: CreateOrderRpcItem[];
  fulfillment_type: string;
  tip_percent: number;
  discount_mode: 'none' | 'promo' | 'loyalty';
  promo_code_id?: string;
  loyalty_blocks: number;
}

export interface ValidatedLine {
  menuItemId: string;
  unitPriceCents: number;
  modifiersSnapshot: SelectedModifier[];
  quantity: number;
}

function findModifierOption(
  menuModifiers: Modifier[],
  sel: SelectedModifier
): { modifier: Modifier; priceCents: number } | { error: string } {
  const modifier = menuModifiers.find((m) => m.id === sel.modifierId);
  if (!modifier) return { error: 'Invalid modifier selection.' };
  const option = modifier.options.find((o) => o.name === sel.optionName);
  if (!option) return { error: 'Invalid modifier option.' };
  return { modifier, priceCents: option.priceCents };
}

export function validateModifiersAndUnitPrice(
  menuItem: MenuItem,
  modifiersSnapshot: SelectedModifier[]
): { ok: true; unitPriceCents: number; modifiersSnapshot: SelectedModifier[] } | { ok: false; error: string } {
  let unit = menuItem.priceCents;
  const validated: SelectedModifier[] = [];
  const selectedIds = new Set<string>();

  for (const sel of modifiersSnapshot) {
    const result = findModifierOption(menuItem.modifiers, sel);
    if ('error' in result) return { ok: false, error: result.error };
    selectedIds.add(result.modifier.id);
    unit += result.priceCents;
    validated.push({
      modifierId: result.modifier.id,
      modifierName: result.modifier.name,
      optionName: sel.optionName,
      priceCents: result.priceCents,
    });
  }

  for (const mod of menuItem.modifiers) {
    if (mod.required && !selectedIds.has(mod.id)) {
      return { ok: false, error: 'Required modifier missing.' };
    }
  }

  return { ok: true, unitPriceCents: unit, modifiersSnapshot: validated };
}

export function computeCreateOrderTotals(
  menuItems: MenuItem[],
  settings: RestaurantSettings,
  promos: PromoCode[],
  payload: CreateOrderRpcPayload,
  loyaltyBalance: number
):
  | {
      ok: true;
      subtotalCents: number;
      discountCents: number;
      taxCents: number;
      tipCents: number;
      totalCents: number;
      lines: ValidatedLine[];
    }
  | { ok: false; error: string } {
  let subtotalCents = 0;
  const lines: ValidatedLine[] = [];

  for (const item of payload.items) {
    const menu = menuItems.find((m) => m.id === item.menu_item_id && m.isAvailable);
    if (!menu) return { ok: false, error: 'Menu item unavailable.' };
    if (item.quantity <= 0) return { ok: false, error: 'Invalid quantity.' };

    const validated = validateModifiersAndUnitPrice(menu, item.modifiers_snapshot);
    if (!validated.ok) return validated;

    // Server ignores item.unit_price_cents entirely
    subtotalCents += validated.unitPriceCents * item.quantity;
    lines.push({
      menuItemId: menu.id,
      unitPriceCents: validated.unitPriceCents,
      modifiersSnapshot: validated.modifiersSnapshot,
      quantity: item.quantity,
    });
  }

  if (subtotalCents === 0) return { ok: false, error: 'Your cart is empty.' };

  let discountCents = 0;
  if (payload.discount_mode === 'promo' && payload.promo_code_id) {
    const promo = promos.find((p) => p.id === payload.promo_code_id && p.active);
    if (!promo) return { ok: false, error: 'Invalid promo.' };
    if (promo.maxRedemptions != null && promo.redemptionCount >= promo.maxRedemptions) {
      return { ok: false, error: 'Promo fully redeemed.' };
    }
    discountCents =
      promo.type === 'percent'
        ? Math.min(subtotalCents, Math.round(subtotalCents * (promo.value / 100)))
        : Math.min(subtotalCents, promo.value);
  } else if (payload.discount_mode === 'loyalty' && payload.loyalty_blocks > 0) {
    const points = payload.loyalty_blocks * settings.loyaltyRedeemBlock;
    if (points > loyaltyBalance) return { ok: false, error: 'Not enough loyalty points.' };
    discountCents = Math.min(
      subtotalCents,
      payload.loyalty_blocks * settings.loyaltyRedeemValueCents
    );
  }

  const afterDiscount = Math.max(0, subtotalCents - discountCents);
  const taxCents = calcTax(afterDiscount, settings.taxRatePercent);
  const tipCents = calcTip(afterDiscount, payload.tip_percent);
  const totalCents = afterDiscount + taxCents + tipCents;

  return {
    ok: true,
    subtotalCents,
    discountCents,
    taxCents,
    tipCents,
    totalCents,
    lines,
  };
}
