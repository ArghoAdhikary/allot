import { isValidDate } from './dates.ts';
import { parseMoney } from './money.ts';
import { INCOME, type Data, type Transaction } from './types.ts';

function escape(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

function cents(v: number): string {
  return (v / 100).toFixed(2);
}

export function exportCsv(data: Data): string {
  const accounts = new Map(data.accounts.map((a) => [a.id, a.name]));
  const groups = new Map(data.groups.map((g) => [g.id, g.name]));
  const cats = new Map(data.categories.map((c) => [c.id, c]));
  const lines = [['Date', 'Account', 'Payee', 'Category Group', 'Category', 'Memo', 'Outflow', 'Inflow', 'Cleared'].join(',')];
  const sorted = [...data.transactions].sort((a, b) => a.date.localeCompare(b.date));
  for (const t of sorted) {
    const cat = t.categoryId ? cats.get(t.categoryId) : undefined;
    const payee = t.transferAccountId ? `Transfer: ${accounts.get(t.transferAccountId) ?? ''}` : t.payee;
    lines.push(
      [
        t.date,
        accounts.get(t.accountId) ?? '',
        payee,
        cat ? groups.get(cat.groupId) ?? '' : '',
        t.categoryId === INCOME ? 'Ready to Assign' : cat?.name ?? '',
        t.memo,
        t.amount < 0 ? cents(-t.amount) : '',
        t.amount > 0 ? cents(t.amount) : '',
        t.cleared,
      ]
        .map(escape)
        .join(','),
    );
  }
  return lines.join('\n');
}

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      if (row.some((f) => f.trim() !== '')) rows.push(row);
      row = [];
      field = '';
    } else field += ch;
  }
  row.push(field);
  if (row.some((f) => f.trim() !== '')) rows.push(row);
  return rows;
}

/** Normalizes D/M/Y-ish dates too, preferring ISO. */
function normalizeDate(raw: string): string | null {
  const s = raw.trim();
  if (isValidDate(s)) return s;
  const m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (m) {
    const [, a, b, y] = m;
    const iso = `${y}-${b.padStart(2, '0')}-${a.padStart(2, '0')}`; // day/month/year
    if (isValidDate(iso)) return iso;
    const us = `${y}-${a.padStart(2, '0')}-${b.padStart(2, '0')}`;
    if (isValidDate(us)) return us;
  }
  return null;
}

export interface ImportResult {
  transactions: Omit<Transaction, 'id'>[];
  skipped: number;
}

/**
 * Accepts a header row with Date, Payee, and either Amount or Outflow/Inflow.
 * Optional: Memo, Category. Unknown categories are left uncategorized.
 */
export function importCsv(text: string, data: Data, accountId: string): ImportResult {
  const rows = parseCsv(text);
  if (rows.length < 2) return { transactions: [], skipped: 0 };
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const col = (name: string) => header.indexOf(name);
  const iDate = col('date');
  const iPayee = col('payee') >= 0 ? col('payee') : col('description');
  const iMemo = col('memo');
  const iCat = col('category');
  const iAmount = col('amount');
  const iOut = col('outflow');
  const iIn = col('inflow');
  const catByName = new Map(data.categories.map((c) => [c.name.toLowerCase(), c.id]));

  const transactions: Omit<Transaction, 'id'>[] = [];
  let skipped = 0;
  for (const r of rows.slice(1)) {
    const date = iDate >= 0 ? normalizeDate(r[iDate] ?? '') : null;
    let amount: number | null = null;
    if (iAmount >= 0) amount = parseMoney(r[iAmount] ?? '');
    else if (iOut >= 0 || iIn >= 0) {
      const out = parseMoney(r[iOut] ?? '') ?? 0;
      const inn = parseMoney(r[iIn] ?? '') ?? 0;
      amount = inn - out;
    }
    if (!date || amount === null) {
      skipped++;
      continue;
    }
    const catName = iCat >= 0 ? (r[iCat] ?? '').trim().toLowerCase() : '';
    const categoryId =
      catName === 'ready to assign' || catName === 'income' ? INCOME : catByName.get(catName) ?? null;
    transactions.push({
      accountId,
      date,
      payee: iPayee >= 0 ? (r[iPayee] ?? '').trim() : '',
      memo: iMemo >= 0 ? (r[iMemo] ?? '').trim() : '',
      categoryId,
      amount,
      cleared: 'cleared',
    });
  }
  return { transactions, skipped };
}
