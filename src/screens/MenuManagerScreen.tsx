import React, { useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/Button';
import { TextField } from '../components/TextField';
import { useAppCategories, useAppMenuItems } from '../hooks/useAppData';
import { useOwnerActions } from '../hooks/useAppActions';
import { useDeleteMenuItem } from '../api/owner';
import { isSupabaseConfigured } from '../lib/env';
import type { MenuItem } from '../types';
import { useLocalServerStore } from '../store/useLocalServerStore';
import { colors, spacing } from '../theme/tokens';
import { formatSom } from '../utils/money';
import { createId } from '../utils/id';

export function MenuManagerScreen() {
  const { t } = useTranslation();
  const { data: menuItems = [] } = useAppMenuItems();
  const { data: categories = [] } = useAppCategories();
  const { toggleItemAvailable, updateMenuItem } = useOwnerActions();
  const deleteRemote = useDeleteMenuItem();
  const [editing, setEditing] = useState<MenuItem | null>(null);
  const [draft, setDraft] = useState<Partial<MenuItem>>({});

  const openEdit = (item: MenuItem) => {
    setEditing(item);
    setDraft({ ...item });
  };

  const openNew = () => {
    setEditing({
      id: createId('item'),
      categoryId: categories[0]?.id ?? 'cat_meze',
      name: '',
      description: '',
      priceSom: 0,
      imageUrl: '',
      allergens: [],
      modifiers: [],
      upsellTags: [],
      isAvailable: true,
      sortOrder: menuItems.length + 1,
    });
    setDraft({
      categoryId: categories[0]?.id ?? 'cat_meze',
      name: '',
      description: '',
      priceSom: 0,
      isAvailable: true,
    });
  };

  const saveItem = async () => {
    if (!editing) return;
    const item: MenuItem = {
      ...editing,
      ...draft,
      name: draft.name?.trim() || editing.name,
      description: draft.description ?? editing.description,
      priceSom: Number(draft.priceSom ?? editing.priceSom),
      categoryId: draft.categoryId ?? editing.categoryId,
    } as MenuItem;

    if (!isSupabaseConfigured() && !menuItems.some((m) => m.id === item.id)) {
      useLocalServerStore.setState((s) => ({
        sim: { ...s.sim, menuItems: [...s.sim.menuItems, item] },
      }));
    } else {
      await updateMenuItem(item);
    }
    setEditing(null);
  };

  const removeItem = async () => {
    if (!editing) return;
    if (isSupabaseConfigured()) {
      await deleteRemote.mutateAsync(editing.id);
    }
    setEditing(null);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>{t('menuManager.eyebrow')}</Text>
        <Text style={styles.title}>{t('menuManager.title')}</Text>
        <Text style={styles.sub}>{t('menuManager.subtitle')}</Text>
        <Button label={t('menuManager.addItem')} variant="secondary" onPress={openNew} style={{ marginTop: 12 }} />
      </View>
      <FlatList
        data={[...menuItems].sort((a, b) => a.sortOrder - b.sortOrder)}
        keyExtractor={(i) => i.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const cat = categories.find((c) => c.id === item.categoryId)?.name;
          return (
            <View style={styles.row}>
              <Pressable style={{ flex: 1 }} onPress={() => openEdit(item)}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.meta}>
                  {cat} · {formatSom(item.priceSom)}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => toggleItemAvailable(item.id)}
                style={[styles.toggle, !item.isAvailable && styles.toggleOff]}
              >
                <Text style={styles.toggleText}>
                  {item.isAvailable ? t('common.available') : t('menuManager.soldOut')}
                </Text>
              </Pressable>
            </View>
          );
        }}
      />

      <Modal visible={!!editing} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modal}>
          <Text style={styles.modalTitle}>
            {draft.name ? t('menuManager.editItem') : t('menuManager.newItem')}
          </Text>
          <TextField
            label={t('menuManager.name')}
            value={draft.name ?? ''}
            onChangeText={(v) => setDraft({ ...draft, name: v })}
          />
          <TextField
            label={t('menuManager.description')}
            value={draft.description ?? ''}
            onChangeText={(v) => setDraft({ ...draft, description: v })}
          />
          <TextField
            label={t('menuManager.priceSom')}
            keyboardType="number-pad"
            value={draft.priceSom != null ? String(draft.priceSom) : ''}
            onChangeText={(v) => setDraft({ ...draft, priceSom: Math.round(Number(v || 0)) })}
          />
          <Text style={styles.catLabel}>{t('menuManager.category')}</Text>
          <View style={styles.catRow}>
            {categories.map((c) => (
              <Pressable
                key={c.id}
                onPress={() => setDraft({ ...draft, categoryId: c.id })}
                style={[styles.catChip, draft.categoryId === c.id && styles.catChipOn]}
              >
                <Text style={styles.catChipText}>{c.name}</Text>
              </Pressable>
            ))}
          </View>
          <Button label={t('common.save')} onPress={saveItem} style={{ marginTop: 16 }} />
          {editing && menuItems.some((m) => m.id === editing.id) && isSupabaseConfigured() && (
            <Button label={t('common.delete')} variant="ghost" onPress={removeItem} style={{ marginTop: 8 }} />
          )}
          <Button label={t('common.cancel')} variant="ghost" onPress={() => setEditing(null)} style={{ marginTop: 8 }} />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.stone },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  eyebrow: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.olive,
  },
  title: {
    fontFamily: 'Fraunces_600SemiBold',
    fontSize: 34,
    letterSpacing: -0.5,
    color: colors.charcoal,
  },
  sub: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    color: colors.inkMuted,
    marginTop: 4,
  },
  list: { padding: spacing.lg },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
    gap: 12,
  },
  name: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 16,
    color: colors.charcoal,
  },
  meta: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    color: colors.olive,
    marginTop: 2,
  },
  toggle: {
    minHeight: 44,
    paddingHorizontal: 12,
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.olive,
  },
  toggleOff: { borderColor: colors.pomegranate },
  toggleText: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 13,
    color: colors.charcoal,
  },
  modal: { flex: 1, padding: spacing.lg, backgroundColor: colors.stone, gap: 10 },
  modalTitle: {
    fontFamily: 'Fraunces_600SemiBold',
    fontSize: 28,
    color: colors.charcoal,
    marginBottom: 8,
  },
  catLabel: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 11,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    color: colors.inkMuted,
    marginTop: 8,
  },
  catRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
  },
  catChipOn: { borderColor: colors.pomegranate, backgroundColor: colors.cream },
  catChipText: { fontFamily: 'DMSans_400Regular', fontSize: 13, color: colors.charcoal },
});
