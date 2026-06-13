import React, { useState } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView, Alert } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, Spacing, BorderRadius } from '@/constants/theme';
import { useCardStore } from '@/features/cards/store';

export default function AddCardScreen() {
  const addCard = useCardStore((s) => s.add);
  const [cardHolderName, setCardHolderName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [expiryMonth, setExpiryMonth] = useState('');
  const [expiryYear, setExpiryYear] = useState('');
  const [cvv, setCvv] = useState('');
  const [cardNickname, setCardNickname] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!cardHolderName.trim()) { Alert.alert('Error', 'Card holder name is required'); return; }
    if (!cardNumber.trim() || cardNumber.replace(/\s/g, '').length < 13) { Alert.alert('Error', 'Valid card number is required'); return; }
    if (!expiryMonth.trim() || !expiryYear.trim()) { Alert.alert('Error', 'Expiry date is required'); return; }
    if (!cvv.trim() || cvv.length < 3) { Alert.alert('Error', 'Valid CVV is required'); return; }

    setSaving(true);
    try {
      await addCard({
        cardHolderName,
        cardNumber: cardNumber.replace(/\s/g, ''),
        expiryMonth,
        expiryYear,
        cvv,
        cardNickname,
        notes,
      });
      router.back();
    } catch (e) {
      Alert.alert('Error', 'Failed to save card');
    } finally {
      setSaving(false);
    }
  };

  const formatCardNumber = (text: string) => {
    const cleaned = text.replace(/\D/g, '').slice(0, 16);
    const formatted = cleaned.replace(/(.{4})/g, '$1 ').trim();
    setCardNumber(formatted);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Card</Text>
        <TouchableOpacity onPress={handleSave} disabled={saving}>
          <Text style={[styles.saveText, saving && { opacity: 0.5 }]}>Save</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.form} showsVerticalScrollIndicator={false}>
        <InputField label="Card Nickname" value={cardNickname} onChangeText={setCardNickname} placeholder="e.g. My Visa" />
        <InputField label="Card Holder Name *" value={cardHolderName} onChangeText={setCardHolderName} placeholder="e.g. John Doe" autoCapitalize="words" />
        <InputField label="Card Number *" value={cardNumber} onChangeText={formatCardNumber} placeholder="0000 0000 0000 0000" keyboardType="number-pad" maxLength={19} />
        <View style={styles.row}>
          <View style={styles.halfField}>
            <InputField label="Month *" value={expiryMonth} onChangeText={(t) => setExpiryMonth(t.replace(/\D/g, '').slice(0, 2))} placeholder="MM" keyboardType="number-pad" maxLength={2} />
          </View>
          <View style={styles.halfField}>
            <InputField label="Year *" value={expiryYear} onChangeText={(t) => setExpiryYear(t.replace(/\D/g, '').slice(0, 2))} placeholder="YY" keyboardType="number-pad" maxLength={2} />
          </View>
          <View style={styles.halfField}>
            <InputField label="CVV *" value={cvv} onChangeText={(t) => setCvv(t.replace(/\D/g, '').slice(0, 4))} placeholder="123" keyboardType="number-pad" maxLength={4} secureTextEntry />
          </View>
        </View>
        <InputField label="Notes" value={notes} onChangeText={setNotes} placeholder="Optional notes" multiline numberOfLines={3} />
      </ScrollView>
    </SafeAreaView>
  );
}

function InputField({ label, ...props }: { label: string } & React.ComponentProps<typeof TextInput>) {
  return (
    <View style={styles.fieldContainer}>
      <Text style={styles.label}>{label}</Text>
      <TextInput style={[styles.input, props.multiline && styles.inputMultiline]} placeholderTextColor={Colors.textMuted} {...props} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm },
  backButton: { padding: Spacing.xs },
  headerTitle: { fontSize: FontSize.md, fontWeight: '600', color: Colors.text },
  saveText: { fontSize: FontSize.base, fontWeight: '600', color: Colors.primary },
  form: { padding: Spacing.base, paddingBottom: Spacing['4xl'] },
  fieldContainer: { marginBottom: Spacing.base },
  label: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textSecondary, marginBottom: Spacing.xs, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { backgroundColor: Colors.inputBackground, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: Spacing.md, height: 48, fontSize: FontSize.base, color: Colors.text },
  inputMultiline: { height: 90, textAlignVertical: 'top', paddingTop: Spacing.md },
  row: { flexDirection: 'row', gap: Spacing.sm },
  halfField: { flex: 1 },
});
