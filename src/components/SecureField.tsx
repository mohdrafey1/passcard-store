import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, type TextInputProps } from 'react-native';
import { Colors, Spacing, FontSize, BorderRadius, FontFamily } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';

interface SecureFieldProps extends Omit<TextInputProps, 'style'> {
  label: string;
  value: string;
  onChangeText?: (text: string) => void;
  error?: string;
  mono?: boolean;
  copyable?: boolean;
  onCopy?: () => void;
  editable?: boolean;
}

export default function SecureField({
  label,
  value,
  onChangeText,
  error,
  mono = false,
  copyable = false,
  onCopy,
  editable = true,
  ...rest
}: SecureFieldProps) {
  const [visible, setVisible] = useState(false);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputContainer, error && styles.inputError]}>
        <TextInput
          style={[styles.input, mono && styles.monoInput]}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={!visible}
          placeholderTextColor={Colors.textMuted}
          editable={editable}
          {...rest}
        />
        <View style={styles.actions}>
          {copyable && value && (
            <TouchableOpacity onPress={onCopy} style={styles.actionButton}>
              <Ionicons name="copy-outline" size={18} color={Colors.textSecondary} />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() => setVisible(!visible)}
            style={styles.actionButton}
          >
            <Ionicons
              name={visible ? 'eye-off-outline' : 'eye-outline'}
              size={18}
              color={Colors.textSecondary}
            />
          </TouchableOpacity>
        </View>
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.base,
  },
  label: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.inputBackground,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
  },
  inputError: {
    borderColor: Colors.danger,
  },
  input: {
    flex: 1,
    height: 48,
    fontSize: FontSize.base,
    color: Colors.text,
  },
  monoInput: {
    fontFamily: FontFamily.mono,
    letterSpacing: 1,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  actionButton: {
    padding: Spacing.xs,
  },
  error: {
    fontSize: FontSize.xs,
    color: Colors.danger,
    marginTop: Spacing.xs,
  },
});
