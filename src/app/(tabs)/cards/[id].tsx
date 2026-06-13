import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, Spacing, BorderRadius } from '@/constants/theme';
import { useCardStore } from '@/features/cards/store';
import { useSettingsStore } from '@/features/settings/store';
import { copyToClipboard } from '@/utils/clipboard';
import { shareCard } from '@/utils/share';
import { cardRepository } from '@/storage/card-repository';
import type { CardEntry } from '@/types/card';

export default function CardDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [entry, setEntry] = useState<CardEntry | null>(null);
  const [editing, setEditing] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [cardHolderName, setCardHolderName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [expiryMonth, setExpiryMonth] = useState('');
  const [expiryYear, setExpiryYear] = useState('');
  const [cvv, setCvv] = useState('');
  const [cardNickname, setCardNickname] = useState('');
  const [notes, setNotes] = useState('');
  const updateCard = useCardStore((s) => s.update);
  const removeCard = useCardStore((s) => s.remove);
  const clipboardDuration = useSettingsStore((s) => s.clipboardClearDuration);

  useEffect(() => { loadEntry(); }, [id]);

  async function loadEntry() {
    if (!id) return;
    const e = await cardRepository.findById(id);
    if (e) {
      setEntry(e);
      setCardHolderName(e.cardHolderName); setCardNumber(e.cardNumber);
      setExpiryMonth(e.expiryMonth); setExpiryYear(e.expiryYear);
      setCvv(e.cvv); setCardNickname(e.cardNickname); setNotes(e.notes);
    }
  }

  const handleSave = async () => {
    if (!id || !cardHolderName.trim() || !cardNumber.trim()) { Alert.alert('Error', 'Required fields missing'); return; }
    await updateCard(id, { cardHolderName, cardNumber: cardNumber.replace(/\s/g, ''), expiryMonth, expiryYear, cvv, cardNickname, notes });
    setEditing(false);
    loadEntry();
  };

  const handleDelete = () => {
    Alert.alert('Delete Card', 'Delete this card?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { if (id) { await removeCard(id); router.back(); } } },
    ]);
  };

  const handleCopy = (text: string, label: string) => {
    copyToClipboard(text, clipboardDuration);
    Alert.alert('Copied', `${label} copied`);
  };

  if (!entry) return <View style={styles.container} />;

  const maskValue = (val: string) => revealed ? val : '•'.repeat(val.length);
  const maskedCardNumber = revealed ? cardNumber.replace(/(.{4})/g, '$1 ').trim() : `•••• •••• •••• ${cardNumber.slice(-4)}`;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{editing ? 'Edit Card' : 'Card Details'}</Text>
        {editing ? (
          <TouchableOpacity onPress={handleSave}><Text style={styles.saveText}>Save</Text></TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={() => setEditing(true)}><Ionicons name="create-outline" size={22} color={Colors.primary} /></TouchableOpacity>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.form} showsVerticalScrollIndicator={false}>
        {!editing && (
          <TouchableOpacity onPress={() => setRevealed(!revealed)} style={styles.revealButton}>
            <Ionicons name={revealed ? 'eye-off' : 'eye'} size={18} color={Colors.primary} />
            <Text style={styles.revealText}>{revealed ? 'Hide' : 'Reveal'} Details</Text>
          </TouchableOpacity>
        )}

        <DetailRow label="Nickname" value={editing ? cardNickname : (cardNickname || 'Not set')} editing={editing} onChangeText={setCardNickname} />
        <DetailRow label="Card Holder" value={editing ? cardHolderName : cardHolderName} editing={editing} onChangeText={setCardHolderName} />
        <DetailRow label="Card Number" value={editing ? cardNumber : maskedCardNumber} editing={editing} onChangeText={setCardNumber} onCopy={!editing ? () => handleCopy(cardNumber, 'Card Number') : undefined} mono />
        <View style={styles.row}>
          <DetailRow label="Month" value={editing ? expiryMonth : (revealed ? expiryMonth : '••')} editing={editing} onChangeText={setExpiryMonth} half />
          <DetailRow label="Year" value={editing ? expiryYear : (revealed ? expiryYear : '••')} editing={editing} onChangeText={setExpiryYear} half />
          <DetailRow label="CVV" value={editing ? cvv : maskValue(cvv)} editing={editing} onChangeText={setCvv} onCopy={!editing ? () => handleCopy(cvv, 'CVV') : undefined} half secure={editing} />
        </View>
        <DetailRow label="Notes" value={editing ? notes : (notes || 'No notes')} editing={editing} onChangeText={setNotes} multiline />

        {!editing && (
          <View style={styles.actions}>
            <TouchableOpacity style={styles.actionBtn} onPress={() => entry && shareCard(entry)}>
              <Ionicons name="share-outline" size={20} color={Colors.primary} />
              <Text style={styles.actionText}>Share</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, styles.dangerBtn]} onPress={handleDelete}>
              <Ionicons name="trash-outline" size={20} color={Colors.danger} />
              <Text style={[styles.actionText, { color: Colors.danger }]}>Delete</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function DetailRow({ label, value, editing, onChangeText, onCopy, multiline, mono, half, secure }: {
  label: string; value: string; editing: boolean; onChangeText?: (t: string) => void;
  onCopy?: () => void; multiline?: boolean; mono?: boolean; half?: boolean; secure?: boolean;
}) {
  return (
    <View style={[drStyles.container, half && drStyles.half]}>
      <View style={drStyles.labelRow}>
        <Text style={drStyles.label}>{label}</Text>
        {onCopy && <TouchableOpacity onPress={onCopy}><Ionicons name="copy-outline" size={14} color={Colors.textSecondary} /></TouchableOpacity>}
      </View>
      {editing ? (
        <TextInput style={[drStyles.input, multiline && drStyles.multiline, mono && drStyles.mono]} value={value} onChangeText={onChangeText} placeholderTextColor={Colors.textMuted} multiline={multiline} secureTextEntry={secure} />
      ) : (
        <Text style={[drStyles.value, mono && drStyles.mono, !value && drStyles.empty]}>{value}</Text>
      )}
    </View>
  );
}

const drStyles = StyleSheet.create({
  container: { marginBottom: Spacing.base },
  half: { flex: 1 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.xs },
  label: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { backgroundColor: Colors.inputBackground, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: Spacing.md, height: 48, fontSize: FontSize.base, color: Colors.text },
  multiline: { height: 90, textAlignVertical: 'top', paddingTop: Spacing.md },
  value: { fontSize: FontSize.base, color: Colors.text, paddingVertical: Spacing.xs },
  mono: { fontFamily: 'monospace', letterSpacing: 1 },
  empty: { color: Colors.textMuted, fontStyle: 'italic' },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm },
  headerTitle: { fontSize: FontSize.md, fontWeight: '600', color: Colors.text },
  saveText: { fontSize: FontSize.base, fontWeight: '600', color: Colors.primary },
  form: { padding: Spacing.base, paddingBottom: Spacing['4xl'] },
  revealButton: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.lg, alignSelf: 'flex-start' },
  revealText: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.primary },
  row: { flexDirection: 'row', gap: Spacing.sm },
  actions: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.xl },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, paddingVertical: Spacing.md, borderRadius: BorderRadius.md, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  dangerBtn: { borderColor: Colors.danger + '40' },
  actionText: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.primary },
});
