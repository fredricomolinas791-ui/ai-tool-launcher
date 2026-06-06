import { useState, useEffect, useMemo, useRef } from 'react';
import { Settings, User, Palette, Bell, Info, X, Check, Trash2, Download, Sparkles, ChevronRight, RotateCcw, Eye, Undo2, Sun, Moon, Zap, Heart } from 'lucide-react';
import { useSettings } from '../../hooks/useSettings';
import type { Theme, Density, Language, Settings as SettingsType } from '../../hooks/useSettings';
import { useI18n } from '../../hooks/useI18n';
import { BackupPanel } from './BackupPanel';

type SettingsTab = 'general' | 'appearance' | 'notifications' | 'about';

export function SettingsPanel({ onClose }: { onClose: () => void }) {
  const { settings, update, reset, resetBackgroundToTheme } = useSettings();
  const { lang } = useI18n();
  const [tab, setTab] = useState<SettingsTab>('general');
  const [toast, setToast] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  // Snapshot the settings the panel was opened with. Lets us offer a real
  // "discard" — every edit applies live so the user sees it, but we can
  // revert to this baseline if they don't want to keep the changes.
  const snapshotRef = useRef<SettingsType | null>(null);
  if (snapshotRef.current === null) snapshotRef.current = { ...settings };

  // `dirty` = anything in current settings differs from the snapshot.
  // Cheap shallow compare on the keys we expose in the panel (no nested
  // objects except bgGradient, which we deep-compare).
  const dirty = useMemo(() => {
    const s = snapshotRef.current;
    if (!s) return false;
    const keys = Object.keys(s) as Array<keyof SettingsType>;
    return keys.some((k) => {
      if (k === 'bgGradient') {
        return s.bgGradient.from !== settings.bgGradient.from
          || s.bgGradient.to !== settings.bgGradient.to
          || s.bgGradient.angle !== settings.bgGradient.angle;
      }
      if (k === 'shortcuts') return false; // not editable here
      return s[k] !== settings[k];
    });
  }, [settings]);

  const discard = () => {
    if (snapshotRef.current) {
      update(snapshotRef.current);
      showToast(t('已恢复到打开时的设置', 'Reverted to opening state'));
    }
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 1800);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const t = (zh: string, en: string) => (settings.language === 'en' ? en : zh);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0, 0, 0, 0.55)', backdropFilter: 'blur(4px)', animation: 'backdropIn 0.2s ease' }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[780px] max-w-[92vw] h-[560px] max-h-[88vh] rounded-2xl overflow-hidden flex"
        style={{
          background: 'var(--color-bg-main)',
          border: '1px solid var(--color-border)',
          boxShadow: '0 24px 80px rgba(0, 0, 0, 0.55), 0 8px 24px rgba(0, 0, 0, 0.35)',
          animation: 'settingsIn 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Sidebar */}
        <aside
          className="w-56 shrink-0 flex flex-col py-5"
          style={{ background: 'var(--color-bg-sidebar)', borderRight: '1px solid var(--color-border)' }}
        >
          <div className="px-5 mb-5 flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'var(--color-border)' }}
            >
              <Settings size={15} strokeWidth={1.8} style={{ color: 'var(--color-accent)' }} />
            </div>
            <span className="text-[15px] font-semibold" style={{ color: 'var(--color-text-primary)' }}>
              {t('设置', 'Settings')}
            </span>
          </div>
          <nav className="flex-1 px-3 space-y-0.5">
            <SideItem icon={User} label={t('通用', 'General')} active={tab === 'general'} onClick={() => setTab('general')} />
            <SideItem icon={Palette} label={t('外观', 'Appearance')} active={tab === 'appearance'} onClick={() => setTab('appearance')} />
            <SideItem icon={Bell} label={t('通知', 'Notifications')} active={tab === 'notifications'} onClick={() => setTab('notifications')} />
            <SideItem icon={Info} label={t('关于', 'About')} active={tab === 'about'} onClick={() => setTab('about')} />
          </nav>

          <div className="px-5 pt-4" style={{ borderTop: '1px solid var(--color-border)' }}>
            <div className="flex items-center gap-2.5 px-1 py-2">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style={{
                  background: 'linear-gradient(135deg, var(--color-accent) 0%, var(--color-accent-soft) 100%)',
                }}
              >
                <span className="text-white text-xs font-semibold">U</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>
                  User
                </p>
                <p className="text-[10px] truncate" style={{ color: 'var(--color-text-muted)' }}>
                  {t('Pro 会员', 'Pro Member')}
                </p>
              </div>
            </div>
          </div>
        </aside>

        {/* Content */}
        <section className="flex-1 flex flex-col min-w-0">
          <div
            className="h-14 px-6 flex items-center justify-between shrink-0"
            style={{ borderBottom: '1px solid var(--color-border)' }}
          >
            <div>
              <h2 className="text-[15px] font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                {tab === 'general' && t('通用', 'General')}
                {tab === 'appearance' && t('外观', 'Appearance')}
                {tab === 'notifications' && t('通知', 'Notifications')}
                {tab === 'about' && t('关于', 'About')}
              </h2>
              <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                {tab === 'general' && t('语言、启动行为与基本偏好', 'Language, launch behavior and basics')}
                {tab === 'appearance' && t('主题、密度与视觉风格', 'Theme, density and visual style')}
                {tab === 'notifications' && t('消息推送与提醒方式', 'Messages and reminders')}
                {tab === 'about' && t('应用信息与版本', 'App info & version')}
              </p>
            </div>
            <button
              onClick={onClose}
              aria-label="关闭"
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
              style={{ color: 'var(--color-text-muted)' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--color-bg-card)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            >
              <X size={16} strokeWidth={1.8} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-5">
            {tab === 'general' && (
              <div className="space-y-5">
                <Field label={t('界面语言', 'Language')} hint={t('选择应用显示语言', 'App display language')}>
                  <Segmented<Language>
                    value={settings.language}
                    onChange={(v) => { update({ language: v }); showToast(t('语言已切换', 'Language updated')); }}
                    options={[
                      { value: 'zh', label: '简体中文' },
                      { value: 'en', label: 'English' },
                    ]}
                  />
                </Field>

                <Field label={t('默认分类', 'Default category')} hint={t('打开应用时进入的分类', 'Category shown when the app opens')}>
                  <Select
                    value={settings.defaultCategory}
                    options={[
                      { value: 'hot',         label: lang === 'en' ? 'Hot Tools'    : '热门工具' },
                      { value: 'text',        label: lang === 'en' ? 'Text'         : '文本工具' },
                      { value: 'image',       label: lang === 'en' ? 'Image'        : '图像工具' },
                      { value: 'audio',       label: lang === 'en' ? 'Audio'        : '音频工具' },
                      { value: 'video',       label: lang === 'en' ? 'Video'        : '视频工具' },
                      { value: 'code',        label: lang === 'en' ? 'Code'         : '编程工具' },
                      { value: 'productivity',label: lang === 'en' ? 'Productivity' : '办公效率' },
                      { value: 'life',        label: lang === 'en' ? 'The Quirky Curio Shop' : '趣味铺子' },
                    ]}
                    onChange={(v) => { update({ defaultCategory: v }); showToast(t('已更新', 'Updated')); }}
                  />
                </Field>

                <Field label={t('恢复上次视图', 'Restore last view')} hint={t('刷新或重开时自动回到上次的工具', 'Reopen the last tool on reload')}>
                  <Toggle checked={settings.restoreLastView} onChange={(v) => { update({ restoreLastView: v }); showToast(v ? t('已开启', 'On') : t('已关闭', 'Off')); }} />
                </Field>

                <Field label={t('搜索范围', 'Search scope')} hint={t('顶部搜索栏使用的范围', 'Scope used by the search bar')}>
                  <Select
                    value={settings.searchScope}
                    options={[
                      { value: 'global',    label: t('全局搜索 — 跨分类', 'Global — across categories') },
                      { value: 'local',     label: t('仅本地工具', 'Local tools only') },
                      { value: 'favorites', label: t('仅收藏的工具', 'Favorites only') },
                    ]}
                    onChange={(v) => { update({ searchScope: v as 'global' | 'local' | 'favorites' }); showToast(t('已更新', 'Updated')); }}
                  />
                </Field>

                {/* Shortcuts — promoted to a dedicated styled block instead of
                    being crammed into a Field. Clearer at a glance, fits more
                    rows comfortably without breaking the alignment of fields
                    above. */}
                <div
                  className="rounded-xl p-4"
                  style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                      {t('键盘快捷方式', 'Keyboard shortcuts')}
                    </span>
                    <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
                      {t('只读', 'Read-only')}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <KbdRow label={t('打开/聚焦搜索', 'Open search')}      keys={['⌘', 'K']} />
                    <KbdRow label={t('循环切换主题', 'Cycle theme')}        keys={['⌘', 'Shift', 'T']} />
                    <KbdRow label={t('关闭弹窗', 'Close dialog')}           keys={['Esc']} />
                    <KbdRow label={t('侧边栏上一项', 'Sidebar previous')}   keys={['↑']} />
                    <KbdRow label={t('侧边栏下一项', 'Sidebar next')}       keys={['↓']} />
                    <KbdRow label={t('跳到第一项', 'Jump to first')}        keys={['Home']} />
                    <KbdRow label={t('跳到最后一项', 'Jump to last')}        keys={['End']} />
                  </div>
                </div>
              </div>
            )}

            {tab === 'appearance' && (
              <div className="space-y-5">
                {/* ─── Live Preview — a small "app mockup" so the user sees
                       theme + density + font + motion + history badge all
                       together, instead of the previous tiny text specimen. */}
                <LivePreview lang={lang} t={t} settings={settings} />

                <Field label={t('主题', 'Theme')} hint={t('切换应用外观风格', 'Switch app appearance')}>
                  <div className="flex flex-col gap-2">
                    {/* 3 family tabs — active one breathes + scans, theme-driven color */}
                    <div className="flex gap-1">
                      {([
                        { id: 'dark'   as const, label: t('深色', 'Dark'),  icon: Moon },
                        { id: 'light'  as const, label: t('浅色', 'Light'), icon: Sun  },
                        { id: 'cyber'  as const, label: t('赛博', 'Cyber'), icon: Zap  },
                      ]).map((fam) => {
                        const inFamily = fam.id === 'dark' ? ['dark','slate','forest'].includes(settings.theme)
                                       : fam.id === 'light' ? ['light','cream','pearl'].includes(settings.theme)
                                       : ['cyber','magma','ultraviolet'].includes(settings.theme);
                        const Icon = fam.icon;
                        return (
                          <button
                            key={fam.id}
                            onClick={() => {
                              if (!inFamily) {
                                update({ theme: fam.id === 'dark' ? 'dark' : fam.id === 'light' ? 'light' : 'cyber' });
                              }
                            }}
                            className="flex-1 h-9 rounded-md text-[12px] font-medium relative overflow-hidden transition-colors flex items-center justify-center gap-1.5"
                            style={{
                              background: inFamily ? 'var(--color-accent-glow)' : 'transparent',
                              color: inFamily ? 'var(--color-accent)' : 'var(--color-text-muted)',
                              border: `1px solid ${inFamily ? 'var(--color-accent)' : 'var(--color-border)'}`,
                              boxShadow: inFamily ? '0 2px 12px var(--color-accent-glow)' : 'none',
                              animation: inFamily ? 'tabPulse 2s ease-in-out infinite' : undefined,
                            }}
                          >
                            <Icon size={12} strokeWidth={2} />
                            {fam.label}
                            {inFamily && (
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
                    {/* Sub-themes for the current family */}
                    <div className="flex gap-2">
                      {(() => {
                        const cur = settings.theme;
                        const curFamily = ['dark','slate','forest'].includes(cur) ? 'dark'
                          : ['light','cream','pearl'].includes(cur) ? 'light'
                          : 'cyber';
                        if (curFamily === 'dark') return [
                          <ThemeSwatch key="dark"   label={t('深色·香槟', 'Champ')}  value="dark"   current={settings.theme} preview="#0a0a0c / #c9a961" onClick={() => update({ theme: 'dark' })} />,
                          <ThemeSwatch key="slate"  label={t('深色·银河', 'Slate')}  value="slate"  current={settings.theme} preview="#0e1116 / #94a3b8" onClick={() => update({ theme: 'slate' })} />,
                          <ThemeSwatch key="forest" label={t('深色·森绿', 'Forest')} value="forest" current={settings.theme} preview="#0a120e / #4ade80" onClick={() => update({ theme: 'forest' })} />,
                        ];
                        if (curFamily === 'light') return [
                          <ThemeSwatch key="light" label={t('浅色·纸本', 'Paper')} value="light" current={settings.theme} preview="#fafafb / #8a6d2c" onClick={() => update({ theme: 'light' })} />,
                          <ThemeSwatch key="cream" label={t('浅色·奶咖', 'Cream')} value="cream" current={settings.theme} preview="#faf3e3 / #b8893b" onClick={() => update({ theme: 'cream' })} />,
                          <ThemeSwatch key="pearl" label={t('浅色·珍珠', 'Pearl')} value="pearl" current={settings.theme} preview="#f1f5f9 / #64748b" onClick={() => update({ theme: 'pearl' })} />,
                        ];
                        return [
                          <ThemeSwatch key="cyber"        label={t('霓虹', 'Neon')}  value="cyber"        current={settings.theme} preview="#050810 / #00d4ff" glow onClick={() => update({ theme: 'cyber' })} />,
                          <ThemeSwatch key="magma"        label={t('熔岩', 'Magma')} value="magma"        current={settings.theme} preview="#150a0a / #f97316" glow onClick={() => update({ theme: 'magma' })} />,
                          <ThemeSwatch key="ultraviolet"  label={t('紫外', 'UV')}    value="ultraviolet"  current={settings.theme} preview="#0a0814 / #a855f7" glow onClick={() => update({ theme: 'ultraviolet' })} />,
                        ];
                      })()}
                    </div>
                  </div>
                </Field>

                {/* Density — visual swatches (3 stacked bars with widening gap) */}
                <Field label={t('卡片密度', 'Card density')} hint={t('控制列表项的紧凑程度', 'How compact the list looks')}>
                  <div className="flex gap-1.5">
                    {([
                      { value: 'compact'  as Density, label: t('紧凑', 'Compact'),  gap: 2 },
                      { value: 'normal'   as Density, label: t('标准', 'Normal'),   gap: 5 },
                      { value: 'spacious' as Density, label: t('宽松', 'Spacious'), gap: 9 },
                    ]).map((opt) => {
                      const active = settings.density === opt.value;
                      return (
                        <button
                          key={opt.value}
                          onClick={() => { update({ density: opt.value }); showToast(t('已更新', 'Updated')); }}
                          className="w-[78px] rounded-lg overflow-hidden flex flex-col items-center gap-1 py-2 transition-all"
                          style={{
                            background: active ? 'var(--color-accent-glow)' : 'var(--color-bg-card)',
                            border: `1.5px solid ${active ? 'var(--color-accent)' : 'var(--color-border)'}`,
                          }}
                        >
                          <div className="flex flex-col items-center" style={{ gap: opt.gap }}>
                            {[0,1,2].map(i => (
                              <div key={i} className="w-10 h-1.5 rounded-sm" style={{ background: active ? 'var(--color-accent)' : 'var(--color-border-light)' }} />
                            ))}
                          </div>
                          <span className="text-[11px] font-medium mt-1" style={{ color: active ? 'var(--color-accent)' : 'var(--color-text-secondary)' }}>
                            {opt.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </Field>

                {/* Font scale — show actual text at each size */}
                <Field label={t('字号', 'Font size')} hint={t('整体文字大小', 'Overall text size')}>
                  <div className="flex gap-1.5">
                    {([
                      { value: 'sm' as const, label: t('小', 'S'), px: 12 },
                      { value: 'md' as const, label: t('中', 'M'), px: 14 },
                      { value: 'lg' as const, label: t('大', 'L'), px: 16 },
                    ]).map((opt) => {
                      const active = settings.fontScale === opt.value;
                      return (
                        <button
                          key={opt.value}
                          onClick={() => { update({ fontScale: opt.value }); showToast(t('已更新', 'Updated')); }}
                          className="w-[58px] h-[58px] rounded-lg flex flex-col items-center justify-center gap-0.5 transition-all"
                          style={{
                            background: active ? 'var(--color-accent-glow)' : 'var(--color-bg-card)',
                            border: `1.5px solid ${active ? 'var(--color-accent)' : 'var(--color-border)'}`,
                          }}
                        >
                          <span style={{ fontSize: `${opt.px}px`, color: active ? 'var(--color-accent)' : 'var(--color-text-primary)', fontWeight: 600, lineHeight: 1 }}>Aa</span>
                          <span className="text-[10px]" style={{ color: active ? 'var(--color-accent)' : 'var(--color-text-muted)' }}>{opt.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </Field>

                {/* UI scale — slider with inline % badge + quick presets */}
                <Field label={t('界面缩放', 'UI scale')} hint={t('整体界面放大或缩小', 'Zoom the entire UI')}>
                  <div className="flex items-center gap-3 w-[280px]">
                    <input
                      type="range" min={0.85} max={1.15} step={0.05}
                      value={settings.uiScale}
                      onChange={(e) => update({ uiScale: Number(e.target.value) })}
                      className="flex-1"
                      style={{ accentColor: 'var(--color-accent)' }}
                    />
                    <span
                      className="text-[11px] font-mono font-semibold tabular-nums w-10 text-right"
                      style={{ color: 'var(--color-accent)' }}
                    >
                      {Math.round(settings.uiScale * 100)}%
                    </span>
                  </div>
                  <div className="flex gap-1 mt-2 justify-end">
                    {[0.9, 1.0, 1.1].map((s) => (
                      <button
                        key={s}
                        onClick={() => { update({ uiScale: s }); showToast(t('已更新', 'Updated')); }}
                        className="h-6 px-2 rounded text-[10px] font-mono transition-colors"
                        style={{
                          background: settings.uiScale === s ? 'var(--color-accent-glow)' : 'var(--color-bg-card)',
                          color: settings.uiScale === s ? 'var(--color-accent)' : 'var(--color-text-muted)',
                          border: `1px solid ${settings.uiScale === s ? 'var(--color-accent)' : 'var(--color-border)'}`,
                        }}
                      >
                        {Math.round(s * 100)}%
                      </button>
                    ))}
                  </div>
                </Field>

                {/* Motion — show a tiny live demo of what each setting does */}
                <Field label={t('动效', 'Motion')} hint={t('减弱动画可减少视觉疲劳', 'Reduce motion to ease visual fatigue')}>
                  <div className="flex gap-1.5">
                    {([
                      { value: 'full'    as const, label: t('完整', 'Full'),    desc: t('完整动画', 'Animated') },
                      { value: 'reduced' as const, label: t('减弱', 'Reduced'), desc: t('几乎静止', 'Static') },
                    ]).map((opt) => {
                      const active = settings.motion === opt.value;
                      return (
                        <button
                          key={opt.value}
                          onClick={() => { update({ motion: opt.value }); showToast(t('已更新', 'Updated')); }}
                          className="w-[110px] py-2 rounded-lg flex flex-col items-center gap-1 transition-all"
                          style={{
                            background: active ? 'var(--color-accent-glow)' : 'var(--color-bg-card)',
                            border: `1.5px solid ${active ? 'var(--color-accent)' : 'var(--color-border)'}`,
                          }}
                        >
                          <span
                            className="w-3 h-3 rounded-full"
                            style={{
                              background: 'var(--color-accent)',
                              animation: opt.value === 'full' ? 'pulse 1.6s ease-in-out infinite' : undefined,
                            }}
                          />
                          <span className="text-[11px] font-medium" style={{ color: active ? 'var(--color-accent)' : 'var(--color-text-secondary)' }}>
                            {opt.label}
                          </span>
                          <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>{opt.desc}</span>
                        </button>
                      );
                    })}
                  </div>
                </Field>

                {/* History badge — show actual dot / "12" / empty next to each label */}
                <Field label={t('徽标样式(历史/收藏)', 'Badge style (History & Favorites)')} hint={t('顶部 History 和 Favorites 两个按钮的未读提示样式', 'Style of the unread badge on both the History and Favorites header buttons')}>
                  <div className="flex gap-1.5">
                    {([
                      { value: 'dot'   as const, label: t('小圆点', 'Dot') },
                      { value: 'count' as const, label: t('数字', 'Count') },
                      { value: 'off'   as const, label: t('不显示', 'Off') },
                    ]).map((opt) => {
                      const active = settings.historyBadge === opt.value;
                      return (
                        <button
                          key={opt.value}
                          onClick={() => { update({ historyBadge: opt.value }); showToast(t('已更新', 'Updated')); }}
                          className="w-[78px] py-2.5 rounded-lg flex flex-col items-center gap-1.5 transition-all relative"
                          style={{
                            background: active ? 'var(--color-accent-glow)' : 'var(--color-bg-card)',
                            border: `1.5px solid ${active ? 'var(--color-accent)' : 'var(--color-border)'}`,
                          }}
                        >
                          <div className="relative w-7 h-7 rounded-md flex items-center justify-center" style={{ background: 'var(--color-bg-main)', border: '1px solid var(--color-border)' }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--color-text-secondary)' }}>
                              <path d="M3 12a9 9 0 1 0 9-9" /><path d="M12 7v5l3 3" />
                            </svg>
                            {opt.value === 'dot' && (
                              <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full" style={{ background: 'var(--color-accent)' }} />
                            )}
                            {opt.value === 'count' && (
                              <span className="absolute -top-1 -right-1 min-w-[14px] h-3.5 px-1 rounded-full text-[8px] font-bold flex items-center justify-center" style={{ background: 'var(--color-accent)', color: '#0a0a0c' }}>
                                12
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] font-medium" style={{ color: active ? 'var(--color-accent)' : 'var(--color-text-secondary)' }}>
                            {opt.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </Field>

                {/* Background — visual thumbnails showing what each option looks like.
                    缩略图直接渲染当前 settings 里的实际配色,所见即所得。 */}
                <Field label={t('背景纹理', 'Background')} hint={t('主区背景的视觉风格', 'Main area background')}>
                  <div className="grid grid-cols-4 gap-1.5">
                    {([
                      { value: 'none'     as const, label: t('纯色', 'Solid'),    preview: 'solid' },
                      { value: 'subtle'   as const, label: t('噪点', 'Grain'),    preview: 'grain' },
                      { value: 'gradient' as const, label: t('渐变', 'Gradient'), preview: 'gradient' },
                      { value: 'aurora'   as const, label: t('极光', 'Aurora'),   preview: 'aurora' },
                    ]).map((opt) => {
                      const active = settings.background === opt.value;
                      // 用实际 settings 值预览,而不是写死 var(--color-bg-deep) ——
                      // 这样用户改色或切主题时缩略图也跟着变,真实反映效果。
                      const solidBg = settings.backgroundColor || 'var(--color-bg-deep)';
                      const previewBg =
                        opt.preview === 'solid'    ? solidBg :
                        opt.preview === 'grain'    ? solidBg :
                        opt.preview === 'gradient' ? `linear-gradient(${settings.bgGradient.angle}deg, ${settings.bgGradient.from} 0%, ${settings.bgGradient.to} 100%)` :
                        /* aurora */              `radial-gradient(ellipse 80% 60% at 20% 0%, var(--color-accent-glow) 0%, transparent 60%), radial-gradient(ellipse 60% 50% at 80% 100%, var(--color-glow-b) 0%, transparent 60%), ${solidBg}`;
                      return (
                        <button
                          key={opt.value}
                          onClick={() => { update({ background: opt.value }); showToast(t('已更新', 'Updated')); }}
                          className="rounded-lg overflow-hidden flex flex-col transition-all"
                          style={{
                            border: `1.5px solid ${active ? 'var(--color-accent)' : 'var(--color-border)'}`,
                            boxShadow: active ? '0 0 0 2px var(--color-accent-glow)' : 'none',
                          }}
                        >
                          <div
                            className="h-12 relative"
                            style={{ background: previewBg }}
                          >
                            {opt.preview === 'grain' && (
                              /* 用和首页 main 一样的 --fx-noise + blend-mode,
                                 保证缩略图的颗粒感和真实背景完全一致。 */
                              <div
                                className="absolute inset-0"
                                style={{
                                  backgroundImage: 'var(--fx-noise)',
                                  backgroundRepeat: 'repeat',
                                  mixBlendMode: ['light','cream','pearl'].includes(settings.theme) ? 'multiply' : 'overlay',
                                }}
                              />
                            )}
                          </div>
                          <div className="h-6 flex items-center justify-center text-[10px] font-medium" style={{ background: 'var(--color-bg-card)', color: active ? 'var(--color-accent)' : 'var(--color-text-secondary)' }}>
                            {opt.label}{active && <Check size={9} className="ml-0.5" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </Field>

                {/* 配色来源状态 + 一键回到主题推荐 ——
                    切主题时 useSettings 会自动套用对应主题的推荐配色(只要
                    bgCustomized 为 false);用户一旦改了 backgroundColor 或
                    bgGradient,这个标记就会变 true,后续切主题不再自动覆盖。
                    这里给用户一个清晰的「我现在用的是推荐还是自定义」反馈,
                    并提供一键回退入口。 */}
                <div
                  className="flex items-center justify-between rounded-lg px-3 py-2"
                  style={{
                    background: settings.bgCustomized ? 'var(--color-bg-card)' : 'var(--color-accent-glow)',
                    border: `1px solid ${settings.bgCustomized ? 'var(--color-border)' : 'var(--color-accent)'}`,
                  }}
                >
                  <div className="flex items-center gap-2 text-[11px]">
                    <Palette size={12} style={{ color: settings.bgCustomized ? 'var(--color-text-muted)' : 'var(--color-accent)' }} />
                    {settings.bgCustomized ? (
                      <span style={{ color: 'var(--color-text-secondary)' }}>
                        {t('配色来源:自定义', 'Source: custom')}
                        <span className="ml-1" style={{ color: 'var(--color-text-muted)' }}>
                          {t('切主题时不再自动覆盖', 'will not auto-switch with theme')}
                        </span>
                      </span>
                    ) : (
                      <span style={{ color: 'var(--color-accent)', fontWeight: 500 }}>
                        {t(`配色来源:${settings.theme} 主题推荐`, `Source: ${settings.theme} theme recommendation`)}
                        <span className="ml-1 font-normal" style={{ color: 'var(--color-text-muted)' }}>
                          {t('切主题会跟着变', 'auto-switches with theme')}
                        </span>
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => { resetBackgroundToTheme(); showToast(t('已恢复主题推荐', 'Restored to theme recommendation')); }}
                    disabled={!settings.bgCustomized}
                    className="h-7 px-2.5 rounded text-[11px] font-medium flex items-center gap-1 transition-all"
                    style={{
                      background: settings.bgCustomized ? 'var(--color-bg-main)' : 'transparent',
                      color: settings.bgCustomized ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                      border: `1px solid ${settings.bgCustomized ? 'var(--color-border-light)' : 'var(--color-border)'}`,
                      cursor: settings.bgCustomized ? 'pointer' : 'default',
                      opacity: settings.bgCustomized ? 1 : 0.5,
                    }}
                    title={t('把背景颜色和渐变全部恢复到当前主题的推荐值', 'Restore background color & gradient to the current theme recommendation')}
                  >
                    <RotateCcw size={10} />
                    {t('一键回到主题推荐', 'Use theme defaults')}
                  </button>
                </div>

                {/* Solid-color picker with preset palette */}
                {settings.background === 'none' && (
                  <Field label={t('背景颜色', 'Background color')} hint={t('留空 = 用主题默认', 'Empty = theme default')}>
                    <div className="flex flex-col gap-2 items-end">
                      <div className="flex items-center gap-2.5">
                        <input
                          type="color"
                          value={settings.backgroundColor || '#0a0a0c'}
                          onChange={(e) => { update({ backgroundColor: e.target.value }); showToast(t('已应用', 'Applied')); }}
                          className="w-8 h-8 rounded cursor-pointer"
                          style={{ background: settings.backgroundColor || 'transparent', border: '1px solid var(--color-border)' }}
                        />
                        <span className="text-[12px] font-mono" style={{ color: 'var(--color-text-secondary)' }}>
                          {settings.backgroundColor || t('使用主题默认', 'theme default')}
                        </span>
                        {settings.backgroundColor && (
                          <button
                            onClick={() => { update({ backgroundColor: '' }); showToast(t('已恢复', 'Restored')); }}
                            className="h-7 px-2 rounded text-[11px] flex items-center gap-1"
                            style={{ background: 'var(--color-bg-card)', color: 'var(--color-text-muted)' }}
                          >
                            <RotateCcw size={11} /> {t('默认', 'Default')}
                          </button>
                        )}
                      </div>
                      <div className="flex gap-1">
                        {['#0a0a0c', '#13161d', '#0a120e', '#150a0a', '#0a0814', '#f7f7f8', '#faf3e3', '#f1f5f9'].map((c) => (
                          <button
                            key={c}
                            onClick={() => { update({ backgroundColor: c }); showToast(t('已应用', 'Applied')); }}
                            className="w-5 h-5 rounded transition-all"
                            style={{
                              background: c,
                              border: settings.backgroundColor === c ? '2px solid var(--color-accent)' : '1px solid var(--color-border)',
                              boxShadow: settings.backgroundColor === c ? '0 0 0 1px var(--color-accent-glow)' : 'none',
                            }}
                            title={c}
                          />
                        ))}
                      </div>
                    </div>
                  </Field>
                )}

                {settings.background === 'gradient' && (
                  <>
                    <Field label={t('渐变颜色', 'Gradient colors')} hint={t('起点与终点颜色', 'Start and end color')}>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={settings.bgGradient.from}
                          onChange={(e) => update({ bgGradient: { ...settings.bgGradient, from: e.target.value } })}
                          className="w-8 h-8 rounded cursor-pointer"
                          style={{ border: '1px solid var(--color-border)' }}
                          title={t('起点', 'Start')}
                        />
                        <span className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>→</span>
                        <input
                          type="color"
                          value={settings.bgGradient.to}
                          onChange={(e) => update({ bgGradient: { ...settings.bgGradient, to: e.target.value } })}
                          className="w-8 h-8 rounded cursor-pointer"
                          style={{ border: '1px solid var(--color-border)' }}
                          title={t('终点', 'End')}
                        />
                      </div>
                    </Field>
                    <Field label={t('渐变角度', 'Gradient angle')} hint={`${settings.bgGradient.angle}°`}>
                      <div className="flex items-center gap-3 w-[280px]">
                        <input
                          type="range" min={0} max={360} step={5}
                          value={settings.bgGradient.angle}
                          onChange={(e) => update({ bgGradient: { ...settings.bgGradient, angle: Number(e.target.value) } })}
                          className="flex-1"
                          style={{ accentColor: 'var(--color-accent)' }}
                        />
                        <span className="text-[11px] font-mono font-semibold tabular-nums w-10 text-right" style={{ color: 'var(--color-accent)' }}>
                          {settings.bgGradient.angle}°
                        </span>
                      </div>
                    </Field>
                    <div
                      className="h-16 rounded-lg"
                      style={{
                        background: `linear-gradient(${settings.bgGradient.angle}deg, ${settings.bgGradient.from} 0%, ${settings.bgGradient.to} 100%)`,
                        border: '1px solid var(--color-border)',
                      }}
                    />
                  </>
                )}
              </div>
            )}

            {tab === 'notifications' && (
              <div className="space-y-5">
                {/* Permission status banner — surface browser support / permission
                    state up top so toggling the switch makes sense in context. */}
                {(() => {
                  const supported = typeof Notification !== 'undefined';
                  const perm = supported ? Notification.permission : 'unsupported';
                  const meta =
                    perm === 'granted'  ? { color: 'var(--color-success)', bg: 'rgba(52,211,153,0.12)', label: t('浏览器已授权', 'Browser authorized') } :
                    perm === 'denied'   ? { color: 'var(--color-warning)', bg: 'rgba(251,191,36,0.12)', label: t('浏览器已拒绝 — 请在站点设置中放开', 'Browser denied — enable in site settings') } :
                    perm === 'default'  ? { color: 'var(--color-text-secondary)', bg: 'var(--color-bg-card)', label: t('尚未询问权限', 'Permission not yet requested') } :
                                          { color: 'var(--color-text-muted)',    bg: 'var(--color-bg-card)', label: t('当前浏览器不支持通知 API', 'Notification API unsupported here') };
                  return (
                    <div
                      className="rounded-lg px-3 py-2 flex items-center gap-2 text-[12px]"
                      style={{ background: meta.bg, border: '1px solid var(--color-border)', color: meta.color }}
                    >
                      <Bell size={13} strokeWidth={2} />
                      <span>{meta.label}</span>
                    </div>
                  );
                })()}

                <Field
                  label={t('启用通知', 'Enable notifications')}
                  hint={t('允许应用在后台向你推送消息', 'Allow the app to push messages in the background')}
                >
                  <div className="flex items-center gap-2">
                    <Toggle
                      checked={settings.notify}
                      onChange={async (v) => {
                        if (v && typeof Notification !== 'undefined' && Notification.permission === 'default') {
                          const perm = await Notification.requestPermission();
                          if (perm !== 'granted') {
                            showToast(t('浏览器拒绝了通知权限', 'Browser denied notification permission'));
                            return;
                          }
                        }
                        update({ notify: v });
                        showToast(v ? t('通知已开启', 'On') : t('通知已关闭', 'Off'));
                      }}
                    />
                    {settings.notify && typeof Notification !== 'undefined' && Notification.permission === 'granted' && (
                      <button
                        onClick={() => {
                          new Notification(t('AI Tools Launcher', 'AI Tools Launcher'), {
                            body: t('这是一条测试通知 — 看见就说明配好了', 'This is a test notification — if you see it, you are good'),
                            icon: '/favicon.svg',
                          });
                        }}
                        className="h-7 px-2.5 rounded text-[11px] font-medium flex items-center gap-1"
                        style={{ background: 'var(--color-bg-card)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)' }}
                      >
                        <Bell size={11} strokeWidth={2} />
                        {t('测试通知', 'Test')}
                      </button>
                    )}
                  </div>
                </Field>

                {/* DND visual swatch — three time blocks shown as a small bar so the
                    user can see at a glance which hours are quiet. */}
                <Field label={t('免打扰', 'Do not disturb')} hint={t('这段时间内静默所有通知', 'Mute notifications during this time')}>
                  <div className="flex gap-1.5">
                    {([
                      { value: 'off'   as const, label: t('关闭', 'Off'),       quiet: [] as number[] },
                      { value: 'night' as const, label: t('夜间', 'Night'),     quiet: Array.from({length: 10}, (_, i) => (i + 22) % 24) },
                      { value: 'work'  as const, label: t('工作时间外', 'Off-hours'), quiet: [0,1,2,3,4,5,6,7,18,19,20,21,22,23] },
                    ]).map((opt) => {
                      const active = settings.dnd === opt.value;
                      return (
                        <button
                          key={opt.value}
                          onClick={() => { update({ dnd: opt.value }); showToast(t('已更新', 'Updated')); }}
                          className="flex-1 py-2.5 px-2 rounded-lg flex flex-col items-center gap-1.5 transition-all"
                          style={{
                            background: active ? 'var(--color-accent-glow)' : 'var(--color-bg-card)',
                            border: `1.5px solid ${active ? 'var(--color-accent)' : 'var(--color-border)'}`,
                          }}
                          title={
                            opt.value === 'night' ? '22:00 - 08:00' :
                            opt.value === 'work'  ? t('工作时间之外(08-18)静默', 'Quiet outside 08-18') :
                                                    t('始终接收通知', 'Always receive')
                          }
                        >
                          {/* 24-hour bar — quiet hours filled with accent, awake hours dim */}
                          <div className="flex w-full h-2 rounded-sm overflow-hidden">
                            {Array.from({length: 24}, (_, h) => (
                              <span
                                key={h}
                                className="flex-1"
                                style={{
                                  background: opt.quiet.includes(h)
                                    ? (active ? 'var(--color-accent)' : 'var(--color-border-light)')
                                    : 'transparent',
                                }}
                              />
                            ))}
                          </div>
                          <span className="text-[11px] font-medium" style={{ color: active ? 'var(--color-accent)' : 'var(--color-text-secondary)' }}>
                            {opt.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </Field>

                {/* Footnote explaining what counts as a notification — saves users from
                    poking at the toggle expecting something it doesn't do. */}
                <p className="text-[11px] leading-relaxed px-1" style={{ color: 'var(--color-text-muted)' }}>
                  {t(
                    '当前会触发通知的事件:番茄钟阶段切换、长任务完成、AI 生成结束。后续会逐步接入更多事件。',
                    'Events that trigger a notification today: pomodoro phase change, long task done, AI generation finished. More to come.'
                  )}
                </p>
              </div>
            )}

            {tab === 'about' && (
              <div className="space-y-5">
                {/* Hero — app icon + version */}
                <div
                  className="rounded-xl p-5 flex items-center gap-4"
                  style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
                >
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
                    style={{
                      background: 'linear-gradient(135deg, var(--color-accent) 0%, var(--color-accent-soft) 100%)',
                      boxShadow: '0 4px 14px var(--color-accent-glow)',
                    }}
                  >
                    <Sparkles size={22} strokeWidth={2} style={{ color: '#fff' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                      AI Tools Launcher
                    </p>
                    <p className="text-[12px]" style={{ color: 'var(--color-text-muted)' }}>
                      {t('版本', 'Version')} 1.0.0 · Build 2026.06
                    </p>
                  </div>
                  <span
                    className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded"
                    style={{ background: 'var(--color-accent-glow)', color: 'var(--color-accent)' }}
                  >
                    Stable
                  </span>
                </div>

                {/* Meta rows */}
                <div className="rounded-xl overflow-hidden" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
                  <AboutRow label={t('开发者', 'Developer')}     value="MiniMax Studio" />
                  <AboutRow label={t('许可协议', 'License')}      value="MIT License" />
                  <AboutRow label={t('当前主题', 'Active theme')} value={settings.theme} />
                  <AboutRow label={t('当前语言', 'Active language')} value={settings.language === 'zh' ? '简体中文' : 'English'} />
                  <AboutRow label={t('运行环境', 'Runtime')}      value={typeof navigator !== 'undefined' ? navigator.platform : '—'} last />
                </div>

                {/* Backup (LocalStorage import/export) */}
                <BackupPanel />

                {/* Danger zone — sits in its own bordered block so it can't be
                    confused with the routine "Export config" button next to it. */}
                <div
                  className="rounded-xl p-4"
                  style={{ background: 'rgba(255, 100, 100, 0.04)', border: '1px solid var(--color-warning)' }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-warning)' }}>
                      {t('危险操作', 'Danger zone')}
                    </span>
                  </div>
                  <p className="text-[11px] mb-3" style={{ color: 'var(--color-text-muted)' }}>
                    {t(
                      '重置会清除所有外观、通用、通知设置,回到首次安装时的状态。已保存的工具历史和 API Key 不受影响。',
                      'Reset clears all appearance / general / notification settings to first-install state. Tool history and API keys are kept.'
                    )}
                  </p>
                  <div className="flex items-center gap-2">
                    <ActionButton
                      icon={Download}
                      label={t('导出当前配置', 'Export current config')}
                      onClick={() => {
                        const blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url; a.download = 'ai-tools-launcher.settings.json'; a.click();
                        URL.revokeObjectURL(url);
                        showToast(t('已导出', 'Exported'));
                      }}
                    />
                    <ActionButton
                      icon={confirming ? Check : Trash2}
                      label={confirming ? t('再次确认 — 这会清空所有设置', 'Tap again to confirm reset') : t('重置全部设置', 'Reset all settings')}
                      danger
                      onClick={() => {
                        if (!confirming) { setConfirming(true); setTimeout(() => setConfirming(false), 3000); return; }
                        reset();
                        setConfirming(false);
                        showToast(t('已恢复默认', 'Restored defaults'));
                      }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 底栏 — 撤销修改 / 应用 / 关闭。
              所有字段都是即时生效(用户能直接看到效果),我们在打开时拍了
              一张快照,可以让用户回滚。
              - 撤销修改:回到打开面板时的状态(dirty 时启用)
              - 应用:把当前状态作为新的快照,不关闭,继续可预览
              - 关闭:关闭面板(已应用的更改保留) */}
          <div
            className="h-14 px-6 flex items-center justify-between gap-2 shrink-0"
            style={{ borderTop: '1px solid var(--color-border)' }}
          >
            <span className="text-[11px] flex items-center gap-1.5" style={{ color: 'var(--color-text-muted)' }}>
              {dirty ? (
                <>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--color-warning)' }} />
                  {t('未保存的修改 — 实时预览中', 'Unsaved changes — previewing live')}
                </>
              ) : (
                <>
                  <Check size={11} style={{ color: 'var(--color-success)' }} />
                  {t('所有更改已自动保存', 'All changes auto-saved')}
                </>
              )}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={discard}
                disabled={!dirty}
                className="h-9 px-3 rounded-lg text-[12px] font-medium flex items-center gap-1.5 transition-all"
                style={{
                  background: 'transparent',
                  color: dirty ? 'var(--color-text-secondary)' : 'var(--color-text-muted)',
                  border: '1px solid var(--color-border)',
                  cursor: dirty ? 'pointer' : 'not-allowed',
                  opacity: dirty ? 1 : 0.5,
                }}
                title={t('撤回所有在本次打开期间做的修改', 'Revert every change made since opening')}
                onMouseEnter={(e) => { if (dirty) (e.currentTarget as HTMLElement).style.background = 'var(--color-bg-card)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              >
                <Undo2 size={13} />
                {t('撤销修改', 'Discard')}
              </button>
              <button
                onClick={() => {
                  // 把当前状态作为新的快照基线,这样「撤销修改」不会再撤回它。
                  // 不关闭面板 —— 用户希望继续看预览。
                  snapshotRef.current = { ...settings };
                  showToast(t('已应用 — 面板保持打开', 'Applied — panel stays open'));
                }}
                disabled={!dirty}
                className="h-9 px-4 rounded-lg text-[12px] font-semibold flex items-center gap-1.5 transition-all"
                style={{
                  background: dirty ? 'var(--color-accent)' : 'var(--color-bg-card)',
                  color: dirty
                    ? (settings.theme === 'light' || settings.theme === 'cream' || settings.theme === 'pearl' ? '#fff' : '#0a0a0c')
                    : 'var(--color-text-muted)',
                  boxShadow: dirty ? '0 2px 8px var(--color-accent-glow)' : 'none',
                  cursor: dirty ? 'pointer' : 'not-allowed',
                  opacity: dirty ? 1 : 0.5,
                  border: dirty ? 'none' : '1px solid var(--color-border)',
                }}
                title={t('把当前预览状态固化为新基线,继续可预览', 'Lock in the current preview as the new baseline — keeps the panel open')}
                onMouseEnter={(e) => { if (dirty) (e.currentTarget as HTMLElement).style.background = 'var(--color-accent-soft)'; }}
                onMouseLeave={(e) => { if (dirty) (e.currentTarget as HTMLElement).style.background = 'var(--color-accent)'; }}
              >
                <Check size={13} strokeWidth={2.5} />
                {t('应用', 'Apply')}
              </button>
              <button
                onClick={onClose}
                className="h-9 px-3 rounded-lg text-[12px] font-medium transition-colors"
                style={{ color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--color-bg-card)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              >
                {t('关闭', 'Close')}
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 rounded-xl text-[13px] flex items-center gap-2 z-[60]"
          style={{
            background: 'var(--color-bg-card)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text-primary)',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
            animation: 'backdropIn 0.18s ease',
          }}
        >
          <Check size={14} style={{ color: 'var(--color-success)' }} />
          {toast}
        </div>
      )}
    </div>
  );
}

/* ───────────────── Sub-components (only used here) ───────────────── */

function SideItem({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full h-9 px-3 rounded-lg flex items-center gap-2.5 text-[13px] font-medium transition-colors"
      style={{
        background: active ? 'var(--color-bg-card)' : 'transparent',
        color: active ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
      }}
      onMouseEnter={(e) => {
        if (!active) (e.currentTarget as HTMLElement).style.background = 'var(--color-bg-card)';
      }}
      onMouseLeave={(e) => {
        if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent';
      }}
    >
      <Icon size={15} strokeWidth={1.8} />
      <span>{label}</span>
    </button>
  );
}

function Field({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-6">
      <div className="min-w-0 pt-1.5">
        <p className="text-[13px] font-medium" style={{ color: 'var(--color-text-primary)' }}>
          {label}
        </p>
        <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
          {hint}
        </p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className="relative w-10 h-6 rounded-full transition-colors duration-200"
      style={{ background: checked ? 'var(--color-accent)' : 'var(--color-border)' }}
    >
      <span
        className="absolute top-0.5 w-5 h-5 rounded-full transition-all duration-200"
        style={{
          left: checked ? '18px' : '2px',
          background: '#fff',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.3)',
        }}
      />
    </button>
  );
}

function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div
      className="flex p-0.5 rounded-lg"
      style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className="h-7 px-3 rounded-md text-[12px] font-medium transition-all"
            style={{
              background: active ? 'var(--color-border-light)' : 'transparent',
              color: active ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function Select({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="h-8 px-3 rounded-lg text-[12px] flex items-center gap-2 transition-colors min-w-[180px] justify-between"
        style={{
          background: 'var(--color-bg-card)',
          border: '1px solid var(--color-border)',
          color: 'var(--color-text-primary)',
        }}
      >
        <span>{current?.label}</span>
        <ChevronRight size={13} className={`transition-transform ${open ? '-rotate-90' : 'rotate-90'}`} style={{ color: 'var(--color-text-muted)' }} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="absolute right-0 top-9 min-w-full w-max rounded-lg overflow-hidden z-50"
            style={{
              background: 'var(--color-bg-card)',
              border: '1px solid var(--color-border)',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
            }}
          >
            {options.map((opt) => {
              const active = opt.value === value;
              return (
                <button
                  key={opt.value}
                  onClick={() => { onChange(opt.value); setOpen(false); }}
                  className="w-full px-3 h-8 flex items-center text-[12px] transition-colors whitespace-nowrap"
                  style={{
                    color: active ? 'var(--color-accent)' : 'var(--color-text-primary)',
                    background: active ? 'var(--color-bg-card-hover)' : 'transparent',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--color-bg-card-hover)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = active ? 'var(--color-bg-card-hover)' : 'transparent'; }}
                >
                  {opt.label}
                  {active && <Check size={12} className="ml-auto" />}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function KbdRow({ label, keys }: { label: string; keys: string[] }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-[12px]" style={{ color: 'var(--color-text-secondary)' }}>
        {label}
      </span>
      <div className="flex items-center gap-1">
        {keys.map((k, i) => (
          <kbd
            key={i}
            className="h-6 min-w-6 px-1.5 rounded text-[11px] font-medium flex items-center justify-center"
            style={{
              background: 'var(--color-bg-card)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text-secondary)',
              boxShadow: '0 1px 0 var(--color-border)',
            }}
          >
            {k}
          </kbd>
        ))}
      </div>
    </div>
  );
}

function ThemeSwatch({
  label, value, current, preview, glow, onClick,
}: {
  label: string;
  value: Theme;
  current: Theme;
  preview: string;
  glow?: boolean;
  onClick: () => void;
}) {
  const active = value === current;
  return (
    <button
      onClick={onClick}
      className="relative w-[88px] rounded-xl overflow-hidden flex flex-col"
      style={{
        background: 'var(--color-bg-card)',
        border: `1.5px solid ${active ? 'var(--color-accent)' : 'var(--color-border)'}`,
        boxShadow: active ? `0 0 0 3px var(--color-accent-glow)` : 'none',
        height: '72px',
      }}
    >
      <div
        className="flex-1 flex items-center justify-center"
        style={{
          background: preview.split(' / ')[0],
          position: 'relative',
        }}
      >
        <div
          className="w-5 h-5 rounded-full"
          style={{
            background: preview.split(' / ')[1],
            boxShadow: glow ? `0 0 12px ${preview.split(' / ')[1]}` : 'none',
          }}
        />
        {glow && (
          <div
            className="absolute inset-0"
            style={{
              background: 'repeating-linear-gradient(0deg, transparent 0, transparent 3px, rgba(0,212,255,0.08) 3px, rgba(0,212,255,0.08) 4px)',
              pointerEvents: 'none',
            }}
          />
        )}
      </div>
      <div
        className="h-7 flex items-center justify-center text-[11px] font-medium"
        style={{
          color: active ? 'var(--color-accent)' : 'var(--color-text-secondary)',
          background: 'var(--color-bg-card)',
        }}
      >
        {label}
        {active && <Check size={11} className="ml-1" />}
      </div>
    </button>
  );
}

function AboutRow({ label, value, link, onClick, last }: { label: string; value: string; link?: boolean; onClick?: () => void; last?: boolean }) {
  return (
    <div
      className="flex items-center justify-between px-4 py-2.5"
      style={{ borderBottom: last ? 'none' : '1px solid var(--color-border)' }}
    >
      <span className="text-[13px]" style={{ color: 'var(--color-text-secondary)' }}>
        {label}
      </span>
      <button
        onClick={onClick}
        className="text-[13px] transition-colors truncate max-w-[260px] text-right"
        style={{ color: link ? 'var(--color-accent)' : 'var(--color-text-primary)', cursor: link ? 'pointer' : 'default' }}
      >
        {value}
      </button>
    </div>
  );
}

function ActionButton({
  icon: Icon, label, danger, onClick,
}: {
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  label: string;
  danger?: boolean;
  onClick: () => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="h-9 px-3 rounded-lg text-[12px] font-medium flex items-center gap-1.5 transition-colors"
      style={{
        background: hover ? (danger ? 'rgba(255, 100, 100, 0.12)' : 'var(--color-bg-card)') : 'var(--color-bg-card)',
        border: `1px solid ${danger ? 'var(--color-warning)' : 'var(--color-border)'}`,
        color: danger ? 'var(--color-warning)' : 'var(--color-text-primary)',
      }}
    >
      <Icon size={13} strokeWidth={1.8} />
      {label}
    </button>
  );
}

/* ───────────────── LivePreview ─────────────────
   显示在「外观」标签顶部的实时预览。
   之前塞了一个 mini-app(header+侧边栏+卡片网格),空间太小被压成乱码。
   现在只展示「一张真实尺寸的卡片」——可以悬停、可以收藏,
   字号/密度/主题/动效/收藏徽标改动时它当场可见。
   背景纹理在卡片外面的画布上演示。 */
function LivePreview({
  lang, t, settings,
}: {
  lang: 'zh' | 'en';
  t: (zh: string, en: string) => string;
  settings: SettingsType;
}) {
  const [hover, setHover] = useState(false);
  const [favorited, setFavorited] = useState(false);

  // 密度直接映射到真实卡片的最小高度,和首页保持一致
  const cardH = settings.density === 'compact' ? 170 : settings.density === 'spacious' ? 230 : 200;
  const showDesc = settings.density !== 'compact';
  // 字号也按全局设置,所见即所得
  const titlePx = settings.fontScale === 'sm' ? 12 : settings.fontScale === 'lg' ? 15 : 13;
  const bodyPx  = settings.fontScale === 'sm' ? 10 : settings.fontScale === 'lg' ? 12 : 11;
  const tinyPx  = settings.fontScale === 'sm' ?  9 : settings.fontScale === 'lg' ? 11 : 10;
  const animated = settings.motion === 'full';

  // 背景纹理在预览画布上还原首页 main 区的视觉
  const isLightTheme = ['light','cream','pearl'].includes(settings.theme);
  const solidBg = settings.backgroundColor || 'var(--color-bg-deep)';
  // subtle 用 backgroundImage+backgroundBlendMode 单独表达(blend-mode 不能写在
  // background shorthand 里),所以这里返回一个 style 对象而不是一个 background
  // 字符串。其它三种模式仍然可以用 shorthand。
  const canvasStyle: React.CSSProperties =
    settings.background === 'subtle'
      ? {
          backgroundImage: 'var(--fx-noise)',
          backgroundRepeat: 'repeat',
          backgroundColor: solidBg,
          backgroundBlendMode: isLightTheme ? 'multiply' : 'overlay',
        }
      : settings.background === 'gradient'
      ? { background: `linear-gradient(${settings.bgGradient.angle}deg, ${settings.bgGradient.from} 0%, ${settings.bgGradient.to} 100%)` }
      : settings.background === 'aurora'
      ? { background: `radial-gradient(ellipse 80% 60% at 20% 0%, var(--color-accent-glow) 0%, transparent 60%), radial-gradient(ellipse 60% 50% at 80% 100%, var(--color-glow-b) 0%, transparent 60%), ${solidBg}` }
      : { background: solidBg };

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
      {/* 顶条:标题 + 当前状态汇总 */}
      <div
        className="px-3 py-2 flex items-center justify-between"
        style={{ background: 'var(--color-bg-sidebar)', borderBottom: '1px solid var(--color-border)' }}
      >
        <span className="text-[10px] font-semibold uppercase tracking-wider flex items-center gap-1.5" style={{ color: 'var(--color-text-muted)' }}>
          <Eye size={10} />
          {t('实时预览', 'Live preview')}
          <span style={{ color: 'var(--color-accent)' }}>· {t('可悬停可收藏', 'hover / favorite me')}</span>
        </span>
        <span className="text-[9px] flex items-center gap-1.5" style={{ color: 'var(--color-text-muted)' }}>
          <span className="px-1 py-0.5 rounded" style={{ background: 'var(--color-bg-card)', color: 'var(--color-text-secondary)' }}>{settings.theme}</span>
          <span className="px-1 py-0.5 rounded" style={{ background: 'var(--color-bg-card)', color: 'var(--color-text-secondary)' }}>{settings.density}</span>
          <span className="px-1 py-0.5 rounded" style={{ background: 'var(--color-bg-card)', color: 'var(--color-text-secondary)' }}>{settings.fontScale}</span>
        </span>
      </div>

      {/* 画布:展示背景纹理 + 居中一张「真」卡片 */}
      <div
        className="flex items-center justify-center px-6 py-5"
        style={{ ...canvasStyle, minHeight: cardH + 40 }}
      >
        <button
          type="button"
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
          className="relative rounded-2xl overflow-hidden flex flex-col items-center text-center px-5 transition-all"
          style={{
            width: 220,
            minHeight: cardH,
            padding: settings.density === 'compact' ? 14 : settings.density === 'spacious' ? 24 : 18,
            background: hover ? 'var(--color-bg-card-hover)' : 'var(--color-bg-card)',
            border: `1px solid ${hover ? 'var(--color-border-light)' : 'var(--color-border)'}`,
            boxShadow: hover ? 'var(--shadow-card-hover)' : 'var(--shadow-card)',
            transform: hover ? 'translateY(-2px)' : 'translateY(0)',
            animation: animated && !hover ? 'pulse 3s ease-in-out infinite' : undefined,
          }}
        >
          {/* 收藏按钮(真实尺寸) */}
          <span
            role="button"
            onClick={(e) => { e.stopPropagation(); setFavorited(!favorited); }}
            className="absolute top-2 right-2 w-9 h-9 rounded-lg flex items-center justify-center transition-all cursor-pointer"
            style={{
              color: favorited ? 'var(--color-accent)' : 'var(--color-text-muted)',
              background: favorited ? 'var(--color-accent-glow)' : 'transparent',
              opacity: favorited ? 1 : 0.55,
            }}
          >
            <Heart size={18} strokeWidth={2} fill={favorited ? 'currentColor' : 'none'} />
          </span>

          {/* 状态行 */}
          <div className="flex items-center justify-center gap-1.5 mb-5" style={{ marginTop: 4 }}>
            <span
              className="flex items-center gap-1 px-1.5 py-0.5 rounded-full font-medium"
              style={{ fontSize: tinyPx, background: 'rgba(52, 211, 153, 0.12)', color: 'var(--color-success)' }}
            >
              <Check size={tinyPx - 1} strokeWidth={3} />
              {lang === 'en' ? 'Ready' : '可用'}
            </span>
            <span className="font-semibold tracking-wider" style={{ fontSize: tinyPx, color: 'var(--color-accent)' }}>· HOT</span>
          </div>

          {/* 图标(沿用首页的 .card-icon 视觉) */}
          <div
            className="rounded-2xl flex items-center justify-center mb-4"
            style={{
              width: settings.density === 'compact' ? 48 : settings.density === 'spacious' ? 68 : 60,
              height: settings.density === 'compact' ? 48 : settings.density === 'spacious' ? 68 : 60,
              background: hover
                ? 'linear-gradient(135deg, var(--color-accent-glow) 0%, var(--color-bg-card) 100%)'
                : 'var(--color-bg-card)',
              border: `1px solid ${hover ? 'var(--color-accent)' : 'var(--color-border)'}`,
              boxShadow: hover
                ? 'inset 0 1px 0 rgba(255,255,255,0.05), 0 0 0 1px var(--color-accent-glow), 0 0 32px var(--color-accent-glow)'
                : 'inset 0 1px 0 rgba(255,255,255,0.03)',
              transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
              transform: hover ? 'scale(1.06)' : 'scale(1)',
            }}
          >
            <Sparkles
              size={settings.density === 'compact' ? 22 : settings.density === 'spacious' ? 32 : 28}
              strokeWidth={1.6}
              style={{ color: 'var(--color-accent)' }}
            />
          </div>

          {/* 标题 + 描述,字号跟随设置 */}
          <h3 className="font-medium leading-snug mb-1" style={{ fontSize: titlePx, color: 'var(--color-text-secondary)' }}>
            {lang === 'en' ? 'Example Tool' : '示例工具'}
          </h3>
          {showDesc && (
            <p className="leading-relaxed line-clamp-2 px-1 mb-3" style={{ fontSize: bodyPx, color: 'var(--color-text-muted)' }}>
              {lang === 'en'
                ? 'Change anything below and this card updates instantly.'
                : '改下面任何一项,这张卡片当场跟着变。'}
            </p>
          )}

          {/* 标签行(紧凑模式下隐藏,匹配真实卡片行为) */}
          {showDesc && (
            <div className="flex items-center justify-center gap-1 mt-auto">
              <span
                className="px-1.5 py-0.5 rounded"
                style={{ fontSize: tinyPx, color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }}
              >
                {lang === 'en' ? 'demo' : '示例'}
              </span>
              <span
                className="px-1.5 py-0.5 rounded"
                style={{ fontSize: tinyPx, color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }}
              >
                {lang === 'en' ? 'preview' : '预览'}
              </span>
            </div>
          )}
        </button>
      </div>
    </div>
  );
}
