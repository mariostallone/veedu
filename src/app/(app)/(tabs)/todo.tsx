import { EmptyState, Screen } from '@/components/ui';

export default function TodosTab() {
  return (
    <Screen title="To-dos">
      <EmptyState title="Coming soon" message="Milestone 3 adds shared to-dos with owners, due dates and repeats." />
    </Screen>
  );
}
