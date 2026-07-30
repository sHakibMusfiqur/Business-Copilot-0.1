'use client';

import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Bot, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { useOnboarding } from '../_hooks/onboarding-context';
import { LANGUAGES, AI_PERSONALITIES } from '@/lib/onboarding-constants';

export default function AiPage() {
  const { wizard, session, saveFields, completeStep, persistSession } = useOnboarding();
  const [enabled, setEnabled] = useState(session?.aiEnabled ?? true);
  const [language, setLanguage] = useState(session?.aiLanguage ?? 'en');
  const [personality, setPersonality] = useState(session?.aiPersonality ?? 'professional');

  if (!session) {
    return <div className="flex items-center justify-center pt-20"><p className="text-slate-400">No session found.</p></div>;
  }

  const handleContinue = async () => {
    saveFields({ aiEnabled: enabled, aiLanguage: language, aiPersonality: personality });
    await persistSession();
    await completeStep(4);
    wizard.goNext();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto max-w-md pt-8"
    >
      <div className="rounded-2xl border border-slate-700/50 bg-slate-800/40 p-8 backdrop-blur-xl">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-pink-500">
            <Bot className="h-6 w-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">AI Assistant</h2>
            <p className="text-sm text-slate-400">Configure your AI copilot</p>
          </div>
        </div>

        <div className="mb-6 flex items-center justify-between rounded-xl border border-slate-700 bg-slate-800/50 px-4 py-3">
          <div className="flex items-center gap-3">
            <Sparkles className="h-5 w-5 text-purple-400" />
            <span className="text-sm text-white">Enable AI Assistant</span>
          </div>
          <button
            onClick={() => setEnabled(!enabled)}
            className={`relative h-6 w-11 rounded-full transition-colors ${enabled ? 'bg-purple-600' : 'bg-slate-600'}`}
          >
            <div className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-5' : 'translate-x-0'}`} />
          </button>
        </div>

        {enabled && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="space-y-4"
          >
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">Language</label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-800/50 px-4 py-3 text-white backdrop-blur-sm transition-colors focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
              >
                {LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code} className="bg-slate-900">{l.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">Personality</label>
              <div className="grid grid-cols-2 gap-3">
                {AI_PERSONALITIES.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setPersonality(p.id)}
                    className={`rounded-xl border p-3 text-left transition-all ${
                      personality === p.id
                        ? 'border-purple-500 bg-purple-500/10'
                        : 'border-slate-700 bg-slate-800/30 hover:border-slate-600'
                    }`}
                  >
                    <p className="text-sm font-medium text-white">{p.label}</p>
                    <p className="text-xs text-slate-400">{p.description}</p>
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        <div className="mt-8 flex items-center justify-between">
          <button onClick={wizard.goBack} className="flex items-center gap-2 text-sm text-slate-400 transition-colors hover:text-white">
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <button onClick={handleContinue} className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-3 font-semibold text-white shadow-lg transition-all hover:from-purple-500 hover:to-pink-500">
            Continue <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
