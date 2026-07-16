import React, { useState } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, Spacing, BorderRadius } from '@/constants/theme';
import PasswordStrengthIndicator from '@/components/PasswordStrengthIndicator';
import SecureField from '@/components/SecureField';
import { usePasswordStore } from '@/features/passwords/store';
import { generatePassword } from '@/utils/password-generator';
import { DEFAULT_CATEGORIES } from '@/constants/categories';
import type { PasswordCategory } from '@/types/password';

export default function AddPasswordScreen() {
  const addPassword = usePasswordStore((s) => s.add);
  const [title, setTitle] = useState('');
  const [website, setWebsite] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [notes, setNotes] = useState('');
  const [category, setCategory] = useState<PasswordCategory>('Personal');
  const [saving, setSaving] = useState(false);
  const [revealSignal, setRevealSignal] = useState(0);

  const handleSave = async () => {
    if (!title.trim()) { Alert.alert('Error', 'Title is required'); return; }
    if (!password.trim()) { Alert.alert('Error', 'Password is required'); return; }

    setSaving(true);
    try {
      await addPassword({ title, website: website || '', username: username || '', email: email || '', password, notes: notes || '', category });
      router.back();
    } catch (e: any) {
      if (__DEV__) console.error('Password save error:', e);
      Alert.alert('Error', `Failed to save password: ${e?.message || 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleGenerate = () => {
    setPassword(generatePassword({ length: 20, includeLowercase: true, includeUppercase: true, includeNumbers: true, includeSymbols: true }));
    // Reveal the generated password so the user can see what was created.
    setRevealSignal((n) => n + 1);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="chevron-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Password</Text>
        <TouchableOpacity onPress={handleSave} disabled={saving} style={styles.saveButton} accessibilityRole="button" accessibilityLabel="Save password">
          <Text style={[styles.saveText, saving && { opacity: 0.5 }]}>Save</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.form} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <InputField label="Title *" value={title} onChangeText={setTitle} placeholder="e.g. Gmail" autoFocus />
        <InputField label="Website" value={website} onChangeText={setWebsite} placeholder="e.g. gmail.com" keyboardType="url" autoCapitalize="none" />
        <InputField label="Username" value={username} onChangeText={setUsername} placeholder="e.g. johndoe" autoCapitalize="none" />
        <InputField label="Email" value={email} onChangeText={setEmail} placeholder="e.g. john@gmail.com" keyboardType="email-address" autoCapitalize="none" />

        <SecureField label="Password *" value={password} onChangeText={setPassword} placeholder="Enter password" mono revealSignal={revealSignal} />
        <PasswordStrengthIndicator password={password} />
        <TouchableOpacity style={styles.generateButton} onPress={handleGenerate}>
          <Ionicons name="dice-outline" size={18} color={Colors.primary} />
          <Text style={styles.generateText}>Generate Strong Password</Text>
        </TouchableOpacity>

        <Text style={styles.label}>Category</Text>
        <View style={styles.categoryGrid}>
          {DEFAULT_CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[styles.categoryChip, category === cat && styles.categoryChipActive]}
              onPress={() => setCategory(cat)}
            >
              <Text style={[styles.categoryChipText, category === cat && styles.categoryChipTextActive]}>
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <InputField label="Notes" value={notes} onChangeText={setNotes} placeholder="Optional notes" multiline numberOfLines={3} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function InputField({ label, ...props }: { label: string } & React.ComponentProps<typeof TextInput>) {
  return (
    <View style={styles.fieldContainer}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, props.multiline && styles.inputMultiline]}
        placeholderTextColor={Colors.textMuted}
        {...props}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm,
  },
  backButton: { padding: Spacing.xs },
  headerTitle: { fontSize: FontSize.md, fontWeight: '600', color: Colors.text },
  saveButton: { padding: Spacing.xs },
  saveText: { fontSize: FontSize.base, fontWeight: '600', color: Colors.primary },
  form: { padding: Spacing.base, paddingBottom: Spacing['4xl'] },
  fieldContainer: { marginBottom: Spacing.base },
  label: {
    fontSize: FontSize.sm, fontWeight: '600', color: Colors.textSecondary,
    marginBottom: Spacing.xs, textTransform: 'uppercase', letterSpacing: 0.5,
  },
  input: {
    backgroundColor: Colors.inputBackground, borderRadius: BorderRadius.md,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.md, height: 48,
    fontSize: FontSize.base, color: Colors.text,
  },
  inputMultiline: { height: 90, textAlignVertical: 'top', paddingTop: Spacing.md },
  generateButton: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    marginTop: Spacing.sm, marginBottom: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  generateText: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: '600' },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.lg },
  categoryChip: {
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full, backgroundColor: Colors.surface,
    borderWidth: 1, borderColor: Colors.border,
  },
  categoryChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  categoryChipText: { fontSize: FontSize.sm, color: Colors.textSecondary },
  categoryChipTextActive: { color: Colors.white, fontWeight: '600' },
});
