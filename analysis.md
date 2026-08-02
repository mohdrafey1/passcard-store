# Application Analysis Report

**Application:** Passcard Store — offline password & card vault
**Stack:** Expo SDK 56, React Native 0.85, TypeScript (strict), Expo Router, Zustand, expo-sqlite, crypto-js
**Target platform (per README):** Android only
**Audit date:** 2026-07-15
**Scope:** Full static audit of `src/` (43 source files), configuration, and documented behavior. No code was modified.

> **Method note:** This is a static review. Findings are derived from reading every source file and reasoning about runtime behavior on the app's declared target (Android). Where a claim depends on runtime, it is called out. Several findings are *platform-fatal on Android specifically* because the code paths guard on `Platform.OS === 'ios'` or use iOS-only APIs (`Alert.prompt`), and the README states the app ships Android-only.

---

## Executive Summary

- **Overall quality score: 4.5 / 10**
  The architecture is clean and readable, the encryption primitives (AES-256-CBC with a native-RNG IV, PBKDF2) are individually sound, and the UI is visually consistent. However, several **core security features do not actually protect the user on the target platform**, and multiple primary settings flows are broken on Android. The gap between what the README promises and what the shipped code delivers on Android is large.

- **Total issues found: 48**
  - **Critical: 5**
  - **High: 9**
  - **Medium: 15**
  - **Low: 19**

**Headline problems**

1. On Android, every encrypted backup is silently protected with the hard-coded PIN `"0000"` — the vault's flagship "encrypted backup" feature provides ~zero confidentiality.
2. The Auto-Lock and Clipboard-Clear pickers use `Alert.alert` with 4–6 buttons; Android renders at most 3, so most options are unreachable.
3. "Change PIN" relies on `Alert.prompt`, which does not exist on Android, so it silently falls back to the first-run PIN-creation flow and never verifies the current PIN.
4. Generated passwords use `Math.random()` — not cryptographically secure — in a password manager.
5. Brute-force lockout state lives only in a module-level variable, so killing and reopening the app resets the attempt counter and defeats lockout entirely.

---

# Critical Issues

## Issue #1 — Android backups are encrypted with a hard-coded PIN "0000"
**Severity:** Critical
**Category:** Security / Broken feature
**Screen / files:** `src/app/(tabs)/settings/backup.tsx:20-58`, `src/features/import-export/backup-handler.ts:28-76`
**Description:** `handleCreateBackup` calls `Alert.prompt?.(...)`. `Alert.prompt` is **iOS-only**; on Android it is `undefined`, so the optional call returns `undefined` and the `?? handleCreateBackupFallback()` branch runs. The fallback calls `createBackup('0000')` and shows *"Backup created (encrypted with PIN: 0000)"*.
**Expected:** The backup is encrypted with the user's real secret so only they can restore it.
**Actual:** On the only supported platform, every `.vaultx` backup is encrypted with the literal string `"0000"`. Combined with Issue #6 (static salt, low iteration count), any `.vaultx` file exfiltrated from a user's cloud drive / share target can be decrypted by anyone in milliseconds. This nullifies the "AES-256 encrypted backup" selling point.
**Suggested fix:** Replace `Alert.prompt` with the app's own PIN entry UI (a modal reusing `PinPad`, like `restore-pin` already does). Never fall back to a constant key. Refuse to create a backup if no user secret is supplied.

## Issue #2 — Auto-Lock and Clipboard-Clear pickers are broken on Android (Alert button overflow)
**Severity:** Critical
**Category:** Broken feature / Platform
**Screen / files:** `src/app/(tabs)/settings/index.tsx:87-103`, options in `src/types/settings.ts:19-31`
**Description:** `handleAutoLock` builds an `Alert.alert` with the 5 `AUTO_LOCK_OPTIONS` **plus** a Cancel = **6 buttons**. `handleClipboardClear` builds 3 options + Cancel = **4 buttons**. Android's native `AlertDialog` supports at most **3 buttons** (positive / negative / neutral); React Native silently drops the rest.
**Expected:** User can choose any auto-lock duration (Immediate / 30s / 1m / 5m / 15m) and any clipboard-clear duration.
**Actual:** Only 3 of the buttons render on Android, so most durations are unreachable, and the visual layout of many stacked buttons is broken even where they do appear. Auto-lock — a core security control — effectively cannot be configured.
**Suggested fix:** Replace these `Alert.alert` menus with a proper bottom-sheet/radio picker (the existing `ActionSheet` component is ideal and already supports N rows). This also fixes the same latent problem if options grow.

