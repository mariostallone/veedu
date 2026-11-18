import { EmptyState, Screen } from '@/components/ui';

export default function PantryTab() {
  return (
    <Screen title="Pantry">
      <EmptyState title="Coming soon" message="Milestone 1 adds pantry items with counts, keep-at-least levels and expiry dates." />
    </Screen>
  );
}
