import { useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';

import { Body, Button, Caption, ErrorNote, Field, Screen } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { space } from '@/theme';

/** Email one-time code sign-in. Works the same on iOS, Android and web, with no deep links. */
export default function SignIn() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendCode() {
    const address = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(address)) {
      setError('Enter an email address like name@example.com.');
      return;
    }
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({ email: address, options: { shouldCreateUser: true } });
    setBusy(false);
    if (error) setError(error.message);
    else setSentTo(address);
  }

  async function verify() {
    if (!sentTo) return;
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.verifyOtp({ email: sentTo, token: code.trim(), type: 'email' });
    setBusy(false);
    // On success the session listener moves the app on to household setup.
    if (error) setError(error.message);
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen title="Veedu" subtitle="வீடு · your shared home">
        <Body muted>Pantry, shopping, trips and to-dos, shared between the two of you.</Body>
        {sentTo ? (
          <View style={{ gap: space.md }}>
            <Body>We sent a code to {sentTo}.</Body>
            <Field
              label="Code from the email"
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
              maxLength={10}
              autoFocus
            />
            <ErrorNote error={error} />
            <Button label="Sign in" onPress={verify} loading={busy} disabled={code.trim().length < 6} />
            <Button
              label="Use a different email"
              variant="secondary"
              onPress={() => {
                setSentTo(null);
                setCode('');
                setError(null);
              }}
            />
          </View>
        ) : (
          <View style={{ gap: space.md }}>
            <Field
              label="Email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              textContentType="emailAddress"
              placeholder="name@example.com"
              onSubmitEditing={sendCode}
            />
            <ErrorNote error={error} />
            <Button label="Email me a code" onPress={sendCode} loading={busy} />
            <Caption>No password needed. Each sign-in uses a fresh code from your inbox.</Caption>
          </View>
        )}
      </Screen>
    </KeyboardAvoidingView>
  );
}
