import { useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import type { Tool, Category } from '../data/tools';
import { ToolCard } from './ToolCard';
import { ToolPanel } from './ToolPanel';
import { Command, SearchX, Clock as ClockIcon, Calculator, Presentation, Network, Calendar as CalendarIcon, Wallet, MapPin, BarChart3, Heart, Construction } from 'lucide-react';
import { useI18n } from '../hooks/useI18n';
import { useAuth } from '../hooks/useAuth';

interface ActiveTool {
  id: number;
  title: string;
  icon: LucideIcon;
  Component: React.ComponentType;
}
import { LIFE_TOOLS } from './life/LifeTools';
import { TEXT_TOOLS } from './text/TextTools';
import { CODE_TOOLS } from './text/CodeTools';
import { IMAGE_TOOLS } from './media/ImageTools';
import { AUDIO_TOOLS } from './media/AudioTools';
import { VIDEO_TOOLS } from './media/VideoTools';
import { PomodoroTool } from './productivity/PomodoroTool';
import { ExcelFormulaTool } from './productivity/ExcelFormulaTool';
import { PPTOutlineTool } from './productivity/PPTOutlineTool';
import { MindMapTool } from './productivity/MindMapTool';
import { CalendarTool } from './productivity/CalendarTool';
import { BookkeepingTool } from './productivity/BookkeepingTool';
import { TripPlannerTool } from './productivity/TripPlannerTool';
import { DataAnalysisTool } from './productivity/DataAnalysisTool';

const PRODUCTIVITY_TOOLS: Record<number, { Component: React.ComponentType; icon: LucideIcon }> = {
  51: { Component: ExcelFormulaTool, icon: Calculator },
  52: { Component: PPTOutlineTool, icon: Presentation },
  53: { Component: MindMapTool, icon: Network },
  54: { Component: CalendarTool, icon: CalendarIcon },
  55: { Component: PomodoroTool, icon: ClockIcon },
  56: { Component: BookkeepingTool, icon: Wallet },
  57: { Component: TripPlannerTool, icon: MapPin },
  58: { Component: DataAnalysisTool, icon: BarChart3 },
};

const ALL_TOOLS: Record<number, { Component: React.ComponentType; icon: LucideIcon }> = {
  ...LIFE_TOOLS,
  ...TEXT_TOOLS,
  ...CODE_TOOLS,
  ...IMAGE_TOOLS,
  ...AUDIO_TOOLS,
  ...VIDEO_TOOLS,
  ...PRODUCTIVITY_TOOLS,
};

interface MainContentProps {
  category: Category;
  tools: Tool[];
  searchQuery: string;
  favoritesOnly?: boolean;
  onAuthRequest?: () => void;
}

export function MainContent({ category, tools, searchQuery, favoritesOnly = false, onAuthRequest }: MainContentProps) {
  const { t, lang } = useI18n();
  const { user, toggleFavorite } = useAuth();
  const Icon = category.icon;
  const [activeTool, setActiveTool] = useState<ActiveTool | null>(null);
  const [pendingTool, setPendingTool] = useState<{ id: number; title: string; icon: LucideIcon } | null>(null);

  const onCardClick = (toolId: number) => {
    const toolInfo = ALL_TOOLS[toolId];
    const tool = tools.find((t) => t.id === toolId);
    if (!tool) return;
    if (!toolInfo) {
      // Tool exists in the catalog but no component is wired up yet.
      // Show a "coming soon" panel so the click is acknowledged.
      setPendingTool({ id: toolId, title: tool.name[lang], icon: tool.icon });
      return;
    }
    setActiveTool({
      id: toolId,
      title: tool.name[lang],
      icon: toolInfo.icon,
      Component: toolInfo.Component,
    });
  };

  const onFavoriteClick = (toolId: number) => {
    if (!user) {
      onAuthRequest?.();
      return;
    }
    toggleFavorite(toolId);
  };

  const favorites = user?.favorites ?? [];
  const visibleTools = favoritesOnly ? tools.filter((t) => favorites.includes(t.id)) : tools;

  return (
    <main
      className="flex-1 overflow-y-auto theme-transition min-w-0"
      /* 注意:这里之前硬编码了 background: var(--color-bg-deep),会盖住
         index.css 里 `[data-background] main { background: ... }` 的规则,
         导致 设置 → 外观 → 背景纹理 改了没反应。background 现在完全交给
         CSS 接管(默认 data-background="none" 时也是 --color-bg-deep)。 */
    >
      <div className="pl-0 pr-8 lg:pr-12 py-8 lg:py-10">
        {/* Section header */}
        <div className="flex items-start justify-between mb-2.5 gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{
                background: 'var(--color-bg-card)',
                border: '1px solid var(--color-border)',
              }}
            >
              <Icon size={18} strokeWidth={1.8} style={{ color: 'var(--color-accent)' }} />
            </div>
            <div className="min-w-0 pt-0.5">
              <h1
                className="text-lg lg:text-xl font-semibold tracking-tight mb-0.5 text-balance"
                style={{ color: 'var(--color-text-primary)' }}
              >
                {category.name[lang]}
              </h1>
              <p
                className="text-xs text-pretty"
                style={{ color: 'var(--color-text-muted)' }}
              >
                {category.desc[lang]}
              </p>
            </div>
          </div>

          {searchQuery && (
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm shrink-0"
              style={{
                background: 'var(--color-bg-card)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-secondary)',
              }}
            >
              <Command size={13} strokeWidth={2.5} />
              <span>{t.searchResultsFor} "{searchQuery}"</span>
              <span
                className="ml-1 px-1.5 py-0.5 rounded text-[10px] font-medium"
                style={{
                  background: 'var(--color-accent-glow)',
                  color: 'var(--color-accent)',
                }}
              >
                {tools.length}
              </span>
            </div>
          )}
        </div>

        {/* Cards Grid */}
        {visibleTools.length > 0 ? (
          <div key={category.id} className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 lg:gap-5">
            {visibleTools.map((tool, index) => {
              const isImplemented = !!ALL_TOOLS[tool.id];
              return (
                <ToolCard
                  key={tool.id}
                  tool={tool}
                  index={index}
                  isImplemented={isImplemented}
                  isFavorited={favorites.includes(tool.id)}
                  onToggleFavorite={() => onFavoriteClick(tool.id)}
                  searchQuery={searchQuery}
                  onClick={() => onCardClick(tool.id)}
                />
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-24 px-6 rounded-2xl"
            style={{
              background: 'var(--color-bg-card)',
              border: '1px solid var(--color-border)',
            }}
          >
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5"
              style={{ background: 'var(--color-border)' }}
            >
              {favoritesOnly
                ? <Heart size={28} strokeWidth={1.5} style={{ color: 'var(--color-text-muted)' }} />
                : <SearchX size={28} strokeWidth={1.5} style={{ color: 'var(--color-text-muted)' }} />}
            </div>
            <p
              className="text-base font-medium mb-1"
              style={{ color: 'var(--color-text-primary)' }}
            >
              {favoritesOnly ? t.favoritesEmpty : t.emptyTitle}
            </p>
            <p
              className="text-sm"
              style={{ color: 'var(--color-text-muted)' }}
            >
              {favoritesOnly ? t.favoritesHint : t.emptyHint}
            </p>
          </div>
        )}
      </div>

      {activeTool && (
        <ToolPanel
          open={true}
          onClose={() => setActiveTool(null)}
          title={activeTool.title}
          subtitle={lang === 'en' ? 'Tap a tool to use it' : '点击工具开始使用'}
          icon={activeTool.icon}
        >
          <activeTool.Component />
        </ToolPanel>
      )}

      {pendingTool && (
        <ToolPanel
          open={true}
          onClose={() => setPendingTool(null)}
          title={pendingTool.title}
          subtitle={lang === 'en' ? 'Coming soon' : '即将上线'}
          icon={pendingTool.icon}
        >
          <div className="flex flex-col items-center justify-center h-full text-center px-6">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: 'var(--color-accent-glow)' }}
            >
              <Construction size={28} strokeWidth={1.5} style={{ color: 'var(--color-accent)' }} />
            </div>
            <p className="text-[15px] font-medium mb-2" style={{ color: 'var(--color-text-primary)' }}>
              {lang === 'en' ? 'This tool is not implemented yet' : '这个工具还没接入'}
            </p>
            <p className="text-[12px] max-w-md" style={{ color: 'var(--color-text-muted)' }}>
              {lang === 'en'
                ? 'The entry is in the catalog but no component is wired up. Pick another tool from the grid, or check back later.'
                : '已收录在目录里,但组件还没接。先看看其他已上线的工具,或等后续更新。'}
            </p>
          </div>
        </ToolPanel>
      )}
    </main>
  );
}
