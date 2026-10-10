/**
 * Some in-app actions intentionally send the app to the background (the system
 * file picker, the share sheet, the folder picker). Wrap them in
 * `runWithoutAutoLock` so returning from them doesn't lock the vault.
 *
 * Kept free of imports so any module can use it without import cycles.
 */
let suppressCount = 0;

export function isAutoLockSuppressed(): boolean {
  return suppressCount > 0;
}

export async function runWithoutAutoLock<T>(fn: () => Promise<T>): Promise<T> {
  suppressCount += 1;
  try {
    return await fn();
  } finally {
    // Release slightly later than the promise resolves: the AppState "active"
    // event can fire a beat after the picker/share returns.
    setTimeout(() => {
      suppressCount = Math.max(0, suppressCount - 1);
    }, 1000);
  }
}
