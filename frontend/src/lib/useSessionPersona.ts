"use client";

import { useSyncExternalStore } from "react";
import { readSessionPersona } from "@/src/lib/persona";
import type { PersonaPreview } from "@/src/types";

const snapshotCache = new Map<string, { raw: string | null; value: PersonaPreview | null }>();

function subscribe() {
  return () => {};
}

function getPersonaSnapshot(sessionId: string) {
  if (typeof window === "undefined") return null;

  const storageKey = `shesells:persona:${sessionId}`;
  const raw = window.sessionStorage.getItem(storageKey);
  const cached = snapshotCache.get(sessionId);
  if (cached && cached.raw === raw) return cached.value;

  const value = readSessionPersona(sessionId);
  snapshotCache.set(sessionId, { raw, value });
  return value;
}

export function useSessionPersona(sessionId: string) {
  return useSyncExternalStore(
    subscribe,
    () => getPersonaSnapshot(sessionId),
    () => null,
  );
}
