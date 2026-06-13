import 'react-native-get-random-values';
import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useSettingsStore } from '@/features/settings/store';
import { initializeEncryptionKey } from '@/security/encryption';
import { Colors } from '@/constants/theme';
import { useAutoLock } from '@/hooks/useAutoLock';

export default function RootLayout() {
  const isInitialized = useSettingsStore((s) => s.isInitialized);
  const initialize = useSettingsStore((s) => s.initialize);

  useAutoLock();

  useEffect(() => {
    async function boot() {
      await initializeEncryptionKey();
      await initialize();
    }
    boot();
  }, [initialize]);

  if (!isInitialized) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <StatusBar style="light" />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="light" />
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

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
  },
});
