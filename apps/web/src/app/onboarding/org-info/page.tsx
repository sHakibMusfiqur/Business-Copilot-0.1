'use client';

import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Building2, Globe, MapPin, Mail } from 'lucide-react';
import { useState, useRef, useEffect, useMemo } from 'react';
import { useOnboarding } from '../_hooks/onboarding-context';
import { PhoneInput } from '@/components/onboarding/phone-input';
import { COUNTRIES, getFlagEmoji, findCountryByName } from '@/lib/countries';
import { TIMEZONES, CURRENCIES } from '@/lib/onboarding-constants';

export default function OrgInfoPage() {
  const { wizard, session, saveFields, completeStep, persistSession } = useOnboarding();
  const [name, setName] = useState(session?.orgName ?? '');
  const [email, setEmail] = useState(session?.orgEmail ?? session?.email ?? '');
  const [phone, setPhone] = useState(session?.orgPhone ?? '');
  const [website, setWebsite] = useState(session?.orgWebsite ?? '');
  const [country, setCountry] = useState(session?.orgCountry ?? 'Bangladesh');
  const [state, setState] = useState(session?.orgState ?? '');
  const [city, setCity] = useState(session?.orgCity ?? '');
  const [address, setAddress] = useState(session?.orgAddress ?? '');
  const [timezone, setTimezone] = useState(session?.orgTimezone ?? 'Asia/Dhaka');
  const [currency, setCurrency] = useState(session?.orgCurrency ?? 'USD');
  const [localError, setLocalError] = useState<string | null>(null);
  const [countryOpen, setCountryOpen] = useState(false);
  const countryRef = useRef<HTMLDivElement>(null);

  const timezoneOptions = useMemo(() =>
    TIMEZONES.map(tz => {
      try {
        const offset = new Intl.DateTimeFormat('en', {
          timeZone: tz, timeZoneName: 'shortOffset',
        }).formatToParts(new Date()).find(p => p.type === 'timeZoneName')?.value;
        return { value: tz, label: offset ? `${tz} (${offset})` : tz };
      } catch {
        return { value: tz, label: tz };
      }
    }),
  []);

  const filteredCountries = useMemo(() =>
    country.trim()
      ? COUNTRIES.filter(c =>
          c.name.toLowerCase().startsWith(country.toLowerCase()) ||
          c.name.toLowerCase().includes(` ${country.toLowerCase()}`)
        ).slice(0, 20)
      : COUNTRIES.slice(0, 20),
    [country]
  );

  useEffect(() => {
    if (country.trim()) {
      const match = findCountryByName(country);
      if (match) {
        setTimezone(match.timezone);
      }
    }
  }, [country]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (countryRef.current && !countryRef.current.contains(e.target as Node)) {
        setCountryOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  if (!session) {
    return <div className="flex items-center justify-center pt-20"><p className="text-slate-400">No session found.</p></div>;
  }

  const handleContinue = async () => {
    if (!name.trim()) { setLocalError('Organization name is required'); return; }
    setLocalError(null);
    console.log('[PAGE org-info handleContinue BEFORE saveFields]', { session: { selectedIndustry: session?.selectedIndustry, orgName: session?.orgName, version: session?.version, currentStep: session?.currentStep }, name: name.trim() });
    saveFields({
      orgName: name.trim(), orgEmail: email.trim(), orgPhone: phone.trim(),
      orgWebsite: website.trim(), orgCountry: country.trim(), orgState: state.trim(),
      orgCity: city.trim(), orgAddress: address.trim(), orgTimezone: timezone,
      orgCurrency: currency,
    });
    console.log('[PAGE org-info handleContinue AFTER saveFields]', { session: { selectedIndustry: session?.selectedIndustry, orgName: session?.orgName, version: session?.version, currentStep: session?.currentStep } });
    await persistSession();
    console.log('[PAGE org-info handleContinue AFTER persistSession]', { session: { selectedIndustry: session?.selectedIndustry, orgName: session?.orgName, version: session?.version, currentStep: session?.currentStep } });
    await completeStep(2);
    console.log('[PAGE org-info handleContinue AFTER completeStep]', { session: { selectedIndustry: session?.selectedIndustry, orgName: session?.orgName, version: session?.version, currentStep: session?.currentStep } });
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
            <PhoneInput value={phone} onChange={setPhone} placeholder="Enter phone number" />
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

          <div className="relative" ref={countryRef}>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">Country</label>
            <input
              value={country}
              onChange={(e) => { setCountry(e.target.value); setCountryOpen(true); }}
              onFocus={() => setCountryOpen(true)}
              placeholder="Bangladesh"
              className="w-full rounded-xl border border-slate-700 bg-slate-800/50 px-4 py-3 text-white placeholder-slate-500 backdrop-blur-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
            {countryOpen && filteredCountries.length > 0 && (
              <ul className="absolute left-0 top-full z-50 mt-1 w-full rounded-xl border border-slate-700 bg-slate-800 shadow-xl max-h-48 overflow-y-auto overscroll-contain">
                {filteredCountries.map((c) => (
                  <li key={c.code}>
                    <button
                      type="button"
                      onClick={() => { setCountry(c.name); setCountryOpen(false); }}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-white transition-colors hover:bg-slate-700/50"
                    >
                      <span className="text-lg leading-none">{getFlagEmoji(c.code)}</span>
                      <span>{c.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
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
              {timezoneOptions.map((opt) => (
                <option key={opt.value} value={opt.value} className="bg-slate-900">{opt.label}</option>
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
