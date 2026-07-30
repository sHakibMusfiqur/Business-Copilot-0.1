'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { COUNTRIES, getFlagEmoji, parseE164, formatE164, type CountryInfo } from '@/lib/countries';

interface PhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function PhoneInput({ value, onChange, placeholder = 'Enter phone number' }: PhoneInputProps) {
  const [selectedCountry, setSelectedCountry] = useState<CountryInfo>(() => {
    if (value) {
      const parsed = parseE164(value);
      if (parsed) {
        return COUNTRIES.find(c => c.dial === parsed.dial) ?? COUNTRIES[0];
      }
    }
    return COUNTRIES.find(c => c.code === 'BD') ?? COUNTRIES[0];
  });

  const [localNumber, setLocalNumber] = useState(() => {
    if (value) {
      const parsed = parseE164(value);
      return parsed?.localNumber ?? '';
    }
    return '';
  });

  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const filtered = COUNTRIES.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.dial.includes(search) ||
    c.code.toLowerCase().includes(search)
  );

  const handleCountrySelect = useCallback((country: CountryInfo) => {
    setSelectedCountry(country);
    onChange(formatE164(country.dial, localNumber));
    setIsOpen(false);
    setSearch('');
  }, [localNumber, onChange]);

  const handleLocalNumberChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, '');
    setLocalNumber(digits);
    onChange(formatE164(selectedCountry.dial, digits));
  }, [selectedCountry.dial, onChange]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  return (
    <div className="relative" ref={dropdownRef}>
      <div className="flex">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex shrink-0 items-center gap-1.5 rounded-l-xl border border-r-0 border-slate-700 bg-slate-800/50 px-3 py-3 text-white transition-colors hover:bg-slate-700/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        >
          <span className="text-lg leading-none">{getFlagEmoji(selectedCountry.code)}</span>
          <span className="text-sm font-medium">{selectedCountry.dial}</span>
          <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>
        <input
          value={localNumber}
          onChange={handleLocalNumberChange}
          placeholder={placeholder}
          inputMode="numeric"
          className="w-full min-w-0 rounded-r-xl border border-slate-700 bg-slate-800/50 py-3 pl-3 pr-4 text-white placeholder-slate-500 backdrop-blur-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        />
      </div>

      {isOpen && (
        <div className="absolute left-0 top-full z-50 mt-1 w-80 rounded-xl border border-slate-700 bg-slate-800 shadow-xl">
          <div className="relative p-2">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              ref={searchInputRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search countries..."
              className="w-full rounded-lg border border-slate-700 bg-slate-900/50 py-2 pl-8 pr-3 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
            />
          </div>
          <ul className="max-h-60 overflow-y-auto overscroll-contain">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-slate-500">No countries found</li>
            ) : (
              filtered.map((country) => (
                <li key={country.code}>
                  <button
                    type="button"
                    onClick={() => handleCountrySelect(country)}
                    className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-slate-700/50 ${
                      country.code === selectedCountry.code ? 'bg-blue-500/10 text-blue-400' : 'text-white'
                    }`}
                  >
                    <span className="text-lg leading-none">{getFlagEmoji(country.code)}</span>
                    <span className="flex-1 truncate">{country.name}</span>
                    <span className="text-xs text-slate-400">{country.dial}</span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
