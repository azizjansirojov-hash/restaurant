import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/Button';
import { Chip } from '../components/Chip';
import { LoyaltyRing } from '../components/LoyaltyRing';
import { TextField } from '../components/TextField';
import { useAppReservations, useAppSettings, useCurrentUser } from '../hooks/useAppData';
import { useReservationActions } from '../hooks/useAppActions';
import { useAuth } from '../providers/AuthProvider';
import { useUpdateProfile } from '../api/profile';
import { isDev, isSupabaseConfigured } from '../lib/env';
import { setAppLocale, type AppLocale } from '../i18n';
import { colors, spacing } from '../theme/tokens';
import { formatPhoneDisplay } from '../utils/phone';
import { formatSlotLabel } from '../utils/reservations';

export function ProfileScreen() {
  const { t, i18n } = useTranslation();
  const user = useCurrentUser();
  const { data: settings } = useAppSettings();
  const { data: reservations = [] } = useAppReservations();
  const { cancelGuestReservation, runReminderPass } = useReservationActions();
  const { logout } = useAuth();
  const updateProfile = useUpdateProfile();
  const [name, setName] = useState(user?.name || '');

  const locale = (i18n.language === 'ru' ? 'ru' : 'uz') as AppLocale;

  const upcoming = useMemo(
    () =>
      reservations.filter(
        (r) =>
          r.userId === user?.id &&
          (r.status === 'booked' || r.status === 'reminded') &&
          new Date(r.slotStart) > new Date()
      ),
    [reservations, user]
  );

  if (!user || !settings) return null;

  const saveName = () => {
    if (isSupabaseConfigured()) {
      updateProfile.mutate({ name: name.trim() });
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.eyebrow}>{t('profile.eyebrow')}</Text>
        <Text style={styles.title}>{t('profile.title')}</Text>
        <View style={styles.loyalty}>
          <LoyaltyRing
            balance={user.loyaltyBalance}
            block={settings.loyaltyRedeemBlock}
          />
        </View>
        <TextField label={t('profile.name')} value={name} onChangeText={setName} onBlur={saveName} />
        <Text style={styles.meta}>
          {t('profile.phone')} · {formatPhoneDisplay(user.phone)}
        </Text>

        <Text style={styles.section}>{t('profile.language')}</Text>
        <View style={styles.langRow}>
          <Chip
            label={t('profile.langUz')}
            selected={locale === 'uz'}
            onPress={() => setAppLocale('uz')}
          />
          <Chip
            label={t('profile.langRu')}
            selected={locale === 'ru'}
            onPress={() => setAppLocale('ru')}
          />
        </View>

        <Text style={styles.section}>{t('reservation.upcoming')}</Text>
        {upcoming.length === 0 ? (
          <Text style={styles.empty}>{t('reservation.noneScheduled')}</Text>
        ) : (
          upcoming.map((r) => (
            <View key={r.id} style={styles.resRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.resTitle}>
                  {t('common.partyOf', { count: r.partySize })} ·{' '}
                  {formatSlotLabel(new Date(r.slotStart), settings.timezone)}
                </Text>
                <Text style={styles.resMeta}>{t(`reservation.status.${r.status}`)}</Text>
              </View>
              <Pressable onPress={() => cancelGuestReservation(r.id)} hitSlop={8}>
                <Text style={styles.cancel}>{t('reservation.cancel')}</Text>
              </Pressable>
            </View>
          ))
        )}

        {isDev && !isSupabaseConfigured() && (
          <Button
            label={t('profile.simulateReminder')}
            variant="secondary"
            onPress={runReminderPass}
            style={{ marginTop: 24 }}
          />
        )}
        <Button label={t('profile.signOut')} variant="ghost" onPress={logout} style={{ marginTop: 16 }} />
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
    marginBottom: 8,
  },
  loyalty: { alignItems: 'center', marginVertical: 12 },
  meta: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    color: colors.inkMuted,
    marginTop: 4,
  },
  section: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 11,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    color: colors.inkMuted,
    marginTop: 28,
    marginBottom: 4,
  },
  langRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  empty: {
    fontFamily: 'DMSans_400Regular',
    color: colors.inkFaint,
  },
  resRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
  },
  resTitle: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 15,
    color: colors.charcoal,
  },
  resMeta: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 12,
    color: colors.olive,
    textTransform: 'capitalize',
  },
  cancel: {
    fontFamily: 'DMSans_500Medium',
    color: colors.pomegranate,
    fontSize: 14,
  },
});
