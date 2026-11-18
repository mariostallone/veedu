import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { Pressable, Share, Switch, Text, View } from 'react-native';

import { Avatar, Button, Caption, Card, ErrorNote, Field, Row, Screen, SectionLabel } from '@/components/ui';
import {
  signOut,
  useLeaveHousehold,
  useMembers,
  useRegenerateInviteCode,
  useRenameHousehold,
  useUpdateMyName,
} from '@/features/household/api';
import {
  useEnablePush,
  useNotificationPrefs,
  usePushStatus,
  useUpdateNotificationPrefs,
} from '@/features/notifications/api';
import { openSystemSettings } from '@/features/notifications/push';
import { DIGEST_HOURS, formatDigestHour } from '@/lib/domain';
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
  const regenerate = useRegenerateInviteCode();
  const leave = useLeaveHousehold();
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState<'regenerate' | 'leave' | null>(null);
  const prefs = useNotificationPrefs();
  const updatePrefs = useUpdateNotificationPrefs();
  const pushStatus = usePushStatus();
  const enablePush = useEnablePush();

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
        {confirming === 'regenerate' ? (
          <View style={{ alignSelf: 'stretch', gap: space.sm }}>
            <Caption style={{ textAlign: 'center' }}>The current code will stop working. Anyone you already gave it to will need the new one.</Caption>
            <ErrorNote error={regenerate.error} />
            <Button
              label="Yes, make a new code"
              variant="secondary"
              loading={regenerate.isPending}
              onPress={() => regenerate.mutate(undefined, { onSuccess: () => setConfirming(null) })}
            />
            <Button label="Cancel" variant="secondary" onPress={() => setConfirming(null)} />
          </View>
        ) : (
          <Button
            label="Make a new code"
            variant="secondary"
            onPress={() => {
              regenerate.reset();
              setConfirming('regenerate');
            }}
            style={{ alignSelf: 'stretch' }}
          />
        )}
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

      {pushStatus.data !== 'unsupported' && prefs.data ? (
        <>
          <SectionLabel>Notifications</SectionLabel>
          <Card style={{ paddingVertical: space.sm }}>
            {pushStatus.data && pushStatus.data !== 'granted' ? (
              <View style={{ paddingVertical: space.md, gap: space.sm }}>
                <Caption>
                  {pushStatus.data === 'denied'
                    ? 'Notifications are turned off for Veedu in your phone’s settings.'
                    : 'Turn on notifications to hear when your partner adds to the list.'}
                </Caption>
                <Button
                  label={pushStatus.data === 'denied' ? 'Open phone settings' : 'Turn on notifications'}
                  variant="secondary"
                  loading={enablePush.isPending}
                  onPress={() => (pushStatus.data === 'denied' ? openSystemSettings() : enablePush.mutate())}
                />
              </View>
            ) : null}
            <Row
              title="Partner activity"
              subtitle="When your partner adds items to Shopping"
              right={
                <Switch
                  accessibilityLabel="Partner activity notifications"
                  value={prefs.data.partner_activity}
                  onValueChange={(v) => updatePrefs.mutate({ partner_activity: v })}
                  trackColor={{ true: c.accent, false: c.border }}
                />
              }
            />
            <Row
              title="Daily digest"
              subtitle="Items expiring this week and to-dos due or overdue"
              last={!prefs.data.daily_digest}
              right={
                <Switch
                  accessibilityLabel="Daily digest notifications"
                  value={prefs.data.daily_digest}
                  onValueChange={(v) => updatePrefs.mutate({ daily_digest: v })}
                  trackColor={{ true: c.accent, false: c.border }}
                />
              }
            />
            {prefs.data.daily_digest ? (
              <View style={{ paddingVertical: space.md, gap: space.sm }}>
                <Caption>Send the digest at</Caption>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
                  {DIGEST_HOURS.map((h) => {
                    const on = h === prefs.data.digest_hour;
                    return (
                      <Pressable
                        key={h}
                        onPress={() => updatePrefs.mutate({ digest_hour: h })}
                        accessibilityRole="button"
                        accessibilityState={{ selected: on }}
                        style={{
                          borderWidth: 1,
                          borderRadius: 999,
                          paddingHorizontal: 12,
                          paddingVertical: 7,
                          borderColor: on ? c.accent : c.border,
                          backgroundColor: on ? c.accentSoft : c.card,
                        }}>
                        <Text style={{ color: on ? c.accent : c.text, fontWeight: '600', fontSize: 13 }}>{formatDigestHour(h)}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : null}
            <ErrorNote error={updatePrefs.error ?? enablePush.error} />
          </Card>
        </>
      ) : null}

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

      <View style={{ paddingTop: space.lg, gap: space.sm }}>
        {confirming === 'leave' ? (
          <Card style={{ paddingVertical: space.lg, gap: space.md }}>
            <Caption>
              {(members.data?.length ?? 0) > 1
                ? 'You will lose access to this household’s pantry and lists. Your partner keeps everything.'
                : 'You are the only member, so leaving deletes this household and everything in it.'}
            </Caption>
            <ErrorNote error={leave.error} />
            <Button label="Yes, leave household" variant="danger" loading={leave.isPending} onPress={() => leave.mutate()} />
            <Button label="Cancel" variant="secondary" onPress={() => setConfirming(null)} />
          </Card>
        ) : (
          <Button
            label="Leave household"
            variant="danger"
            onPress={() => {
              leave.reset();
              setConfirming('leave');
            }}
          />
        )}
        <Button label="Sign out" variant="secondary" onPress={signOut} />
      </View>
    </Screen>
  );
}
