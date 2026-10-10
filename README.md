> 🎉 **Passcard Store is open source!**
> Licensed under the [MIT License](./LICENSE). Fork it, star it, and pull requests are welcome.

# 🔐 Passcard Store

A fully offline vault for passwords and cards on Android, built with Expo SDK 56, React Native and TypeScript.

**Everything stays on your phone. No cloud, no account, no tracking.**

---

## ✨ Features

### 🛡️ Security

- **PIN or passphrase.** Choose a 6-digit PIN (recommended), a 4-digit PIN or a passphrase of 10+ characters. Obvious PINs such as `123456` or `111111` are rejected.
- **Argon2id key slot.** A random 256-bit data key encrypts the vault. That key is wrapped with a key derived from your PIN or passphrase using Argon2id (19 MiB, 2 passes; PBKDF2-SHA256 with 600,000 iterations as a fallback). The PIN itself is never stored, not even as a hash.
- **AES-256-GCM records.** Every entry is sealed as one encrypted document, bound to its table and ID so rows can't be swapped. Only the ID and timestamps are stored unencrypted, and search runs in memory on decrypted data.
- **Fingerprint unlock.** Uses a copy of the data key kept in Android Keystore storage that only opens after a strong biometric check. Enrolling a new fingerprint invalidates it, and the app asks for your PIN before offering fingerprint again.
- **Escalating lockout.** After every 5 wrong attempts the lockout grows (1 min, 5 min, 15 min, 1 h) and survives app restarts. Optionally, the vault is erased after 10 wrong tries in a row.
- **Sensitive clipboard.** Copied secrets are flagged so Android 13+ hides them in the clipboard preview, and the clipboard is cleared after 15 s to 2 min, but only if it still holds what we copied.
- **Screen protection.** `FLAG_SECURE` blocks screenshots and hides the vault in the recent apps screen. Auto-lock options range from immediately to 15 minutes.
- **No Android backup.** `allowBackup` is off, so the vault isn't copied into cloud device backups.

### 🔑 Logins

- Add, edit, duplicate, favourite and delete logins, with unsaved-changes protection
- Categories you can add, rename and remove
- Strength meter powered by zxcvbn, plus a "password age" hint
- Generator for random passwords, EFF word passphrases and PINs, using the system CSPRNG
- Swipe a row to copy the password or favourite it
- **Recently deleted:** deleted items stay for 30 days with one-tap undo

### 💳 Cards

- Wallet-style card faces with network detection (Visa, Mastercard, Amex, RuPay, Discover and more)
- Luhn and expiry checks while you type, and an "expires soon" badge
- Card number and CVV stay hidden until you reveal them, and hide again after 20 seconds

### 📦 Backup, import and export

- **Encrypted backups (`.pcbackup`).** Protected by a backup password you set once (12+ characters), separate from your PIN. Save straight to a folder or share the file. Restore can merge with or replace the current vault, including during first-time setup.
- **Import** from Google Password Manager, Firefox, Bitwarden, 1Password, LastPass, KeePassXC, KeePass, Dashlane, generic CSV and older Passcard exports. Duplicates are skipped.
- **CSV export** of logins or cards, with spreadsheet formula injection neutralised.
- Optional backup reminders.

### 🎨 Design

- "Midnight Brass" dark theme and a light "Paper" theme, or follow the system
- Manrope and JetBrains Mono fonts, colour pairs checked against WCAG contrast
- Screen reader labels and actions throughout

---

## 🏗️ Tech stack

