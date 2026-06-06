import { useEffect, useState, useCallback, useMemo } from 'react';

/**
 * useHistory — centralized store for AI generation history.
 *
 * Every tool that calls useAIStream can also call `history.add(...)` when
 * a generation completes. Entries are persisted to localStorage and
 * rendered in the global HistoryPanel (opened from the header bell icon).
 *
 * Why centralized
 * --------------
 * Previously each tool kept its own history (CounselingTool had mood
 * history, MedicationTool had its own, ...). That fragmentation meant
 * the user had to dig into each tool to find past generations. With a
 * single store, "show me everything I've generated recently" becomes a
 * one-click operation.
 *
 * Storage shape
 * -------------
 *   ai-tools-launcher.history.v1
 *     { entries: HistoryEntry[] }
 *
 * Limited to HISTORY_LIMIT entries (oldest evicted on overflow).
 */

export interface HistoryEntry {
  id: string;
  toolId: number;
  toolName: string;
  prompt: string;       // user input (truncated to 500 chars in add())
  result: string;       // final answer text
  thinking?: string;    // chain-of-thought block, if any
  createdAt: number;    // epoch ms
  provider?: string;    // e.g. 'MiniMax' | 'openai' | 'anthropic'
  durationMs?: number;  // wall-clock time of the generation
}

const KEY = 'ai-tools-launcher.history.v1';
const HISTORY_LIMIT = 200;
const PROMPT_LIMIT = 500;
const RESULT_LIMIT = 8000;       // cap stored result; UI can show full from cache if needed
const THINKING_LIMIT = 8000;

interface PersistedShape { entries: HistoryEntry[]; }

function load(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const data = JSON.parse(raw) as PersistedShape;
    return Array.isArray(data?.entries) ? data.entries : [];
  } catch {
    return [];
  }
}

function save(entries: HistoryEntry[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ entries }));
  } catch {
    // localStorage quota exceeded — silently drop the oldest to make room
    const trimmed = entries.slice(0, Math.max(10, Math.floor(entries.length / 2)));
    try { localStorage.setItem(KEY, JSON.stringify({ entries: trimmed })); } catch {}
  }
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

let listeners: Array<(e: HistoryEntry[]) => void> = [];
let state: HistoryEntry[] = load();

function commit(next: HistoryEntry[]) {
  state = next;
  save(next);
  listeners.forEach((l) => l(next));
}

export interface AddInput {
  toolId: number;
  toolName: string;
  prompt: string;
  result: string;
  thinking?: string;
  provider?: string;
  durationMs?: number;
}

function clamp(s: string | undefined, limit: number): string | undefined {
  if (!s) return s;
  return s.length > limit ? s.slice(0, limit) + '\n…' : s;
}

export function useHistory() {
  const [snap, setSnap] = useState<HistoryEntry[]>(state);

  useEffect(() => {
    const l = (e: HistoryEntry[]) => setSnap([...e]);
    listeners.push(l);
    return () => { listeners = listeners.filter((x) => x !== l); };
  }, []);

  const add = useCallback((input: AddInput): HistoryEntry => {
    const entry: HistoryEntry = {
      id: uid(),
      toolId: input.toolId,
      toolName: input.toolName,
      prompt: clamp(input.prompt, PROMPT_LIMIT) || '',
      result: clamp(input.result, RESULT_LIMIT) || '',
      thinking: clamp(input.thinking, THINKING_LIMIT),
      createdAt: Date.now(),
      provider: input.provider,
      durationMs: input.durationMs,
    };
    const next = [entry, ...state].slice(0, HISTORY_LIMIT);
    commit(next);
    return entry;
  }, []);

  const remove = useCallback((id: string) => {
    commit(state.filter((e) => e.id !== id));
  }, []);

  const clear = useCallback(() => {
    commit([]);
  }, []);

  const clearByTool = useCallback((toolId: number) => {
    commit(state.filter((e) => e.toolId !== toolId));
  }, []);

  // Group entries by tool for the panel sidebar.
  const grouped = useMemo(() => {
    const out: Record<number, HistoryEntry[]> = {};
    for (const e of snap) {
      (out[e.toolId] ??= []).push(e);
    }
    return out;
  }, [snap]);

  return {
    entries: snap,
    grouped,
    add,
    remove,
    clear,
    clearByTool,
  };
}
