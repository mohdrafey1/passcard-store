import React, { useCallback, useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router, Stack, useFocusEffect, useLocalSearchParams, useNavigation } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { AppText } from '@/components/ui/AppText';
import { StrengthMeter, Toggle } from '@/components/ui/Controls';
import { Field } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { Sheet } from '@/components/ui/Sheet';
import { usePasswordStore } from '@/features/passwords/store';
import { useSettingsStore } from '@/features/settings/store';
import { useGeneratorBridge } from '@/features/vault/actions';
import { useDebounce } from '@/hooks/useDebounce';
import { radius, space, useTheme } from '@/theme';
import { DEFAULT_PASSWORD_OPTIONS, generatePassword } from '@/utils/password-generator';
import { measureStrength } from '@/utils/strength';

interface Form {
  title: string;
  website: string;
  username: string;
  email: string;
  password: string;
  category: string;
  favorite: boolean;
  notes: string;
}

export default function LoginEditScreen() {
  const c = useTheme();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const existing = usePasswordStore((s) => (id ? s.passwords.find((p) => p.id === id) : undefined));
  const { add, update } = usePasswordStore();
  const categories = useSettingsStore((s) => s.categories);
  const takeGenerated = useGeneratorBridge((s) => s.take);
  const navigation = useNavigation();

  const initial = useMemo<Form>(
    () => ({
      title: existing?.title ?? '',
      website: existing?.website ?? '',
      username: existing?.username ?? '',
      email: existing?.email ?? '',
      password: existing?.password ?? '',
      category: existing?.category ?? (categories.includes('Personal') ? 'Personal' : categories[0] ?? 'Other'),
      favorite: existing?.favorite ?? false,
      notes: existing?.notes ?? '',
    }),
    // Snapshot once per screen; later store updates must not reset typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const [form, setForm] = useState<Form>(initial);
  const [revealed, setRevealed] = useState(!existing);
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>({});
  const [saving, setSaving] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const set = <K extends keyof Form>(key: K, value: Form[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const dirty = (Object.keys(form) as (keyof Form)[]).some((k) => form[k] !== initial[k]);
  const debouncedPassword = useDebounce(form.password, 250);
  const strength = useMemo(
    () => measureStrength(debouncedPassword, [form.title, form.website, form.username, form.email]),
    // Inputs other than the password change rarely; recompute with it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [debouncedPassword],
  );

  // A password picked in the generator sheet.
  useFocusEffect(
    useCallback(() => {
      const value = takeGenerated();
      if (value !== null) {
        set('password', value);
        setRevealed(true);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  usePreventRemove(dirty && !saving, ({ data }) => {
    Alert.alert('Discard changes?', 'What you typed here hasn’t been saved.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => navigation.dispatch(data.action) },
    ]);
  });

  const save = useCallback(async () => {
    const title = form.title.trim() || form.website.replace(/^https?:\/\//, '').split('/')[0];
    const next: typeof errors = {};
    if (!title) next.title = 'Give it a name, or add the website.';
    if (!form.password) next.password = 'Add the password, or generate one.';
    if (Object.keys(next).length) {
      setErrors(next);
      return;
    }
    setSaving(true);
    try {
      const data = { ...form, title, website: form.website.trim(), username: form.username.trim(), email: form.email.trim() };
      if (existing) {
        await update(existing.id, data);
        router.back();
      } else {
        const created = await add({ ...data, lastUsedAt: null, passwordChangedAt: null });
        router.replace(`/login/${created.id}`);
      }
    } catch (e) {
      setSaving(false);
      Alert.alert('Not saved', e instanceof Error ? e.message : 'Try again.');
    }
  }, [add, existing, form, update]);

  return (
    <>
      <Stack.Screen
        options={{
          title: existing ? 'Edit login' : 'New login',
          headerRight: () => (
            <Pressable
              onPress={save}
              disabled={saving}
              accessibilityRole="button"
              accessibilityLabel="Save"
              style={[styles.save, { backgroundColor: c.brass, opacity: saving ? 0.5 : 1 }]}
            >
              <AppText variant="label" tone="onBrass" style={{ fontWeight: '800' }}>
                Save
              </AppText>
            </Pressable>
          ),
        }}
      />
      <KeyboardAvoidingView behavior="height" style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Field label="Name" value={form.title} onChangeText={(t) => set('title', t)} placeholder="GitHub" autoFocus={!existing} error={errors.title} />
          <Field
            label="Website"
            value={form.website}
            onChangeText={(t) => set('website', t)}
            placeholder="github.com"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
          <Field label="Username" value={form.username} onChangeText={(t) => set('username', t)} autoCapitalize="none" autoCorrect={false} placeholder="Optional" />
          <Field
            label="Email"
            value={form.email}
            onChangeText={(t) => set('email', t)}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            placeholder="Optional"
          />
          <View style={{ gap: space.sm }}>
            <Field
              label="Password"
              value={form.password}
              onChangeText={(t) => set('password', t)}
              secureTextEntry={!revealed}
              mono
              autoCapitalize="none"
              autoCorrect={false}
              error={errors.password}
              accessory={
                <>
                  <IconButton icon={revealed ? 'eye-off' : 'eye'} label={revealed ? 'Hide password' : 'Show password'} tone="ink2" onPress={() => setRevealed((r) => !r)} />
                  <IconButton
                    icon="refresh-cw"
                    label="Generate a new password"
                    tone="brass"
                    onPress={() => {
                      set('password', generatePassword(DEFAULT_PASSWORD_OPTIONS));
                      setRevealed(true);
                    }}
                  />
                </>
              }
            />
            <View style={styles.strengthLine}>
              <View style={{ flex: 1 }}>
                {form.password ? <StrengthMeter score={strength.score} label={strength.label} detail={strength.hint ?? undefined} /> : null}
              </View>
              <Pressable onPress={() => router.push('/generator?target=form')} accessibilityRole="button" style={styles.genLink} hitSlop={6}>
                <Icon name="sparkle" size={16} color={c.brassText} />
                <AppText variant="label" tone="brass" style={{ fontWeight: '800' }}>
                  Generator options
                </AppText>
              </Pressable>
            </View>
          </View>

          <View style={styles.pair}>
            <View style={{ flex: 1, gap: 6 }}>
              <AppText variant="caption" tone="ink2">
                Category
              </AppText>
              <Pressable
                onPress={() => setCategoryOpen(true)}
                accessibilityRole="button"
                accessibilityLabel={`Category, ${form.category}`}
                style={[styles.select, { backgroundColor: c.surface, borderColor: c.line }]}
              >
                <AppText variant="body" style={{ flex: 1, fontWeight: '600' }} numberOfLines={1}>
                  {form.category}
                </AppText>
                <Icon name="chevron-down" size={18} color={c.muted} />
              </Pressable>
            </View>
            <View style={{ flex: 1, gap: 6 }}>
              <AppText variant="caption" tone="ink2">
                Favourite
              </AppText>
              <View style={[styles.select, { backgroundColor: c.surface, borderColor: c.line }]}>
                <AppText variant="body" tone="ink2" style={{ flex: 1 }}>
                  Pin to top
                </AppText>
                <Toggle value={form.favorite} onValueChange={(v) => set('favorite', v)} label="Favourite" />
              </View>
            </View>
          </View>

          <Field label="Notes" value={form.notes} onChangeText={(t) => set('notes', t)} multiline placeholder="Anything else worth keeping safe" />
        </ScrollView>
      </KeyboardAvoidingView>

      <Sheet
        visible={categoryOpen}
        onClose={() => setCategoryOpen(false)}
        title="Category"
        choice
        options={[
          ...categories.map((cat) => ({ label: cat, selected: cat === form.category, onPress: () => set('category', cat) })),
          { label: 'Edit categories…', icon: 'edit-2' as const, onPress: () => router.push('/settings/categories') },
        ]}
      />
    </>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.xl, gap: space.md + 2, paddingBottom: space.huge },
  save: { minHeight: 40, paddingHorizontal: space.lg + 2, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  strengthLine: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 32 },
  genLink: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 32 },
  pair: { flexDirection: 'row', gap: space.sm + 2 },
  select: { minHeight: 52, borderRadius: radius.field, borderWidth: 1, flexDirection: 'row', alignItems: 'center', paddingLeft: space.lg - 2, paddingRight: space.sm },
});