| Layer          | Technology                                                           |
| -------------- | -------------------------------------------------------------------- |
| Framework      | Expo SDK 56, React Native 0.85, React 19 (React Compiler)            |
| Language       | TypeScript (strict)                                                  |
| Navigation     | Expo Router with `Stack.Protected` guards                            |
| State          | Zustand                                                              |
| Database       | expo-sqlite (WAL)                                                    |
| Encryption     | expo-crypto (AES-256-GCM)                                            |
| Key derivation | react-native-quick-crypto (Argon2id, PBKDF2)                         |
| Key storage    | expo-secure-store (Android Keystore)                                 |
| Biometrics     | expo-secure-store `requireAuthentication`, expo-local-authentication |
| Strength       | zxcvbn-ts                                                            |
| CSV            | papaparse                                                            |
| Clipboard      | Local Expo module (`modules/sensitive-clipboard`)                    |
| Tests          | Jest (jest-expo)                                                     |
| Platform       | Android                                                              |

---

## 📁 Project structure

```
modules/
└── sensitive-clipboard/        # Local Expo module: copy with EXTRA_IS_SENSITIVE
src/
├── app/                        # Expo Router screens
│   ├── _layout.tsx             # Boot, theme, protected route groups
│   ├── unlock.tsx              # PIN / passphrase / fingerprint unlock, lockout
│   ├── (onboarding)/           # Welcome, unlock method, create secret, restore
│   └── (vault)/
│       ├── (tabs)/             # Vault, Cards, Settings
│       ├── login/              # Login detail and editor
│       ├── card/               # Card detail and editor
│       ├── generator.tsx       # Password generator sheet
│       └── settings/           # Unlock method, backup, import, export, deleted, categories
├── components/
│   ├── ui/                     # Design system: text, buttons, fields, sheets, pin pad, toast
│   ├── VaultRow.tsx            # Swipeable list row
│   └── ReauthModal.tsx         # Re-enter PIN before sensitive actions
├── features/                   # Zustand stores and app logic
│   ├── session/                # Unlock, lock, erase, lockout checks
│   ├── import-export/          # Backups, importers, CSV
│   └── vault/                  # List filtering, sorting, shared actions
├── security/                   # aead, kdf, key-manager, lockout, pin rules, legacy migration
├── storage/                    # SQLite schema and encrypted repositories
├── theme/                      # Palettes, typography, spacing
├── types/
└── utils/                      # Generator, cards, clipboard, strength, sharing
```

---

## 🔒 Security architecture

```
 PIN / passphrase ──Argon2id──▶ key-encryption key ──unwraps──▶ data key (memory only)
                                                                    │
 Fingerprint ──Keystore biometric check──▶ copy of data key ────────┤
                                                                    ▼
                                    SQLite: id, timestamps, AES-256-GCM(entry JSON)
```

- The wrapped data key, KDF parameters and salt live in a single SecureStore entry.
- The data key only exists in memory while the vault is unlocked, and is dropped on lock.
- Vaults from v1.0–v1.2 (crypto-js AES-CBC, PBKDF2 PIN hash) are migrated on the first unlock after updating: the key is rewrapped, every row is re-encrypted with AES-GCM and the old plaintext search columns are cleared.
- Backups use their own Argon2id-derived key, so sharing a backup never exposes your PIN.

---

## 🚀 Getting started

### Prerequisites

- Node.js 20+ (22.x recommended)
- Android Studio with an emulator, or an Android phone with USB debugging

### Install and run

```bash
git clone https://github.com/mohdrafey1/passcard-store.git
cd passcard-store
npm install

# Build and install a development build (needs native modules, so Expo Go won't work)
npx expo run:android
```

### Checks

```bash
npm run typecheck   # tsc --noEmit
npm test            # Jest unit tests
npm run lint        # ESLint (eslint-config-expo)
```

In development builds `FLAG_SECURE` is off so you can take screenshots. Release builds always have it on.

---

## 📄 CSV formats

Imports detect the source automatically from the header row. Passcard's own export looks like this:

**Logins**

```csv
title,website,username,email,password,notes,category
Gmail,gmail.com,johndoe,john@gmail.com,MyP@ss123,Primary email,Personal
```

**Cards**

```csv
cardNickname,cardHolderName,cardNumber,expiryMonth,expiryYear,cvv,notes
My Visa,John Doe,4111111111111111,12,25,123,Primary card
```

---

## 📜 License

[MIT](./LICENSE)
