import { useState, useRef } from 'react';
import { ChevronLeft, ChevronRight, LogIn, Shield } from 'lucide-react';
import type { Category } from '../data/tools';
import { useI18n } from '../hooks/useI18n';
import { useAuth } from '../hooks/useAuth';

interface SidebarProps {
  categories: Category[];
  activeCategory: string;
  onCategoryChange: (id: string) => void;
  onAuthClick: () => void;
  onAdminClick: () => void;
}

export function Sidebar({ categories, activeCategory, onCategoryChange, onAuthClick, onAdminClick }: SidebarProps) {
  const { t, lang } = useI18n();
  const { user, isAdmin } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Roving tabindex: only the active item is in the tab order.
  // ArrowUp/ArrowDown move focus to the neighbour and activate it.
  const navRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, i: number) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = (i + 1) % categories.length;
      navRefs.current[next]?.focus();
      onCategoryChange(categories[next].id);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = (i - 1 + categories.length) % categories.length;
      navRefs.current[prev]?.focus();
      onCategoryChange(categories[prev].id);
    } else if (e.key === 'Home') {
      e.preventDefault();
      navRefs.current[0]?.focus();
      onCategoryChange(categories[0].id);
    } else if (e.key === 'End') {
      e.preventDefault();
      const last = categories.length - 1;
      navRefs.current[last]?.focus();
      onCategoryChange(categories[last].id);
    }
  };

  return (
    <aside
      className="h-full theme-transition flex flex-col shrink-0 relative"
      style={{
        width: collapsed ? '56px' : '200px',
        background: 'var(--color-bg-sidebar)',
        transition: 'width 0.3s cubic-bezier(0.16, 1, 0.3, 1), background-color 0.3s ease, border-color 0.3s ease',
      }}
    >
      {/* Logo */}
      <div
        className="h-16 flex items-center theme-transition px-5"
        style={{ borderBottom: '1px solid var(--color-border)' }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{
              background: 'linear-gradient(135deg, var(--color-accent) 0%, var(--color-accent-soft) 100%)',
              boxShadow: '0 4px 14px var(--color-accent-glow)',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          {!collapsed && (
            <div className="flex flex-col min-w-0">
              <span
                className="text-[15px] font-semibold whitespace-nowrap leading-tight"
                style={{ color: 'var(--color-text-primary)', letterSpacing: '-0.01em' }}
              >
                {t.brandName}
              </span>
              <span
                className="text-[10px] whitespace-nowrap mt-0.5"
                style={{ color: 'var(--color-text-muted)', letterSpacing: '0.05em' }}
              >
                {t.brandSub}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Collapse button */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-20 w-6 h-6 rounded-full flex items-center justify-center theme-transition z-10 cursor-pointer"
        style={{
          background: 'var(--color-bg-card)',
          border: '1px solid var(--color-border)',
          color: 'var(--color-text-muted)',
          boxShadow: '0 2px 6px rgba(0, 0, 0, 0.1)',
        }}
      >
        {collapsed ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
      </button>

      {/* Navigation */}
      <nav
        className="flex-1 py-6 overflow-y-auto"
        style={{
          paddingLeft: collapsed ? '10px' : '14px',
          paddingRight: collapsed ? '10px' : '14px',
        }}
      >
        <ul className="space-y-1" role="list">
          {categories.map((category, i) => {
            const Icon = category.icon;
            const isActive = activeCategory === category.id;
            return (
              <li key={category.id}>
                <button
                  ref={(el) => { navRefs.current[i] = el; }}
                  onClick={() => onCategoryChange(category.id)}
                  onKeyDown={(e) => onKeyDown(e, i)}
                  onMouseEnter={() => setHoveredId(category.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  tabIndex={isActive ? 0 : -1}
                  aria-current={isActive ? 'page' : undefined}
                  className="w-full h-11 rounded-xl flex items-center gap-3 transition-all duration-200 outline-none focus-visible:ring-2"
                  style={{
                    background: isActive
                      ? 'linear-gradient(90deg, var(--color-accent-glow) 0%, transparent 100%)'
                      : hoveredId === category.id
                        ? 'var(--color-bg-card)'
                        : 'transparent',
                    color: isActive
                      ? 'var(--color-accent)'
                      : hoveredId === category.id
                        ? 'var(--color-text-primary)'
                        : 'var(--color-text-secondary)',
                    justifyContent: collapsed ? 'center' : 'flex-start',
                    paddingLeft: collapsed ? '0' : '12px',
                    paddingRight: collapsed ? '0' : '12px',
                    position: 'relative',
                  }}
                >
                  {isActive && !collapsed && (
                    <span
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full"
                      style={{ background: 'var(--color-accent)' }}
                    />
                  )}
                  <Icon size={18} strokeWidth={isActive ? 2.2 : 1.8} className="shrink-0" />
                  {!collapsed && (
                    <span className="text-sm font-medium truncate">{category.name[lang]}</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Bottom section */}
      <div
        className="p-4 theme-transition"
        style={{ borderTop: '1px solid var(--color-border)' }}
      >
        {isAdmin && (
          <button
            onClick={onAdminClick}
            className="w-full mb-1.5 h-9 px-3 rounded-lg flex items-center gap-2.5 text-[13px] font-medium transition-colors"
            style={{
              background: 'var(--color-accent-glow)',
              color: 'var(--color-accent)',
              justifyContent: collapsed ? 'center' : 'flex-start',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--color-accent)'; (e.currentTarget as HTMLElement).style.color = '#0a0a0c'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--color-accent-glow)'; (e.currentTarget as HTMLElement).style.color = 'var(--color-accent)'; }}
          >
            <Shield size={15} strokeWidth={1.8} />
            {!collapsed && <span>{lang === 'en' ? 'Admin Console' : '管理后台'}</span>}
          </button>
        )}
        <button
          onClick={onAuthClick}
          className="w-full flex items-center gap-3 px-2 py-2 rounded-xl transition-colors"
          style={{ justifyContent: collapsed ? 'center' : 'flex-start' }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--color-bg-card)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
        >
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{
              background: isAdmin
                ? 'linear-gradient(135deg, var(--color-accent) 0%, var(--color-accent-soft) 100%)'
                : 'var(--color-bg-card)',
              border: isAdmin ? 'none' : '1px solid var(--color-border)',
              boxShadow: isAdmin ? '0 2px 10px var(--color-accent-glow)' : 'none',
            }}
          >
            {user ? (
              <span className="text-white text-sm font-semibold">{user.username[0].toUpperCase()}</span>
            ) : (
              <LogIn size={15} strokeWidth={1.8} style={{ color: 'var(--color-text-secondary)' }} />
            )}
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1 text-left">
              <p
                className="text-sm font-medium truncate"
                style={{ color: 'var(--color-text-primary)' }}
              >
                {user ? user.username : (lang === 'en' ? 'Sign in' : '登录')}
              </p>
              <p
                className="text-[11px] truncate"
                style={{ color: 'var(--color-text-muted)' }}
              >
                {user ? (isAdmin ? (lang === 'en' ? 'Administrator' : '管理员') : (lang === 'en' ? 'Member' : '会员')) : (lang === 'en' ? 'Click to sign in' : '点击登录')}
              </p>
            </div>
          )}
        </button>
      </div>
    </aside>
  );
}
