import React, { useEffect } from 'react';
import { Redirect } from 'expo-router';
import { useSettingsStore } from '@/features/settings/store';

export default function Index() {
  const isAuthenticated = useSettingsStore((s) => s.isAuthenticated);
  const isPinCreated = useSettingsStore((s) => s.isPinCreated);

  if (!isPinCreated) {
    return <Redirect href="/(auth)/create-pin" />;
  }

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/unlock" />;
  }

  return <Redirect href="/(tabs)" />;
}
