import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import { deleteCategory, moveMoney, setAssigned, updateCategory } from '../lib/actions.ts';
import { computeMonth } from '../lib/budget.ts';
import { dateLabel, monthLabel, monthOf } from '../lib/dates.ts';
import { centsToInput, parseMoney } from '../lib/money.ts';
import type { GoalType } from '../lib/types.ts';
import { useStore } from '../state/store';
import { useTheme } from '../theme';
import { CategoryPicker } from './CategoryPicker';
import { Button, Card, Field, Label, Segmented, Sheet, confirm } from './ui';

type GoalChoice = 'none' | GoalType;

export function CategorySheet({ categoryId, month, onClose }: { categoryId: string | null; month: string; onClose: () => void }) {
  if (!categoryId) return null;
  return <CategoryForm key={`${categoryId}:${month}`} categoryId={categoryId} month={month} onClose={onClose} />;
}

function CategoryForm({ categoryId, month, onClose }: { categoryId: string; month: string; onClose: () => void }) {
  const { data, update, money } = useStore();
  const t = useTheme();
  const budget = useMemo(() => computeMonth(data, month), [data, month]);
  const row = budget.groups.flatMap((g) => g.rows).find((r) => r.category.id === categoryId);

  const [assigned, setAssignedText] = useState(() => centsToInput(row?.assigned ?? 0));
  const [name, setName] = useState(row?.category.name ?? '');
  const [moveAmount, setMoveAmount] = useState(() => (row && row.available > 0 ? centsToInput(row.available) : ''));
  const [moveTo, setMoveTo] = useState<string | null>(null);
  const [goalType, setGoalType] = useState<GoalChoice>(row?.category.goal?.type ?? 'none');
  const [goalAmount, setGoalAmount] = useState(() => (row?.category.goal ? centsToInput(row.category.goal.amount) : ''));
  const [goalMonth, setGoalMonth] = useState(row?.category.goal?.month ?? '');

  if (!row) return null;
  const c = row.category;

  const activity = data.transactions
    .filter((tx) => tx.categoryId === c.id && monthOf(tx.date) === month)
    .sort((a, b) => b.date.localeCompare(a.date));

  const saveAssigned = () => {
    const v = parseMoney(assigned) ?? 0;
    update((d) => setAssigned(d, month, c.id, v));
  };
  const setAssignedTo = (v: number) => {
    setAssignedText(centsToInput(v));
    update((d) => setAssigned(d, month, c.id, v));
  };

  const moveCents = parseMoney(moveAmount);
  const move = () => {
    if (!moveTo || !moveCents) return;
    update((d) => moveMoney(d, month, c.id, moveTo, moveCents));
    onClose();
  };

  const saveGoal = () => {
    const amount = parseMoney(goalAmount) ?? 0;
    update((d) =>
      updateCategory(d, c.id, {
        goal:
          goalType === 'none' || amount <= 0
            ? undefined
            : { type: goalType, amount, month: goalType === 'targetByDate' && /^\d{4}-\d{2}$/.test(goalMonth) ? goalMonth : undefined },
      }),
    );
  };

  const close = () => {
    const nm = name.trim();
    if (nm && nm !== c.name) update((d) => updateCategory(d, c.id, { name: nm }));
    onClose();
  };

  return (
    <Sheet visible title={c.name} onClose={close}>
      <Card style={{ marginBottom: 16 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          <Stat label="From last month" value={money(row.carried)} />
          <Stat label={`Assigned in ${monthLabel(month, true)}`} value={money(row.assigned)} />
          <Stat label="Activity" value={money(row.activity)} />
          <Stat label="Available" value={money(row.available)} color={row.available < 0 ? t.negative : row.available > 0 ? t.positive : t.muted} />
        </View>
      </Card>

      <Field label="Assigned this month" value={assigned} onChangeText={setAssignedText} onBlur={saveAssigned} onSubmitEditing={saveAssigned} keyboardType="decimal-pad" placeholder="0.00" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: -6, marginBottom: 18 }}>
        {row.underfunded > 0 ? (
          <Button title={`Assign ${money(row.underfunded)} for target`} kind="secondary" onPress={() => setAssignedTo(row.assigned + row.underfunded)} />
        ) : null}
        {row.available < 0 ? (
          <Button title="Cover overspending" kind="secondary" onPress={() => setAssignedTo(row.assigned - row.available)} />
        ) : null}
        {budget.readyToAssign > 0 ? (
          <Button title={`Add all ${money(budget.readyToAssign)}`} kind="ghost" onPress={() => setAssignedTo(row.assigned + budget.readyToAssign)} />
        ) : null}
      </View>

      <Label>Move money</Label>
      <Field label="" value={moveAmount} onChangeText={setMoveAmount} keyboardType="decimal-pad" placeholder="Amount to move" />
      <CategoryPicker label="To" value={moveTo} onChange={setMoveTo} excludeId={c.id} month={month} />
      <Button title="Move" kind="secondary" icon="arrow-right" disabled={!moveTo || !moveCents || moveCents <= 0} onPress={move} style={{ marginBottom: 22 }} />

      <Label>Target</Label>
      <Segmented
        value={goalType}
        onChange={setGoalType}
        options={[
          { value: 'none', label: 'None' },
          { value: 'monthly', label: 'Monthly' },
          { value: 'target', label: 'Balance' },
          { value: 'targetByDate', label: 'By date' },
        ]}
      />
      {goalType !== 'none' ? (
        <>
          <Text style={{ color: t.muted, marginBottom: 10, lineHeight: 19 }}>
            {goalType === 'monthly'
              ? 'Assign this much every month (bills, groceries).'
              : goalType === 'target'
                ? 'Build up to this balance and keep it there (emergency fund).'
                : 'Save this total by a month — Allot spreads it evenly (holidays, gifts).'}
          </Text>
          <Field label="Amount" value={goalAmount} onChangeText={setGoalAmount} keyboardType="decimal-pad" placeholder="0.00" />
          {goalType === 'targetByDate' ? (
            <Field label="By month (YYYY-MM)" value={goalMonth} onChangeText={setGoalMonth} placeholder="2027-06" autoCapitalize="none" />
          ) : null}
        </>
      ) : null}
      <Button title="Save target" kind="secondary" icon="target" onPress={saveGoal} style={{ marginBottom: 22 }} />

      {activity.length ? (
        <>
          <Label>Activity in {monthLabel(month)}</Label>
          <Card style={{ marginBottom: 22 }}>
            {activity.map((tx) => (
              <View key={tx.id} style={{ flexDirection: 'row', padding: 12, borderBottomWidth: 0.5, borderColor: t.border }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: t.text }} numberOfLines={1}>{tx.payee || 'No payee'}</Text>
                  <Text style={{ color: t.muted, fontSize: 12 }}>
                    {dateLabel(tx.date)} · {data.accounts.find((a) => a.id === tx.accountId)?.name}
                  </Text>
                </View>
                <Text style={{ color: tx.amount < 0 ? t.text : t.positive, fontVariant: ['tabular-nums'] }}>{money(tx.amount)}</Text>
              </View>
            ))}
          </Card>
        </>
      ) : null}

      <Field label="Name" value={name} onChangeText={setName} />
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
        <Button
          title={c.hidden ? 'Unhide' : 'Hide'}
          kind="secondary"
          icon={c.hidden ? 'eye' : 'eye-off'}
          onPress={() => update((d) => updateCategory(d, c.id, { hidden: !c.hidden }))}
          style={{ flex: 1 }}
        />
        <Button
          title="Delete"
          kind="danger"
          icon="trash-2"
          style={{ flex: 1 }}
          onPress={() =>
            confirm(
              `Delete "${c.name}"?`,
              'Its transactions become uncategorized and its assigned money goes back to Ready to Assign.',
              'Delete',
              () => {
                onClose();
                update((d) => deleteCategory(d, c.id));
              },
            )
          }
        />
      </View>
    </Sheet>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  const t = useTheme();
  return (
    <View style={{ width: '50%', padding: 12 }}>
      <Text style={{ color: t.muted, fontSize: 12 }}>{label}</Text>
      <Text style={{ color: color ?? t.text, fontSize: 18, fontWeight: '700', marginTop: 2, fontVariant: ['tabular-nums'] }}>{value}</Text>
    </View>
  );
}
