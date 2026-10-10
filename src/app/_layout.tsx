import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import * as Updates from 'expo-updates';
import { usePreventScreenCapture } from 'expo-screen-capture';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { ToastHost } from '@/components/ui/Toast';
import { EmptyState } from '@/components/ui/Layout';
import { useSettingsStore } from '@/features/settings/store';
import { useAutoLock } from '@/hooks/useAutoLock';
import { radius, space, useTheme } from '@/theme';
import { purgeExportCache } from '@/utils/cache';

SplashScreen.preventAutoHideAsync().catch(() => {});

/**
 * FLAG_SECURE: no screenshots or recordings, and a blank app-switcher preview.
 * Release builds only, so development builds can be screenshotted for review.
 */
function ScreenCaptureGuard() {
  usePreventScreenCapture();
  return null;
}

/** A downloaded over-the-air update is waiting; offer a restart. */
function UpdateBanner() {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const [ready, setReady] = useState(false);
  const [restarting, setRestarting] = useState(false);

  useEffect(() => {
    if (__DEV__) return;
    (async () => {
      try {
        const update = await Updates.checkForUpdateAsync();
        if (update.isAvailable) {
          await Updates.fetchUpdateAsync();
          setReady(true);
        }
      } catch {
        // Offline or no update: nothing to show.
      }
    })();
  }, []);

  if (!ready) return null;
  return (
    <View style={[styles.banner, { top: insets.top + space.sm, backgroundColor: c.surface, borderColor: c.line }]}>
      <Icon name="download" size={18} color={c.brassText} />
      <AppText variant="label" style={{ flex: 1 }}>
        An update is ready
      </AppText>
      <Pressable
        onPress={async () => {
          setRestarting(true);
          await Updates.reloadAsync().catch(() => setRestarting(false));
        }}
        accessibilityRole="button"
        style={[styles.bannerButton, { backgroundColor: c.brass }]}
      >
        {restarting ? (
          <ActivityIndicator color={c.onBrass} />
        ) : (
          <AppText variant="label" tone="onBrass" style={{ fontWeight: '800' }}>
            Restart
          </AppText>
        )}
      </Pressable>
    </View>
  );
}

function AppNavigator() {
  const c = useTheme();
  const hasVault = useSettingsStore((s) => s.hasVault);
  const isAuthenticated = useSettingsStore((s) => s.isAuthenticated);

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(c.ground).catch(() => {});
  }, [c.ground]);

  return (
    <>
      <StatusBar style={c.statusBar} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.ground }, animation: 'fade' }}>
        <Stack.Protected guard={!hasVault}>
          <Stack.Screen name="(onboarding)" />
        </Stack.Protected>
        <Stack.Protected guard={hasVault && !isAuthenticated}>
          <Stack.Screen name="unlock" />
        </Stack.Protected>
        <Stack.Protected guard={hasVault && isAuthenticated}>
          <Stack.Screen name="(vault)" />
        </Stack.Protected>
      </Stack>
      <UpdateBanner />
      <ToastHost />
    </>
  );
}

export default function RootLayout() {
  const c = useTheme();
  const isInitialized = useSettingsStore((s) => s.isInitialized);
  const initialize = useSettingsStore((s) => s.initialize);
  const [bootError, setBootError] = useState(false);

  useAutoLock();

  const boot = useCallback(
    () =>
      (async () => {
        purgeExportCache();
        await initialize();
      })()
        .then(
          () => setBootError(false),
          () => setBootError(true),
        )
        .finally(() => SplashScreen.hideAsync().catch(() => {})),
    [initialize],
  );

  useEffect(() => {
    boot();
  }, [boot]);

  let content: React.ReactNode;
  if (bootError) {
    content = (
      <View style={[styles.center, { backgroundColor: c.ground }]}>
        <EmptyState
          icon="alert-triangle"
          title="The vault couldn't open"
          body="Nothing was changed. Try again; if it keeps happening, restart your phone."
        >
          <Button label="Try again" onPress={boot} />
        </EmptyState>
      </View>
    );
  } else if (!isInitialized) {
    content = <View style={[styles.center, { backgroundColor: c.ground }]} />;
  } else {
    content = <AppNavigator />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: c.ground }}>
      {__DEV__ ? null : <ScreenCaptureGuard />}
      <SafeAreaProvider>{content}</SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  banner: {
    position: 'absolute',
    left: space.lg,
    right: space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingLeft: space.lg,
    paddingRight: space.sm,
    paddingVertical: space.sm,
    borderRadius: radius.field,
    borderWidth: 1,
  },
  bannerButton: {
    minHeight: 40,
    minWidth: 92,
    paddingHorizontal: space.lg,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
