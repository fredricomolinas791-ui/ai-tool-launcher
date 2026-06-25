import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface ToolPanelProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon: LucideIcon;
  children: React.ReactNode;
}

export function ToolPanel({ open, onClose, title, subtitle, icon: Icon, children }: ToolPanelProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    if (open) {
      setMounted(true);
      const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
      document.addEventListener('keydown', onKey);
      return () => document.removeEventListener('keydown', onKey);
    }
  }, [open, onClose]);

  if (!open && !mounted) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{
        background: 'rgba(0, 0, 0, 0.55)',
        backdropFilter: 'blur(4px)',
        animation: 'backdropIn 0.2s ease',
      }}
      /* P0 Bug 2 修复:背景点击关闭 — 必须 e.target === e.currentTarget 才算点背景。
         之前任何子元素没 stopPropagation 到位时会冒泡关闭。
         现在只有在用户真的点到 backdrop(没点到内容)时才关闭。 */
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[920px] max-w-[94vw] h-[640px] max-h-[90vh] rounded-2xl overflow-hidden flex flex-col"
        style={{
          background: 'var(--color-bg-main)',
          border: '1px solid var(--color-border)',
          boxShadow: '0 24px 80px rgba(0, 0, 0, 0.55), 0 8px 24px rgba(0, 0, 0, 0.35)',
          animation: 'panelIn 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <header
          className="h-16 px-6 flex items-center justify-between shrink-0"
          style={{ borderBottom: '1px solid var(--color-border)' }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{
                background: 'var(--color-bg-card)',
                border: '1px solid var(--color-border)',
              }}
            >
              <Icon size={20} strokeWidth={1.6} style={{ color: 'var(--color-accent)' }} />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>
                {title}
              </h2>
              {subtitle && (
                <p className="text-xs truncate" style={{ color: 'var(--color-text-muted)' }}>
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="关闭"
            className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors"
            style={{ color: 'var(--color-text-muted)' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--color-bg-card)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
          >
            <X size={16} strokeWidth={1.8} />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
      <style>{`
        @keyframes panelIn {
          from { opacity: 0; transform: scale(0.96) translateY(8px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  );
}
