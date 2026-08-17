import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Image } from 'expo-image';
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
import type { GuestStackParamList } from '../navigation/types';
import { useAppMenuItems } from '../hooks/useAppData';
import { useCartStore } from '../store/useCartStore';
import { colors, spacing } from '../theme/tokens';
import type { SelectedModifier } from '../types';
import { formatSom } from '../utils/money';

export function ItemDetailScreen() {
  const { t } = useTranslation();
  const route = useRoute<RouteProp<GuestStackParamList, 'ItemDetail'>>();
  const navigation = useNavigation<NativeStackNavigationProp<GuestStackParamList>>();
  const { data: menuItems = [] } = useAppMenuItems();
  const item = menuItems.find((m) => m.id === route.params.itemId);
  const addToCart = useCartStore((s) => s.addToCart);
  const [qty, setQty] = useState(1);
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [error, setError] = useState('');

  const unit = useMemo(() => {
    if (!item) return 0;
    let extra = 0;
    item.modifiers.forEach((mod) => {
      const optName = picks[mod.id];
      const opt = mod.options.find((o) => o.name === optName);
      if (opt) extra += opt.priceSom;
    });
    return item.priceSom + extra;
  }, [item, picks]);

  if (!item) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={styles.error}>{t('itemDetail.notFound')}</Text>
      </SafeAreaView>
    );
  }

  const add = () => {
    const selected: SelectedModifier[] = [];
    for (const mod of item.modifiers) {
      const optName = picks[mod.id];
      if (mod.required && !optName) {
        setError(t('itemDetail.chooseModifier', { name: mod.name }));
        return;
      }
      if (optName) {
        const opt = mod.options.find((o) => o.name === optName)!;
        selected.push({
          modifierId: mod.id,
          modifierName: mod.name,
          optionName: opt.name,
          priceSom: opt.priceSom,
        });
      }
    }
    addToCart(item, qty, selected);
    navigation.navigate('Cart');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView bounces={false}>
        <Image source={{ uri: item.imageUrl }} style={styles.hero} contentFit="cover" />
        <View style={styles.body}>
          <Text style={styles.eyebrow}>{t('itemDetail.fromKitchen')}</Text>
          <Text style={styles.name}>{item.name}</Text>
          <Text style={styles.desc}>{item.description}</Text>
          {item.allergens.length > 0 && (
            <Text style={styles.allergens}>
              {t('common.contains', { allergens: item.allergens.join(', ') })}
            </Text>
          )}

          {item.modifiers.map((mod) => (
            <View key={mod.id} style={styles.modBlock}>
              <Text style={styles.modTitle}>
                {mod.name}
                {mod.required ? ` · ${t('common.required')}` : ''}
              </Text>
              {mod.options.map((opt) => {
                const active = picks[mod.id] === opt.name;
                return (
                  <Pressable
                    key={opt.name}
                    onPress={() => setPicks((p) => ({ ...p, [mod.id]: opt.name }))}
                    style={[styles.opt, active && styles.optOn]}
                  >
                    <Text style={[styles.optText, active && styles.optTextOn]}>{opt.name}</Text>
                    {opt.priceSom > 0 && (
                      <Text style={styles.optPrice}>+{formatSom(opt.priceSom)}</Text>
                    )}
                  </Pressable>
                );
              })}
            </View>
          ))}

          <View style={styles.qtyBlock}>
            <Text style={styles.modTitle}>{t('common.quantity')}</Text>
            <QuantityStepper value={qty} onChange={setQty} />
          </View>

          {!!error && <Text style={styles.error}>{error}</Text>}
        </View>
      </ScrollView>
      <View style={styles.footer}>
        <Button
          label={
            item.isAvailable
              ? t('itemDetail.add', { amount: formatSom(unit * qty) })
              : t('common.soldOut')
          }
          onPress={add}
          disabled={!item.isAvailable}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.stone },
  hero: { width: '100%', height: 300, backgroundColor: colors.charcoal },
  body: { padding: spacing.lg, gap: 10, paddingBottom: 120 },
  eyebrow: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.olive,
  },
  name: {
    fontFamily: 'Fraunces_600SemiBold',
    fontSize: 36,
    letterSpacing: -0.6,
    color: colors.charcoal,
  },
  desc: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 16,
    lineHeight: 24,
    color: colors.inkMuted,
  },
  allergens: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    color: colors.olive,
    marginTop: 4,
  },
  modBlock: { marginTop: 18, gap: 4 },
  modTitle: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.inkMuted,
    marginBottom: 6,
  },
  opt: {
    minHeight: 52,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  optOn: { borderBottomColor: colors.pomegranate },
  optText: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 16,
    color: colors.charcoal,
  },
  optTextOn: { fontFamily: 'DMSans_500Medium' },
  optPrice: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    color: colors.olive,
  },
  qtyBlock: { marginTop: 22, gap: 10 },
  error: {
    fontFamily: 'DMSans_400Regular',
    color: colors.danger,
    marginTop: 8,
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
  },
});
