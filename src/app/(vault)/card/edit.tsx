import React, { useCallback, useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router, Stack, useLocalSearchParams, useNavigation } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { AppText } from '@/components/ui/AppText';
import { CardFace } from '@/components/ui/CardFace';
import { Field } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';
import { useCardStore } from '@/features/cards/store';
import { CARD_FACES, space, useTheme } from '@/theme';
import { CARD_COLORS, type CardColor } from '@/types/card';
import { checkCardNumber, digitsOnly, expiryState, formatCardNumber, MAX_CARD_DIGITS } from '@/utils/cards';

interface Form {
  cardNickname: string;
  cardHolderName: string;
  cardNumber: string;
  expiry: string; // "MM/YY"
  cvv: string;
  color: CardColor;
  notes: string;
}

function formatExpiryInput(raw: string, previous: string): string {
  const d = digitsOnly(raw).slice(0, 4);
  // Deleting the slash also deletes the digit before it.
  if (previous.endsWith('/') && raw.length < previous.length) return d.slice(0, 1);
  if (d.length >= 3) return `${d.slice(0, 2)}/${d.slice(2)}`;
  if (d.length === 2 && raw.length > previous.length) return `${d}/`;
  return d;
}

export default function CardEditScreen() {
  const c = useTheme();
  const navigation = useNavigation();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const existing = useCardStore((s) => (id ? s.cards.find((cd) => cd.id === id) : undefined));
  const { add, update } = useCardStore();

  const initial = useMemo<Form>(
    () => ({
      cardNickname: existing?.cardNickname ?? '',
      cardHolderName: existing?.cardHolderName ?? '',
      cardNumber: existing?.cardNumber ?? '',
      expiry: existing?.expiryMonth ? `${existing.expiryMonth}/${existing.expiryYear}` : '',
      cvv: existing?.cvv ?? '',
      color: existing?.color ?? 'navy',
      notes: existing?.notes ?? '',
    }),
    // Snapshot once; store updates must not reset typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const [form, setForm] = useState<Form>(initial);
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>({});
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof Form>(key: K, value: Form[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const numberCheck = checkCardNumber(form.cardNumber);
  const [month = '', year = ''] = form.expiry.split('/');
  const expiry = form.expiry.length === 5 ? expiryState(month, year) : 'invalid';
  const dirty = (Object.keys(form) as (keyof Form)[]).some((k) => form[k] !== initial[k]);

  usePreventRemove(dirty && !saving, ({ data }) => {
    Alert.alert('Discard changes?', 'What you typed here hasn’t been saved.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => navigation.dispatch(data.action) },
    ]);
  });

  const persist = useCallback(async () => {
    setSaving(true);
    try {
      const data = {
        cardNickname: form.cardNickname.trim(),
        cardHolderName: form.cardHolderName.trim(),
        cardNumber: digitsOnly(form.cardNumber),
        expiryMonth: month,
        expiryYear: year,
        cvv: form.cvv,
        color: form.color,
        notes: form.notes,
      };
      if (existing) {
        await update(existing.id, data);
        router.back();
      } else {
        const created = await add({ ...data, favorite: false, lastUsedAt: null });
        router.replace(`/card/${created.id}`);
      }
    } catch (e) {
      setSaving(false);
      Alert.alert('Not saved', e instanceof Error ? e.message : 'Try again.');
    }
  }, [add, existing, form, month, update, year]);

  const save = () => {
    const next: typeof errors = {};
    if (!numberCheck.complete) next.cardNumber = numberCheck.problem ?? 'Check the card number.';
    if (expiry === 'invalid') next.expiry = 'Use MM/YY, like 08/29.';
    if (form.cvv && !new RegExp(`^\\d{${numberCheck.network.cvvLength === 4 ? '3,4' : '3'}}$`).test(form.cvv)) {
      next.cvv = `${numberCheck.network.cvvLength === 4 ? '3 or 4' : '3'} digits.`;
    }
    if (Object.keys(next).length) {
      setErrors(next);
      return;
    }
    const doubts: string[] = [];
    if (!numberCheck.luhn) doubts.push('The number fails the card check, so it may have a typo.');
    if (expiry === 'expired') doubts.push('This card has already expired.');
    if (doubts.length) {
      Alert.alert('Save anyway?', doubts.join('\n'), [
        { text: 'Check again', style: 'cancel' },
        { text: 'Save', onPress: () => void persist() },
      ]);
      return;
    }
    void persist();
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: existing ? 'Edit card' : 'New card',
          headerRight: () => (
            <Pressable
              onPress={save}
              disabled={saving}
              accessibilityRole="button"
              accessibilityLabel="Save"
              style={[styles.save, { backgroundColor: c.brass, opacity: saving ? 0.5 : 1 }]}
            >
              <AppText variant="label" tone="onBrass" style={{ fontWeight: '800' }}>
                Save
              </AppText>
            </Pressable>
          ),
        }}
      />
      <KeyboardAvoidingView behavior="height" style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <CardFace
            nickname={form.cardNickname || 'New card'}
            holder={form.cardHolderName}
            number={digitsOnly(form.cardNumber)}
            expiryMonth={month}
            expiryYear={year}
            color={form.color}
            revealed
          />

          <View style={{ gap: 6 }}>
            <AppText variant="caption" tone="ink2">
              Colour
            </AppText>
            <View style={styles.swatches} accessibilityRole="radiogroup" accessibilityLabel="Card colour">
              {CARD_COLORS.map((col) => {
                const on = form.color === col;
                return (
                  <Pressable
                    key={col}
                    onPress={() => set('color', col)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: on }}
                    accessibilityLabel={CARD_FACES[col].name}
                    style={[styles.swatchOuter, { borderColor: on ? c.brass : 'transparent' }]}
                  >
                    <View style={[styles.swatch, { backgroundColor: CARD_FACES[col].bg, borderColor: CARD_FACES[col].line }]}>
                      {on ? <Icon name="check" size={16} color={CARD_FACES[col].ink} /> : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <Field label="Nickname" value={form.cardNickname} onChangeText={(t) => set('cardNickname', t)} placeholder="HDFC Regalia" autoFocus={!existing} />
          <Field label="Name on card" value={form.cardHolderName} onChangeText={(t) => set('cardHolderName', t)} autoCapitalize="characters" placeholder="Optional" />
          <Field
            label="Card number"
            value={formatCardNumber(form.cardNumber)}
            onChangeText={(t) => set('cardNumber', digitsOnly(t).slice(0, MAX_CARD_DIGITS))}
            keyboardType="number-pad"
            mono
            placeholder="0000 0000 0000 0000"
            error={errors.cardNumber}
            hint={
              form.cardNumber
                ? [numberCheck.network.id === 'unknown' ? null : numberCheck.network.name, numberCheck.complete && !numberCheck.luhn ? 'fails the card check' : null]
                    .filter(Boolean)
                    .join(' · ') || null
                : null
            }
          />
          <View style={styles.pair}>
            <View style={{ flex: 1 }}>
              <Field
                label="Expiry"
                value={form.expiry}
                onChangeText={(t) => set('expiry', formatExpiryInput(t, form.expiry))}
                keyboardType="number-pad"
                mono
                placeholder="MM/YY"
                maxLength={5}
                error={errors.expiry}
                hint={expiry === 'expired' ? 'Already expired' : expiry === 'expiring' ? 'Expires soon' : null}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Field
                label="CVV"
                value={form.cvv}
                onChangeText={(t) => set('cvv', digitsOnly(t).slice(0, 4))}
                keyboardType="number-pad"
                secureTextEntry
                mono
                placeholder={numberCheck.network.cvvLength === 4 ? '4 digits' : '3 digits'}
                error={errors.cvv}
              />
            </View>
          </View>
          <Field label="Notes" value={form.notes} onChangeText={(t) => set('notes', t)} multiline placeholder="Statement date, bank helpline…" />
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.xl, gap: space.md + 2, paddingBottom: space.huge },
  save: { minHeight: 40, paddingHorizontal: space.lg + 2, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  pair: { flexDirection: 'row', gap: space.sm + 2 },
  swatches: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' },
  swatchOuter: { borderWidth: 2, borderRadius: 14, padding: 2 },
  swatch: { width: 44, height: 44, borderRadius: 11, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
