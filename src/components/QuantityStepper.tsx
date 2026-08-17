import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, minTap, radii } from '../theme/tokens';

interface Props {
  value: number;
  onChange: (n: number) => void;
  min?: number;
}

export function QuantityStepper({ value, onChange, min = 1 }: Props) {
  const { t } = useTranslation();

  return (
    <View style={styles.row}>
      <Pressable
        onPress={() => onChange(Math.max(min, value - 1))}
        style={styles.btn}
        accessibilityLabel={t('common.decreaseQty')}
      >
        <Text style={styles.sym}>−</Text>
      </Pressable>
      <Text style={styles.value}>{value}</Text>
      <Pressable
        onPress={() => onChange(value + 1)}
        style={styles.btn}
        accessibilityLabel={t('common.increaseQty')}
      >
        <Text style={styles.sym}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  btn: {
    width: minTap,
    height: minTap,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    borderRadius: radii.sm,
    backgroundColor: colors.cream,
  },
  sym: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 22,
    color: colors.charcoal,
    lineHeight: 24,
  },
  value: {
    fontFamily: 'Fraunces_600SemiBold',
    fontSize: 22,
    color: colors.charcoal,
    minWidth: 28,
    textAlign: 'center',
  },
});
