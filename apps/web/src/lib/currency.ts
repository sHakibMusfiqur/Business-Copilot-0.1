// Centralized currency + exchange-rate utility for the onboarding plan selector.
//
// Pricing is stored in USD on the backend. This module converts plan prices into
// the currency detected from the user's country / timezone and formats them for
// display. No live exchange-rate service is used yet: static fallback rates are
// defined below. To integrate a live service later, implement an
// `ExchangeRateProvider` and pass it into `convertAmount` (or extend the default
// provider) — no call-site changes will be required.

export interface CurrencyInfo {
  code: string;
  symbol: string;
  name: string;
  /** Approximate units per 1 USD — used as the static fallback rate. */
  usdRate: number;
}

export const SUPPORTED_CURRENCIES: Record<string, CurrencyInfo> = {
  USD: { code: 'USD', symbol: '$', name: 'US Dollar', usdRate: 1 },
  EUR: { code: 'EUR', symbol: '€', name: 'Euro', usdRate: 0.92 },
  GBP: { code: 'GBP', symbol: '£', name: 'British Pound', usdRate: 0.79 },
  BDT: { code: 'BDT', symbol: '৳', name: 'Bangladeshi Taka', usdRate: 110 },
  INR: { code: 'INR', symbol: '₹', name: 'Indian Rupee', usdRate: 84 },
  AED: { code: 'AED', symbol: 'AED ', name: 'UAE Dirham', usdRate: 3.67 },
  JPY: { code: 'JPY', symbol: '¥', name: 'Japanese Yen', usdRate: 150 },
  AUD: { code: 'AUD', symbol: 'A$', name: 'Australian Dollar', usdRate: 1.53 },
  SGD: { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar', usdRate: 1.35 },
  CAD: { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar', usdRate: 1.36 },
  CNY: { code: 'CNY', symbol: 'CN¥', name: 'Chinese Yuan', usdRate: 7.2 },
  HKD: { code: 'HKD', symbol: 'HK$', name: 'Hong Kong Dollar', usdRate: 7.8 },
  KRW: { code: 'KRW', symbol: '₩', name: 'South Korean Won', usdRate: 1330 },
  MYR: { code: 'MYR', symbol: 'RM', name: 'Malaysian Ringgit', usdRate: 4.7 },
  THB: { code: 'THB', symbol: '฿', name: 'Thai Baht', usdRate: 34 },
  IDR: { code: 'IDR', symbol: 'Rp', name: 'Indonesian Rupiah', usdRate: 15600 },
  PHP: { code: 'PHP', symbol: '₱', name: 'Philippine Peso', usdRate: 56 },
  PKR: { code: 'PKR', symbol: '₨', name: 'Pakistani Rupee', usdRate: 280 },
  LKR: { code: 'LKR', symbol: 'Rs ', name: 'Sri Lankan Rupee', usdRate: 300 },
  NZD: { code: 'NZD', symbol: 'NZ$', name: 'New Zealand Dollar', usdRate: 1.67 },
};

/** Maps an IANA timezone to the most common local currency. */
const TIMEZONE_TO_CURRENCY: Record<string, string> = {
  'Asia/Dhaka': 'BDT',
  'Asia/Kolkata': 'INR',
  'Asia/Karachi': 'PKR',
  'Asia/Colombo': 'LKR',
  'Asia/Dubai': 'AED',
  'Asia/Tokyo': 'JPY',
  'Asia/Singapore': 'SGD',
  'Asia/Kuala_Lumpur': 'MYR',
  'Asia/Bangkok': 'THB',
  'Asia/Shanghai': 'CNY',
  'Asia/Hong_Kong': 'HKD',
  'Asia/Seoul': 'KRW',
  'Asia/Jakarta': 'IDR',
  'Asia/Manila': 'PHP',
  'Europe/London': 'GBP',
  'Europe/Paris': 'EUR',
  'Europe/Berlin': 'EUR',
  'Europe/Rome': 'EUR',
  'Europe/Madrid': 'EUR',
  'Europe/Amsterdam': 'EUR',
  'Europe/Vienna': 'EUR',
  'America/New_York': 'USD',
  'America/Chicago': 'USD',
  'America/Denver': 'USD',
  'America/Los_Angeles': 'USD',
  'America/Toronto': 'CAD',
  'America/Vancouver': 'CAD',
  'Australia/Sydney': 'AUD',
  'Australia/Melbourne': 'AUD',
  'Australia/Brisbane': 'AUD',
  'Pacific/Auckland': 'NZD',
};

/** Maps a country name to its currency code. */
const COUNTRY_TO_CURRENCY: Record<string, string> = {
  Bangladesh: 'BDT',
  India: 'INR',
  Pakistan: 'PKR',
  'Sri Lanka': 'LKR',
  'United Arab Emirates': 'AED',
  Japan: 'JPY',
  Singapore: 'SGD',
  Malaysia: 'MYR',
  Thailand: 'THB',
  China: 'CNY',
  'Hong Kong': 'HKD',
  'South Korea': 'KRW',
  Indonesia: 'IDR',
  Philippines: 'PHP',
  'United Kingdom': 'GBP',
  France: 'EUR',
  Germany: 'EUR',
  Italy: 'EUR',
  Spain: 'EUR',
  Netherlands: 'EUR',
  'United States': 'USD',
  USA: 'USD',
  Canada: 'CAD',
  Australia: 'AUD',
  'New Zealand': 'NZD',
};

export interface CurrencySource {
  orgCurrency?: string | null;
  orgCountry?: string | null;
  orgTimezone?: string | null;
}

function normalizeCountryName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

function findCountryCurrency(country: string): string | null {
  const key = COUNTRY_TO_CURRENCY[country.trim()];
  if (key) return key;
  const lower = normalizeCountryName(country);
  const match = Object.keys(COUNTRY_TO_CURRENCY).find(
    (c) => normalizeCountryName(c) === lower,
  );
  return match ? COUNTRY_TO_CURRENCY[match] : null;
}

/**
 * Detects the display currency for a user based on their organization selection.
 * Priority: explicit non-default org currency -> country -> timezone -> USD.
 */
export function detectCurrency(session: CurrencySource | null | undefined): string {
  const explicit = session?.orgCurrency;
  if (explicit && explicit !== 'USD' && SUPPORTED_CURRENCIES[explicit]) {
    return explicit;
  }
  if (session?.orgCountry) {
    const byCountry = findCountryCurrency(session.orgCountry);
    if (byCountry && SUPPORTED_CURRENCIES[byCountry]) return byCountry;
  }
  if (session?.orgTimezone) {
    const byTz = TIMEZONE_TO_CURRENCY[session.orgTimezone];
    if (byTz && SUPPORTED_CURRENCIES[byTz]) return byTz;
  }
  return explicit && SUPPORTED_CURRENCIES[explicit] ? explicit : 'USD';
}

/**
 * Seam for a future live exchange-rate service. Implement this and pass it into
 * `convertAmount` to replace the static fallback rates without touching UI code.
 */
export interface ExchangeRateProvider {
  convert(amount: number, from: string, to: string): number | null;
}

/**
 * Converts an amount from one currency to another. Uses the provided live
 * provider when available, otherwise falls back to the static `usdRate` table.
 */
export function convertAmount(
  amount: number,
  from: string,
  to: string,
  provider?: ExchangeRateProvider | null,
): number {
  if (!Number.isFinite(amount) || amount === 0 || from === to) return amount;
  if (provider) {
    const converted = provider.convert(amount, from, to);
    if (converted !== null && Number.isFinite(converted)) return converted;
  }
  const fromInfo = SUPPORTED_CURRENCIES[from];
  const toInfo = SUPPORTED_CURRENCIES[to];
  if (!fromInfo || !toInfo) return amount;
  return (amount / fromInfo.usdRate) * toInfo.usdRate;
}

/** Formats an amount using the centralized currency symbol table. */
export function formatCurrencyAmount(amount: number, currency: string): string {
  const info = SUPPORTED_CURRENCIES[currency] ?? SUPPORTED_CURRENCIES.USD;
  const rounded = Math.round(amount);
  const formatted = rounded.toLocaleString('en-US');
  return `${info.symbol}${formatted}`;
}
