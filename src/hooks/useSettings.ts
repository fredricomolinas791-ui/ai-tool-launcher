import { useEffect, useState, useCallback } from 'react';

export type Theme = 'dark' | 'slate' | 'forest' | 'light' | 'cream' | 'pearl' | 'cyber' | 'magma' | 'ultraviolet';
export type Density = 'compact' | 'normal' | 'spacious';
export type Language = 'zh' | 'en';

export interface Settings {
  theme: Theme;
  density: Density;
  language: Language;
  // (autoLaunch / sound removed — pure decoration, no real web-platform hook)
  notify: boolean;
  dnd: 'off' | 'night' | 'work';
  searchScope: 'global' | 'local' | 'favorites';
  defaultCategory: string;       // 启动时进入的分类(id)
  restoreLastView: boolean;      // 启动时恢复上次的工具/分类
  accent: string;
  background: 'none' | 'subtle' | 'gradient' | 'aurora';
  backgroundColor: string;
  bgGradient: { from: string; to: string; angle: number };
  /** 用户是否手动改过 backgroundColor / bgGradient。
   *  false:跟随主题推荐 —— 切主题时自动套用新主题的推荐配色。
   *  true: 用户自定义 —— 切主题时保留用户的设定不动。
   *  「一键回到主题推荐」按钮把它重置回 false。 */
  bgCustomized: boolean;
  historyBadge: 'dot' | 'count' | 'off';
  uiScale: number;
  fontScale: 'sm' | 'md' | 'lg';
  motion: 'full' | 'reduced';
  shortcuts: { search: string; toggleTheme: string; close: string };
}

/* ──────────────── 每个主题的推荐背景配色 ────────────────
 * 4 种背景模式(纯色 / 噪点 / 渐变 / 极光)共用两组数据:
 *   - color    : 纯色 / 噪点底色 / 极光底色 三者共用,改一处全联动
 *   - gradient : 渐变独立的 from / to / angle
 * 设计原则:
 *   - 深色系  → 暖黑/冷黑/暗林,渐变在底色附近 ±10% 亮度小幅度过渡
 *   - 浅色系  → 米/奶/珍,渐变从纯白滑向带色调的浅色
 *   - 赛博系  → 深饱和底色,渐变带主题色调
 *   每组渐变都不超出主题色域,避免和卡片/UI 元素抢色冲突。 */
export const THEME_BG_DEFAULTS: Record<Theme, { color: string; gradient: { from: string; to: string; angle: number } }> = {
  dark:        { color: '#0a0a0c', gradient: { from: '#1c1a14', to: '#0a0a0c', angle: 135 } }, // 香槟金调
  slate:       { color: '#0e1116', gradient: { from: '#1e2330', to: '#08090d', angle: 145 } }, // 冷蓝灰
  forest:      { color: '#0a120e', gradient: { from: '#16221a', to: '#070d09', angle: 130 } }, // 暗林绿
  light:       { color: '#fafafb', gradient: { from: '#ffffff', to: '#f0e8d8', angle: 135 } }, // 纸 → 米黄
  cream:       { color: '#faf3e3', gradient: { from: '#fffaed', to: '#f0deb5', angle: 135 } }, // 奶白 → 奶黄
  pearl:       { color: '#f1f5f9', gradient: { from: '#ffffff', to: '#cbd5e1', angle: 135 } }, // 白 → 灰蓝
  cyber:       { color: '#050810', gradient: { from: '#0a1530', to: '#020409', angle: 145 } }, // 深海蓝
  magma:       { color: '#150a0a', gradient: { from: '#2a1212', to: '#0c0606', angle: 135 } }, // 暗红
  ultraviolet: { color: '#0a0814', gradient: { from: '#1a1238', to: '#040210', angle: 145 } }, // 紫黑
};

const KEY = 'ai-tools-launcher.settings.v1';

// 默认值:主题用 dark,背景跟随主题推荐(bgCustomized = false)
const DEFAULT: Settings = {
  theme: 'dark',
  density: 'normal',
  language: 'zh',
  notify: true,
  dnd: 'off',
  searchScope: 'global',
  defaultCategory: 'hot',
  restoreLastView: false,
  accent: '#c9a961',
  background: 'none',
  backgroundColor: THEME_BG_DEFAULTS.dark.color,
  bgGradient: { ...THEME_BG_DEFAULTS.dark.gradient },
  bgCustomized: false,
  historyBadge: 'dot',
  uiScale: 1.0,
  fontScale: 'md',
  motion: 'full',
  shortcuts: { search: '⌘K', toggleTheme: '⌘ShiftT', close: 'Esc' },
};

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT;
    return { ...DEFAULT, ...JSON.parse(raw) };
  } catch {
    return DEFAULT;
  }
}

