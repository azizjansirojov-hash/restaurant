import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { dayAnalytics } from '../domain/analyticsService';
import {
  useAppLoyaltyLedger,
  useAppMenuItems,
  useAppOrders,
  useAppReservations,
} from '../hooks/useAppData';
import { colors, spacing } from '../theme/tokens';
import { formatSom } from '../utils/money';

export function AnalyticsScreen() {
  const { t } = useTranslation();
  const { data: orders = [] } = useAppOrders();
  const { data: reservations = [] } = useAppReservations();
  const { data: loyaltyLedger = [] } = useAppLoyaltyLedger();
  const { data: menuItems = [] } = useAppMenuItems();

  const stats = useMemo(
    () => dayAnalytics(orders, reservations, loyaltyLedger, menuItems, new Date()),
    [orders, reservations, loyaltyLedger, menuItems]
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.eyebrow}>{t('analytics.eyebrow')}</Text>
        <Text style={styles.title}>{t('analytics.title')}</Text>
        <Metric label={t('analytics.directOrders')} value={String(stats.ordersCount)} />
        <Metric label={t('analytics.gmv')} value={formatSom(stats.gmvSom)} />
        <Metric label={t('analytics.aov')} value={formatSom(stats.aovSom)} />
        <Metric label={t('analytics.tips')} value={formatSom(stats.tipTotalSom)} />
        <Metric
          label={t('analytics.upsellAttach')}
          value={`${Math.round(stats.upsellAttachRate * 100)}%`}
        />
        <Metric
          label={t('analytics.noShowRate')}
          value={`${Math.round(stats.noShowRate * 100)}%`}
        />
        <Metric label={t('analytics.loyaltyEarned')} value={`${stats.loyaltyEarned} ${t('common.pts')}`} />
        <Metric label={t('analytics.loyaltyRedeemed')} value={`${stats.loyaltyRedeemed} ${t('common.pts')}`} />
        <Metric
          label={t('analytics.repeatRate')}
          value={`${Math.round(stats.repeatRate * 100)}%`}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.stone },
  body: { padding: spacing.lg },
  eyebrow: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.olive,
  },
  title: {
    fontFamily: 'Fraunces_600SemiBold',
    fontSize: 34,
    letterSpacing: -0.5,
    color: colors.charcoal,
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
  },
  label: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
    color: colors.inkMuted,
  },
  value: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 16,
    color: colors.charcoal,
  },
});
