import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useStripePayment } from '../hooks/useStripePayment';
import { Button } from '../components/Button';
import { Chip } from '../components/Chip';
import { useAppReservations, useAppSettings } from '../hooks/useAppData';
import { useReservationActions } from '../hooks/useAppActions';
import { createDepositHold, isStripeConfigured } from '../api/payments';
import { resolveErrorCode } from '../domain/errorCodes';
import { isSupabaseConfigured } from '../lib/env';
import { colors, spacing } from '../theme/tokens';
import { formatSom } from '../utils/money';
import { formatSlotLabel, generateSlots, isPeakSlot } from '../utils/reservations';

export function ReserveScreen() {
  const { t } = useTranslation();
  const { data: settings } = useAppSettings();
  const { data: reservations = [] } = useAppReservations();
  const { createReservation } = useReservationActions();
  const { initPaymentSheet, presentPaymentSheet } = useStripePayment();
  const [party, setParty] = useState(2);
  const [selected, setSelected] = useState<Date | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [booking, setBooking] = useState(false);

  const errLabel = (code: string) => t(`errors.${code}`, { defaultValue: t('errors.unknown') });

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
      setError(t('reservation.pickSlot'));
      return;
    }
    setBooking(true);
    setError('');
    try {
      const res = await createReservation(party, selected);
      if (!res.ok) {
        setError(res.error ? errLabel(resolveErrorCode(res.error)) : t('errors.unknown'));
        return;
      }

      if (res.requiresDeposit && isSupabaseConfigured() && isStripeConfigured()) {
        const { clientSecret } = await createDepositHold(
          res.reservationId!,
          settings.peakDepositSom
        );
        const { error: initErr } = await initPaymentSheet({
          paymentIntentClientSecret: clientSecret,
          merchantDisplayName: t('common.appName'),
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
        setMessage(
          t('reservation.bookedWithHold', { amount: formatSom(settings.peakDepositSom) })
        );
      } else if (res.requiresDeposit) {
        setMessage(
          t('reservation.bookedDepositRequired', { amount: formatSom(settings.peakDepositSom) })
        );
      } else {
        setMessage(t('reservation.bookedReminder'));
      }
      setSelected(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('errors.unknown'));
    } finally {
      setBooking(false);
    }
  };

  if (!settings) return null;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.eyebrow}>{t('reservation.eyebrow')}</Text>
        <Text style={styles.title}>{t('reservation.title')}</Text>
        <Text style={styles.sub}>{t('reservation.subtitle', { party })}</Text>

        <Text style={styles.section}>{t('reservation.partySize')}</Text>
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

        <Text style={styles.section}>{t('reservation.time')}</Text>
        {slots.length === 0 ? (
          <Text style={styles.empty}>{t('reservation.emptySlots')}</Text>
        ) : (
          <View style={styles.row}>
            {slots.map(({ slotStart, remaining }) => {
              const disabled = remaining <= 0;
              const peak = isPeakSlot(slotStart, settings.timezone) && settings.peakDepositEnabled;
              const on = selected?.getTime() === slotStart.getTime();
              return (
                <Chip
                  key={slotStart.toISOString()}
                  label={formatSlotLabel(slotStart, settings.timezone)}
                  meta={
                    disabled
                      ? t('common.full')
                      : peak
                        ? t('reservation.peakHold')
                        : t('common.left', { count: remaining })
                  }
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
          label={booking ? t('reservation.booking') : t('reservation.confirm')}
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
