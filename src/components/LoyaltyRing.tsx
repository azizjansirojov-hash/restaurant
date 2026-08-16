import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { colors } from '../theme/tokens';
import { pointsToNextBlock } from '../utils/loyalty';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface Props {
  balance: number;
  block?: number;
  size?: number;
  compact?: boolean;
}

export function LoyaltyRing({
  balance,
  block = 100,
  size = 76,
  compact = false,
}: Props) {
  const stroke = compact ? 5 : 6;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const progress =
    balance % block === 0 && balance > 0 ? 1 : (balance % block) / block;
  const anim = useSharedValue(0);

  useEffect(() => {
    anim.value = withTiming(progress, { duration: 800 });
  }, [progress, anim]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: c * (1 - anim.value),
  }));

  const toNext = pointsToNextBlock(balance, block);

  return (
    <View style={styles.wrap} accessibilityLabel={`Loyalty ${balance} points`}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={colors.hairline}
            strokeWidth={stroke}
            fill="none"
          />
          <AnimatedCircle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={colors.olive}
            strokeWidth={stroke}
            fill="none"
            strokeDasharray={`${c} ${c}`}
            animatedProps={animatedProps}
            strokeLinecap="round"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        </Svg>
        <View style={[styles.center, { width: size, height: size }]}>
          <Text style={[styles.pts, compact && styles.ptsSm]}>{balance}</Text>
          <Text style={styles.sub}>pts</Text>
        </View>
      </View>
      {!compact && (
        <Text style={styles.hint}>You’re {toNext} points from $10 off</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 10 },
  center: {
    position: 'absolute',
    top: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pts: {
    fontFamily: 'Fraunces_600SemiBold',
    fontSize: 20,
    color: colors.charcoal,
    letterSpacing: -0.3,
  },
  ptsSm: { fontSize: 16 },
  sub: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 10,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.olive,
    marginTop: -2,
  },
  hint: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    color: colors.inkMuted,
    textAlign: 'center',
    maxWidth: 160,
    lineHeight: 18,
  },
});
