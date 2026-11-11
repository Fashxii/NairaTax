/**
 * admin/platformStore.ts — Live Firestore sync for platform configuration.
 *
 *   platform_config/settings   → feature flags, maintenance, session policy, announcement (public read)
 *   platform_config/content    → CMS content (public read)
 *   platform_config/tax_rules  → statutory overrides (public read)
 *   platform_config/rbac       → roles & permission matrix (staff read)
 *
 * Each document is subscribed once (onSnapshot) and shared by every hook, so a
 * change published in the admin console reaches all open sessions within
 * seconds. Writes are rejected by firestore.rules unless the signed-in staff
 * member holds the matching permission.
 */

import { useEffect, useState } from 'react';
import { doc, onSnapshot, setDoc, type Unsubscribe } from 'firebase/firestore';
import { auth, db, onAuthStateChanged } from '../lib/firebase';
import { defaultRbac, normalizeRbac, type RbacConfig } from './permissions';
import { defaultSettings, normalizeSettings, type PlatformSettings } from './platformSettings';
import { applyTaxRules, emptyTaxRules, normalizeTaxRules, type TaxRulesDoc } from './taxRules';

type DocId = 'settings' | 'content' | 'tax_rules' | 'rbac';

interface DocState<T> {
  value: T;
  /** True once Firestore returned a snapshot (even if the doc does not exist). */
  loaded: boolean;
  /** True if the document exists in Firestore (i.e. has been published). */
  exists: boolean;
  error: string | null;
}

const normalizers: Record<DocId, (raw: unknown) => unknown> = {
  settings: normalizeSettings,
  content: (raw) => raw ?? null,
  tax_rules: normalizeTaxRules,
  rbac: normalizeRbac,
};

const defaults: Record<DocId, () => unknown> = {
  settings: defaultSettings,
  content: () => null,
  tax_rules: emptyTaxRules,
  rbac: defaultRbac,
};

const state: Record<DocId, DocState<unknown>> = {
  settings: { value: defaultSettings(), loaded: false, exists: false, error: null },
  content: { value: null, loaded: false, exists: false, error: null },
  tax_rules: { value: emptyTaxRules(), loaded: false, exists: false, error: null },
  rbac: { value: defaultRbac(), loaded: false, exists: false, error: null },
};

const listeners: Record<DocId, Set<() => void>> = {
  settings: new Set(),
  content: new Set(),
  tax_rules: new Set(),
  rbac: new Set(),
};

const unsubs: Partial<Record<DocId, Unsubscribe>> = {};

function emit(id: DocId) {
  listeners[id].forEach((fn) => fn());
}

function subscribe(id: DocId) {
  if (unsubs[id] || typeof window === 'undefined') return;
  try {
    unsubs[id] = onSnapshot(
      doc(db, 'platform_config', id),
      (snap) => {
        const raw = snap.exists() ? snap.data() : null;
        state[id] = { value: raw ? normalizers[id](raw) : defaults[id](), loaded: true, exists: snap.exists(), error: null };
        if (id === 'tax_rules') applyTaxRules(snap.exists() ? (state[id].value as TaxRulesDoc) : null);
        emit(id);
      },
      (err) => {
        state[id] = { ...state[id], loaded: true, error: err.message };
        delete unsubs[id];
        emit(id);
      },
    );
  } catch (err) {
    state[id] = { ...state[id], loaded: true, error: (err as Error).message };
  }
}

// The RBAC doc is staff-only: (re)subscribe whenever the Firebase user changes,
// because the first attempt may happen before the custom-token sign-in completes.
if (typeof window !== 'undefined') {
  try {
    onAuthStateChanged(auth, () => {
      unsubs.rbac?.();
      delete unsubs.rbac;
      if (listeners.rbac.size > 0) subscribe('rbac');
    });
  } catch {
    /* auth unavailable (tests) */
  }
}

function useDoc<T>(id: DocId): DocState<T> {
  const [, force] = useState(0);
  useEffect(() => {
    const fn = () => force((n) => n + 1);
    listeners[id].add(fn);
    subscribe(id);
    return () => {
      listeners[id].delete(fn);
    };
  }, [id]);
  return state[id] as DocState<T>;
}

// ─── Read hooks & sync getters ──────────────────────────────────────────────

export function usePlatformSettings(): PlatformSettings {
  return useDoc<PlatformSettings>('settings').value;
}

export function usePlatformSettingsState(): DocState<PlatformSettings> {
  return useDoc<PlatformSettings>('settings');
}

/** Synchronous read for non-React code (e.g. session timeout checks). */
export function getPlatformSettings(): PlatformSettings {
  subscribe('settings');
  return state.settings.value as PlatformSettings;
}

export function usePublishedContent(): DocState<unknown> {
  return useDoc<unknown>('content');
}

export function useTaxRulesState(): DocState<TaxRulesDoc> {
  return useDoc<TaxRulesDoc>('tax_rules');
}

/** Subscribe to tax rules so engine tables are patched for this session. */
export function useTaxRulesSync(): void {
  useDoc<TaxRulesDoc>('tax_rules');
}

export function useRbacState(): DocState<RbacConfig> {
  return useDoc<RbacConfig>('rbac');
}

// ─── Writers ─────────────────────────────────────────────────────────────────

function stamp<T extends object>(value: T, actorEmail: string): T & { updatedAt: string; updatedBy: string } {
  // JSON round-trip drops `undefined`, which Firestore rejects.
  return { ...JSON.parse(JSON.stringify(value)), updatedAt: new Date().toISOString(), updatedBy: actorEmail };
}

export async function savePlatformSettings(next: PlatformSettings, actorEmail: string): Promise<void> {
  const { updatedAt: _a, updatedBy: _b, ...rest } = next;
  await setDoc(doc(db, 'platform_config', 'settings'), stamp(rest, actorEmail));
}

export async function saveRbac(next: RbacConfig, actorEmail: string): Promise<void> {
  await setDoc(doc(db, 'platform_config', 'rbac'), stamp({ roles: next.roles }, actorEmail));
}

export async function saveTaxRules(next: TaxRulesDoc, actorEmail: string): Promise<void> {
  await setDoc(doc(db, 'platform_config', 'tax_rules'), stamp({ taxYears: next.taxYears, whtRates: next.whtRates }, actorEmail));
}

export async function saveContent(content: object, actorEmail: string): Promise<void> {
  await setDoc(doc(db, 'platform_config', 'content'), stamp(content, actorEmail));
}

/** Human-friendly message for Firestore permission errors. */
export function describeWriteError(err: unknown): string {
  const msg = (err as { code?: string; message?: string })?.code ?? (err as Error)?.message ?? String(err);
  if (/permission/i.test(msg)) {
    return 'Permission denied by the server. Your role may lack this permission, or your session predates a role change — sign out and back in.';
  }
  return (err as Error)?.message ?? 'Unknown error';
}

