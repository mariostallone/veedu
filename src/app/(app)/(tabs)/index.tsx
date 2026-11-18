import { Link } from 'expo-router';
import { Pressable } from 'react-native';

import { Avatar, Body, Card, Screen } from '@/components/ui';
import { useHousehold } from '@/lib/session';
import { space } from '@/theme';

// Milestone 5 replaces this with the summary: low stock, expiring soon, list counts, recent activity.
export default function Home() {
  const { household, me } = useHousehold();
  return (
    <Screen
      title={`Hi, ${me.display_name}`}
      subtitle={household.name}
      right={
        <Link href="/settings" asChild>
          <Pressable accessibilityRole="button" accessibilityLabel="Household settings" hitSlop={8}>
            <Avatar name={me.display_name} color={me.color} size={34} />
          </Pressable>
        </Link>
      }>
      <Card style={{ paddingVertical: space.lg }}>
        <Body muted>Your home summary will appear here: what’s running low, what’s expiring, and what changed.</Body>
      </Card>
    </Screen>
  );
}
