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

/**
 * Authenticate user using biometrics
 * Returns true if authentication succeeded
 */
export async function authenticateWithBiometrics(
  promptMessage = 'Unlock Passcard Store',
): Promise<boolean> {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      cancelLabel: 'Use PIN',
      disableDeviceFallback: true,
    });
    return result.success;
  } catch {
    return false;
  }
}
