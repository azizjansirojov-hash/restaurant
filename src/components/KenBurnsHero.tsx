import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { colors } from '../theme/tokens';

interface Props {
  uri: string;
  height: number;
}

export function KenBurnsHero({ uri, height }: Props) {
  const scale = useSharedValue(1);
  const translateY = useSharedValue(0);

  useEffect(() => {
    scale.value = withRepeat(
      withTiming(1.14, { duration: 16000, easing: Easing.inOut(Easing.quad) }),
      -1,
      true
    );
    translateY.value = withRepeat(
      withTiming(-12, { duration: 16000, easing: Easing.inOut(Easing.quad) }),
      -1,
      true
    );
  }, [scale, translateY]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { translateY: translateY.value }],
  }));

  return (
    <View style={[styles.clip, { height }]}>
      <Animated.View style={[StyleSheet.absoluteFill, style]}>
        <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
      </Animated.View>
      <LinearGradient
        colors={['rgba(26,22,20,0.15)', 'rgba(26,22,20,0.25)', 'rgba(26,22,20,0.78)']}
        locations={[0, 0.4, 1]}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  clip: {
    width: '100%',
    overflow: 'hidden',
    backgroundColor: colors.charcoal,
  },
});
