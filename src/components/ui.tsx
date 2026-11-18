// Shared building blocks. Feature screens compose these instead of styling from scratch.
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { initials } from '@/lib/domain';
import { radius, space, type, useColors } from '@/theme';

// ---------------------------------------------------------------------------
// Layout

/** Full-screen scrollable page with the large title used on every tab. */
export function Screen({
  title,
  subtitle,
  right,
  children,
  scroll = true,
  edges = ['top'],
}: {
  title?: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
  scroll?: boolean;
  edges?: ('top' | 'bottom')[];
}) {
  const c = useColors();
  const header = title ? (
    <View style={styles.header}>
      <View style={{ flex: 1 }}>
        {subtitle ? <Text style={[type.caption, { color: c.textMuted }]}>{subtitle}</Text> : null}
        <Text style={[type.title, { color: c.text }]} accessibilityRole="header">
          {title}
        </Text>
      </View>
      {right}
    </View>
  ) : null;
  return (
    <SafeAreaView edges={edges} style={{ flex: 1, backgroundColor: c.background }}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          contentInsetAdjustmentBehavior="automatic">
          {header}
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.content, { flex: 1 }]}>
          {header}
          {children}
        </View>
      )}
    </SafeAreaView>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const c = useColors();
  return (
    <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }, style]}>{children}</View>
  );
}

export function SectionLabel({ children, right }: { children: ReactNode; right?: ReactNode }) {
  const c = useColors();
  return (
    <View style={styles.sectionLabel}>
      <Text style={[type.label, { color: c.textMuted, flex: 1 }]}>{children}</Text>
      {right}
    </View>
  );
}

/** A row inside a Card. Pass `last` on the final row to drop its divider. */
export function Row({
  title,
  subtitle,
  left,
  right,
  onPress,
  last,
  muted,
  titleStyle,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  left?: ReactNode;
  right?: ReactNode;
  onPress?: () => void;
  last?: boolean;
  /** Strike-through, greyed title (e.g. checked items). */
  muted?: boolean;
  titleStyle?: StyleProp<TextStyle>;
}) {
  const c = useColors();
  const body = (
    <View style={[styles.row, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderColor: c.border }]}>
      {left}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          style={[
            type.bodyStrong,
            { color: muted ? c.textMuted : c.text },
            muted && { textDecorationLine: 'line-through' },
            titleStyle,
          ]}
          numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? (
          typeof subtitle === 'string' ? (
            <Text style={[type.caption, { color: c.textMuted }]} numberOfLines={2}>
              {subtitle}
            </Text>
          ) : (
            subtitle
          )
        ) : null}
      </View>
      {right}
    </View>
  );
  return onPress ? (
    <Pressable onPress={onPress} style={({ pressed }) => pressed && { opacity: 0.6 }} accessibilityRole="button">
      {body}
    </Pressable>
  ) : (
    body
  );
}

// ---------------------------------------------------------------------------
// Text

export function Body({ children, muted, style }: { children: ReactNode; muted?: boolean; style?: StyleProp<TextStyle> }) {
  const c = useColors();
  return <Text style={[type.body, { color: muted ? c.textMuted : c.text }, style]}>{children}</Text>;
}

export function Caption({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  const c = useColors();
  return <Text style={[type.caption, { color: c.textMuted }, style]}>{children}</Text>;
}

// ---------------------------------------------------------------------------
// Controls

type ChipTone = 'neutral' | 'accent' | 'warn' | 'danger';

export function Chip({ label, tone = 'neutral' }: { label: string; tone?: ChipTone }) {
  const c = useColors();
  const tones: Record<ChipTone, [string, string]> = {
    neutral: [c.border, c.textMuted],
    accent: [c.accentSoft, c.accent],
    warn: [c.warnSoft, c.warn],
    danger: [c.dangerSoft, c.danger],
  };
  const [bg, fg] = tones[tone];
  return (
    <View style={[styles.chip, { backgroundColor: bg }]}>
      <Text style={{ color: fg, fontSize: 11, fontWeight: '700' }}>{label}</Text>
    </View>
  );
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useColors();
  const bg = variant === 'primary' ? c.accent : variant === 'danger' ? c.dangerSoft : c.accentSoft;
  const fg = variant === 'primary' ? c.onAccent : variant === 'danger' ? c.danger : c.accent;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading }}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, opacity: disabled ? 0.5 : pressed ? 0.8 : 1 },
        style,
      ]}>
      {loading ? <ActivityIndicator color={fg} /> : <Text style={[type.bodyStrong, { color: fg }]}>{label}</Text>}
    </Pressable>
  );
}

