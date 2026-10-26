import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button, Card, Field, Icon, Label, Sheet, confirm } from '../components/ui';
import { deleteAccount, deleteScheduled, reconcile, toggleCleared, updateAccount } from '../lib/actions.ts';
import { accountBalance } from '../lib/budget.ts';
import { dateLabel } from '../lib/dates.ts';
import { centsToInput, parseMoney } from '../lib/money.ts';
import { INCOME, type Transaction } from '../lib/types.ts';
import { useStore } from '../state/store';
import { useTheme } from '../theme';

export function RegisterScreen({
  accountId,
  onBack,
  onEdit,
}: {
  accountId: string;
  onBack: () => void;
  onEdit: (t: Transaction) => void;
}) {
  const { data, update, money } = useStore();
  const t = useTheme();
  const [query, setQuery] = useState('');
  const [reconciling, setReconciling] = useState(false);
  const [editing, setEditing] = useState(false);

  const all = accountId === 'all';
  const account = data.accounts.find((a) => a.id === accountId);
  const accountName = useMemo(() => new Map(data.accounts.map((a) => [a.id, a.name])), [data.accounts]);
  const catName = useMemo(() => new Map(data.categories.map((c) => [c.id, c.name])), [data.categories]);
  const onBudget = useMemo(() => new Set(data.accounts.filter((a) => a.onBudget).map((a) => a.id)), [data.accounts]);

  const describe = (tx: Transaction) => {
    if (tx.transferAccountId) return `Transfer ${tx.amount < 0 ? 'to' : 'from'} ${accountName.get(tx.transferAccountId) ?? '?'}`;
    if (tx.categoryId === INCOME) return 'Ready to Assign';
    if (tx.categoryId) return catName.get(tx.categoryId) ?? 'Uncategorized';
    return onBudget.has(tx.accountId) ? 'Needs a category' : '';
  };

  const q = query.trim().toLowerCase();
  const txns = useMemo(
    () =>
      data.transactions
        .filter((tx) => all || tx.accountId === accountId)
        .filter((tx) => !q || tx.payee.toLowerCase().includes(q) || tx.memo.toLowerCase().includes(q) || describe(tx).toLowerCase().includes(q))
        .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, accountId, q],
  );

  const uncategorized = txns.filter((tx) => describe(tx) === 'Needs a category').length;
  const scheduled = data.scheduled.filter((s) => all || s.accountId === accountId).sort((a, b) => a.nextDate.localeCompare(b.nextDate));

  const working = all ? data.accounts.reduce((s, a) => s + accountBalance(data, a.id), 0) : accountBalance(data, accountId);
  const cleared = all ? data.accounts.reduce((s, a) => s + accountBalance(data, a.id, true), 0) : accountBalance(data, accountId, true);

  if (!all && !account) return null;

  const header = (
    <View style={{ gap: 12, marginBottom: 12 }}>
      <Card style={{ flexDirection: 'row' }}>
        <Balance label="Cleared" value={money(cleared)} />
        <Balance label="Uncleared" value={money(working - cleared)} />
        <Balance label="Working" value={money(working)} strong />
      </Card>
      {!all ? (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button title="Reconcile" kind="secondary" icon="check-square" onPress={() => setReconciling(true)} style={{ flex: 1 }} />
          <Button title="Edit account" kind="secondary" icon="edit-2" onPress={() => setEditing(true)} style={{ flex: 1 }} />
        </View>
      ) : null}
      <View style={[styles.search, { backgroundColor: t.surface, borderColor: t.border }]}>
        <Icon name="search" size={16} color={t.muted} />
        <TextInput value={query} onChangeText={setQuery} placeholder="Search payee, category, memo" placeholderTextColor={t.muted} style={{ flex: 1, color: t.text, fontSize: 15, paddingVertical: 10 }} />
      </View>
      {uncategorized > 0 ? (
        <View style={{ backgroundColor: t.warningBg, padding: 12, borderRadius: 10 }}>
          <Text style={{ color: t.warning, fontWeight: '600' }}>
            {uncategorized} transaction{uncategorized > 1 ? 's need' : ' needs'} a category — tap to fix.
          </Text>
        </View>
      ) : null}
      {scheduled.length ? (
        <View>
          <Label>Scheduled</Label>
          <Card>
            {scheduled.map((s) => (
              <View key={s.id} style={[styles.row, { borderColor: t.border }]}>
                <Icon name="repeat" size={16} color={t.muted} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: t.text }} numberOfLines={1}>{s.payee || 'No payee'}</Text>
                  <Text style={{ color: t.muted, fontSize: 12 }}>
                    Next {dateLabel(s.nextDate)} · {s.frequency}
                  </Text>
                </View>
                <Text style={{ color: t.muted, fontVariant: ['tabular-nums'] }}>{money(s.amount)}</Text>
                <Pressable
                  hitSlop={10}
                  accessibilityLabel="Delete scheduled transaction"
                  onPress={() => confirm('Stop repeating?', 'Already-entered transactions stay.', 'Stop', () => update((d) => deleteScheduled(d, s.id)))}
                >
                  <Icon name="x-circle" size={18} color={t.muted} />
                </Pressable>
              </View>
            ))}
          </Card>
        </View>
      ) : null}
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.topBar}>
        <Pressable onPress={onBack} hitSlop={12} accessibilityRole="button" accessibilityLabel="Back" style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Icon name="chevron-left" size={24} color={t.primary} />
          <Text style={{ color: t.primary, fontSize: 16 }}>Accounts</Text>
        </Pressable>
      </View>
      <Text style={[styles.title, { color: t.text }]} numberOfLines={1}>
        {all ? 'All transactions' : account!.name}
      </Text>
      <FlatList
        data={txns}
        keyExtractor={(tx) => tx.id}
        ListHeaderComponent={header}
        contentContainerStyle={{ padding: 16, paddingTop: 8, paddingBottom: 120 }}
        ListEmptyComponent={<Text style={{ color: t.muted, textAlign: 'center', padding: 24 }}>No transactions yet.</Text>}
        renderItem={({ item: tx, index }) => {
          const showDate = index === 0 || txns[index - 1].date !== tx.date;
          const desc = describe(tx);
          return (
            <View>
              {showDate ? <Text style={[styles.date, { color: t.muted }]}>{dateLabel(tx.date)}</Text> : null}
              <Pressable onPress={() => onEdit(tx)} style={({ pressed }) => [styles.txn, { backgroundColor: pressed ? t.surfaceAlt : t.surface, borderColor: t.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: t.text, fontSize: 16 }} numberOfLines={1}>
                    {tx.transferAccountId ? desc : tx.payee || 'No payee'}
                  </Text>
                  <Text style={{ color: desc === 'Needs a category' ? t.warning : t.muted, fontSize: 13 }} numberOfLines={1}>
                    {[all ? accountName.get(tx.accountId) : null, tx.transferAccountId ? null : desc, tx.memo || null].filter(Boolean).join(' · ')}
                  </Text>
                </View>
                <Text style={{ color: tx.amount > 0 ? t.positive : t.text, fontSize: 16, fontWeight: '600', fontVariant: ['tabular-nums'] }}>{money(tx.amount)}</Text>
                <Pressable
                  onPress={() => update((d) => toggleCleared(d, tx.id))}
                  hitSlop={10}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: tx.cleared !== 'uncleared' }}
                  accessibilityLabel="Cleared"
                >
                  <Icon
                    name={tx.cleared === 'reconciled' ? 'lock' : tx.cleared === 'cleared' ? 'check-circle' : 'circle'}
                    size={18}
                    color={tx.cleared === 'uncleared' ? t.muted : t.positive}
                  />
                </Pressable>
              </Pressable>
            </View>
          );
        }}
      />
      {account ? (
        <>
          <ReconcileSheet visible={reconciling} onClose={() => setReconciling(false)} accountId={account.id} cleared={cleared} />
          <EditAccountSheet visible={editing} onClose={() => setEditing(false)} accountId={account.id} onDeleted={onBack} />
        </>
      ) : null}
    </View>
  );
}

