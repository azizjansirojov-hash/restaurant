import React from 'react';
import { Pressable, StyleSheet, Text, ViewStyle } from 'react-native';
import { colors, minTap, radii } from '../theme/tokens';

interface Props {
  label: string;
  selected?: boolean;
  onPress: () => void;
  disabled?: boolean;
  meta?: string;
  style?: ViewStyle;
}

export function Chip({ label, selected, onPress, disabled, meta, style }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.selected,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
        style,
      ]}
    >
      <Text style={[styles.label, selected && styles.labelOn]}>{label}</Text>
      {!!meta && <Text style={styles.meta}>{meta}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: minTap,
    paddingHorizontal: 14,
    paddingVertical: 10,
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    borderRadius: radii.sm,
    backgroundColor: 'transparent',
  },
  selected: {
    borderColor: colors.pomegranate,
    backgroundColor: colors.cream,
  },
  disabled: { opacity: 0.35 },
  pressed: { opacity: 0.8 },
  label: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 14,
    color: colors.charcoal,
  },
  labelOn: { color: colors.charcoal },
  meta: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 11,
    color: colors.olive,
    marginTop: 2,
  },
});
