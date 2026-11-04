import { useSyncExternalStore } from 'react';
import { DEFAULT_GEMINI_MODEL } from '@savesutra/core';

export type Theme = 'system' | 'light' | 'dark';
export type Mode = 'local' | 'server';
export type Layout = 'cards' | 'table' | 'board' | 'timeline';

export interface Settings {
  /** "local": library on this device. "server": your own SaveSutra server (needed for the WhatsApp bot). */
  mode: Mode;
  serverUrl: string;
  apiToken: string;
  /** Optional Gemini key for on-device AI. Stays on this device. */
  geminiKey: string;
  geminiModel: string;
  theme: Theme;
  layout: Layout;
  /** ISO time the user accepted the privacy notice (DPDP-style consent). */
  consentAt: string | null;
  onboarded: boolean;
}

const KEY = 'savesutra.settings.v1';
const DEFAULTS: Settings = {
  mode: 'local',
  serverUrl: '',
  apiToken: '',
  geminiKey: '',
  geminiModel: DEFAULT_GEMINI_MODEL,
  theme: 'system',
  layout: 'cards',
  consentAt: null,
  onboarded: false,
};

function read(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>) } : { ...DEFAULTS };
  } catch {
    return { ...DEFAULTS };
  }
}

let current: Settings = typeof localStorage === 'undefined' ? { ...DEFAULTS } : read();
const listeners = new Set<() => void>();

export function getSettings(): Settings {
  return current;
}

export function updateSettings(patch: Partial<Settings>): void {
  current = { ...current, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    /* storage may be unavailable (private mode); keep in memory */
  }
  for (const l of listeners) l();
}

export function resetSettings(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  current = { ...DEFAULTS };
  for (const l of listeners) l();
}

export function useSettings(): Settings {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current,
  );
}

/** Apply the theme to <html>, following the OS when set to "system". */
export function applyTheme(theme: Theme): void {
  const dark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0B0F17' : '#0B1220');
}
