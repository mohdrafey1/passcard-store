import 'react-native-get-random-values';
import React, { useEffect, useState, useCallback } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Updates from 'expo-updates';
import { Ionicons } from '@expo/vector-icons';
import { usePreventScreenCapture } from 'expo-screen-capture';
import { useSettingsStore } from '@/features/settings/store';
import { purgeExportCache } from '@/utils/cache';
import { Colors, FontSize, Spacing } from '@/constants/theme';
import { useAutoLock } from '@/hooks/useAutoLock';

function UpdateBanner() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);

  useEffect(() => {
    if (__DEV__) return; // Skip in development
    checkForUpdate();
  }, []);

  async function checkForUpdate() {
    try {
      const update = await Updates.checkForUpdateAsync();
      if (update.isAvailable) {
        await Updates.fetchUpdateAsync();
        setUpdateAvailable(true);
      }
    } catch (e) {
      // Silently fail — don't disrupt the user
    }
  }

  const handleRestart = useCallback(async () => {
    setIsRestarting(true);
    try {
      await Updates.reloadAsync();
    } catch (e) {
      setIsRestarting(false);
    }
  }, []);

  if (!updateAvailable) return null;

  return (
    <View style={bannerStyles.container}>
      <View style={bannerStyles.content}>
        <Ionicons name="arrow-up-circle" size={18} color="#FFFFFF" />
        <Text style={bannerStyles.text}>New update available</Text>
      </View>
      <TouchableOpacity
        style={bannerStyles.button}
        onPress={handleRestart}
        disabled={isRestarting}
        activeOpacity={0.8}
      >
        {isRestarting ? (
          <ActivityIndicator size="small" color={Colors.primary} />
        ) : (
          <Text style={bannerStyles.buttonText}>Restart Now</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const bannerStyles = StyleSheet.create({
  container: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    paddingTop: Spacing.sm + 4,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
  },
  text: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  button: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.xs + 2,
    minWidth: 100,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.primary,
  },
});

export default function RootLayout() {
  const isInitialized = useSettingsStore((s) => s.isInitialized);
  const initialize = useSettingsStore((s) => s.initialize);
  const [bootError, setBootError] = useState(false);

  // Set Android FLAG_SECURE for the whole app: blocks screenshots/screen
  // recording and hides vault contents in the app-switcher / recents preview.
  usePreventScreenCapture();
  useAutoLock();

  const boot = useCallback(async () => {
    setBootError(false);
    try {
      // Remove any stale plaintext export/share files left in cache.
      purgeExportCache();
      await initialize();
    } catch (e) {
      setBootError(true);
    }
  }, [initialize]);

  useEffect(() => {
    boot();
  }, [boot]);

  let content: React.ReactNode;
  if (bootError) {
    content = (
      <View style={styles.loading}>
        <Ionicons name="warning-outline" size={48} color={Colors.danger} />
        <Text style={styles.errorTitle}>Something went wrong</Text>
        <Text style={styles.errorSubtitle}>The vault could not be initialized.</Text>
        <TouchableOpacity style={styles.retryButton} onPress={boot} activeOpacity={0.8}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
        <StatusBar style="dark" />
      </View>
    );
  } else if (!isInitialized) {
    content = (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <StatusBar style="dark" />
      </View>
    );
  } else {
    content = (
      <>
        <StatusBar style="dark" />
        <UpdateBanner />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: Colors.background },
            animation: 'fade',
          }}
        />
      </>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>{content}</SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.xl,
  },
  errorTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.text,
    marginTop: Spacing.base,
  },
  errorSubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.xs,
  },
  retryButton: {
    marginTop: Spacing.lg,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm + 2,
  },
  retryText: {
    fontSize: FontSize.base,
    fontWeight: '700',
    color: Colors.white,
  },
});
