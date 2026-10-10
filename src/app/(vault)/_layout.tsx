import { Stack } from 'expo-router';
import { FONT, useTheme } from '@/theme';

export const unstable_settings = { initialRouteName: '(tabs)' };

/** Screens above the tab bar: details, forms and settings pages, with native headers. */
export default function VaultLayout() {
  const c = useTheme();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: c.ground },
        headerTintColor: c.ink,
        headerTitleStyle: { fontFamily: FONT, fontWeight: '800', fontSize: 17, color: c.ink },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: c.ground },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="login/[id]" options={{ title: '' }} />
      <Stack.Screen name="login/edit" options={{ title: 'New login', animation: 'slide_from_bottom' }} />
      <Stack.Screen name="card/[id]" options={{ title: '' }} />
      <Stack.Screen name="card/edit" options={{ title: 'New card', animation: 'slide_from_bottom' }} />
      <Stack.Screen
        name="generator"
        options={{
          presentation: 'formSheet',
          headerShown: false,
          sheetAllowedDetents: [0.92],
          sheetCornerRadius: 28,
          contentStyle: { backgroundColor: c.surface },
        }}
      />
      <Stack.Screen name="settings/unlock-method" options={{ title: 'Unlock method' }} />
      <Stack.Screen name="settings/backup" options={{ title: 'Backup & restore' }} />
      <Stack.Screen name="settings/import" options={{ title: 'Import' }} />
      <Stack.Screen name="settings/export" options={{ title: 'Export as CSV' }} />
      <Stack.Screen name="settings/deleted" options={{ title: 'Recently deleted' }} />
      <Stack.Screen name="settings/categories" options={{ title: 'Categories' }} />
    </Stack>
  );
}
