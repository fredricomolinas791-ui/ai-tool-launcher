import { useEffect, useState, useCallback, useMemo } from 'react';

/**
 * useFavorites — 全局统一收藏 store。
 *
 * 设计思路与 useHistory 一致(模块级单例 + localStorage 持久化 + listener
 * 跨组件实时同步),但定位不同:
 *   - useHistory:**自动**记录每次 AI 生成(全部、临时性、可清空)
 *   - useFavorites:**用户主动**收藏某一条结果(精选、长期保留)
 *
 * 为什么不让每个工具自己存
 * --------------------------
 * 之前每个工具自己一个 localStorage key(naming-favs / daily-vibes-favs …),
 * 导致用户在不同工具收藏完之后,**找不到统一入口**回看。新方案让全局
 * Header 上的 Bookmark 按钮一次性看到所有收藏 —— 用户问「我之前
 * 收藏的那条 XX」时,不用再去回忆是哪个工具。
 *
 * 工具接入方式
 * -----------
 *   const favs = useFavorites();
 *   favs.add({ toolId: 65, toolName: '猫狗翻译机', kind: 'translation',
 *              title: '...', preview: '...', content: '...', data: {...} });
 *
 * Storage shape
 * -------------
 *   ai-tools-launcher.favorites.v1
 *     { entries: FavoriteEntry[] }
 *
 * 上限 FAV_LIMIT 条,超出最老的会被挤掉。
 */

export interface FavoriteEntry {
  id: string;
  toolId: number;
  toolName: string;
  /** 工具内的子类型,比如 NamingTool 同时收藏名字和测名报告就用 kind 区分。
   *  渲染时可用 kind 决定展示样式或图标。 */
  kind: string;
  /** 用于列表的主标题 —— 一眼能认出这是什么 */
  title: string;
  /** 副标题 / 摘要,单行,可空 */
  preview?: string;
  /** 完整文本内容(展开 / 复制用) */
  content: string;
  /** 可选的原始结构化数据,某些工具可能要点回去重看原排版 */
  data?: unknown;
  createdAt: number;
}

const KEY = 'ai-tools-launcher.favorites.v1';
const FAV_LIMIT = 500;
const TITLE_LIMIT = 120;
const PREVIEW_LIMIT = 200;
const CONTENT_LIMIT = 16000;

interface PersistedShape { entries: FavoriteEntry[]; }

function load(): FavoriteEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const data = JSON.parse(raw) as PersistedShape;
    return Array.isArray(data?.entries) ? data.entries : [];
  } catch {
    return [];
  }
}

function save(entries: FavoriteEntry[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ entries }));
  } catch {
    // 配额满了,丢一半最老的再试
    const trimmed = entries.slice(0, Math.max(10, Math.floor(entries.length / 2)));
    try { localStorage.setItem(KEY, JSON.stringify({ entries: trimmed })); } catch {}
  }
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

let listeners: Array<(e: FavoriteEntry[]) => void> = [];
let state: FavoriteEntry[] = load();

function commit(next: FavoriteEntry[]) {
  state = next;
  save(next);
  listeners.forEach((l) => l(next));
}

function clip(s: string | undefined, limit: number): string {
  if (!s) return '';
  return s.length > limit ? s.slice(0, limit) + '…' : s;
}

export interface AddFavoriteInput {
  toolId: number;
  toolName: string;
  kind: string;
  title: string;
  preview?: string;
  content: string;
  data?: unknown;
  /** 同 key 去重(避免用户连点两次收藏出现重复)。可选,留空就用 title。 */
  dedupeKey?: string;
}

export function useFavorites() {
  const [snap, setSnap] = useState<FavoriteEntry[]>(state);

  useEffect(() => {
    const l = (e: FavoriteEntry[]) => setSnap([...e]);
    listeners.push(l);
    return () => { listeners = listeners.filter((x) => x !== l); };
  }, []);

  /** 添加一条收藏。返回新条目;若与已有项重复(同 toolId + dedupeKey)则
   *  返回已存在的那条,不重复添加。 */
  const add = useCallback((input: AddFavoriteInput): FavoriteEntry => {
    const dedupe = input.dedupeKey || input.title;
    const existing = state.find((e) => e.toolId === input.toolId && (e.data && (e.data as any).__dedupe) === dedupe);
    if (existing) return existing;

    const entry: FavoriteEntry = {
      id: uid(),
      toolId: input.toolId,
      toolName: input.toolName,
      kind: input.kind,
      title: clip(input.title, TITLE_LIMIT),
      preview: input.preview ? clip(input.preview, PREVIEW_LIMIT) : undefined,
      content: clip(input.content, CONTENT_LIMIT),
      // 把 dedupe key 塞到 data 里,方便后续判重(不影响展示)
      data: input.data === undefined ? { __dedupe: dedupe } : { ...(input.data as object), __dedupe: dedupe },
      createdAt: Date.now(),
    };
    const next = [entry, ...state].slice(0, FAV_LIMIT);
    commit(next);
    return entry;
  }, []);

  /** 删除一条 */
  const remove = useCallback((id: string) => {
    commit(state.filter((e) => e.id !== id));
  }, []);

  /** 按 toolId + dedupeKey 删除(各工具的「取消收藏」用) */
  const removeByDedupe = useCallback((toolId: number, dedupeKey: string) => {
    commit(state.filter((e) => !(e.toolId === toolId && (e.data && (e.data as any).__dedupe) === dedupeKey)));
  }, []);

  /** 该 dedupeKey 是否已收藏 —— 给各工具的「收藏 / 取消」按钮判断 */
  const isFav = useCallback((toolId: number, dedupeKey: string): boolean => {
    return snap.some((e) => e.toolId === toolId && (e.data && (e.data as any).__dedupe) === dedupeKey);
  }, [snap]);

  /** 一键 toggle */
  const toggle = useCallback((input: AddFavoriteInput) => {
    const dedupe = input.dedupeKey || input.title;
    const existing = state.find((e) => e.toolId === input.toolId && (e.data && (e.data as any).__dedupe) === dedupe);
    if (existing) {
      commit(state.filter((e) => e.id !== existing.id));
      return false;
    }
    add(input);
    return true;
  }, [add]);

  const clear = useCallback(() => commit([]), []);
  const clearByTool = useCallback((toolId: number) => {
    commit(state.filter((e) => e.toolId !== toolId));
  }, []);

  /** 按工具分组,给 FavoritesPanel 的左侧分组栏用 */
  const grouped = useMemo(() => {
    const out: Record<number, FavoriteEntry[]> = {};
    for (const e of snap) (out[e.toolId] ??= []).push(e);
    return out;
  }, [snap]);

  return {
    entries: snap,
    grouped,
    add,
    remove,
    removeByDedupe,
    toggle,
    isFav,
    clear,
    clearByTool,
  };
}
