import { useEffect } from 'react';
import { Tabs, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, FontSize } from '@/constants/theme';
import { useSettingsStore } from '@/features/settings/store';

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const isAuthenticated = useSettingsStore((s) => s.isAuthenticated);
  const isPinCreated = useSettingsStore((s) => s.isPinCreated);

  // When the vault locks (auto-lock, manual, etc.) the authenticated flag flips
  // to false — but nothing navigates away from the tabs on its own. Redirect to
  // the unlock screen so locking actually takes effect immediately instead of
  // only after the app is killed. Skip this when there is no PIN (e.g. a full
  // data wipe in progress), where the root redirect sends the user to setup.
  useEffect(() => {
    if (!isAuthenticated && isPinCreated) {
      router.replace('/(auth)/unlock');
    }
  }, [isAuthenticated, isPinCreated]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarStyle: {
          backgroundColor: Colors.surface,
          borderTopColor: Colors.border,
          borderTopWidth: 1,
          height: 60 + insets.bottom,
          paddingBottom: insets.bottom + 4,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontSize: FontSize.xs,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="grid-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="passwords"
        options={{
          title: 'Passwords',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="key-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="cards"
        options={{
          title: 'Cards',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="card-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
