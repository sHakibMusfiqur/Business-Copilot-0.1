'use client';

import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useOnboarding } from '../_hooks/onboarding-context';
import { getIndustries, type OnboardingIndustry } from '@/lib/onboarding-api';

const INDUSTRY_ICONS: Record<string, string> = {
  garments: '👕', hospital: '🏥', school: '🎓', restaurant: '🍽️',
  retail: '🛍️', manufacturing: '🏭', pharmacy: '💊', 'it-services': '💻',
};

const INDUSTRY_COLORS: Record<string, string> = {
  garments: 'from-indigo-500 to-purple-600',
  hospital: 'from-red-500 to-rose-600',
  school: 'from-amber-500 to-orange-600',
  restaurant: 'from-orange-500 to-red-500',
  retail: 'from-violet-500 to-purple-600',
  manufacturing: 'from-blue-500 to-cyan-600',
  pharmacy: 'from-green-500 to-emerald-600',
  'it-services': 'from-cyan-500 to-teal-600',
};

export default function IndustryPage() {
  const { wizard, session, saveField, completeStep } = useOnboarding();
  const [industries, setIndustries] = useState<OnboardingIndustry[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(session?.selectedIndustry ?? null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(session?.selectedCategory ?? null);
  const [loading, setLoading] = useState(true);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    getIndustries()
      .then(setIndustries)
      .catch(() => setLocalError('Failed to load industries'))
      .finally(() => setLoading(false));
  }, []);

  const selected = industries.find((i) => i.id === selectedId);

  const handleContinue = async () => {
    if (!selectedId) { setLocalError('Please select an industry'); return; }
    setLocalError(null);
    saveField('selectedIndustry', selectedId);
    saveField('selectedCategory', selectedCategory);
    await completeStep(3);
    wizard.goNext();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center pt-20">
        <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto max-w-2xl pt-8"
    >
      <div className="rounded-2xl border border-slate-700/50 bg-slate-800/40 p-8 backdrop-blur-xl">
        <h2 className="mb-2 text-2xl font-bold text-white">Select Your Industry</h2>
        <p className="mb-6 text-sm text-slate-400">
          Choose the industry that best describes your business
        </p>

        {localError && (
          <p className="mb-4 rounded-lg bg-red-500/10 px-4 py-2 text-sm text-red-400">{localError}</p>
        )}

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {industries.map((industry) => (
            <button
              key={industry.id}
              onClick={() => { setSelectedId(industry.id); setSelectedCategory(null); }}
              className={`group relative overflow-hidden rounded-xl border p-4 text-left transition-all ${
                selectedId === industry.id
                  ? 'border-blue-500 bg-blue-500/10 shadow-lg shadow-blue-500/10'
                  : 'border-slate-700 bg-slate-800/30 hover:border-slate-600'
              }`}
            >
              <div className={`mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br ${INDUSTRY_COLORS[industry.id] ?? 'from-slate-600 to-slate-700'}`}>
                <span className="text-xl">{INDUSTRY_ICONS[industry.id] ?? '📋'}</span>
              </div>
              <h3 className="mb-1 text-sm font-semibold text-white">{industry.name}</h3>
              <p className="text-xs text-slate-400 line-clamp-2">{industry.description}</p>
            </button>
          ))}
        </div>

        {selected && selected.categories.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mt-6"
          >
            <h3 className="mb-3 text-sm font-medium text-slate-300">Select a category</h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {selected.categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`rounded-xl border px-4 py-3 text-left transition-all ${
                    selectedCategory === cat.id
                      ? 'border-blue-500 bg-blue-500/10'
                      : 'border-slate-700 bg-slate-800/30 hover:border-slate-600'
                  }`}
                >
                  <p className="text-sm font-medium text-white">{cat.name}</p>
                  <p className="text-xs text-slate-400">{cat.description}</p>
                </button>
              ))}
            </div>
          </motion.div>
        )}

        <div className="mt-8 flex items-center justify-between">
          <button onClick={wizard.goBack} className="flex items-center gap-2 text-sm text-slate-400 transition-colors hover:text-white">
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <button
            onClick={handleContinue}
            disabled={!selectedId}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3 font-semibold text-white shadow-lg transition-all hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50"
          >
            Continue <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
