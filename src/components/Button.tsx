import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  ViewStyle,
  TextStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { colors, minTap, radii } from '../theme/tokens';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Variant = 'primary' | 'secondary' | 'ghost' | 'olive' | 'cream';

interface Props {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  style,
  textStyle,
}: Props) {
  const scale = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const palette: Record<
    Variant,
    { bg: string; fg: string; border?: string }
  > = {
    primary: { bg: colors.pomegranate, fg: colors.cream },
    secondary: { bg: colors.charcoal, fg: colors.cream },
    olive: { bg: colors.olive, fg: colors.cream },
    cream: { bg: colors.cream, fg: colors.charcoal },
    ghost: { bg: 'transparent', fg: colors.charcoal, border: colors.hairline },
  };

  const { bg, fg, border } = palette[variant];

  return (
    <AnimatedPressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || loading}
      onPressIn={() => {
        scale.value = withSpring(0.98, { damping: 18, stiffness: 320 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 14, stiffness: 220 });
      }}
      style={[
        styles.base,
        {
          backgroundColor: bg,
          borderColor: border || 'transparent',
          borderWidth: border ? StyleSheet.hairlineWidth : 0,
          opacity: disabled ? 0.38 : 1,
        },
        variant === 'ghost' && styles.ghost,
        anim,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Text style={[styles.label, { color: fg }, textStyle]}>{label}</Text>
      )}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: minTap,
    paddingHorizontal: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.sm,
  },
  ghost: {
    alignSelf: 'flex-start',
    paddingHorizontal: 0,
    minHeight: 40,
    borderWidth: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderRadius: 0,
  },
  label: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 15,
    letterSpacing: 0.35,
  },
});
