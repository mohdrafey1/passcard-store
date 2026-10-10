import { measureStrength } from '../strength';

describe('measureStrength', () => {
  it('rates common passwords low even when they tick every box', () => {
    expect(measureStrength('Password1234!').score).toBeLessThanOrEqual(2);
    expect(measureStrength('qwerty123').score).toBeLessThanOrEqual(1);
  });

  it('rates long random passwords highly', () => {
    expect(measureStrength('k7#Rm2!vQp9$Lx-T4w').score).toBe(4);
  });

  it('penalises the site name inside the password', () => {
    const withSite = measureStrength('github2024!', ['github']);
    const without = measureStrength('github2024!');
    expect(withSite.score).toBeLessThanOrEqual(without.score);
  });

  it('gives a hint for weak passwords only', () => {
    expect(measureStrength('password').hint).not.toBeNull();
    expect(measureStrength('k7#Rm2!vQp9$Lx-T4w').hint).toBeNull();
  });

  it('returns an empty label for an empty password', () => {
    expect(measureStrength('')).toEqual({ score: 0, label: '', hint: null });
  });
});
