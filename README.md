> 🎉 **Passcard Store is now Open Source!**
> > This project is licensed under the [MIT License](./LICENSE) and is open for contributions from the community. Feel free to fork, star, and submit pull requests!

 # 🔐 Passcard Store

A production-grade, fully offline secure vault for passwords and cards — built with Expo SDK 56, React Native, and TypeScript.

**All data stays on your device. No cloud. No accounts. No tracking.**

---

## ✨ Features

### 🛡️ Security
- **Master PIN** — 4 or 6 digit PIN with PBKDF2 hashing (10,000 iterations)
- **PIN-Wrapped Data Key** — The AES data key is encrypted with a key derived from your PIN and only held in memory while unlocked, so the database can't be decrypted without the PIN
- **AES-256-CBC Encryption** — Every sensitive record encrypted at rest with a per-record random IV
- **CSPRNG Password Generator** — Generated passwords use the device's cryptographically secure RNG (never `Math.random()`)
- **Biometric Unlock** — Fingerprint / Face authentication support
- **Lockout Protection** — 5 failed attempts → 60 second lockout, **persisted across app restarts** and applied to biometric failures too
- **Auto-Lock** — Configurable lock on app background (immediate / 30s / 1m / 5m / 15m)
- **Clipboard Auto-Clear** — Automatically clears copied data after 15s / 30s / 60s
- **Encrypted Backups** — backup files use AES-256 with a **per-backup random salt** and 210k PBKDF2 iterations (saved as `.txt` so any file manager can select them for restore; the contents are fully encrypted)
- **Re-authentication** — Deleting all data and creating a backup require re-entering your PIN
- **Secure metadata note** — Search index columns (titles, websites, emails, cardholder names, last 4 digits) are stored unencrypted for fast search; everything sensitive (passwords, full card numbers, CVVs) is always encrypted

### 🔑 Password Management
- Create, edit, duplicate, and delete password entries
- Category organization (Social, Banking, Work, Personal, Shopping, etc.)
- Category filter pills for quick browsing
- Password strength indicator (Weak → Strong)
- Random password generator with configurable options
- Copy username / email / password with one tap
- Share via native share sheet

### 💳 Card Management
- Store credit/debit card details securely
- Visual credit card widgets with gradient styling
- Masked card numbers (`•••• •••• •••• 1234`)
- Tap to reveal sensitive card details
- Copy card number / CVV / expiry

### 📊 Dashboard
- Total passwords and cards count
- Recently added items feed
- Global search across all entries
- Quick action grid (Add Password, Add Card, Import, Export)

### 📦 Import / Export / Backup
- **CSV Import** — Import passwords or cards from CSV files with duplicate detection
- **CSV Export** — Export all data as CSV via native share sheet
- **Encrypted Backup** — Create AES-256 encrypted backup files (PIN-required)
- **Restore** — Restore from encrypted backup with PIN verification

### ⚙️ Settings
- Change PIN
- Toggle biometric unlock
- Auto-lock duration picker
- Clipboard clear duration picker
- Delete all data (with confirmation)

---

## 🏗️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Expo SDK 56 + React Native 0.85 |
| Language | TypeScript (strict) |
| Navigation | Expo Router (file-based) |
| State | Zustand |
| Database | expo-sqlite (WAL mode) |
| Encryption | crypto-js (AES-256-CBC) |
| Hashing | crypto-js (PBKDF2) + expo-crypto (random bytes) |
| Key Storage | expo-secure-store |
| Biometrics | expo-local-authentication |
| CSV | papaparse |
| File I/O | expo-file-system (SDK 56 File API) |
| Sharing | expo-sharing |
| Clipboard | expo-clipboard |
| Haptics | expo-haptics |
| Styling | StyleSheet.create() (pure CSS) |
| Platform | Android only |

---

## 📁 Project Structure

