import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Image } from 'expo-image';
import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, { FadeInRight } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { GuestStackParamList } from '../navigation/types';
import { useAppCategories, useAppMenuItems } from '../hooks/useAppData';
import { colors, minTap, spacing } from '../theme/tokens';
import { formatCents } from '../utils/money';

export function MenuScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<GuestStackParamList>>();
  const { data: categories = [] } = useAppCategories();
  const { data: menuItems = [] } = useAppMenuItems();
  const [catId, setCatId] = useState(categories[0]?.id);

  const items = useMemo(
    () =>
      menuItems
        .filter((i) => i.categoryId === catId)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [menuItems, catId]
  );

  const catName = categories.find((c) => c.id === catId)?.name;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <FlatList
        horizontal
        data={categories}
        keyExtractor={(c) => c.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.cats}
        renderItem={({ item, index }) => {
          const on = catId === item.id;
          return (
            <Animated.View entering={FadeInRight.delay(index * 40)}>
              <Pressable onPress={() => setCatId(item.id)} style={styles.catChip}>
                <Text style={[styles.catLabel, on && styles.catActive]}>{item.name}</Text>
                {on && <View style={styles.catLine} />}
              </Pressable>
            </Animated.View>
          );
        }}
      />
      <Text style={styles.section}>{catName}</Text>
      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.empty}>Nothing on this menu yet.</Text>
        }
        renderItem={({ item }) => (
          <Pressable
            disabled={!item.isAvailable}
            onPress={() => navigation.navigate('ItemDetail', { itemId: item.id })}
            style={({ pressed }) => [
              styles.row,
              !item.isAvailable && styles.unavailable,
              pressed && item.isAvailable && styles.pressed,
            ]}
          >
            <Image source={{ uri: item.imageUrl }} style={styles.thumb} contentFit="cover" />
            <View style={styles.meta}>
              <View style={styles.nameRow}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.price}>{formatCents(item.priceCents)}</Text>
              </View>
              <Text style={styles.desc} numberOfLines={2}>
                {item.isAvailable ? item.description : 'Sold out for now'}
              </Text>
            </View>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.stone },
  cats: { paddingHorizontal: spacing.lg, gap: 20, paddingTop: 8, paddingBottom: 4 },
  catChip: { minHeight: minTap, justifyContent: 'center', alignItems: 'center' },
  catLabel: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
    color: colors.inkFaint,
  },
  catActive: {
    fontFamily: 'DMSans_500Medium',
    color: colors.charcoal,
  },
  catLine: {
    marginTop: 6,
    height: 1.5,
    width: '100%',
    backgroundColor: colors.pomegranate,
  },
  section: {
    fontFamily: 'Fraunces_600SemiBold',
    fontSize: 28,
    letterSpacing: -0.4,
    color: colors.charcoal,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: 4,
  },
  list: { paddingHorizontal: spacing.lg, paddingBottom: 48 },
  row: {
    flexDirection: 'row',
    gap: 16,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
  },
  pressed: { opacity: 0.85 },
  unavailable: { opacity: 0.4 },
  thumb: { width: 92, height: 92, backgroundColor: colors.hairline },
  meta: { flex: 1, justifyContent: 'center', gap: 6 },
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'baseline',
  },
  name: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 17,
    color: colors.charcoal,
    flex: 1,
  },
  desc: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    lineHeight: 19,
    color: colors.inkMuted,
  },
  price: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 14,
    color: colors.olive,
  },
  empty: {
    fontFamily: 'DMSans_400Regular',
    color: colors.inkMuted,
    marginTop: 40,
    textAlign: 'center',
  },
});