## Issue #3 — "Change PIN" is broken and insecure on Android; never verifies current PIN
**Severity:** Critical
**Category:** Security / Broken feature
**Screen / files:** `src/app/(tabs)/settings/index.tsx:70-85`, `src/security/pin.ts:71-73`
**Description:** `handleChangePin` uses `Alert.prompt?.(...) ?? router.push('/(auth)/create-pin')`. On Android the prompt is `undefined`, so it pushes the first-run **create-pin** screen. Independently of platform, `changePin(newPin)` overwrites the stored hash **without ever asking for the current PIN**.
**Expected:** Changing the PIN requires proving knowledge of the current PIN, then entering + confirming a new one.
**Actual:** (a) On Android the flow is the onboarding screen bolted on mid-session; after completion `create-pin.tsx` does `router.replace('/(auth)/unlock')`, kicking the user out to re-authenticate. (b) Anyone with the unlocked app open can silently change the PIN with no knowledge of the old one. (c) On iOS the `Alert.prompt` input is plain text (not masked), non-numeric keyboard, and there is no confirmation step, so a typo silently locks the user into a PIN they didn't intend.
**Suggested fix:** Build a dedicated Change-PIN screen: verify current PIN → enter new → confirm new, all via `PinPad`. Remove the `Alert.prompt` path entirely.

## Issue #4 — Password generator uses `Math.random()` (not cryptographically secure)
**Severity:** Critical
**Category:** Security
**Screen / files:** `src/utils/password-generator.ts:25-63`
**Description:** Every character selection and the Fisher-Yates shuffle use `Math.random()`. In Hermes/JSC this is a non-cryptographic PRNG. The project already depends on `expo-crypto` and `react-native-get-random-values`, so secure randomness is available.
**Expected:** A password *manager's* generator must use a CSPRNG so generated secrets are unpredictable.
**Actual:** Generated passwords are drawn from a predictable PRNG. This is a textbook weakness for exactly this class of app.
**Suggested fix:** Use `ExpoCrypto.getRandomBytes()` (with rejection sampling to avoid modulo bias) for character selection and shuffling.

## Issue #5 — Brute-force lockout is in-memory only and resets on app restart
**Severity:** Critical
**Category:** Security
**Screen / files:** `src/security/lockout.ts:9-46`
**Description:** `failedAttempts` / `lockoutUntil` live in a module-level `let state`. Nothing is persisted. Killing the app (or the OS reclaiming it) resets the counter to 0.
**Expected:** After 5 failed attempts the app is locked for 60s, and the attacker cannot trivially bypass it.
**Actual:** An attacker enters 4 wrong PINs, force-stops the app, reopens it, and has a fresh set of 4 attempts — unlimited guessing at ~4 tries per relaunch. For a 4-digit PIN this makes the lockout cosmetic. There is also **no lockout on failed biometric attempts**.
**Suggested fix:** Persist attempt count and `lockoutUntil` to `expo-secure-store`, load on boot, and apply an escalating backoff. Consider a "wipe after N failures" option.

---

# High Priority Issues

