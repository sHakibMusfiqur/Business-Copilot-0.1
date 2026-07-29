'use client';

import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Building2, Globe, MapPin, Phone, Mail } from 'lucide-react';
import { useState } from 'react';
import { useOnboarding } from '../_hooks/onboarding-context';

const TIMEZONES = Intl.supportedValuesOf?.('timeZone') ?? [
  'UTC', 'America/New_York', 'America/Chicago', 'America/Denver',
  'America/Los_Angeles', 'Europe/London', 'Europe/Paris', 'Europe/Berlin',
  'Asia/Dubai', 'Asia/Dhaka', 'Asia/Kolkata', 'Asia/Singapore',
  'Asia/Tokyo', 'Australia/Sydney',
];

const CURRENCIES = [
  { code: 'USD', label: 'USD - US Dollar' },
  { code: 'EUR', label: 'EUR - Euro' },
  { code: 'GBP', label: 'GBP - British Pound' },
  { code: 'BDT', label: 'BDT - Bangladeshi Taka' },
  { code: 'INR', label: 'INR - Indian Rupee' },
  { code: 'JPY', label: 'JPY - Japanese Yen' },
  { code: 'SGD', label: 'SGD - Singapore Dollar' },
  { code: 'AED', label: 'AED - UAE Dirham' },
];

export default function OrgInfoPage() {
  const { wizard, session, saveField, completeStep } = useOnboarding();
  const [name, setName] = useState(session?.orgName ?? '');
  const [email, setEmail] = useState(session?.orgEmail ?? session?.email ?? '');
  const [phone, setPhone] = useState(session?.orgPhone ?? '');
  const [website, setWebsite] = useState(session?.orgWebsite ?? '');
  const [country, setCountry] = useState(session?.orgCountry ?? '');
  const [state, setState] = useState(session?.orgState ?? '');
  const [city, setCity] = useState(session?.orgCity ?? '');
  const [address, setAddress] = useState(session?.orgAddress ?? '');
  const [timezone, setTimezone] = useState(session?.orgTimezone ?? 'UTC');
  const [currency, setCurrency] = useState(session?.orgCurrency ?? 'USD');
  const [localError, setLocalError] = useState<string | null>(null);

  if (!session) {
    return <div className="flex items-center justify-center pt-20"><p className="text-slate-400">No session found.</p></div>;
  }

  const handleContinue = async () => {
    if (!name.trim()) { setLocalError('Organization name is required'); return; }
    setLocalError(null);
    saveField('orgName', name.trim());
    saveField('orgEmail', email.trim());
    saveField('orgPhone', phone.trim());
    saveField('orgWebsite', website.trim());
    saveField('orgCountry', country.trim());
    saveField('orgState', state.trim());
    saveField('orgCity', city.trim());
    saveField('orgAddress', address.trim());
    saveField('orgTimezone', timezone);
    saveField('orgCurrency', currency);
    await completeStep(4);
    wizard.goNext();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto max-w-2xl pt-8"
    >
      <div className="rounded-2xl border border-slate-700/50 bg-slate-800/40 p-8 backdrop-blur-xl">
        <h2 className="mb-2 text-2xl font-bold text-white">Organization Details</h2>
        <p className="mb-6 text-sm text-slate-400">Tell us about your business</p>

        {localError && (
          <p className="mb-4 rounded-lg bg-red-500/10 px-4 py-2 text-sm text-red-400">{localError}</p>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-xs font-medium text-slate-400">Organization Name *</label>
            <div className="relative">
              <Building2 className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Acme Corp"
                className="w-full rounded-xl border border-slate-700 bg-slate-800/50 py-3 pl-12 pr-4 text-white placeholder-slate-500 backdrop-blur-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">Email</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="contact@acme.com"
                className="w-full rounded-xl border border-slate-700 bg-slate-800/50 py-3 pl-12 pr-4 text-white placeholder-slate-500 backdrop-blur-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">Phone</label>
            <div className="relative">
              <Phone className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 555-0123"
                className="w-full rounded-xl border border-slate-700 bg-slate-800/50 py-3 pl-12 pr-4 text-white placeholder-slate-500 backdrop-blur-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
          </div>

          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-xs font-medium text-slate-400">Website</label>
            <div className="relative">
              <Globe className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
              <input
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://acme.com"
                className="w-full rounded-xl border border-slate-700 bg-slate-800/50 py-3 pl-12 pr-4 text-white placeholder-slate-500 backdrop-blur-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">Country</label>
            <input
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              placeholder="United States"
              className="w-full rounded-xl border border-slate-700 bg-slate-800/50 px-4 py-3 text-white placeholder-slate-500 backdrop-blur-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">State / Region</label>
            <input
              value={state}
              onChange={(e) => setState(e.target.value)}
              placeholder="California"
              className="w-full rounded-xl border border-slate-700 bg-slate-800/50 px-4 py-3 text-white placeholder-slate-500 backdrop-blur-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">City</label>
            <div className="relative">
              <MapPin className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="San Francisco"
                className="w-full rounded-xl border border-slate-700 bg-slate-800/50 py-3 pl-12 pr-4 text-white placeholder-slate-500 backdrop-blur-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">Address</label>
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="123 Main St"
              className="w-full rounded-xl border border-slate-700 bg-slate-800/50 px-4 py-3 text-white placeholder-slate-500 backdrop-blur-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">Timezone</label>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-800/50 px-4 py-3 text-white backdrop-blur-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz} className="bg-slate-900">{tz}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">Currency</label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-800/50 px-4 py-3 text-white backdrop-blur-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code} className="bg-slate-900">{c.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-8 flex items-center justify-between">
          <button onClick={wizard.goBack} className="flex items-center gap-2 text-sm text-slate-400 transition-colors hover:text-white">
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <button onClick={handleContinue} className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3 font-semibold text-white shadow-lg transition-all hover:from-blue-500 hover:to-indigo-500">
            Continue <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
