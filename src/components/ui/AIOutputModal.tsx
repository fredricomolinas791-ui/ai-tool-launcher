import { useState, useRef, useEffect } from 'react';
import { X, Sparkles, Copy, Check, RefreshCw, AlertCircle, Settings as SettingsIcon, ChevronDown, ChevronUp } from 'lucide-react';
import { useAI } from '../../hooks/useAI';
import { Button, ConfirmButton } from './Button';

interface AIOutputModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  prompt: string;
  systemPrompt?: string;
  temperature?: number;
  onDone?: (text: string) => void;
}

export function AIOutputModal({ open, onClose, title, prompt, systemPrompt, temperature, onDone }: AIOutputModalProps) {
  const ai = useAI();
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [temp, setTemp] = useState(temperature ?? 0.7);
  const abortedRef = useRef(false);

  useEffect(() => {
    if (open) {
      setText('');
      setError(null);
      setLoading(false);
    }
  }, [open]);

  if (!open) return null;

  const run = async () => {
    if (!ai.isConfigured) {
      setError('未配置 API Key。请点击右上角 ⚙ Settings 按钮配置 AI Provider。');
      return;
    }
    setLoading(true);
    setText('');
    setError(null);
    abortedRef.current = false;
    try {
      const result = await ai.chat(
        {
          messages: [{ role: 'user', content: prompt }],
          systemPrompt,
          temperature: temp,
          maxTokens: 2048,
        },
        {
          onDelta: (delta) => {
            if (!abortedRef.current) setText((t) => t + delta);
          },
        }
      );
      if (!abortedRef.current) onDone?.(result);
    } catch (e: any) {
      setError(e.message || '调用失败');
    } finally {
      setLoading(false);
    }
  };

  const stop = () => { abortedRef.current = true; setLoading(false); };

  const copy = () => {
    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center"
      style={{ background: 'rgba(0, 0, 0, 0.55)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[680px] max-w-[92vw] h-[560px] max-h-[88vh] rounded-2xl overflow-hidden flex flex-col"
        style={{ background: 'var(--color-bg-main)', border: '1px solid var(--color-border)', boxShadow: '0 24px 80px rgba(0, 0, 0, 0.55)' }}
      >
        <header
          className="h-14 px-5 flex items-center justify-between shrink-0"
          style={{ borderBottom: '1px solid var(--color-border)' }}
        >
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: 'var(--color-accent-glow)' }}
            >
              <Sparkles size={14} style={{ color: 'var(--color-accent)' }} />
            </div>
            <h2 className="text-[14px] font-semibold" style={{ color: 'var(--color-text-primary)' }}>{title}</h2>
            {ai.isConfigured && (
              <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--color-bg-main)', color: 'var(--color-text-muted)' }}>
                {ai.activeProvider}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
            style={{ color: 'var(--color-text-muted)' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--color-bg-card)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
          >
            <X size={16} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-5">
          {!ai.isConfigured ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-3" style={{ background: 'var(--color-accent-glow)' }}>
                <Sparkles size={28} style={{ color: 'var(--color-accent)' }} />
              </div>
              <p className="text-[14px] font-medium mb-1" style={{ color: 'var(--color-text-primary)' }}>未配置 AI Provider</p>
              <p className="text-[12px] mb-4" style={{ color: 'var(--color-text-muted)' }}>点击右上角 ⚙ 配置 OpenAI / Claude Key</p>
              <Button variant="secondary" onClick={onClose}>关闭</Button>
            </div>
          ) : text ? (
            <div
              className="rounded-xl p-4 whitespace-pre-wrap text-[13px] leading-relaxed"
              style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)', minHeight: 200 }}
            >
              {text}
              {loading && <span className="inline-block w-1.5 h-4 ml-0.5 align-middle animate-pulse" style={{ background: 'var(--color-accent)' }} />}
            </div>
          ) : error ? (
            <div
              className="rounded-xl p-4 flex items-start gap-2"
              style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid var(--color-warning)' }}
            >
              <AlertCircle size={16} className="mt-0.5 shrink-0" style={{ color: 'var(--color-warning)' }} />
              <div className="flex-1">
                <p className="text-[13px] font-medium" style={{ color: '#fca5a5' }}>调用失败</p>
                <p className="text-[12px] mt-1 break-all" style={{ color: 'var(--color-text-secondary)' }}>{error}</p>
                <p className="text-[11px] mt-2" style={{ color: 'var(--color-text-muted)' }}>
                  提示:可前往 设置 → AI Provider 测试连接
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-3" style={{ background: 'var(--color-accent-glow)' }}>
                <Sparkles size={28} style={{ color: 'var(--color-accent)' }} />
              </div>
              <p className="text-[13px] mb-4" style={{ color: 'var(--color-text-secondary)' }}>准备好后点击下方"开始生成"</p>
              <button
                onClick={() => setShowConfig(!showConfig)}
                className="text-[11px] flex items-center gap-1"
                style={{ color: 'var(--color-text-muted)' }}
              >
                <SettingsIcon size={11} /> 高级选项 {showConfig ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
              </button>
            </div>
          )}

          {showConfig && !text && !error && (
            <div className="rounded-xl p-3 mt-4" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
              <p className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--color-text-muted)' }}>温度: {temp}</p>
              <input type="range" min={0} max={2} step={0.1} value={temp} onChange={(e) => setTemp(Number(e.target.value))} className="w-full" style={{ accentColor: 'var(--color-accent)' }} />
              <p className="text-[10px] mt-1" style={{ color: 'var(--color-text-muted)' }}>0=精确 1=平衡 2=创造</p>
            </div>
          )}
        </div>

        <footer className="h-14 px-5 flex items-center justify-between shrink-0" style={{ borderTop: '1px solid var(--color-border)' }}>
          <div className="flex items-center gap-1.5">
            {!loading && text && (
              <>
                <Button variant="secondary" size="sm" onClick={copy} icon={copied ? Check : Copy}>{copied ? '已复制' : '复制'}</Button>
                <Button variant="ghost" size="sm" onClick={run} icon={RefreshCw}>重新生成</Button>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            {loading ? (
              <Button variant="danger" onClick={stop} icon={X}>停止</Button>
            ) : (
              <ConfirmButton onClick={run} icon={Sparkles} disabled={!ai.isConfigured}>
                开始生成
              </ConfirmButton>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}
