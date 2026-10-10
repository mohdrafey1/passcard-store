/**
 * External links shown in the app. The legal pages live in /legal; replace
 * these with the hosted URLs (the same ones in the Play Console listing).
 */
const REPO = 'https://github.com/mohdrafey1/passcard-store';

export const LINKS = {
  privacy: `${REPO}/blob/master/legal/privacy-policy.html`,
  terms: `${REPO}/blob/master/legal/terms.html`,
  source: REPO,
} as const;
