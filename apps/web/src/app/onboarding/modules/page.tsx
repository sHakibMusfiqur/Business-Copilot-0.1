'use client';

import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { useState } from 'react';
import { useOnboarding } from '../_hooks/onboarding-context';

const MODULES = [
  { id: 'inventory', label: 'Inventory', description: 'Stock tracking, warehouse management, batch control', price: 19 },
  { id: 'purchase', label: 'Purchase', description: 'Procurement, supplier management, PO workflow', price: 19 },
  { id: 'sales', label: 'Sales', description: 'Order management, invoicing, POS', price: 29 },
  { id: 'accounting', label: 'Accounting', description: 'General ledger, AP/AR, financial reports', price: 39 },
  { id: 'crm', label: 'CRM', description: 'Lead tracking, pipeline, customer management', price: 19 },
  { id: 'hr', label: 'HR & Payroll', description: 'Employee management, attendance, payroll', price: 29 },
];

export default function ModulesPage() {
  const { wizard, session, saveField, completeStep } = useOnboarding();
  const initialModules = (session?.selectedModules as string[]) ?? [];
  const [selected, setSelected] = useState<string[]>(initialModules);

  if (!session) {
    return <div className="flex items-center justify-center pt-20"><p className="text-slate-400">No session found.</p></div>;
  }

  const toggle = (id: string) => {
    setSelected((prev) => prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]);
  };

  const totalPrice = MODULES.filter((m) => selected.includes(m.id)).reduce((sum, m) => sum + m.price, 0);
  const defaultModules = MODULES.filter((m) => ['inventory', 'purchase', 'sales', 'accounting'].includes(m.id));

  const handleContinue = async () => {
    saveField('selectedModules', selected);
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
        <h2 className="mb-2 text-2xl font-bold text-white">Choose Your Modules</h2>
        <p className="mb-6 text-sm text-slate-400">Select the features your business needs</p>

        <div className="space-y-3">
          {MODULES.map((mod) => {
            const isSelected = selected.includes(mod.id);
            const isDefault = defaultModules.includes(mod);
            return (
              <button
                key={mod.id}
                onClick={() => toggle(mod.id)}
                className={`flex w-full items-center gap-4 rounded-xl border p-4 text-left transition-all ${
                  isSelected
                    ? 'border-blue-500 bg-blue-500/10'
                    : 'border-slate-700 bg-slate-800/30 hover:border-slate-600'
                }`}
              >
                <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 transition-all ${
                  isSelected ? 'border-blue-500 bg-blue-500' : 'border-slate-600'
                }`}>
                  {isSelected && <Check className="h-4 w-4 text-white" />}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-white">
                    {mod.label}
                    {isDefault && <span className="ml-2 text-xs text-blue-400">Recommended</span>}
                  </p>
                  <p className="text-xs text-slate-400">{mod.description}</p>
                </div>
                <span className="text-sm font-medium text-slate-300">${mod.price}/mo</span>
              </button>
            );
          })}
        </div>

        {selected.length > 0 && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-4 text-right text-sm text-slate-300"
          >
            Total: <span className="font-bold text-white">${totalPrice}/mo</span>
          </motion.p>
        )}

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
