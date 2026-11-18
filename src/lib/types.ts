// Row shapes for the Supabase tables in supabase/migrations. Keep in sync with the SQL.
import type { IsoDate } from './domain';

export type Household = {
  id: string;
  name: string;
  invite_code: string;
  created_at: string;
};

export type Member = {
  household_id: string;
  user_id: string;
  display_name: string;
  color: string;
  joined_at: string;
};

export type PantryItem = {
  id: string;
  household_id: string;
  name: string;
  category: string;
  unit: string;
  qty: number;
  keep_min: number;
  store: string | null;
  expires_on: IsoDate | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_by: string | null;
  updated_at: string;
};

export type ListKind = 'shopping' | 'todo' | 'trip';

export type List = {
  id: string;
  household_id: string;
  kind: ListKind;
  title: string;
  starts_on: IsoDate | null;
  budget: number | null;
  archived: boolean;
  created_by: string | null;
  created_at: string;
};

export type TripCategory = 'gifts' | 'packing' | 'bring_back';

export type ListItem = {
  id: string;
  list_id: string;
  household_id: string;
  text: string;
  qty: number;
  note: string | null;
  /** Trips only: which tab the item is on. */
  category: TripCategory | null;
  /** Shopping: store. Trips: person or group, e.g. "Amma & Appa". */
  group_name: string | null;
  owner_id: string | null;
  due_on: IsoDate | null;
  repeat_every_days: number | null;
  repeated_from: string | null;
  cost: number | null;
  pantry_item_id: string | null;
  source: 'manual' | 'pantry' | 'photo';
  done: boolean;
  done_at: string | null;
  done_by: string | null;
  position: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

/** Columns a client may set when creating a list item; the database fills the rest. */
export type NewListItem = Pick<ListItem, 'list_id' | 'text'> &
  Partial<
    Pick<
      ListItem,
      | 'qty'
      | 'note'
      | 'category'
      | 'group_name'
      | 'owner_id'
      | 'due_on'
      | 'repeat_every_days'
      | 'cost'
      | 'pantry_item_id'
      | 'source'
      | 'done'
    >
  >;

export type NewPantryItem = Pick<PantryItem, 'name'> &
  Partial<Pick<PantryItem, 'category' | 'unit' | 'qty' | 'keep_min' | 'store' | 'expires_on' | 'notes'>>;

export type NotificationPrefs = {
  user_id: string;
  household_id: string | null;
  partner_activity: boolean;
  daily_digest: boolean;
  /** Local hour of the day, 0-23, in `timezone`. */
  digest_hour: number;
  timezone: string;
};

export type PushToken = {
  id: string;
  user_id: string;
  token: string;
  platform: 'ios' | 'android' | 'web';
  household_id: string | null;
  created_at: string;
};
