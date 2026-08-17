import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useStripePayment } from '../hooks/useStripePayment';
import { Button } from '../components/Button';
import { Chip } from '../components/Chip';
import { LoyaltyRing } from '../components/LoyaltyRing';
import { TextField } from '../components/TextField';
import {
  cartSubtotalSom,
  discountSom,
  taxSom,
  tipSom,
  totalSom,
  validatePlaceOrder,
  type CheckoutInput,
} from '../domain/checkout';
import { resolveErrorCode } from '../domain/errorCodes';
import { simulatorActions } from '../domain/storeSimulator';
import { useAppPromos, useAppSettings, useCurrentUser } from '../hooks/useAppData';
import { useOrderActions } from '../hooks/useAppActions';
import { createPaymentIntent, isStripeConfigured } from '../api/payments';
import { isLocalFallbackMode } from '../lib/env';
import type { GuestStackParamList } from '../navigation/types';
import { useCartStore } from '../store/useCartStore';
import { useLocalServerStore } from '../store/useLocalServerStore';
import { colors, spacing } from '../theme/tokens';
import { maxRedeemableBlocks } from '../utils/loyalty';
import { formatSom } from '../utils/money';

type PayState = 'idle' | 'processing' | 'declined' | 'network_error';

export function CheckoutScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<GuestStackParamList>>();
  const user = useCurrentUser();
  const { data: settings } = useAppSettings();
  const { data: promos = [] } = useAppPromos();
  const { placeOrderRemote, confirmOrderPayment } = useOrderActions();
  const { initPaymentSheet, presentPaymentSheet } = useStripePayment();

  const cart = useCartStore((s) => s.cart);
  const tipPercent = useCartStore((s) => s.tipPercent);
  const setTipPercent = useCartStore((s) => s.setTipPercent);
  const setCustomTipPercent = useCartStore((s) => s.setCustomTipPercent);
  const customTipPercent = useCartStore((s) => s.customTipPercent);
  const applyPromo = useCartStore((s) => s.applyPromo);
  const clearPromo = useCartStore((s) => s.clearPromo);
  const promoCodeInput = useCartStore((s) => s.promoCodeInput);
  const discountMode = useCartStore((s) => s.discountMode);
  const setLoyaltyBlocks = useCartStore((s) => s.setLoyaltyBlocks);
  const loyaltyBlocksToRedeem = useCartStore((s) => s.loyaltyBlocksToRedeem);
  const clearLoyaltyRedeem = useCartStore((s) => s.clearLoyaltyRedeem);
  const fulfillmentType = useCartStore((s) => s.fulfillmentType);
  const setFulfillmentType = useCartStore((s) => s.setFulfillmentType);
  const deliveryAddress = useCartStore((s) => s.deliveryAddress);
  const setDeliveryAddress = useCartStore((s) => s.setDeliveryAddress);
  const appliedPromoId = useCartStore((s) => s.appliedPromoId);
  const upsellShownForCheckout = useCartStore((s) => s.upsellShownForCheckout);
  const resetCheckoutFlags = useCartStore((s) => s.resetCheckoutFlags);
  const clearCart = useCartStore((s) => s.clearCart);

  const checkoutInput: CheckoutInput = useMemo(
    () => ({
      cart,
      settings: settings!,
      user,
      fulfillmentType,
      deliveryAddress,
      upsellShownForCheckout,
      tipPercent,
      discountMode,
      appliedPromoId,
      loyaltyBlocksToRedeem,
      promos,
    }),
    [
      cart,
      settings,
      user,
      fulfillmentType,
      deliveryAddress,
      upsellShownForCheckout,
      tipPercent,
      discountMode,
      appliedPromoId,
      loyaltyBlocksToRedeem,
      promos,
    ]
  );

  const subtotal = cartSubtotalSom(cart);
  const discount = settings ? discountSom(checkoutInput) : 0;
  const tax = settings ? taxSom(checkoutInput) : 0;
  const tip = settings ? tipSom(checkoutInput) : 0;
  const total = settings ? totalSom(checkoutInput) : 0;

  const tipOptions = useMemo(() => {
    if (!settings) return [0];
    const presets = settings.tipPresets.filter((p) => p !== 0);
    return [0, ...presets];
  }, [settings]);

  const [promoDraft, setPromoDraft] = useState('');
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [payState, setPayState] = useState<PayState>('idle');

  const errLabel = (code: string) => t(`errors.${code}`, { defaultValue: t('errors.unknown') });

  const maxBlocks = user && settings
    ? maxRedeemableBlocks(
        user.loyaltyBalance,
        settings.loyaltyRedeemBlock,
        subtotal,
        settings.loyaltyRedeemValueSom
      )
    : 0;

  const onPay = async () => {
    if (!settings) return;
    setError('');
    setPayState('processing');

    const validation = validatePlaceOrder(checkoutInput);
    if (!validation.ok) {
      setPayState('idle');
      setError(errLabel(validation.errorCode ?? 'cannotPlaceOrder'));
      return;
    }

    try {
      if (!isLocalFallbackMode()) {
        if (!isStripeConfigured()) {
          setPayState('idle');
          setError(t('errors.stripeNotConfigured'));
          return;
        }

        const payload = {
          items: cart.map((c) => ({
            menu_item_id: c.menuItemId,
            name_snapshot: c.name,
            modifiers_snapshot: c.selectedModifiers,
            quantity: c.quantity,
          })),
          fulfillment_type: fulfillmentType,
          tip_percent: tipPercent,
          discount_mode: discountMode,
          promo_code_id: appliedPromoId,
          loyalty_blocks: loyaltyBlocksToRedeem,
        };

        const created = await placeOrderRemote(payload);
        const orderId = created.order_id!;

        const { clientSecret, paymentIntentId } = await createPaymentIntent(orderId);
        const { error: initErr } = await initPaymentSheet({
          paymentIntentClientSecret: clientSecret,
          merchantDisplayName: t('common.appName'),
        });
        if (initErr) {
          setPayState('declined');
          setError(initErr.message);
          return;
        }

        const { error: presentErr } = await presentPaymentSheet();
        if (presentErr) {
          setPayState(presentErr.code === 'Failed' ? 'network_error' : 'declined');
          setError(presentErr.message);
          return;
        }

        await confirmOrderPayment(orderId, paymentIntentId);
        clearCart();
        resetCheckoutFlags(settings.defaultTipPercent);
        setPayState('idle');
        navigation.replace('OrderStatus', { orderId });
        return;
      }

      const sim = useLocalServerStore.getState().sim;
      const result = simulatorActions.placeOrder({
        ...sim,
        cart,
        fulfillmentType,
        deliveryAddress,
        upsellShownForCheckout,
        tipPercent,
        discountMode,
        appliedPromoId,
        loyaltyBlocksToRedeem,
        promoCodeInput,
        customTipPercent,
      });
      if (!result.ok) {
        setPayState('idle');
        setError(result.errorCode ? errLabel(result.errorCode as import('../domain/errorCodes').ErrorCode) : t('errors.paymentFailed'));
        return;
      }
      useLocalServerStore.setState({ sim: result.state });
      clearCart();
      resetCheckoutFlags(settings.defaultTipPercent);
      setPayState('idle');
      navigation.replace('OrderStatus', { orderId: result.orderId! });
    } catch (e) {
      setPayState('network_error');
      setError(e instanceof Error ? e.message : t('errors.paymentFailed'));
    }
  };

  if (!settings) {
    return (
      <View style={styles.boot}>
        <Text style={styles.bootText}>{t('checkout.loading')}</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.eyebrow}>{t('checkout.eyebrow')}</Text>
        <Text style={styles.title}>{t('checkout.title')}</Text>
        <Text style={styles.tagline}>{t('checkout.tagline')}</Text>

        {payState === 'processing' && (
          <View style={styles.stateBanner}>
            <Text style={styles.stateTitle}>{t('checkout.processingTitle')}</Text>
            <Text style={styles.stateBody}>{t('checkout.processingBody')}</Text>
          </View>
        )}
        {payState === 'declined' && (
          <View style={[styles.stateBanner, styles.stateError]}>
            <Text style={styles.stateTitle}>{t('checkout.declinedTitle')}</Text>
            <Text style={styles.stateBody}>{t('checkout.declinedBody')}</Text>
          </View>
        )}
        {payState === 'network_error' && (
          <View style={[styles.stateBanner, styles.stateError]}>
            <Text style={styles.stateTitle}>{t('checkout.networkTitle')}</Text>
            <Text style={styles.stateBody}>{t('checkout.networkBody')}</Text>
          </View>
        )}

        {user && (
          <View style={styles.loyalty}>
            <LoyaltyRing
              balance={user.loyaltyBalance}
              block={settings.loyaltyRedeemBlock}
            />
          </View>
        )}

        <Text style={styles.section}>{t('checkout.fulfillment')}</Text>
        <View style={styles.row}>
          <Chip
            label={t('checkout.pickupEta', { minutes: settings.pickupEtaMinutes })}
            selected={fulfillmentType === 'pickup'}
            onPress={() => setFulfillmentType('pickup')}
          />
          {settings.deliveryEnabled && (
            <Chip
              label={t('checkout.delivery')}
              selected={fulfillmentType === 'delivery'}
              onPress={() => setFulfillmentType('delivery')}
            />
          )}
        </View>
        {settings.deliveryEnabled && fulfillmentType === 'delivery' && (
          <TextField
            label={t('checkout.address')}
            placeholder={t('checkout.addressPlaceholder')}
            value={deliveryAddress}
            onChangeText={setDeliveryAddress}
          />
        )}

        <Text style={styles.section}>{t('checkout.tip')}</Text>
        <View style={styles.row}>
          {tipOptions.map((p) => (
            <Chip
              key={p}
              label={p === 0 ? t('checkout.tipNone') : t('common.percent', { value: p })}
              selected={tipPercent === p && !customTipPercent}
              onPress={() => setTipPercent(p)}
            />
          ))}
        </View>
        <TextField
          label={t('checkout.customTip')}
          placeholder={t('checkout.customTipPlaceholder')}
          keyboardType="decimal-pad"
          value={customTipPercent}
          onChangeText={(v) => setCustomTipPercent(v, settings.defaultTipPercent)}
        />

        <Text style={styles.section}>{t('checkout.promoOrLoyalty')}</Text>
        <Text style={styles.hint}>{t('checkout.promoHint')}</Text>
        <View style={[styles.row, { alignItems: 'flex-end' }]}>
          <View style={{ flex: 1 }}>
            <TextField
              label={t('checkout.promo')}
              placeholder={t('checkout.promoPlaceholder')}
              autoCapitalize="characters"
              value={promoDraft || promoCodeInput}
              onChangeText={setPromoDraft}
            />
          </View>
          <Button
            label={t('common.apply')}
            variant="secondary"
            onPress={() => {
              const res = applyPromo(promoDraft || promoCodeInput, promos);
              setNote(res.ok ? t('checkout.promoApplied') : '');
              setError(res.ok ? '' : errLabel(res.errorCode ?? 'invalidPromo'));
            }}
            style={{ marginBottom: 4 }}
          />
        </View>
        {discountMode === 'promo' && (
          <Pressable onPress={clearPromo}>
            <Text style={styles.clear}>{t('checkout.clearPromo')}</Text>
          </Pressable>
        )}

        {maxBlocks > 0 && (
          <View style={{ gap: 10, marginTop: 8 }}>
            <Text style={styles.hint}>
              {t('checkout.loyaltyHint', {
                block: settings.loyaltyRedeemBlock,
                value: formatSom(settings.loyaltyRedeemValueSom),
                max: maxBlocks,
              })}
            </Text>
            <View style={styles.row}>
              {[1, 2, 3]
                .filter((b) => b <= maxBlocks)
                .map((b) => (
                  <Chip
                    key={b}
                    label={t('checkout.loyaltyPts', { pts: b * settings.loyaltyRedeemBlock })}
                    selected={loyaltyBlocksToRedeem === b}
                    onPress={() => {
                      setLoyaltyBlocks(b);
                      setNote(t('checkout.loyaltyApplied'));
                      setError('');
                    }}
                  />
                ))}
            </View>
            {loyaltyBlocksToRedeem > 0 && (
              <Pressable onPress={clearLoyaltyRedeem}>
                <Text style={styles.clear}>{t('checkout.clearLoyalty')}</Text>
              </Pressable>
            )}
          </View>
        )}

        {!!note && <Text style={styles.note}>{note}</Text>}

        <View style={styles.totals}>
          <Line label={t('checkout.subtotal')} value={formatSom(subtotal)} />
          <Line label={t('checkout.discount')} value={`−${formatSom(discount)}`} />
          <Line label={t('checkout.tax', { rate: settings.taxRatePercent })} value={formatSom(tax)} />
          <Line label={t('checkout.tipLine', { percent: tipPercent })} value={formatSom(tip)} />
          <Line label={t('checkout.total')} value={formatSom(total)} bold />
        </View>

        {!!error && <Text style={styles.error}>{error}</Text>}
        <Button
          label={payState === 'processing' ? t('checkout.processing') : t('checkout.payNow')}
          onPress={onPay}
          loading={payState === 'processing'}
          disabled={payState === 'processing'}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function Line({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <View style={styles.line}>
      <Text style={[styles.lineLabel, bold && styles.bold]}>{label}</Text>
      <Text style={[styles.lineValue, bold && styles.bold]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.stone },
  boot: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.stone },
  bootText: { fontFamily: 'DMSans_400Regular', color: colors.inkMuted },
  body: { padding: spacing.lg, paddingBottom: 56, gap: 8 },
  eyebrow: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.olive,
  },
  title: {
    fontFamily: 'Fraunces_600SemiBold',
    fontSize: 36,
    letterSpacing: -0.6,
    color: colors.charcoal,
  },
  tagline: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
    color: colors.inkMuted,
    marginBottom: 8,
  },
  stateBanner: {
    backgroundColor: colors.cream,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.olive,
    padding: 16,
    marginVertical: 8,
  },
  stateError: { borderColor: colors.pomegranate },
  stateTitle: {
    fontFamily: 'Fraunces_600SemiBold',
    fontSize: 18,
    color: colors.charcoal,
    marginBottom: 4,
  },
  stateBody: { fontFamily: 'DMSans_400Regular', fontSize: 14, color: colors.inkMuted },
  loyalty: { alignItems: 'center', marginVertical: 12 },
  section: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 11,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    color: colors.inkMuted,
    marginTop: 18,
    marginBottom: 8,
  },
  hint: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 12,
    color: colors.inkFaint,
    marginBottom: 4,
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  clear: {
    fontFamily: 'DMSans_400Regular',
    color: colors.pomegranate,
    fontSize: 13,
    marginTop: 4,
  },
  note: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    color: colors.olive,
    marginTop: 4,
  },
  totals: {
    marginTop: 20,
    marginBottom: 16,
    gap: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
    paddingTop: 16,
  },
  line: { flexDirection: 'row', justifyContent: 'space-between' },
  lineLabel: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
    color: colors.inkMuted,
  },
  lineValue: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
    color: colors.charcoal,
  },
  bold: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 18,
    color: colors.charcoal,
  },
  error: {
    fontFamily: 'DMSans_400Regular',
    color: colors.danger,
    marginBottom: 8,
  },
});
