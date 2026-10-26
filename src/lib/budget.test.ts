/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import * as A from './actions.ts';
import { accountBalance, computeMonth, goalUnderfunded } from './budget.ts';
import { exportCsv, importCsv } from './csv.ts';
import { addMonths, nextOccurrence } from './dates.ts';
import { parseMoney } from './money.ts';
import { INCOME, type Data } from './types.ts';

function setup() {
  let d: Data = A.addGroup(A.emptyData(), 'Everyday');
  const groupId = d.groups[0].id;
  d = A.addCategory(d, groupId, 'Groceries');
  d = A.addCategory(d, groupId, 'Rent');
  const [groceries, rent] = d.categories.map((c) => c.id);
  d = A.addAccount(d, { name: 'Checking', type: 'checking', startingBalance: 100000, date: '2026-01-01' });
  return { d, groceries, rent, checking: d.accounts[0].id };
}

const row = (d: Data, month: string, id: string) =>
  computeMonth(d, month).groups.flatMap((g) => g.rows).find((r) => r.category.id === id)!;

test('income becomes ready to assign; assigning reduces it', () => {
  let { d, groceries } = setup();
  assert.equal(computeMonth(d, '2026-01').readyToAssign, 100000);
  d = A.setAssigned(d, '2026-01', groceries, 30000);
  assert.equal(computeMonth(d, '2026-01').readyToAssign, 70000);
});

test('available carries forward; overspending comes out of next month', () => {
  let { d, groceries, checking } = setup();
  d = A.setAssigned(d, '2026-01', groceries, 30000);
  d = A.saveTransaction(d, {
    accountId: checking, date: '2026-01-10', payee: 'Shop', categoryId: groceries, memo: '', amount: -10000, cleared: 'cleared',
  });
  assert.equal(row(d, '2026-01', groceries).available, 20000);
  assert.equal(row(d, '2026-02', groceries).carried, 20000);

  d = A.saveTransaction(d, {
    accountId: checking, date: '2026-02-10', payee: 'Shop', categoryId: groceries, memo: '', amount: -50000, cleared: 'cleared',
  });
  assert.equal(row(d, '2026-02', groceries).available, -30000);
  assert.equal(row(d, '2026-03', groceries).carried, 0);
  // 100000 income - 30000 assigned - 30000 overspent in Feb
  assert.equal(computeMonth(d, '2026-03').readyToAssign, 40000);
});

test('future assignments are reserved', () => {
  let { d, rent } = setup();
  d = A.setAssigned(d, '2026-02', rent, 40000);
  assert.equal(computeMonth(d, '2026-01').readyToAssign, 60000);
});

test('move money keeps totals', () => {
  let { d, groceries, rent } = setup();
  d = A.setAssigned(d, '2026-01', groceries, 30000);
  d = A.moveMoney(d, '2026-01', groceries, rent, 5000);
  assert.equal(row(d, '2026-01', groceries).assigned, 25000);
  assert.equal(row(d, '2026-01', rent).assigned, 5000);
  assert.equal(computeMonth(d, '2026-01').readyToAssign, 70000);
});

test('goals', () => {
  assert.equal(goalUnderfunded({ type: 'monthly', amount: 500 }, '2026-01', 0, 200), 300);
  assert.equal(goalUnderfunded({ type: 'target', amount: 1000 }, '2026-01', 400, 100), 500);
  // 1200 needed over Jan..Dec = 100/month
  assert.equal(goalUnderfunded({ type: 'targetByDate', amount: 1200, month: '2026-12' }, '2026-01', 0, 0), 100);
});

test('assign underfunded stops at ready to assign', () => {
  let { d, groceries, rent } = setup();
  d = A.updateCategory(d, groceries, { goal: { type: 'monthly', amount: 60000 } });
  d = A.updateCategory(d, rent, { goal: { type: 'monthly', amount: 60000 } });
  d = A.assignUnderfunded(d, '2026-01');
  assert.equal(computeMonth(d, '2026-01').readyToAssign, 0);
  assert.equal(row(d, '2026-01', groceries).assigned, 60000);
  assert.equal(row(d, '2026-01', rent).assigned, 40000);
});

test('transfers move balance without touching the budget', () => {
  let { d, checking } = setup();
  d = A.addAccount(d, { name: 'Savings', type: 'savings', startingBalance: 0, date: '2026-01-01' });
  const savings = d.accounts[1].id;
  d = A.saveTransaction(d, {
    accountId: checking, date: '2026-01-05', payee: '', categoryId: null, memo: '', amount: -25000, cleared: 'cleared', transferAccountId: savings,
  });
  assert.equal(accountBalance(d, checking), 75000);
  assert.equal(accountBalance(d, savings), 25000);
  assert.equal(computeMonth(d, '2026-01').readyToAssign, 100000);
  const half = d.transactions.find((t) => t.accountId === savings && t.transferId)!;
  d = A.deleteTransaction(d, half.id);
  assert.equal(accountBalance(d, checking), 100000);
});

test('reconcile adds adjustment', () => {
  let { d, checking } = setup();
  d = A.reconcile(d, checking, 99000, accountBalance(d, checking, true));
  assert.equal(accountBalance(d, checking), 99000);
  assert.ok(d.transactions.every((t) => t.cleared === 'reconciled'));
});

test('scheduled transactions are entered when due', () => {
  let { d, rent, checking } = setup();
  d = A.saveScheduled(d, {
    accountId: checking, payee: 'Landlord', categoryId: rent, memo: '', amount: -20000, frequency: 'monthly', nextDate: '2026-01-31',
  });
  d = A.runScheduled(d, '2026-03-15');
  assert.deepEqual(
    d.transactions.filter((t) => t.payee === 'Landlord').map((t) => t.date),
    ['2026-01-31', '2026-02-28'],
  );
  assert.equal(d.scheduled[0].nextDate, '2026-03-31');
});

test('csv round trip', () => {
  let { d, groceries, checking } = setup();
  d = A.saveTransaction(d, {
    accountId: checking, date: '2026-01-10', payee: 'Shop, "Big"', categoryId: groceries, memo: '', amount: -1234, cleared: 'cleared',
  });
  const csv = exportCsv(d);
  const { transactions, skipped } = importCsv(csv, d, checking);
  assert.equal(skipped, 0);
  assert.equal(transactions.length, 2);
  assert.equal(transactions[0].categoryId, INCOME);
  assert.equal(transactions[1].payee, 'Shop, "Big"');
  assert.equal(transactions[1].amount, -1234);
  assert.equal(transactions[1].categoryId, groceries);
});

test('helpers', () => {
  assert.equal(parseMoney('$1,234.5'), 123450);
  assert.equal(parseMoney('-0.07'), -7);
  assert.equal(parseMoney('abc'), null);
  assert.equal(addMonths('2026-11', 3), '2027-02');
  assert.equal(addMonths('2026-01', -1), '2025-12');
  assert.equal(nextOccurrence('2026-01-31', 'monthly'), '2026-02-28');
});
