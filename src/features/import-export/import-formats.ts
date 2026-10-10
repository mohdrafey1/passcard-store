import Papa from 'papaparse';

/**
 * Read CSV exports from other password managers into login/card drafts.
 * Pure: no storage, no crypto. The caller decides what to save.
 */

export interface LoginDraft {
  title: string;
  website: string;
  username: string;
  email: string;
  password: string;
  notes: string;
  category: string;
  favorite: boolean;
}

export interface CardDraft {
  cardNickname: string;
  cardHolderName: string;
  cardNumber: string;
  expiryMonth: string;
  expiryYear: string;
  cvv: string;
  notes: string;
}

export type FormatId =
  | 'passcard'
  | 'passcard-cards'
  | 'google'
  | 'firefox'
  | 'bitwarden'
  | 'onepassword'
  | 'lastpass'
  | 'keepassxc'
  | 'keepass'
  | 'dashlane'
  | 'generic';

export interface ImportProblem {
  /** 1-based data row (header excluded); 0 for file-level problems. */
  row: number;
  message: string;
}

export interface ParsedImport {
  format: FormatId;
  formatLabel: string;
  logins: LoginDraft[];
  cards: CardDraft[];
  problems: ImportProblem[];
  /** Rows that aren't logins (secure notes, identities) and were left out. */
  skipped: number;
}

type Row = Record<string, string>;

export const FORMAT_LABELS: Record<FormatId, string> = {
  passcard: 'Passcard Store',
  'passcard-cards': 'Passcard Store cards',
  google: 'Google Password Manager / Chrome',
  firefox: 'Firefox',
  bitwarden: 'Bitwarden',
  onepassword: '1Password',
  lastpass: 'LastPass',
  keepassxc: 'KeePassXC',
  keepass: 'KeePass',
  dashlane: 'Dashlane',
  generic: 'CSV',
};

const ALIASES = {
  title: ['title', 'name', 'account', 'item', 'label', 'service', 'site name'],
  website: ['url', 'website', 'web site', 'login_uri', 'uri', 'hostname', 'domain', 'site', 'login url'],
  username: ['username', 'login_username', 'login name', 'user name', 'login', 'user', 'userid', 'user id'],
  email: ['email', 'e-mail', 'email address', 'mail'],
  password: ['password', 'login_password', 'pass', 'passwd', 'pwd'],
  notes: ['notes', 'note', 'comments', 'comment', 'extra', 'description'],
  totp: ['totp', 'login_totp', 'otpauth', 'otp', 'otpsecret', 'one-time password'],
};

const cleanHeader = (h: string) => h.replace(/^﻿/, '').trim().toLowerCase();
const cell = (row: Row, ...keys: string[]) => {
  for (const k of keys) {
    const v = row[k];
    if (v !== undefined && v.trim() !== '') return v.trim();
  }
  return '';
};

