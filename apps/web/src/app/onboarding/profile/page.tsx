'use client';

import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, User } from 'lucide-react';
import { useState } from 'react';
import { useOnboarding } from '../_hooks/onboarding-context';

export default function ProfilePage() {
  const { wizard, session, saveField, completeStep } = useOnboarding();
  const [jobTitle, setJobTitle] = useState('');
  const [department, setDepartment] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  if (!session) {
    return <div className="flex items-center justify-center pt-20"><p className="text-slate-400">No session found.</p></div>;
  }

  const handleContinue = async () => {
    if (!jobTitle.trim()) { setLocalError('Please enter your job title'); return; }
    setLocalError(null);
    saveField('businessProfile', { ...((session.businessProfile as Record<string, unknown>) ?? {}), jobTitle, department });
    await completeStep(3);
    wizard.goNext();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto max-w-md pt-8"
    >
      <div className="rounded-2xl border border-slate-700/50 bg-slate-800/40 p-8 backdrop-blur-xl">
        <div className="mb-6 flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600">
            <User className="h-8 w-8 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">Your Profile</h2>
            <p className="text-sm text-slate-400">{session.name}</p>
          </div>
        </div>

        {localError && (
          <p className="mb-4 rounded-lg bg-red-500/10 px-4 py-2 text-sm text-red-400">{localError}</p>
        )}

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">Job Title *</label>
            <input
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              placeholder="CEO / Founder / Manager"
              className="w-full rounded-xl border border-slate-700 bg-slate-800/50 px-4 py-3 text-white placeholder-slate-500 backdrop-blur-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">Department</label>
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-800/50 px-4 py-3 text-white backdrop-blur-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="" className="bg-slate-900">Select department</option>
              <option value="management" className="bg-slate-900">Management</option>
              <option value="it" className="bg-slate-900">IT</option>
              <option value="finance" className="bg-slate-900">Finance</option>
              <option value="operations" className="bg-slate-900">Operations</option>
              <option value="hr" className="bg-slate-900">HR</option>
              <option value="sales" className="bg-slate-900">Sales</option>
              <option value="other" className="bg-slate-900">Other</option>
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
