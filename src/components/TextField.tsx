import React from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
} from 'react-native';
import { colors, minTap, spacing } from '../theme/tokens';

interface Props extends TextInputProps {
  label?: string;
  hint?: string;
  error?: string;
}

export function TextField({ label, hint, error, style, ...rest }: Props) {
  return (
    <View style={styles.wrap}>
      {!!label && <Text style={styles.label}>{label}</Text>}
      <TextInput
        placeholderTextColor={colors.inkFaint}
        style={[styles.input, error && styles.inputError, style]}
        {...rest}
      />
      {!!error && <Text style={styles.error}>{error}</Text>}
      {!error && !!hint && <Text style={styles.hint}>{hint}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  label: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.inkMuted,
  },
  input: {
    minHeight: minTap,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
    fontFamily: 'DMSans_400Regular',
    fontSize: 17,
    color: colors.charcoal,
    paddingVertical: 12,
  },
  inputError: { borderBottomColor: colors.danger },
  error: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    color: colors.danger,
  },
  hint: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 12,
    color: colors.inkFaint,
  },
});
