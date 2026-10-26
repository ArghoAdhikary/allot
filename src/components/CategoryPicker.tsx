import { useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { computeMonth } from '../lib/budget.ts';
import { currentMonth } from '../lib/dates.ts';
import { INCOME } from '../lib/types.ts';
import { useStore } from '../state/store';
import { useTheme } from '../theme';
import { Icon, Label } from './ui';

/** Collapsible inline picker: shows the current choice; tapping expands a searchable list. */
export function CategoryPicker({
  label,
  value,
  onChange,
  includeIncome,
  excludeId,
  month = currentMonth(),
  placeholder = 'Choose a category',
}: {
  label: string;
  value: string | null;
  onChange: (id: string) => void;
  includeIncome?: boolean;
  excludeId?: string;
  month?: string;
  placeholder?: string;
}) {
  const { data, money } = useStore();
  const t = useTheme();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const budget = useMemo(() => computeMonth(data, month), [data, month]);

  const selectedName =
    value === INCOME ? 'Ready to Assign' : data.categories.find((c) => c.id === value)?.name ?? null;
  const q = query.trim().toLowerCase();

  const choose = (id: string) => {
    onChange(id);
    setOpen(false);
    setQuery('');
  };

  return (
    <View style={{ marginBottom: 14 }}>
      <Label>{label}</Label>
      <Pressable
        onPress={() => setOpen(!open)}
        accessibilityRole="button"
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          minHeight: 46,
          paddingHorizontal: 12,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: open ? t.primary : t.border,
          backgroundColor: t.surface,
        }}
      >
        <Text style={{ flex: 1, fontSize: 16, color: selectedName ? t.text : t.muted }}>{selectedName ?? placeholder}</Text>
        <Icon name={open ? 'chevron-up' : 'chevron-down'} color={t.muted} />
      </Pressable>
      {open ? (
        <View style={{ marginTop: 6, borderRadius: 10, borderWidth: 1, borderColor: t.border, backgroundColor: t.surface, overflow: 'hidden' }}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search categories"
            placeholderTextColor={t.muted}
            autoFocus
            style={{ color: t.text, padding: 12, fontSize: 15, borderBottomWidth: 1, borderColor: t.border }}
          />
          {includeIncome && (!q || 'ready to assign'.includes(q)) ? (
            <Option label="Ready to Assign" right={money(budget.readyToAssign)} onPress={() => choose(INCOME)} selected={value === INCOME} />
          ) : null}
          {budget.groups.map((g) => {
            const rows = g.rows.filter(
              (r) => !r.category.hidden && r.category.id !== excludeId && (!q || r.category.name.toLowerCase().includes(q)),
            );
            if (!rows.length) return null;
            return (
              <View key={g.group.id}>
                <Text style={{ color: t.muted, fontSize: 12, fontWeight: '700', paddingHorizontal: 12, paddingTop: 10, paddingBottom: 4, textTransform: 'uppercase' }}>
                  {g.group.name}
                </Text>
                {rows.map((r) => (
                  <Option
                    key={r.category.id}
                    label={r.category.name}
                    right={money(r.available)}
                    negative={r.available < 0}
                    selected={value === r.category.id}
                    onPress={() => choose(r.category.id)}
                  />
                ))}
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

function Option({
  label,
  right,
  onPress,
  selected,
  negative,
}: {
  label: string;
  right: string;
  onPress: () => void;
  selected?: boolean;
  negative?: boolean;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 10,
        backgroundColor: selected ? t.surfaceAlt : pressed ? t.surfaceAlt : 'transparent',
      })}
    >
      <Text style={{ flex: 1, color: t.text, fontSize: 15, fontWeight: selected ? '600' : '400' }}>{label}</Text>
      <Text style={{ color: negative ? t.negative : t.muted, fontSize: 14, fontVariant: ['tabular-nums'] }}>{right}</Text>
    </Pressable>
  );
}
