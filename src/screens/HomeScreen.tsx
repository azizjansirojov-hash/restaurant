import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useMemo } from 'react';
import {
  Dimensions,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { KenBurnsHero } from '../components/KenBurnsHero';
import { LoyaltyRing } from '../components/LoyaltyRing';
import { HERO_IMAGE } from '../data/seed';
import type { GuestStackParamList } from '../navigation/types';
import { useCurrentUser, useAppSettings } from '../hooks/useAppData';
import { colors, spacing } from '../theme/tokens';

const { height: SCREEN_H } = Dimensions.get('window');

export function HomeScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<GuestStackParamList>>();
  const user = useCurrentUser();
  const { data: settings } = useAppSettings();
  const heroH = useMemo(() => Math.max(SCREEN_H * 0.88, 520), []);

  return (
    <View style={styles.root}>
      <KenBurnsHero uri={HERO_IMAGE} height={heroH} />
      <View
        style={[
          styles.overlay,
          { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 28 },
        ]}
      >
        <Animated.View entering={FadeInDown.duration(700).delay(80)} style={styles.top}>
          <Text style={styles.mark}>LALE</Text>
        </Animated.View>

        <View style={styles.bottom}>
          <Animated.Text
            entering={FadeInUp.duration(700).delay(160)}
            style={styles.brand}
          >
            Lale
          </Animated.Text>
          <Animated.Text
            entering={FadeInUp.duration(700).delay(240)}
            style={styles.support}
          >
            Anatolian grill & meze — order direct.
          </Animated.Text>
          <Animated.View
            entering={FadeInUp.duration(700).delay(320)}
            style={styles.ctaBlock}
          >
            <Button
              label="Order pickup"
              onPress={() => navigation.navigate('Menu')}
              variant="cream"
              style={styles.cta}
            />
            <Pressable
              onPress={() => navigation.navigate('Reserve')}
              hitSlop={12}
              accessibilityRole="link"
              style={styles.reserveHit}
            >
              <Text style={styles.reserve}>Reserve a table</Text>
            </Pressable>
          </Animated.View>
        </View>
      </View>

      {user && settings && (
        <Animated.View
          entering={FadeInUp.delay(400)}
          style={[styles.loyaltyDock, { bottom: insets.bottom + 20 }]}
        >
          <LoyaltyRing
            balance={user.loyaltyBalance}
            block={settings.loyaltyRedeemBlock}
            size={58}
            compact
          />
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.charcoal },
  overlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
  },
  top: { alignItems: 'flex-start' },
  mark: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 11,
    letterSpacing: 3.2,
    color: colors.creamMuted,
  },
  bottom: { paddingBottom: 24, paddingRight: 88 },
  brand: {
    fontFamily: 'Fraunces_600SemiBold',
    fontSize: 72,
    lineHeight: 76,
    letterSpacing: -1.6,
    color: colors.cream,
    marginBottom: 10,
  },
  support: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 16,
    lineHeight: 24,
    color: colors.creamMuted,
    marginBottom: spacing.lg,
    maxWidth: 300,
  },
  ctaBlock: { gap: 16, maxWidth: 360 },
  cta: { alignSelf: 'stretch' },
  reserveHit: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' },
  reserve: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 15,
    color: colors.cream,
    letterSpacing: 0.2,
    textDecorationLine: 'underline',
    textDecorationColor: colors.creamMuted,
  },
  loyaltyDock: {
    position: 'absolute',
    right: 18,
    backgroundColor: colors.stone,
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
});
