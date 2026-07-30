'use client';

import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Camera, User } from 'lucide-react';
import { useState, useRef } from 'react';
import { useOnboarding } from '../_hooks/onboarding-context';
import { PhoneInput } from '@/components/onboarding/phone-input';
import { LANGUAGES, TIMEZONES } from '@/lib/onboarding-constants';

export default function ProfilePage() {
  const { wizard, session, saveField, completeStep, persistSession } = useOnboarding();
  const bp = session?.businessProfile as Record<string, unknown> | null ?? {};
  const [displayName, setDisplayName] = useState((bp.name as string) ?? session?.name ?? '');
  const [phone, setPhone] = useState((bp.phone as string) ?? '');
  const [language, setLanguage] = useState((bp.language as string) ?? 'en');
  const [timezone, setTimezone] = useState((bp.timezone as string) ?? session?.orgTimezone ?? 'Asia/Dhaka');
  const [bio, setBio] = useState((bp.bio as string) ?? '');
  const [avatar, setAvatar] = useState((bp.avatar as string) ?? '');
  const fileRef = useRef<HTMLInputElement>(null);

  if (!session) {
    return <div className="flex items-center justify-center pt-20"><p className="text-slate-400">No session found.</p></div>;
  }

  const handleAvatar = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setAvatar(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleContinue = async () => {
    console.log('[PAGE profile handleContinue BEFORE saveField]', { session: { selectedIndustry: session?.selectedIndustry, orgName: session?.orgName, version: session?.version, currentStep: session?.currentStep } });
    saveField('businessProfile', { ...bp, name: displayName, phone, language, timezone, bio, avatar });
    console.log('[PAGE profile handleContinue AFTER saveField]', { session: { selectedIndustry: session?.selectedIndustry, orgName: session?.orgName, version: session?.version, currentStep: session?.currentStep } });
    await persistSession();
    console.log('[PAGE profile handleContinue AFTER persistSession]', { session: { selectedIndustry: session?.selectedIndustry, orgName: session?.orgName, version: session?.version, currentStep: session?.currentStep } });
    await completeStep(3);
    console.log('[PAGE profile handleContinue AFTER completeStep]', { session: { selectedIndustry: session?.selectedIndustry, orgName: session?.orgName, version: session?.version, currentStep: session?.currentStep } });
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
          <button
            onClick={() => fileRef.current?.click()}
            className="group relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-blue-500 to-indigo-600"
          >
            {avatar ? (
              <div className="h-full w-full bg-cover bg-center" style={{ backgroundImage: `url(${avatar})` }} />
            ) : (
              <User className="h-8 w-8 text-white" />
            )}
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
              <Camera className="h-5 w-5 text-white" />
            </div>
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatar} />
          <div>
            <h2 className="text-2xl font-bold text-white">Your Profile</h2>
            <p className="text-sm text-slate-400">Founder account details</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">Full Name</label>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your full name"
              className="w-full rounded-xl border border-slate-700 bg-slate-800/50 px-4 py-3 text-white placeholder-slate-500 backdrop-blur-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">Phone Number</label>
            <PhoneInput value={phone} onChange={setPhone} placeholder="Enter phone number" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">Preferred Language</label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-800/50 px-4 py-3 text-white backdrop-blur-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                {LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code} className="bg-slate-900">{l.label}</option>
                ))}
              </select>
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
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">Bio <span className="text-slate-500">(optional)</span></label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell us a little about yourself..."
              rows={3}
              className="w-full resize-none rounded-xl border border-slate-700 bg-slate-800/50 px-4 py-3 text-white placeholder-slate-500 backdrop-blur-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
        </div>

        <div className="mt-8 flex items-center justify-between rounded-xl border border-slate-700/30 bg-slate-800/20 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/10">
              <span className="text-xs font-bold text-amber-400">!</span>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-300">Founder Account</p>
              <p className="text-xs text-slate-500">Organization Owner · Super Admin</p>
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between">
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
