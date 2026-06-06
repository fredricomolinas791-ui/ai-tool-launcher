import { useState, useEffect, useRef } from 'react';
import { Brain, FileText, Copy, Check, Loader2, AlertCircle, ChevronRight, ChevronDown } from 'lucide-react';

/**
 * AIOutputTabs — render an AI stream with two tabs:
 *   - 结果 (Result)  — the final answer text
 *   - 思考 (Thinking) — the chain-of-thought block (M3 / Claude-style)
 *
 * The thinking tab is hidden until there's something to show, so models
 * that don't emit thinking don't get a useless empty tab.
 *
 * Live streaming is supported: pass `streaming` and the cursor will
 * pulse in whichever tab is active.
 */
export interface AIOutputTabsProps {
  /** The result / answer text. Live-updated. */
  text: string;
  /** The thinking text. Live-updated. Optional — when absent/empty
   *  the "thinking" tab is hidden. */
  thinking?: string;
  /** True while the model is still streaming. */
  streaming?: boolean;
  /** Error message; shown as a banner when present. */
  error?: string | null;
  /** If true, show the thinking tab even when empty (e.g. for the
   *  "thinking" tab of a tool that the user explicitly toggled). */
  forceShowThinkingTab?: boolean;
  /** Initial tab to show. Defaults to 'result'. */
  defaultTab?: 'result' | 'thinking';
  /** Optional label to render in the top-right of the result tab. */
  resultMeta?: string;
}

export function AIOutputTabs({
  text,
  thinking = '',
  streaming = false,
  error = null,
  forceShowThinkingTab = false,
  defaultTab = 'result',
  resultMeta,
}: AIOutputTabsProps) {
  const [tab, setTab] = useState<'result' | 'thinking'>(defaultTab);
  const [thinkingExpanded, setThinkingExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // When streaming, auto-switch to whichever tab has fresh content.
  useEffect(() => {
    if (!streaming) return;
    // If text just started arriving and we're still on thinking, stay.
    // If thinking is still arriving, jump to thinking tab.
    if (thinking && !text) setTab('thinking');
    else if (text) setTab('result');
  }, [streaming, thinking, text]);

  // Auto-scroll the active panel as content streams in.
  useEffect(() => {
    if (streaming && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [text, thinking, streaming]);

  const hasThinking = thinking.trim().length > 0;
  const showThinkingTab = hasThinking || forceShowThinkingTab;

  const activeText = tab === 'result' ? text : thinking;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(activeText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  return (
    <div
      className="rounded-xl overflow-hidden flex flex-col h-full"
      style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
    >
      {/* Tab bar */}
      <div
        className="flex items-center gap-1 px-2 pt-1.5 shrink-0"
        style={{ borderBottom: '1px solid var(--color-border)' }}
      >
        <TabButton
          active={tab === 'result'}
          onClick={() => setTab('result')}
          icon={FileText}
          label="结果"
          badge={text.length > 0 ? `${text.length}` : undefined}
          streaming={streaming && !!text}
        />
        {showThinkingTab && (
          <TabButton
            active={tab === 'thinking'}
            onClick={() => setTab('thinking')}
            icon={Brain}
            label="思考"
            badge={thinking.length > 0 ? `${thinking.length}` : undefined}
            streaming={streaming && !!thinking && !text}
          />
        )}

        {resultMeta && tab === 'result' && (
          <span className="ml-2 text-[10px] font-mono" style={{ color: 'var(--color-text-muted)' }}>
            {resultMeta}
          </span>
        )}

        <div className="ml-auto flex items-center gap-1 pr-1">
          {streaming && (
            <span
              className="flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded"
              style={{ background: 'var(--color-accent-glow)', color: 'var(--color-accent)' }}
            >
              <Loader2 size={10} className="animate-spin" />
              生成中
            </span>
          )}
          <button
            onClick={copy}
            disabled={!activeText}
            className="h-7 w-7 rounded flex items-center justify-center transition-colors disabled:opacity-30"
            style={{ color: 'var(--color-text-muted)' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--color-bg-card-hover)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            title={tab === 'result' ? '复制结果' : '复制思考'}
          >
            {copied ? <Check size={13} style={{ color: 'var(--color-success)' }} /> : <Copy size={13} />}
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div
          className="mx-3 mt-2 rounded-lg p-2.5 flex items-start gap-2 text-[12px]"
          style={{
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid var(--color-warning)',
            color: 'var(--color-warning)',
          }}
        >
          <AlertCircle size={13} className="mt-0.5 shrink-0" />
          <span className="break-all">{error}</span>
        </div>
      )}

      {/* Content panels — only render the active one to keep DOM light. */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4"
        style={{ color: 'var(--color-text-primary)' }}
      >
        {tab === 'result' ? (
          <pre
            className="text-[13px] leading-relaxed whitespace-pre-wrap font-sans"
            style={{ color: text ? 'var(--color-text-primary)' : 'var(--color-text-muted)' }}
          >
            {text || (streaming ? '等待结果…' : '尚无结果')}
            {streaming && text && <span className="inline-block w-1.5 h-3.5 ml-0.5 align-middle animate-pulse" style={{ background: 'var(--color-accent)' }} />}
          </pre>
        ) : (
          <div>
            <pre
              className="text-[12px] leading-relaxed whitespace-pre-wrap font-mono"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              {thinking || (streaming ? '等待模型思考…' : '尚无思考内容')}
              {streaming && thinking && <span className="inline-block w-1.5 h-3.5 ml-0.5 align-middle animate-pulse" style={{ background: 'var(--color-accent-soft)' }} />}
            </pre>
            {!streaming && hasThinking && (
              <details
                className="mt-2 text-[11px]"
                onToggle={(e) => setThinkingExpanded((e.target as HTMLDetailsElement).open)}
              >
                <summary
                  className="cursor-pointer flex items-center gap-1 select-none"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  {thinkingExpanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                  复制思考原文
                </summary>
                <pre
                  className="mt-1 p-2 rounded text-[11px] whitespace-pre-wrap font-mono"
                  style={{ background: 'var(--color-bg-main)', color: 'var(--color-text-muted)' }}
                >
                  {thinking}
                </pre>
              </details>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function TabButton({
  active, onClick, icon: Icon, label, badge, streaming,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  label: string;
  badge?: string;
  streaming?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className="h-8 px-3 text-[12px] font-medium flex items-center gap-1.5 relative transition-colors"
      style={{ color: active ? 'var(--color-text-primary)' : 'var(--color-text-muted)' }}
    >
      <Icon size={12} strokeWidth={1.8} className={streaming ? 'animate-pulse' : undefined} />
      <span>{label}</span>
      {badge && (
        <span
          className="text-[9px] font-mono px-1 rounded"
          style={{ color: active ? 'var(--color-accent)' : 'var(--color-text-muted)' }}
        >
          {badge}
        </span>
      )}
      {active && (
        <span
          className="absolute left-2 right-2 bottom-0 h-0.5 rounded-full"
          style={{ background: 'var(--color-accent)' }}
        />
      )}
    </button>
  );
}
