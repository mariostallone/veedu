import { TabList, TabSlot, TabTrigger, Tabs, type TabTriggerSlotProps } from 'expo-router/ui';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColors } from '@/theme';

const TABS = [
  { name: 'index', href: '/', label: 'Home' },
  { name: 'pantry', href: '/pantry', label: 'Pantry' },
  { name: 'shop', href: '/shop', label: 'Shop' },
  { name: 'trips', href: '/trips', label: 'Trips' },
  { name: 'todo', href: '/todo', label: 'To-do' },
] as const;

/** Web: a plain bottom tab bar, since the native tab bar has no web equivalent. */
export default function AppTabs() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  return (
    <Tabs style={{ flex: 1 }}>
      <TabSlot style={{ flex: 1 }} />
      <TabList
        style={[
          styles.bar,
          { backgroundColor: c.card, borderTopColor: c.border, paddingBottom: Math.max(insets.bottom, 6) },
        ]}>
        {TABS.map((t) => (
          <TabTrigger key={t.name} name={t.name} href={t.href} asChild>
            <TabButton label={t.label} />
          </TabTrigger>
        ))}
      </TabList>
    </Tabs>
  );
}

function TabButton({ label, isFocused, onPress, onLongPress }: TabTriggerSlotProps & { label: string }) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: isFocused }}
      style={styles.tab}>
      <View style={[styles.pill, isFocused && { backgroundColor: c.accentSoft }]}>
        <Text style={{ fontSize: 13, fontWeight: '700', color: isFocused ? c.accent : c.textMuted }}>{label}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 6, paddingHorizontal: 4 },
  tab: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  pill: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 },
});
