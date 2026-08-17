/**
 * Faithful TypeScript mirror of create_order RPC pricing logic.
 * Keep in sync with public.validate_modifiers_and_unit_price + public.create_order.
 */
import type { MenuItem, Modifier, PromoCode, RestaurantSettings, SelectedModifier } from '../types';
import type { ErrorCode } from './errorCodes';
import { calcTax, calcTip } from '../utils/money';

export interface CreateOrderRpcItem {
  menu_item_id: string;
  name_snapshot?: string;
  /** Ignored by server — present only to simulate tampering in QA tests */
  unit_price_som?: number;
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
  unitPriceSom: number;
  modifiersSnapshot: SelectedModifier[];
  quantity: number;
}

function findModifierOption(
  menuModifiers: Modifier[],
  sel: SelectedModifier
): { modifier: Modifier; priceSom: number } | { errorCode: ErrorCode } {
  const modifier = menuModifiers.find((m) => m.id === sel.modifierId);
  if (!modifier) return { errorCode: 'invalidModifierSelection' };
  const option = modifier.options.find((o) => o.name === sel.optionName);
  if (!option) return { errorCode: 'invalidModifierOption' };
  return { modifier, priceSom: option.priceSom };
}

export function validateModifiersAndUnitPrice(
  menuItem: MenuItem,
  modifiersSnapshot: SelectedModifier[]
): { ok: true; unitPriceSom: number; modifiersSnapshot: SelectedModifier[] } | { ok: false; errorCode: ErrorCode } {
  let unit = menuItem.priceSom;
  const validated: SelectedModifier[] = [];
  const selectedIds = new Set<string>();

  for (const sel of modifiersSnapshot) {
    const result = findModifierOption(menuItem.modifiers, sel);
    if ('errorCode' in result) return { ok: false, errorCode: result.errorCode };
    selectedIds.add(result.modifier.id);
    unit += result.priceSom;
    validated.push({
      modifierId: result.modifier.id,
      modifierName: result.modifier.name,
      optionName: sel.optionName,
      priceSom: result.priceSom,
    });
  }

  for (const mod of menuItem.modifiers) {
    if (mod.required && !selectedIds.has(mod.id)) {
      return { ok: false, errorCode: 'requiredModifierMissing' };
    }
  }

  return { ok: true, unitPriceSom: unit, modifiersSnapshot: validated };
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
      subtotalSom: number;
      discountSom: number;
      taxSom: number;
      tipSom: number;
      totalSom: number;
      lines: ValidatedLine[];
    }
  | { ok: false; errorCode: ErrorCode } {
  let subtotalSom = 0;
  const lines: ValidatedLine[] = [];

  for (const item of payload.items) {
    const menu = menuItems.find((m) => m.id === item.menu_item_id && m.isAvailable);
    if (!menu) return { ok: false, errorCode: 'menuItemUnavailable' };
    if (item.quantity <= 0) return { ok: false, errorCode: 'invalidQuantity' };

    const validated = validateModifiersAndUnitPrice(menu, item.modifiers_snapshot);
    if (!validated.ok) return validated;

    subtotalSom += validated.unitPriceSom * item.quantity;
    lines.push({
      menuItemId: menu.id,
      unitPriceSom: validated.unitPriceSom,
      modifiersSnapshot: validated.modifiersSnapshot,
      quantity: item.quantity,
    });
  }

  if (subtotalSom === 0) return { ok: false, errorCode: 'cartEmpty' };

  let discountSom = 0;
  if (payload.discount_mode === 'promo' && payload.promo_code_id) {
    const promo = promos.find((p) => p.id === payload.promo_code_id && p.active);
    if (!promo) return { ok: false, errorCode: 'invalidPromo' };
    if (promo.maxRedemptions != null && promo.redemptionCount >= promo.maxRedemptions) {
      return { ok: false, errorCode: 'promoFullyRedeemed' };
    }
    discountSom =
      promo.type === 'percent'
        ? Math.min(subtotalSom, Math.round(subtotalSom * (promo.value / 100)))
        : Math.min(subtotalSom, promo.value);
  } else if (payload.discount_mode === 'loyalty' && payload.loyalty_blocks > 0) {
    const points = payload.loyalty_blocks * settings.loyaltyRedeemBlock;
    if (points > loyaltyBalance) return { ok: false, errorCode: 'notEnoughLoyalty' };
    discountSom = Math.min(
      subtotalSom,
      payload.loyalty_blocks * settings.loyaltyRedeemValueSom
    );
  }

  const afterDiscount = Math.max(0, subtotalSom - discountSom);
  const taxSom = calcTax(afterDiscount, settings.taxRatePercent);
  const tipSom = calcTip(afterDiscount, payload.tip_percent);
  const totalSom = afterDiscount + taxSom + tipSom;

  return {
    ok: true,
    subtotalSom,
    discountSom,
    taxSom,
    tipSom,
    totalSom,
    lines,
  };
}
