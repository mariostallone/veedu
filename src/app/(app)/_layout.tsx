import { Stack } from 'expo-router';

import { usePushSetup } from '@/features/notifications/usePushSetup';
import { useRealtimeSync } from '@/lib/realtime';
import { useHousehold } from '@/lib/session';

/**
 * Everything behind sign-in. Feature screens outside the tabs (item editors, trip detail, …)
 * are files in this folder; set their header with <Stack.Screen options={…} /> inside the screen.
 */
export default function AppLayout() {
  const { household } = useHousehold();
  useRealtimeSync(household.id);
  usePushSetup();
  return (
    <Stack screenOptions={{ headerBackButtonDisplayMode: 'minimal' }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="settings" options={{ presentation: 'modal', title: 'Household' }} />
    </Stack>
  );
}
