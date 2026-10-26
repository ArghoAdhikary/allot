import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CategorySheet } from '../components/CategorySheet';
import { GroupSheet } from '../components/GroupSheet';
import { AmountPill, Button, Card, Icon, Sheet, Field } from '../components/ui';
import { addGroup, assignLastMonth, assignUnderfunded } from '../lib/actions.ts';
import { computeMonth, type CategoryRow } from '../lib/budget.ts';
import { addMonths, currentMonth, monthLabel } from '../lib/dates.ts';
import { useStore } from '../state/store';
import { useTheme } from '../theme';

export function BudgetScreen() {
  const { data, update, money } = useStore();
  const t = useTheme();
  const [month, setMonth] = useState(currentMonth());
  const [showHidden, setShowHidden] = useState(false);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [groupId, setGroupId] = useState<string | null>(null);
  const [addingGroup, setAddingGroup] = useState(false);
  const [newGroup, setNewGroup] = useState('');

  const budget = useMemo(() => computeMonth(data, month), [data, month]);
  const rta = budget.readyToAssign;
  const prevAssigned = Object.keys(data.assigned[addMonths(month, -1)] ?? {}).length > 0;
  const hiddenCount = data.categories.filter((c) => c.hidden).length + data.groups.filter((g) => g.hidden).length;

  const [rtaBg, rtaFg, rtaLabel] =
    rta > 0
      ? [t.positiveBg, t.positive, 'Ready to Assign']
      : rta < 0
        ? [t.negativeBg, t.negative, 'Assigned more than you have']
        : [t.pill, t.muted, 'Every dollar has a job'];

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.monthBar}>
        <Pressable onPress={() => setMonth(addMonths(month, -1))} hitSlop={10} accessibilityLabel="Previous month" style={styles.chev}>
          <Icon name="chevron-left" size={24} />
        </Pressable>
        <Pressable onPress={() => setMonth(currentMonth())} accessibilityRole="button" accessibilityHint="Jump to this month">
          <Text style={[styles.month, { color: t.text }]}>{monthLabel(month)}</Text>
        </Pressable>
        <Pressable onPress={() => setMonth(addMonths(month, 1))} hitSlop={10} accessibilityLabel="Next month" style={styles.chev}>
          <Icon name="chevron-right" size={24} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 4, paddingBottom: 120, gap: 14 }}>
        {data.accounts.length === 0 ? (
          <View style={[styles.hint, { backgroundColor: t.surface, borderColor: t.border }]}>
            <Text style={{ color: t.text, fontWeight: '700', fontSize: 16 }}>Welcome to Allot</Text>
            <Text style={{ color: t.muted, lineHeight: 20 }}>
              Add an account in the Accounts tab — its balance lands here in Ready to Assign. Then give every dollar a job by
              tapping a category. Want to look around first? Settings → Load demo budget.
            </Text>
          </View>
        ) : null}
        <View style={[styles.rta, { backgroundColor: rtaBg }]}>
          <Text style={[styles.rtaAmount, { color: rtaFg }]}>{money(rta)}</Text>
          <Text style={{ color: rtaFg, fontWeight: '600', fontSize: 15 }}>{rtaLabel}</Text>
          {budget.overspentBefore > 0 || budget.assignedInFuture > 0 ? (
            <Text style={{ color: t.muted, fontSize: 12, marginTop: 4, textAlign: 'center' }}>
              {budget.overspentBefore > 0 ? `${money(budget.overspentBefore)} overspent in earlier months. ` : ''}
              {budget.assignedInFuture > 0 ? `${money(budget.assignedInFuture)} assigned in future months.` : ''}
            </Text>
          ) : null}
        </View>

        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button
            title={budget.totalUnderfunded > 0 ? `Fund targets · ${money(budget.totalUnderfunded)}` : 'Targets funded'}
            kind="secondary"
            icon="target"
            disabled={budget.totalUnderfunded <= 0 || rta <= 0}
            onPress={() => update((d) => assignUnderfunded(d, month))}
            style={{ flex: 1 }}
          />
          {prevAssigned && budget.totalAssigned === 0 ? (
            <Button title="Copy last month" kind="secondary" icon="copy" onPress={() => update((d) => assignLastMonth(d, month, addMonths(month, -1)))} />
          ) : null}
        </View>

        <View style={styles.colHeader}>
          <Text style={[styles.colText, { flex: 1, color: t.muted }]}>Category</Text>
          <Text style={[styles.colText, styles.assignedCol, { color: t.muted }]}>Assigned</Text>
          <Text style={[styles.colText, styles.availCol, { color: t.muted }]}>Available</Text>
        </View>

        {budget.groups
          .filter((g) => showHidden || !g.group.hidden)
          .map((g) => {
            const rows = g.rows.filter((r) => showHidden || !r.category.hidden);
            return (
              <Card key={g.group.id}>
                <Pressable
                  onPress={() => setGroupId(g.group.id)}
                  style={[styles.groupHeader, { backgroundColor: t.surfaceAlt }]}
                  accessibilityRole="button"
                  accessibilityHint="Edit group"
                >
                  <Text style={[styles.groupName, { color: t.text, opacity: g.group.hidden ? 0.5 : 1 }]} numberOfLines={1}>
                    {g.group.name}
                  </Text>
                  <Text style={[styles.groupNum, styles.assignedCol, { color: t.muted }]}>{money(g.assigned)}</Text>
                  <Text style={[styles.groupNum, styles.availCol, { color: t.muted }]}>{money(g.available)}</Text>
                </Pressable>
                {rows.length === 0 ? (
                  <Text style={{ color: t.muted, padding: 14 }}>No categories yet — tap the group to add one.</Text>
                ) : (
                  rows.map((r, i) => (
                    <CategoryLine key={r.category.id} row={r} last={i === rows.length - 1} onPress={() => setCategoryId(r.category.id)} />
                  ))
                )}
              </Card>
            );
          })}

        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button title="Add group" kind="ghost" icon="plus" onPress={() => setAddingGroup(true)} style={{ flex: 1 }} />
          {hiddenCount > 0 ? (
            <Button
              title={showHidden ? 'Hide hidden' : `Show hidden (${hiddenCount})`}
              kind="ghost"
              icon={showHidden ? 'eye-off' : 'eye'}
              onPress={() => setShowHidden(!showHidden)}
              style={{ flex: 1 }}
            />
          ) : null}
        </View>
      </ScrollView>

      <CategorySheet categoryId={categoryId} month={month} onClose={() => setCategoryId(null)} />
      <GroupSheet groupId={groupId} onClose={() => setGroupId(null)} />
      <Sheet
        visible={addingGroup}
        title="New category group"
        onClose={() => setAddingGroup(false)}
        footer={
          <Button
            title="Add group"
            disabled={!newGroup.trim()}
            onPress={() => {
              update((d) => addGroup(d, newGroup));
              setNewGroup('');
              setAddingGroup(false);
            }}
          />
        }
      >
        <Field label="Name" value={newGroup} onChangeText={setNewGroup} placeholder="e.g. Kids" autoFocus />
      </Sheet>
    </View>
  );
}

