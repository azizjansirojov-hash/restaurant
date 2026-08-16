import { Image } from 'expo-image';
import React from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';
import { colors, radii, spacing } from '../theme/tokens';
import type { MenuItem } from '../types';
import { formatCents } from '../utils/money';
import { Button } from './Button';

interface Props {
  visible: boolean;
  items: MenuItem[];
  onAdd: (item: MenuItem) => void;
  onContinue: () => void;
}

export function UpsellSheet({ visible, items, onAdd, onContinue }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.backdrop}>
        <Animated.View entering={FadeIn.duration(180)} style={StyleSheet.absoluteFill}>
          <Pressable style={styles.dim} onPress={onContinue} />
        </Animated.View>
        <Animated.View entering={SlideInDown.springify().damping(18)} style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.eyebrow}>Before you pay</Text>
          <Text style={styles.title}>Complete the table</Text>
          <Text style={styles.sub}>A little more for the walk home.</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.row}
          >
            {items.map((item) => (
              <Pressable
                key={item.id}
                onPress={() => onAdd(item)}
                style={styles.card}
                accessibilityRole="button"
              >
                <Image source={{ uri: item.imageUrl }} style={styles.img} contentFit="cover" />
                <View style={styles.cardBody}>
                  <Text style={styles.name}>{item.name}</Text>
                  <Text style={styles.price}>{formatCents(item.priceCents)}</Text>
                  <Text style={styles.add}>Add +</Text>
                </View>
              </Pressable>
            ))}
          </ScrollView>
          <Button label="Continue to checkout" onPress={onContinue} />
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  dim: { flex: 1, backgroundColor: colors.overlayDeep },
  sheet: {
    backgroundColor: colors.stone,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 3,
    backgroundColor: colors.hairline,
    marginBottom: 8,
  },
  eyebrow: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.olive,
  },
  title: {
    fontFamily: 'Fraunces_600SemiBold',
    fontSize: 30,
    letterSpacing: -0.5,
    color: colors.charcoal,
  },
  sub: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
    color: colors.inkMuted,
    marginBottom: 4,
  },
  row: { gap: 12, paddingVertical: 12 },
  card: {
    width: 148,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    backgroundColor: colors.cream,
    overflow: 'hidden',
  },
  img: { width: '100%', height: 110 },
  cardBody: { padding: 10, gap: 2 },
  name: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 14,
    color: colors.charcoal,
  },
  price: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    color: colors.olive,
  },
  add: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 13,
    color: colors.pomegranate,
    marginTop: 4,
  },
});
