import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { Button, Card, Empty, Field, ListRow, Segmented, Sheet, Label } from '../components/ui';
import { addAccount } from '../lib/actions.ts';
import { accountBalance } from '../lib/budget.ts';
import { parseMoney } from '../lib/money.ts';
import type { Account, AccountType } from '../lib/types.ts';
import { useStore } from '../state/store';
import { useTheme } from '../theme';

const TYPE_LABEL: Record<AccountType, string> = {
  checking: 'Checking',
  savings: 'Savings',
  cash: 'Cash',
  credit: 'Credit card',
  tracking: 'Tracking',
};

const TYPE_ICON = { checking: 'credit-card', savings: 'archive', cash: 'dollar-sign', credit: 'credit-card', tracking: 'trending-up' } as const;

export function AccountsScreen({ onOpen }: { onOpen: (accountId: string) => void }) {
  const { data, money } = useStore();
  const t = useTheme();
  const [adding, setAdding] = useState(false);
  const [showClosed, setShowClosed] = useState(false);

  const bal = (a: Account) => accountBalance(data, a.id);
  const budgetAccts = data.accounts.filter((a) => a.onBudget && !a.closed);
  const trackingAccts = data.accounts.filter((a) => !a.onBudget && !a.closed);
  const closed = data.accounts.filter((a) => a.closed);
  const sum = (list: Account[]) => list.reduce((s, a) => s + bal(a), 0);
  const net = sum(data.accounts);

  const section = (title: string, list: Account[]) =>
    list.length ? (
      <View style={{ gap: 6 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4 }}>
          <Label>{title}</Label>
          <Text style={{ color: t.muted, fontWeight: '600', fontVariant: ['tabular-nums'] }}>{money(sum(list))}</Text>
        </View>
        <Card>
          {list.map((a) => {
            const b = bal(a);
            return (
              <ListRow
                key={a.id}
                icon={TYPE_ICON[a.type]}
                title={a.name}
                subtitle={TYPE_LABEL[a.type]}
                onPress={() => onOpen(a.id)}
                right={<Text style={{ color: b < 0 ? t.negative : t.text, fontWeight: '600', fontSize: 16, fontVariant: ['tabular-nums'] }}>{money(b)}</Text>}
              />
            );
          })}
        </Card>
      </View>
    ) : null;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120, gap: 18 }}>
        {data.accounts.length === 0 ? (
          <Empty
            icon="credit-card"
            title="Add your first account"
            body="Start with the money you have right now — a bank account, savings, or cash. Its balance becomes money you can assign."
            action={<Button title="Add account" icon="plus" onPress={() => setAdding(true)} />}
          />
        ) : (
          <>
            <Card style={{ padding: 16, alignItems: 'center' }}>
              <Text style={{ color: t.muted, fontSize: 13, fontWeight: '600' }}>NET WORTH</Text>
              <Text style={{ color: net < 0 ? t.negative : t.text, fontSize: 30, fontWeight: '800', fontVariant: ['tabular-nums'] }}>{money(net)}</Text>
            </Card>
            {section('Budget', budgetAccts)}
            {section('Tracking', trackingAccts)}
            <ListRow icon="list" title="All transactions" onPress={() => onOpen('all')} />
            {closed.length ? (
              showClosed ? section('Closed', closed) : <Button title={`Show closed (${closed.length})`} kind="ghost" onPress={() => setShowClosed(true)} />
            ) : null}
            <Button title="Add account" kind="secondary" icon="plus" onPress={() => setAdding(true)} />
          </>
        )}
      </ScrollView>
      <AddAccountSheet visible={adding} onClose={() => setAdding(false)} />
    </View>
  );
}

function AddAccountSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { update } = useStore();
  const t = useTheme();
  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('checking');
  const [balance, setBalance] = useState('');

  const cents = parseMoney(balance) ?? 0;
  const save = () => {
    // credit card balances are debts: a typed "500" means you owe 500
    const starting = type === 'credit' ? -Math.abs(cents) : cents;
    update((d) => addAccount(d, { name, type, startingBalance: starting }));
    setName('');
    setBalance('');
    setType('checking');
    onClose();
  };

  return (
    <Sheet visible={visible} title="Add account" onClose={onClose} footer={<Button title="Add account" disabled={!name.trim()} onPress={save} />}>
      <Field label="Name" value={name} onChangeText={setName} placeholder="e.g. Everyday Bank" autoFocus />
      <Label>Type</Label>
      <Segmented
        value={type}
        onChange={setType}
        options={[
          { value: 'checking', label: 'Checking' },
          { value: 'savings', label: 'Savings' },
          { value: 'cash', label: 'Cash' },
          { value: 'credit', label: 'Credit' },
          { value: 'tracking', label: 'Tracking' },
        ]}
      />
      <Field
        label={type === 'credit' ? 'Amount owed today' : 'Balance today'}
        value={balance}
        onChangeText={setBalance}
        keyboardType="decimal-pad"
        placeholder="0.00"
      />
      <Text style={{ color: t.muted, lineHeight: 19, marginBottom: 12 }}>
        {type === 'tracking'
          ? "Tracking accounts (investments, loans, property) count toward net worth but don't affect your budget."
          : type === 'credit'
            ? 'A starting debt reduces Ready to Assign. Record card purchases in their categories, and payments as transfers from your bank account.'
            : 'This balance is added to Ready to Assign so you can give every dollar a job.'}
      </Text>
    </Sheet>
  );
}