function CategoryLine({ row, last, onPress }: { row: CategoryRow; last: boolean; onPress: () => void }) {
  const { money } = useStore();
  const t = useTheme();
  const goal = row.category.goal;
  const funded = goal ? (goal.type === 'target' || goal.type === 'targetByDate' ? row.carried + row.assigned : row.assigned) : 0;
  const pct = goal && goal.amount > 0 ? Math.min(1, Math.max(0, funded / goal.amount)) : 0;
  const status = row.available < 0 ? 'Overspent' : row.underfunded > 0 ? `${money(row.underfunded)} more needed` : goal ? 'On track' : null;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.catRow,
        { borderBottomColor: t.border, borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth, backgroundColor: pressed ? t.surfaceAlt : 'transparent' },
      ]}
    >
      <View style={{ flex: 1, opacity: row.category.hidden ? 0.5 : 1 }}>
        <Text style={{ color: t.text, fontSize: 16 }} numberOfLines={1}>
          {row.category.name}
        </Text>
        {goal ? (
          <View style={[styles.progressTrack, { backgroundColor: t.pill }]}>
            <View style={{ width: `${pct * 100}%`, height: '100%', borderRadius: 2, backgroundColor: row.underfunded > 0 ? t.warning : t.positive }} />
          </View>
        ) : null}
        {status ? (
          <Text style={{ color: row.available < 0 ? t.negative : row.underfunded > 0 ? t.warning : t.muted, fontSize: 12, marginTop: 3 }}>{status}</Text>
        ) : null}
      </View>
      <Text style={[styles.assignedCol, { color: t.muted, fontSize: 14, fontVariant: ['tabular-nums'] }]} numberOfLines={1}>
        {money(row.assigned)}
      </Text>
      <View style={styles.availCol}>
        <AmountPill cents={row.available} text={money(row.available)} warn={row.underfunded > 0} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  monthBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, paddingVertical: 10 },
  chev: { padding: 4 },
  month: { fontSize: 20, fontWeight: '700', minWidth: 170, textAlign: 'center' },
  hint: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, padding: 16, gap: 6 },
  rta: { borderRadius: 16, padding: 18, alignItems: 'center' },
  rtaAmount: { fontSize: 34, fontWeight: '800', letterSpacing: -0.5, fontVariant: ['tabular-nums'] },
  colHeader: { flexDirection: 'row', paddingHorizontal: 14, marginBottom: -6 },
  colText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  assignedCol: { width: 84, textAlign: 'right' },
  availCol: { width: 100, alignItems: 'flex-end', textAlign: 'right' },
  groupHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10 },
  groupName: { flex: 1, fontSize: 14, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  groupNum: { fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'] },
  catRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, gap: 4 },
  progressTrack: { height: 4, borderRadius: 2, marginTop: 6, marginRight: 12, overflow: 'hidden' },
});
