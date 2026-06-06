import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { useAI } from './useAI';
import { AIOutputModal } from '../components/ui/AIOutputModal';

interface UseAIButtonOptions {
  title: string;
  buildPrompt: (setOutput: (text: string) => void) => { prompt: string; systemPrompt?: string };
  onResult?: (text: string) => void;
}

/**
 * Hook that gives a tool an "AI Enhance" button.
 * Returns a button (render it anywhere) and a modal (render it once at root).
 */
export function useAIButton(opts: UseAIButtonOptions) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [onDone, setOnDone] = useState<((t: string) => void) | null>(null);

  const trigger = (preset = '') => {
    setText(preset);
    setOnDone(() => opts.onResult || null);
    setOpen(true);
  };

  const modal = open ? (
    <AIOutputModal
      open={open}
      onClose={() => setOpen(false)}
      title={opts.title}
      prompt={text || (() => { const { prompt } = opts.buildPrompt(() => {}); return prompt; })()}
      onDone={(result) => { onDone?.(result); setOpen(false); }}
    />
  ) : null;

  return { trigger, modal, setText };
}

/** A small Sparkles button that opens the AI flow with a given preset prompt. */
export function AIButton({ onClick, label, size = 'sm' }: { onClick: () => void; label?: string; size?: 'sm' | 'md' }) {
  const ai = useAI();
  return (
    <button
      onClick={onClick}
      title={ai.isConfigured ? `AI: ${ai.activeProvider}` : '未配置 API Key'}
      className={`${size === 'sm' ? 'h-7 px-2.5 text-[11px]' : 'h-9 px-3.5 text-[13px]'} rounded-lg font-medium flex items-center gap-1.5 transition-all`}
      style={{
        background: ai.isConfigured ? 'var(--color-accent-glow)' : 'var(--color-bg-card)',
        color: ai.isConfigured ? 'var(--color-accent)' : 'var(--color-text-muted)',
        border: `1px solid ${ai.isConfigured ? 'var(--color-accent)' : 'var(--color-border)'}`,
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = '0.85'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
    >
      <Sparkles size={size === 'sm' ? 11 : 13} strokeWidth={1.8} />
      {label || 'AI 增强'}
    </button>
  );
}
