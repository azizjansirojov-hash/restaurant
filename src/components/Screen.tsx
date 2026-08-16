import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing } from '../theme/tokens';

interface Props {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
  style?: ViewStyle;
  padded?: boolean;
}

export function Screen({
  children,
  title,
  subtitle,
  edges = ['top', 'bottom'],
  style,
  padded = true,
}: Props) {
  return (
    <SafeAreaView style={styles.safe} edges={edges}>
      <View style={[padded && styles.pad, style]}>
        {!!title && <Text style={styles.title}>{title}</Text>}
        {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        {children}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.stone },
  pad: { flex: 1, paddingHorizontal: spacing.lg },
  title: {
    fontFamily: 'Fraunces_600SemiBold',
    fontSize: 36,
    letterSpacing: -0.6,
    color: colors.charcoal,
    marginTop: spacing.md,
    marginBottom: 6,
  },
  subtitle: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
    lineHeight: 22,
    color: colors.inkMuted,
    marginBottom: spacing.lg,
  },
});