function hostOf(url: string): string {
  const m = url.trim().match(/^(?:[a-z][a-z0-9+.-]*:\/\/)?(?:[^@/]+@)?([^/:?#]+)/i);
  return m ? m[1].replace(/^www\./i, '').toLowerCase() : '';
}

/** Short display name: an explicit title, else the site's host, else the username. */
function titleFor(title: string, website: string, username: string): string {
  return title || hostOf(website) || username || 'Untitled';
}

function withTotp(notes: string, totp: string): string {
  if (!totp) return notes;
  const line = `Authenticator setup key: ${totp}`;
  return notes ? `${notes}\n\n${line}` : line;
}

const truthy = (v: string) => /^(1|true|yes|y|x)$/i.test(v.trim());

function matchCategory(name: string, categories: readonly string[]): string {
  const hit = categories.find((c) => c.toLowerCase() === name.trim().toLowerCase());
  return hit ?? 'Other';
}

function detect(headers: Set<string>): FormatId {
  const has = (...h: string[]) => h.every((x) => headers.has(x));
  if (has('cardholdername', 'cardnumber')) return 'passcard-cards';
  if (has('login_password', 'name') && headers.has('type')) return 'bitwarden';
  if (has('url', 'username', 'password', 'httprealm')) return 'firefox';
  if (has('url', 'username', 'password', 'extra', 'grouping')) return 'lastpass';
  if (has('group', 'title', 'username', 'password', 'url')) return 'keepassxc';
  if (has('account', 'login name', 'password')) return 'keepass';
  if (has('username', 'username2', 'title', 'password')) return 'dashlane';
  if (has('title', 'password') && (headers.has('otpauth') || headers.has('archived'))) return 'onepassword';
  if (has('name', 'url', 'username', 'password') && headers.size <= 6) return 'google';
  if (has('title', 'website', 'username', 'email', 'password')) return 'passcard';
  return 'generic';
}

function findColumn(headers: string[], aliases: string[]): string | null {
  for (const a of aliases) if (headers.includes(a)) return a;
  return null;
}

export function parseImport(text: string, categories: readonly string[] = []): ParsedImport {
  const parsed = Papa.parse<Row>(text.replace(/^﻿/, ''), {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: cleanHeader,
  });
  const headers = (parsed.meta.fields ?? []).map(cleanHeader);
  const format = detect(new Set(headers));
  const result: ParsedImport = {
    format,
    formatLabel: FORMAT_LABELS[format],
    logins: [],
    cards: [],
    problems: [],
    skipped: 0,
  };

  for (const err of parsed.errors) {
    result.problems.push({ row: (err.row ?? -1) + 1, message: err.message });
  }
  if (headers.length === 0) {
    result.problems.push({ row: 0, message: 'The file is empty or has no header row.' });
    return result;
  }

  if (format === 'passcard-cards') {
    parsed.data.forEach((row, i) => {
      const number = cell(row, 'cardnumber').replace(/\D/g, '');
      if (!number) {
        result.problems.push({ row: i + 1, message: 'No card number.' });
        return;
      }
      result.cards.push({
        cardNickname: cell(row, 'cardnickname'),
        cardHolderName: cell(row, 'cardholdername'),
        cardNumber: number,
        expiryMonth: cell(row, 'expirymonth').padStart(2, '0').slice(-2),
        expiryYear: cell(row, 'expiryyear').slice(-2),
        cvv: cell(row, 'cvv'),
        notes: cell(row, 'notes'),
      });
    });
    return result;
  }

  const col = {
    title: findColumn(headers, ALIASES.title),
    website: findColumn(headers, ALIASES.website),
    username: findColumn(headers, ALIASES.username),
    email: findColumn(headers, ALIASES.email),
    password: findColumn(headers, ALIASES.password),
    notes: findColumn(headers, ALIASES.notes),
    totp: findColumn(headers, ALIASES.totp),
  };
  if (!col.password) {
    result.problems.push({ row: 0, message: 'No password column was found in this file.' });
    return result;
  }
  const get = (row: Row, key: keyof typeof col) => (col[key] ? cell(row, col[key] as string) : '');

  parsed.data.forEach((row, i) => {
    const n = i + 1;
    // Rows that are notes, cards or identities in other managers.
    if (format === 'bitwarden' && cell(row, 'type') && cell(row, 'type').toLowerCase() !== 'login') {
      result.skipped++;
      return;
    }
    if (format === 'lastpass' && cell(row, 'url') === 'http://sn') {
      result.skipped++;
      return;
    }

    const password = get(row, 'password');
    let username = get(row, 'username');
    let email = get(row, 'email');
    let title = get(row, 'title');
    let website = get(row, 'website');
    // A "Site" column sometimes holds a name ("Paytm") rather than an address.
    if (!title && website && !/[.:/]/.test(website)) {
      title = website;
      website = '';
    }
    if (!email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(username) && !col.email) {
      email = username;
      username = '';
    }
    if (!password) {
      const label = title || hostOf(website) || username || email;
      result.problems.push({ row: n, message: `No password${label ? ` for ${label}` : ''}; skipped.` });
      return;
    }

    let category = 'Other';
    if (format === 'passcard') category = matchCategory(cell(row, 'category'), categories);
    else if (format === 'bitwarden') category = matchCategory(cell(row, 'folder'), categories);
    else if (format === 'lastpass') category = matchCategory(cell(row, 'grouping'), categories);
    else if (format === 'keepassxc') category = matchCategory(cell(row, 'group'), categories);

    const favorite =
      (format === 'bitwarden' && truthy(cell(row, 'favorite'))) ||
      (format === 'lastpass' && truthy(cell(row, 'fav'))) ||
      (format === 'onepassword' && truthy(cell(row, 'favorite')));

    result.logins.push({
      title: titleFor(title, website, username || email),
      website,
      username,
      email,
      password,
      notes: withTotp(get(row, 'notes'), get(row, 'totp')),
      category,
      favorite,
    });
  });

  return result;
}

/** Key used to skip logins that are already in the vault. */
export function loginKey(l: { title: string; username: string; email: string; password: string }): string {
  // Passwords are case-sensitive; names and usernames are not.
  return [l.title.trim().toLowerCase(), (l.username || l.email).trim().toLowerCase(), l.password].join('\u0000');
}
