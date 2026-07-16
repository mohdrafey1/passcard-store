import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, Spacing, BorderRadius, Shadow } from '@/constants/theme';
import SearchBar from '@/components/SearchBar';
import VaultCard from '@/components/VaultCard';
import { passwordRepository } from '@/storage/password-repository';
import { cardRepository } from '@/storage/card-repository';
import type { PasswordEntry } from '@/types/password';
import type { CardEntry } from '@/types/card';
import { CATEGORY_ICONS } from '@/constants/categories';

interface RecentItem {
  type: 'password' | 'card';
  item: PasswordEntry | CardEntry;
  date: string;
}

export default function DashboardScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [passwordCount, setPasswordCount] = useState(0);
  const [cardCount, setCardCount] = useState(0);
  const [recentItems, setRecentItems] = useState<RecentItem[]>([]);

  // Refresh stats and recent items every time the dashboard is focused so
  // newly added or deleted entries are reflected.
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, []),
  );

  async function loadData() {
    try {
      // Only what the dashboard actually shows — counts and a few recents.
      // (The list screens load their own full data on focus.)
      const [pCount, cCount, recentPasswords, recentCards] = await Promise.all([
        passwordRepository.count(),
        cardRepository.count(),
        passwordRepository.getRecent(3),
        cardRepository.getRecent(3),
      ]);
      setPasswordCount(pCount);
      setCardCount(cCount);

      const combined: RecentItem[] = [
        ...recentPasswords.map((p) => ({ type: 'password' as const, item: p, date: p.createdAt })),
        ...recentCards.map((c) => ({ type: 'card' as const, item: c, date: c.createdAt })),
      ];
      combined.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setRecentItems(combined.slice(0, 5));
    } catch (e) {
      if (__DEV__) console.error('Failed to load dashboard data:', e);
    }
  }

  // Navigate to results only when the user submits the search, so the field
  // stays usable instead of jumping away on the first keystroke.
  const submitSearch = () => {
    const q = searchQuery.trim();
    if (q) {
      router.push({ pathname: '/(tabs)/passwords', params: { search: q } });
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Passcard Store</Text>
            <Text style={styles.subGreeting}>Your secure offline vault</Text>
          </View>
          <View style={styles.shieldIcon}>
            <Ionicons name="shield-checkmark" size={28} color={Colors.primary} />
          </View>
        </View>

        {/* Search */}
        <View style={styles.searchContainer}>
          <SearchBar
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmit={submitSearch}
            placeholder="Search passwords, cards..."
          />
        </View>

        {/* Stats Cards */}
        <View style={styles.statsRow}>
          <TouchableOpacity
            style={[styles.statCard, { borderLeftColor: Colors.primary }]}
            onPress={() => router.push('/(tabs)/passwords')}
            activeOpacity={0.7}
          >
            <View style={[styles.statIcon, { backgroundColor: Colors.primary + '20' }]}>
              <Ionicons name="key" size={24} color={Colors.primary} />
            </View>
            <Text style={styles.statCount}>{passwordCount}</Text>
            <Text style={styles.statLabel}>Passwords</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.statCard, { borderLeftColor: Colors.secondary }]}
            onPress={() => router.push('/(tabs)/cards')}
            activeOpacity={0.7}
          >
            <View style={[styles.statIcon, { backgroundColor: Colors.secondary + '20' }]}>
              <Ionicons name="card" size={24} color={Colors.secondary} />
            </View>
            <Text style={styles.statCount}>{cardCount}</Text>
            <Text style={styles.statLabel}>Cards</Text>
          </TouchableOpacity>
        </View>

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.quickActions}>
          {[
            { icon: 'key-outline' as const, label: 'Add Password', color: Colors.primary, onPress: () => router.push('/(tabs)/passwords/add') },
            { icon: 'card-outline' as const, label: 'Add Card', color: Colors.secondary, onPress: () => router.push('/(tabs)/cards/add') },
            { icon: 'download-outline' as const, label: 'Import', color: Colors.success, onPress: () => router.push('/(tabs)/settings/import') },
            { icon: 'share-outline' as const, label: 'Export', color: Colors.warning, onPress: () => router.push('/(tabs)/settings/export') },
          ].map((action, index) => (
            <TouchableOpacity
              key={index}
              style={styles.quickAction}
              onPress={action.onPress}
              activeOpacity={0.7}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: action.color + '15' }]}>
                <Ionicons name={action.icon} size={22} color={action.color} />
              </View>
              <Text style={styles.quickActionLabel}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Recently Added */}
        {recentItems.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Recently Added</Text>
            {recentItems.map((recent) => {
              if (recent.type === 'password') {
                const p = recent.item as PasswordEntry;
                return (
                  <VaultCard
                    key={p.id}
                    title={p.title}
                    subtitle={p.website || p.email}
                    leftIcon={
                      <Text style={{ fontSize: 18 }}>{CATEGORY_ICONS[p.category] || '🔒'}</Text>
                    }
                    rightText={new Date(p.createdAt).toLocaleDateString()}
                    onPress={() => router.push(`/(tabs)/passwords/${p.id}`)}
                  />
                );
              } else {
                const c = recent.item as CardEntry;
                return (
                  <VaultCard
                    key={c.id}
                    title={c.cardNickname || c.cardHolderName}
                    subtitle={`•••• ${c.cardNumber.slice(-4)}`}
                    leftIcon={<Ionicons name="card" size={20} color={Colors.secondary} />}
                    rightText={new Date(c.createdAt).toLocaleDateString()}
                    onPress={() => router.push(`/(tabs)/cards/${c.id}`)}
                  />
                );
              }
            })}
          </>
        )}

        {/* Local-only / backup notice */}
        <View style={styles.notice}>
          <View style={styles.noticeHeader}>
            <Ionicons name="lock-closed" size={18} color={Colors.success} />
            <Text style={styles.noticeTitle}>Your data stays on this device</Text>
          </View>
          <Text style={styles.noticeText}>
            Everything is encrypted and stored locally. We never upload your passwords or cards
            to any cloud or server.
          </Text>
          <Text style={styles.noticeText}>
            Before switching or resetting your phone, export a backup (CSV or .vaultx) from
            Settings — otherwise your data cannot be recovered.
          </Text>
          <TouchableOpacity
            style={styles.noticeButton}
            onPress={() => router.push('/(tabs)/settings/export')}
            activeOpacity={0.7}
          >
            <Ionicons name="shield-checkmark-outline" size={16} color={Colors.primary} />
            <Text style={styles.noticeButtonText}>Back up my vault</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    padding: Spacing.base,
    paddingBottom: Spacing['3xl'],
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
    marginTop: Spacing.sm,
  },
  greeting: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.text,
  },
  subGreeting: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  shieldIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchContainer: {
    marginBottom: Spacing.lg,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.base,
    borderWidth: 1,
    borderColor: Colors.border,
    borderLeftWidth: 3,
    ...Shadow.sm,
  },
  statIcon: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  statCount: {
    fontSize: FontSize['2xl'],
    fontWeight: '700',
    color: Colors.text,
  },
  statLabel: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  quickActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  quickAction: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.sm,
  },
  quickActionIcon: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionLabel: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.text,
    flex: 1,
  },
  notice: {
    marginTop: Spacing.xl,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.base,
  },
  noticeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  noticeTitle: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.text,
    flex: 1,
  },
  noticeText: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    lineHeight: 18,
    marginBottom: Spacing.sm,
  },
  noticeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primary + '15',
  },
  noticeButtonText: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.primary,
  },
});
