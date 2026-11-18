import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Body, Loading, Screen } from '@/components/ui';
import { SessionProvider, useSession } from '@/lib/session';
import { isSupabaseConfigured } from '@/lib/supabase';
import { palette } from '@/theme';

export default function RootLayout() {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const c = palette[scheme];
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 } } }),
  );

  return (
    <SafeAreaProvider>
      <ThemeProvider
        value={{
          ...base,
          colors: { ...base.colors, primary: c.accent, background: c.background, card: c.card, text: c.text, border: c.border },
        }}>
        <QueryClientProvider client={queryClient}>
          <SessionProvider>
            <StatusBar style="auto" />
            {isSupabaseConfigured ? <RootNavigator /> : <SetupNeeded />}
          </SessionProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
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