export function Field({ label, error, style, ...input }: TextInputProps & { label?: string; error?: string | null }) {
  const c = useColors();
  return (
    <View style={{ gap: space.xs }}>
      {label ? <Text style={[type.caption, { color: c.textMuted, fontWeight: '600' }]}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={c.textMuted}
        {...input}
        style={[
          styles.input,
          { backgroundColor: c.inputBackground, borderColor: error ? c.danger : c.border, color: c.text },
          style,
        ]}
      />
      {error ? <Text style={[type.caption, { color: c.danger }]}>{error}</Text> : null}
    </View>
  );
}

export function Avatar({ name, color, size = 22 }: { name: string; color: string; size?: number }) {
  return (
    <View
      accessibilityLabel={name}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Text style={{ color: '#FFFFFF', fontSize: size * 0.45, fontWeight: '700' }}>{initials(name)}</Text>
    </View>
  );
}

export function Checkbox({ checked, onChange, label }: { checked: boolean; onChange: (next: boolean) => void; label: string }) {
  const c = useColors();
  return (
    <Pressable
      onPress={() => onChange(!checked)}
      hitSlop={10}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      style={[
        styles.checkbox,
        { borderColor: checked ? c.accent : c.border, backgroundColor: checked ? c.accent : 'transparent' },
      ]}>
      {checked ? <Text style={{ color: c.onAccent, fontWeight: '800', fontSize: 13 }}>✓</Text> : null}
    </Pressable>
  );
}

export function Stepper({
  value,
  onChange,
  label,
}: {
  value: number;
  onChange: (delta: number) => void;
  label: string;
}) {
  const c = useColors();
  const btn = (delta: number, text: string) => (
    <Pressable
      onPress={() => onChange(delta)}
      disabled={delta < 0 && value <= 0}
      accessibilityRole="button"
      accessibilityLabel={`${delta > 0 ? 'Add one' : 'Remove one'} ${label}`}
      hitSlop={6}
      style={({ pressed }) => [styles.stepBtn, { backgroundColor: c.accentSoft, opacity: pressed ? 0.6 : 1 }]}>
      <Text style={{ color: c.accent, fontWeight: '800', fontSize: 16 }}>{text}</Text>
    </Pressable>
  );
  return (
    <View style={[styles.stepper, { borderColor: c.border }]}>
      {btn(-1, '−')}
      <Text style={{ minWidth: 30, textAlign: 'center', fontWeight: '700', color: c.text, fontVariant: ['tabular-nums'] }}>
        {Number.isInteger(value) ? value : value.toFixed(1)}
      </Text>
      {btn(1, '+')}
    </View>
  );
}

/** Segmented control, e.g. Mine / Partner / Everyone. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  const c = useColors();
  return (
    <View style={[styles.segmented, { backgroundColor: c.border }]} accessibilityRole="tablist">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            style={[styles.segment, on && { backgroundColor: c.card }]}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: on ? c.text : c.textMuted }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Horizontal row of tappable suggestion chips (stores, categories, quick-add items). */
export function ChoiceChips({
  options,
  value,
  onChange,
}: {
  options: readonly string[];
  value: string | null;
  onChange: (value: string | null) => void;
}) {
  const c = useColors();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
      {options.map((o) => {
        const on = o === value;
        return (
          <Pressable
            key={o}
            onPress={() => onChange(on ? null : o)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            style={[
              styles.choice,
              { borderColor: on ? c.accent : c.border, backgroundColor: on ? c.accentSoft : c.card },
            ]}>
            <Text style={{ color: on ? c.accent : c.text, fontWeight: '600', fontSize: 13 }}>{o}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Thin progress bar; turns red when `danger`. */
export function ProgressBar({ value, danger }: { value: number; danger?: boolean }) {
  const c = useColors();
  const pct = Math.max(0, Math.min(1, value));
  return (
    <View style={{ height: 5, borderRadius: 3, backgroundColor: c.border, overflow: 'hidden' }}>
      <View style={{ width: `${pct * 100}%`, height: '100%', backgroundColor: danger ? c.danger : c.accent }} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// States

export function EmptyState({ title, message, action }: { title: string; message?: string; action?: ReactNode }) {
  const c = useColors();
  return (
    <View style={styles.empty}>
      <Text style={[type.heading, { color: c.text, textAlign: 'center' }]}>{title}</Text>
      {message ? <Text style={[type.body, { color: c.textMuted, textAlign: 'center' }]}>{message}</Text> : null}
      {action}
    </View>
  );
}

export function Loading() {
  const c = useColors();
  return (
    <View style={[styles.center, { backgroundColor: c.background }]}>
      <ActivityIndicator color={c.accent} />
    </View>
  );
}

export function ErrorNote({ error }: { error: unknown }) {
  const c = useColors();
  if (!error) return null;
  const message = error instanceof Error ? error.message : String(error);
  return (
    <View style={[styles.errorBox, { backgroundColor: c.dangerSoft }]}>
      <Text style={[type.caption, { color: c.danger }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, paddingBottom: 120, gap: space.md },
  header: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm, paddingBottom: space.xs },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.lg, paddingHorizontal: space.md },
  sectionLabel: { flexDirection: 'row', alignItems: 'center', paddingTop: space.sm, paddingHorizontal: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  chip: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill },
  button: { minHeight: 48, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.lg },
  input: { minHeight: 48, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space.md, fontSize: 16 },
  checkbox: { width: 24, height: 24, borderRadius: 7, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  stepper: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 10, overflow: 'hidden' },
  stepBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  segmented: { flexDirection: 'row', borderRadius: 10, padding: 3, gap: 3 },
  segment: { flex: 1, alignItems: 'center', paddingVertical: 7, borderRadius: 8 },
  choice: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 7 },
  empty: { alignItems: 'center', gap: space.sm, paddingVertical: space.xxl, paddingHorizontal: space.lg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorBox: { borderRadius: radius.md, padding: space.md },
});
