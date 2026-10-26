// Pure state transitions. Every function takes Data and returns new Data.
import { computeMonth } from './budget.ts';
import { nextOccurrence, today } from './dates.ts';
import {
  INCOME,
  type Account,
  type AccountType,
  type Category,
  type Data,
  type Scheduled,
  type Transaction,
} from './types.ts';

let counter = 0;
export function uid(): string {
  counter = (counter + 1) % 1e6;
  return `${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export function emptyData(): Data {
  return {
    version: 1,
    accounts: [],
    groups: [],
    categories: [],
    transactions: [],
    scheduled: [],
    assigned: {},
    settings: { currency: 'USD' },
  };
}

const DEFAULT_CATEGORIES: [string, string[]][] = [
  ['Bills', ['Rent / Mortgage', 'Electricity', 'Water', 'Internet', 'Phone', 'Insurance']],
  ['Everyday', ['Groceries', 'Transport', 'Eating Out', 'Household']],
  ['Saving', ['Emergency Fund', 'Car Maintenance', 'Gifts', 'Holidays']],
  ['Fun', ['Entertainment', 'Hobbies', 'Subscriptions']],
];

export function seedData(): Data {
  const d = emptyData();
  for (const [groupName, cats] of DEFAULT_CATEGORIES) {
    const groupId = uid();
    d.groups.push({ id: groupId, name: groupName, hidden: false });
    for (const name of cats) d.categories.push({ id: uid(), groupId, name, hidden: false });
  }
  return d;
}

// ---------- accounts ----------

export function addAccount(
  d: Data,
  input: { name: string; type: AccountType; startingBalance: number; date?: string },
): Data {
  const account: Account = {
    id: uid(),
    name: input.name.trim() || 'Account',
    type: input.type,
    onBudget: input.type !== 'tracking',
    closed: false,
  };
  const txns = [...d.transactions];
  txns.push({
    id: uid(),
    accountId: account.id,
    date: input.date ?? today(),
    payee: 'Starting Balance',
    categoryId: account.onBudget ? INCOME : null,
    memo: '',
    amount: input.startingBalance,
    cleared: 'cleared',
  });
  return { ...d, accounts: [...d.accounts, account], transactions: txns };
}

export function updateAccount(d: Data, id: string, patch: Partial<Pick<Account, 'name' | 'closed'>>): Data {
  return { ...d, accounts: d.accounts.map((a) => (a.id === id ? { ...a, ...patch } : a)) };
}

export function deleteAccount(d: Data, id: string): Data {
  const pairIds = new Set(d.transactions.filter((t) => t.accountId === id && t.transferId).map((t) => t.transferId));
  return {
    ...d,
    accounts: d.accounts.filter((a) => a.id !== id),
    transactions: d.transactions
      .filter((t) => t.accountId !== id)
      // the other half of a transfer becomes a plain transaction
      .map((t) =>
        t.transferId && pairIds.has(t.transferId)
          ? { ...t, transferId: undefined, transferAccountId: undefined, payee: t.payee || 'Deleted account' }
          : t,
      ),
    scheduled: d.scheduled.filter((s) => s.accountId !== id),
  };
}

/** Marks cleared transactions reconciled; adds an adjustment if the bank balance differs. */
export function reconcile(d: Data, accountId: string, actualBalance: number, clearedBalance: number): Data {
  const diff = actualBalance - clearedBalance;
  const account = d.accounts.find((a) => a.id === accountId);
  let txns = d.transactions.map((t) =>
    t.accountId === accountId && t.cleared === 'cleared' ? { ...t, cleared: 'reconciled' as const } : t,
  );
  if (diff !== 0) {
    txns = [
      ...txns,
      {
        id: uid(),
        accountId,
        date: today(),
        payee: 'Reconciliation Adjustment',
        categoryId: account?.onBudget ? INCOME : null,
        memo: '',
        amount: diff,
        cleared: 'reconciled',
      },
    ];
  }
  return { ...d, transactions: txns };
}

// ---------- transactions ----------

export interface TransactionInput {
  id?: string;
  accountId: string;
  date: string;
  payee: string;
  categoryId: string | null;
  memo: string;
  amount: number;
  cleared: Transaction['cleared'];
  /** When set, this is a transfer to/from that account. */
  transferAccountId?: string;
}

export function saveTransaction(d: Data, input: TransactionInput): Data {
  let txns = d.transactions;
  const existing = input.id ? txns.find((t) => t.id === input.id) : undefined;
  if (existing?.transferId) {
    txns = txns.filter((t) => t.transferId !== existing.transferId || t.id === existing.id);
  }
  const id = existing?.id ?? uid();

  if (input.transferAccountId && input.transferAccountId !== input.accountId) {
    const transferId = existing?.transferId ?? uid();
    const main: Transaction = {
      id,
      accountId: input.accountId,
      date: input.date,
      payee: '',
      categoryId: null,
      memo: input.memo,
      amount: input.amount,
      cleared: input.cleared,
      transferId,
      transferAccountId: input.transferAccountId,
    };
    const other: Transaction = {
      ...main,
      id: uid(),
      accountId: input.transferAccountId,
      amount: -input.amount,
      cleared: 'uncleared',
      transferAccountId: input.accountId,
    };
    txns = existing ? txns.map((t) => (t.id === id ? main : t)) : [...txns, main];
    return { ...d, transactions: [...txns, other] };
  }

  const t: Transaction = {
    id,
    accountId: input.accountId,
    date: input.date,
    payee: input.payee.trim(),
    categoryId: input.categoryId,
    memo: input.memo.trim(),
    amount: input.amount,
    cleared: input.cleared,
  };
  return { ...d, transactions: existing ? txns.map((x) => (x.id === id ? t : x)) : [...txns, t] };
}

export function deleteTransaction(d: Data, id: string): Data {
  const t = d.transactions.find((x) => x.id === id);
  if (!t) return d;
  return {
    ...d,
    transactions: d.transactions.filter((x) => x.id !== id && (!t.transferId || x.transferId !== t.transferId)),
  };
}

export function toggleCleared(d: Data, id: string): Data {
  return {
    ...d,
    transactions: d.transactions.map((t) =>
      t.id === id && t.cleared !== 'reconciled' ? { ...t, cleared: t.cleared === 'cleared' ? 'uncleared' : 'cleared' } : t,
    ),
  };
}

export function importTransactions(d: Data, txns: Omit<Transaction, 'id'>[]): Data {
  return { ...d, transactions: [...d.transactions, ...txns.map((t) => ({ ...t, id: uid() }))] };
}

// ---------- budget ----------

export function setAssigned(d: Data, month: string, categoryId: string, amount: number): Data {
  const monthMap = { ...(d.assigned[month] ?? {}) };
  if (amount === 0) delete monthMap[categoryId];
  else monthMap[categoryId] = amount;
  return { ...d, assigned: { ...d.assigned, [month]: monthMap } };
}

export function moveMoney(d: Data, month: string, fromId: string, toId: string, amount: number): Data {
  const m = d.assigned[month] ?? {};
  let next = setAssigned(d, month, fromId, (m[fromId] ?? 0) - amount);
  next = setAssigned(next, month, toId, (next.assigned[month]?.[toId] ?? 0) + amount);
  return next;
}

/** Assigns what each goal needs this month, as far as Ready to Assign allows. */
export function assignUnderfunded(d: Data, month: string): Data {
  const budget = computeMonth(d, month);
  let left = budget.readyToAssign;
  let next = d;
  for (const g of budget.groups) {
    for (const r of g.rows) {
      if (left <= 0) return next;
      if (r.category.hidden || r.underfunded <= 0) continue;
      const add = Math.min(r.underfunded, left);
      next = setAssigned(next, month, r.category.id, r.assigned + add);
      left -= add;
    }
  }
  return next;
}

/** Copies last month's assigned amounts into this month (only where empty). */
export function assignLastMonth(d: Data, month: string, prevMonth: string): Data {
  const prev = d.assigned[prevMonth] ?? {};
  const cur = { ...(d.assigned[month] ?? {}) };
  for (const [k, v] of Object.entries(prev)) if (!cur[k]) cur[k] = v;
  return { ...d, assigned: { ...d.assigned, [month]: cur } };
}

export function addGroup(d: Data, name: string): Data {
  return { ...d, groups: [...d.groups, { id: uid(), name: name.trim() || 'New Group', hidden: false }] };
}

export function renameGroup(d: Data, id: string, name: string): Data {
  return { ...d, groups: d.groups.map((g) => (g.id === id ? { ...g, name: name.trim() || g.name } : g)) };
}

export function deleteGroup(d: Data, id: string): Data {
  let next = d;
  for (const c of d.categories.filter((c) => c.groupId === id)) next = deleteCategory(next, c.id);
  return { ...next, groups: next.groups.filter((g) => g.id !== id) };
}

export function addCategory(d: Data, groupId: string, name: string): Data {
  const c: Category = { id: uid(), groupId, name: name.trim() || 'New Category', hidden: false };
  return { ...d, categories: [...d.categories, c] };
}

export function updateCategory(d: Data, id: string, patch: Partial<Omit<Category, 'id'>>): Data {
  return { ...d, categories: d.categories.map((c) => (c.id === id ? { ...c, ...patch } : c)) };
}

/** Deletes a category; its transactions become uncategorized and its assigned money returns to Ready to Assign. */
export function deleteCategory(d: Data, id: string): Data {
  const assigned: Data['assigned'] = {};
  for (const [m, byCat] of Object.entries(d.assigned)) {
    const { [id]: _removed, ...rest } = byCat;
    assigned[m] = rest;
  }
  return {
    ...d,
    categories: d.categories.filter((c) => c.id !== id),
    transactions: d.transactions.map((t) => (t.categoryId === id ? { ...t, categoryId: null } : t)),
    scheduled: d.scheduled.map((s) => (s.categoryId === id ? { ...s, categoryId: null } : s)),
    assigned,
  };
}

// ---------- scheduled ----------

export function saveScheduled(d: Data, s: Omit<Scheduled, 'id'> & { id?: string }): Data {
  const item: Scheduled = { ...s, id: s.id ?? uid(), day: Number(s.nextDate.slice(8, 10)) };
  const exists = d.scheduled.some((x) => x.id === item.id);
  return { ...d, scheduled: exists ? d.scheduled.map((x) => (x.id === item.id ? item : x)) : [...d.scheduled, item] };
}

export function deleteScheduled(d: Data, id: string): Data {
  return { ...d, scheduled: d.scheduled.filter((s) => s.id !== id) };
}

/** Enters every scheduled transaction that is due on or before `asOf`. */
export function runScheduled(d: Data, asOf: string = today()): Data {
  let next = d;
  let changed = false;
  const scheduled = d.scheduled.map((s) => {
    let date = s.nextDate;
    let guard = 0;
    while (date <= asOf && guard++ < 500) {
      next = saveTransaction(next, {
        accountId: s.accountId,
        date,
        payee: s.payee,
        categoryId: s.categoryId,
        memo: s.memo,
        amount: s.amount,
        cleared: 'uncleared',
      });
      date = nextOccurrence(date, s.frequency, s.day);
      changed = true;
    }
    return date === s.nextDate ? s : { ...s, nextDate: date };
  });
  return changed ? { ...next, scheduled } : d;
}

export function setCurrency(d: Data, currency: string): Data {
  return { ...d, settings: { ...d.settings, currency } };
}
