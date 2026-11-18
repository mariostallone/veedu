import { onlineManager } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useSession } from '@/lib/session';
import { space, type, useColors } from '@/theme';

function useIsOnline() {
  return useSyncExternalStore(
    (cb) => onlineManager.subscribe(cb),
    () => onlineManager.isOnline(),
    () => true,
  );
}

/** Slim strip shown above the signed-in app while the device has no connection. */
export function OfflineBanner() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const online = useIsOnline();
  const { session } = useSession();
  if (online || !session) return null;
  return (
    <View
      accessible
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={[styles.bar, { backgroundColor: c.warnSoft, paddingTop: insets.top + space.sm }]}>
      <Text style={[type.caption, { color: c.warn, fontWeight: '700', textAlign: 'center' }]}>
        Offline. Changes will sync when you&apos;re back online
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { paddingHorizontal: space.lg, paddingBottom: space.sm, alignItems: 'center', justifyContent: 'center' },
});
