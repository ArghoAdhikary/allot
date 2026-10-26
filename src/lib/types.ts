// All money values are integers in minor units (cents). Outflows are negative.

export type AccountType = 'checking' | 'savings' | 'cash' | 'credit' | 'tracking';

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  onBudget: boolean;
  closed: boolean;
}

export interface CategoryGroup {
  id: string;
  name: string;
  hidden: boolean;
}

export type GoalType = 'monthly' | 'target' | 'targetByDate';

export interface Goal {
  type: GoalType;
  amount: number;
  /** YYYY-MM, only for targetByDate */
  month?: string;
}

export interface Category {
  id: string;
  groupId: string;
  name: string;
  hidden: boolean;
  goal?: Goal;
}

export type Cleared = 'uncleared' | 'cleared' | 'reconciled';

/** Special category id: money that lands in "Ready to Assign". */
export const INCOME = 'income';

export interface Transaction {
  id: string;
  accountId: string;
  /** YYYY-MM-DD */
  date: string;
  payee: string;
  /** Category id, INCOME, or null for transfers between budget accounts. */
  categoryId: string | null;
  memo: string;
  amount: number;
  cleared: Cleared;
  /** Set on both halves of a transfer. */
  transferId?: string;
  transferAccountId?: string;
}

export type Frequency = 'weekly' | 'biweekly' | 'monthly' | 'yearly';

export interface Scheduled {
  id: string;
  accountId: string;
  payee: string;
  categoryId: string | null;
  memo: string;
  amount: number;
  frequency: Frequency;
  /** Next date (YYYY-MM-DD) this will be entered. */
  nextDate: string;
  /** Day of month for monthly/yearly repeats, so the 31st doesn't drift to the 28th. */
  day?: number;
}

export interface Settings {
  currency: string;
}

export interface Data {
  version: 1;
  accounts: Account[];
  groups: CategoryGroup[];
  categories: Category[];
  transactions: Transaction[];
  scheduled: Scheduled[];
  /** month (YYYY-MM) -> categoryId -> assigned amount */
  assigned: Record<string, Record<string, number>>;
  settings: Settings;
}
