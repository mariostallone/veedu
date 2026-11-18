import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';

import { notificationRoute } from '@/lib/domain';
import { useHousehold } from '@/lib/session';

import { ensurePrefsRow } from './api';
import { configureForegroundNotifications, pushSupported, registerForPush } from './push';

configureForegroundNotifications();

/**
 * Mounted once inside the signed-in app (so permission is asked after onboarding, never at first launch):
 * registers this device for push and opens the right tab when a notification is tapped.
 */
export function usePushSetup() {
  const { household, userId } = useHousehold();
  const router = useRouter();

  useEffect(() => {
    if (!pushSupported) return;
    registerForPush({ ask: true });
    ensurePrefsRow(userId, household.id).catch((e) => console.warn('[notifications] prefs row failed:', e));
  }, [household.id, userId]);

  // Covers taps while running and the tap that launched the app.
  const last = Notifications.useLastNotificationResponse();
  const handled = useRef<string | null>(null);
  useEffect(() => {
    if (!pushSupported || !last) return;
    const id = last.notification.request.identifier;
    if (handled.current === id) return;
    handled.current = id;
    const route = notificationRoute(last.notification.request.content.data);
    if (route) router.navigate(route);
  }, [last, router]);
}
