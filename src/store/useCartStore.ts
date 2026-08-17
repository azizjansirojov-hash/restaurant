import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type {
  CartItem,
  DiscountMode,
  FulfillmentType,
  MenuItem,
  SelectedModifier,
} from '../types';
import { createId } from '../utils/id';
import { applyPromoCode } from '../domain/checkout';
import type { PromoCode } from '../types';

interface CartState {
  cart: CartItem[];
  fulfillmentType: FulfillmentType;
  deliveryAddress: string;
  upsellShownForCheckout: boolean;
  tipPercent: number;
  customTipPercent: string;
  discountMode: DiscountMode;
  promoCodeInput: string;
  appliedPromoId?: string;
  loyaltyBlocksToRedeem: number;

  addToCart: (item: MenuItem, qty: number, mods: SelectedModifier[], isUpsell?: boolean) => void;
  updateCartQty: (key: string, qty: number) => void;
  removeFromCart: (key: string) => void;
  clearCart: () => void;
  setFulfillmentType: (t: FulfillmentType) => void;
  setDeliveryAddress: (a: string) => void;
  markUpsellShown: () => void;
  resetCheckoutFlags: (defaultTip: number) => void;
  setTipPercent: (p: number) => void;
  setCustomTipPercent: (v: string, defaultTip: number) => void;
  applyPromo: (code: string, promos: PromoCode[]) => { ok: boolean; errorCode?: string };
  clearPromo: () => void;
  setLoyaltyBlocks: (blocks: number) => void;
  clearLoyaltyRedeem: () => void;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      cart: [],
      fulfillmentType: 'pickup',
      deliveryAddress: '',
      upsellShownForCheckout: false,
      tipPercent: 0,
      customTipPercent: '',
      discountMode: 'none',
      promoCodeInput: '',
      loyaltyBlocksToRedeem: 0,

      addToCart: (item, qty, mods, isUpsell) => {
        const unit = item.priceSom + mods.reduce((s, m) => s + m.priceSom, 0);
        const entry: CartItem = {
          key: createId('cart'),
          menuItemId: item.id,
          name: item.name,
          unitPriceSom: unit,
          quantity: qty,
          selectedModifiers: mods,
          imageUrl: item.imageUrl,
          isUpsell,
        };
        set({ cart: [...get().cart, entry] });
      },

      updateCartQty: (key, qty) => {
        if (qty <= 0) {
          const cart = get().cart.filter((c) => c.key !== key);
          set({
            cart,
            upsellShownForCheckout: cart.length === 0 ? false : get().upsellShownForCheckout,
          });
          return;
        }
        set({
          cart: get().cart.map((c) => (c.key === key ? { ...c, quantity: qty } : c)),
        });
      },

      removeFromCart: (key) => {
        const cart = get().cart.filter((c) => c.key !== key);
        set({
          cart,
          upsellShownForCheckout: cart.length === 0 ? false : get().upsellShownForCheckout,
        });
      },

      clearCart: () => set({ cart: [], upsellShownForCheckout: false }),

      setFulfillmentType: (t) => set({ fulfillmentType: t }),
      setDeliveryAddress: (a) => set({ deliveryAddress: a }),
      markUpsellShown: () => set({ upsellShownForCheckout: true }),

      resetCheckoutFlags: (defaultTip) =>
        set({
          upsellShownForCheckout: false,
          discountMode: 'none',
          appliedPromoId: undefined,
          promoCodeInput: '',
          loyaltyBlocksToRedeem: 0,
          tipPercent: defaultTip,
          customTipPercent: '',
        }),

      setTipPercent: (p) => set({ tipPercent: p, customTipPercent: '' }),

      setCustomTipPercent: (v, defaultTip) => {
        const trimmed = v.trim();
        if (trimmed === '') {
          set({ customTipPercent: '', tipPercent: defaultTip });
          return;
        }
        const n = Number(trimmed);
        if (!Number.isFinite(n) || n < 0 || n > 100) {
          set({ customTipPercent: v });
          return;
        }
        set({ customTipPercent: v, tipPercent: n });
      },

      applyPromo: (code, promos) => {
        const res = applyPromoCode(code, promos);
        if (!res.ok) return res;
        const promo = promos.find((p) => p.id === res.promoId)!;
        set({
          discountMode: 'promo',
          appliedPromoId: res.promoId,
          promoCodeInput: promo.code,
          loyaltyBlocksToRedeem: 0,
        });
        return { ok: true };
      },

      clearPromo: () =>
        set({
          appliedPromoId: undefined,
          promoCodeInput: '',
          discountMode: get().loyaltyBlocksToRedeem > 0 ? 'loyalty' : 'none',
        }),

      setLoyaltyBlocks: (blocks) => {
        set({
          loyaltyBlocksToRedeem: Math.max(0, blocks),
          discountMode: blocks > 0 ? 'loyalty' : 'none',
          appliedPromoId: blocks > 0 ? undefined : get().appliedPromoId,
          promoCodeInput: blocks > 0 ? '' : get().promoCodeInput,
        });
      },

      clearLoyaltyRedeem: () =>
        set({
          loyaltyBlocksToRedeem: 0,
          discountMode: get().appliedPromoId ? 'promo' : 'none',
        }),
    }),
    {
      name: 'lale-cart',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ cart: s.cart }),
    }
  )
);
