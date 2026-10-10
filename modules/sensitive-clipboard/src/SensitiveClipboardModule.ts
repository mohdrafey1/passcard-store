import { NativeModule, requireOptionalNativeModule } from 'expo';

declare class SensitiveClipboardModule extends NativeModule<Record<string, never>> {
  setSensitiveStringAsync(text: string): Promise<void>;
  clearAsync(): Promise<void>;
}

/** Null where the native module isn't built in (iOS, web, tests). */
export default requireOptionalNativeModule<SensitiveClipboardModule>('SensitiveClipboard');
