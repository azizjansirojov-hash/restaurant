import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { TextField } from '../components/TextField';
import { useAppSettings } from '../hooks/useAppData';
import { useOwnerActions } from '../hooks/useAppActions';
import { useAuth } from '../providers/AuthProvider';
import type { DayHours } from '../types';
import { colors, spacing } from '../theme/tokens';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function SettingsScreen() {
  const { data: settings } = useAppSettings();
  const { updateSettings } = useOwnerActions();
  const { logout } = useAuth();

  const [eta, setEta] = useState('');
  const [deposit, setDeposit] = useState('');
  const [taxRate, setTaxRate] = useState('');
  const [defaultTip, setDefaultTip] = useState('');
  const [tipPresets, setTipPresets] = useState('');
  const [hoursDraft, setHoursDraft] = useState<DayHours[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!settings) return;
    setEta(String(settings.pickupEtaMinutes));
    setDeposit(String(settings.peakDepositCents / 100));
    setTaxRate(String(settings.taxRatePercent));
    setDefaultTip(String(settings.defaultTipPercent));
    setTipPresets(settings.tipPresets.join(', '));
    setHoursDraft(settings.hours);
  }, [settings]);

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    setError('');
    try {
      const presets = tipPresets
        .split(',')
        .map((s) => Number(s.trim()))
        .filter((n) => Number.isFinite(n) && n > 0);

      await updateSettings({
        pickupEtaMinutes: Number(eta) || settings.pickupEtaMinutes,
        peakDepositCents: Math.round((Number(deposit) || 25) * 100),
        taxRatePercent: Number(taxRate) || settings.taxRatePercent,
        defaultTipPercent: Number(defaultTip) || settings.defaultTipPercent,
        tipPresets: presets.length >= 3 ? presets : settings.tipPresets,
        hours: hoursDraft,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save settings.');
    } finally {
      setSaving(false);
    }
  };

  const toggleDayClosed = (day: number) => {
    setHoursDraft((prev) =>
      prev.map((h) => (h.day === day ? { ...h, closed: !h.closed } : h))
    );
  };

  const updateHourField = (day: number, field: 'open' | 'close', value: string) => {
    setHoursDraft((prev) =>
      prev.map((h) => (h.day === day ? { ...h, [field]: value } : h))
    );
  };

  if (!settings) return null;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.eyebrow}>Owner</Text>
        <Text style={styles.title}>Settings</Text>

        <Row label="Delivery enabled">
          <Switch
            value={settings.deliveryEnabled}
            onValueChange={(v) => updateSettings({ deliveryEnabled: v })}
            trackColor={{ true: colors.olive, false: colors.hairline }}
            thumbColor={colors.cream}
          />
        </Row>
        <Row label="Peak deposit (Fri–Sat 5–9pm)">
          <Switch
            value={settings.peakDepositEnabled}
            onValueChange={(v) => updateSettings({ peakDepositEnabled: v })}
            trackColor={{ true: colors.olive, false: colors.hairline }}
            thumbColor={colors.cream}
          />
        </Row>

        <TextField label="Pickup ETA (minutes)" keyboardType="number-pad" value={eta} onChangeText={setEta} />
        <TextField label="Peak deposit ($)" keyboardType="decimal-pad" value={deposit} onChangeText={setDeposit} />
        <TextField label="Tax rate (%)" keyboardType="decimal-pad" value={taxRate} onChangeText={setTaxRate} />
        <TextField label="Default tip (%)" keyboardType="number-pad" value={defaultTip} onChangeText={setDefaultTip} />
        <TextField
          label="Tip presets (comma-separated %)"
          placeholder="15, 18, 20"
          value={tipPresets}
          onChangeText={setTipPresets}
        />

        <Text style={styles.section}>Hours</Text>
        {hoursDraft.map((h) => (
          <View key={h.day} style={styles.hourRow}>
            <Text style={styles.dayLabel}>{DAY_LABELS[h.day]}</Text>
            <Switch
              value={!h.closed}
              onValueChange={() => toggleDayClosed(h.day)}
              trackColor={{ true: colors.olive, false: colors.hairline }}
              thumbColor={colors.cream}
            />
            {!h.closed && (
              <View style={styles.hourFields}>
                <TextField
                  label="Open"
                  value={h.open}
                  onChangeText={(v) => updateHourField(h.day, 'open', v)}
                  style={{ flex: 1 }}
                />
                <TextField
                  label="Close"
                  value={h.close}
                  onChangeText={(v) => updateHourField(h.day, 'close', v)}
                  style={{ flex: 1 }}
                />
              </View>
            )}
          </View>
        ))}

        <Text style={styles.meta}>{settings.address}</Text>
        {!!error && <Text style={styles.error}>{error}</Text>}
        <Button label={saving ? 'Saving…' : 'Save'} onPress={save} loading={saving} style={{ marginTop: 20 }} />
        <Button label="Sign out" variant="ghost" onPress={logout} style={{ marginTop: 14 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.stone },
  body: { padding: spacing.lg, gap: 12 },
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
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 56,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
  },
  rowLabel: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
    color: colors.charcoal,
    flex: 1,
    paddingRight: 12,
  },
  section: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 11,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    color: colors.inkMuted,
    marginTop: 12,
  },
  hourRow: {
    gap: 8,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
  },
  dayLabel: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 15,
    color: colors.charcoal,
  },
  hourFields: { flexDirection: 'row', gap: 8 },
  meta: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    color: colors.inkMuted,
  },
  error: {
    fontFamily: 'DMSans_400Regular',
    color: colors.danger,
    fontSize: 14,
  },
});
