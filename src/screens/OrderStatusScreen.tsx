import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/Button';
import { OrderStatusStepper } from '../components/OrderStatusStepper';
import type { GuestStackParamList } from '../navigation/types';
import { useAppOrder, useAppSettings, useLastNotification } from '../hooks/useAppData';
import { colors, spacing } from '../theme/tokens';
import { formatSom } from '../utils/money';

export function OrderStatusScreen() {
  const { t } = useTranslation();
  const route = useRoute<RouteProp<GuestStackParamList, 'OrderStatus'>>();
  const navigation = useNavigation<NativeStackNavigationProp<GuestStackParamList>>();
  const order = useAppOrder(route.params.orderId);
  const { data: settings } = useAppSettings();
  const lastNotification = useLastNotification();

  if (!order || !settings) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={styles.miss}>{t('order.notFound')}</Text>
        <Button label={t('order.backHome')} onPress={() => navigation.navigate('Home')} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <Animated.View entering={FadeIn.duration(400)} style={styles.body}>
        <Text style={styles.eyebrow}>{t('order.eyebrow')}</Text>
        <Text style={styles.title}>{t('order.title')}</Text>
        <Text style={styles.meta}>
          {order.fulfillmentType === 'pickup'
            ? t('order.pickupEta', { minutes: settings.pickupEtaMinutes })
            : t('order.delivery')}
        </Text>
        <OrderStatusStepper status={order.status} />
        <View style={styles.items}>
          {order.items.map((it, i) => (
            <Text key={i} style={styles.item}>
              {it.quantity}× {it.nameSnapshot}
            </Text>
          ))}
        </View>
        <Text style={styles.total}>
          {t('order.total', { amount: formatSom(order.totalSom) })}
        </Text>
        {order.status === 'ready' && (
          <View style={styles.pushBox}>
            <Text style={styles.push}>
              {lastNotification?.title?.includes('ready')
                ? lastNotification.title
                : t('order.readyPush')}
            </Text>
          </View>
        )}
        <View style={styles.actions}>
          <Button label={t('order.history')} onPress={() => navigation.navigate('OrderHistory')} />
          <Button
            label={t('order.backHome')}
            variant="ghost"
            onPress={() => navigation.navigate('Home')}
          />
        </View>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.stone },
  body: { padding: spacing.lg, gap: 10 },
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
  meta: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
    color: colors.inkMuted,
  },
  items: {
    gap: 8,
    marginTop: 8,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
  },
  item: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 16,
    color: colors.charcoal,
  },
  total: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 18,
    color: colors.charcoal,
    marginVertical: 8,
  },
  pushBox: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: colors.cream,
    borderLeftWidth: 2,
    borderLeftColor: colors.pomegranate,
  },
  push: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 14,
    color: colors.pomegranate,
  },
  actions: { gap: 12, marginTop: 16 },
  miss: {
    fontFamily: 'DMSans_400Regular',
    color: colors.danger,
    padding: spacing.lg,
  },
});
