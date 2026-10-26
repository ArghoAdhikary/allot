// Demo budget for trying the app out: three months of realistic activity.
import * as A from './actions.ts';
import { addMonths, currentMonth } from './dates.ts';
import { INCOME, type Data } from './types.ts';

export function sampleData(currency: string): Data {
  let d = A.seedData();
  d = A.setCurrency(d, currency);
  const now = currentMonth();
  const start = addMonths(now, -2);
  d = A.addAccount(d, { name: 'Everyday Bank', type: 'checking', startingBalance: 185000, date: `${start}-01` });
  d = A.addAccount(d, { name: 'Savings', type: 'savings', startingBalance: 420000, date: `${start}-01` });
  d = A.addAccount(d, { name: 'Credit Card', type: 'credit', startingBalance: -32000, date: `${start}-01` });
  d = A.addAccount(d, { name: 'Retirement', type: 'tracking', startingBalance: 1850000, date: `${start}-01` });
  const [bank, savings, card] = d.accounts.map((a) => a.id);
  const cat = (name: string) => d.categories.find((c) => c.name === name)!.id;

  d = A.updateCategory(d, cat('Rent / Mortgage'), { goal: { type: 'monthly', amount: 160000 } });
  d = A.updateCategory(d, cat('Groceries'), { goal: { type: 'monthly', amount: 60000 } });
  d = A.updateCategory(d, cat('Emergency Fund'), { goal: { type: 'target', amount: 600000 } });
  d = A.updateCategory(d, cat('Holidays'), { goal: { type: 'targetByDate', amount: 300000, month: addMonths(now, 8) } });

  const plan: [string, number][] = [
    ['Rent / Mortgage', 160000], ['Electricity', 9000], ['Water', 4000], ['Internet', 7000], ['Phone', 4500],
    ['Insurance', 12000], ['Groceries', 60000], ['Transport', 20000], ['Eating Out', 15000], ['Household', 8000],
    ['Emergency Fund', 50000], ['Car Maintenance', 10000], ['Gifts', 5000], ['Holidays', 30000],
    ['Entertainment', 8000], ['Hobbies', 6000], ['Subscriptions', 3500],
  ];

  const tx = (accountId: string, date: string, payee: string, category: string | null, amount: number) => {
    d = A.saveTransaction(d, {
      accountId, date, payee, categoryId: category === 'income' ? INCOME : category ? cat(category) : null, memo: '', amount, cleared: 'cleared',
    });
  };

  for (let i = 0; i < 3; i++) {
    const m = addMonths(start, i);
    const isNow = m === now;
    tx(bank, `${m}-01`, 'Employer Pty Ltd', 'income', 520000);
    if (i < 2) for (const [name, amt] of plan) d = A.setAssigned(d, m, cat(name), amt);
    else for (const [name, amt] of plan.slice(0, 10)) d = A.setAssigned(d, m, cat(name), amt);
    tx(bank, `${m}-02`, 'Landlord', 'Rent / Mortgage', -160000);
    tx(card, `${m}-04`, 'FreshMart', 'Groceries', -14250 - i * 900);
    tx(card, `${m}-11`, 'FreshMart', 'Groceries', -11890);
    tx(bank, `${m}-06`, 'City Power', 'Electricity', -8640 + i * 300);
    tx(bank, `${m}-07`, 'FastNet', 'Internet', -7000);
    tx(card, `${m}-08`, 'Metro Transit', 'Transport', -6000);
    tx(card, `${m}-09`, 'Streamly', 'Subscriptions', -1599);
    tx(card, `${m}-10`, 'Noodle House', 'Eating Out', -4280 - i * 700);
    if (!isNow) {
      tx(card, `${m}-18`, 'FreshMart', 'Groceries', -16420);
      tx(card, `${m}-21`, 'Cinema', 'Entertainment', -3600);
      tx(bank, `${m}-22`, 'Mobile Co', 'Phone', -4500);
      tx(card, `${m}-24`, 'Fuel Stop', 'Transport', -7450);
      tx(card, `${m}-26`, 'Pizza Place', 'Eating Out', -11200);
      d = A.saveTransaction(d, {
        accountId: bank, date: `${m}-25`, payee: '', categoryId: null, memo: 'Card payment', amount: -60000, cleared: 'cleared', transferAccountId: card,
      });
      d = A.saveTransaction(d, {
        accountId: bank, date: `${m}-27`, payee: '', categoryId: null, memo: '', amount: -50000, cleared: 'cleared', transferAccountId: savings,
      });
    }
  }
  d = A.saveScheduled(d, {
    accountId: bank, payee: 'Landlord', categoryId: cat('Rent / Mortgage'), memo: '', amount: -160000, frequency: 'monthly', nextDate: `${addMonths(now, 1)}-02`,
  });
  return d;
}
