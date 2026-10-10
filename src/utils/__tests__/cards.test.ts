import { checkCardNumber, detectNetwork, expiryState, formatCardNumber, luhnValid, maskCardNumber } from '../cards';

describe('detectNetwork', () => {
  it.each([
    ['4111111111111111', 'visa'],
    ['5555555555554444', 'mastercard'],
    ['2223003122003222', 'mastercard'],
    ['378282246310005', 'amex'],
    ['6011111111111117', 'discover'],
    ['3530111333300000', 'jcb'],
    ['30569309025904', 'diners'],
    ['6521550000000000', 'rupay'],
    ['6083260000000000', 'rupay'],
    ['6085010000000000', 'unknown'],
    ['5085000000000000', 'rupay'],
    ['6200000000000005', 'unionpay'],
    ['6759649826438453', 'maestro'],
    ['9999', 'unknown'],
  ])('%s is %s', (number, id) => {
    expect(detectNetwork(number).id).toBe(id);
  });
});

describe('luhnValid', () => {
  it('accepts well-known test numbers', () => {
    for (const n of ['4111111111111111', '5555555555554444', '378282246310005', '6011111111111117', '4242 4242 4242 4242']) {
      expect(luhnValid(n)).toBe(true);
    }
  });
  it('rejects a single-digit typo', () => {
    expect(luhnValid('4111111111111112')).toBe(false);
  });
});

describe('formatCardNumber', () => {
  it('groups Visa 4-4-4-4', () => expect(formatCardNumber('4111111111111111')).toBe('4111 1111 1111 1111'));
  it('groups Amex 4-6-5', () => expect(formatCardNumber('378282246310005')).toBe('3782 822463 10005'));
  it('supports 19 digits', () => expect(formatCardNumber('4111111111111111123')).toBe('4111 1111 1111 1111 123'));
  it('formats as you type', () => expect(formatCardNumber('41111')).toBe('4111 1'));
  it('caps at 19 digits and strips other characters', () =>
    expect(formatCardNumber('4111-1111-1111-1111-1234-99')).toBe('4111 1111 1111 1111 123'));
});

describe('checkCardNumber', () => {
  it('passes a valid number', () => expect(checkCardNumber('4111111111111111').problem).toBeNull());
  it('reports a short Amex', () => expect(checkCardNumber('37828224631').problem).toMatch(/15 digits/));
  it('reports a Luhn failure', () => expect(checkCardNumber('4111111111111112').problem).toMatch(/typo/));
});

describe('expiryState', () => {
  const now = new Date(2026, 9, 10); // 10 Oct 2026
  it('is valid well before expiry', () => expect(expiryState('08', '29', now)).toBe('valid'));
  it('is expiring within 60 days', () => expect(expiryState('11', '26', now)).toBe('expiring'));
  it('is still valid during its last month', () => expect(expiryState('10', '26', now)).toBe('expiring'));
  it('is expired after the month ends', () => expect(expiryState('09', '26', now)).toBe('expired'));
  it('rejects bad months', () => expect(expiryState('13', '27', now)).toBe('invalid'));
});

it('masks all but the last four digits', () => {
  expect(maskCardNumber('4111111111114471')).toBe('•••• 4471');
});
