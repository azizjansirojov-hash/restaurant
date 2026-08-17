import React, { useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import type { GuestStackParamList } from '../navigation/types';
import { useAppOrders, useAppSettings, useCurrentUser } from '../hooks/useAppData';
import { colors, spacing } from '../theme/tokens';
import { formatDateTime } from '../utils/format';
import { formatSom } from '../utils/money';

export function OrderHistoryScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<GuestStackParamList>>();
  const user = useCurrentUser();
  const { data: settings } = useAppSettings();
  const { data: orders = [] } = useAppOrders();
  const mine = useMemo(
    () => orders.filter((o) => o.userId === user?.id),
    [orders, user]
  );

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <Text style={styles.eyebrow}>{t('order.historyEyebrow')}</Text>
      <Text style={styles.title}>{t('order.historyTitle')}</Text>
      <FlatList
        data={mine}
        keyExtractor={(o) => o.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.empty}>{t('order.historyEmpty')}</Text>
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.row}
            onPress={() => navigation.navigate('OrderStatus', { orderId: item.id })}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.status}>{t(`order.status.${item.status}`)}</Text>
              <Text style={styles.date}>
                {formatDateTime(new Date(item.createdAt), settings?.timezone)}
              </Text>
            </View>
            <Text style={styles.total}>{formatSom(item.totalSom)}</Text>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.stone, paddingHorizontal: spacing.lg },
  eyebrow: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.olive,
    marginTop: spacing.md,
  },
  title: {
    fontFamily: 'Fraunces_600SemiBold',
    fontSize: 36,
    letterSpacing: -0.6,
    color: colors.charcoal,
    marginBottom: 8,
  },
  list: { paddingBottom: 40 },
  empty: {
    fontFamily: 'DMSans_400Regular',
    color: colors.inkMuted,
    marginTop: 32,
    lineHeight: 22,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
  },
  status: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 16,
    color: colors.charcoal,
    textTransform: 'capitalize',
  },
  date: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    color: colors.inkFaint,
    marginTop: 2,
  },
  total: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 16,
    color: colors.olive,
  },
});
