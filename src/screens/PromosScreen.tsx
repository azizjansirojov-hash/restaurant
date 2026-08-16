import React, { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { Chip } from '../components/Chip';
import { TextField } from '../components/TextField';
import { useAppPromos } from '../hooks/useAppData';
import { useOwnerActions } from '../hooks/useAppActions';
import { useAddPromo, useTogglePromoActive } from '../api/owner';
import { isSupabaseConfigured } from '../lib/env';
import { colors, spacing } from '../theme/tokens';

export function PromosScreen() {
  const { data: promos = [] } = useAppPromos();
  const { addPromoLocal, togglePromoLocal } = useOwnerActions();
  const addPromoRemote = useAddPromo();
  const toggleRemote = useTogglePromoActive();
  const [code, setCode] = useState('');
  const [value, setValue] = useState('10');
  const [type, setType] = useState<'percent' | 'fixed'>('percent');

  const onAdd = async () => {
    if (!code.trim()) return;
    const n = Number(value);
    const promo = {
      code: code.trim().toUpperCase(),
      type,
      value: type === 'percent' ? n : Math.round(n * 100),
      active: true,
    };
    if (isSupabaseConfigured()) {
      await addPromoRemote.mutateAsync(promo);
    } else {
      addPromoLocal(promo);
    }
    setCode('');
  };

  const onToggle = async (id: string, active: boolean) => {
    if (isSupabaseConfigured()) {
      await toggleRemote.mutateAsync({ id, active: !active });
    } else {
      togglePromoLocal(id);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>Owner</Text>
        <Text style={styles.title}>Promos</Text>
      </View>
      <View style={styles.form}>
        <TextField
          label="Code"
          placeholder="CODE"
          autoCapitalize="characters"
          value={code}
          onChangeText={setCode}
        />
        <View style={styles.row}>
          <Chip label="%" selected={type === 'percent'} onPress={() => setType('percent')} />
          <Chip label="$ off" selected={type === 'fixed'} onPress={() => setType('fixed')} />
        </View>
        <TextField
          label="Value"
          placeholder={type === 'percent' ? '10' : '5'}
          keyboardType="decimal-pad"
          value={value}
          onChangeText={setValue}
        />
        <Button label="Add promo" onPress={onAdd} />
      </View>
      <FlatList
        data={promos}
        keyExtractor={(p) => p.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Pressable style={styles.rowItem} onPress={() => onToggle(item.id, item.active)}>
            <View style={{ flex: 1 }}>
              <Text style={styles.code}>{item.code}</Text>
              <Text style={styles.meta}>
                {item.type === 'percent' ? `${item.value}%` : `$${(item.value / 100).toFixed(0)}`} ·{' '}
                {item.active ? 'Active' : 'Off'} · used {item.redemptionCount}
              </Text>
            </View>
            <Text style={styles.toggle}>{item.active ? 'Disable' : 'Enable'}</Text>
          </Pressable>
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
  form: { padding: spacing.lg, gap: 12 },
  row: { flexDirection: 'row', gap: 8 },
  list: { paddingHorizontal: spacing.lg },
  rowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
  },
  code: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 16,
    color: colors.charcoal,
  },
  meta: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    color: colors.olive,
    marginTop: 2,
  },
  toggle: {
    fontFamily: 'DMSans_500Medium',
    color: colors.pomegranate,
    fontSize: 13,
  },
});
