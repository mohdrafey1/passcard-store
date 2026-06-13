import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, Spacing, BorderRadius } from '@/constants/theme';
import SecureField from '@/components/SecureField';
import PasswordStrengthIndicator from '@/components/PasswordStrengthIndicator';
import { usePasswordStore } from '@/features/passwords/store';
import { useSettingsStore } from '@/features/settings/store';
import { copyToClipboard } from '@/utils/clipboard';
import { sharePassword } from '@/utils/share';
import { DEFAULT_CATEGORIES } from '@/constants/categories';
import { passwordRepository } from '@/storage/password-repository';
import type { PasswordEntry, PasswordCategory } from '@/types/password';

export default function PasswordDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [entry, setEntry] = useState<PasswordEntry | null>(null);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState('');
  const [website, setWebsite] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [notes, setNotes] = useState('');
  const [category, setCategory] = useState<PasswordCategory>('Personal');
  const updatePassword = usePasswordStore((s) => s.update);
  const removePassword = usePasswordStore((s) => s.remove);
  const clipboardDuration = useSettingsStore((s) => s.clipboardClearDuration);

  useEffect(() => {
    loadEntry();
  }, [id]);

  async function loadEntry() {
    if (!id) return;
    try {
      const e = await passwordRepository.findById(id);
      if (e) {
        setEntry(e);
        setTitle(e.title); setWebsite(e.website); setUsername(e.username);
        setEmail(e.email); setPassword(e.password); setNotes(e.notes); setCategory(e.category);
      } else {
        Alert.alert('Error', 'Password not found');
        router.back();
      }
    } catch (e: any) {
      console.error('Failed to load password:', e);
      Alert.alert('Error', `Failed to open password: ${e?.message || 'Unknown error'}`);
      router.back();
    }
  }

  const handleSave = async () => {
    if (!id || !title.trim()) { Alert.alert('Error', 'Title is required'); return; }
    await updatePassword(id, { title, website, username, email, password, notes, category });
    setEditing(false);
    loadEntry();
  };

  const handleDelete = () => {
    Alert.alert('Delete Password', `Delete "${entry?.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { if (id) { await removePassword(id); router.back(); } } },
    ]);
  };

  const handleCopy = (text: string, label: string) => {
    copyToClipboard(text, clipboardDuration);
    Alert.alert('Copied', `${label} copied to clipboard`);
  };

  if (!entry) return <View style={styles.container} />;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{editing ? 'Edit Password' : 'Password Details'}</Text>
        {editing ? (
          <TouchableOpacity onPress={handleSave} style={styles.saveButton}>
            <Text style={styles.saveText}>Save</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={() => setEditing(true)} style={styles.saveButton}>
            <Ionicons name="create-outline" size={22} color={Colors.primary} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.form} showsVerticalScrollIndicator={false}>
        <DetailField label="Title" value={title} onChangeText={setTitle} editing={editing} />
        <DetailField label="Website" value={website} onChangeText={setWebsite} editing={editing} onCopy={() => handleCopy(website, 'Website')} />
        <DetailField label="Username" value={username} onChangeText={setUsername} editing={editing} onCopy={() => handleCopy(username, 'Username')} />
        <DetailField label="Email" value={email} onChangeText={setEmail} editing={editing} onCopy={() => handleCopy(email, 'Email')} />

        <SecureField label="Password" value={password} onChangeText={setPassword} editable={editing} mono copyable onCopy={() => handleCopy(password, 'Password')} />
        {editing && <PasswordStrengthIndicator password={password} />}

        {editing && (
          <>
            <Text style={styles.label}>Category</Text>
            <View style={styles.categoryGrid}>
              {DEFAULT_CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.categoryChip, category === cat && styles.categoryChipActive]}
                  onPress={() => setCategory(cat)}
                >
                  <Text style={[styles.categoryChipText, category === cat && styles.categoryChipTextActive]}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        <DetailField label="Notes" value={notes} onChangeText={setNotes} editing={editing} multiline />

        {!editing && (
          <View style={styles.actions}>
            <TouchableOpacity style={styles.actionBtn} onPress={() => entry && sharePassword(entry)}>
              <Ionicons name="share-outline" size={20} color={Colors.primary} />
              <Text style={styles.actionText}>Share</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, styles.dangerBtn]} onPress={handleDelete}>
              <Ionicons name="trash-outline" size={20} color={Colors.danger} />
              <Text style={[styles.actionText, { color: Colors.danger }]}>Delete</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function DetailField({ label, value, onChangeText, editing, onCopy, multiline }: {
  label: string; value: string; onChangeText: (t: string) => void;
  editing: boolean; onCopy?: () => void; multiline?: boolean;
}) {
  return (
    <View style={dfStyles.container}>
      <View style={dfStyles.labelRow}>
        <Text style={dfStyles.label}>{label}</Text>
        {!editing && onCopy && value && (
          <TouchableOpacity onPress={onCopy}><Ionicons name="copy-outline" size={16} color={Colors.textSecondary} /></TouchableOpacity>
        )}
      </View>
      {editing ? (
        <TextInput
          style={[dfStyles.input, multiline && dfStyles.multiline]}
          value={value} onChangeText={onChangeText}
          placeholderTextColor={Colors.textMuted} multiline={multiline}
        />
      ) : (
        <Text style={[dfStyles.value, !value && dfStyles.empty]}>{value || 'Not set'}</Text>
      )}
    </View>
  );
}

const dfStyles = StyleSheet.create({
  container: { marginBottom: Spacing.base },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.xs },
  label: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { backgroundColor: Colors.inputBackground, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: Spacing.md, height: 48, fontSize: FontSize.base, color: Colors.text },
  multiline: { height: 90, textAlignVertical: 'top', paddingTop: Spacing.md },
  value: { fontSize: FontSize.base, color: Colors.text, paddingVertical: Spacing.xs },
  empty: { color: Colors.textMuted, fontStyle: 'italic' },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm },
  backButton: { padding: Spacing.xs },
  headerTitle: { fontSize: FontSize.md, fontWeight: '600', color: Colors.text },
  saveButton: { padding: Spacing.xs },
  saveText: { fontSize: FontSize.base, fontWeight: '600', color: Colors.primary },
  form: { padding: Spacing.base, paddingBottom: Spacing['4xl'] },
  label: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textSecondary, marginBottom: Spacing.xs, textTransform: 'uppercase', letterSpacing: 0.5 },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.lg },
  categoryChip: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.full, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  categoryChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  categoryChipText: { fontSize: FontSize.sm, color: Colors.textSecondary },
  categoryChipTextActive: { color: Colors.white, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.xl },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, paddingVertical: Spacing.md, borderRadius: BorderRadius.md, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  dangerBtn: { borderColor: Colors.danger + '40' },
  actionText: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.primary },
});
