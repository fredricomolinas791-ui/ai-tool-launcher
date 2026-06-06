import { useState, useEffect, useMemo, useRef } from 'react';
import { X, History, Trash2, Search, Download, Copy, Check, Brain, Filter } from 'lucide-react';
import { useHistory, type HistoryEntry } from '../hooks/useHistory';
import { useI18n } from '../hooks/useI18n';

/**
 * HistoryPanel — global slide-over drawer showing every AI generation
 * the user has produced across all tools, with a per-tool filter,
 * search, and per-entry actions (copy result, copy thinking, export
 * single entry, delete).
 */
export function HistoryPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { lang } = useI18n();
  const { entries, grouped, remove, clear, clearByTool } = useHistory();
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

  // Auto-focus search on open
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries
      .filter((e) => filterTool === null || e.toolId === filterTool)
      .filter((e) => !q || e.toolName.toLowerCase().includes(q) || e.prompt.toLowerCase().includes(q) || e.result.toLowerCase().includes(q));
  }, [entries, query, filterTool]);

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

  const exportEntry = (e: HistoryEntry) => {
    const blob = new Blob([JSON.stringify(e, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `history-${e.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      style={{ background: 'rgba(0, 0, 0, 0.45)', backdropFilter: 'blur(4px)', animation: 'backdropIn 0.2s ease' }}
      onClick={onClose}
    >
      <aside
        onClick={(e) => e.stopPropagation()}
        className="h-full w-[480px] max-w-[92vw] flex flex-col"
        style={{
          background: 'var(--color-bg-main)',
          borderLeft: '1px solid var(--color-border)',
          boxShadow: '-12px 0 40px rgba(0, 0, 0, 0.4)',
          animation: 'settingsIn 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Header */}
        <header
          className="h-14 px-5 flex items-center justify-between shrink-0"
          style={{ borderBottom: '1px solid var(--color-border)' }}
        >
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'var(--color-accent-glow)' }}
            >
              <History size={15} strokeWidth={1.8} style={{ color: 'var(--color-accent)' }} />
            </div>
            <div>
              <p className="text-[14px] font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                {lang === 'en' ? 'Generation History' : '生成历史'}
              </p>
              <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
                {entries.length} {lang === 'en' ? 'entries' : '条'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ color: 'var(--color-text-muted)' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--color-bg-card)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
          >
            <X size={15} />
          </button>
        </header>

        {/* Search + filter */}
        <div
          className="px-3 py-2.5 flex items-center gap-2 shrink-0"
          style={{ borderBottom: '1px solid var(--color-border)' }}
        >
          <div
            className="flex-1 flex items-center gap-1.5 h-8 px-2.5 rounded-md"
            style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
          >
            <Search size={12} style={{ color: 'var(--color-text-muted)' }} />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={lang === 'en' ? 'Search prompt / result…' : '搜索 prompt / 结果…'}
              className="flex-1 bg-transparent outline-none text-[12px]"
              style={{ color: 'var(--color-text-primary)' }}
            />
          </div>
          <select
            value={filterTool ?? ''}
            onChange={(e) => setFilterTool(e.target.value ? Number(e.target.value) : null)}
            className="h-8 px-2 rounded-md text-[11px] outline-none"
            style={{
              background: 'var(--color-bg-card)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text-primary)',
            }}
            title={lang === 'en' ? 'Filter by tool' : '按工具筛选'}
          >
            <option value="">{lang === 'en' ? 'All tools' : '全部工具'} ({entries.length})</option>
            {tools.map((t) => (
              <option key={t.toolId} value={t.toolId}>{t.name} ({t.count})</option>
            ))}
          </select>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-8 py-12">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3"
                style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
              >
                <Filter size={20} style={{ color: 'var(--color-text-muted)' }} />
              </div>
              <p className="text-[13px] font-medium mb-1" style={{ color: 'var(--color-text-primary)' }}>
                {lang === 'en' ? 'No history yet' : '还没有生成历史'}
              </p>
              <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                {lang === 'en' ? 'Use any AI tool to start building history.' : '用任意 AI 工具生成一次,这里就会有记录。'}
              </p>
            </div>
          ) : (
            <ul className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
              {filtered.map((e) => (
                <HistoryItem
                  key={e.id}
                  entry={e}
                  expanded={expandedId === e.id}
                  onToggle={() => setExpandedId(expandedId === e.id ? null : e.id)}
                  onCopy={(text) => copy(text, e.id)}
                  onDelete={() => remove(e.id)}
                  onExport={() => exportEntry(e)}
                  copied={copiedId === e.id}
                />
              ))}
            </ul>
          )}
        </div>

        {/* Footer — bulk actions */}
        {entries.length > 0 && (
          <footer
            className="h-12 px-4 flex items-center justify-between shrink-0"
            style={{ borderTop: '1px solid var(--color-border)' }}
          >
            <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
              {filterTool !== null ? `${filtered.length} / ${entries.length}` : `${entries.length} ${lang === 'en' ? 'total' : '总'}`}
            </span>
            <div className="flex items-center gap-1.5">
              {filterTool !== null && (
                <button
                  onClick={() => { clearByTool(filterTool); setFilterTool(null); }}
                  className="h-7 px-2.5 rounded text-[11px] flex items-center gap-1"
                  style={{ background: 'var(--color-bg-card)', color: 'var(--color-text-muted)' }}
                  title={lang === 'en' ? `Clear ${filterTool} tool entries` : '清空这个工具的历史'}
                >
                  <Trash2 size={11} /> {lang === 'en' ? 'Clear tool' : '清空此工具'}
                </button>
              )}
              <button
                onClick={() => {
                  if (!confirmingClear) {
                    setConfirmingClear(true);
                    setTimeout(() => setConfirmingClear(false), 3000);
                    return;
                  }
                  clear();
                  setConfirmingClear(false);
                }}
                className="h-7 px-2.5 rounded text-[11px] flex items-center gap-1"
                style={{
                  background: confirmingClear ? 'rgba(251, 191, 36, 0.12)' : 'var(--color-bg-card)',
                  border: `1px solid ${confirmingClear ? 'var(--color-warning)' : 'var(--color-border)'}`,
                  color: confirmingClear ? 'var(--color-warning)' : 'var(--color-text-muted)',
                }}
              >
                {confirmingClear
                  ? (lang === 'en' ? 'Tap again to confirm' : '再次确认清空')
                  : (lang === 'en' ? 'Clear all' : '清空全部')}
              </button>
            </div>
          </footer>
        )}
      </aside>
    </div>
  );
}

function HistoryItem({
  entry, expanded, onToggle, onCopy, onDelete, onExport, copied,
}: {
  entry: HistoryEntry;
  expanded: boolean;
  onToggle: () => void;
  onCopy: (text: string) => void;
  onDelete: () => void;
  onExport: () => void;
  copied: boolean;
}) {
  const { lang } = useI18n();
  const hasThinking = !!entry.thinking && entry.thinking.length > 0;
  const time = formatTime(entry.createdAt, lang);

  return (
    <li
      className="px-4 py-3 transition-colors"
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--color-bg-card)'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>
            {entry.toolName}
          </p>
          <p className="text-[10px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
            {time}{entry.durationMs ? ` · ${(entry.durationMs / 1000).toFixed(1)}s` : ''}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {hasThinking && (
            <span
              className="text-[9px] px-1 rounded flex items-center gap-0.5"
              style={{ background: 'var(--color-accent-glow)', color: 'var(--color-accent)' }}
              title={lang === 'en' ? 'has thinking' : '含思考'}
            >
              <Brain size={9} /> thinking
            </span>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onCopy(entry.result); }}
            className="w-6 h-6 rounded flex items-center justify-center"
            style={{ color: 'var(--color-text-muted)' }}
            title={lang === 'en' ? 'Copy result' : '复制结果'}
          >
            {copied ? <Check size={11} style={{ color: 'var(--color-success)' }} /> : <Copy size={11} />}
          </button>
        </div>
      </div>
      <p
        className="text-[11px] line-clamp-2 cursor-pointer"
        style={{ color: 'var(--color-text-secondary)' }}
        onClick={onToggle}
        title={entry.prompt}
      >
        {entry.prompt}
      </p>
      {expanded && (
        <div
          className="mt-2 rounded-lg p-2.5 text-[11px] whitespace-pre-wrap"
          style={{ background: 'var(--color-bg-card-hover)', color: 'var(--color-text-secondary)' }}
        >
          {hasThinking && (
            <details className="mb-2">
              <summary className="cursor-pointer flex items-center gap-1" style={{ color: 'var(--color-text-muted)' }}>
                <Brain size={10} /> {lang === 'en' ? 'Thinking' : '思考'}
              </summary>
              <pre className="mt-1 font-mono text-[10px] leading-relaxed">{entry.thinking}</pre>
            </details>
          )}
          {entry.result}
        </div>
      )}
      {expanded && (
        <div className="mt-2 flex items-center gap-1.5">
          <button
            onClick={() => onExport()}
            className="h-6 px-2 rounded text-[10px] flex items-center gap-1"
            style={{ background: 'var(--color-bg-card)', color: 'var(--color-text-muted)' }}
          >
            <Download size={10} /> {lang === 'en' ? 'Export' : '导出'}
          </button>
          <button
            onClick={onDelete}
            className="h-6 px-2 rounded text-[10px] flex items-center gap-1"
            style={{ background: 'var(--color-bg-card)', color: 'var(--color-warning)' }}
          >
            <Trash2 size={10} /> {lang === 'en' ? 'Delete' : '删除'}
          </button>
        </div>
      )}
    </li>
  );
}

function formatTime(ts: number, lang: 'zh' | 'en'): string {
  const d = new Date(ts);
  const now = new Date();
  const diff = now.getTime() - ts;
  const day = 24 * 60 * 60 * 1000;
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  if (diff < day && d.getDate() === now.getDate()) {
    return lang === 'en' ? `Today ${time}` : `今天 ${time}`;
  }
  if (diff < 2 * day) {
    return lang === 'en' ? `Yesterday ${time}` : `昨天 ${time}`;
  }
  if (diff < 7 * day) {
    return lang === 'en' ? d.toLocaleDateString('en-US', { weekday: 'short' }) + ' ' + time
                         : `${['日','一','二','三','四','五','六'][d.getDay()]} ${time}`;
  }
  return `${d.getMonth() + 1}/${d.getDate()} ${time}`;
}
