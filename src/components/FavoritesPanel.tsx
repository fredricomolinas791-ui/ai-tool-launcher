import { useState, useEffect, useMemo, useRef } from 'react';
import { X, Bookmark, Trash2, Search, Copy, Check, ChevronDown } from 'lucide-react';
import { useFavorites, type FavoriteEntry } from '../hooks/useFavorites';
import { useI18n } from '../hooks/useI18n';

/**
 * FavoritesPanel — 全局收藏面板。
 *
 * 设计上比 HistoryPanel 更轻量:
 *   - 收藏是用户精挑细选的精品(数量少、有意义),所以条目可以做得更大、
 *     更易读,而不是 HistoryPanel 那种密集列表
 *   - 默认按工具分组(用户找东西时第一反应是「我在哪个工具里收藏的」)
 *   - 每条都能展开看 `content` 全文 + 复制
 *
 * 与 useHistory 的区别
 * --------------------
 *   - History 是自动记录,需要复杂的"per-entry export"和"copy thinking"
 *   - Favorites 是用户主动收藏,只需要"看 + 复制 + 删"三件事
 */
export function FavoritesPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { lang } = useI18n();
  const { entries, grouped, remove, clear, clearByTool } = useFavorites();
  const [query, setQuery] = useState('');
  const [filterTool, setFilterTool] = useState<number | null>(null);
  const [confirmingClear, setConfirmingClear] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Esc to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 100); }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries
      .filter((e) => filterTool === null || e.toolId === filterTool)
      .filter((e) => !q || e.title.toLowerCase().includes(q) || (e.preview || '').toLowerCase().includes(q) || e.content.toLowerCase().includes(q) || e.toolName.toLowerCase().includes(q));
  }, [entries, query, filterTool]);

  // 工具分组,按收藏量倒序;给左侧筛选条
  const tools = useMemo(() => {
    return Object.entries(grouped)
      .map(([id, list]) => ({ toolId: Number(id), count: list.length, name: list[0].toolName }))
      .sort((a, b) => b.count - a.count);
  }, [grouped]);

  const copy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {}
  };

  const t = (zh: string, en: string) => (lang === 'en' ? en : zh);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-end"
      style={{ background: 'rgba(0, 0, 0, 0.55)', backdropFilter: 'blur(4px)', animation: 'backdropIn 0.2s ease' }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[640px] max-w-[92vw] h-full flex flex-col"
        style={{
          background: 'var(--color-bg-main)',
          borderLeft: '1px solid var(--color-border)',
          boxShadow: '-24px 0 80px rgba(0, 0, 0, 0.55)',
          animation: 'slideInRight 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Header */}
        <div className="h-14 px-5 flex items-center justify-between shrink-0" style={{ borderBottom: '1px solid var(--color-border)' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--color-accent-glow)' }}>
              <Bookmark size={15} strokeWidth={2} style={{ color: 'var(--color-accent)' }} />
            </div>
            <div>
              <h2 className="text-[15px] font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                {t('我的收藏', 'Favorites')}
              </h2>
              <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                {entries.length === 0 ? t('还没有收藏', 'None yet')
                  : t(`共 ${entries.length} 条 · 来自 ${tools.length} 个工具`, `${entries.length} items · ${tools.length} tools`)}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
            style={{ color: 'var(--color-text-muted)' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--color-bg-card)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
          >
            <X size={16} />
          </button>
        </div>

        {/* 搜索 + 工具过滤 chips */}
        {entries.length > 0 && (
          <div className="px-5 py-3 shrink-0 space-y-2.5" style={{ borderBottom: '1px solid var(--color-border)' }}>
            <div className="relative flex items-center" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', borderRadius: 8 }}>
              <Search size={13} className="ml-2.5" style={{ color: 'var(--color-text-muted)' }} />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('搜索标题 / 内容 / 工具…', 'Search title / content / tool…')}
                className="flex-1 bg-transparent outline-none text-[12px] pl-2 pr-2 h-9"
                style={{ color: 'var(--color-text-primary)' }}
              />
              {query && (
                <button onClick={() => setQuery('')} className="mr-1.5 w-6 h-6 rounded flex items-center justify-center" style={{ color: 'var(--color-text-muted)' }}>
                  <X size={12} />
                </button>
              )}
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <FilterChip
                active={filterTool === null}
                onClick={() => setFilterTool(null)}
                label={t('全部', 'All')}
                count={entries.length}
              />
              {tools.map((tt) => (
                <FilterChip
                  key={tt.toolId}
                  active={filterTool === tt.toolId}
                  onClick={() => setFilterTool(tt.toolId)}
                  label={tt.name}
                  count={tt.count}
                />
              ))}
            </div>
          </div>
        )}

        {/* 列表 */}
        <div className="flex-1 overflow-y-auto p-4">
          {filtered.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center px-8">
              <div className="w-20 h-20 rounded-3xl flex items-center justify-center mb-4" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
                <Bookmark size={32} strokeWidth={1.5} style={{ color: 'var(--color-text-muted)' }} />
              </div>
              {entries.length === 0 ? (
                <>
                  <p className="text-[14px] font-medium mb-1" style={{ color: 'var(--color-text-primary)' }}>{t('收藏夹空空如也', 'Nothing here yet')}</p>
                  <p className="text-[12px] leading-relaxed max-w-[300px]" style={{ color: 'var(--color-text-muted)' }}>
                    {t('在任何工具里看到喜欢的结果,点书签按钮就会出现在这里。一处收藏,处处可见。', 'Hit the bookmark icon on anything you like — it lands here. One library across every tool.')}
                  </p>
                </>
              ) : (
                <p className="text-[13px]" style={{ color: 'var(--color-text-muted)' }}>{t('没有匹配的收藏', 'No matches')}</p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((e) => (
                <FavoriteCard
                  key={e.id}
                  entry={e}
                  expanded={expandedId === e.id}
                  copied={copiedId === e.id}
                  onToggle={() => setExpandedId(expandedId === e.id ? null : e.id)}
                  onCopy={() => copy(e.content, e.id)}
                  onRemove={() => remove(e.id)}
                  t={t}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {entries.length > 0 && (
          <div className="h-12 px-5 flex items-center justify-between shrink-0" style={{ borderTop: '1px solid var(--color-border)' }}>
            <span className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
              {filtered.length === entries.length
                ? t(`${entries.length} 条`, `${entries.length} items`)
                : t(`筛出 ${filtered.length} / ${entries.length} 条`, `${filtered.length} of ${entries.length}`)}
            </span>
            <div className="flex items-center gap-2">
              {filterTool !== null && (
                <button
                  onClick={() => { clearByTool(filterTool); setFilterTool(null); }}
                  className="h-7 px-2.5 rounded text-[11px] font-medium flex items-center gap-1"
                  style={{ background: 'transparent', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }}
                  title={t('清空当前工具的收藏', 'Clear this tool\'s favorites')}
                >
                  <Trash2 size={10} /> {t('清空此工具', 'Clear this tool')}
                </button>
              )}
              <button
                onClick={() => {
                  if (!confirmingClear) { setConfirmingClear(true); setTimeout(() => setConfirmingClear(false), 3000); return; }
                  clear(); setConfirmingClear(false); setFilterTool(null); setExpandedId(null);
                }}
                className="h-7 px-2.5 rounded text-[11px] font-medium flex items-center gap-1"
                style={{ background: confirmingClear ? 'rgba(239,68,68,0.12)' : 'transparent', color: 'var(--color-warning)', border: `1px solid ${confirmingClear ? 'var(--color-warning)' : 'var(--color-border)'}` }}
              >
                <Trash2 size={10} /> {confirmingClear ? t('再次点击确认', 'Tap again') : t('全部清空', 'Clear all')}
              </button>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(20px); opacity: 0; }
          to   { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

function FavoriteCard({
  entry, expanded, copied, onToggle, onCopy, onRemove, t,
}: {
  entry: FavoriteEntry;
  expanded: boolean;
  copied: boolean;
  onToggle: () => void;
  onCopy: () => void;
  onRemove: () => void;
  t: (zh: string, en: string) => string;
}) {
  return (
    <div className="rounded-xl overflow-hidden transition-all" style={{ background: 'var(--color-bg-card)', border: `1px solid ${expanded ? 'var(--color-accent)' : 'var(--color-border)'}` }}>
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-start gap-3 text-left transition-colors"
        style={{ background: 'transparent' }}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: 'var(--color-accent-glow)', color: 'var(--color-accent)' }}>
              {entry.toolName}
            </span>
            {entry.kind && entry.kind !== 'default' && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'var(--color-bg-main)', color: 'var(--color-text-muted)' }}>
                {entry.kind}
              </span>
            )}
            <span className="text-[10px] ml-auto" style={{ color: 'var(--color-text-muted)' }}>
              {formatTime(entry.createdAt, t)}
            </span>
          </div>
          <h3 className="text-[14px] font-semibold mb-1 leading-snug" style={{ color: 'var(--color-text-primary)' }}>{entry.title}</h3>
          {entry.preview && (
            <p className={`text-[12px] leading-relaxed ${expanded ? '' : 'line-clamp-2'}`} style={{ color: 'var(--color-text-secondary)' }}>
              {entry.preview}
            </p>
          )}
        </div>
        <ChevronDown size={14} style={{ color: 'var(--color-text-muted)', transform: expanded ? 'rotate(180deg)' : undefined, transition: 'transform 0.2s' }} />
      </button>

      {expanded && (
        <div className="px-4 pb-3 border-t" style={{ borderColor: 'var(--color-border)' }}>
          {entry.content && entry.content !== entry.preview && (
            <pre className="text-[12px] leading-relaxed whitespace-pre-wrap font-sans mt-3 mb-3" style={{ color: 'var(--color-text-primary)' }}>
              {entry.content}
            </pre>
          )}
          <div className="flex items-center gap-2 pt-2">
            <button
              onClick={onCopy}
              className="h-7 px-2.5 rounded text-[11px] font-medium flex items-center gap-1"
              style={{ background: 'var(--color-bg-main)', color: copied ? 'var(--color-success)' : 'var(--color-text-secondary)', border: '1px solid var(--color-border)' }}
            >
              {copied ? <Check size={11} /> : <Copy size={11} />}
              {copied ? t('已复制', 'Copied') : t('复制全文', 'Copy')}
            </button>
            <button
              onClick={onRemove}
              className="h-7 px-2.5 rounded text-[11px] font-medium flex items-center gap-1 ml-auto"
              style={{ background: 'transparent', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }}
            >
              <Trash2 size={11} /> {t('移除', 'Remove')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function FilterChip({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count: number }) {
  return (
    <button
      onClick={onClick}
      className="h-6 px-2 rounded-full text-[11px] font-medium flex items-center gap-1 transition-all"
      style={{
        background: active ? 'var(--color-accent-glow)' : 'var(--color-bg-card)',
        color: active ? 'var(--color-accent)' : 'var(--color-text-secondary)',
        border: `1px solid ${active ? 'var(--color-accent)' : 'var(--color-border)'}`,
      }}
    >
      {label}
      <span className="text-[10px] opacity-70">{count}</span>
    </button>
  );
}

function formatTime(ts: number, t: (zh: string, en: string) => string): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return t('刚刚', 'just now');
  if (m < 60) return t(`${m} 分钟前`, `${m}m ago`);
  const h = Math.floor(m / 60);
  if (h < 24) return t(`${h} 小时前`, `${h}h ago`);
  const d = Math.floor(h / 24);
  if (d < 7) return t(`${d} 天前`, `${d}d ago`);
  const date = new Date(ts);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
