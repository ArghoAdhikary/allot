import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { Card, Empty, Icon, Segmented } from '../components/ui';
import { incomeVsExpense, netWorth, spendingByCategory } from '../lib/budget.ts';
import { addMonths, currentMonth, monthLabel } from '../lib/dates.ts';
import { useStore } from '../state/store';
import { useTheme } from '../theme';

type Report = 'spending' | 'income' | 'networth';

export function ReportsScreen() {
  const [report, setReport] = useState<Report>('spending');
  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
      <Segmented
        value={report}
        onChange={setReport}
        options={[
          { value: 'spending', label: 'Spending' },
          { value: 'income', label: 'Cash Flow' },
          { value: 'networth', label: 'Net Worth' },
        ]}
      />
      {report === 'spending' ? <Spending /> : report === 'income' ? <IncomeExpense /> : <NetWorth />}
    </ScrollView>
  );
}

function Spending() {
  const { data, money } = useStore();
  const t = useTheme();
  const [month, setMonth] = useState(currentMonth());
  const rows = useMemo(() => spendingByCategory(data, month), [data, month]);
  const total = rows.reduce((s, r) => s + r.amount, 0);
  const max = rows[0]?.amount ?? 1;
  const groupName = new Map(data.groups.map((g) => [g.id, g.name]));

  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <Pressable onPress={() => setMonth(addMonths(month, -1))} hitSlop={10} accessibilityLabel="Previous month">
          <Icon name="chevron-left" />
        </Pressable>
        <Text style={{ color: t.text, fontSize: 17, fontWeight: '700', minWidth: 150, textAlign: 'center' }}>{monthLabel(month)}</Text>
        <Pressable onPress={() => setMonth(addMonths(month, 1))} hitSlop={10} accessibilityLabel="Next month">
          <Icon name="chevron-right" />
        </Pressable>
      </View>
      <Card style={{ padding: 16, alignItems: 'center' }}>
        <Text style={{ color: t.muted, fontSize: 13, fontWeight: '600' }}>TOTAL SPENT</Text>
        <Text style={{ color: t.text, fontSize: 28, fontWeight: '800', fontVariant: ['tabular-nums'] }}>{money(total)}</Text>
      </Card>
      {rows.length === 0 ? (
        <Empty icon="pie-chart" title="No spending" body="Categorized outflows for this month show up here." />
      ) : (
        <Card style={{ padding: 16, gap: 14 }}>
          {rows.map((r) => (
            <View key={r.category.id}>
              <View style={{ flexDirection: 'row', marginBottom: 5 }}>
                <Text style={{ flex: 1, color: t.text, fontSize: 15 }} numberOfLines={1}>
                  {r.category.name}
                  <Text style={{ color: t.muted, fontSize: 12 }}>  {groupName.get(r.category.groupId)}</Text>
                </Text>
                <Text style={{ color: t.text, fontWeight: '600', fontVariant: ['tabular-nums'] }}>{money(r.amount)}</Text>
                <Text style={{ color: t.muted, width: 46, textAlign: 'right', fontVariant: ['tabular-nums'] }}>{Math.round((r.amount / total) * 100)}%</Text>
              </View>
              <View style={{ height: 8, borderRadius: 4, backgroundColor: t.pill, overflow: 'hidden' }}>
                <View style={{ width: `${(r.amount / max) * 100}%`, height: '100%', borderRadius: 4, backgroundColor: t.primary }} />
              </View>
            </View>
          ))}
        </Card>
      )}
    </View>
  );
}

function IncomeExpense() {
  const { data, money } = useStore();
  const t = useTheme();
  const rows = useMemo(() => incomeVsExpense(data, currentMonth(), 6), [data]);
  const max = Math.max(1, ...rows.flatMap((r) => [r.income, r.expense]));
  const income = rows.reduce((s, r) => s + r.income, 0);
  const expense = rows.reduce((s, r) => s + r.expense, 0);

  return (
    <View style={{ gap: 12 }}>
      <Card style={{ flexDirection: 'row' }}>
        <Summary label="Income (6 mo)" value={money(income)} color={t.positive} />
        <Summary label="Expenses" value={money(expense)} color={t.negative} />
        <Summary label="Net" value={money(income - expense)} color={income - expense < 0 ? t.negative : t.text} />
      </Card>
      <Card style={{ padding: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 180, gap: 8 }}>
          {rows.map((r) => (
            <View key={r.month} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 3, flex: 1 }}>
                <View style={{ width: 12, height: `${(r.income / max) * 100}%`, backgroundColor: t.positive, borderRadius: 3 }} />
                <View style={{ width: 12, height: `${(r.expense / max) * 100}%`, backgroundColor: t.negative, borderRadius: 3 }} />
              </View>
              <Text style={{ color: t.muted, fontSize: 11, marginTop: 6 }}>{monthLabel(r.month, true)}</Text>
            </View>
          ))}
        </View>
        <View style={{ flexDirection: 'row', gap: 16, justifyContent: 'center', marginTop: 12 }}>
          <Legend color={t.positive} label="Income" />
          <Legend color={t.negative} label="Expenses" />
        </View>
      </Card>
    </View>
  );
}

function NetWorth() {
  const { data, money } = useStore();
  const t = useTheme();
  const rows = useMemo(() => netWorth(data, currentMonth(), 12), [data]);
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.net)));
  const last = rows[rows.length - 1];

  return (
    <View style={{ gap: 12 }}>
      <Card style={{ flexDirection: 'row' }}>
        <Summary label="Assets" value={money(last.assets)} color={t.positive} />
        <Summary label="Debts" value={money(last.debts)} color={t.negative} />
        <Summary label="Net worth" value={money(last.net)} color={last.net < 0 ? t.negative : t.text} />
      </Card>
      <Card style={{ padding: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 180, gap: 4 }}>
          {rows.map((r) => (
            <View key={r.month} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
              <View style={{ width: '70%', height: `${(Math.abs(r.net) / max) * 100}%`, backgroundColor: r.net < 0 ? t.negative : t.primary, borderRadius: 3, minHeight: 2 }} />
              <Text style={{ color: t.muted, fontSize: 9, marginTop: 6 }}>{monthLabel(r.month, true).slice(0, 3)}</Text>
            </View>
          ))}
        </View>
      </Card>
    </View>
  );
}

function Summary({ label, value, color }: { label: string; value: string; color: string }) {
  const t = useTheme();
  return (
    <View style={{ flex: 1, padding: 12, alignItems: 'center' }}>
      <Text style={{ color: t.muted, fontSize: 12 }}>{label}</Text>
      <Text style={{ color, fontSize: 16, fontWeight: '700', fontVariant: ['tabular-nums'] }} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: color }} />
      <Text style={{ color: t.muted, fontSize: 12 }}>{label}</Text>
    </View>
  );
}
