import React, { forwardRef, useState } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { FONT, MONO, radius, space, type, useTheme } from '@/theme';
import { AppText } from './AppText';

interface FieldProps extends Omit<TextInputProps, 'style'> {
  label: string;
  error?: string | null;
  hint?: string | null;
  mono?: boolean;
  /** Buttons shown inside the field, at the end (reveal, regenerate…). */
  accessory?: React.ReactNode;
}

/**
 * Labelled text field. Vault fields opt out of Android autofill so the
 * system (e.g. Google Password Manager) never offers to save what's typed
 * here. Height grows with the font size instead of being fixed.
 */
export const Field = forwardRef<TextInput, FieldProps>(function Field({ label, error, hint, mono, accessory, multiline, ...input }, ref) {
  const c = useTheme();
  const [focused, setFocused] = useState(false);
  const borderColor = error ? c.danger : focused ? c.brass : c.line;

  return (
    <View style={styles.wrap}>
      <AppText variant="caption" tone="ink2" nativeID={`${label}-label`}>
        {label}
      </AppText>
      <View
        style={[
          styles.box,
          { backgroundColor: c.surface, borderColor, borderWidth: focused || error ? 2 : 1 },
          multiline && styles.multiline,
        ]}
      >
        <TextInput
          ref={ref}
          {...input}
          multiline={multiline}
          accessibilityLabel={input.accessibilityLabel ?? label}
          accessibilityLabelledBy={`${label}-label`}
          importantForAutofill="no"
          autoComplete="off"
          placeholderTextColor={c.muted}
          selectionColor={c.brass}
          cursorColor={c.brass}
          maxFontSizeMultiplier={2}
          onFocus={(e) => {
            setFocused(true);
            input.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            input.onBlur?.(e);
          }}
          style={[
            styles.input,
            mono ? { fontFamily: MONO, fontWeight: '500' } : { fontFamily: FONT, fontWeight: '500' },
            { color: c.ink },
            multiline && styles.inputMultiline,
          ]}
        />
        {accessory ? <View style={styles.accessory}>{accessory}</View> : null}
      </View>
      {error ? (
        <AppText variant="caption" tone="danger" accessibilityLiveRegion="polite">
          {error}
        </AppText>
      ) : hint ? (
        <AppText variant="caption" tone="muted">
          {hint}
        </AppText>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  box: {
    minHeight: 52,
    borderRadius: radius.field,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: space.lg - 2,
    paddingRight: space.xs,
  },
  multiline: { alignItems: 'flex-start', minHeight: 96 },
  input: { flex: 1, minWidth: 0, fontSize: type.body.fontSize, paddingVertical: space.md },
  inputMultiline: { textAlignVertical: 'top', minHeight: 88 },
  accessory: { flexDirection: 'row', alignItems: 'center' },
});
