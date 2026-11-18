// Native push plumbing: permission, Expo push token, Android channel. Web does not use push.
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { Linking, Platform } from 'react-native';

import { supabase, unwrap } from '@/lib/supabase';

export const pushSupported = Platform.OS === 'ios' || Platform.OS === 'android';

export type PushStatus = 'unsupported' | 'undetermined' | 'denied' | 'granted';

/** Show notifications that arrive while the app is open (the partner just added something). */
export function configureForegroundNotifications() {
  if (!pushSupported) return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
  });
}

export async function getPushStatus(): Promise<PushStatus> {
  if (!pushSupported) return 'unsupported';
  const { status, canAskAgain } = await Notifications.getPermissionsAsync();
  if (status === 'granted') return 'granted';
  return status === 'denied' && !canAskAgain ? 'denied' : 'undetermined';
}

function projectId(): string | undefined {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return extra?.eas?.projectId ?? Constants.easConfig?.projectId;
}

/**
 * Registers this device for push: optionally asks permission, gets the Expo push token and stores it
 * for the signed-in person. Returns the resulting permission state. Never throws; problems are logged.
 */
export async function registerForPush({ ask }: { ask: boolean }): Promise<PushStatus> {
  if (!pushSupported) return 'unsupported';
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Veedu',
        importance: AndroidImportance.DEFAULT,
      });
    }
    let status = await getPushStatus();
    if (status === 'undetermined' && ask) {
      const res = await Notifications.requestPermissionsAsync();
      status = res.status === 'granted' ? 'granted' : res.canAskAgain ? 'undetermined' : 'denied';
    }
    if (status !== 'granted') return status;

    if (!Device.isDevice) {
      console.warn('[notifications] Push tokens need a physical device; skipping registration.');
      return status;
    }
    const id = projectId();
    if (!id) {
      console.warn('[notifications] No EAS projectId (run `eas init`); skipping push registration.');
      return status;
    }
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: id });
    unwrap(await supabase.rpc('register_push_token', { p_token: token, p_platform: Platform.OS }));
    return status;
  } catch (e) {
    console.warn('[notifications] Push registration failed:', e);
    return getPushStatus();
  }
}

/** For people who said no earlier: the system only lets them change it in Settings. */
export function openSystemSettings() {
  Linking.openSettings();
}
