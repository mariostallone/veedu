import { useState } from 'react';
import { View } from 'react-native';

import { Body, Button, Card, Caption, ErrorNote, Field, Screen, Segmented } from '@/components/ui';
import { signOut, useCreateHousehold, useJoinHousehold } from '@/features/household/api';
import { space } from '@/theme';

type Mode = 'create' | 'join';

export default function Onboarding() {
  const [mode, setMode] = useState<Mode>('create');
  const [displayName, setDisplayName] = useState('');
  const [householdName, setHouseholdName] = useState('');
  const [code, setCode] = useState('');
  const create = useCreateHousehold();
  const join = useJoinHousehold();
  const mutation = mode === 'create' ? create : join;

  const ready =
    displayName.trim().length > 0 && (mode === 'create' ? householdName.trim().length > 0 : code.trim().length >= 6);

  function submit() {
    if (mode === 'create') create.mutate({ name: householdName.trim(), displayName: displayName.trim() });
    else join.mutate({ code: code.trim(), displayName: displayName.trim() });
  }

  return (
    <Screen title="Set up your home" subtitle="Welcome to Veedu">
      <Segmented
        options={[
          { value: 'create', label: 'Start a household' },
          { value: 'join', label: 'Join with a code' },
        ]}
        value={mode}
        onChange={setMode}
      />
      <Card style={{ paddingVertical: space.lg, gap: space.md }}>
        <Field label="Your name" value={displayName} onChangeText={setDisplayName} placeholder="Arjun" autoCapitalize="words" />
        {mode === 'create' ? (
          <>
            <Field
              label="Household name"
              value={householdName}
              onChangeText={setHouseholdName}
              placeholder="Our home"
              autoCapitalize="words"
            />
            <Caption>You’ll get an invite code to share with your partner.</Caption>
          </>
        ) : (
          <>
            <Field
              label="Invite code"
              value={code}
              onChangeText={(t) => setCode(t.toUpperCase())}
              placeholder="6 letters and numbers"
              autoCapitalize="characters"
              maxLength={6}
            />
            <Caption>Your partner can find it under Household on their Home screen.</Caption>
          </>
        )}
        <ErrorNote error={mutation.error} />
        <Button
          label={mode === 'create' ? 'Create household' : 'Join household'}
          onPress={submit}
          disabled={!ready}
          loading={mutation.isPending}
        />
      </Card>
      <View style={{ alignItems: 'center' }}>
        <Button label="Sign out" variant="secondary" onPress={signOut} />
      </View>
      <Body muted style={{ textAlign: 'center' }}>
        Each person can be in one household.
      </Body>
    </Screen>
  );
}
