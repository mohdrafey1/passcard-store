import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { StrengthMeter } from '@/components/ui/Controls';
import { Icon } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { DetailRow, EmptyState, Group, Monogram } from '@/components/ui/Layout';
import { Sheet } from '@/components/ui/Sheet';
import { usePasswordStore } from '@/features/passwords/store';
import { deleteWithUndo, toggleFavorite, useCopySecret } from '@/features/vault/actions';
import { counted, formatDate, relativeAge } from '@/features/vault/items';
import { radius, space, useTheme } from '@/theme';
import { sharePassword } from '@/utils/share';
import { measureStrength } from '@/utils/strength';

const REVEAL_SECONDS = 30;

function siteUrl(website: string): string | null {
  const w = website.trim();
  if (!w) return null;
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(w) ? w : `https://${w}`;
}

export default function LoginDetailScreen() {
  const c = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const entry = usePasswordStore((s) => s.passwords.find((p) => p.id === id));
  const duplicate = usePasswordStore((s) => s.duplicate);
  const copy = useCopySecret();
  const [revealed, setRevealed] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const strength = useMemo(
    () => (entry ? measureStrength(entry.password, [entry.title, entry.website, entry.username, entry.email]) : null),
    [entry],
  );

  // A revealed password hides itself again after a short while.
  useEffect(() => {
    if (!revealed) return;
    const t = setTimeout(() => setRevealed(false), REVEAL_SECONDS * 1000);
    return () => clearTimeout(t);
  }, [revealed]);

  if (!entry) {
    return (
      <EmptyState icon="slash" title="This login is gone" body="It was deleted or moved to Recently deleted.">
        <Button label="Back to vault" variant="secondary" onPress={() => router.back()} />
      </EmptyState>
    );
  }

  const ref = { kind: 'login' as const, id: entry.id };
  const url = siteUrl(entry.website);

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <View style={styles.headerActions}>
              <IconButton
                icon={entry.favorite ? 'star-filled' : 'star'}
                label={entry.favorite ? 'Remove from favourites' : 'Add to favourites'}
                tone={entry.favorite ? 'brass' : 'ink'}
                accessibilityState={{ selected: entry.favorite }}
                onPress={() => void toggleFavorite(ref)}
              />
              <IconButton icon="edit-2" label="Edit" onPress={() => router.push(`/login/edit?id=${entry.id}`)} />
              <IconButton icon="more-vertical" label="More actions" onPress={() => setMoreOpen(true)} />
            </View>
          ),
        }}
      />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Monogram name={entry.title} size={64} />
          <View style={{ flex: 1, gap: 4 }}>
            <AppText variant="title" accessibilityRole="header">
              {entry.title}
            </AppText>
            {url ? (
              <Pressable onPress={() => Linking.openURL(url)} accessibilityRole="link" accessibilityHint="Opens in your browser" style={styles.link}>
                <AppText variant="label" tone="brass" numberOfLines={1} style={{ flexShrink: 1 }}>
                  {entry.website}
                </AppText>
                <Icon name="external-link" size={15} color={c.brassText} />
              </Pressable>
            ) : null}
          </View>
        </View>
        <View style={styles.chips}>
          <View style={[styles.chip, { backgroundColor: c.raised }]}>
            <AppText variant="caption" tone="ink2" style={{ fontWeight: '700' }}>
              {entry.category}
            </AppText>
          </View>
          {entry.lastUsedAt ? (
            <View style={[styles.chip, { backgroundColor: c.raised }]}>
              <AppText variant="caption" tone="ink2" style={{ fontWeight: '700' }}>
                Used {relativeAge(entry.lastUsedAt)}
              </AppText>
            </View>
          ) : null}
        </View>

        <Group>
          {entry.username ? (
            <DetailRow label="Username" value={entry.username}>
              <IconButton icon="copy" tone="brass" label="Copy username" onPress={() => copy(entry.username, 'Username', ref)} />
            </DetailRow>
          ) : null}
          {entry.email ? (
            <DetailRow label="Email" value={entry.email}>
              <IconButton icon="copy" tone="brass" label="Copy email" onPress={() => copy(entry.email, 'Email', ref)} />
            </DetailRow>
          ) : null}
          <View style={{ paddingBottom: space.md }}>
            <DetailRow label="Password" value={revealed ? entry.password : '•'.repeat(Math.min(18, Math.max(8, entry.password.length)))} mono>
              <IconButton
                icon={revealed ? 'eye-off' : 'eye'}
                tone="ink2"
                label={revealed ? 'Hide password' : 'Show password'}
                onPress={() => setRevealed((r) => !r)}
              />
              <IconButton icon="copy" tone="brass" label="Copy password" onPress={() => copy(entry.password, 'Password', ref)} />
            </DetailRow>
            {strength && entry.password ? (
              <StrengthMeter
                score={strength.score}
                label={strength.label}
                detail={[counted(entry.password.length, 'character'), entry.passwordChangedAt ? `changed ${relativeAge(entry.passwordChangedAt)}` : null]
                  .filter(Boolean)
                  .join(' · ')}
              />
            ) : null}
            {strength?.hint ? (
              <AppText variant="caption" tone="warn" style={{ marginTop: space.xs }}>
                {strength.hint}
              </AppText>
            ) : null}
          </View>
        </Group>

        {entry.notes ? (
          <View style={[styles.notes, { backgroundColor: c.surface, borderColor: c.line }]}>
            <AppText variant="caption" tone="muted">
              Notes
            </AppText>
            <AppText variant="body" selectable>
              {entry.notes}
            </AppText>
          </View>
        ) : null}

        <AppText variant="caption" tone="muted">
          Added {formatDate(entry.createdAt)} · Edited {formatDate(entry.updatedAt)}
        </AppText>

        <Button
          label="Move to Recently deleted"
          variant="danger"
          icon="trash-2"
          onPress={() => {
            void deleteWithUndo(ref, entry.title);
            router.back();
          }}
        />
      </ScrollView>

      <Sheet
        visible={moreOpen}
        onClose={() => setMoreOpen(false)}
        title={entry.title}
        options={[
          { label: 'Share without password', detail: 'Name, site and username only', icon: 'share-2', onPress: () => void sharePassword(entry) },
          {
            label: 'Share with password',
            detail: 'Sends the password in plain text',
            icon: 'alert-triangle',
            onPress: () =>
              Alert.alert('Share the password?', 'It leaves the vault as plain text. Only send it to someone you trust, over an app you trust.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Share', style: 'destructive', onPress: () => void sharePassword(entry, true) },
              ]),
          },
          {
            label: 'Duplicate',
            icon: 'copy',
            onPress: async () => {
              const copyEntry = await duplicate(entry.id);
              if (copyEntry) router.replace(`/login/${copyEntry.id}`);
            },
          },
        ]}
      />
    </>
  );
}

const styles = StyleSheet.create({
  headerActions: { flexDirection: 'row', marginRight: -space.sm },
  content: { padding: space.xl, gap: space.lg, paddingBottom: space.huge },
  hero: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  link: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 32 },
  chips: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' },
  chip: { minHeight: 30, paddingHorizontal: space.md, borderRadius: 8, justifyContent: 'center' },
  notes: { borderWidth: 1, borderRadius: radius.group, padding: space.lg, gap: 4 },
});
