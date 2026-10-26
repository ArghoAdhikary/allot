import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { deleteTransaction, saveScheduled, saveTransaction } from '../lib/actions.ts';
import { lastCategoryForPayee } from '../lib/budget.ts';
import { addDays, dateLabel, isValidDate, nextOccurrence, today } from '../lib/dates.ts';
import { centsToInput, parseMoney } from '../lib/money.ts';
import { INCOME, type Cleared, type Frequency, type Transaction } from '../lib/types.ts';
import { useStore } from '../state/store';
import { useTheme } from '../theme';
import { CategoryPicker } from './CategoryPicker';
import { Button, Chip, Field, Icon, Label, Segmented, Sheet, confirm } from './ui';

type Kind = 'outflow' | 'inflow' | 'transfer';
type Repeat = 'never' | Frequency;

interface Props {
  visible: boolean;
  onClose: () => void;
  editing?: Transaction;
  defaultAccountId?: string;
}

/** Mounts a fresh form each time it opens, so state starts from `editing`. */
export function TransactionSheet(props: Props) {
  if (!props.visible) return null;
  return <TransactionForm key={props.editing?.id ?? 'new'} {...props} />;
}

function TransactionForm({ visible, onClose, editing, defaultAccountId }: Props) {
  const { data, update } = useStore();
  const t = useTheme();
  const openAccounts = data.accounts.filter((a) => !a.closed);

  const isTransfer = !!editing?.transferAccountId;
  const incoming = isTransfer && editing!.amount > 0;
  const [kind, setKind] = useState<Kind>(
    !editing ? 'outflow' : isTransfer ? 'transfer' : editing.amount > 0 ? 'inflow' : 'outflow',
  );
  const [amount, setAmount] = useState(editing ? centsToInput(Math.abs(editing.amount)) : '');
  const [payee, setPayee] = useState(editing?.payee ?? '');
  const [categoryId, setCategoryId] = useState<string | null>(editing?.categoryId ?? null);
  const [accountId, setAccountId] = useState(
    editing ? (incoming ? editing.transferAccountId! : editing.accountId) : defaultAccountId ?? openAccounts[0]?.id ?? '',
  );
  const [toAccountId, setToAccountId] = useState(editing ? (incoming ? editing.accountId : editing.transferAccountId ?? '') : '');
  const [date, setDate] = useState(editing?.date ?? today());
  const [memo, setMemo] = useState(editing?.memo ?? '');
  const [cleared, setCleared] = useState<Cleared>(editing?.cleared ?? 'uncleared');
  const [repeat, setRepeat] = useState<Repeat>('never');
  const [touchedCategory, setTouchedCategory] = useState(!!editing);

  const payees = useMemo(() => {
    const seen = new Map<string, string>();
    for (const tx of data.transactions) {
      if (tx.transferId || !tx.payee || tx.payee === 'Starting Balance' || tx.payee === 'Reconciliation Adjustment') continue;
      const k = tx.payee.toLowerCase();
      if (!seen.has(k)) seen.set(k, tx.payee);
    }
    return [...seen.values()];
  }, [data.transactions]);

  const q = payee.trim().toLowerCase();
  const suggestions = q ? payees.filter((p) => p.toLowerCase().includes(q) && p.toLowerCase() !== q).slice(0, 5) : [];

  const pickPayee = (p: string) => {
    setPayee(p);
    if (!touchedCategory) {
      const last = lastCategoryForPayee(data, p);
      if (last) {
        setCategoryId(last);
        if (last === INCOME) setKind('inflow');
      }
    }
  };

  const cents = parseMoney(amount);
  const account = data.accounts.find((a) => a.id === accountId);
  const needsCategory = kind !== 'transfer' && account?.onBudget;
  const valid =
    !!cents &&
    cents > 0 &&
    !!account &&
    isValidDate(date) &&
    (kind !== 'transfer' || (!!toAccountId && toAccountId !== accountId)) &&
    (!needsCategory || !!categoryId);

  const save = () => {
    if (!valid || !cents) return;
    const signed = kind === 'inflow' ? cents : -cents;
    const input = {
      id: editing?.id,
      accountId,
      date,
      payee,
      categoryId: kind === 'transfer' ? null : account?.onBudget ? categoryId : null,
      memo,
      amount: signed,
      cleared,
      transferAccountId: kind === 'transfer' ? toAccountId : undefined,
    };
    update((d) => {
      let next = saveTransaction(d, input);
      if (!editing && repeat !== 'never' && kind !== 'transfer') {
        next = saveScheduled(next, {
          accountId,
          payee,
          categoryId: input.categoryId,
          memo,
          amount: signed,
          frequency: repeat,
          nextDate: date,
        });
        // the first occurrence was just entered above; schedule the next one
        const s = next.scheduled[next.scheduled.length - 1];
        next = { ...next, scheduled: next.scheduled.map((x) => (x.id === s.id ? { ...x, nextDate: nextOccurrence(date, repeat) } : x)) };
      }
      return next;
    });
    onClose();
  };

  const remove = () =>
    confirm('Delete transaction?', 'This cannot be undone.', 'Delete', () => {
      update((d) => deleteTransaction(d, editing!.id));
      onClose();
    });

  if (!openAccounts.length) {
    return (
      <Sheet visible={visible} title="Add transaction" onClose={onClose}>
        <Text style={{ color: t.muted, fontSize: 16, lineHeight: 22, marginBottom: 16 }}>
          Add an account first — transactions live inside accounts.
        </Text>
      </Sheet>
    );
  }

  return (
    <Sheet
      visible={visible}
      title={editing ? 'Edit transaction' : 'Add transaction'}
      onClose={onClose}
      footer={
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {editing ? <Button title="Delete" kind="danger" icon="trash-2" onPress={remove} /> : null}
          <Button title="Save" onPress={save} disabled={!valid} style={{ flex: 1 }} />
        </View>
      }
    >
      <Segmented
        value={kind}
        onChange={setKind}
        options={[
          { value: 'outflow', label: 'Outflow' },
          { value: 'inflow', label: 'Inflow' },
          { value: 'transfer', label: 'Transfer' },
        ]}
      />
      <Field
        label="Amount"
        value={amount}
        onChangeText={setAmount}
        keyboardType="decimal-pad"
        placeholder="0.00"
        autoFocus={!editing}
        style={{ fontSize: 28, fontWeight: '700', minHeight: 60, color: kind === 'inflow' ? t.positive : t.text }}
      />

      <AccountChips label={kind === 'transfer' ? 'From account' : 'Account'} value={accountId} onChange={setAccountId} />

      {kind === 'transfer' ? (
        <AccountChips label="To account" value={toAccountId} onChange={setToAccountId} excludeId={accountId} />
      ) : (
        <>
          <Field label="Payee" value={payee} onChangeText={setPayee} onBlur={() => pickPayee(payee)} placeholder="Who was it?" />
          {suggestions.length ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: -8, marginBottom: 14 }}>
              {suggestions.map((s) => (
                <Chip key={s} label={s} onPress={() => pickPayee(s)} />
              ))}
            </View>
          ) : null}
          {account?.onBudget ? (
            <CategoryPicker
              label="Category"
              value={categoryId}
              includeIncome
              month={date.slice(0, 7)}
              onChange={(id) => {
                setCategoryId(id);
                setTouchedCategory(true);
              }}
            />
          ) : (
            <Text style={{ color: t.muted, marginBottom: 14 }}>Tracking accounts don&apos;t affect your budget, so no category is needed.</Text>
          )}
        </>
      )}

      <Label>Date</Label>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <Pressable onPress={() => isValidDate(date) && setDate(addDays(date, -1))} hitSlop={8} accessibilityLabel="Previous day" style={{ padding: 6 }}>
          <Icon name="chevron-left" color={t.muted} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Field label="" value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" style={{ textAlign: 'center' }} />
        </View>
        <Pressable onPress={() => isValidDate(date) && setDate(addDays(date, 1))} hitSlop={8} accessibilityLabel="Next day" style={{ padding: 6 }}>
          <Icon name="chevron-right" color={t.muted} />
        </Pressable>
      </View>
      <View style={{ flexDirection: 'row', gap: 6, marginTop: -6, marginBottom: 14, alignItems: 'center' }}>
        <Chip label="Today" active={date === today()} onPress={() => setDate(today())} />
        <Chip label="Yesterday" active={date === addDays(today(), -1)} onPress={() => setDate(addDays(today(), -1))} />
        <Text style={{ color: isValidDate(date) ? t.muted : t.negative, marginLeft: 'auto' }}>
          {isValidDate(date) ? dateLabel(date) : 'Invalid date'}
        </Text>
      </View>

      <Field label="Memo" value={memo} onChangeText={setMemo} placeholder="Optional note" />

      <Pressable
        onPress={() => setCleared(cleared === 'uncleared' ? 'cleared' : 'uncleared')}
        disabled={cleared === 'reconciled'}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 }}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: cleared !== 'uncleared' }}
      >
        <Icon name={cleared === 'uncleared' ? 'circle' : cleared === 'cleared' ? 'check-circle' : 'lock'} color={cleared === 'uncleared' ? t.muted : t.positive} />
        <Text style={{ color: t.text, fontSize: 16 }}>
          {cleared === 'reconciled' ? 'Reconciled' : cleared === 'cleared' ? 'Cleared — it shows in the bank' : 'Not cleared yet'}
        </Text>
      </Pressable>

      {!editing && kind !== 'transfer' ? (
        <>
          <Label>Repeat</Label>
          <Segmented
            value={repeat}
            onChange={setRepeat}
            options={[
              { value: 'never', label: 'Never' },
              { value: 'weekly', label: 'Weekly' },
              { value: 'biweekly', label: '2 wks' },
              { value: 'monthly', label: 'Monthly' },
              { value: 'yearly', label: 'Yearly' },
            ]}
          />
        </>
      ) : null}
    </Sheet>
  );
}

function AccountChips({
  label,
  value,
  onChange,
  excludeId,
}: {
  label: string;
  value: string;
  onChange: (id: string) => void;
  excludeId?: string;
}) {
  const { data } = useStore();
  return (
    <View style={{ marginBottom: 14 }}>
      <Label>{label}</Label>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
        {data.accounts
          .filter((a) => !a.closed && a.id !== excludeId)
          .map((a) => (
            <Chip key={a.id} label={a.name} active={a.id === value} onPress={() => onChange(a.id)} />
          ))}
      </ScrollView>
    </View>
  );
}
