import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStripePayment } from '../hooks/useStripePayment';
import { Button } from '../components/Button';
import { Chip } from '../components/Chip';
import { useAppReservations, useAppSettings } from '../hooks/useAppData';
import { useReservationActions } from '../hooks/useAppActions';
import { createDepositHold, isStripeConfigured } from '../api/payments';
import { isSupabaseConfigured } from '../lib/env';
import { colors, spacing } from '../theme/tokens';
import { formatCents } from '../utils/money';
import { formatSlotLabel, generateSlots, isPeakSlot } from '../utils/reservations';

export function ReserveScreen() {
  const { data: settings } = useAppSettings();
  const { data: reservations = [] } = useAppReservations();
  const { createReservation } = useReservationActions();
  const { initPaymentSheet, presentPaymentSheet } = useStripePayment();
  const [party, setParty] = useState(2);
  const [selected, setSelected] = useState<Date | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [booking, setBooking] = useState(false);

  const day = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const slots = useMemo(
    () => (settings ? generateSlots(settings, day, reservations) : []),
    [settings, day, reservations]
  );

  const book = async () => {
    if (!settings || !selected) {
      setError('Pick a time slot.');
      return;
    }
    setBooking(true);
    setError('');
    try {
      const res = await createReservation(party, selected);
      if (!res.ok) {
        setError(res.error || 'Could not book.');
        return;
      }

      if (res.requiresDeposit && isSupabaseConfigured() && isStripeConfigured()) {
        const { clientSecret } = await createDepositHold(
          res.reservationId!,
          settings.peakDepositCents
        );
        const { error: initErr } = await initPaymentSheet({
          paymentIntentClientSecret: clientSecret,
          merchantDisplayName: 'Lale',
        });
        if (initErr) {
          setError(initErr.message);
          return;
        }
        const { error: presentErr } = await presentPaymentSheet();
        if (presentErr) {
          setError(presentErr.message);
          return;
        }
        setMessage(`Booked with ${formatCents(settings.peakDepositCents)} authorization hold.`);
      } else if (res.requiresDeposit) {
        setMessage(
          `Booked — peak deposit of ${formatCents(settings.peakDepositCents)} required when Stripe is configured.`
        );
      } else {
        setMessage('Table booked. We’ll remind you 2 hours before.');
      }
      setSelected(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not book.');
    } finally {
      setBooking(false);
    }
  };

  if (!settings) return null;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.eyebrow}>Tonight</Text>
        <Text style={styles.title}>Reserve</Text>
        <Text style={styles.sub}>A table at Lale · party of {party}</Text>

        <Text style={styles.section}>Party size</Text>
        <View style={styles.row}>
          {Array.from({ length: 8 }, (_, i) => i + 1).map((n) => (
            <Chip
              key={n}
              label={String(n)}
              selected={party === n}
              onPress={() => setParty(n)}
              style={styles.partyChip}
            />
          ))}
        </View>

        <Text style={styles.section}>Time</Text>
        {slots.length === 0 ? (
          <Text style={styles.empty}>No available slots today.</Text>
        ) : (
          <View style={styles.row}>
            {slots.map(({ slotStart, remaining }) => {
              const disabled = remaining <= 0;
              const peak = isPeakSlot(slotStart) && settings.peakDepositEnabled;
              const on = selected?.getTime() === slotStart.getTime();
              return (
                <Chip
                  key={slotStart.toISOString()}
                  label={formatSlotLabel(slotStart)}
                  meta={disabled ? 'Full' : peak ? 'Peak hold' : `${remaining} left`}
                  selected={on}
                  disabled={disabled}
                  onPress={() => setSelected(slotStart)}
                />
              );
            })}
          </View>
        )}

        {!!error && <Text style={styles.error}>{error}</Text>}
        {!!message && <Text style={styles.ok}>{message}</Text>}
        <Button
          label={booking ? 'Booking…' : 'Confirm reservation'}
          onPress={book}
          loading={booking}
          disabled={slots.length === 0 || booking}
          style={{ marginTop: 16 }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.stone },
  body: { padding: spacing.lg, gap: 8, paddingBottom: 48 },
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
  sub: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
    color: colors.inkMuted,
    marginBottom: 8,
  },
  section: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 11,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    color: colors.inkMuted,
    marginTop: 16,
    marginBottom: 8,
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  partyChip: { minWidth: 48, alignItems: 'center' },
  empty: {
    fontFamily: 'DMSans_400Regular',
    color: colors.inkMuted,
  },
  error: { fontFamily: 'DMSans_400Regular', color: colors.danger, marginTop: 8 },
  ok: { fontFamily: 'DMSans_400Regular', color: colors.olive, marginTop: 8 },
});
