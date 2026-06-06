/* ═══════════════════════════════════════════════════════════════════
   AI 狼人杀 —— 性格小标签
   ═══════════════════════════════════════════════════════════════════ */

import type { Personality } from './engine';

const MAP: Record<Personality, { emoji: string; zh: string; en: string }> = {
  strategist:  { emoji: '🧠', zh: '老谋深算', en: 'Strategist' },
  aggressive:  { emoji: '🔥', zh: '激进',     en: 'Aggressive' },
  mysterious:  { emoji: '🌫️', zh: '神秘',     en: 'Mysterious' },
  loyal:       { emoji: '🤝', zh: '死忠',     en: 'Loyalist' },
  backstab:    { emoji: '🗡️', zh: '反水',     en: 'Backstabber' },
  cute:        { emoji: '🐣', zh: '萌新',     en: 'Newbie' },
};

export function PersonalityRender({ id, lang }: { id: Personality; lang: 'zh' | 'en' }) {
  const p = MAP[id];
  return (
    <span className="text-[9px] px-1 rounded" style={{
      background: 'var(--color-bg-deep)',
      color: 'var(--color-text-muted)',
    }}>
      {p.emoji} {lang === 'zh' ? p.zh : p.en}
    </span>
  );
}
