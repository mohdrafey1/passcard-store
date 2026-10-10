import { weakPassphraseReason, weakPinReason } from '../pin-rules';

describe('weakPinReason', () => {
  it.each(['0000', '1111', '999999', '1234', '4321', '123456', '654321', '7890', '0987', '1212', '121212', '123123', '2580', '1995', '2024', '696969'])(
    'rejects %s',
    (pin) => {
      expect(weakPinReason(pin)).not.toBeNull();
    },
  );

  it.each(['4831', '9046', '305718', '820463', '1357'])('accepts %s', (pin) => {
    expect(weakPinReason(pin)).toBeNull();
  });

  it('rejects non-digits', () => {
    expect(weakPinReason('12a4')).not.toBeNull();
  });
});

describe('weakPassphraseReason', () => {
  it('requires ten characters', () => {
    expect(weakPassphraseReason('short')).not.toBeNull();
    expect(weakPassphraseReason('copper-lantern-71')).toBeNull();
  });

  it('rejects a single repeated character', () => {
    expect(weakPassphraseReason('aaaaaaaaaaaa')).not.toBeNull();
  });
});
