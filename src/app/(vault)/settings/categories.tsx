import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, ScrollView, StyleSheet, View } from 'react-native';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { IconButton } from '@/components/ui/IconButton';
import { Group } from '@/components/ui/Layout';
import { usePasswordStore } from '@/features/passwords/store';
import { useSettingsStore } from '@/features/settings/store';
import { passwordRepository } from '@/storage/password-repository';
import { radius, space, useTheme } from '@/theme';

const FALLBACK = 'Other';

export default function CategoriesScreen() {
  const c = useTheme();
  const categories = useSettingsStore((s) => s.categories);
  const update = useSettingsStore((s) => s.update);
  const passwords = usePasswordStore((s) => s.passwords);
  const [newName, setNewName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<{ from: string; to: string } | null>(null);

  const countOf = (cat: string) => passwords.filter((p) => p.category === cat).length;
  const exists = (name: string, except?: string) =>
    categories.some((cat) => cat.toLowerCase() === name.toLowerCase() && cat !== except);

  const add = async () => {
    const name = newName.trim();
    if (!name) return;
    if (name.length > 30) return setError('Keep it under 30 characters.');
    if (exists(name)) return setError('That category already exists.');
    await update('categories', [...categories, name]);
    setNewName('');
    setError(null);
  };

  /** Move every login in `from` to `to` (re-encrypting each). */
  const moveLogins = async (from: string, to: string) => {
    // Not an edit of the login itself, so its "Edited" date stays.
    for (const p of passwords.filter((x) => x.category === from)) {
      await passwordRepository.update(p.id, { category: to }, { touch: false });
    }
    await usePasswordStore.getState().load();
  };

  const rename = async () => {
    if (!renaming) return;
    const to = renaming.to.trim();
    if (!to || to === renaming.from) return setRenaming(null);
    if (exists(to, renaming.from)) return Alert.alert('Already exists', `There's already a category called “${to}”.`);
    await moveLogins(renaming.from, to);
    await update('categories', categories.map((cat) => (cat === renaming.from ? to : cat)));
    setRenaming(null);
  };

  const remove = (cat: string) => {
    const n = countOf(cat);
    Alert.alert(`Delete “${cat}”?`, n ? `${n} login${n === 1 ? '' : 's'} will move to ${FALLBACK}.` : 'No logins use it.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await moveLogins(cat, FALLBACK);
          const next = categories.filter((x) => x !== cat);
          await update('categories', next.includes(FALLBACK) ? next : [...next, FALLBACK]);
        },
      },
    ]);
  };

  return (
    <KeyboardAvoidingView behavior="height" style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Group>
          {categories.map((cat) => (
            <View key={cat} style={styles.row}>
              <View style={{ flex: 1 }}>
                <AppText variant="body" style={{ fontWeight: '600' }}>
                  {cat}
                </AppText>
                <AppText variant="caption" tone="muted">
                  {countOf(cat)} login{countOf(cat) === 1 ? '' : 's'}
                </AppText>
              </View>
              <IconButton icon="edit-2" label={`Rename ${cat}`} tone="ink2" onPress={() => setRenaming({ from: cat, to: cat })} />
              {cat !== FALLBACK ? <IconButton icon="trash-2" label={`Delete ${cat}`} tone="danger" onPress={() => remove(cat)} /> : null}
            </View>
          ))}
        </Group>
        <Field
          label="New category"
          value={newName}
          onChangeText={(t) => {
            setNewName(t);
            setError(null);
          }}
          placeholder="Travel"
          error={error}
          onSubmitEditing={add}
          returnKeyType="done"
        />
        <Button label="Add category" icon="plus" variant="secondary" onPress={add} disabled={!newName.trim()} />
      </ScrollView>

      <Modal visible={renaming !== null} transparent animationType="fade" onRequestClose={() => setRenaming(null)}>
        <View style={[styles.scrim, { backgroundColor: c.scrim }]}>
          <View style={[styles.dialog, { backgroundColor: c.surface, borderColor: c.line }]}>
            <AppText variant="headline" accessibilityRole="header">
              Rename category
            </AppText>
            <Field
              label="Name"
              value={renaming?.to ?? ''}
              onChangeText={(t) => setRenaming((r) => (r ? { ...r, to: t } : r))}
              autoFocus
              onSubmitEditing={rename}
            />
            <View style={styles.dialogActions}>
              <Button label="Cancel" variant="quiet" onPress={() => setRenaming(null)} style={{ flex: 1 }} />
              <Button label="Rename" onPress={rename} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.xl, gap: space.md + 2, paddingBottom: space.huge },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 60, gap: space.xs },
  scrim: { flex: 1, justifyContent: 'center', padding: space.xl },
  dialog: { borderRadius: radius.group, borderWidth: 1, padding: space.xl, gap: space.lg },
  dialogActions: { flexDirection: 'row', gap: space.sm },
});
