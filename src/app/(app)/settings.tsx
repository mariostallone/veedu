import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { Pressable, Share, Text, View } from 'react-native';

import { Avatar, Button, Caption, Card, ErrorNote, Field, Row, Screen, SectionLabel } from '@/components/ui';
import { signOut, useMembers, useRenameHousehold, useUpdateMyName } from '@/features/household/api';
import { useHousehold } from '@/lib/session';
import { space, useColors } from '@/theme';

export default function Settings() {
  const c = useColors();
  const { household, me, userId } = useHousehold();
  const members = useMembers();
  const rename = useRenameHousehold();
  const updateName = useUpdateMyName();
  const [householdName, setHouseholdName] = useState(household.name);
  const [myName, setMyName] = useState(me.display_name);
  const [copied, setCopied] = useState(false);

  async function copyCode() {
    await Clipboard.setStringAsync(household.invite_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function shareCode() {
    Share.share({
      message: `Join our home on Veedu. Sign in, choose "Join with a code" and enter ${household.invite_code}.`,
    });
  }

  return (
    <Screen edges={['bottom']}>
      <SectionLabel>Invite your partner</SectionLabel>
      <Card style={{ paddingVertical: space.lg, gap: space.md, alignItems: 'center' }}>
        <Pressable onPress={copyCode} accessibilityRole="button" accessibilityLabel="Copy invite code">
          <Text selectable style={{ fontSize: 34, fontWeight: '800', letterSpacing: 6, color: c.text, fontVariant: ['tabular-nums'] }}>
            {household.invite_code}
          </Text>
        </Pressable>
        <Caption>{copied ? 'Copied' : 'Tap the code to copy it'}</Caption>
        <Button label="Share invite" onPress={shareCode} style={{ alignSelf: 'stretch' }} />
      </Card>

      <SectionLabel>Members</SectionLabel>
      <Card>
        {(members.data ?? []).map((m, i, all) => (
          <Row
            key={m.user_id}
            left={<Avatar name={m.display_name} color={m.color} size={28} />}
            title={m.user_id === userId ? `${m.display_name} (you)` : m.display_name}
            last={i === all.length - 1}
          />
        ))}
      </Card>

      <SectionLabel>Names</SectionLabel>
      <Card style={{ paddingVertical: space.lg, gap: space.md }}>
        <Field label="Household name" value={householdName} onChangeText={setHouseholdName} />
        <Field label="Your name" value={myName} onChangeText={setMyName} />
        <ErrorNote error={rename.error ?? updateName.error} />
        <Button
          label="Save names"
          variant="secondary"
          loading={rename.isPending || updateName.isPending}
          disabled={
            !householdName.trim() ||
            !myName.trim() ||
            (householdName.trim() === household.name && myName.trim() === me.display_name)
          }
          onPress={() => {
            if (householdName.trim() !== household.name) rename.mutate(householdName.trim());
            if (myName.trim() !== me.display_name) updateName.mutate(myName.trim());
          }}
        />
      </Card>

      <View style={{ paddingTop: space.lg }}>
        <Button label="Sign out" variant="danger" onPress={signOut} />
      </View>
    </Screen>
  );
}
