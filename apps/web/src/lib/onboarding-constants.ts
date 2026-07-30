export const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'ar', label: 'Arabic' },
  { code: 'bn', label: 'Bengali' },
  { code: 'zh', label: 'Chinese (Simplified)' },
  { code: 'nl', label: 'Dutch' },
  { code: 'fr', label: 'French' },
  { code: 'de', label: 'German' },
  { code: 'hi', label: 'Hindi' },
  { code: 'id', label: 'Indonesian' },
  { code: 'ja', label: 'Japanese' },
  { code: 'ko', label: 'Korean' },
  { code: 'ms', label: 'Malay' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'ru', label: 'Russian' },
  { code: 'es', label: 'Spanish' },
  { code: 'ta', label: 'Tamil' },
  { code: 'tr', label: 'Turkish' },
  { code: 'ur', label: 'Urdu' },
  { code: 'vi', label: 'Vietnamese' },
];

export const TIMEZONES = Intl.supportedValuesOf?.('timeZone') ?? [
  'UTC', 'America/New_York', 'America/Chicago', 'America/Denver',
  'America/Los_Angeles', 'Europe/London', 'Europe/Paris', 'Europe/Berlin',
  'Asia/Dubai', 'Asia/Dhaka', 'Asia/Kolkata', 'Asia/Singapore',
  'Asia/Tokyo', 'Australia/Sydney',
];

export const AI_PERSONALITIES = [
  { id: 'professional', label: 'Professional', description: 'Formal and business-appropriate tone' },
  { id: 'friendly', label: 'Friendly', description: 'Warm and approachable communication' },
  { id: 'concise', label: 'Concise', description: 'Short, direct, and to the point' },
  { id: 'analytical', label: 'Analytical', description: 'Data-driven with detailed insights' },
] as const;

export const CURRENCIES = [
  { code: 'USD', label: 'USD - US Dollar' },
  { code: 'EUR', label: 'EUR - Euro' },
  { code: 'GBP', label: 'GBP - British Pound' },
  { code: 'BDT', label: 'BDT - Bangladeshi Taka' },
  { code: 'INR', label: 'INR - Indian Rupee' },
  { code: 'JPY', label: 'JPY - Japanese Yen' },
  { code: 'SGD', label: 'SGD - Singapore Dollar' },
  { code: 'AED', label: 'AED - UAE Dirham' },
];
