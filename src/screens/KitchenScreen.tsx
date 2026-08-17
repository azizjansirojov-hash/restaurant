import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/Button';
import { TextField } from '../components/TextField';
import { useCurrentUser, useAppOrders } from '../hooks/useAppData';
import { useOrderActions } from '../hooks/useAppActions';
import { useAuth } from '../providers/AuthProvider';
import { colors, spacing } from '../theme/tokens';
import type { OrderStatus } from '../types';
import { formatSom } from '../utils/money';

const NEXT_KEY: Partial<Record<OrderStatus, string>> = {
  received: 'kitchen.startPreparing',
  preparing: 'kitchen.markReady',
  ready: 'kitchen.markCompleted',
};

export function KitchenScreen() {
  const { t } = useTranslation();
  const { data: orders = [] } = useAppOrders();
  const { bumpOrderStatus, cancelOrder } = useOrderActions();
  const { logout } = useAuth();
  const user = useCurrentUser();
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [bumping, setBumping] = useState<string | null>(null);

  const today = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return orders.filter(
      (o) =>
        new Date(o.createdAt) >= start &&
        o.status !== 'cancelled' &&
        o.status !== 'completed'
    );
  }, [orders]);

  const onBump = async (orderId: string) => {
    setBumping(orderId);
    await bumpOrderStatus(orderId);
    setBumping(null);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.eyebrow}>{t('kitchen.eyebrow')}</Text>
          <Text style={styles.title}>{t('kitchen.title')}</Text>
        </View>
        {user?.role === 'staff' && (
          <Pressable onPress={logout} hitSlop={12}>
            <Text style={styles.signOut}>{t('kitchen.signOut')}</Text>
          </Pressable>
        )}
      </View>
      <FlatList
        data={today}
        keyExtractor={(o) => o.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.empty}>{t('kitchen.empty')}</Text>
        }
        renderItem={({ item }) => (
          <View style={styles.ticket}>
            <View style={styles.ticketTop}>
              <Text style={styles.status}>{t(`order.status.${item.status}`)}</Text>
              <Text style={styles.total}>{formatSom(item.totalSom)}</Text>
            </View>
            {item.items.map((it, i) => (
              <Text key={i} style={styles.line}>
                {it.quantity}× {it.nameSnapshot}
                {it.modifiersSnapshot.length
                  ? ` · ${it.modifiersSnapshot.map((m) => m.optionName).join(', ')}`
                  : ''}
              </Text>
            ))}
            {NEXT_KEY[item.status] && (
              <Button
                label={
                  bumping === item.id
                    ? t('kitchen.updating')
                    : t(NEXT_KEY[item.status]!)
                }
                onPress={() => onBump(item.id)}
                loading={bumping === item.id}
                style={{ marginTop: 14 }}
              />
            )}
            <Pressable onPress={() => setCancelId(item.id)} style={{ marginTop: 10 }}>
              <Text style={styles.cancel}>{t('kitchen.cancelOrder')}</Text>
            </Pressable>
            {cancelId === item.id && (
              <View style={{ gap: 8, marginTop: 10 }}>
                <TextField
                  label={t('kitchen.reason')}
                  placeholder={t('kitchen.reasonPlaceholder')}
                  value={reason}
                  onChangeText={setReason}
                />
                <Button
                  label={t('kitchen.confirmCancel')}
                  variant="secondary"
                  onPress={() => {
                    cancelOrder(item.id, reason || t('kitchen.cancelledByKitchen'));
                    setCancelId(null);
                    setReason('');
                  }}
                />
              </View>
            )}
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.stone },
  headerRow: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
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
  },
  signOut: {
    fontFamily: 'DMSans_500Medium',
    color: colors.pomegranate,
    fontSize: 14,
    marginTop: 8,
  },
  list: { padding: spacing.lg, paddingBottom: 40 },
  empty: {
    fontFamily: 'DMSans_400Regular',
    color: colors.inkMuted,
    marginTop: 32,
  },
  ticket: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    padding: 16,
    marginBottom: 14,
    backgroundColor: colors.cream,
  },
  ticketTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  status: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.pomegranate,
  },
  total: {
    fontFamily: 'Fraunces_600SemiBold',
    fontSize: 24,
    color: colors.charcoal,
  },
  line: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
    color: colors.charcoal,
    lineHeight: 22,
  },
  cancel: {
    fontFamily: 'DMSans_400Regular',
    color: colors.danger,
    fontSize: 13,
  },
});
