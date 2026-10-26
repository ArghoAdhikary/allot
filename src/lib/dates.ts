import type { Frequency } from './types.ts';

const pad = (n: number) => String(n).padStart(2, '0');

export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function today(): string {
  return toISODate(new Date());
}

export function currentMonth(): string {
  return today().slice(0, 7);
}

export function monthOf(date: string): string {
  return date.slice(0, 7);
}

export function addMonths(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number);
  const idx = y * 12 + (m - 1) + n;
  return `${Math.floor(idx / 12)}-${pad((idx % 12) + 1)}`;
}

/** Number of months from a to b (b - a). */
export function monthDiff(a: string, b: string): number {
  const [ay, am] = a.split('-').map(Number);
  const [by, bm] = b.split('-').map(Number);
  return by * 12 + bm - (ay * 12 + am);
}

export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number);
  return toISODate(new Date(y, m - 1, d + n));
}

function daysInMonth(y: number, m: number): number {
  return new Date(y, m, 0).getDate();
}

export function nextOccurrence(date: string, freq: Frequency, anchorDay?: number): string {
  if (freq === 'weekly') return addDays(date, 7);
  if (freq === 'biweekly') return addDays(date, 14);
  const [y, m, d] = date.split('-').map(Number);
  const months = freq === 'monthly' ? 1 : 12;
  const target = addMonths(`${y}-${pad(m)}`, months);
  const [ty, tm] = target.split('-').map(Number);
  return `${target}-${pad(Math.min(anchorDay ?? d, daysInMonth(ty, tm)))}`;
}

export function isValidDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  return m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m);
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function monthLabel(month: string, short = false): string {
  const [y, m] = month.split('-').map(Number);
  const name = MONTHS[m - 1];
  return short ? `${name.slice(0, 3)} ${String(y).slice(2)}` : `${name} ${y}`;
}

export function dateLabel(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return `${MONTHS[m - 1].slice(0, 3)} ${d}, ${y}`;
}
