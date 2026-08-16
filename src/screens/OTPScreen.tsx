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
import { Button } from '../components/Button';
import { TextField } from '../components/TextField';
import { DEMO_ACCOUNTS } from '../data/seed';
import { simulatorActions, createSimulatorState } from '../domain/storeSimulator';
import { isSupabaseConfigured, isDev } from '../lib/env';
import { useAuth } from '../providers/AuthProvider';
import { useLocalServerStore } from '../store/useLocalServerStore';
import { colors, spacing } from '../theme/tokens';

export function OTPScreen() {
  const { sendOtp, verifyOtp } = useAuth();
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const sendCode = async () => {
    if (phone.replace(/\D/g, '').length < 10) {
      setError('Enter a valid 10-digit phone number.');
      return;
    }
    setError('');
    setSending(true);
    const res = await sendOtp(phone);
    setSending(false);
    if (!res.ok) {
      setError(res.error || 'Could not send code.');
      return;
    }
    setStep('otp');
  };

  const verify = async () => {
    setVerifying(true);
    setError('');
    const res = await verifyOtp(phone, otp, name);
    setVerifying(false);
    if (!res.ok) setError(res.error || 'Could not sign in.');
  };

  const localDevLogin = (role: 'guest' | 'staff' | 'owner') => {
    let sim = createSimulatorState();
    if (role === 'guest') {
      const r = simulatorActions.loginGuest(sim, phone || '5559998888', name || 'Guest');
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
          <Text style={styles.eyebrow}>Welcome</Text>
          <Text style={styles.brand}>Lale</Text>
          <Text style={styles.tag}>Sign in with your phone to order direct.</Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(120).duration(600)} style={styles.form}>
          {!isSupabaseConfigured() && (
            <Text style={styles.warn}>
              Supabase is not configured. Use local dev sign-in below, or add env vars for real
              phone auth.
            </Text>
          )}

          {isSupabaseConfigured() && step === 'phone' ? (
            <>
              <TextField
                label="Phone"
                keyboardType="phone-pad"
                placeholder="5551234567"
                value={phone}
                onChangeText={setPhone}
                autoFocus
              />
              <TextField
                label="Name"
                placeholder="Your name"
                value={name}
                onChangeText={setName}
                hint="First-time guests — how should we greet you?"
              />
              <Button
                label={sending ? 'Sending…' : 'Send code'}
                onPress={sendCode}
                loading={sending}
                style={{ marginTop: 8 }}
              />
            </>
          ) : isSupabaseConfigured() ? (
            <>
              <TextField
                label="One-time code"
                keyboardType="number-pad"
                placeholder="••••••"
                value={otp}
                onChangeText={setOtp}
                autoFocus
              />
              <Button
                label={verifying ? 'Verifying…' : 'Verify & continue'}
                onPress={verify}
                loading={verifying}
                style={{ marginTop: 8 }}
              />
              <Button
                label="Change phone"
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
            <Text style={styles.demoTitle}>Local dev sign-in</Text>
            <Button label="Guest" onPress={() => localDevLogin('guest')} variant="secondary" />
            <Button
              label="Staff"
              onPress={() => localDevLogin('staff')}
              variant="secondary"
              style={{ marginTop: 8 }}
            />
            <Button
              label="Owner"
              onPress={() => localDevLogin('owner')}
              variant="secondary"
              style={{ marginTop: 8 }}
            />
          </View>
        )}

        {isDev && isSupabaseConfigured() && (
          <View style={styles.demo}>
            <Text style={styles.demoTitle}>Staff phones (seed in DB)</Text>
            <Text style={styles.demoLine}>Staff · {DEMO_ACCOUNTS.staffPhone}</Text>
            <Text style={styles.demoLine}>Owner · {DEMO_ACCOUNTS.ownerPhone}</Text>
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
