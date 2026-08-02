import { ToastAndroid, Platform, Alert } from 'react-native';

/**
 * Lightweight, non-blocking feedback for quick actions like "copied".
 * Uses the native Android toast (the app's target platform); on other
 * platforms it degrades to a brief alert only when explicitly desired.
 */
export function showToast(message: string): void {
  if (Platform.OS === 'android') {
    ToastAndroid.show(message, ToastAndroid.SHORT);
  } else {
    // Non-blocking on Android is preferred; on iOS fall back to a small alert.
    Alert.alert('', message);
  }
}
