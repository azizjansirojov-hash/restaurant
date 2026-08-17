import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/Button';
import { QuantityStepper } from '../components/QuantityStepper';
import { UpsellSheet } from '../components/UpsellSheet';
import type { GuestStackParamList } from '../navigation/types';
import { useAppMenuItems } from '../hooks/useAppData';
import { useCartStore } from '../store/useCartStore';
import { colors, spacing } from '../theme/tokens';
import { cartSubtotalSom } from '../domain/checkout';
import { formatSom } from '../utils/money';

export function CartScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<GuestStackParamList>>();
  const cart = useCartStore((s) => s.cart);
  const updateCartQty = useCartStore((s) => s.updateCartQty);
  const removeFromCart = useCartStore((s) => s.removeFromCart);
  const subtotal = cartSubtotalSom(cart);
  const { data: menuItems = [] } = useAppMenuItems();
  const addToCart = useCartStore((s) => s.addToCart);
  const markUpsellShown = useCartStore((s) => s.markUpsellShown);
  const upsellShown = useCartStore((s) => s.upsellShownForCheckout);
  const [showUpsell, setShowUpsell] = useState(false);

  const upsellItems = useMemo(
    () =>
      menuItems.filter(
        (m) => m.isAvailable && m.upsellTags.includes('complete_the_table')
      ),
    [menuItems]
  );

  const goCheckout = () => {
    if (!upsellShown) {
      setShowUpsell(true);
      return;
    }
    navigation.navigate('Checkout');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.list}>
        <Text style={styles.eyebrow}>{t('cart.eyebrow')}</Text>
        <Text style={styles.title}>{t('cart.title')}</Text>
        {cart.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.empty}>{t('cart.empty')}</Text>
            <Button label={t('cart.browseMenu')} onPress={() => navigation.navigate('Menu')} />
          </View>
        ) : (
          cart.map((c) => (
            <View key={c.key} style={styles.row}>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={styles.name}>{c.name}</Text>
                {c.selectedModifiers.map((m) => (
                  <Text key={m.modifierId + m.optionName} style={styles.mod}>
                    {m.modifierName}: {m.optionName}
                  </Text>
                ))}
                <Text style={styles.price}>{formatSom(c.unitPriceSom * c.quantity)}</Text>
                <Pressable onPress={() => removeFromCart(c.key)} hitSlop={8}>
                  <Text style={styles.remove}>{t('common.remove')}</Text>
                </Pressable>
              </View>
              <QuantityStepper
                value={c.quantity}
                min={0}
                onChange={(n) => updateCartQty(c.key, n)}
              />
            </View>
          ))
        )}
      </ScrollView>
      {cart.length > 0 && (
        <View style={styles.footer}>
          <View style={styles.subRow}>
            <Text style={styles.subLabel}>{t('cart.subtotal')}</Text>
            <Text style={styles.subValue}>{formatSom(subtotal)}</Text>
          </View>
          <Button label={t('cart.checkout')} onPress={goCheckout} />
        </View>
      )}
      <UpsellSheet
        visible={showUpsell}
        items={upsellItems}
        onAdd={(item) => addToCart(item, 1, [], true)}
        onContinue={() => {
          markUpsellShown();
          setShowUpsell(false);
          navigation.navigate('Checkout');
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.stone },
  list: { padding: spacing.lg, paddingBottom: 140 },
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
    marginBottom: spacing.md,
  },
  emptyWrap: { marginTop: 48, gap: 20 },
  empty: {
    fontFamily: 'DMSans_400Regular',
    color: colors.inkMuted,
    fontSize: 16,
  },
  row: {
    flexDirection: 'row',
    paddingVertical: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
    gap: 16,
    alignItems: 'center',
  },
  name: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 17,
    color: colors.charcoal,
  },
  mod: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 12,
    color: colors.inkFaint,
  },
  price: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 14,
    color: colors.olive,
    marginTop: 2,
  },
  remove: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    color: colors.pomegranate,
    marginTop: 4,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    backgroundColor: colors.stone,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
    gap: 14,
  },
  subRow: { flexDirection: 'row', justifyContent: 'space-between' },
  subLabel: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
    color: colors.inkMuted,
  },
  subValue: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 17,
    color: colors.charcoal,
  },
});
