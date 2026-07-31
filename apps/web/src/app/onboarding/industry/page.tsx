'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight, Loader2, Check, X } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
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
  const { wizard, session, saveField, completeStep, persistSession } = useOnboarding();
  const [industries, setIndustries] = useState<OnboardingIndustry[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(session?.selectedIndustry ?? null);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(session?.selectedCategories ?? []);
  const [loading, setLoading] = useState(true);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    getIndustries()
      .then(setIndustries)
      .catch(() => setLocalError('Failed to load industries'))
      .finally(() => setLoading(false));
  }, []);

  const selected = industries.find((i) => i.id === selectedId);

  const toggleCategory = useCallback((catId: string) => {
    setSelectedCategories((prev) =>
      prev.includes(catId) ? prev.filter((id) => id !== catId) : [...prev, catId]
    );
  }, []);

  const removeCategory = useCallback((catId: string) => {
    setSelectedCategories((prev) => prev.filter((id) => id !== catId));
  }, []);

  const handleContinue = async () => {
    if (!selectedId) { setLocalError('Please select an industry'); return; }
    if (selectedCategories.length === 0) { setLocalError('Please select at least one category.'); return; }
    setLocalError(null);
    saveField('selectedIndustry', selectedId);
    saveField('selectedCategories', selectedCategories);
    await persistSession();
    await completeStep(1);
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
              onClick={() => { setSelectedId(industry.id); setSelectedCategories([]); saveField('selectedCategories', []); saveField('selectedCategory', null); setLocalError(null); }}
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
            <div className="mb-1 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-slate-300">Select Categories</h3>
                <p className="text-xs text-slate-500">You can choose one or more categories.</p>
              </div>
              {selectedCategories.length > 0 && (
                <motion.span
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-xs font-medium text-blue-400"
                >
                  {selectedCategories.length} Selected
                </motion.span>
              )}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {selected.categories.map((cat) => {
                const isSelected = selectedCategories.includes(cat.id);
                return (
                  <motion.button
                    key={cat.id}
                    layout
                    onClick={() => toggleCategory(cat.id)}
                    className={`relative rounded-xl border px-4 py-3 text-left transition-all ${
                      isSelected
                        ? 'border-blue-500 bg-blue-500/10 shadow-lg shadow-blue-500/20'
                        : 'border-slate-700 bg-slate-800/30 hover:border-slate-600'
                    }`}
                  >
                    {isSelected && (
                      <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-blue-500">
                        <Check className="h-3 w-3 text-white" />
                      </span>
                    )}
                    <p className="text-sm font-medium text-white">{cat.name}</p>
                    <p className="text-xs text-slate-400">{cat.description}</p>
                  </motion.button>
                );
              })}
            </div>

            <AnimatePresence>
              {selectedCategories.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="mt-4 flex flex-wrap gap-2"
                >
                  {selectedCategories.map((catId) => {
                    const cat = selected.categories.find((c) => c.id === catId);
                    if (!cat) return null;
                    return (
                      <motion.span
                        key={catId}
                        layout
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-300"
                      >
                        {cat.name}
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); removeCategory(catId); }}
                          className="ml-0.5 rounded-full p-0.5 transition-colors hover:bg-blue-500/20"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </motion.span>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        <div className="mt-8 flex items-center justify-between">
          <button onClick={wizard.goBack} className="flex items-center gap-2 text-sm text-slate-400 transition-colors hover:text-white">
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <button
            onClick={handleContinue}
            disabled={!selectedId || selectedCategories.length === 0}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3 font-semibold text-white shadow-lg transition-all hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50"
          >
            Continue <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
