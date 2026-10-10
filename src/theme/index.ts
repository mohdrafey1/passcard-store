import { useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { useSettingsStore } from '@/features/settings/store';
import { MONOGRAMS, midnight, paper, type Palette } from './palettes';

export { CARD_FACES, MONOGRAMS, midnight, paper, type Palette } from './palettes';
export { FONT, MONO, TOUCH, radius, space, type, type TypeVariant } from './typography';

/** The active palette: the user's choice, or the system's when "Match system". */
export function useTheme(): Palette {
  const preference = useSettingsStore((s) => s.theme);
  const system = useColorScheme();
  if (preference === 'midnight') return midnight;
  if (preference === 'paper') return paper;
  return system === 'light' ? paper : midnight;
}

/**
 * `const useStyles = makeStyles((c) => StyleSheet.create({...}))` then
 * `const s = useStyles()` inside a component; recomputed only when the
 * palette changes.
 */
export function makeStyles<T>(factory: (c: Palette) => T): () => T {
  const cache = new WeakMap<Palette, T>();
  return function useStyles() {
    const c = useTheme();
    return useMemo(() => {
      const hit = cache.get(c);
      if (hit) return hit;
      const styles = factory(c);
      cache.set(c, styles);
      return styles;
    }, [c]);
  };
}

/** Stable colour pair for a name's letter tile. */
export function monogramColors(name: string, c: Palette): [string, string] {
  let h = 2166136261;
  for (let i = 0; i < name.length; i++) {
    h ^= name.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const set = MONOGRAMS[c.isDark ? 'dark' : 'light'];
  return set[(h >>> 0) % set.length];
}

export function monogramLetter(name: string): string {
  // First letter or digit (letters are characters with distinct cases, which
  // avoids relying on Unicode property escapes in the JS engine).
  for (const ch of name.trim()) {
    if (/\d/.test(ch) || ch.toLowerCase() !== ch.toUpperCase()) return ch.toUpperCase();
  }
  return '#';
}
