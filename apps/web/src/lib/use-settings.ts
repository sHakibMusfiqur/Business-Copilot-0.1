'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { getSettings, updateSettings, type SettingsNamespace } from '@/lib/api';

interface UseSettingsOptions<T extends object> {
  defaults: T;
  normalize?: (stored: Partial<T>) => Partial<T>;
}

export function useSettings<T extends object>(
  namespace: SettingsNamespace,
  options: UseSettingsOptions<T>,
) {
  const { defaults, normalize } = options;
  const defaultsRef = useRef(defaults);
  const normalizeRef = useRef(normalize);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [values, setValues] = useState<T>(defaults);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const valuesRef = useRef(values);
  valuesRef.current = values;
  const savingRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const stored = await getSettings<Partial<T>>(namespace);
      if (!mountedRef.current) return;
      if (stored && Object.keys(stored).length > 0) {
        const normalized = normalizeRef.current ? normalizeRef.current(stored) : stored;
        setValues({ ...defaultsRef.current, ...normalized });
      } else {
        setValues({ ...defaultsRef.current });
      }
      setDirty(false);
      setSaved(false);
    } catch {
      if (mountedRef.current) setLoadError('Could not load your settings. Please try again.');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [namespace]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const update = useCallback((patch: Partial<T>) => {
    setValues((prev) => ({ ...prev, ...patch }));
    setDirty(true);
    setSaved(false);
  }, []);

  const reset = useCallback(() => {
    setValues({ ...defaultsRef.current });
    setDirty(false);
    setSaved(false);
  }, []);

  const save = useCallback(
    async (payloadOverride?: T) => {
      if (savingRef.current) return;
      const payload = payloadOverride ?? valuesRef.current;
      savingRef.current = true;
      setSaving(true);
      setSaved(false);
      try {
        const updated = await updateSettings<T>(namespace, payload);
        if (!mountedRef.current) return;
        setValues((prev) => ({ ...prev, ...updated }));
        setDirty(false);
        setSaved(true);
      } finally {
        savingRef.current = false;
        if (mountedRef.current) setSaving(false);
      }
    },
    [namespace],
  );

  return {
    values,
    loading,
    loadError,
    reload,
    dirty,
    update,
    reset,
    save,
    saving,
    saved,
  };
}
