import type { ZxcvbnFactory, ZxcvbnResult } from '@zxcvbn-ts/core';
import type { StrengthScore } from './password-generator';

/**
 * Password strength for passwords people type (zxcvbn-ts, fully offline).
 * Catches common passwords, names, dates, keyboard walks and l33t speak that
 * a length-and-character-class check would call "strong".
 *
 * The dictionaries are large, so they load on first use, not at app start.
 */

let checker: ZxcvbnFactory | null = null;

function getChecker(): ZxcvbnFactory {
  if (!checker) {
    /* eslint-disable @typescript-eslint/no-require-imports */
    const { ZxcvbnFactory: Factory } = require('@zxcvbn-ts/core') as typeof import('@zxcvbn-ts/core');
    const common = require('@zxcvbn-ts/language-common') as typeof import('@zxcvbn-ts/language-common');
    const en = require('@zxcvbn-ts/language-en') as typeof import('@zxcvbn-ts/language-en');
    /* eslint-enable @typescript-eslint/no-require-imports */
    checker = new Factory({
      translations: en.translations,
      graphs: common.adjacencyGraphs,
      dictionary: { ...common.dictionary, ...en.dictionary },
      // Levenshtein matching costs ~100x the time per check; too slow while typing on a phone.
      useLevenshteinDistance: false,
    });
  }
  return checker;
}

export interface Strength {
  score: StrengthScore;
  label: string;
  /** Short reason or advice, when there is one. */
  hint: string | null;
}

const LABELS: Record<StrengthScore, string> = {
  0: 'Very weak',
  1: 'Weak',
  2: 'Fair',
  3: 'Strong',
  4: 'Very strong',
};

/**
 * @param userInputs words specific to this entry (site, username) that make a
 *   password easier to guess when included.
 */
export function measureStrength(password: string, userInputs: string[] = []): Strength {
  if (!password) return { score: 0, label: '', hint: null };
  let result: ZxcvbnResult;
  try {
    result = getChecker().check(password.slice(0, 128), userInputs.filter(Boolean));
  } catch {
    return { score: 0, label: LABELS[0], hint: null };
  }
  const score = result.score as StrengthScore;
  const hint = result.feedback.warning || result.feedback.suggestions[0] || null;
  return { score, label: LABELS[score], hint: score >= 3 ? null : hint };
}