## Issue #6 — Backup key derivation: static salt + low iterations + short PIN
**Severity:** High
**Category:** Security
**Files:** `src/features/import-export/backup-handler.ts:28-34`
**Description:** `deriveBackupKey` uses a hard-coded constant salt (`'passcard-backup-salt-v1'`), 5,000 PBKDF2 iterations, and typically a 4–6 digit PIN. A constant salt means one rainbow table works for **all** users' backups, and a 4-digit PIN has only 10,000 possibilities.
**Expected:** Backups resist offline brute force even if the file leaks.
**Actual:** The entire keyspace (with the "0000" default from Issue #1, a keyspace of *one*) is brute-forceable instantly.
**Suggested fix:** Generate a random per-backup salt, store it in the file header, use ≥210,000 PBKDF2-SHA256 iterations (or Argon2id), and require a real passphrase rather than the numeric app PIN.

## Issue #7 — Restore deletes all existing data before validating and without confirmation or a transaction
**Severity:** High
**Category:** Data loss / Error handling
**Files:** `src/features/import-export/backup-handler.ts:139-149`, `src/app/(tabs)/settings/backup.tsx:77-96`
**Description:** `restoreBackup` calls `passwordRepository.deleteAll()` and `cardRepository.deleteAll()` **before** the two independent `bulkCreate` calls, none of them wrapped in a single transaction. There is no "this will replace your current vault" confirmation in the UI.
**Expected:** Restore is atomic (all-or-nothing) and the user is warned it overwrites current data.
**Actual:** If `bulkCreate` throws midway (bad payload, disk full), the user is left with wiped or partially-restored data and no undo. Users may also restore expecting a *merge* and instead lose everything.
**Suggested fix:** Wrap delete+insert in one `withTransactionAsync`, validate the full payload before deleting, and add an explicit destructive-action confirmation. Offer merge vs. replace.

## Issue #8 — Vault encryption key is not bound to the PIN or gated by authentication
**Severity:** High
**Category:** Security / Architecture
**Files:** `src/security/encryption.ts:20-42`, `src/storage/encrypted-repository.ts:26-32`
**Description:** The 256-bit vault key is generated once and stored in `expo-secure-store` **without** `requireAuthentication`, and it is completely independent of the PIN. The PIN only flips an in-memory `isAuthenticated` boolean; it never derives or unlocks the key.
**Expected:** For a "zero plain-text, PIN-protected vault," the data key should be unavailable without the PIN/biometric.
**Actual:** The PIN is only a UI gate. On a rooted/compromised device (or via a backup of the keystore where extractable), the key is retrievable and the whole SQLite DB decryptable **without knowing the PIN**. The README's security architecture oversells this.
**Suggested fix:** Either (a) encrypt the vault key with a PIN-derived key (PBKDF2/Argon2id) so the DB can't be decrypted without the PIN, and/or (b) store the key with `SecureStore.setItemAsync(..., { requireAuthentication: true })` so hardware-backed auth gates access. Document the actual threat model honestly.

## Issue #9 — Plaintext secrets written to the cache directory on share/export and never deleted
**Severity:** High
**Category:** Security
**Files:** `src/utils/share.ts:39-52`, `src/features/import-export/csv-handler.ts:54-65`
**Description:** Sharing a single password/card and CSV export both write **plaintext** files (`Paths.cache`) that are handed to the OS share sheet and then **never removed**. The file lingers in app cache indefinitely.
**Expected:** Any plaintext export is transient and cleaned up promptly.
**Actual:** Every "Share" of a password writes e.g. `password-Gmail.txt` containing the plaintext password to disk permanently; likewise `passwords-export.csv` holds every secret. Anything that can read app cache (backup tools, forensic access) recovers them.
**Suggested fix:** Delete the temp file after `Sharing.shareAsync` resolves (in a `finally`), write to a subdir you purge on launch, and warn the user that CSV export is unencrypted plaintext.

## Issue #10 — Search-index columns store sensitive metadata in plaintext
**Severity:** High
**Category:** Security
**Files:** `src/storage/database.ts:41-65`, `src/storage/password-repository.ts:5-13`, `src/storage/card-repository.ts:5-11`
**Description:** By design, `search_title`, `search_website`, `search_email`, `search_username`, `search_nickname`, `search_holder_name`, and `search_last_four` are stored unencrypted alongside the encrypted blob. The README acknowledges this, but it means the SQLite DB leaks which sites/accounts a user has, their emails/usernames, cardholder names, and the last 4 digits of cards — even though the app markets "Zero Plain-Text Storage."
**Expected:** Consistency with the stated "zero plain-text" guarantee, or an honest caveat.
**Actual:** Substantial personal metadata is queryable in plaintext by anything that can open the DB file.
**Suggested fix:** If performance permits (the dataset is tiny — everything is already loaded and filtered client-side in `getFiltered`), drop the plaintext columns and search over decrypted in-memory data. At minimum, store a keyed HMAC/token rather than raw values, and correct the README claim.

## Issue #11 — Dashboard search navigates away on every keystroke and can't be re-run
**Severity:** High
**Category:** UX / Navigation bug
**Files:** `src/app/(tabs)/index.tsx:58-63, 80-86`
**Description:** `handleSearch` runs on every `onChangeText`; the moment the query is non-empty it `router.push`es to the Passwords tab with `{ search }`. The Passwords screen seeds its search from `params.search` **only once** via `useState(params.search || '')`.
**Expected:** Typing a query and submitting takes you to results; editing keeps working.
**Actual:** (a) After the first character the dashboard field loses focus and you're thrown to the Passwords tab — you can never type a multi-character query in the dashboard box. (b) Because the Passwords screen only reads the param once, subsequent dashboard searches don't update it. (c) Card results are never searchable from the dashboard at all (always routed to Passwords).
**Suggested fix:** Debounce and only navigate on submit; pass the query through a store or `useLocalSearchParams` effect that updates on change; add a combined results screen or let the user pick a target.

## Issue #12 — Card expiry/CVV validation is weak and inconsistent between add and edit
**Severity:** High
**Category:** Validation
**Files:** `src/app/(tabs)/cards/add.tsx:20-51`, `src/app/(tabs)/cards/[id].tsx:52-57, 98-106, 125-142`
**Description:** Add-card accepts any 2-digit month/year (e.g. month `00`, `13`, `99`) with no range check and no Luhn/expiry-in-past check. In the **edit** screen, `DetailRow` passes raw `onChangeText` setters with no numeric filtering and no `keyboardType`, so a user can type letters into card number / month / year / CVV, and the card-number field isn't length-limited or formatted the way the add screen enforces.
**Expected:** Consistent numeric-only, range-validated inputs in both add and edit; a valid month is 01–12.
**Actual:** Invalid cards can be saved (month 13), edit mode uses the wrong keyboard and accepts garbage, and formatting differs between screens.
**Suggested fix:** Extract a shared `CardForm` used by both add and edit with month 01–12 validation, numeric keyboards, max lengths, and optional Luhn checking.

## Issue #13 — Missing error handling on boot and dashboard load (infinite spinner / unhandled rejection)
**Severity:** High
**Category:** Error handling / Crash
**Files:** `src/app/_layout.tsx:109-124`, `src/app/(tabs)/index.tsx:33-56`
**Description:** `RootLayout.boot()` awaits `initializeEncryptionKey()` and `initialize()` with **no try/catch**; if SecureStore or SQLite init fails, `isInitialized` never becomes true and the user is stuck on the loading spinner forever with no retry. `DashboardScreen.loadData()` is an async function invoked from `useFocusEffect` with no `.catch`; a decrypt/count failure becomes an unhandled promise rejection and the dashboard shows stale/zero data silently.
**Expected:** Init/load failures surface an error UI with a retry path.
**Actual:** Silent infinite loading or silent failure.
**Suggested fix:** Wrap boot in try/catch with an error screen + "Retry"; wrap `loadData` and show an inline error state. Add a top-level error boundary.

## Issue #14 — No global gesture/root wrapper; reanimated/gesture reliability risk
**Severity:** High → Medium (platform-dependent)
**Category:** Platform best practice / Stability
**Files:** `src/app/_layout.tsx` (whole file)
**Description:** The app uses `react-native-reanimated` (PinPad button springs) and `react-native-gesture-handler` but the root is not wrapped in `GestureHandlerRootView`, and there is no `SafeAreaProvider` at the root (individual screens use `SafeAreaView` from `react-native-safe-area-context`, and the tab layout calls `useSafeAreaInsets()` which requires a provider).
**Expected:** `GestureHandlerRootView` at the app root and a `SafeAreaProvider` wrapping the tree, per both libraries' docs.
**Actual:** `useSafeAreaInsets()` without a provider returns 0 insets (tab bar / notch spacing wrong), and gesture-handler-based components can misbehave on Android. Reanimated worklets are configured (`react-native-worklets`) but the missing root wrapper is a latent stability risk.
**Suggested fix:** Wrap the root layout in `GestureHandlerRootView style={{flex:1}}` and `SafeAreaProvider`.

---

# Medium Priority Issues

## Issue #15 — KeyboardAvoidingView is a no-op on Android; inputs can be hidden by the keyboard
**Severity:** Medium
**Category:** Keyboard handling / UX
**Files:** `src/app/(tabs)/passwords/add.tsx:57`, `src/app/(tabs)/cards/add.tsx:64`; and **absent entirely** in `passwords/[id].tsx`, `cards/[id].tsx`
**Description:** Both add screens set `behavior={Platform.OS === 'ios' ? 'padding' : undefined}` — on the Android-only target this passes `undefined`, so the view does nothing. The detail/edit screens have no `KeyboardAvoidingView` at all. Bottom fields (Notes, CVV) can sit under the keyboard while typing.
**Suggested fix:** Use `behavior="height"` (or rely on Android `adjustResize` set in the manifest via app config) and add keyboard avoidance to the edit screens. Verify `android:windowSoftInputMode`.

## Issue #16 — CSV import trusts the category string without validation
**Severity:** Medium
**Category:** Validation / Data integrity
**Files:** `src/features/import-export/csv-handler.ts:134`
**Description:** `category: (row.category || 'Other').trim() as PasswordEntry['category']` casts arbitrary text to the union type with no runtime check. An import with `category: "Foobar"` stores an invalid category.
**Actual:** Invalid categories break the category filter pills (`getFiltered` never matches) and fall through `CATEGORY_ICONS[...] || '🔒'`. The record becomes effectively unfilterable.
**Suggested fix:** Validate against `DEFAULT_CATEGORIES`; map unknown values to `'Other'`. Consider validating with the already-present `zod` dependency.

## Issue #17 — Copy actions show a blocking `Alert` instead of lightweight feedback
**Severity:** Medium
**Category:** UX
**Files:** `src/app/(tabs)/passwords/[id].tsx:69-72`, `src/app/(tabs)/cards/[id].tsx:66-69`
**Description:** Every copy pops a modal `Alert.alert('Copied', …)` that must be dismissed. In the list ActionSheets, copies give **no** feedback at all — inconsistent.
**Suggested fix:** Use a non-blocking toast/snackbar + haptic for all copies, consistently across list and detail. Consider surfacing the clipboard auto-clear countdown.

## Issue #18 — Detail/edit screens have no Cancel and no unsaved-changes guard
**Severity:** Medium
**Category:** UX / Data safety
**Files:** `src/app/(tabs)/passwords/[id].tsx:82-92`, `src/app/(tabs)/cards/[id].tsx:82-88`
**Description:** Entering edit mode replaces the header action with Save only. To abandon edits the user must press the system back button, which discards silently; there is no way to cancel edits and stay on the screen, and no "discard changes?" prompt.
**Suggested fix:** Add a Cancel button that restores original values; warn on back if there are unsaved changes.

## Issue #19 — `Alert.alert` "No Data" checks are per-type; "Export All" path is dead & mishandles empty
**Severity:** Medium
**Category:** Dead code / Edge case
**Files:** `src/app/(tabs)/settings/export.tsx:14-43`
**Description:** `handleExport` supports `'all'`, but no button ever passes `'all'` (dead branch). The empty-data guards only fire when `type === 'passwords'`/`'cards'`, so an `'all'` export with an empty vault would proceed to share empty CSVs.
**Suggested fix:** Either wire up an "Export All" button or remove the branch; guard the empty case regardless of type.

## Issue #20 — Whole-store subscriptions and redundant queries cause extra renders/work
**Severity:** Medium
**Category:** Performance
**Files:** `src/app/(tabs)/passwords/index.tsx:21`, `src/app/(tabs)/cards/index.tsx:60`, `src/app/(tabs)/settings/index.tsx:52`, `src/app/(tabs)/index.tsx:39-56`
**Description:** Several screens call `useStore()` / `useSettingsStore()` with no selector, subscribing to the entire store and re-rendering on any change. The dashboard's `loadData` calls `load()` (which `findAll()` decrypts **all** rows into the store) **and** `count()` **and** `getRecent(3)` for each type — redundant decryption when only counts + 5 recents are shown.
**Suggested fix:** Use narrow selectors; on the dashboard, derive counts/recents from a single query instead of `findAll` + `count` + `getRecent`.

## Issue #21 — The "getFiltered selector" pattern is a correctness foot-gun
**Severity:** Medium
**Category:** State management / Code quality
**Files:** `src/app/(tabs)/passwords/index.tsx:45`, `src/app/(tabs)/cards/index.tsx:82`
**Description:** `const filtered = useStore((s) => s.getFiltered)();` selects the stable function reference and immediately calls it. It only re-computes because *another* whole-store subscription in the same component forces re-render. Remove that other subscription and the list would silently stop updating.
**Suggested fix:** Compute derived data with a memoized selector or `useMemo` over the actual state slices (`passwords`, `selectedCategory`, `searchQuery`).

## Issue #22 — Generated password is hidden behind the mask; generator options aren't configurable in-app
**Severity:** Medium
**Category:** UX / Missing functionality
**Files:** `src/app/(tabs)/passwords/add.tsx:41-43, 64`
**Description:** Tapping "Generate Strong Password" fills the masked `SecureField`, so the user can't see what was generated without toggling visibility. The README advertises a "generator with configurable options," but the UI hard-codes length 20 and all character classes with no controls.
**Suggested fix:** Reveal the password after generating; add a small options row (length slider, toggles) that maps to `PasswordGeneratorOptions`.

## Issue #23 — Search + category filter interaction re-filters DB results client-side (double filtering, subtle mismatches)
**Severity:** Medium
**Category:** Correctness
**Files:** `src/features/passwords/store.ts:71-118`
**Description:** When searching, `search()` replaces `passwords` with DB `LIKE` results, then `getFiltered()` filters again by `searchQuery` text and category. The DB search matches `search_username` but `getFiltered` re-checks different fields; category filtering is applied on top of an already-narrowed set. The two code paths can disagree (e.g. category filter applied to search results vs. not), producing confusing result counts.
**Suggested fix:** Pick one source of truth — filter entirely in memory over `findAll()` (dataset is small), or push category into the SQL query — and delete the redundant path.

## Issue #24 — Biometric flow: failures are silently swallowed and unlimited
**Severity:** Medium
**Category:** Security / UX
**Files:** `src/security/biometrics.ts:33-46`, `src/app/(auth)/unlock.tsx:54-61`
**Description:** `authenticateWithBiometrics` catches all errors and returns `false` with no message; the unlock screen auto-triggers it on mount and, on failure/cancel, just shows the PIN pad with no explanation. Biometric attempts don't count toward lockout.
**Suggested fix:** Distinguish cancel vs. hardware error vs. lockout; surface a message; feed biometric failures into the (persisted) lockout counter.

## Issue #25 — Leftover cache files accumulate (backups, shares, exports)
**Severity:** Medium
**Category:** Performance / Storage / Security
**Files:** `src/features/import-export/backup-handler.ts:70-76`, `src/utils/share.ts:45-51`, `src/features/import-export/csv-handler.ts:54-65`
**Description:** Each backup/share/export writes a uniquely-named file to cache and never cleans up. Over time this bloats storage; for CSV/share it's plaintext (see Issue #9).
**Suggested fix:** Clean these on app start and/or after the share sheet closes.

## Issue #26 — No re-authentication before destructive/sensitive actions
**Severity:** Medium
**Category:** Security / UX
**Files:** `src/app/(tabs)/settings/index.tsx:105-129` (Delete All), `src/app/(tabs)/cards/index.tsx:18-57` (reveal), backup/restore
**Description:** "Delete All Data," revealing card numbers/CVV, and restore (which wipes) require no PIN/biometric re-prompt — only a text confirmation for delete.
**Suggested fix:** Require re-auth for irreversible or high-sensitivity actions.

## Issue #27 — CreditCardWidget reveal state resets on list recycling; reveals full PAN+CVV inline
**Severity:** Medium
**Category:** UX / Privacy
**Files:** `src/app/(tabs)/cards/index.tsx:18-57`
**Description:** Each card row holds its own `revealed` state. In a long list, FlatList recycling can reset the toggle unexpectedly. Revealing also shows the full card number **and** CVV directly in the scrollable list — high shoulder-surfing exposure with no auto-hide.
**Suggested fix:** Auto-collapse reveal after a timeout or on scroll/blur; consider requiring reveal on the detail screen only.

## Issue #28 — `predictiveBackGestureEnabled: false` + silent back-discard = dead-endy edit UX
**Severity:** Medium
**Category:** Navigation
**Files:** `app.json:20`, detail screens
**Description:** Predictive back is disabled and edit screens discard on back with no guard (see Issue #18). Combined, an accidental back loses edits with no warning and no forward affordance.
**Suggested fix:** See Issue #18; reconsider predictive-back setting.

## Issue #29 — Restore ignores `settings` in the payload; backup/restore asymmetry
**Severity:** Medium
**Category:** Correctness
**Files:** `src/features/import-export/backup-handler.ts:44-51, 143-154`
**Description:** `createBackup` serializes `settings` into the payload, but `restoreBackup` never applies them. Users expecting a full restore silently lose their settings.
**Suggested fix:** Apply settings on restore, or drop them from the payload and document that settings aren't backed up.

---

# Low Priority Issues

- **#30 Dead code — `src/global.css`** is never imported anywhere (confirmed via grep); it defines web font variables irrelevant to a RN StyleSheet app. Remove or wire up. *(Category: dead code)*
- **#31 Dead import — `Vibration`** imported in `PinPad.tsx:2` but never used. *(dead code)*
- **#32 Orphan script — `scripts/reset-project.js`** is the Expo template's reset script; `package.json` has no `reset-project` entry referencing it. Remove. *(dead code)*
- **#33 Dead branch — export `'all'`** in `export.tsx` (see Issue #19). *(dead code)*
- **#34 Production logging** — 8 `console.error` calls (`stores`, add/detail screens) run in release builds with no `__DEV__` guard; noisy and a minor info-leak vector. *(code quality / security)*
- **#35 CVV mask leaks length** — `'•'.repeat(val.length)` in `cards/[id].tsx:73` reveals CVV length. Use a fixed `'•••'`. *(privacy)*
- **#36 Oversized/misused icon asset** — `assets/logo.png` is **1.9 MB** and is reused as `icon`, splash, and Android adaptive **foreground, background, AND monochrome** (`app.json:7-19`). Monochrome/background should be dedicated simplified layers; a 1.9 MB PNG bloats the bundle. *(performance / platform)*
- **#37 Hard-coded version string** — `"Passcard Store v1.0.0"` in `settings/index.tsx:158` will drift from `app.json`. Read from `expo-constants`. *(maintainability)*
- **#38 Post-create-PIN friction** — after create+confirm, `create-pin.tsx:40` replaces to `unlock`, forcing a **third** PIN entry to enter the app. Set `isAuthenticated` on creation and go straight to tabs. *(UX)*
- **#39 Magic numbers / hardcoded values** — `getRecent(3)`, `slice(0,5)`, `setTimeout(...,150)` in PinPad, gradient hex colors in `CreditCardWidget` (not from theme), min card length `13`, etc. Centralize. *(code quality)*
- **#40 Inconsistent card gradient source** — `CreditCardWidget` uses literal hex `['#3D2E22','#1F1712','#130E0A']` while the theme defines `cardGradientStart/End`. *(design consistency)*
- **#41 Duplicate InputField/DetailField/DetailRow components** re-declared per screen with near-identical styles — should be shared components. *(duplicate code)*
- **#42 Password title uniqueness / duplicate entries** — add screen allows unlimited identical entries; only CSV import dedupes (by `title:email`). Inconsistent dedupe policy. *(product)*
- **#43 `isLockedOut()` has a side effect** (`resetLockout()` inside a getter, `lockout.ts:17-25`) — surprising; a query mutates state. *(code quality)*
- **#44 `verifyPin` is a non-constant-time string compare** (`pin.ts:36-39`). Timing side-channel is largely moot locally, but a constant-time compare is best practice for auth. *(security, minor)*
- **#45 No empty/loading state on detail screens** — `if (!entry) return <View/>;` renders a blank screen while loading rather than a spinner. *(UX)*
- **#46 Import has no preview/confirmation** — file is parsed and committed immediately; a wrong file just reports failures with no dry-run. *(UX)*
- **#47 `loading` state in stores is set but never surfaced** in the list UIs (no skeletons/spinners; `FlatList` just shows empty state during load, which can flash "No passwords yet"). *(UX)*
- **#48 SafeArea inconsistency** — most screens use `edges={['top']}` only; bottom insets rely on the tab bar. Modal-ish screens (import/export/backup) may under/over-pad on gesture-nav devices. *(layout)*

---

# UI Improvements

- **Replace 4–6-button `Alert.alert` menus** (auto-lock, clipboard) with the existing `ActionSheet` for a consistent, scalable, on-brand picker (also fixes Issue #2). *(settings/index.tsx)*
- **Reveal generated passwords** and expose generator options (Issue #22). *(passwords/add.tsx)*
- **Non-blocking copy feedback** (toast + haptic) instead of `Alert` (Issue #17), applied consistently to list and detail.
- **Loading skeletons** for password/card lists and detail screens instead of blank views / empty-state flashes (Issues #45, #47).
- **Dedicated Change-PIN and Backup-PIN screens** reusing `PinPad`, replacing the iOS-only `Alert.prompt` (Issues #1, #3).
- **Card widget:** move full reveal to detail only, auto-hide after a timeout; pull gradient from theme tokens (Issues #27, #40).
- **Icon assets:** ship a compressed icon plus proper adaptive foreground / background / monochrome layers (Issue #36).
- **Consistent headers:** several screens hand-roll a back-button + spacer header; extract a shared `ScreenHeader`. Touch targets for the tiny copy icons (14–16 px) should be padded to ≥44 px.

# UX Improvements

- **Fix dashboard search** so users can type a full query and reach combined results (Issue #11).
- **Add Cancel + unsaved-changes guard** in edit mode (Issue #18).
- **Skip the redundant third PIN entry** after onboarding (Issue #38).
- **Confirmation + merge/replace choice** on restore (Issue #7).
- **Warn that CSV/clear-text share is unencrypted** before it leaves the app (Issue #9).
- **Empty-vault guidance:** the dashboard's "Recently Added" simply disappears when empty; add a first-run onboarding nudge ("Add your first password") beyond the list-screen empty states.
- **Surface clipboard auto-clear** (e.g., "Copied — clears in 30s") so users trust the feature.
- **Biometric errors** should explain themselves rather than silently dropping to PIN (Issue #24).

# Performance Improvements

- Use **narrow Zustand selectors**; stop subscribing whole stores (Issue #20, #21).
- **Dashboard:** one query instead of `findAll` + `count` + `getRecent` per type (Issue #20). Decrypting the entire vault to show two counts is wasteful and scales linearly with vault size.
- **Clean cache files** to bound storage growth (Issue #25).
- **Compress the 1.9 MB icon** (Issue #36).
- `FlatList`s are fine for small data but add `initialNumToRender`/`getItemLayout` if vaults can grow large; the `CreditCardWidget` (min-height 200, gradient, shadow) is relatively expensive per row.
- Consider `React.memo` for `VaultCard`/`CreditCardWidget` to avoid re-rendering the whole list on unrelated store changes.

# Code Quality Improvements

- **Extract shared form components** (`InputField`, `DetailField`, `DetailRow`, category chips) — currently duplicated across add/detail screens (Issue #41).
- **Extract a shared `CardForm`** to eliminate add/edit validation drift (Issue #12).
- **Remove dead code**: `global.css`, `Vibration` import, `reset-project.js`, `'all'` export branch (Issues #30–33).
- **Centralize magic numbers / colors** into constants (Issues #39, #40).
- **Purge side effects from getters** (`isLockedOut`) (Issue #43).
- **Validate at the boundary with `zod`** (already a dependency, currently unused) for CSV rows, restore payloads, and settings parsing.
- **Consistent error handling**: replace scattered `console.error` + silent state resets with a shared error reporter and user-facing surfaces; guard logs with `__DEV__`.
- **Add tests** — there are none (no test runner configured). At minimum unit-test `encryption`, `pin`, `lockout`, `password-generator`, and the CSV/backup handlers; these are the highest-risk, most testable modules.

# Accessibility Improvements

- **No `accessibilityLabel`/`accessibilityRole`** anywhere — icon-only buttons (add `+`, copy, eye toggles, PinPad delete/biometric) are unlabeled for screen readers.
- **Tiny touch targets** — copy icons at 14–16 px and several `TouchableOpacity`s fall well under the 44×44 recommendation.
- **Color-only information** — password strength and category rely on color alone; strength already has a text label (good), but category pills and the strength bar need non-color cues for color-blind users.
- **No Dynamic Type / font scaling support** — all sizes are fixed points via the `FontSize` scale; test with large system fonts (text will clip in the fixed-height 48 px inputs and PinPad).
- **PinPad** exposes no accessible value/announcement of entered digit count; announce progress and errors via `accessibilityLiveRegion`.
- **Contrast**: `textMuted #A0927F` on `#F6F2EB`/`#FFF9F0` is ~2.3:1 — **fails** WCAG AA (4.5:1) for the small hint/label text it's used for (e.g. `optionHint`, `importHint`, empty-state subtitles). Darken muted text.
- **Focus management** — forms don't autofocus the first field or advance focus on submit; no `returnKeyType`/`onSubmitEditing` chaining.

# Security Findings

Consolidated (see Critical/High for detail):

1. **Android backups keyed with `"0000"`** (Issue #1) — Critical.
2. **Password generator uses `Math.random()`** (Issue #4) — Critical.
3. **Lockout is bypassable via app restart; no biometric lockout** (Issue #5) — Critical.
4. **Change-PIN needs no current PIN and is broken on Android** (Issue #3) — Critical.
5. **Backup KDF: static salt, 5k iterations, numeric PIN** (Issue #6) — High.
6. **Vault key not bound to PIN, not `requireAuthentication`-gated** (Issue #8) — High.
7. **Plaintext secrets persisted to cache on share/export** (Issue #9) — High.
8. **Plaintext search metadata in SQLite** (Issue #10) — High.
9. **Restore wipes data non-atomically without confirmation** (Issue #7) — High/data-loss.
10. **No re-auth for delete-all / reveal / restore** (Issue #26) — Medium.
11. **Non-constant-time PIN compare** (Issue #44) — Low.
12. **Production `console.error`** (Issue #34) — Low.
13. **README overstates guarantees** ("Zero Plain-Text Storage", "AES-256 encrypted backup") relative to Issues #1, #9, #10 — documentation/security-trust issue.

**Reviewed and OK:** AES-CBC uses a fresh native-RNG IV per record and prepends it (good, `encryption.ts`); PBKDF2 with a random 16-byte salt for the *login* PIN hash (good, `pin.ts`); SQL statements are parameterized and table/column names are internal constants (no injection surface found in `encrypted-repository.ts`); no hard-coded API keys/tokens found in the repo, and `.gitignore` correctly excludes keystores/`.env*.local`/`play-store-key.json`. The Expo Updates URL and EAS `projectId` in `app.json` are public identifiers, not secrets.

---

# Recommended Future Features

### Must Have
- Proper Change-PIN and Backup-PIN entry UIs (removes iOS-only `Alert.prompt` dependence).
- CSPRNG-based password generator.
- Persisted, escalating lockout covering PIN **and** biometrics.
- Atomic restore with confirmation and merge/replace choice.
- Cross-platform pickers for auto-lock/clipboard (no Alert button overflow).

### Should Have
- Bind the vault key to the PIN (or `requireAuthentication`) so data is unreadable without the PIN.
- Encrypted export option (not just plaintext CSV); warn on plaintext export/share; auto-clean temp files.
- Password health: reused/weak/old detection, optional breach check (offline k-anonymity if network is ever allowed — currently offline-only, so at least reuse/weak flags).
- Configurable generator UI; reveal-on-generate.
- Combined global search results (passwords + cards) from the dashboard.
- Field-level validation with `zod` (email/URL/card/expiry) and inline errors instead of `Alert`.

### Nice to Have
- Tags/folders and favorites; sort options (name, recently used).
- TOTP/2FA code storage.
- Autofill service integration (Android Autofill Framework).
- Screenshot/FLAG_SECURE to block screen capture on sensitive screens.
- Duplicate-detection and password-age indicators in the list.
- Localization and full Dynamic Type support.

---

# Overall Rating

| Dimension | Score | Notes |
|---|---|---|
| **Code Quality** | 6.5/10 | Clean, readable, consistent styling; hurt by duplication, dead code, magic numbers, and a fragile derived-state pattern. |
| **Architecture** | 6.5/10 | Sensible layering (screens → stores → repositories → storage/security). Undermined by the PIN being decoupled from the encryption key and by iOS-only APIs on an Android-only product. |
| **UI** | 6.5/10 | Cohesive warm/gold theme, good component set. Broken Android pickers, hidden generated password, oversized icon, some layout/inset gaps. |
| **UX** | 4.5/10 | Dashboard search is broken, edit flows have no cancel/guard, blocking copy alerts, triple PIN entry, silent failures. |
| **Performance** | 6/10 | Fine at small scale; whole-store subscriptions, redundant full-vault decryption on the dashboard, and cache-file growth are avoidable. |
| **Accessibility** | 3/10 | Essentially no screen-reader support, failing contrast on muted text, tiny targets, fixed font sizes. |
| **Security** | 3/10 | Good crypto primitives, but the features that matter (backup encryption, generator, lockout, change-PIN, key-at-rest protection) fail in practice on Android. |
| **Maintainability** | 6/10 | Small, well-organized codebase; no tests, some dead code, and doc/behavior drift. |

## Final Score: **4.5 / 10**

A promising, well-structured vault whose **security marketing outpaces its Android reality**. The single most urgent theme: iOS-only APIs (`Alert.prompt`) and Alert button limits silently degrade or disable *security-critical* flows on the only platform the app ships to (backups keyed to `"0000"`, unconfigurable auto-lock, keyless change-PIN). Address the five Critical issues first — they are individually small code changes with outsized impact — then the High-severity crypto/data-safety items. With those fixed and accessibility work added, this is a 7–8/10 product.

---

## Categories reviewed with no significant issues found
- **SQL injection:** Not found — all queries parameterize values, and identifiers are internal constants (`encrypted-repository.ts`).
- **Secrets in source / VCS:** None found; `.gitignore` properly excludes keystores, provisioning profiles, `.env*.local`, and the Play service-account key.
- **Deep linking abuse:** Only a custom `scheme` is defined with no dynamic deep-link handlers, so no unauthorized-navigation surface was identified.
- **IV reuse / ECB:** Not present — CBC with a fresh per-record native-RNG IV.
