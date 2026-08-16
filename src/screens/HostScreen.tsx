import React, { useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { useAppReservations } from '../hooks/useAppData';
import { useReservationActions } from '../hooks/useAppActions';
import { colors, spacing } from '../theme/tokens';
import { formatSlotLabel } from '../utils/reservations';

export function HostScreen() {
  const { data: reservations = [] } = useAppReservations();
  const { updateReservationStatus } = useReservationActions();

  const tonight = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    return reservations
      .filter((r) => {
        const t = new Date(r.slotStart).getTime();
        return t >= start.getTime() && t <= end.getTime() && r.status !== 'cancelled';
      })
      .sort((a, b) => +new Date(a.slotStart) - +new Date(b.slotStart));
  }, [reservations]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>Front of house</Text>
        <Text style={styles.title}>Host</Text>
      </View>
      <FlatList
        data={tonight}
        keyExtractor={(r) => r.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.empty}>No reservations for today.</Text>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.time}>{formatSlotLabel(new Date(item.slotStart))}</Text>
            <Text style={styles.meta}>
              Party of {item.partySize} · {item.status}
            </Text>
            {(item.status === 'booked' || item.status === 'reminded') && (
              <View style={styles.actions}>
                <Button
                  label="Seated"
                  variant="olive"
                  onPress={() => updateReservationStatus(item.id, 'seated')}
                  style={{ flex: 1 }}
                />
                <Button
                  label="No-show"
                  variant="secondary"
                  onPress={() => updateReservationStatus(item.id, 'no_show')}
                  style={{ flex: 1 }}
                />
              </View>
            )}
            {(item.status === 'booked' || item.status === 'reminded') && (
              <Button
                label="Cancel"
                variant="ghost"
                onPress={() => updateReservationStatus(item.id, 'cancelled')}
                style={{ marginTop: 8 }}
              />
            )}
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.stone },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
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
  list: { padding: spacing.lg },
  empty: {
    fontFamily: 'DMSans_400Regular',
    color: colors.inkMuted,
    marginTop: 32,
  },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    padding: 16,
    marginBottom: 12,
    gap: 6,
    backgroundColor: colors.cream,
  },
  time: {
    fontFamily: 'Fraunces_600SemiBold',
    fontSize: 28,
    letterSpacing: -0.4,
    color: colors.charcoal,
  },
  meta: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    color: colors.inkMuted,
    textTransform: 'capitalize',
  },
  actions: { flexDirection: 'row', gap: 8, marginTop: 10 },
});
