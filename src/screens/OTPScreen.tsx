import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/Button';
import { TextField } from '../components/TextField';
import { DEMO_ACCOUNTS } from '../data/seed';
import { simulatorActions, createSimulatorState } from '../domain/storeSimulator';
import { isSupabaseConfigured, isDev } from '../lib/env';
import { useAuth } from '../providers/AuthProvider';
import { useLocalServerStore } from '../store/useLocalServerStore';
import { colors, spacing } from '../theme/tokens';
import {
  formatPhoneDisplay,
  isValidUzMobile,
  phoneInputPlaceholder,
} from '../utils/phone';

export function OTPScreen() {
  const { t } = useTranslation();
  const { sendOtp, verifyOtp } = useAuth();
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const sendCode = async () => {
    if (!isValidUzMobile(phone)) {
      setError(t('errors.invalidPhone'));
      return;
    }
    setError('');
    setSending(true);
    const res = await sendOtp(phone);
    setSending(false);
    if (!res.ok) {
      setError(res.error || t('errors.sendCodeFailed'));
      return;
    }
    setStep('otp');
  };

  const verify = async () => {
    setVerifying(true);
    setError('');
    const res = await verifyOtp(phone, otp, name);
    setVerifying(false);
    if (!res.ok) setError(res.error || t('errors.verifyFailed'));
  };

  const localDevLogin = (role: 'guest' | 'staff' | 'owner') => {
    let sim = createSimulatorState();
    if (role === 'guest') {
      const r = simulatorActions.loginGuest(sim, phone || '909998888', name || 'Guest');
      sim = r.state;
      useLocalServerStore.setState({ sim, localGuest: sim.currentUser });
    } else if (role === 'staff') {
      const r = simulatorActions.loginStaff(sim);
      useLocalServerStore.setState({ sim: r.state, localGuest: null });
    } else {
      const r = simulatorActions.loginOwner(sim);
      useLocalServerStore.setState({ sim: r.state, localGuest: null });
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.wrap}
      >
        <Animated.View entering={FadeInDown.duration(600)}>
          <Text style={styles.eyebrow}>{t('auth.eyebrow')}</Text>
          <Text style={styles.brand}>{t('common.appName')}</Text>
          <Text style={styles.tag}>{t('auth.tagline')}</Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(120).duration(600)} style={styles.form}>
          {!isSupabaseConfigured() && (
            <Text style={styles.warn}>{t('auth.supabaseWarn')}</Text>
          )}

          {isSupabaseConfigured() && step === 'phone' ? (
            <>
              <TextField
                label={t('auth.phone')}
                keyboardType="phone-pad"
                placeholder={phoneInputPlaceholder()}
                value={phone}
                onChangeText={setPhone}
                autoFocus
              />
              {phone.length > 0 && isValidUzMobile(phone) && (
                <Text style={styles.phonePreview}>{formatPhoneDisplay(phone)}</Text>
              )}
              <TextField
                label={t('auth.name')}
                placeholder={t('auth.namePlaceholder')}
                value={name}
                onChangeText={setName}
                hint={t('auth.nameHint')}
              />
              <Button
                label={sending ? t('auth.sending') : t('auth.sendCode')}
                onPress={sendCode}
                loading={sending}
                style={{ marginTop: 8 }}
              />
            </>
          ) : isSupabaseConfigured() ? (
            <>
              <Text style={styles.phonePreview}>{formatPhoneDisplay(phone)}</Text>
              <TextField
                label={t('auth.otp')}
                keyboardType="number-pad"
                placeholder={t('auth.otpPlaceholder')}
                value={otp}
                onChangeText={setOtp}
                autoFocus
              />
              <Button
                label={verifying ? t('auth.verifying') : t('auth.verify')}
                onPress={verify}
                loading={verifying}
                style={{ marginTop: 8 }}
              />
              <Button
                label={t('auth.changePhone')}
                onPress={() => setStep('phone')}
                variant="ghost"
                style={{ marginTop: 16 }}
              />
            </>
          ) : null}

          {!!error && <Text style={styles.error}>{error}</Text>}
        </Animated.View>

        {isDev && !isSupabaseConfigured() && (
          <View style={styles.demo}>
            <Text style={styles.demoTitle}>{t('auth.localDevTitle')}</Text>
            <Button label={t('auth.guest')} onPress={() => localDevLogin('guest')} variant="secondary" />
            <Button
              label={t('auth.staff')}
              onPress={() => localDevLogin('staff')}
              variant="secondary"
              style={{ marginTop: 8 }}
            />
            <Button
              label={t('auth.owner')}
              onPress={() => localDevLogin('owner')}
              variant="secondary"
              style={{ marginTop: 8 }}
            />
          </View>
        )}

        {isDev && isSupabaseConfigured() && (
          <View style={styles.demo}>
            <Text style={styles.demoTitle}>{t('auth.staffPhonesTitle')}</Text>
            <Text style={styles.demoLine}>
              {t('auth.staffPhone', { phone: formatPhoneDisplay(DEMO_ACCOUNTS.staffPhone) })}
            </Text>
            <Text style={styles.demoLine}>
              {t('auth.ownerPhone', { phone: formatPhoneDisplay(DEMO_ACCOUNTS.ownerPhone) })}
            </Text>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.stone },
  wrap: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.lg,
    justifyContent: 'space-between',
  },
  eyebrow: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.olive,
    marginBottom: 8,
  },
  brand: {
    fontFamily: 'Fraunces_600SemiBold',
    fontSize: 56,
    letterSpacing: -1.2,
    color: colors.charcoal,
    marginBottom: 10,
  },
  tag: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 16,
    lineHeight: 24,
    color: colors.inkMuted,
    maxWidth: 300,
  },
  form: { gap: 14, marginTop: spacing.xl },
  phonePreview: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 14,
    color: colors.olive,
    marginTop: -6,
  },
  warn: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    color: colors.pomegranate,
    lineHeight: 20,
    marginBottom: 8,
  },
  error: {
    marginTop: 8,
    fontFamily: 'DMSans_400Regular',
    color: colors.danger,
    fontSize: 14,
  },
  demo: {
    paddingTop: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
    gap: 4,
  },
  demoTitle: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.olive,
    marginBottom: 6,
  },
  demoLine: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    color: colors.inkMuted,
  },
});
