import * as LocalAuthentication from 'expo-local-authentication';

/**
 * Check if biometric hardware is available
 */
export async function isBiometricAvailable(): Promise<boolean> {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  const isEnrolled = await LocalAuthentication.isEnrolledAsync();
  return hasHardware && isEnrolled;
}

/**
 * Get the type of biometric authentication available
 */
export async function getBiometricType(): Promise<string> {
  const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
  if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
    return 'Face ID';
  }
  if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
    return 'Fingerprint';
  }
  if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
    return 'Iris';
  }
  return 'Biometric';
}

export interface BiometricResult {
  success: boolean;
  /** Present on failure: e.g. 'user_cancel', 'authentication_failed', 'lockout'. */
  error?: string;
}

/**
 * Authenticate user using biometrics.
 * Returns success plus, on failure, the underlying reason so the caller can
 * distinguish a genuine mismatch (which should count toward lockout) from a
 * user cancel (which should not).
 */
export async function authenticateWithBiometrics(
  promptMessage = 'Unlock Passcard Store',
): Promise<BiometricResult> {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      cancelLabel: 'Use PIN',
      disableDeviceFallback: true,
    });
    if (result.success) return { success: true };
    return { success: false, error: (result as { error?: string }).error };
  } catch {
    return { success: false, error: 'unknown' };
  }
}
