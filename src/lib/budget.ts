import { addMonths, monthDiff, monthOf } from './dates.ts';
import { INCOME, type Account, type Category, type CategoryGroup, type Data, type Goal } from './types.ts';

export interface CategoryRow {
  category: Category;
  /** Available carried in from last month (overspending does not carry). */
  carried: number;
  assigned: number;
  activity: number;
  available: number;
  /** How much more should be assigned this month to stay on track with the goal. */
  underfunded: number;
}

export interface GroupRow {
  group: CategoryGroup;
  rows: CategoryRow[];
  assigned: number;
  activity: number;
  available: number;
}

export interface MonthBudget {
  month: string;
  readyToAssign: number;
  incomeThisMonth: number;
  /** Overspending from previous months that was taken from Ready to Assign. */
  overspentBefore: number;
  assignedInFuture: number;
  groups: GroupRow[];
  totalAssigned: number;
  totalActivity: number;
  totalAvailable: number;
  totalUnderfunded: number;
}

function budgetAccountIds(accounts: Account[]): Set<string> {
  return new Set(accounts.filter((a) => a.onBudget).map((a) => a.id));
}

export function goalUnderfunded(goal: Goal | undefined, month: string, carried: number, assigned: number): number {
  if (!goal || goal.amount <= 0) return 0;
  if (goal.type === 'monthly') return Math.max(0, goal.amount - assigned);
  if (goal.type === 'target') return Math.max(0, goal.amount - carried - assigned);
  const monthsLeft = goal.month ? Math.max(1, monthDiff(month, goal.month) + 1) : 1;
  const needed = Math.max(0, goal.amount - carried);
  const perMonth = Math.ceil(needed / monthsLeft);
  return Math.max(0, perMonth - assigned);
}

export function computeMonth(data: Data, month: string): MonthBudget {
  const onBudget = budgetAccountIds(data.accounts);
  const activity = new Map<string, Map<string, number>>();
  const income = new Map<string, number>();
  let start = month;

  for (const t of data.transactions) {
    if (!onBudget.has(t.accountId) || t.categoryId === null) continue;
    const m = monthOf(t.date);
    if (t.categoryId === INCOME) {
      income.set(m, (income.get(m) ?? 0) + t.amount);
    } else {
      let byCat = activity.get(m);
      if (!byCat) activity.set(m, (byCat = new Map()));
      byCat.set(t.categoryId, (byCat.get(t.categoryId) ?? 0) + t.amount);
    }
    if (m < start) start = m;
  }
  for (const m of Object.keys(data.assigned)) if (m < start) start = m;

  const carry = new Map<string, number>();
  let overspentBefore = 0;
  let incomeToDate = 0;
  let assignedToDate = 0;
  let assignedInFuture = 0;
  const rows = new Map<string, CategoryRow>();

  for (let m = start; m <= month; m = addMonths(m, 1)) {
    incomeToDate += income.get(m) ?? 0;
    const assignedMonth = data.assigned[m] ?? {};
    const actMonth = activity.get(m);
    for (const c of data.categories) {
      const carried = carry.get(c.id) ?? 0;
      const assigned = assignedMonth[c.id] ?? 0;
      const act = actMonth?.get(c.id) ?? 0;
      const available = carried + assigned + act;
      assignedToDate += assigned;
      if (m === month) {
        rows.set(c.id, {
          category: c,
          carried,
          assigned,
          activity: act,
          available,
          underfunded: goalUnderfunded(c.goal, m, carried, assigned),
        });
      } else {
        carry.set(c.id, Math.max(0, available));
        if (available < 0) overspentBefore += -available;
      }
    }
  }
  for (const [m, byCat] of Object.entries(data.assigned)) {
    if (m <= month) continue;
    for (const v of Object.values(byCat)) assignedInFuture += v;
  }

  const groups: GroupRow[] = data.groups.map((group) => {
    const groupRows = data.categories
      .filter((c) => c.groupId === group.id)
      .map((c) => rows.get(c.id)!)
      .filter(Boolean);
    return {
      group,
      rows: groupRows,
      assigned: groupRows.reduce((s, r) => s + r.assigned, 0),
      activity: groupRows.reduce((s, r) => s + r.activity, 0),
      available: groupRows.reduce((s, r) => s + r.available, 0),
    };
  });

  const all = [...rows.values()];
  return {
    month,
    readyToAssign: incomeToDate - assignedToDate - overspentBefore - assignedInFuture,
    incomeThisMonth: income.get(month) ?? 0,
    overspentBefore,
    assignedInFuture,
    groups,
    totalAssigned: all.reduce((s, r) => s + r.assigned, 0),
    totalActivity: all.reduce((s, r) => s + r.activity, 0),
    totalAvailable: all.reduce((s, r) => s + r.available, 0),
    totalUnderfunded: all.filter((r) => !r.category.hidden).reduce((s, r) => s + r.underfunded, 0),
  };
}

export function accountBalance(data: Data, accountId: string, clearedOnly = false): number {
  let sum = 0;
  for (const t of data.transactions) {
    if (t.accountId !== accountId) continue;
    if (clearedOnly && t.cleared === 'uncleared') continue;
    sum += t.amount;
  }
  return sum;
}

/** Outflows per category for a month, largest first (positive numbers). */
export function spendingByCategory(data: Data, month: string): { category: Category; amount: number }[] {
  const onBudget = budgetAccountIds(data.accounts);
  const sums = new Map<string, number>();
  for (const t of data.transactions) {
    if (!onBudget.has(t.accountId) || !t.categoryId || t.categoryId === INCOME) continue;
    if (monthOf(t.date) !== month) continue;
    sums.set(t.categoryId, (sums.get(t.categoryId) ?? 0) - t.amount);
  }
  return data.categories
    .map((category) => ({ category, amount: sums.get(category.id) ?? 0 }))
    .filter((r) => r.amount > 0)
    .sort((a, b) => b.amount - a.amount);
}

export function incomeVsExpense(data: Data, endMonth: string, count: number) {
  const onBudget = budgetAccountIds(data.accounts);
  const months = Array.from({ length: count }, (_, i) => addMonths(endMonth, i - count + 1));
  const result = months.map((month) => ({ month, income: 0, expense: 0 }));
  const index = new Map(months.map((m, i) => [m, i]));
  for (const t of data.transactions) {
    const i = index.get(monthOf(t.date));
    if (i === undefined || !onBudget.has(t.accountId) || !t.categoryId) continue;
    if (t.categoryId === INCOME) result[i].income += t.amount;
    else result[i].expense -= t.amount;
  }
  return result;
}

export function netWorth(data: Data, endMonth: string, count: number) {
  const months = Array.from({ length: count }, (_, i) => addMonths(endMonth, i - count + 1));
  return months.map((month) => {
    let assets = 0;
    let debts = 0;
    for (const a of data.accounts) {
      let bal = 0;
      for (const t of data.transactions) if (t.accountId === a.id && monthOf(t.date) <= month) bal += t.amount;
      if (bal >= 0) assets += bal;
      else debts += -bal;
    }
    return { month, assets, debts, net: assets - debts };
  });
}

/** Most recent category used with a payee, to prefill new transactions. */
export function lastCategoryForPayee(data: Data, payee: string): string | null | undefined {
  const p = payee.trim().toLowerCase();
  if (!p) return undefined;
  let best: { date: string; categoryId: string | null } | undefined;
  for (const t of data.transactions) {
    if (t.transferId || t.payee.toLowerCase() !== p) continue;
    if (!best || t.date > best.date) best = { date: t.date, categoryId: t.categoryId };
  }
  return best?.categoryId;
}