function Balance({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  const t = useTheme();
  return (
    <View style={{ flex: 1, paddingVertical: 12, paddingHorizontal: 4, alignItems: 'center' }}>
      <Text style={{ color: t.muted, fontSize: 12 }}>{label}</Text>
      <Text style={{ color: t.text, fontSize: 14, fontWeight: strong ? '800' : '600', fontVariant: ['tabular-nums'] }} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
    </View>
  );
}

function ReconcileSheet({ visible, onClose, accountId, cleared }: { visible: boolean; onClose: () => void; accountId: string; cleared: number }) {
  const { update, money } = useStore();
  const t = useTheme();
  const [actual, setActual] = useState('');
  const cents = parseMoney(actual);
  const diff = cents === null ? 0 : cents - cleared;
  const done = () => {
    if (cents === null) return;
    update((d) => reconcile(d, accountId, cents, cleared));
    setActual('');
    onClose();
  };
  return (
    <Sheet
      visible={visible}
      title="Reconcile"
      onClose={onClose}
      footer={<Button title={diff === 0 ? 'Finish reconciling' : `Add ${money(diff)} adjustment & finish`} disabled={cents === null} onPress={done} />}
    >
      <Text style={{ color: t.text, fontSize: 16, lineHeight: 22, marginBottom: 14 }}>
        Your cleared balance in Allot is <Text style={{ fontWeight: '700' }}>{money(cleared)}</Text>. What does your bank say?
      </Text>
      <Field label="Bank balance" value={actual} onChangeText={setActual} keyboardType="numbers-and-punctuation" placeholder={centsToInput(cleared) || '0.00'} autoFocus />
      {cents !== null && diff !== 0 ? (
        <Text style={{ color: t.warning, marginBottom: 12, lineHeight: 19 }}>
          Off by {money(diff)}. Look for missing or uncleared transactions first — or finish to record an adjustment.
        </Text>
      ) : null}
    </Sheet>
  );
}

function EditAccountSheet({ visible, onClose, accountId, onDeleted }: { visible: boolean; onClose: () => void; accountId: string; onDeleted: () => void }) {
  const { data, update } = useStore();
  const account = data.accounts.find((a) => a.id === accountId)!;
  const [name, setName] = useState(account.name);
  return (
    <Sheet
      visible={visible}
      title="Edit account"
      onClose={onClose}
      footer={
        <Button
          title="Save"
          disabled={!name.trim()}
          onPress={() => {
            update((d) => updateAccount(d, accountId, { name: name.trim() }));
            onClose();
          }}
        />
      }
    >
      <Field label="Name" value={name} onChangeText={setName} />
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
        <Button
          title={account.closed ? 'Reopen' : 'Close account'}
          kind="secondary"
          style={{ flex: 1 }}
          onPress={() => {
            update((d) => updateAccount(d, accountId, { closed: !account.closed }));
            onClose();
          }}
        />
        <Button
          title="Delete"
          kind="danger"
          icon="trash-2"
          style={{ flex: 1 }}
          onPress={() =>
            confirm(`Delete "${account.name}"?`, 'All of its transactions are deleted too. This cannot be undone.', 'Delete', () => {
              onClose();
              onDeleted();
              update((d) => deleteAccount(d, accountId));
            })
          }
        />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  topBar: { paddingHorizontal: 12, paddingTop: 6, flexShrink: 0 },
  title: { fontSize: 26, fontWeight: '800', paddingHorizontal: 16, paddingTop: 6, letterSpacing: -0.4, flexShrink: 0 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  date: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', marginTop: 12, marginBottom: 6, marginLeft: 4 },
  txn: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, marginBottom: 6 },
});
