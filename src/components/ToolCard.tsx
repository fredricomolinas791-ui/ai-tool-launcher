import { useState, useRef, useCallback } from 'react';
import type { Tool } from '../data/tools';
import { Construction, Check, Heart } from 'lucide-react';
import { useI18n } from '../hooks/useI18n';
import { Highlight } from './Highlight';

interface ToolCardProps {
  tool: Tool;
  index: number;
  onClick?: () => void;
  isImplemented?: boolean;
  isFavorited?: boolean;
  onToggleFavorite?: () => void;
  searchQuery?: string;
}

export function ToolCard({ tool, index, onClick, isImplemented = true, isFavorited = false, onToggleFavorite, searchQuery = '' }: ToolCardProps) {
  const { t, lang } = useI18n();
  const [ripples, setRipples] = useState<Array<{ id: number; x: number; y: number }>>([]);
  const cardRef = useRef<HTMLButtonElement>(null);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const newRipple = { id: Date.now(), x, y };
    setRipples([...ripples, newRipple]);
    setTimeout(() => setRipples(prev => prev.filter(r => r.id !== newRipple.id)), 600);
    onClick?.();
  };

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    // Gentler tilt (±2.5° instead of ±4°) so it doesn't compete with the
    // CSS-driven hover state (scale + glow) for the eye.
    const rotateX = ((y - centerY) / centerY) * -2.5;
    const rotateY = ((x - centerX) / centerX) * 2.5;
    card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-2px)`;
  }, []);

  const handleMouseLeave = useCallback(() => {
    const card = cardRef.current;
    if (card) {
      card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) translateY(0)';
    }
  }, []);

  // Favorite button must not trigger the card click
  const handleFavorite = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleFavorite?.();
  };

  return (
    <button
      ref={cardRef}
      onClick={handleClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="tool-card group relative w-full p-5 rounded-2xl ripple-container flex flex-col items-center text-center theme-transition animate-card-enter card-tilt"
      style={{
        background: 'var(--color-bg-card)',
        border: '1px solid var(--color-border)',
        minHeight: '230px',
        boxShadow: 'var(--shadow-card)',
        animationDelay: `${index * 35}ms`,
      }}
    >
      {ripples.map(r => (
        <span key={r.id} className="ripple" style={{ left: r.x, top: r.y }} />
      ))}

      {/* Favorite button (top-right) — only show when an onToggleFavorite is wired.
          Sized to ~32px hit target so it's actually tappable; visibility raised
          from 0.35 → 0.55 idle so users notice it without a hover. */}
      {onToggleFavorite && (
        <span
          role="button"
          aria-label={isFavorited ? t.unfavorite : t.favorite}
          aria-pressed={isFavorited}
          tabIndex={-1}
          onClick={handleFavorite}
          className="absolute top-2 right-2 w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200 z-10 cursor-pointer"
          style={{
            color: isFavorited ? 'var(--color-accent)' : 'var(--color-text-muted)',
            background: isFavorited ? 'var(--color-accent-glow)' : 'transparent',
            opacity: isFavorited ? 1 : 0.55,
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.opacity = '1';
            (e.currentTarget as HTMLElement).style.background = 'var(--color-accent-glow)';
            (e.currentTarget as HTMLElement).style.transform = 'scale(1.1)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.opacity = isFavorited ? '1' : '0.55';
            (e.currentTarget as HTMLElement).style.background = isFavorited ? 'var(--color-accent-glow)' : 'transparent';
            (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
          }}
        >
          <Heart
            size={18}
            strokeWidth={2}
            fill={isFavorited ? 'currentColor' : 'none'}
          />
        </span>
      )}

      {/* Status row — centered, very subtle */}
      <div className="flex items-center justify-center gap-1.5 mb-7">
        {isImplemented ? (
          <div
            className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-medium"
            style={{
              background: 'rgba(52, 211, 153, 0.12)',
              color: 'var(--color-success)',
            }}
          >
            <Check size={9} strokeWidth={3} />
            <span>{lang === 'en' ? 'Ready' : '可用'}</span>
          </div>
        ) : (
          <div
            className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-medium"
            style={{
              background: 'var(--color-border)',
              color: 'var(--color-text-muted)',
            }}
          >
            <Construction size={9} strokeWidth={2.5} />
            <span>{t.statusUnimplemented}</span>
          </div>
        )}
        {tool.hot && (
          <span
            className="text-[9px] font-semibold tracking-wider"
            style={{ color: 'var(--color-accent)' }}
          >
            · {t.tagHot}
          </span>
        )}
        {!tool.hot && tool.trending && (
          <span
            className="text-[9px] font-semibold tracking-wider"
            style={{ color: 'var(--color-text-muted)' }}
          >
            · {t.tagNew}
          </span>
        )}
      </div>

      {/* Icon — refined "soft glow" style, no rotation */}
      <div className="card-icon w-[60px] h-[60px] rounded-2xl flex items-center justify-center mb-5">
        <tool.icon
          size={28}
          strokeWidth={1.6}
          className="card-icon-svg"
          style={{ color: 'var(--color-accent)' }}
        />
      </div>

      {/* Text — weakened, centered, with search highlight */}
      <h3
        className="font-medium text-[13px] mb-1.5 leading-snug text-balance"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        {searchQuery ? <Highlight text={tool.name[lang]} query={searchQuery} /> : tool.name[lang]}
      </h3>
      <p
        className="tool-desc text-[11px] leading-relaxed line-clamp-2 mb-4 text-pretty px-1"
        style={{ color: 'var(--color-text-muted)' }}
      >
        {searchQuery ? <Highlight text={tool.desc[lang]} query={searchQuery} /> : tool.desc[lang]}
      </p>

      {/* Tags — very subtle, centered */}
      <div className="tool-tags flex items-center justify-center gap-1 mt-auto">
        {tool.tags.slice(0, 2).map((tag, i) => (
          <span
            key={i}
            className="text-[9px] px-1.5 py-0.5 rounded"
            style={{
              color: 'var(--color-text-muted)',
              border: '1px solid var(--color-border)',
            }}
          >
            {tag[lang]}
          </span>
        ))}
      </div>
    </button>
  );
}
