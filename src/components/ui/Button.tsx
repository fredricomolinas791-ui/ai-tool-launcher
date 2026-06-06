/* Standardized button system.
   Reference: Linear (subtle, refined), Vercel (sharp, decisive), Apple (clear hierarchy).
   4 variants + 4 sizes. */

import { useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Check, X, ArrowLeft, Loader2 } from 'lucide-react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
type Size = 'sm' | 'md' | 'lg';

interface BaseProps {
  variant?: Variant;
  size?: Size;
  icon?: LucideIcon;
  iconRight?: LucideIcon;
  loading?: boolean;
  fullWidth?: boolean;
  children?: React.ReactNode;
}

type ButtonProps = BaseProps & React.ButtonHTMLAttributes<HTMLButtonElement>;

const sizeMap: Record<Size, { h: string; px: string; text: string; iconSize: number; rounded: string }> = {
  sm: { h: 'h-7', px: 'px-2.5', text: 'text-[11px]', iconSize: 12, rounded: 'rounded-md' },
  md: { h: 'h-9', px: 'px-3.5', text: 'text-[13px]', iconSize: 14, rounded: 'rounded-lg' },
  lg: { h: 'h-11', px: 'px-5', text: 'text-[14px]', iconSize: 16, rounded: 'rounded-lg' },
};

export function Button({
  variant = 'secondary',
  size = 'md',
  icon: Icon,
  iconRight: IconRight,
  loading = false,
  fullWidth = false,
  disabled,
  className = '',
  children,
  onMouseEnter,
  onMouseLeave,
  ...rest
}: ButtonProps) {
  const [hover, setHover] = useState(false);
  const s = sizeMap[size];

  const baseStyle: React.CSSProperties = {
    transition: 'all 0.16s cubic-bezier(0.16, 1, 0.3, 1)',
    fontWeight: 500,
    letterSpacing: '-0.005em',
  };

  let variantStyle: React.CSSProperties = {};
  switch (variant) {
    case 'primary':
      variantStyle = {
        background: hover && !disabled ? 'var(--color-accent-soft)' : 'var(--color-accent)',
        color: '#0a0a0c',
        border: '1px solid transparent',
        boxShadow: hover && !disabled
          ? '0 0 0 4px var(--color-accent-glow), 0 1px 2px rgba(0,0,0,0.1)'
          : '0 1px 2px rgba(0,0,0,0.1)',
      };
      break;
    case 'secondary':
      variantStyle = {
        background: hover && !disabled ? 'var(--color-bg-card-hover)' : 'var(--color-bg-card)',
        color: 'var(--color-text-primary)',
        border: '1px solid var(--color-border)',
        boxShadow: hover && !disabled ? '0 0 0 3px var(--color-accent-glow)' : 'none',
      };
      break;
    case 'ghost':
      variantStyle = {
        background: hover && !disabled ? 'var(--color-bg-card)' : 'transparent',
        color: 'var(--color-text-secondary)',
        border: '1px solid transparent',
      };
      break;
    case 'danger':
      variantStyle = {
        background: hover && !disabled ? 'rgba(239, 68, 68, 0.12)' : 'var(--color-bg-card)',
        color: hover && !disabled ? '#fca5a5' : 'var(--color-warning)',
        border: '1px solid var(--color-warning)',
      };
      break;
    case 'success':
      variantStyle = {
        background: hover && !disabled ? 'rgba(52, 211, 153, 0.12)' : 'var(--color-bg-card)',
        color: hover && !disabled ? '#6ee7b7' : 'var(--color-success)',
        border: '1px solid var(--color-success)',
      };
      break;
  }

  return (
    <button
      {...rest}
      disabled={disabled || loading}
      onMouseEnter={(e) => { setHover(true); onMouseEnter?.(e); }}
      onMouseLeave={(e) => { setHover(false); onMouseLeave?.(e); }}
      className={`inline-flex items-center justify-center gap-1.5 ${s.h} ${s.px} ${s.text} ${s.rounded} ${fullWidth ? 'w-full' : ''} ${disabled || loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} ${className}`}
      style={{ ...baseStyle, ...variantStyle }}
    >
      {loading ? <Loader2 size={s.iconSize} className="animate-spin" /> : Icon && <Icon size={s.iconSize} strokeWidth={1.8} />}
      {children}
      {IconRight && !loading && <IconRight size={s.iconSize} strokeWidth={1.8} />}
    </button>
  );
}

/* ─── Semantically-named button helpers ─── */

export function ConfirmButton({ children = '确认', ...rest }: ButtonProps) {
  return <Button variant="primary" icon={Check} {...rest}>{children}</Button>;
}

export function SubmitButton({ children = '提交', ...rest }: ButtonProps) {
  return <Button variant="primary" {...rest}>{children}</Button>;
}

export function CancelButton({ children = '取消', ...rest }: ButtonProps) {
  return <Button variant="ghost" icon={X} {...rest}>{children}</Button>;
}

export function BackButton({ children = '返回', ...rest }: ButtonProps) {
  return <Button variant="ghost" icon={ArrowLeft} {...rest}>{children}</Button>;
}

export function DeleteButton({ children = '删除', ...rest }: ButtonProps) {
  return <Button variant="danger" {...rest}>{children}</Button>;
}