let listeners: Array<(s: Settings) => void> = [];
let state: Settings = load();

function commit(next: Settings) {
  state = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
  // Apply theme to <html>
  document.documentElement.setAttribute('data-theme', next.theme);
  // Apply density to <html> for CSS hooks
  document.documentElement.setAttribute('data-density', next.density);
  // Apply background mode to <html> for CSS hooks
  document.documentElement.setAttribute('data-background', next.background);
  // Apply motion preference
  document.documentElement.setAttribute('data-motion', next.motion);
  // Apply font scale
  document.documentElement.setAttribute('data-font', next.fontScale);
  // Apply accent as CSS var
  document.documentElement.style.setProperty('--user-accent', next.accent);
  // Apply UI scale via CSS var (used by scaling transforms)
  document.documentElement.style.setProperty('--user-ui-scale', String(next.uiScale));
  // Apply background color override
  if (next.backgroundColor) {
    document.documentElement.style.setProperty('--user-bg-color', next.backgroundColor);
  } else {
    document.documentElement.style.removeProperty('--user-bg-color');
  }
  // Apply gradient colors
  document.documentElement.style.setProperty('--user-bg-gradient-from', next.bgGradient.from);
  document.documentElement.style.setProperty('--user-bg-gradient-to', next.bgGradient.to);
  document.documentElement.style.setProperty('--user-bg-gradient-angle', `${next.bgGradient.angle}deg`);
  listeners.forEach((l) => l(next));
}

export function useSettings() {
  const [snap, setSnap] = useState<Settings>(state);
  useEffect(() => {
    // Apply on mount
    document.documentElement.setAttribute('data-theme', state.theme);
    document.documentElement.setAttribute('data-density', state.density);
    document.documentElement.setAttribute('data-background', state.background);
    document.documentElement.setAttribute('data-motion', state.motion);
    document.documentElement.setAttribute('data-font', state.fontScale);
    document.documentElement.style.setProperty('--user-accent', state.accent);
    document.documentElement.style.setProperty('--user-ui-scale', String(state.uiScale));
    if (state.backgroundColor) {
      document.documentElement.style.setProperty('--user-bg-color', state.backgroundColor);
    }
    document.documentElement.style.setProperty('--user-bg-gradient-from', state.bgGradient.from);
    document.documentElement.style.setProperty('--user-bg-gradient-to', state.bgGradient.to);
    document.documentElement.style.setProperty('--user-bg-gradient-angle', `${state.bgGradient.angle}deg`);
    const l = (s: Settings) => setSnap({ ...s });
    listeners.push(l);
    return () => {
      listeners = listeners.filter((x) => x !== l);
    };
  }, []);
  const update = useCallback((patch: Partial<Settings>) => {
    let next: Settings = { ...state, ...patch };

    // ① 用户主动改 backgroundColor 或 bgGradient → 标记为已自定义,
    //    切主题时不再自动覆盖。除非 patch 显式传 bgCustomized = false
    //    (一键回到推荐时会这么做)。
    const touchedBg =
      Object.prototype.hasOwnProperty.call(patch, 'backgroundColor') ||
      Object.prototype.hasOwnProperty.call(patch, 'bgGradient');
    if (touchedBg && !Object.prototype.hasOwnProperty.call(patch, 'bgCustomized')) {
      next = { ...next, bgCustomized: true };
    }

    // ② 切主题 + 未自定义 → 自动应用新主题的推荐背景配色。
    //    这是「在用户切换不同主题风格时,自动生成合适的默认背景色」的核心。
    if (
      Object.prototype.hasOwnProperty.call(patch, 'theme') &&
      patch.theme !== state.theme &&
      !next.bgCustomized
    ) {
      const reco = THEME_BG_DEFAULTS[next.theme];
      next = {
        ...next,
        backgroundColor: reco.color,
        bgGradient: { ...reco.gradient },
      };
    }

    commit(next);
  }, []);

  /** 一键把背景恢复到当前主题的推荐配色,并取消「已自定义」标记。
   *  下次再切主题就会重新自动套用新主题的推荐。 */
  const resetBackgroundToTheme = useCallback(() => {
    const reco = THEME_BG_DEFAULTS[state.theme];
    commit({
      ...state,
      backgroundColor: reco.color,
      bgGradient: { ...reco.gradient },
      bgCustomized: false,
    });
  }, []);

  const reset = useCallback(() => {
    commit(DEFAULT);
  }, []);
  return { settings: snap, update, reset, resetBackgroundToTheme };
}
