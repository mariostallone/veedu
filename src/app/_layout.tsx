import { useQueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { useColorScheme, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { OfflineBanner } from '@/components/offline-banner';
import { Body, Loading, Screen } from '@/components/ui';
import { registerListMutationDefaults } from '@/features/lists/api';
import { registerPantryMutationDefaults } from '@/features/pantry/api';
import {
  CACHE_MAX_AGE,
  cacheKey,
  connectOnlineManager,
  createQueryClient,
  dehydrateOptions,
  persister,
} from '@/lib/offline';
import { SessionProvider, useSession } from '@/lib/session';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { palette } from '@/theme';

export default function RootLayout() {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const c = palette[scheme];
  const [queryClient] = useState(() => {
    connectOnlineManager();
    const client = createQueryClient();
    // Defaults must exist before the persisted cache is restored so queued changes can resume.
    registerListMutationDefaults(client);
    registerPantryMutationDefaults(client);
    return client;
  });

  return (
    <SafeAreaProvider>
      <ThemeProvider
        value={{
          ...base,
          colors: { ...base.colors, primary: c.accent, background: c.background, card: c.card, text: c.text, border: c.border },
        }}>
        <PersistQueryClientProvider
          client={queryClient}
          persistOptions={{ persister, maxAge: CACHE_MAX_AGE, buster: cacheKey, dehydrateOptions }}
          onSuccess={() => {
            // Replay changes made offline before the app was closed, then refresh from the server.
            queryClient
              .resumePausedMutations()
              .then(() => queryClient.invalidateQueries())
              .catch(() => {});
          }}>
          <SessionProvider>
            <CacheGuard />
            <StatusBar style="auto" />
            <View style={{ flex: 1 }}>
              <OfflineBanner />
              {isSupabaseConfigured ? <RootNavigator /> : <SetupNeeded />}
            </View>
          </SessionProvider>
        </PersistQueryClientProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

/** Wipes the persisted cache and any queued changes on sign-out, so nothing leaks to the next person. */
function CacheGuard() {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event !== 'SIGNED_OUT') return;
      queryClient.getMutationCache().clear();
      queryClient.clear();
      persister.removeClient();
    });
    return () => data.subscription.unsubscribe();
  }, [queryClient]);
  return null;
}

/** Routes people to sign-in, household setup, or the app, based on where they are. */
function RootNavigator() {
  const { loading, session, household } = useSession();
  if (loading) return <Loading />;
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="sign-in" />
      </Stack.Protected>
      <Stack.Protected guard={!!session && !household}>
        <Stack.Screen name="onboarding" />
      </Stack.Protected>
      <Stack.Protected guard={!!session && !!household}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
    </Stack>
  );
}

function SetupNeeded() {
  return (
    <Screen title="Connect Supabase">
      <Body>
        Veedu needs a Supabase project. Copy .env.example to .env, fill in EXPO_PUBLIC_SUPABASE_URL and
        EXPO_PUBLIC_SUPABASE_ANON_KEY, then restart the dev server. The README has the full steps.
      </Body>
    </Screen>
  );
}