```
src/
├── app/                          # Expo Router screens
│   ├── _layout.tsx               # Root layout (init + auth gate)
│   ├── index.tsx                 # Redirect based on auth state
│   ├── (auth)/                   # Auth flow
│   │   ├── create-pin.tsx        # First-time PIN setup
│   │   └── unlock.tsx            # PIN unlock + biometrics
│   └── (tabs)/                   # Main app
│       ├── _layout.tsx           # Bottom tab navigator
│       ├── index.tsx             # Dashboard
│       ├── passwords/            # Password CRUD screens
│       ├── cards/                # Card CRUD screens
│       └── settings/             # Settings, import, export, backup
├── components/                   # Reusable UI components
│   ├── PinPad.tsx                # Numeric keypad with haptics
│   ├── PasswordStrengthIndicator.tsx
│   ├── SecureField.tsx           # Masked input with eye toggle
│   ├── SearchBar.tsx
│   ├── VaultCard.tsx
│   └── EmptyState.tsx
├── constants/
│   ├── theme.ts                  # Design system (colors, spacing, shadows)
│   └── categories.ts            # Password categories + icons
├── features/
│   ├── passwords/store.ts       # Zustand password store
│   ├── cards/store.ts           # Zustand card store
│   ├── settings/store.ts        # Zustand settings + auth store
│   └── import-export/
│       ├── csv-handler.ts       # CSV import/export
│       └── backup-handler.ts    # Encrypted .vaultx backup/restore
├── hooks/
│   ├── useAutoLock.ts           # Background auto-lock
│   └── useDebounce.ts           # Search debounce
├── security/
│   ├── encryption.ts            # AES-256-CBC encrypt/decrypt
│   ├── pin.ts                   # PBKDF2 PIN hashing
│   ├── biometrics.ts            # Biometric auth wrapper
│   └── lockout.ts               # Failed attempt tracking
├── storage/
│   ├── database.ts              # SQLite init + schema
│   ├── encrypted-repository.ts  # Generic encrypted CRUD
│   ├── password-repository.ts   # Password collection
│   ├── card-repository.ts       # Card collection
│   └── settings-storage.ts     # Settings in SecureStore
├── types/
│   ├── password.ts
│   ├── card.ts
│   └── settings.ts
└── utils/
    ├── clipboard.ts             # Copy with auto-clear
    ├── share.ts                 # Native share sheet
    └── password-generator.ts    # Random password + strength
```

---

## 🔒 Security Architecture

```
┌─────────────────────────────────────────┐
│               App Layer                  │
│  Screens → Zustand Stores → Repository  │
└────────────────┬────────────────────────┘
                 │
┌────────────────▼────────────────────────┐
│        Encrypted Repository              │
│  encrypt(JSON) → SQLite encrypted_data   │
│  Search index columns (plaintext)        │
└────────────────┬────────────────────────┘
                 │
┌────────────────▼──────────┐  ┌──────────────────────┐
│      expo-sqlite          │  │   expo-secure-store   │
│  • encrypted_data (AES)   │  │  • Encryption Key     │
│  • search indexes         │  │  • PIN Hash (PBKDF2)  │
│  • timestamps             │  │  • PIN Salt           │
└───────────────────────────┘  │  • App Settings       │
                               └──────────────────────┘
```

- **Sensitive fields** (passwords, card numbers, CVVs) are always AES-256-CBC encrypted in `encrypted_data`
- **Search index columns** (title, website, email, nickname) are stored as plaintext for SQL query performance
- **Encryption key** is a 256-bit random key stored in device Keystore via `expo-secure-store`
- **PIN hash** uses PBKDF2 with random salt — raw PIN is never stored

---

## 🚀 Getting Started

### Prerequisites

- Node.js 20+ (recommended: 22.x)
- Android Studio with emulator or physical Android device
- Expo CLI

### Installation

```bash
# Clone the repository
git clone https://github.com/mohdrafey1/passcard-store.git
cd passcard-store

# Install dependencies
npm install
```

### Development

```bash
# Start Expo development server
npx expo start

# Run on Android emulator
npx expo start --android

# Create a development build (required for native modules)
npx expo run:android
```

> **Note:** This app uses native modules (`expo-sqlite`, `expo-secure-store`, `expo-local-authentication`) that require a **development build**. Expo Go may have limited functionality.

### Type Checking

```bash
npx tsc --noEmit
```

---

## 📱 App Flow

1. **First Launch** → Create 4 or 6 digit PIN
2. **Subsequent Opens** → Unlock with PIN or biometrics
3. **Dashboard** → View stats, search, quick actions
4. **Manage** → Add/edit/delete passwords and cards
5. **Protect** → Data auto-encrypted, clipboard auto-cleared
6. **Backup** → Export CSV or create encrypted `.vaultx` backup

---

## 📄 CSV Format

### Passwords CSV

```csv
title,website,username,email,password,notes,category
Gmail,gmail.com,johndoe,john@gmail.com,MyP@ss123,Primary email,Personal
```

### Cards CSV

```csv
cardNickname,cardHolderName,cardNumber,expiryMonth,expiryYear,cvv,notes
My Visa,John Doe,4111111111111111,12,25,123,Primary card
```

---

## 🛠️ Built With

- [Expo](https://expo.dev) — React Native framework
- [Expo Router](https://docs.expo.dev/router/introduction/) — File-based routing
- [Zustand](https://github.com/pmndrs/zustand) — State management
- [crypto-js](https://github.com/brix/crypto-js) — AES-256 encryption & PBKDF2
- [papaparse](https://www.papaparse.com/) — CSV parsing
- [expo-sqlite](https://docs.expo.dev/versions/v56.0.0/sdk/sqlite/) — Local database
- [expo-secure-store](https://docs.expo.dev/versions/v56.0.0/sdk/securestore/) — Secure key storage

---

## 📜 License

This project is private and not licensed for redistribution.
