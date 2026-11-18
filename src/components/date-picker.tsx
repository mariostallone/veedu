// Date picker built from simple controls: quick picks plus a month calendar. Values are ISO dates.
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { ChoiceChips } from '@/components/ui';
import {
  monthGrid,
  monthTitle,
  quickPickDate,
  relativeDay,
  shiftMonth,
  toIsoDate,
  type DueQuickPick,
  type IsoDate,
} from '@/lib/domain';
import { radius, space, type, useColors } from '@/theme';

const QUICK_PICKS: { pick: DueQuickPick; label: string }[] = [
  { pick: 'today', label: 'Today' },
  { pick: 'tomorrow', label: 'Tomorrow' },
  { pick: 'weekend', label: 'This weekend' },
  { pick: 'next_week', label: 'Next week' },
];
const PICK_A_DATE = 'Pick a date';
const NO_DATE = 'No date';
const DAY_HEADERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export function DatePicker({ value, onChange }: { value: IsoDate | null; onChange: (value: IsoDate | null) => void }) {
  const c = useColors();
  const today = toIsoDate(new Date());
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => {
    const base = value ?? today;
    return { year: +base.slice(0, 4), month: +base.slice(5, 7) - 1 };
  });

  const matched = QUICK_PICKS.find((q) => quickPickDate(q.pick, today) === value);
  const selected = open ? PICK_A_DATE : value === null ? NO_DATE : (matched?.label ?? PICK_A_DATE);

  function choose(label: string | null) {
    if (label === null) return;
    if (label === NO_DATE) {
      setOpen(false);
      onChange(null);
    } else if (label === PICK_A_DATE) {
      setOpen(true);
    } else {
      const q = QUICK_PICKS.find((p) => p.label === label);
      if (q) {
        setOpen(false);
        onChange(quickPickDate(q.pick, today));
      }
    }
  }

  const nav = (delta: number, text: string, label: string) => (
    <Pressable
      onPress={() => setView((v) => shiftMonth(v.year, v.month, delta))}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      style={({ pressed }) => ({
        width: 36,
        height: 36,
        borderRadius: radius.sm,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: c.accentSoft,
        opacity: pressed ? 0.6 : 1,
      })}>
      <Text style={{ color: c.accent, fontWeight: '800', fontSize: 16 }}>{text}</Text>
    </Pressable>
  );

  return (
    <View style={{ gap: space.md }}>
      <Text style={[type.bodyStrong, { color: c.text }]}>
        {value ? `${relativeDay(value, today)} (${value})` : 'No due date'}
      </Text>
      <ChoiceChips
        options={[...QUICK_PICKS.map((q) => q.label), PICK_A_DATE, NO_DATE]}
        value={selected}
        onChange={choose}
      />
      {open ? (
        <View style={{ gap: space.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            {nav(-1, '‹', 'Previous month')}
            <Text style={[type.bodyStrong, { color: c.text }]} accessibilityRole="header">
              {monthTitle(view.year, view.month)}
            </Text>
            {nav(1, '›', 'Next month')}
          </View>
          <View style={{ flexDirection: 'row' }}>
            {DAY_HEADERS.map((d, i) => (
              <Text key={i} style={[type.caption, { flex: 1, textAlign: 'center', color: c.textMuted }]}>
                {d}
              </Text>
            ))}
          </View>
          {monthGrid(view.year, view.month).map((week, wi) => (
            <View key={wi} style={{ flexDirection: 'row' }}>
              {week.map((day, di) => {
                if (!day) return <View key={di} style={{ flex: 1, height: 40 }} />;
                const on = day === value;
                return (
                  <Pressable
                    key={di}
                    onPress={() => onChange(day)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={relativeDay(day, today) + ' ' + day}
                    style={{ flex: 1, height: 40, alignItems: 'center', justifyContent: 'center' }}>
                    <View
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 18,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: on ? c.accent : 'transparent',
                        borderWidth: day === today && !on ? 1 : 0,
                        borderColor: c.accent,
                      }}>
                      <Text style={{ color: on ? c.onAccent : c.text, fontWeight: on ? '700' : '500', fontVariant: ['tabular-nums'] }}>
                        {+day.slice(8, 10)}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}
