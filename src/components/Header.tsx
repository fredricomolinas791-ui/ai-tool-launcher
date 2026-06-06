import { useState, useEffect, useRef } from 'react';
import {
  Search, Sun, Moon, X, Settings, Check, Sparkles, Zap, History, Bookmark,
} from 'lucide-react';

import { useSettings } from '../hooks/useSettings';
import type { Theme, Density, Language } from '../hooks/useSettings';
import { useI18n } from '../hooks/useI18n';
import { useAI } from '../hooks/useAI';
import { ApiKeyPanel } from './Settings/ApiKeyPanel';
import { HistoryPanel } from './HistoryPanel';
import { FavoritesPanel } from './FavoritesPanel';
import { useHistory } from '../hooks/useHistory';
import { useFavorites } from '../hooks/useFavorites';
import { SettingsPanel } from './Settings/SettingsPanel';

interface HeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  theme: Theme;
  onToggleTheme: () => void;
}

export function Header({ searchQuery, onSearchChange }: HeaderProps) {
  const { settings, update } = useSettings();
  const { t, lang } = useI18n();
  const ai = useAI();
  const [searchFocused, setSearchFocused] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [apiKeyOpen, setApiKeyOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [favsOpen, setFavsOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const quickRef = useRef<HTMLDivElement>(null);
  const history = useHistory();
  const favorites = useFavorites();

  useEffect(() => {
    if (!quickOpen) return;
    const close = (e: MouseEvent) => {
      if (quickRef.current && !quickRef.current.contains(e.target as Node)) {
        setQuickOpen(false);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [quickOpen]);

  const ThemeIcon = settings.theme === 'light' ? Sun : settings.theme === 'cyber' ? Zap : Moon;

  return (
    <header
      className="h-16 px-8 flex items-center justify-between theme-transition gap-4"
      style={{
        background: 'var(--color-bg-main)',
        borderBottom: '1px solid var(--color-border)',
      }}
    >
      {/* Search — narrow, left-of-center */}
      <div className="w-64 max-w-full ml-8">
        <div
          className="relative flex items-center transition-all duration-200"
          style={{
            background: 'var(--color-bg-card)',
            border: `1px solid ${searchFocused ? 'var(--color-accent)' : 'var(--color-border)'}`,
            borderRadius: '10px',
            height: '38px',
            boxShadow: searchFocused ? '0 0 0 3px var(--color-accent-glow)' : 'none',
          }}
        >
          <Search
            size={15}
            strokeWidth={2}
            className="ml-3 shrink-0 transition-colors duration-200"
            style={{ color: searchFocused ? 'var(--color-accent)' : 'var(--color-text-muted)' }}
          />
          <input
            type="text"
            placeholder={t.searchPlaceholder}
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            className="flex-1 bg-transparent outline-none text-[13px] pl-2.5 pr-2"
            style={{ color: 'var(--color-text-primary)' }}
          />
          {searchQuery ? (
            <button
              onClick={() => onSearchChange('')}
              className="mr-1.5 w-6 h-6 rounded-md flex items-center justify-center transition-colors duration-200 hover:bg-[var(--color-border)]"
              style={{ color: 'var(--color-text-muted)' }}
            >
              <X size={13} />
            </button>
          ) : (
            <div
              className="mr-2 flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded"
              style={{
                color: 'var(--color-text-muted)',
                background: 'var(--color-border)',
              }}
            >
              <kbd style={{ fontFamily: 'inherit' }}>⌘K</kbd>
            </div>
          )}
        </div>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-2 shrink-0 ml-auto">
        {/* Quick settings popover */}
        <div className="relative" ref={quickRef}>
          <button
            aria-label={t.ariaTheme}
            onClick={() => setQuickOpen(!quickOpen)}
            className="w-9 h-9 rounded-lg flex items-center justify-center theme-transition"
            style={{
              background: quickOpen ? 'var(--color-bg-card-hover)' : 'var(--color-bg-card)',
              border: `1px solid ${quickOpen ? 'var(--color-border-light)' : 'var(--color-border)'}`,
              color: 'var(--color-text-secondary)',
            }}
          >
            <ThemeIcon size={15} strokeWidth={1.8} />
          </button>

          {quickOpen && (
            <div
              className="absolute right-0 top-11 w-80 rounded-xl overflow-hidden"
              style={{
                background: 'var(--color-bg-card)',
                border: '1px solid var(--color-border)',
                boxShadow: '0 12px 32px rgba(0, 0, 0, 0.5), 0 4px 12px rgba(0, 0, 0, 0.3)',
                zIndex: 50,
                animation: 'menuIn 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            >
              {/* Theme section — 3 family tabs × 3 sub-themes each */}
              <div className="px-3 pt-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                {lang === 'en' ? 'Theme' : '主题'}
              </div>
              <div className="px-2 pb-1.5 flex gap-1">
                {([
                  { id: 'dark'   as const, label: lang === 'en' ? 'Dark'   : '深色' },
                  { id: 'light'  as const, label: lang === 'en' ? 'Light'  : '浅色' },
                  { id: 'cyber'  as const, label: lang === 'en' ? 'Cyber'  : '赛博' },
                ]).map((fam) => {
                  const isActive = ['dark','slate','forest'].includes(settings.theme) && fam.id === 'dark'
                    || ['light','cream','pearl'].includes(settings.theme) && fam.id === 'light'
                    || ['cyber','magma','ultraviolet'].includes(settings.theme) && fam.id === 'cyber';
                  return (
                    <button
                      key={fam.id}
                      data-family={fam.id}
                      data-active={isActive}
                      onClick={() => {
                        // Switch to the first sub-theme of that family if we're
                        // not already inside it. (Avoid resetting a chosen
                        // sub-theme when the user re-clicks its family tab.)
                        const inFamily = fam.id === 'dark' ? ['dark','slate','forest'].includes(settings.theme)
                                       : fam.id === 'light' ? ['light','cream','pearl'].includes(settings.theme)
                                       : ['cyber','magma','ultraviolet'].includes(settings.theme);
                        if (!inFamily) {
                          update({ theme: fam.id === 'dark' ? 'dark' : fam.id === 'light' ? 'light' : 'cyber' });
                        }
                      }}
                      className="flex-1 h-7 text-[11px] font-medium relative overflow-hidden transition-colors"
                      style={{
                        // Family tab visual: only the text + bottom-bar change
                        // color. We deliberately DON'T paint a colored background
                        // box here — that would make this tab look identical to
                        // a sub-theme swatch card directly below.
                        background: 'transparent',
                        color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                        border: 'none',
                        borderBottom: isActive
                          ? `2px solid var(--color-accent)`
                          : '2px solid transparent',
                        // Every active family tab gets the breathing glow now —
                        // not just cyber. The glow color is theme-driven, so
                        // dark = gold, light = bronze, cyber = neon, etc.
                        boxShadow: isActive ? '0 2px 12px var(--color-accent-glow)' : 'none',
                        animation: isActive ? 'tabPulse 2s ease-in-out infinite' : undefined,
                      }}
                    >
                      {fam.label}
                      {/* Scan-line sweep on the active family tab (theme-driven color) */}
                      {isActive && (
                        <span
                          aria-hidden="true"
                          className="absolute inset-0 pointer-events-none"
                          style={{
                            background: 'linear-gradient(180deg, transparent 0%, var(--color-accent-glow) 50%, transparent 100%)',
                            animation: 'tabScan 1.8s linear infinite',
                          }}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
              <div className="px-2 pb-2 grid grid-cols-3 gap-1.5">
                {([
                  // Dark family
                  { family: 'dark'   as const, value: 'dark'   as Theme, label: lang === 'en' ? 'Champ'   : '香槟',  color: '#c9a961', bg: '#0a0a0c' },
                  { family: 'dark'   as const, value: 'slate'  as Theme, label: lang === 'en' ? 'Slate'   : '银河',  color: '#94a3b8', bg: '#0e1116' },
                  { family: 'dark'   as const, value: 'forest' as Theme, label: lang === 'en' ? 'Forest'  : '森绿',  color: '#4ade80', bg: '#0a120e' },
                  // Light family
                  { family: 'light'  as const, value: 'light'  as Theme, label: lang === 'en' ? 'Paper'   : '纸本',  color: '#8a6d2c', bg: '#fafafb' },
                  { family: 'light'  as const, value: 'cream'  as Theme, label: lang === 'en' ? 'Cream'   : '奶咖',  color: '#b8893b', bg: '#faf3e3' },
                  { family: 'light'  as const, value: 'pearl'  as Theme, label: lang === 'en' ? 'Pearl'   : '珍珠',  color: '#64748b', bg: '#f1f5f9' },
                  // Cyber family
                  { family: 'cyber'  as const, value: 'cyber'  as Theme, label: lang === 'en' ? 'Neon'    : '霓虹',  color: '#00d4ff', bg: '#050810' },
                  { family: 'cyber'  as const, value: 'magma' as Theme, label: lang === 'en' ? 'Magma'   : '熔岩',  color: '#f97316', bg: '#150a0a' },
                  { family: 'cyber'  as const, value: 'ultraviolet' as Theme, label: lang === 'en' ? 'UV'   : '紫外',  color: '#a855f7', bg: '#0a0814' },
                ]).filter((opt) => {
                  // Show only the sub-themes for the currently active family tab
                  // (default to current theme's family)
                  const cur = settings.theme;
                  const curFamily = ['dark','slate','forest'].includes(cur) ? 'dark'
                    : ['light','cream','pearl'].includes(cur) ? 'light'
                    : 'cyber';
                  return opt.family === curFamily;
                }).map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => update({ theme: opt.value })}
                    className="h-14 rounded-lg flex flex-col items-center justify-center gap-1 transition-all relative overflow-hidden"
                    style={{
                      background: opt.bg,
                      border: `1.5px solid ${settings.theme === opt.value ? 'var(--color-accent)' : 'var(--color-border)'}`,
                      boxShadow: settings.theme === opt.value ? '0 0 0 2px var(--color-accent-glow)' : 'none',
                    }}
                    title={opt.label}
                  >
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{
                        background: opt.color,
                        boxShadow: ['cyber', 'magma', 'ultraviolet'].includes(opt.value) ? `0 0 8px ${opt.color}` : 'none',
                      }}
                    />
                    <span
                      className="text-[9px] font-medium leading-none"
                      style={{ color: ['light', 'cream', 'pearl'].includes(opt.value) ? '#3a2f1a' : '#ededee' }}
                    >
                      {opt.label}
                    </span>
                  </button>
                ))}
              </div>

              <div style={{ borderTop: '1px solid var(--color-border)' }} />

              {/* Density section */}
              <div className="px-3 pt-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                {lang === 'en' ? 'Density' : '密度'}
              </div>
              <div className="px-2 pb-2 flex gap-1">
                {([
                  { value: 'compact' as Density, label: lang === 'en' ? 'Compact' : '紧凑' },
                  { value: 'normal' as Density, label: lang === 'en' ? 'Normal' : '标准' },
                  { value: 'spacious' as Density, label: lang === 'en' ? 'Spacious' : '宽松' },
                ]).map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => update({ density: opt.value })}
                    className="flex-1 h-8 rounded-md text-[11px] font-medium transition-all"
                    style={{
                      background: settings.density === opt.value ? 'var(--color-accent-glow)' : 'transparent',
                      color: settings.density === opt.value ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                      border: `1px solid ${settings.density === opt.value ? 'var(--color-accent)' : 'var(--color-border)'}`,
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <div style={{ borderTop: '1px solid var(--color-border)' }} />

              {/* Language section */}
              <div className="px-3 pt-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                {lang === 'en' ? 'Language' : '语言'}
              </div>
              <div className="px-2 pb-3 flex gap-1">
                {([
                  { value: 'zh' as Language, label: '简体中文' },
                  { value: 'en' as Language, label: 'English' },
                ]).map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => update({ language: opt.value })}
                    className="flex-1 h-8 rounded-md text-[11px] font-medium flex items-center justify-center gap-1.5 transition-all"
                    style={{
                      background: settings.language === opt.value ? 'var(--color-accent-glow)' : 'transparent',
                      color: settings.language === opt.value ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                      border: `1px solid ${settings.language === opt.value ? 'var(--color-accent)' : 'var(--color-border)'}`,
                    }}
                  >
                    {settings.language === opt.value && <Check size={11} />}
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 收藏入口 —— 与历史并列。徽标样式共用 settings.historyBadge
           设置(同时控制两个按钮),在「外观 → 徽标样式」里可切换 dot/count/off。 */}
        <button
          onClick={() => setFavsOpen(true)}
          aria-label="收藏夹"
          title={lang === 'en' ? `Favorites (${favorites.entries.length})` : `我的收藏 (${favorites.entries.length})`}
          className="h-9 w-9 rounded-lg flex items-center justify-center theme-transition relative"
          style={{
            background: 'var(--color-bg-card)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text-secondary)',
          }}
        >
          <Bookmark size={15} strokeWidth={1.8} fill={favorites.entries.length > 0 ? 'currentColor' : 'none'} />
          {favorites.entries.length > 0 && settings.historyBadge === 'dot' && (
            <span
              className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full"
              style={{ background: 'var(--color-accent)' }}
              aria-hidden="true"
            />
          )}
          {favorites.entries.length > 0 && settings.historyBadge === 'count' && (
            <span
              className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-semibold flex items-center justify-center"
              style={{ background: 'var(--color-accent)', color: '#0a0a0c' }}
            >
              {favorites.entries.length > 99 ? '99+' : favorites.entries.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setHistoryOpen(true)}
          aria-label="生成历史"
          title={lang === 'en' ? 'Generation history' : `生成历史 (${history.entries.length})`}
          className="h-9 w-9 rounded-lg flex items-center justify-center theme-transition relative"
          style={{
            background: 'var(--color-bg-card)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text-secondary)',
          }}
        >
          <History size={15} strokeWidth={1.8} />
          {history.entries.length > 0 && settings.historyBadge === 'dot' && (
            <span
              className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full"
              style={{ background: 'var(--color-accent)' }}
              aria-hidden="true"
            />
          )}
          {history.entries.length > 0 && settings.historyBadge === 'count' && (
            <span
              className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-semibold flex items-center justify-center"
              style={{ background: 'var(--color-accent)', color: '#0a0a0c' }}
            >
              {history.entries.length > 99 ? '99+' : history.entries.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setApiKeyOpen(true)}
          aria-label="AI 设置"
          title={ai.isConfigured ? `AI 已配置: ${ai.activeProvider}` : '⚠️ 点击配置 AI Key 以解锁 AI 增强功能'}
          className="h-9 px-3 rounded-lg flex items-center gap-1.5 theme-transition relative"
          style={{
            background: ai.isConfigured ? 'var(--color-accent-glow)' : 'rgba(251, 191, 36, 0.12)',
            border: `1.5px solid ${ai.isConfigured ? 'var(--color-accent)' : 'var(--color-warning)'}`,
            color: ai.isConfigured ? 'var(--color-accent)' : 'var(--color-warning)',
            animation: ai.isConfigured ? 'none' : 'pulse 2s ease-in-out infinite',
          }}
        >
          <Sparkles size={14} strokeWidth={2} />
          <span className="text-[12px] font-semibold">
            {ai.isConfigured ? `AI · ${ai.activeProvider}` : '配置 AI Key'}
          </span>
          {!ai.isConfigured && (
            <span
              className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full flex items-center justify-center text-[9px] font-bold"
              style={{ background: 'var(--color-warning)', color: '#0a0a0c' }}
            >
              !
            </span>
          )}
        </button>

        <button
          onClick={() => setSettingsOpen(true)}
          aria-label={t.ariaSettings}
          className="w-9 h-9 rounded-lg flex items-center justify-center theme-transition"
          style={{
            background: 'var(--color-bg-card)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text-secondary)',
          }}
        >
          <Settings size={15} strokeWidth={1.8} />
        </button>
      </div>

      {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}
      {apiKeyOpen && <ApiKeyPanel open={apiKeyOpen} onClose={() => setApiKeyOpen(false)} />}
      {historyOpen && <HistoryPanel open={historyOpen} onClose={() => setHistoryOpen(false)} />}
      {favsOpen && <FavoritesPanel open={favsOpen} onClose={() => setFavsOpen(false)} />}
    </header>
  );
}
