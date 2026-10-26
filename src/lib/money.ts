const formatters = new Map<string, Intl.NumberFormat>();

function formatter(currency: string): Intl.NumberFormat {
  let f = formatters.get(currency);
  if (!f) {
    try {
      f = new Intl.NumberFormat(undefined, { style: 'currency', currency, currencyDisplay: 'narrowSymbol' });
    } catch {
      f = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' });
    }
    formatters.set(currency, f);
  }
  return f;
}

export function formatMoney(cents: number, currency: string): string {
  return formatter(currency).format(cents / 100);
}

/**
 * Parses user input like "12", "12.5", "-1,234.56", "$40" into cents.
 * Returns null when the input has no number in it.
 */
export function parseMoney(input: string): number | null {
  const cleaned = input.replace(/[^0-9.\-]/g, '');
  if (!/\d/.test(cleaned)) return null;
  const negative = cleaned.startsWith('-');
  const [whole, frac = ''] = cleaned.replace(/-/g, '').split('.');
  const cents = Number(whole || '0') * 100 + Number((frac + '00').slice(0, 2));
  if (!Number.isFinite(cents)) return null;
  return negative ? -cents : cents;
}

/** Cents -> plain editable string, e.g. 123456 -> "1234.56". */
export function centsToInput(cents: number): string {
  if (cents === 0) return '';
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  const frac = abs % 100;
  return `${sign}${Math.floor(abs / 100)}${frac ? '.' + String(frac).padStart(2, '0') : ''}`;
}

export const CURRENCIES = ['USD', 'AUD', 'CAD', 'EUR', 'GBP', 'INR', 'BDT', 'NZD', 'JPY', 'SGD', 'ZAR', 'CHF'];
