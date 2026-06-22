/* ═══════════════════════════════════════════════════════════════════
   AI 狼人杀 —— 主 UI
   ─────────────────────────────────────────────────────────────
   Phase 2-A: 9 人预女猎白 + 12 人狼王守卫 完整跑通
             其他 3 个 12 人板点进去显示"敬请推出"
   ═══════════════════════════════════════════════════════════════════ */

/* P1-#22 修复(用户反馈):全局对话日志,方便 Claude 自己读取
   暴露到 window.__werewolfLog,用户可以:
   - 在 DevTools Console 输入 `JSON.stringify(window.__werewolfLog)` 看完整 JSON
   - 或在 GameOver 点"复制对话"按钮(会调 formatGameLog 复制纯文本) */
declare global {
  interface Window {
    __werewolfLog?: Array<{ ts: number; kind: string; data: any }>;
  }
}
if (typeof window !== 'undefined' && !window.__werewolfLog) {
  window.__werewolfLog = [];
}

import { useState, useEffect, useRef, useMemo, Component, type ReactNode, type Dispatch, type SetStateAction } from 'react';
import { Drama, Sparkles, Sun, ChevronRight, Crown, AlertTriangle, Play, X, Skull, Shield, Users, Swords } from 'lucide-react';
import { Button } from '../../ui/Button';
import { useI18n } from '../../../hooks/useI18n';
import {
  BOARDS, BOARD_LIST, ROLES, type BoardId, type GameState, type Player, type RoleId, type SpeechRecord,
  initGame, loadAIConfig, callAIStream, checkWinner, parseAIDecision, tryJsonExtract, applyLoversChain,
  applyKnightDuel, applyWolfSelfDestruct, canVote, killPlayers,
  sheriffVoteWeight, aggregateWolfVotes, parseAIDecisionToTargetId,
  defaultMemory,
} from './engine';
import type { BoardDef, Phase } from './data';
import { canWitchSelfSave } from './data';
import { PersonalityRender } from './Personalities';

/* ── 所有 6 个板子都可玩 ── */
// P1-#22: 板子可玩性改为在 data.ts 用 variant: 'coming-soon' 标记
//   旧的 PLAYABLE_BOARDS 列表已废弃(4 个特殊板子暂存: wolfking / wolfbeauty / gargoyle / cupid)
// const PLAYABLE_BOARDS: BoardId[] = [
//   'p9-classic', 'p12-classic',
// ];

/* ═══════════════════════════════════════════════════════════════════
   板子选择卡片
   ═══════════════════════════════════════════════════════════════════ */

function BoardCard({ board, onSelect, lang, disabled, disabledReason }: {
  board: BoardDef; onSelect: () => void;
  lang: 'zh' | 'en'; disabled?: boolean; disabledReason?: string;
}) {
  const wolfCount = board.roles.filter(r => ROLES[r].faction === 'wolf').length;
  const godCount = board.roles.filter(r => ['seer', 'witch', 'hunter', 'guard', 'knight'].includes(r)).length;
  return (
    <button
      onClick={disabled ? undefined : onSelect}
      disabled={disabled}
      className="group relative w-full text-left p-4 rounded-xl border transition-all"
      style={{
        background: 'var(--color-card-bg)',
        borderColor: disabled ? 'var(--color-border-light)' : 'var(--color-accent)',
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      <div className="flex items-start gap-3">
        <div className="shrink-0 w-12 h-12 rounded-lg flex items-center justify-center text-2xl"
          style={{ background: 'var(--color-accent-glow)' }}>🎭</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold truncate" style={{ color: 'var(--color-text)' }}>{board.name[lang]}</h3>
            <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--color-accent-glow)', color: 'var(--color-accent)' }}>
              {board.playerCount} {lang === 'zh' ? '人' : 'P'}
            </span>
          </div>
          <p className="text-xs mt-1 line-clamp-2" style={{ color: 'var(--color-text-muted)' }}>{board.desc[lang]}</p>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(220,38,38,0.15)', color: '#dc2626' }}>🐺 {wolfCount}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(34,197,94,0.15)', color: '#16a34a' }}>🛡️ {godCount}</span>
          </div>
          {board.feature && (
            <p className="text-[10px] mt-1.5 italic" style={{ color: 'var(--color-text-muted)' }}>✨ {board.feature[lang]}</p>
          )}
        </div>
      </div>
      {disabled && disabledReason && (
        <div className="mt-2 text-[10px] flex items-center gap-1" style={{ color: 'var(--color-text-muted)' }}>
          <AlertTriangle size={11} />{disabledReason}
        </div>
      )}
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   玩家座位
   ═══════════════════════════════════════════════════════════════════ */

function PlayerSeat({ player, isYou, isSpeaking, isActing, isNight, lang, userMark, wolfTeammateSet, onClick, isSelected }: {
  player: Player; isYou: boolean; isSpeaking?: boolean; isActing?: boolean;
  /** P30:当前阶段是否是夜间 —— 只有夜间才点亮行动者座位,白天不允许高亮(避免身份暴露) */
  isNight?: boolean;
  lang: 'zh' | 'en';
  userMark?: string;  // P1-#22: 用户手动标记(如"狼人/好人/守卫")
  wolfTeammateSet?: Set<number>;  // P1-#22: 用户的狼队友 ID 集合
  // P24:点击玩家头像 → 显示该玩家的发言历史 + 操作日志
  onClick?: () => void;
  isSelected?: boolean;
}) {
  const role = ROLES[player.role];
  // P30:头像一直保留到死亡;死亡才变 💀;不再用 isYou 暴露 role.emoji(用户的角色在「档案面板」单独显示)
  const display = !player.alive ? '💀' : (player.avatar || '👤');
  // P23:privateMemory 加可选链 + 默认值
  const isSheriff = player.privateMemory?.isSheriff ?? false;
  // P1-#22 修复(用户反馈):狼人应该看到自己的队友
  const isMyWolfTeammate = !isYou && wolfTeammateSet?.has(player.id);
  // P30 修复(用户反馈):白天不允许行动者高亮,只有夜间才点亮(避免身份暴露)
  // isActing 仅在夜间作为行动者提示;白天 1 号被高亮的 bug 由此解决
  const showActingHighlight = isNight && isActing;
  return (
    <div className="relative flex flex-col items-center cursor-pointer transition-transform hover:scale-105"
      style={{ width: 72 }}
      onClick={onClick}
      title={lang === 'zh' ? '点击查看该玩家的发言' : 'Click to view this player\'s speeches'}>
      <div
        className={`w-14 h-14 rounded-full flex items-center justify-center text-2xl border-2 transition-all ${showActingHighlight ? 'animate-pulse' : ''}`}
        style={{
          background: player.alive
            ? (showActingHighlight ? 'rgba(250,204,21,0.25)' : (isSpeaking ? 'var(--color-accent-glow)' : 'var(--color-card-bg)'))
            : 'var(--color-bg-deep)',
          borderColor: isSelected ? '#22c55e'
            : isYou ? 'var(--color-accent)'
            : showActingHighlight ? '#facc15'
            : isSpeaking ? 'var(--color-accent)'
            : 'var(--color-border-light)',
          opacity: player.alive ? 1 : 0.4,
          boxShadow: isSelected ? '0 0 0 4px rgba(34,197,94,0.4)'
            : showActingHighlight
            ? '0 0 0 4px rgba(250,204,21,0.35), 0 0 16px rgba(250,204,21,0.5)'
            : (isSpeaking ? '0 0 0 4px var(--color-accent-glow)' : 'none'),
        }}
      >{display}</div>
      <div className="mt-1 text-[10px] font-medium truncate w-full text-center" style={{ color: player.alive ? 'var(--color-text)' : 'var(--color-text-muted)' }}>
        {player.id + 1}. {player.name}
        {/* P30:只对自己显示 role emoji(在名字右侧,极小字),不暴露给他人 */}
        {isYou && player.alive && (
          <span className="ml-0.5" title={role.name[lang]}>{role.emoji}</span>
        )}
      </div>
      {isYou && <div className="text-[9px] mt-0.5" style={{ color: 'var(--color-accent)' }}>{lang === 'zh' ? '你' : 'You'}</div>}
      {isSheriff && player.alive && (
        <div className="text-[9px] mt-0.5" title={lang === 'zh' ? '警长(1.5 票)' : 'Sheriff (1.5 votes)'} style={{ color: '#facc15' }}>⭐ {lang === 'zh' ? '警长' : 'Sheriff'}</div>
      )}
      {/* P1-#22: 显示狼队友(用户是狼时) */}
      {isMyWolfTeammate && player.alive && (
        <div className="text-[9px] mt-0.5" title={lang === 'zh' ? '你的狼队友' : 'Your wolf teammate'} style={{ color: '#dc2626' }}>🐺 {lang === 'zh' ? '队友' : 'Pack'}</div>
      )}
      {/* P1-#22: 用户手动标记 */}
      {userMark && (
        <div className="text-[9px] mt-0.5 px-1 rounded" style={{ background: 'rgba(99,102,241,0.2)', color: '#a78bfa' }}>
          ✏️ {userMark}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   发言气泡
   ═══════════════════════════════════════════════════════════════════ */

function SpeechBubble({ player, text, streaming, lang, phase, isCurrent }: {
  player: Player; text: string; streaming?: boolean; lang: 'zh' | 'en';
  phase?: 'night' | 'day' | 'pk' | 'last-words' | 'sheriff-speech';
  isCurrent?: boolean;
}) {
  const phaseLabel =
    phase === 'last-words' ? (lang === 'zh' ? '🕯️ 遗言' : '🕯️ Last')
    : phase === 'pk' ? (lang === 'zh' ? '⚔️ PK' : '⚔️ PK')
    : phase === 'sheriff-speech' ? (lang === 'zh' ? '⭐ 竞选' : '⭐ Sheriff')
    : phase === 'night' ? (lang === 'zh' ? '🌙 夜' : '🌙 Night')
    : null;
  // P12-B:长发言自动折叠,默认显示前 80 字 + "展开"按钮(防止气泡过高占用滚动条)
  const [expanded, setExpanded] = useState(false);
  const MAX_PREVIEW = 80;
  const isLong = text.length > MAX_PREVIEW;
  const displayText = !expanded && isLong ? text.slice(0, MAX_PREVIEW) + '…' : text;
  // P3-#A:当前发言用黄色脉冲边框 + 缩放
  const bubbleStyle: React.CSSProperties = isCurrent
    ? {
        background: 'rgba(250,204,21,0.08)',
        color: 'var(--color-text)',
        border: '2px solid #facc15',
        boxShadow: '0 0 12px rgba(250,204,21,0.4)',
        transform: 'scale(1.01)',
        transition: 'all 0.2s',
      }
    : phase === 'last-words'
      ? {
          background: 'rgba(107,114,128,0.12)',
          color: 'var(--color-text)',
          border: '1px solid #6b7280',
        }
      : phase === 'pk'
        ? {
            background: 'rgba(249,115,22,0.08)',
            color: 'var(--color-text)',
            border: '1px solid #f97316',
          }
        : phase === 'sheriff-speech'
          ? {
              background: 'rgba(250,204,21,0.08)',
              color: 'var(--color-text)',
              border: '1px solid #facc15',
            }
          : {
              background: 'var(--color-card-bg)',
              color: 'var(--color-text)',
              border: '1px solid var(--color-border-light)',
            };
  return (
    <div className={`flex gap-1.5 mb-1.5 animate-fade-in ${isCurrent ? 'animate-pulse' : ''}`}>
      <div className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-sm"
        style={{ background: 'var(--color-accent-glow)' }}>
        👤
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] mb-0.5 flex items-center gap-1 flex-wrap" style={{ color: 'var(--color-text-muted)' }}>
          <span className="font-semibold text-[11px]" style={{ color: 'var(--color-text)' }}>{player.id + 1}. {player.name}</span>
          <PersonalityRender id={player.personality} lang={lang} />
          {phaseLabel && (
            <span className="text-[9px] px-1 rounded" style={{
              background: 'var(--color-bg-deep)',
              color: phase === 'last-words' ? '#9ca3af' : phase === 'pk' ? '#f97316' : '#facc15',
            }}>{phaseLabel}</span>
          )}
          {isCurrent && (
            <span className="text-[9px] px-1 rounded animate-pulse" style={{ background: '#facc15', color: '#000' }}>
              🎙️ 发言中
            </span>
          )}
        </div>
        <div className="rounded-md px-2 py-1.5 text-[12px] leading-snug whitespace-pre-wrap" style={bubbleStyle}>
          {displayText || (streaming ? <span style={{ color: 'var(--color-text-muted)' }}>...</span> : '')}
          {streaming && <span className="inline-block ml-0.5 animate-pulse">▍</span>}
          {isLong && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="ml-1 text-[10px] underline opacity-80 hover:opacity-100"
              style={{ color: 'var(--color-accent)' }}
            >
              {expanded
                ? (lang === 'zh' ? '收起' : 'collapse')
                : (lang === 'zh' ? `展开全部 (${text.length}字)` : `expand (${text.length} chars)`)}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   顶层组件 —— 关键改进:游戏 state 同步到 sessionStorage
   ── 即使父组件(ToolPanel 模态)关闭,下次打开狼人杀时游戏状态会恢复
   ── 主动「退出游戏」时清空 sessionStorage
   ═══════════════════════════════════════════════════════════════════ */

const WEREWOLF_SAVE_KEY = 'ai-tools-launcher.werewolf.state.v1';

export function WerewolfGame() {
  const { lang: iLang } = useI18n();
  const lang = (iLang === 'en' ? 'en' : 'zh') as 'zh' | 'en';
  const [phase, setPhase] = useState<'select' | 'playing'>('select');
  /* 初始化时优先从 sessionStorage 恢复(避免关闭弹窗后状态全丢)
     P22:补齐每个 player 的 privateMemory 字段(防止代码升级后旧存档字段缺失导致崩) */
  const [state, setState] = useState<GameState | null>(() => {
    try {
      const raw = sessionStorage.getItem(WEREWOLF_SAVE_KEY);
      if (raw) {
        const s = JSON.parse(raw) as GameState;
        // 简单健全性检查
        if (s && s.boardId && Array.isArray(s.players) && s.players.length >= 5) {
          // 修复:旧存档可能缺字段,合并 defaultMemory
          const def = defaultMemory();
          const fixedPlayers = s.players.map(p => ({
            ...p,
            privateMemory: p.privateMemory ? { ...def, ...p.privateMemory } : { ...def },
          }));
          return { ...s, players: fixedPlayers };
        }
      }
    } catch { /* ignore */ }
    return null;
  });
  const [aiConfig, setAIConfig] = useState<ReturnType<typeof loadAIConfig>>(null);
  const [noKey, setNoKey] = useState(false);

  useEffect(() => {
    const cfg = loadAIConfig();
    setAIConfig(cfg);
    if (!cfg) setNoKey(true);
  }, []);

  /* 同步 state 到 sessionStorage —— P2-#26 修复:debounce 500ms 避免每次 setState 都写 */
  useEffect(() => {
    if (!state) {
      sessionStorage.removeItem(WEREWOLF_SAVE_KEY);
      return;
    }
    const timeoutId = setTimeout(() => {
      try {
        sessionStorage.setItem(WEREWOLF_SAVE_KEY, JSON.stringify(state));
      } catch { /* quota / 隐私模式 ignore */ }
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [state]);

  // 如果有恢复的 state,直接进入 playing
  useEffect(() => {
    if (state && phase === 'select') setPhase('playing');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  // P3-#41 修复:重玩当前板子
  const replayLastBoard = (lastBoardId: BoardId) => {
    const g = initGame(lastBoardId, lang === 'zh' ? '你' : 'You', lang);
    setState(g);
    setPhase('playing');
  };

  if (phase === 'select' || !state) {
    return <BoardSelect lang={lang} noKey={noKey}
      onStart={(boardId, spectatorMode) => {
        const g = initGame(boardId, lang === 'zh' ? '你' : 'You', lang, spectatorMode);
        setState(g);
        setPhase('playing');
      }} />;
  }
  if (noKey || !aiConfig) return <NoKeyWarn lang={lang} />;
  return <WerewolfErrorBoundary lang={lang} onExit={() => { setState(null); setPhase('select'); sessionStorage.removeItem(WEREWOLF_SAVE_KEY); }}>
    <GameRunner
      state={state}
      setState={setState}
      aiConfig={aiConfig}
      lang={lang}
      onExit={() => { setState(null); setPhase('select'); sessionStorage.removeItem(WEREWOLF_SAVE_KEY); }}
      onReplay={() => replayLastBoard(state.boardId)} />
  </WerewolfErrorBoundary>;
}

function BoardSelect({ lang, noKey, onStart }: {
  lang: 'zh' | 'en'; noKey: boolean; onStart: (boardId: BoardId, spectatorMode: boolean) => void;
}) {
  // P16:全 AI 观看模式 toggle(默认 false = 用户加入)
  const [spectatorMode, setSpectatorMode] = useState(false);
  return (
    <div className="space-y-4">
      <div className="rounded-xl p-4" style={{ background: 'var(--color-card-bg)', border: '1px solid var(--color-border-light)' }}>
        <div className="flex items-center gap-2 mb-2">
          <Drama size={20} style={{ color: 'var(--color-accent)' }} />
          <h2 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>{lang === 'zh' ? 'AI 狼人杀' : 'AI Werewolf'}</h2>
        </div>
        <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
          {lang === 'zh'
            ? '你是 1 个真人 + 5-11 个 LLM 玩家。系统随机分配角色,夜晚闭眼行动,白天发言投票,流式观看 AI 玩家斗智斗勇。'
            : 'You + 5-11 LLM players. Random role assignment, night actions, day speeches & voting.'}
        </p>
        {noKey && (
          <div className="mt-3 p-2 rounded text-xs flex items-start gap-2" style={{ background: 'rgba(220,38,38,0.1)', color: '#dc2626' }}>
            <AlertTriangle size={14} className="shrink-0 mt-0.5" />
            <div>{lang === 'zh' ? '未检测到 AI API Key,请先去「设置 → API Key 配置」添加至少一个 provider 的 key。' : 'No AI API key detected. Add one in Settings → API Key first.'}</div>
          </div>
        )}
      </div>
      {/* P16:观看模式 toggle */}
      <div className="rounded-xl p-3 flex items-center gap-3" style={{ background: 'var(--color-card-bg)', border: '1px solid var(--color-border-light)' }}>
        <label className="flex items-center gap-2 cursor-pointer select-none flex-1">
          <input
            type="checkbox"
            checked={spectatorMode}
            onChange={e => setSpectatorMode(e.target.checked)}
            style={{ width: 18, height: 18, accentColor: 'var(--color-accent)' }} />
          <span className="text-sm" style={{ color: 'var(--color-text)' }}>
            {lang === 'zh'
              ? '👀 全 AI 对局,我只观看(我不参与游戏,所有玩家都是 AI)'
              : '👀 AI-only match (spectator mode — all players are AI)'}
          </span>
        </label>
      </div>
      <div className="space-y-2">
        <h3 className="text-sm font-medium flex items-center gap-1.5" style={{ color: 'var(--color-text)' }}>
          <Sparkles size={14} style={{ color: 'var(--color-accent)' }} />{lang === 'zh' ? '选择板子' : 'Pick a board'}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {BOARD_LIST.map(b => {
            const isPlayable = b.variant !== 'coming-soon';
            return (
              <BoardCard key={b.id} board={b} lang={lang}
                disabled={!isPlayable || noKey}
                disabledReason={!isPlayable
                  ? (lang === 'zh' ? '该板子暂存中(P1-#22 暂存 4 个特殊板子),先玩 9 人预女猎 / 12 人预女猎白' : 'Parked (P1-#22: 4 special boards), try 9P 预女猎 / 12P 预女猎白')
                  : undefined}
                onSelect={() => onStart(b.id, spectatorMode)} />
            );
          })}
        </div>
      </div>
    </div>
  );
}

function NoKeyWarn({ lang }: { lang: 'zh' | 'en' }) {
  return (
    <div className="p-4 rounded-xl" style={{ background: 'rgba(220,38,38,0.1)', color: '#dc2626' }}>
      <div className="flex items-center gap-2">
        <AlertTriangle size={18} />
        <div className="text-sm">{lang === 'zh' ? '请先在「设置 → API Key 配置」中添加至少一个 provider 的 API key。' : 'Add an API key in Settings → API Key first.'}</div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   死人观战面板 — P5 修复:死亡用户在所有 phase 都能看到当前阶段
   ── 用户原话:"我死了以后游戏暂停了" —— 实际上游戏没暂停,但旧 UI 是静态的
   ── 现在显示:phase 名 + 当前进展("AI X 正在投票/发言…")+ "你是鬼,看着就行"
   ── 替换原本 DayVote 静态 "你已死亡" 面板
   ═══════════════════════════════════════════════════════════════════ */
function DeadSpectator({ state, lang, busyHint, progress, onExit }: {
  state: GameState; lang: 'zh' | 'en';
  busyHint?: string;
  /** P7-#B:可选进度(0-1),有的话显示进度条让用户看到游戏在动 */
  progress?: { current: number; total: number; label?: string };
  /** P11-A:死者退出按钮 */
  onExit?: () => void;
}) {
  const phaseLabel: Record<Phase, { zh: string; en: string }> = {
    setup: { zh: '初始化', en: 'Setup' },
    'role-reveal': { zh: '身份公布', en: 'Role Reveal' },
    night: { zh: '🌙 夜间行动', en: '🌙 Night' },
    'night-resolve': { zh: '夜间结算', en: 'Night Resolve' },
    'day-announce': { zh: '天亮了', en: 'Dawn' },
    'sheriff-election': { zh: '⭐ 警长竞选', en: '⭐ Sheriff Election' },
    'sheriff-pick-order': { zh: '警长选发言顺序', en: 'Sheriff Pick Order' },
    'knight-duel': { zh: '⚔️ 骑士决斗', en: '⚔️ Knight Duel' },
    'day-discuss': { zh: '🗣️ 白天讨论', en: '🗣️ Day Discussion' },
    'day-vote': { zh: '🗳️ 投票放逐', en: '🗳️ Vote' },
    'vote-results': { zh: '投票结果', en: 'Vote Results' },
    'pk-speech': { zh: '⚔️ PK 发言', en: '⚔️ PK Speech' },
    'pk-vote': { zh: 'PK 投票', en: 'PK Vote' },
    'hunter-shoot': { zh: '🏹 猎人开枪', en: '🏹 Hunter Shoot' },
    'idiot-flip': { zh: '🤪 白痴翻牌', en: '🤪 Idiot Flip' },
    'last-words': { zh: '🕯️ 遗言', en: '🕯️ Last Words' },
    'wolfking-pick': { zh: '👑 狼王带人', en: '👑 Wolf King Pick' },
    'sheriff-succession': { zh: '⭐ 警长传承', en: '⭐ Sheriff Succession' },
    judge: { zh: '法官', en: 'Judge' },
    gameover: { zh: '🏆 游戏结束', en: '🏆 Game Over' },
  };
  const aliveCount = state.players.filter(p => p.alive).length;
  const totalCount = state.players.length;
  const currentPhase = phaseLabel[state.phase];
  return (
    <div className="p-5 rounded-2xl text-center"
      style={{
        background: 'linear-gradient(135deg, rgba(107,114,128,0.18), rgba(107,114,128,0.06))',
        border: '1px solid #6b7280',
        boxShadow: 'inset 0 1px 4px rgba(0,0,0,0.2)',
      }}>
      <div className="text-5xl mb-2 opacity-80">💀</div>
      <div className="font-bold text-base mb-1.5" style={{ color: '#9ca3af' }}>
        {lang === 'zh' ? '你已死亡' : 'You are dead'}
      </div>
      <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium mb-2"
        style={{ background: 'rgba(99,102,241,0.18)', color: '#a78bfa' }}>
        {lang === 'zh' ? '📍 当前阶段' : '📍 Current'}：{currentPhase.zh}
      </div>
      <div className="text-xs flex items-center justify-center gap-2 mb-1" style={{ color: 'var(--color-text-muted)' }}>
        <span className="px-2 py-0.5 rounded" style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e' }}>
          👥 {aliveCount}/{totalCount}
        </span>
        <span>{lang === 'zh' ? '你是鬼,看着就行' : 'Spectate only'}</span>
      </div>
      {/* P11 修复:死亡后显示死者的回忆(让观战有参与感) */}
      {state.userId >= 0 && (() => {
        const u = state.players[state.userId];
        if (!u || u.alive) return null;
        const mem = u.privateMemory;
        const lines: string[] = [];
        if (u.role === 'seer' && mem.seerChecks.length) {
          lines.push(lang === 'zh'
            ? `🔮 你之前验过: ${mem.seerChecks.map(c => `${c.targetId + 1}号 → ${c.isWolf ? '狼' : '好人'}`).join('、')}`
            : `🔮 Your checks: ${mem.seerChecks.map(c => `#${c.targetId + 1} → ${c.isWolf ? 'wolf' : 'good'}`).join(', ')}`);
        }
        if (u.role === 'werewolf' || u.role === 'wolfking' || u.role === 'wolfbeauty') {
          if (mem.wolfTeammates.length) {
            lines.push(lang === 'zh'
              ? `🐺 你的狼队友: ${mem.wolfTeammates.map(id => `${id + 1}号`).join('、')}`
              : `🐺 Your pack: ${mem.wolfTeammates.map(id => `#${id + 1}`).join(', ')}`);
          }
        }
        if (u.role === 'witch') {
          if (mem.witchSavedId !== null) {
            lines.push(lang === 'zh'
              ? `💊 你用过解药救了 ${mem.witchSavedId + 1}号`
              : `💊 You saved #${mem.witchSavedId + 1} with antidote`);
          }
          if (mem.witchPoisonedId !== null) {
            lines.push(lang === 'zh'
              ? `☠️ 你用过毒药杀了 ${mem.witchPoisonedId + 1}号`
              : `☠️ You poisoned #${mem.witchPoisonedId + 1}`);
          }
        }
        if (u.role === 'cupid' && mem.cupidLinkedIds) {
          lines.push(lang === 'zh'
            ? `💘 你连的情侣: ${mem.cupidLinkedIds.map(id => `${id + 1}号`).join(' 和 ')}`
            : `💘 Lovers you linked: ${mem.cupidLinkedIds.map(id => `#${id + 1}`).join(' & ')}`);
        }
        if (u.role === 'guard' && mem.guardLastTargetId !== null) {
          lines.push(lang === 'zh'
            ? `🛡️ 你最后守了 ${mem.guardLastTargetId + 1}号`
            : `🛡️ Last guarded: #${mem.guardLastTargetId + 1}`);
        }
        if (lines.length === 0) return null;
        return (
          <div className="mt-2 text-left max-w-xs mx-auto">
            <div className="text-[10px] mb-1 font-medium" style={{ color: '#a78bfa' }}>
              {lang === 'zh' ? '🧠 你的回忆(死前已知)' : '🧠 What you knew'}
            </div>
            <div className="text-[11px] space-y-0.5 px-2 py-1.5 rounded" style={{
              background: 'rgba(99,102,241,0.08)',
              border: '1px solid rgba(99,102,241,0.2)',
              color: 'var(--color-text)',
            }}>
              {lines.map((l, i) => <div key={i}>{l}</div>)}
            </div>
          </div>
        );
      })()}
      {/* P7-#B:进度条 —— 显示讨论/投票进度,让用户清楚游戏在动 */}
      {progress && (
        <div className="mt-3 text-left">
          <div className="text-[10px] mb-1" style={{ color: '#a78bfa' }}>
            {progress.label ?? (lang === 'zh' ? `进度 ${progress.current}/${progress.total}` : `Progress ${progress.current}/${progress.total}`)}
          </div>
          <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(0,0,0,0.4)' }}>
            <div
              className="h-full transition-all duration-500"
              style={{
                width: `${Math.min(100, (progress.current / Math.max(1, progress.total)) * 100)}%`,
                background: 'linear-gradient(90deg, #a78bfa, #6366f1)',
                boxShadow: '0 0 8px rgba(99,102,241,0.5)',
              }}
            />
          </div>
        </div>
      )}
      {busyHint && (
        <div className="mt-2 text-[11px] px-2 py-1 rounded inline-block" style={{
          background: 'rgba(99,102,241,0.15)',
          color: '#a78bfa',
          animation: 'pulse 2s infinite',
        }}>
          {busyHint}
        </div>
      )}
      {/* P11-A:死者可以提前退出本局(不再被迫看完一整局) */}
      {onExit && state.phase !== 'gameover' && (
        <button
          onClick={() => {
            if (typeof window !== 'undefined' && window.confirm(
              lang === 'zh'
                ? '你已死亡。确认退出本局吗?(游戏状态会清除)'
                : 'You are dead. Exit this game? (State will be cleared)'
            )) onExit();
          }}
          className="mt-3 px-3 py-1.5 rounded text-[11px] transition-all hover:scale-105"
          style={{ background: 'rgba(107,114,128,0.25)', color: 'var(--color-text-muted)', border: '1px solid #6b7280' }}
        >
          {lang === 'zh' ? '🚪 退出本局' : '🚪 Leave game'}
        </button>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   游戏运行器 —— 完整循环
   ═══════════════════════════════════════════════════════════════════ */

/* P21:ErrorBoundary —— 防止游戏中某个 useEffect / render 抛错导致整个面板空白崩溃
   之前:任何组件 throw 都会被 React 18 默认行为白屏
   现在:捕获错误,显示堆栈(给 Claude 调试用),提供"重新开局"和"返回板子选择"按钮 */
class WerewolfErrorBoundary extends Component<
  { children: ReactNode; onExit: () => void; lang: 'zh' | 'en' },
  { error: Error | null; stack: string | null }
> {
  state = { error: null as Error | null, stack: null as string | null };
  static getDerivedStateFromError(error: Error) {
    return { error, stack: error.stack ?? null };
  }
  componentDidCatch(error: Error, info: { componentStack: string }) {
    // eslint-disable-next-line no-console
    console.error('[Werewolf ErrorBoundary]', error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div className="p-5 rounded-2xl" style={{ background: 'rgba(220,38,38,0.1)', border: '2px solid #dc2626' }}>
          <h2 className="text-xl font-black mb-2 flex items-center gap-2" style={{ color: '#dc2626' }}>
            💥 {this.props.lang === 'zh' ? '游戏崩溃' : 'Game Crashed'}
          </h2>
          <p className="text-sm mb-3" style={{ color: 'var(--color-text-muted)' }}>
            {this.props.lang === 'zh'
              ? '游戏过程中遇到了一个错误。请把下面的错误信息发给 Claude 以便修复。'
              : 'An error occurred during gameplay. Please share the error below with Claude.'}
          </p>
          <div className="text-xs p-2 rounded mb-3 overflow-auto" style={{
            background: 'var(--color-bg-deep)', color: '#dc2626',
            maxHeight: 200, fontFamily: 'monospace', whiteSpace: 'pre-wrap',
          }}>
            <div className="font-bold mb-1">{this.state.error.message}</div>
            {this.state.stack && <div className="text-[10px] opacity-80">{this.state.stack.slice(0, 1200)}</div>}
          </div>
          <div className="flex gap-2">
            <Button onClick={this.props.onExit}>
              {this.props.lang === 'zh' ? '返回板子选择' : 'Back to board'}
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function GameRunner({ state: initial, setState: setStateProp, aiConfig, lang, onExit, onReplay }: {
  state: GameState;
  setState: Dispatch<SetStateAction<GameState | null>>;
  aiConfig: NonNullable<ReturnType<typeof loadAIConfig>>;
  lang: 'zh' | 'en'; onExit: () => void; onReplay: () => void;
}) {
  // 内部 state 仅用于派生 UI(比如 streamingText),游戏 state 走 prop
  const [streamingText, setStreamingText] = useState<{ playerId: number; text: string } | null>(null);
  // P24:点击玩家头像后,右侧/中央显示该玩家的完整发言历史
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null);
  /* 当前夜晚正在行动的玩家 IDs(用于座位高亮)—— 仅对行动者(及其队友,如狼队)可见,平民看不到 */
  const [actingPlayerIds, setActingPlayerIds] = useState<number[]>([]);
  /* P2-#C:自爆 banner 提示(进入夜间高亮通知,3 秒后自动消失)
     用户原话:"不然我都不知道狼人自爆了" */
  const [selfDestructBanner, setSelfDestructBanner] = useState<{ name: string; ts: number } | null>(null);
  // 检测自爆事件(从 publicLog 增量里提取)
  const seenSelfDestructRef = useRef<number>(0);
  /* setState wrapper:把 (s:GameState) => GameState 形式适配到 prop 的 Dispatch<SetStateAction<GameState|null>>
     —— 子组件里都假设 state 非 null,这里用 prev ? u(prev) : prev 兜底(理论上 prop 永远非 null)
     P22+:每次 setState 后强制 sanitize players 的 privateMemory(防止任何路径漏字段) */
  const defMem = defaultMemory();
  const setState = (u: (s: GameState) => GameState) =>
    setStateProp((prev) => {
      if (!prev) return prev;
      const next = u(prev);
      // sanitize:每个 player 的 privateMemory + avatar 都补齐缺失字段
      const sanitizedPlayers = next.players.map(p => {
        if (!p.privateMemory) return { ...p, privateMemory: { ...defMem }, avatar: p.avatar || '👤' };
        // 用 spread merge 兜底所有缺失字段
        const merged = { ...defMem, ...p.privateMemory };
        // 数组字段如果缺失,用 [] 补
        if (!Array.isArray(merged.wolfTeammates)) merged.wolfTeammates = [];
        if (!Array.isArray(merged.seerChecks)) merged.seerChecks = [];
        if (!Array.isArray(merged.guardHistory)) merged.guardHistory = [];
        if (!Array.isArray(merged.gargoyleChecks)) merged.gargoyleChecks = [];
        return { ...p, privateMemory: merged, avatar: p.avatar || '👤' };
      });
      return { ...next, players: sanitizedPlayers };
    });
  // P22+:用 useMemo 在每次 render 时也兜底 sanitize(防止 setState 没经过 wrapper 的边界情况)
  const defMemRender = defaultMemory();
  const state = useMemo(() => {
    if (!initial) return initial;
    const sanitizedPlayers = initial.players.map(p => {
      if (!p.privateMemory) return { ...p, privateMemory: { ...defMemRender }, avatar: p.avatar || '👤' };
      const merged = { ...defMemRender, ...p.privateMemory };
      if (!Array.isArray(merged.wolfTeammates)) merged.wolfTeammates = [];
      if (!Array.isArray(merged.seerChecks)) merged.seerChecks = [];
      if (!Array.isArray(merged.guardHistory)) merged.guardHistory = [];
      if (!Array.isArray(merged.gargoyleChecks)) merged.gargoyleChecks = [];
      return { ...p, privateMemory: merged, avatar: p.avatar || '👤' };
    });
    return { ...initial, players: sanitizedPlayers };
  }, [initial]);

  const alivePlayers = state.players.filter(p => p.alive);
  const winner = checkWinner(state);

  // P1-#22 修复(用户反馈):狼人应该能看到自己的队友
  // 如果用户自己是狼,把这个用户的狼队友 ID 集合传给 PlayerSeat 显示 🐺 标记
  const userP = state.players[state.userId];
  const userWolfTeammates: Set<number> = useMemo(
    () => new Set(userP?.faction === 'wolf' ? userP.privateMemory.wolfTeammates : []),
    [userP?.id, userP?.privateMemory.wolfTeammates]
  );

  useEffect(() => {
    if (winner) setState(s => ({ ...s, phase: 'gameover' }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [winner]);

  /* P2-#C:检测最新自爆事件,在顶部 + InfoStream 顶部显示高亮 banner(3 秒后自动消失) */
  useEffect(() => {
    // 只看新增的 system 事件(从 seenSelfDestructRef 起)
    const log = state.publicLog;
    for (let i = seenSelfDestructRef.current; i < log.length; i++) {
      const e = log[i];
      if (e.kind === 'system' && e.text.includes('狼人自爆')) {
        // 提取狼名:从 "💥 X号 狼人自爆..." 抽取
        const m = e.text.match(/(\d+)号\s*([^ 　]+?)\s*狼人自爆/);
        if (m) {
          const num = m[1];
          const name = m[2];
          setSelfDestructBanner({ name: `${num}号 ${name}`, ts: Date.now() });
        } else {
          setSelfDestructBanner({ name: '某狼', ts: Date.now() });
        }
        break;
      }
    }
    seenSelfDestructRef.current = log.length;
  }, [state.publicLog.length]);

  useEffect(() => {
    if (!selfDestructBanner) return;
    const tid = window.setTimeout(() => setSelfDestructBanner(null), 4000);
    return () => clearTimeout(tid);
  }, [selfDestructBanner?.ts]);

  /* aiSpeak 返回 {speech, target} —— 让调用方(夜晚行动/投票)能直接拿到 target,
     避免「读 state.speeches[length-1]」的闭包过时问题。
     target 是 0-based 座位号,null 表示无目标。
     P0-#4 修复:用 parseAIDecisionToTargetId 正确处理 decision=0(显式无目标)。 */
  const aiSpeak = async (
    playerId: number,
    systemPrompt: string,
    userPrompt: string,
    silent: boolean = false,
    options?: { temperature?: number; maxTokens?: number },
  ): Promise<{ speech: string; target: number | null; useAntidote?: boolean }> => {
    let full = '';
    setStreamingText({ playerId, text: '' });
    const h = callAIStream(aiConfig, systemPrompt, userPrompt, (chunk: string) => {
      full += chunk;
      if (!silent) setStreamingText({ playerId, text: full });
    }, options);
    const text = await h.promise;
    if (silent) setStreamingText(null);
    // 先尝试从 JSON 包装里抽取 speech + target
    const parsed = parseAIDecision(text);
    let speech = (parsed.speech || '').trim();
    if (!speech) {
      // 没 JSON,或者 JSON 里没 speech → 用 tryJsonExtract 再试一次
      const extracted = tryJsonExtract(text);
      speech = (extracted.speech || text || '').trim();
    }
    if (!silent) {
      setStreamingText(null);
      setState(s => ({
        ...s,
        speeches: [...s.speeches, { playerId, day: s.round, text: speech }],
        publicLog: [...s.publicLog, { kind: 'speech', day: s.round, playerId, text: speech }],
      }));
    }
    // P0-#4 修复:decision=0 显式无目标(返回 null),decision 在 [1, N] 才是合法目标
    const target = parseAIDecisionToTargetId(parsed.decision, initial.players.length);
    return { speech, target };
  };

  // 座位分栏:9 人 → 左 6 / 右 3;12 人 → 左 6 / 右 6
  const leftIds = state.players.slice(0, Math.ceil(state.players.length / 2));
  const rightIds = state.players.slice(Math.ceil(state.players.length / 2));

  return (
    <div className="space-y-3">
      {/* P16:全 AI 观看模式 banner */}
      {state.spectatorMode && (
        <div
          className="p-3 rounded-xl flex items-center justify-center gap-2"
          style={{
            background: 'linear-gradient(90deg, rgba(99,102,241,0.15), rgba(99,102,241,0.3), rgba(99,102,241,0.15))',
            border: '2px solid var(--color-accent)',
            boxShadow: '0 0 15px rgba(99,102,241,0.3)',
          }}
        >
          <Drama size={18} style={{ color: 'var(--color-accent)' }} />
          <span className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
            {lang === 'zh'
              ? '👀 观看模式 · 你不在游戏中,所有玩家都是 AI'
              : '👀 Spectator mode — you\'re not in the game, all players are AI'}
          </span>
        </div>
      )}
      {/* P2-#C:自爆高亮 banner —— 进入夜间模式提示(用户原话"不然我都不知道狼人自爆了") */}
      {selfDestructBanner && (
        <div
          className="p-3 rounded-xl flex items-center justify-center gap-2 animate-pulse"
          style={{
            background: 'linear-gradient(90deg, rgba(220,38,38,0.25), rgba(220,38,38,0.5), rgba(220,38,38,0.25))',
            border: '2px solid #dc2626',
            boxShadow: '0 0 20px rgba(220,38,38,0.4)',
          }}
        >
          <span className="text-2xl">💥</span>
          <div className="text-center">
            <div className="text-base font-bold" style={{ color: '#dc2626' }}>
              {lang === 'zh' ? `🐺 ${selfDestructBanner.name} 狼人自爆!` : `🐺 ${selfDestructBanner.name} Wolf Self-Destruct!`}
            </div>
            <div className="text-xs" style={{ color: 'var(--color-text)' }}>
              {lang === 'zh' ? '🌙 立即进入夜间模式' : '🌙 Entering Night Mode'}
            </div>
          </div>
          <span className="text-2xl">🌙</span>
        </div>
      )}

      {/* 顶部信息条 —— P12-C:更醒目、更详细 */}
      <div className="flex items-center justify-between p-3.5 rounded-xl"
        style={{
          background: 'linear-gradient(135deg, var(--color-card-bg) 0%, var(--color-bg-deep) 100%)',
          border: '1px solid var(--color-accent)',
          boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
        }}>
        <div className="flex items-center gap-3">
          <div className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-xl"
            style={{ background: 'var(--color-accent-glow)' }}>
            <Drama size={22} style={{ color: 'var(--color-accent)' }} />
          </div>
          <div>
            <div className="text-base font-bold flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
              {BOARDS[state.boardId].name[lang]}
              <span className="text-xs px-1.5 py-0.5 rounded font-medium"
                style={{ background: 'var(--color-accent)', color: '#fff' }}>
                {lang === 'zh' ? `第 ${state.round} 轮` : `R${state.round}`}
              </span>
            </div>
            <div className="text-[11px] mt-0.5 flex items-center gap-2" style={{ color: 'var(--color-text-muted)' }}>
              <span>👥 {lang === 'zh' ? '存活' : 'Alive'} {alivePlayers.length}/{state.players.length}</span>
              {/* P16:观看模式下不显示用户身份(没有用户) */}
              {!state.spectatorMode && state.userId >= 0 && (
                <>
                  <span style={{ color: 'var(--color-border-light)' }}>·</span>
                  <span>{ROLES[state.players[state.userId].role].emoji} {ROLES[state.players[state.userId].role].name[lang]}</span>
                  <span style={{ color: 'var(--color-border-light)' }}>·</span>
                  <span>{state.players[state.userId].name}</span>
                </>
              )}
            </div>
          </div>
        </div>
        <button onClick={onExit} title={lang === 'zh' ? '退出游戏' : 'Exit game'}
          className="shrink-0 p-2 rounded-lg transition-colors hover:bg-black/20"
          style={{ background: 'var(--color-card-bg)', border: '1px solid var(--color-border-light)' }}>
          <X size={16} style={{ color: 'var(--color-text-muted)' }} />
        </button>
      </div>

      {/* 左右分栏主区域 */}
      <div className="grid grid-cols-2 gap-3">
        {/* 左侧:座位(竖排) + 当前阶段 UI */}
        <div className="space-y-2">
          <div className="p-2 rounded-xl" style={{ background: 'var(--color-card-bg)', border: '1px solid var(--color-border-light)' }}>
            <div className="grid grid-cols-2 gap-1.5">
              {/* 左列 */}
              <div className="flex flex-col gap-1.5">
                {leftIds.map(p => (
                  <PlayerSeat key={p.id} player={p}
                    isYou={p.id === state.userId}
                    isSpeaking={streamingText?.playerId === p.id}
                    isActing={actingPlayerIds.includes(p.id)}
                    isNight={state.phase === 'night'}  // P30:白天不高亮行动者
                    lang={lang}
                    userMark={state.userMarks?.[p.id]}
                    wolfTeammateSet={userWolfTeammates}
                    onClick={() => setSelectedPlayerId(selectedPlayerId === p.id ? null : p.id)}
                    isSelected={selectedPlayerId === p.id} />
                ))}
              </div>
              {/* 右列 */}
              <div className="flex flex-col gap-1.5">
                {rightIds.map(p => (
                  <PlayerSeat key={p.id} player={p}
                    isYou={p.id === state.userId}
                    isSpeaking={streamingText?.playerId === p.id}
                    isActing={actingPlayerIds.includes(p.id)}
                    isNight={state.phase === 'night'}  // P30:白天不高亮行动者
                    lang={lang}
                    userMark={state.userMarks?.[p.id]}
                    wolfTeammateSet={userWolfTeammates}
                    onClick={() => setSelectedPlayerId(selectedPlayerId === p.id ? null : p.id)}
                    isSelected={selectedPlayerId === p.id} />
                ))}
              </div>
            </div>
          </div>
          {/* 当前阶段 UI */}
          {/* P24:点击玩家头像后,显示该玩家的完整档案(发言历史 + 关键操作) */}
          {selectedPlayerId !== null && state.players[selectedPlayerId] && (
            <PlayerProfile state={state} playerId={selectedPlayerId} lang={lang}
              onClose={() => setSelectedPlayerId(null)} />
          )}
          {state.phase === 'role-reveal' && <RoleRevealPanel state={state} lang={lang} onContinue={() => setState(s => ({ ...s, phase: 'night', round: s.round + 1 }))} />}
          {state.phase === 'night' && <NightPanel state={state} setState={setState} lang={lang} aiSpeak={aiSpeak} onActingChange={setActingPlayerIds} onExit={onExit} />}
          {state.phase === 'last-words' && <LastWords state={state} setState={setState} lang={lang} aiSpeak={aiSpeak} />}
          {state.phase === 'day-announce' && <DayAnnounce state={state} setState={setState} lang={lang} />}
          {state.phase === 'sheriff-election' && <SheriffElection state={state} setState={setState} lang={lang} aiSpeak={aiSpeak} onExit={onExit} />}
          {state.phase === 'day-discuss' && <DayDiscuss state={state} setState={setState} lang={lang} aiSpeak={aiSpeak} onExit={onExit} />}
          {state.phase === 'day-vote' && <DayVote state={state} setState={setState} lang={lang} aiSpeak={aiSpeak} onExit={onExit} />}
          {state.phase === 'vote-results' && <VoteResults state={state} setState={setState} lang={lang} />}
          {state.phase === 'pk-speech' && <PKSpeech state={state} setState={setState} lang={lang} aiSpeak={aiSpeak} />}
          {state.phase === 'pk-vote' && <PKVote state={state} setState={setState} lang={lang} aiSpeak={aiSpeak} />}
          {state.phase === 'hunter-shoot' && <HunterShoot state={state} setState={setState} lang={lang} aiSpeak={aiSpeak} />}
          {state.phase === 'idiot-flip' && <IdiotFlip state={state} setState={setState} lang={lang} aiSpeak={aiSpeak} />}
          {state.phase === 'wolfking-pick' && <WolfKingPick state={state} setState={setState} lang={lang} aiSpeak={aiSpeak} />}
          {state.phase === 'sheriff-succession' && <SheriffSuccession state={state} setState={setState} lang={lang} aiSpeak={aiSpeak} />}
        </div>

        {/* 右侧:信息流(发言 + 法官 + 死亡 + 投票,可滚动) */}
        <div className="space-y-2">
          <MarkPanel state={state} setState={setState} lang={lang} />
          <InfoStream state={state} lang={lang} streamingText={streamingText} />
        </div>
      </div>

      {state.phase === 'gameover' && winner && <GameOver state={state} winner={winner} lang={lang} onExit={onExit} onReplay={onReplay} />}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   身份标记面板 (P1-#22 修复:用户可手动标记身份)
   ── 纯笔记,不影响游戏逻辑
   ═══════════════════════════════════════════════════════════════════ */
function MarkPanel({ state, setState, lang }: {
  state: GameState; setState: (u: (s: GameState) => GameState) => void; lang: 'zh' | 'en';
}) {
  const [open, setOpen] = useState(false);
  const [targetId, setTargetId] = useState<number | null>(null);
  const marks = state.userMarks || {};
  const markOptions = lang === 'zh'
    ? ['狼', '好人', '预言家', '女巫', '守卫', '猎人', '骑士', '白痴', '丘比特', '石像鬼', '存疑']
    : ['wolf', 'good', 'seer', 'witch', 'guard', 'hunter', 'knight', 'idiot', 'cupid', 'gargoyle', 'unsure'];

  return (
    <div className="mb-2 p-2 rounded" style={{ background: 'var(--color-bg-deep)', border: '1px solid var(--color-border-light)' }}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full text-left text-[10px] font-semibold flex items-center justify-between"
        style={{ color: '#a78bfa' }}
      >
        <span>✏️ {lang === 'zh' ? '身份标记' : 'Identity marks'} ({Object.keys(marks).length})</span>
        <span>{open ? '▼' : '▶'}</span>
      </button>
      {open && (
        <div className="mt-2 space-y-1.5">
          {Object.entries(marks).map(([id, mark]) => {
            const pid = parseInt(id, 10);
            const p = state.players[pid];
            if (!p || !p.alive) return null;
            return (
              <div key={id} className="flex items-center gap-1 text-[10px]">
                <span style={{ color: 'var(--color-text)' }}>{pid + 1}.{p.name}</span>
                <span className="px-1 rounded" style={{ background: 'rgba(99,102,241,0.2)', color: '#a78bfa' }}>{mark}</span>
                <button
                  onClick={() => setState(s => {
                    const newMarks = { ...(s.userMarks || {}) };
                    delete newMarks[pid];
                    return { ...s, userMarks: newMarks };
                  })}
                  className="text-[9px] px-1 rounded"
                  style={{ background: 'rgba(220,38,38,0.2)', color: '#dc2626' }}
                >
                  {lang === 'zh' ? '清除' : 'Clear'}
                </button>
              </div>
            );
          })}
          <div className="border-t pt-1.5" style={{ borderColor: 'var(--color-border-light)' }}>
            <div className="text-[10px] mb-1" style={{ color: 'var(--color-text-muted)' }}>
              {lang === 'zh' ? '选玩家标记:' : 'Select player to mark:'}
            </div>
            <div className="flex flex-wrap gap-1">
              {state.players.filter(p => p.alive && p.id !== state.userId).map(p => (
                <button
                  key={p.id}
                  onClick={() => setTargetId(p.id)}
                  className="px-1.5 py-0.5 rounded text-[10px]"
                  style={{
                    background: targetId === p.id ? 'var(--color-accent)' : 'var(--color-card-bg)',
                    color: targetId === p.id ? '#fff' : 'var(--color-text)',
                  }}
                >
                  {p.id + 1}.{p.name}
                </button>
              ))}
            </div>
            {targetId !== null && (
              <div className="mt-1.5">
                <div className="text-[10px] mb-1" style={{ color: 'var(--color-text-muted)' }}>
                  {lang === 'zh' ? '选身份:' : 'Choose identity:'}
                </div>
                <div className="flex flex-wrap gap-1">
                  {markOptions.map(opt => (
                    <button
                      key={opt}
                      onClick={() => {
                        setState(s => ({
                          ...s,
                          userMarks: { ...(s.userMarks || {}), [targetId!]: opt },
                        }));
                        setTargetId(null);
                      }}
                      className="px-1.5 py-0.5 rounded text-[10px]"
                      style={{ background: 'rgba(99,102,241,0.2)', color: '#a78bfa' }}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   右侧信息流(发言 + 法官字幕 + 死亡 + 投票结果,可上下滑动)
   ═══════════════════════════════════════════════════════════════════ */

function InfoStream({ state, lang, streamingText }: {
  state: GameState; lang: 'zh' | 'en';
  streamingText: { playerId: number; text: string } | null;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // P3-#A 修复:当前发言气泡的 ref(用于 scrollIntoView)
  const currentBubbleRef = useRef<HTMLDivElement>(null);
  // 自动滚到底 + 当前发言气泡滚到可视中央
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [state.publicLog.length, state.speeches.length, streamingText]);
  useEffect(() => {
    // 当前发言变化时,把这个气泡 scrollIntoView
    if (currentBubbleRef.current) {
      currentBubbleRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [streamingText?.playerId, streamingText?.text]);

  // 死亡记录
  const deaths = state.publicLog.filter(e => e.kind === 'death');
  // 法官字幕(系统消息)
  const systemEvents = state.publicLog.filter(e => e.kind === 'system');
  // 投票放逐记录
  const exiles = state.publicLog.filter(e => e.kind === 'death' && e.text.startsWith('🗳️'));
  // P1-#48 修复:今日 claim 面板
  const todayClaims = state.claims?.[state.round];
  // P3-#A:当前正在发言的玩家 ID(用于高亮)
  const currentSpeakerId = streamingText?.playerId ?? null;

  // P12-A:每个分区可折叠 —— 发言流默认展开,其他默认折叠以减少滚动
  // 使用 useState 数组,每个 index 对应一个区
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    speeches: true,
    system: true,
    deaths: false,
    exiles: false,
    claims: false,
    voteDetail: true,
    voteHistory: false,
  });
  const toggleSection = (key: string) => setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));

  /* P12-A 通用分区组件:header 可点击切换展开/折叠 */
  const Section = ({ id, icon, label, count, color, children, defaultOpen = false }: {
    id: string; icon: string; label: string; count?: number;
    color: string; children: React.ReactNode; defaultOpen?: boolean;
  }) => {
    const isOpen = openSections[id] ?? defaultOpen;
    return (
      <div className="rounded-lg overflow-hidden" style={{ background: 'var(--color-bg-deep)', border: '1px solid var(--color-border-light)' }}>
        <button
          onClick={() => toggleSection(id)}
          className="w-full px-2.5 py-1.5 flex items-center justify-between text-left transition-colors hover:bg-black/10"
        >
          <span className="text-[11px] font-semibold flex items-center gap-1.5" style={{ color }}>
            <span>{icon}</span>
            <span>{label}</span>
            {count !== undefined && count > 0 && (
              <span className="text-[9px] px-1 rounded-full" style={{ background: 'rgba(255,255,255,0.15)' }}>
                {count}
              </span>
            )}
          </span>
          <span className="text-[10px] transition-transform" style={{ transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)', color: 'var(--color-text-muted)' }}>
            ▶
          </span>
        </button>
        {isOpen && <div className="px-2 pb-2 pt-1 space-y-1">{children}</div>}
      </div>
    );
  };

  return (
    <div ref={ref} className="p-2.5 rounded-xl space-y-2 overflow-y-auto"
      style={{
        background: 'var(--color-card-bg)', border: '1px solid var(--color-border-light)',
        maxHeight: 'calc(100vh - 180px)', minHeight: 400,
      }}>
      {/* 发言流 —— 默认展开,玩家最关心 */}
      <Section id="speeches" icon="🗣️" label={lang === 'zh' ? '发言' : 'Speeches'}
        count={state.speeches.length} color="var(--color-text-muted)" defaultOpen={true}>
        {state.speeches.slice(-20).map((sp, i) => {
          const p = state.players[sp.playerId];
          const isCurrent = currentSpeakerId === sp.playerId;
          return (
            <div key={i} ref={isCurrent ? currentBubbleRef : undefined}>
              <SpeechBubble
                player={p}
                text={sp.text}
                lang={lang}
                phase={sp.phase}
                isCurrent={isCurrent}
              />
            </div>
          );
        })}
        {streamingText && (
          <div ref={currentSpeakerId === streamingText.playerId ? currentBubbleRef : undefined}>
            <SpeechBubble player={state.players[streamingText.playerId]} text={streamingText.text}
              streaming lang={lang}
              phase="day"
              isCurrent={true} />
          </div>
        )}
      </Section>

      {/* 法官字幕(系统事件) */}
      {systemEvents.length > 0 && (
        <Section id="system" icon="⚖️" label={lang === 'zh' ? '法官信息' : 'Judge'}
          count={systemEvents.length} color="var(--color-accent)" defaultOpen={true}>
          {systemEvents.slice(-10).map((e, i) => (
            <div key={i} className="text-[11px] py-1 px-2 rounded text-[11px]"
              style={{ background: 'var(--color-card-bg)', color: 'var(--color-text-muted)' }}>
              {e.text}
            </div>
          ))}
        </Section>
      )}

      {/* 死亡记录 */}
      {deaths.length > 0 && (
        <Section id="deaths" icon="💀" label={lang === 'zh' ? '死亡记录' : 'Deaths'}
          count={deaths.length} color="#dc2626">
          {deaths.slice(-10).map((e, i) => (
            <div key={i} className="text-[11px] py-1 px-2 rounded flex items-center gap-1.5"
              style={{ background: 'rgba(220,38,38,0.08)', color: 'var(--color-text)' }}>
              {e.text}
            </div>
          ))}
        </Section>
      )}

      {/* 投票放逐 */}
      {exiles.length > 0 && (
        <Section id="exiles" icon="🗳️" label={lang === 'zh' ? '投票放逐' : 'Exile'}
          count={exiles.length} color="#a855f7">
          {exiles.slice(-5).map((e, i) => (
            <div key={i} className="text-[11px] py-1 px-2 rounded"
              style={{ background: 'rgba(168,85,247,0.08)', color: 'var(--color-text)' }}>
              {e.text}
            </div>
          ))}
        </Section>
      )}

      {/* 今日身份声明 */}
      {todayClaims && (todayClaims.seerClaims.length > 0 || todayClaims.witchClaims.length > 0 || todayClaims.guardClaims.length > 0) && (
        <Section id="claims" icon="📜" label={lang === 'zh' ? '今日身份声明' : "Today's claims"}
          count={(todayClaims.seerClaims?.length || 0) + (todayClaims.witchClaims?.length || 0) + (todayClaims.guardClaims?.length || 0)}
          color="#a855f7" defaultOpen={true}>
          {todayClaims.seerClaims?.map(c => (
            <div key={`seer-${c.playerId}`} className="text-[11px] py-1 px-2 rounded" style={{ background: 'rgba(99,102,241,0.1)', color: 'var(--color-text)' }}>
              🔮 <b>{c.playerId + 1}号 {state.players[c.playerId].name}</b> {lang === 'zh' ? '跳预言家:' : 'claims seer:'} {c.checks.map(x => `${x.targetId + 1}号=${x.isWolf ? (lang === 'zh' ? '狼' : 'wolf') : (lang === 'zh' ? '好人' : 'good')}`).join('、')}
            </div>
          ))}
          {todayClaims.witchClaims?.map(c => (
            <div key={`witch-${c.playerId}`} className="text-[11px] py-1 px-2 rounded" style={{ background: 'rgba(168,85,247,0.1)', color: 'var(--color-text)' }}>
              💊 <b>{c.playerId + 1}号 {state.players[c.playerId].name}</b> {lang === 'zh' ? '跳女巫:' : 'claims witch:'} {c.savedId !== null ? `${lang === 'zh' ? '救了' : 'saved'} ${c.savedId + 1}号` : ''} {c.poisonedId !== null ? `${lang === 'zh' ? ', 毒了' : ', poisoned'} ${c.poisonedId + 1}号` : ''}
            </div>
          ))}
          {todayClaims.guardClaims?.map(c => (
            <div key={`guard-${c.playerId}`} className="text-[11px] py-1 px-2 rounded" style={{ background: 'rgba(34,197,94,0.1)', color: 'var(--color-text)' }}>
              🛡️ <b>{c.playerId + 1}号 {state.players[c.playerId].name}</b> {lang === 'zh' ? '跳守卫:' : 'claims guard:'} {c.guardedId !== null ? `${lang === 'zh' ? '守了' : 'guarded'} ${c.guardedId + 1}号` : (lang === 'zh' ? '空守' : 'no guard')}
            </div>
          ))}
        </Section>
      )}

      {/* 最近一次投票详情 */}
      {state.lastVoteData && state.lastVoteData.allVotes.length > 0 && (
        <Section id="voteDetail" icon="📊" label={lang === 'zh' ? '最近一次投票' : 'Latest vote'}
          count={state.lastVoteData.allVotes.length} color="#a855f7">
          {state.lastVoteData.allVotes.map((v, i) => {
            const voter = state.players[v.voterId];
            const target = state.players[v.targetId];
            if (!voter || !target) return null;
            const isUserVoter = v.voterId === state.userId;
            // P22 防御:voter.privateMemory 可能缺失(sessionStorage 旧存档)
            const isSheriffVoter = voter.privateMemory?.isSheriff ?? false;
            const weight = isSheriffVoter ? 1.5 : 1;
            return (
              <div key={i} className="text-[11px] flex items-center gap-1 px-1.5 py-0.5 rounded"
                style={{ background: isUserVoter ? 'rgba(168,85,247,0.12)' : 'transparent' }}>
                <span style={{ color: isUserVoter ? '#a855f7' : 'var(--color-text)' }}>
                  {voter.id + 1}.{voter.name}
                </span>
                <span style={{ color: 'var(--color-text-muted)' }}>→</span>
                <span style={{ color: '#a855f7' }}>{target.id + 1}.{target.name}</span>
                {isSheriffVoter && (
                  <span className="text-[9px]" style={{ color: '#facc15' }} title={lang === 'zh' ? '警长 1.5 票' : 'Sheriff 1.5x'}>⭐</span>
                )}
                <span className="text-[9px] ml-auto" style={{ color: 'var(--color-text-muted)' }}>
                  ({weight}{lang === 'zh' ? '票' : 'x'})
                </span>
              </div>
            );
          })}
          {/* 票数统计 */}
          <div className="text-[9px] flex flex-wrap gap-1.5 px-1 pt-1">
            {Object.entries(state.lastVoteData.tally).map(([id, count]) => {
              const pid = parseInt(id, 10);
              const target = state.players[pid];
              if (!target) return null;
              const isExiled = state.lastVoteData?.exiled === pid;
              return (
                <span key={id} className="px-1.5 py-0.5 rounded"
                  style={{
                    background: isExiled ? 'rgba(220,38,38,0.2)' : 'var(--color-card-bg)',
                    color: isExiled ? '#dc2626' : 'var(--color-text)',
                    fontWeight: isExiled ? 'bold' : 'normal',
                  }}>
                  {target.name}: {count}{lang === 'zh' ? '票' : ' votes'}
                </span>
              );
            })}
          </div>
        </Section>
      )}

      {/* 每轮投票历史 */}
      {state.voteHistory && state.voteHistory.length > 0 && (
        <Section id="voteHistory" icon="📈" label={lang === 'zh' ? `投票历史` : 'Vote history'}
          count={state.voteHistory.length} color="#a855f7">
          {state.voteHistory.slice(-5).map((round, idx) => {
            const targetGroups: Record<number, number[]> = {};
            round.allVotes.forEach(v => {
              if (!targetGroups[v.targetId]) targetGroups[v.targetId] = [];
              targetGroups[v.targetId].push(v.voterId);
            });
            const sortedGroups = Object.entries(targetGroups)
              .map(([tid, voters]) => ({ targetId: parseInt(tid, 10), voters, count: voters.length }))
              .sort((a, b) => b.count - a.count);
            return (
              <div key={idx} className="mb-2 p-2 rounded text-[10px]"
                style={{ background: 'var(--color-card-bg)', border: '1px solid rgba(168,85,247,0.2)' }}>
                <div className="flex items-center gap-1 mb-1 font-semibold" style={{ color: '#a78bfa' }}>
                  {lang === 'zh' ? `第 ${round.round} 轮` : `Round ${round.round}`}
                  {round.exiled !== null && state.players[round.exiled] && (
                    <span className="ml-1 px-1 rounded" style={{ background: 'rgba(220,38,38,0.2)', color: '#dc2626' }}>
                      💀 {state.players[round.exiled].id + 1}号 被投出
                    </span>
                  )}
                </div>
                <div className="space-y-0.5">
                  {sortedGroups.map(g => {
                    const target = state.players[g.targetId];
                    if (!target) return null;
                    const voterNames = g.voters.map(vid => {
                      const voter = state.players[vid];
                      const isSheriff = voter?.privateMemory?.isSheriff ?? false;
                      return `${vid + 1}号${isSheriff ? '⭐' : ''}`;
                    }).join('+');
                    return (
                      <div key={g.targetId} className="flex items-center gap-1">
                        <span style={{ color: 'var(--color-text-muted)' }}>→</span>
                        <span className="font-semibold" style={{ color: 'var(--color-text)' }}>{target.id + 1}号</span>
                        <span style={{ color: 'var(--color-text-muted)' }}>({g.count}{lang === 'zh' ? '票' : 'v'})</span>
                        <span style={{ color: '#a78bfa' }}>← {voterNames}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </Section>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   角色公布
   ═══════════════════════════════════════════════════════════════════ */

function RoleRevealPanel({ state, lang, onContinue }: { state: GameState; lang: 'zh' | 'en'; onContinue: () => void }) {
  // P17:观看模式(userId=-1)显示所有玩家角色,而不是崩溃
  if (state.spectatorMode || state.userId < 0) {
    return (
      <div className="p-5 rounded-xl" style={{ background: 'var(--color-card-bg)', border: '1px solid var(--color-accent)' }}>
        <div className="text-center mb-3">
          <div className="text-2xl mb-1">👁️</div>
          <h3 className="text-lg font-bold" style={{ color: 'var(--color-text)' }}>
            {lang === 'zh' ? '观看模式 · 角色分配' : 'Spectator mode · Role assignment'}
          </h3>
          <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
            {lang === 'zh' ? '所有 12 位 AI 的角色已揭晓' : 'All 12 AI roles revealed'}
          </p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 mb-3">
          {state.players.map(p => {
            const role = ROLES[p.role];
            const factionColor = role.faction === 'wolf' ? '#dc2626' : role.faction === 'good' ? '#22c55e' : '#a855f7';
            return (
              <div key={p.id} className="rounded-lg p-2 text-xs flex items-center gap-1.5"
                style={{ background: 'var(--color-bg-deep)', border: `1px solid ${factionColor}66` }}>
                <span className="text-lg">{role.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate" style={{ color: 'var(--color-text)' }}>
                    {p.id + 1}.{p.name}
                  </div>
                  <div className="text-[10px] truncate" style={{ color: factionColor }}>{role.name[lang]}</div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="text-center">
          <button onClick={onContinue}
            className="px-6 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all hover:scale-105 mx-auto"
            style={{ background: 'var(--color-accent)', color: '#fff', boxShadow: '0 0 0 3px var(--color-accent-glow), 0 4px 12px rgba(0,0,0,0.3)' }}>
            <Play size={14} />{lang === 'zh' ? '开始观看 AI 博弈' : 'Start watching'}
          </button>
        </div>
      </div>
    );
  }

  const userP = state.players[state.userId];
  // P22 防御:userP 可能为 undefined(理论上不会,但 sessionStorage 异常时可能)
  if (!userP) return null;
  const role = ROLES[userP.role];
  // 狼人/狼王/狼美人/石像鬼 队友可见
  let extra = '';
  const mem = userP.privateMemory ?? defaultMemory();
  if (userP.faction === 'wolf' && mem.wolfTeammates?.length) {
    const mates = mem.wolfTeammates.map(id => `${state.players[id]?.name ?? '?'}`).join('、');
    extra = lang === 'zh' ? `\n🐺 你的狼队友:${mates}` : `\n🐺 Your wolf pack: ${mates}`;
  }
  // P2-#32 修复:神职状态 HUD
  let statusHud = '';
  if (userP.role === 'witch') {
    statusHud = lang === 'zh'
      ? `\n💊 解药${mem.witchAntidoteUsed ? '已用' : '可用'} · ☠️ 毒药${mem.witchPoisonUsed ? '已用' : '可用'}`
      : `\n💊 Antidote ${mem.witchAntidoteUsed ? 'used' : 'available'} · ☠️ Poison ${mem.witchPoisonUsed ? 'used' : 'available'}`;
  } else if (userP.role === 'guard') {
    statusHud = lang === 'zh'
      ? `\n🛡️ 上一夜守了 ${mem.guardLastTargetId !== null ? state.players[mem.guardLastTargetId].name : '(空守)'}`
      : `\n🛡️ Last guarded: ${mem.guardLastTargetId !== null ? state.players[mem.guardLastTargetId].name : '(none)'}`;
  } else if (userP.role === 'knight') {
    statusHud = lang === 'zh'
      ? `\n⚔️ 决斗${mem.knightUsed ? '已用' : '可用'}`
      : `\n⚔️ Duel ${mem.knightUsed ? 'used' : 'available'}`;
  } else if (userP.role === 'seer' && mem.seerChecks.length) {
    statusHud = lang === 'zh'
      ? `\n🔮 已查验 ${mem.seerChecks.length} 人`
      : `\n🔮 Checked ${mem.seerChecks.length} players`;
  }
  return (
    <div className="p-6 rounded-xl text-center" style={{ background: 'var(--color-card-bg)', border: '1px solid var(--color-accent)' }}>
      <div className="text-5xl mb-2">{role.emoji}</div>
      <h3 className="text-xl font-bold whitespace-pre-line" style={{ color: 'var(--color-text)' }}>
        {lang === 'zh' ? '你的身份是' : 'Your role is'}: {role.name[lang]}{extra}
      </h3>
      <p className="text-sm mt-2" style={{ color: 'var(--color-text-muted)' }}>{role.shortDesc[lang]}</p>
      <p className="text-xs mt-2 px-4" style={{ color: 'var(--color-text-muted)' }}>{role.skillHint[lang]}</p>
      {statusHud && (
        <div className="text-xs mt-2 p-2 rounded whitespace-pre-line" style={{ background: 'var(--color-bg-deep)', color: 'var(--color-text)' }}>
          {statusHud}
        </div>
      )}
      <div className="mt-5 flex justify-center">
        <button
          onClick={onContinue}
          className="px-6 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all hover:scale-105"
          style={{
            background: 'var(--color-accent)',
            color: '#fff',
            boxShadow: '0 0 0 3px var(--color-accent-glow), 0 4px 12px rgba(0,0,0,0.3)',
          }}
        >
          <Play size={14} />{lang === 'zh' ? '进入夜晚' : 'Enter Night'}
        </button>
      </div>
      <p className="text-[10px] mt-2" style={{ color: 'var(--color-text-muted)' }}>
        {lang === 'zh' ? '👆 点上面按钮开始' : '👆 Click above to start'}
      </p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   夜晚面板 —— 分幕模式(完全用 setTimeout 驱动,不用 useEffect[timeLeft, scene, busy])
   ── 每幕 3 阶段:睁眼字幕(2.5s) → 行动(用户/AI,30s 倒计时)→ 闭眼字幕(1.5s)
   ── 所有人都能看到字幕(村民 / 守卫 / 女巫 / 狼都能看,但不知道具体行动)
   ── 关键改进:
   · 状态用 setTimeout 推进,不用 timeLeft<=0 触发 setState(避免 useEffect 互相干扰)
   · state/aiSpeak 用 useRef 存最新值(避免异步闭包读旧 state)
   · 行动阶段 AI/用户都有 35s 超时强制推进(不卡死)
   · StrictMode 双跑安全:cancelled 标记 + cleanup clearTimeout/Interval
   ═══════════════════════════════════════════════════════════════════ */

const NIGHT_INTRO_SEC = 2.5;
const NIGHT_OUTRO_SEC = 1.5;
/* 角色专属夜晚行动时长(秒)—— 标准规则参考 */
const NIGHT_TIMEOUTS: Partial<Record<RoleId, number>> = {
  werewolf: 60, wolfking: 60, wolfbeauty: 60,  // 狼人 60s
  seer: 35,                                     // 预言家 35s
  witch: 40,                                    // 女巫 40s
  guard: 30, gargoyle: 30, cupid: 30,          // 其他 30s
};
function getNightTimeout(role: RoleId): number { return NIGHT_TIMEOUTS[role] ?? 30; }

function NightPanel({ state, setState, lang, aiSpeak, onActingChange, onExit }: {
  state: GameState; setState: (updater: (s: GameState) => GameState) => void;
  lang: 'zh' | 'en';
  aiSpeak: (playerId: number, system: string, user: string, silent?: boolean) => Promise<{ speech: string; target: number | null }>;
  onActingChange?: (playerIds: number[]) => void;
  /** P11-A:死者退出按钮 */
  onExit?: () => void;
}) {
  // 行动队列(每个行动可能包含多个玩家 —— 狼队合并成一个行动,互相看到身份)
  const [actions, setActions] = useState<{ role: RoleId; playerIds: number[] }[]>([]);
  const [actionIdx, setActionIdx] = useState(0);
  const [scene, setScene] = useState<'intro' | 'action' | 'outro' | 'done'>('intro');
  const [timeLeft, setTimeLeft] = useState(NIGHT_INTRO_SEC);
  const [busy, setBusy] = useState(false);

  // ref 存最新 state / aiSpeak(避免异步闭包读旧值)
  const stateRef = useRef(state);
  stateRef.current = state;
  const aiSpeakRef = useRef(aiSpeak);
  aiSpeakRef.current = aiSpeak;
  // AI 完成标记:防止「超时强制 outro」和「AI 正常完成 outro」双触发
  const aiDoneRef = useRef(false);
  // P1-#D:无夜行角色时直接结算的定时器句柄(round 变化时清理)
  const noActorsTimerRef = useRef<number | null>(null);

  // 当 round 变化时,初始化行动队列
  // 标准规则:狼队(所有狼)同时行动(一起睁眼、互相知道身份),其他角色独立行动
  // 丘比特仅首夜行动(round === 1)
  useEffect(() => {
    const aliveRoles = state.players.filter(p =>
      p.alive && ROLES[p.role].hasNightAction
      && !(p.role === 'cupid' && state.round > 1)
    );
    // 狼合并成一个行动组
    const wolves = aliveRoles.filter(p => p.faction === 'wolf');
    const nonWolves = aliveRoles.filter(p => p.faction !== 'wolf');
    const wolfGroup = wolves.length > 0 ? [{ role: wolves[0].role, playerIds: wolves.map(p => p.id) }] : [];
    const otherGroups = nonWolves.map(p => ({ role: p.role, playerIds: [p.id] }));
    const sorted = [...wolfGroup, ...otherGroups]
      .sort((a, b) => ROLES[a.role].nightOrder - ROLES[b.role].nightOrder);
    setActions(sorted);
    setActionIdx(0);
    setScene('intro');
    setTimeLeft(NIGHT_INTRO_SEC);
    // P1-#D 修复:无夜行角色(hunter/idiot/villager 全部存活)→ 直接结算夜间跳到白天
    // 之前场景会卡在 'action' 状态(因为 !cur → effect 提前 return)
    if (sorted.length === 0) {
      noActorsTimerRef.current = window.setTimeout(() => {
        setScene('done');
        setState(s => resolveNight(s, lang));
      }, NIGHT_INTRO_SEC * 1000);
    }
    // 清理上一轮的 noActors 定时器(如果还有)
    return () => {
      if (noActorsTimerRef.current !== null) {
        clearTimeout(noActorsTimerRef.current);
        noActorsTimerRef.current = null;
      }
    };
  }, [state.round]);

  const cur = actions[actionIdx];
  // 用户是否在当前行动组(狼队或单人)
  const isUserActor = cur ? cur.playerIds.includes(state.userId) : false;

  // P5 修复:死人不能夜间行动,显示观战面板(用户原话:"我死了以后游戏暂停了")
  const userAliveNP = state.players[state.userId]?.alive;
  if (!userAliveNP) {
    const curHint = (() => {
      if (!cur) return undefined;
      if (scene === 'action') return lang === 'zh'
        ? `${ROLES[cur.role].emoji} ${ROLES[cur.role].name.zh} 正在行动…`
        : `${ROLES[cur.role].emoji} ${ROLES[cur.role].name.en} acting…`;
      if (scene === 'intro') return lang === 'zh' ? '🌙 夜间开场…' : '🌙 Night intro…';
      if (scene === 'outro') return lang === 'zh' ? '🌙 夜间收尾…' : '🌙 Night outro…';
      return undefined;
    })();
    // P16:观看模式下不显示 DeadSpectator(用户不是玩家,只是看 AI 行动)
    if (!state.spectatorMode) {
      return <DeadSpectator state={state} lang={lang} busyHint={curHint} onExit={onExit} />;
    }
  }

  // 通知 GameRunner 当前行动玩家 —— P1-#11 修复:
  // 用户是当前行动者,或用户是狼(看到狼队回合),都点亮座位
  const userP = stateRef.current.players[state.userId];
  const userIsWolf = userP?.alive && userP.faction === 'wolf';
  const isWolfPack = cur?.playerIds.length > 1;
  const shouldShowAction = scene === 'action' && cur && (isUserActor || (isWolfPack && userIsWolf));

  useEffect(() => {
    onActingChange?.(shouldShowAction ? cur!.playerIds : []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, actionIdx, shouldShowAction]);

  // 每次 scene/actionIdx 变化时,重置 aiDone
  useEffect(() => {
    aiDoneRef.current = false;
  }, [scene, actionIdx]);

  // 场景驱动:每个 scene 各自用 setTimeout + setInterval 推进
  useEffect(() => {
    if (scene === 'done' || !cur) return;

    let cancelled = false;
    const timeouts: number[] = [];
    const intervals: number[] = [];

    /* 倒计时 helper:实时更新 timeLeft,seconds 后回调 */
    const startCountdown = (seconds: number, onDone: () => void) => {
      setTimeLeft(seconds);
      const start = Date.now();
      const id = window.setInterval(() => {
        if (cancelled) { clearInterval(id); return; }
        const left = Math.max(0, seconds - (Date.now() - start) / 1000);
        setTimeLeft(left);
      }, 100);
      intervals.push(id);
      const t = window.setTimeout(() => {
        if (cancelled) return;
        clearInterval(id);
        onDone();
      }, seconds * 1000);
      timeouts.push(t);
    };

    if (scene === 'intro') {
      // 睁眼字幕 N 秒
      startCountdown(NIGHT_INTRO_SEC, () => {
        if (cancelled) return;
        setScene('action');
      });
    } else if (scene === 'outro') {
      // 闭眼字幕 N 秒 → 推进到下一个角色
      startCountdown(NIGHT_OUTRO_SEC, () => {
        if (cancelled) return;
        if (actionIdx + 1 >= actions.length) {
          setScene('done');
          setState(s => resolveNight(s, lang));
        } else {
          setActionIdx(i => i + 1);
          setScene('intro');
        }
      });
    } else if (scene === 'action') {
      setBusy(true);
      const timeoutSec = getNightTimeout(cur.role);
      const actorId = cur.playerIds[0];
      if (isUserActor) {
        // 用户行动(包括用户是狼队成员):不调 AI,等用户点;超时强制 null
        setBusy(false);
        startCountdown(timeoutSec, () => {
          if (cancelled) return;
          if (cur.role === 'witch') {
            setState(s => applyWitchAction(s, actorId, false, null, lang));
          } else {
            setState(s => applyNightAction(s, cur.role, actorId, null, lang));
          }
          setScene('outro');
        });
      } else {
        // AI 行动
        // 狼队行动特殊处理:每只狼独立投票,最后聚合计数
        const isWolfPack = cur.playerIds.length > 1;
        // 用 handleWolfPackDone 标志避免重复跑"单个 AI"分支
        let handleWolfPackDone = false;
        if (isWolfPack) {
          handleWolfPackDone = true;
          // 给所有狼启动超时兜底
          startCountdown(timeoutSec, () => {
            if (aiDoneRef.current) return;
            aiDoneRef.current = true;
            if (cancelled) return;
            // 超时:用现有票数走严格多数逻辑
            // 修复(P0 强化):改用带 state 的 aggregateWolfVotes,狼队协商一致(>50%)才算,否则在被选过的目标里随机
            let target = aggregateWolfVotes(stateRef.current, cur.playerIds, stateRef.current.wolfVotes);
            // 修复(P0):如果所有狼票都无效,兜底随机选一个非狼存活目标(否则会出现"狼人行动但没杀人"卡死)
            if (target === null) {
              const wolfIdSet = new Set(cur.playerIds);
              const candidates = stateRef.current.players.filter(p => p.alive && !wolfIdSet.has(p.id));
              if (candidates.length > 0) {
                target = candidates[Math.floor(Math.random() * candidates.length)].id;
              }
            }
            setState(s => applyNightAction(s, cur.role, cur.playerIds[0], target, lang));
            setBusy(false);
            setScene('outro');
          });
          // 每只狼依次投票(并行启动 aiSpeak,然后用 Promise.all 收集)
          const wolfPromises: Promise<number | null>[] = cur.playerIds.map((wid) => {
            const wolf = stateRef.current.players[wid];
            if (!wolf) return Promise.resolve(null);
            // 收集本队其他狼的当前票数作为讨论参考
            const peerVotesSummary = cur.playerIds
              .filter(pid => pid !== wid)
              .map(pid => `${pid + 1}号`)
              .join('、');
            const sys = lang === 'zh'
              ? `你是"${wolf.name}"(第${wolf.id + 1}号),狼队成员。今晚狼队(你和 ${peerVotesSummary || '队友'})要一起选一个人杀。请先简单讨论(20-40 字)你建议杀谁 + 理由,然后用 JSON 输出你最终投票的目标。\n输出格式:{"speech":"讨论(20-40字)","target":目标座位号(1-based)}`
              : `You are "${wolf.name}", a wolf. Coordinate with pack to pick a victim. Discuss briefly then output JSON: {"speech":"20-40 words","target":seat (1-based)}`;
            const usr = lang === 'zh' ? '请讨论 + 输出 JSON' : 'Discuss + output JSON';
            return aiSpeak(wolf.id, sys, usr, true).then(({ target }) => target);
          });
          Promise.all(wolfPromises).then((votes) => {
            if (cancelled || aiDoneRef.current) return;
            aiDoneRef.current = true;
            // 把狼队的票数写到 state.wolfVotes(供下个阶段查阅)
            // 修复(P0 强化):改用带 state 的 aggregateWolfVotes,严格多数(>50%)才算
            const validVotes = votes.filter((v): v is number => v !== null);
            let target = aggregateWolfVotes(stateRef.current, cur.playerIds, validVotes);
            // 修复(P0):所有狼票都无效时,兜底随机选一个非狼存活目标
            if (target === null) {
              const wolfIdSet = new Set(cur.playerIds);
              const candidates = stateRef.current.players.filter(p => p.alive && !wolfIdSet.has(p.id));
              if (candidates.length > 0) {
                target = candidates[Math.floor(Math.random() * candidates.length)].id;
              }
            }
            setState(s => ({
              ...s,
              wolfVotes: votes.filter((v): v is number => v !== null),
            }));
            setState(s => applyNightAction(s, cur.role, cur.playerIds[0], target, lang));
            setBusy(false);
            setScene('outro');
          });
        }
        if (!handleWolfPackDone) {
          // 单个 AI 行动(非狼队)
          const actor = state.players[actorId];
          // P21 防御:actor 不存在(action 来自上一轮的玩家但本轮已死/越界)
          // → 跳过本轮,直接进下一阶段
          if (!actor || !actor.alive || !actor.privateMemory) {
            console.warn(`[Werewolf] NightPanel: actor ${actorId} missing or dead, skipping`);
            setBusy(false);
            if (actionIdx + 1 >= actions.length) {
              setScene('done');
              setState(s => resolveNight(s, lang));
            } else {
              setActionIdx(i => i + 1);
              setScene('intro');
            }
            return;
          }
          // P6-#C 修复:女巫超时兜底强制用解药 + 毒药(不能空过)
          // 规则:女巫是神职,几乎必须用道具 —— AI 思考过久或没给决策时强制使用
          // P8-#C 增强:即使 AI 返回了 decision(比如 useAntidote:false, poisonTarget:null),
          //      如果有可用道具,也要强制使用 —— 之前 AI 选择"全空过"时,fallback 没触发
          const witchFallback = (forced: boolean) => {
            const cur = stateRef.current;
            const wolfTarget = cur.deadThisNight[0] ?? null;
            const mem = actor.privateMemory;
            const canSelfSave = canWitchSelfSave(cur.players.length, cur.round, wolfTarget === actorId);
            let useAntidote = !mem.witchAntidoteUsed && wolfTarget !== null && (wolfTarget !== actorId || canSelfSave);
            const candidates = cur.players.filter(p => p.alive && p.id !== actorId);
            let poisonTarget = !mem.witchPoisonUsed && candidates.length > 0
              ? candidates[Math.floor(Math.random() * candidates.length)].id
              : null;
            // P8-#C:如果强制模式 + AI 想空过,必须用
            if (forced) {
              if (!useAntidote && mem.witchAntidoteUsed) {
                // 已经用过解药了,跳过
              } else if (wolfTarget === null) {
                // 没目标 → 解药用不了,毒药必须用(优先挑非狼:这里随机活人)
                useAntidote = false;
              }
            }
            return { useAntidote, poisonTarget };
          };
          startCountdown(timeoutSec, () => {
            if (aiDoneRef.current) return;
            aiDoneRef.current = true;
            if (cancelled) return;
            if (cur.role === 'witch') {
              const fb = witchFallback(true);
              setState(s => applyWitchAction(s, actorId, fb.useAntidote, fb.poisonTarget, lang));
            } else {
              setState(s => applyNightAction(s, cur.role, actorId, null, lang));
            }
            setBusy(false);
            setScene('outro');
          });
          runAIAction(actor, stateRef.current, lang, aiSpeakRef.current).then((result) => {
            if (cancelled || aiDoneRef.current) return;
            aiDoneRef.current = true;
            if (cur.role === 'witch') {
              // P21 防御:女巫可能因 race condition 在 AI 返回前死亡/消失
              const witchRef = stateRef.current.players[actorId];
              if (!witchRef || !witchRef.privateMemory) {
                console.warn(`[Werewolf] Witch ${actorId} disappeared mid-action, skipping`);
                setState(s => resolveNight(s, lang));
                setBusy(false);
                setScene('done');
                return;
              }
              // P8-#C:检查 AI 是否真的用了药 —— 如果两个都没用且都可用,强制使用
              const mem = witchRef.privateMemory;
              const aiUsedAntidote = result.decision?.useAntidote ?? false;
              const aiUsedPoison = (result.decision?.poisonTarget ?? null) !== null;
              const antidoteAvail = !mem.witchAntidoteUsed;
              const poisonAvail = !mem.witchPoisonUsed;
              const wolfTarget = stateRef.current.deadThisNight[0] ?? null;
              const canSelfSave = canWitchSelfSave(stateRef.current.players.length, stateRef.current.round, wolfTarget === actorId);
              const shouldUseAntidote = antidoteAvail && wolfTarget !== null && (wolfTarget !== actorId || canSelfSave);
              // 如果 AI 完全没用,但有可用道具 → 强制用
              if (!aiUsedAntidote && !aiUsedPoison && (shouldUseAntidote || poisonAvail)) {
                const fb = witchFallback(true);
                setState(s => applyWitchAction(s, actorId, fb.useAntidote, fb.poisonTarget, lang));
                console.warn(`[Werewolf] Witch ${actor.name} tried to skip potions, forcing use`);
              } else {
                // AI 选择用了(可能只用一种),尊重
                setState(s => applyWitchAction(s, actorId, aiUsedAntidote, result.decision?.poisonTarget ?? null, lang));
              }
            } else if (result.target !== null) {
              setState(s => applyNightAction(s, cur.role, actorId, result.target, lang));
            }
            setBusy(false);
            setScene('outro');
          });
        }
      }
    }

    return () => {
      cancelled = true;
      timeouts.forEach(clearTimeout);
      intervals.forEach(clearInterval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, actionIdx, actions.length]);

  // 用户手动确认行动
  function onUserAction(target: number | null, extra?: { useAntidote?: boolean; poisonTarget?: number | null; secondLoverId?: number | null }) {
    if (!cur) return;
    const actorId = cur.playerIds[0];
    if (cur.role === 'witch') {
      const useAntidote = extra?.useAntidote ?? false;
      const poisonTarget = extra?.poisonTarget ?? null;
      setState(s => applyWitchAction(s, actorId, useAntidote, poisonTarget, lang));
    } else if (cur.role === 'cupid') {
      // 丘比特:target = lover1,extra.poisonTarget 复用为 lover2(hack:接口没专门为 cupid 开扩展)
      const lover2 = extra?.poisonTarget ?? null;
      setState(s => applyNightAction(s, cur.role, actorId, target, lang, { secondLoverId: lover2 }));
    } else {
      setState(s => applyNightAction(s, cur.role, actorId, target, lang));
    }
    setScene('outro');
  }

  if (state.phase !== 'night') return null;

  // 渲染
  return (
    <div className="p-6 rounded-xl text-center" style={{
      background: 'rgba(0,0,0,0.6)', border: '1px solid var(--color-accent)',
      minHeight: 200, position: 'relative',
    }}>
      <div className="text-[10px] mb-2" style={{ color: 'var(--color-text-muted)' }}>
        {lang === 'zh' ? `第 ${state.round} 夜` : `Night ${state.round}`}
      </div>
      {cur && scene !== 'done' ? (
        <NightSceneDisplay
          scene={scene}
          cur={cur}
          state={state}
          lang={lang}
          timeLeft={timeLeft}
          onUserAction={onUserAction}
          busy={busy}
        />
      ) : null}
      {scene === 'done' && (
        <div className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
          {lang === 'zh' ? '🌅 天快亮了…' : '🌅 Dawn approaching…'}
        </div>
      )}
      {cur && scene === 'action' && (() => {
        // 修复:非狼人(且非行动者)看不到具体哪个角色在行动
        // 只有狼队成员 + 当前行动者(及其同阵营)能看到具体角色
        const isMe = cur.playerIds.includes(state.userId);
        const isWolfPack = cur.playerIds.length > 1;
        const userP = state.players[state.userId];
        const userIsWolf = userP?.alive && userP.faction === 'wolf';
        const canSeeInfo = isMe || (isWolfPack && userIsWolf);
        if (!canSeeInfo) return null;
        return (
          <div className="mt-3 text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
            {lang === 'zh' ? '当前行动:' : 'Acting now:'} {ROLES[cur.role].emoji} {ROLES[cur.role].name[lang]}
          </div>
        );
      })()}
    </div>
  );
}

/* ── 夜晚分幕具体显示 ── */
function NightSceneDisplay({ scene, cur, state, lang, timeLeft, onUserAction, busy }: {
  scene: 'intro' | 'action' | 'outro';
  cur: { role: RoleId; playerIds: number[] };
  state: GameState; lang: 'zh' | 'en';
  timeLeft: number;
  onUserAction: (t: number | null, extra?: { useAntidote?: boolean; poisonTarget?: number | null }) => void;
  busy: boolean;
}) {
  const role = ROLES[cur.role];
  const isMe = cur.playerIds.includes(state.userId);
  const isWolfPack = cur.playerIds.length > 1;
  // P1-#A 修复:把 userSeerChecks 提前声明,outro 块也需要用到
  const userP = state.players[state.userId];
  // P21 防御:userP 可能为 undefined(spectator 模式 userId=-1,或边界态),privateMemory 也可能缺失
  const userIsSeerAction = cur.role === 'seer' && isMe && userP?.privateMemory;
  const userSeerChecks = userIsSeerAction && userP ? userP.privateMemory.seerChecks : [];
  // 标准规则:夜间只有行动者(及其同阵营可见)能看到行动信息
  // 狼队回合:所有狼人可见(包括用户若为狼)
  // 其他角色回合:只有自己可见
  const userIsWolf = userP?.alive && userP.faction === 'wolf';
  const canSeeInfo = isMe || (isWolfPack && userIsWolf);

  // 非可见方:不显示角色名,只显示通用提示
  if (!canSeeInfo) {
    if (scene === 'intro' || scene === 'outro') {
      return (
        <div>
          <div className="text-5xl mb-3">🌙</div>
          <div className="text-2xl font-bold mb-2" style={{ color: 'var(--color-text-muted)' }}>
            {lang === 'zh' ? '夜深人静…' : 'Quiet night…'}
          </div>
          <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            {lang === 'zh' ? `${(timeLeft).toFixed(1)}s` : `${timeLeft.toFixed(1)}s`}
          </div>
        </div>
      );
    }
    // action 场景:非行动者(且非狼)看到「有人行动中」+ 倒计时
    return (
      <div>
        <div className="text-5xl mb-3">🕯️</div>
        <div className="text-2xl font-bold mb-2" style={{ color: 'var(--color-text-muted)' }}>
          {lang === 'zh' ? '有人在行动…' : 'Someone is acting…'}
        </div>
        <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          ⏱ {timeLeft.toFixed(1)}s
        </div>
      </div>
    );
  }

  // 字幕(可见方)
  if (scene === 'intro') {
    return (
      <div>
        <div className="text-5xl mb-3 animate-pulse">{role.emoji}</div>
        <div className="text-2xl font-bold mb-2" style={{ color: 'var(--color-accent)' }}>
          {lang === 'zh' ? `${role.name.zh}请睁眼` : `${role.name.en}, wake up`}
          {isWolfPack && (lang === 'zh' ? '(狼队一起)' : ' (pack together)')}
        </div>
        <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          {lang === 'zh' ? `${(timeLeft).toFixed(1)}s 后开始行动` : `Action starts in ${timeLeft.toFixed(1)}s`}
        </div>
      </div>
    );
  }
  if (scene === 'outro') {
    // P1-#A 修复:用户是预言家刚查验完时,在 outro 立即告知结果(否则要等下一夜才能看到)
    let seerResultEl: React.ReactNode = null;
    if (cur.role === 'seer' && isMe && userSeerChecks.length > 0) {
      const last = userSeerChecks[userSeerChecks.length - 1];
      seerResultEl = (
        <div className="mt-3 p-2 rounded text-xs animate-fade-in" style={{ background: 'rgba(99,102,241,0.18)', border: '1px solid #6366f1' }}>
          🔮 {lang === 'zh'
            ? `你验的 ${last.targetId + 1} 号 → ${last.isWolf ? '🐺 狼人' : '🛡️ 好人'}`
            : `You checked #${last.targetId + 1}: ${last.isWolf ? '🐺 Wolf' : '🛡️ Good'}`}
        </div>
      );
    }
    return (
      <div>
        <div className="text-5xl mb-3">😴</div>
        <div className="text-2xl font-bold mb-2" style={{ color: 'var(--color-text)' }}>
          {lang === 'zh' ? `${role.name.zh}请闭眼` : `${role.name.en}, close your eyes`}
        </div>
        {seerResultEl}
        <div className="text-xs mt-2" style={{ color: 'var(--color-text-muted)' }}>
          {lang === 'zh' ? `下一位…` : 'Next…'}
        </div>
      </div>
    );
  }
  // action
  // 修复(P0):用户是预言家时,在行动 UI 上方显示已查验结果(否则验完看不到)
  // userSeerChecks 已在函数顶部声明(outro 块也用得到)
  return (
    <div>
      <div className="text-4xl mb-2">{role.emoji}</div>
      <div className="text-sm mb-1" style={{ color: 'var(--color-text)' }}>
        {isMe
          ? (lang === 'zh' ? '轮到你了' : 'Your turn')
          : (lang === 'zh' ? `${role.name.zh} 正在行动…` : `${role.name.en} acting…`)}
      </div>
      <div className="text-[10px] mb-3" style={{ color: timeLeft < 10 ? '#dc2626' : 'var(--color-text-muted)' }}>
        ⏱ {timeLeft.toFixed(1)}s {lang === 'zh' ? '后超时自动跳过' : 'timeout auto-skip'}
      </div>
      {userIsSeerAction && userSeerChecks.length > 0 && (
        <div className="mb-3 p-2 rounded text-left" style={{ background: 'var(--color-bg-deep)', border: '1px solid #6366f1' }}>
          <p className="text-xs font-semibold mb-1" style={{ color: '#a78bfa' }}>
            🔮 {lang === 'zh' ? '你已查验:' : 'Your checks:'}
          </p>
          {userSeerChecks.map((c, i) => (
            <p key={i} className="text-[11px]" style={{ color: 'var(--color-text)' }}>
              {lang === 'zh' ? `第 ${c.night} 晚` : `Night ${c.night}`}: {c.targetId + 1}{lang === 'zh' ? '号' : '#'} → {c.isWolf
                ? (lang === 'zh' ? '🐺 狼人' : '🐺 Wolf')
                : (lang === 'zh' ? '🛡️ 好人' : '🛡️ Good')}
            </p>
          ))}
        </div>
      )}
      {isMe ? (
        <UserNightActionUI role={cur.role} state={state} lang={lang} onConfirm={onUserAction} />
      ) : busy ? (
        <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          {lang === 'zh' ? '🤔 思考中…' : '🤔 thinking…'}
        </div>
      ) : null}
    </div>
  );
}

/* ── 用户夜晚行动 UI ── */
function UserNightActionUI({ role, state, lang, onConfirm }: {
  role: RoleId; state: GameState; lang: 'zh' | 'en';
  onConfirm: (target: number | null, extra?: { useAntidote?: boolean; poisonTarget?: number | null }) => void;
}) {
  const userP = state.players[state.userId];
  const aliveOthers = state.players.filter(p => p.alive && p.id !== state.userId);
  const [selected, setSelected] = useState<number | null>(null);

  // 守卫:不能连守同一人 + 上一夜空守则本夜必须守人(P0-#5 修复)
  if (role === 'guard') {
    const lastTarget = userP?.privateMemory?.guardLastTargetId ?? null;
    const lastRoundSkipped = lastTarget === null;
    const mustGuardSomeone = lastRoundSkipped;
    return (
      <div>
        <p className="text-xs mb-2" style={{ color: 'var(--color-text-muted)' }}>
          {lang === 'zh'
            ? (mustGuardSomeone
                ? '🛡️ 你上一夜空守了,本夜必须守一个非自己的玩家(规则:不可连续两夜空守)'
                : '请选择今晚要守护的人:')
            : (mustGuardSomeone
                ? '🛡️ You skipped last night — must guard a non-self player this night'
                : 'Choose who to guard:')}
        </p>
        <div className="flex flex-wrap gap-1.5 justify-center">
          {aliveOthers.map(p => {
            const disabled = p.id === lastTarget;
            return (
              <button key={p.id} onClick={() => !disabled && setSelected(p.id)} disabled={disabled}
                className="px-2 py-1 rounded text-xs"
                style={{
                  background: selected === p.id ? 'var(--color-accent)' : 'var(--color-card-bg)',
                  color: selected === p.id ? '#fff' : disabled ? 'var(--color-text-muted)' : 'var(--color-text)',
                  opacity: disabled ? 0.4 : 1, cursor: disabled ? 'not-allowed' : 'pointer',
                }}>
                {p.id + 1}.{p.name}{disabled && (lang === 'zh' ? ' (上轮已守)' : ' (guarded last)')}
              </button>
            );
          })}
        </div>
        <div className="text-center mt-3 space-x-2">
          {/* P0-#5 修复:加 "空守" 按钮;但 mustGuardSomeone 时禁用(规则强制) */}
          <Button onClick={() => onConfirm(null)} disabled={mustGuardSomeone || selected !== null}
            variant="secondary">
            {lang === 'zh' ? '空守(跳过)' : 'Skip (no guard)'}
          </Button>
          <Button onClick={() => onConfirm(selected)} disabled={selected === null}>
            {lang === 'zh' ? '守护' : 'Guard'} <Shield size={14} className="ml-1" />
          </Button>
        </div>
      </div>
    );
  }

  // 预言家 / 狼 / 狼王 / 狼美人:选一个目标
  if (role === 'seer' || role === 'werewolf' || role === 'wolfking' || role === 'wolfbeauty') {
    const titles: Partial<Record<RoleId, { zh: string; en: string }>> = {
      werewolf: { zh: '请选择今晚要杀的人:', en: 'Choose tonight\'s victim:' },
      wolfking: { zh: '请选择今晚要杀的人(你是狼王):', en: 'Choose victim (you\'re Wolf King):' },
      wolfbeauty: { zh: '请选择今晚要杀的人(你是狼美人):', en: 'Choose victim (you\'re Wolf Beauty):' },
      seer: { zh: '请选择要查验的人:', en: 'Choose who to verify:' },
    };
    return (
      <div>
        <p className="text-xs mb-2" style={{ color: 'var(--color-text-muted)' }}>{titles[role]?.[lang] ?? ''}</p>
        <div className="flex flex-wrap gap-1.5 justify-center">
          {aliveOthers.map(p => (
            <button key={p.id} onClick={() => setSelected(p.id)}
              className="px-2 py-1 rounded text-xs"
              style={{
                background: selected === p.id ? 'var(--color-accent)' : 'var(--color-card-bg)',
                color: selected === p.id ? '#fff' : 'var(--color-text)',
              }}>
              {p.id + 1}.{p.name}
            </button>
          ))}
        </div>
        <div className="text-center mt-3">
          <Button onClick={() => onConfirm(selected)} disabled={selected === null}>
            {lang === 'zh' ? '确认' : 'Confirm'} <ChevronRight size={14} className="ml-1" />
          </Button>
        </div>
      </div>
    );
  }

  // 女巫:可选救 / 毒 / 跳过
  if (role === 'witch') {
    const mem = userP.privateMemory;
    const [useAntidote, setUseAntidote] = useState(false);
    const [poisonTarget, setPoisonTarget] = useState<number | null>(null);
    // 系统告诉女巫"今晚狼人想杀的人是 X 号"
    // deadThisNight[0] 是狼队决定的目标(在狼人行动后写入,女巫此时在狼之后行动)
    const wolfTarget = state.deadThisNight[0] ?? null;
    const isFirstNight = state.round === 1;
    const selfTarget = wolfTarget === state.userId;
    // P1-#7 修复:自救规则统一用 canWitchSelfSave()(9p 首夜可自救,12p 首夜不可自救)
    const canSelfSave = canWitchSelfSave(state.players.length, state.round, selfTarget);
    const canAntidote = !mem.witchAntidoteUsed && wolfTarget !== null && (!selfTarget || canSelfSave);
    const canPoison = !mem.witchPoisonUsed;
    // 修复(P0):根据当前板子有没有守卫,显示不同 fallback 文案(否则 12p 无守卫会说"守卫挡住了")
    const hasGuard = BOARDS[state.boardId].roles.includes('guard');
    const noTargetHint = hasGuard
      ? (lang === 'zh' ? '没人(守卫挡住了)' : 'nobody (guard blocked)')
      : (lang === 'zh' ? '没人(狼队没选目标)' : 'nobody (wolves picked no target)');
    // P1-#7 修复:自救规则统一用 canWitchSelfSave() 后 ruleHint 改在 UI 内联生成(避免未用变量)
    return (
      <div>
        <p className="text-xs mb-2" style={{ color: 'var(--color-text-muted)' }}>
          {lang === 'zh'
            ? `今晚狼人想杀的是:${wolfTarget !== null ? `${wolfTarget + 1}号 ${state.players[wolfTarget].name}` : noTargetHint}${isFirstNight && selfTarget ? '(首夜你自己,网杀规则不能自救)' : ''}`
            : `Wolves target: ${wolfTarget !== null ? `${state.players[wolfTarget].name}` : noTargetHint}${isFirstNight && selfTarget ? ' (night 1, online: no self-save)' : ''}`}
        </p>
        <div className="space-y-1.5">
          <label className={`flex items-center gap-2 text-xs ${canAntidote ? '' : 'opacity-50'}`}>
            <input type="checkbox" checked={useAntidote} disabled={!canAntidote}
              onChange={e => { setUseAntidote(e.target.checked); if (e.target.checked) setPoisonTarget(null); }} />
            💊 {lang === 'zh' ? '使用解药救' : 'Use antidote on'} {wolfTarget !== null ? state.players[wolfTarget].name : '目标'}
            {!canAntidote && (lang === 'zh' ? ' (不可用)' : ' (unavailable)')}
          </label>
          <div>
            <label className={`flex items-center gap-2 text-xs ${canPoison && !useAntidote ? '' : 'opacity-50'}`}>
              <input type="checkbox" checked={poisonTarget !== null} disabled={!canPoison || useAntidote}
                onChange={e => { if (e.target.checked) { setPoisonTarget(aliveOthers[0]?.id ?? null); setUseAntidote(false); } else { setPoisonTarget(null); } }} />
              ☠️ {lang === 'zh' ? '使用毒药(选一个人杀)' : 'Use poison (kill someone)'}
              {!canPoison && (lang === 'zh' ? ' (已用)' : ' (used)')}
              {useAntidote && (lang === 'zh' ? ' (解药已用)' : ' (antidote used)')}
            </label>
            {poisonTarget !== null && canPoison && (
              <div className="flex flex-wrap gap-1 mt-1 ml-5">
                {aliveOthers.filter(p => p.id !== state.userId).map(p => (
                  <button key={p.id} onClick={() => setPoisonTarget(p.id)}
                    className="px-1.5 py-0.5 rounded text-[10px]"
                    style={{
                      background: poisonTarget === p.id ? 'var(--color-accent)' : 'var(--color-card-bg)',
                      color: poisonTarget === p.id ? '#fff' : 'var(--color-text)',
                    }}>{p.id + 1}.{p.name}</button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="text-center mt-3">
          <Button onClick={() => onConfirm(null, { useAntidote, poisonTarget })}>
            {lang === 'zh' ? '确认行动' : 'Confirm'} <ChevronRight size={14} className="ml-1" />
          </Button>
        </div>
      </div>
    );
  }

  // 石像鬼:查验一个玩家是不是神职
  if (role === 'gargoyle') {
    return (
      <div>
        <p className="text-xs mb-2" style={{ color: 'var(--color-text-muted)' }}>
          {lang === 'zh' ? '🗿 选一个玩家查验他是不是「神职」:' : 'Gargoyle: check if player is a god role:'}
        </p>
        <div className="flex flex-wrap gap-1.5 justify-center">
          {aliveOthers.map(p => (
            <button key={p.id} onClick={() => setSelected(p.id)}
              className="px-2 py-1 rounded text-xs"
              style={{
                background: selected === p.id ? 'var(--color-accent)' : 'var(--color-card-bg)',
                color: selected === p.id ? '#fff' : 'var(--color-text)',
              }}>{p.id + 1}.{p.name}</button>
          ))}
        </div>
        <div className="text-center mt-3">
          <Button onClick={() => onConfirm(selected)} disabled={selected === null}>
            {lang === 'zh' ? '查验' : 'Check'} <ChevronRight size={14} className="ml-1" />
          </Button>
        </div>
      </div>
    );
  }

  // 丘比特:首夜连 2 个人做情侣 —— 修复:之前第二个人是系统随机的,
  // 现在让用户能选两个情人(更符合标准规则)
  if (role === 'cupid') {
    const [lover1, setLover1] = useState<number | null>(null);
    const [lover2, setLover2] = useState<number | null>(null);
    const othersAfterL1 = state.players.filter(p => p.alive && p.id !== state.userId && p.id !== lover1);
    return (
      <div>
        <p className="text-xs mb-2" style={{ color: 'var(--color-text-muted)' }}>
          {lang === 'zh' ? '💘 选第 1 个情人:' : 'Pick lover #1:'}
        </p>
        <div className="flex flex-wrap gap-1.5 justify-center mb-3">
          {state.players.filter(p => p.alive && p.id !== state.userId).map(p => (
            <button key={p.id} onClick={() => { setLover1(p.id); if (lover2 === p.id) setLover2(null); }}
              className="px-2 py-1 rounded text-xs"
              style={{
                background: lover1 === p.id ? '#ec4899' : 'var(--color-card-bg)',
                color: lover1 === p.id ? '#fff' : 'var(--color-text)',
              }}>{p.id + 1}.{p.name}</button>
          ))}
        </div>
        <p className="text-xs mb-2" style={{ color: 'var(--color-text-muted)' }}>
          {lang === 'zh' ? '💘 选第 2 个情人(可跨阵营,不能跟第 1 个同一人):' : 'Pick lover #2 (can be any faction, must differ from #1):'}
        </p>
        <div className="flex flex-wrap gap-1.5 justify-center">
          {othersAfterL1.map(p => (
            <button key={p.id} onClick={() => setLover2(p.id)}
              className="px-2 py-1 rounded text-xs"
              style={{
                background: lover2 === p.id ? '#ec4899' : 'var(--color-card-bg)',
                color: lover2 === p.id ? '#fff' : 'var(--color-text)',
              }}>{p.id + 1}.{p.name}</button>
          ))}
        </div>
        <div className="text-center mt-3">
          <Button onClick={() => {
            if (lover1 === null || lover2 === null) return;
            // 通过 poisonTarget 通道复用 extra 传第二情人(纯 hack,接口没专门为 cupid 开扩展)
            onConfirm(lover1, { poisonTarget: lover2 });
          }} disabled={lover1 === null || lover2 === null}>
            {lang === 'zh' ? '连情侣' : 'Link'} <ChevronRight size={14} className="ml-1" />
          </Button>
        </div>
      </div>
    );
  }

  // 骑士 / 猎人 / 白痴 默认占位(白天发动)
  return (
    <div className="text-center">
      <p className="text-xs mb-3" style={{ color: 'var(--color-text-muted)' }}>
        {lang === 'zh' ? `你(${ROLES[role].name.zh})无夜晚行动,白天发动技能` : `Your ${ROLES[role].name.en} has no night action`}
      </p>
      <Button onClick={() => onConfirm(null)}>
        {lang === 'zh' ? '跳过' : 'Skip'} <ChevronRight size={14} className="ml-1" />
      </Button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   夜晚行动逻辑(应用 + 结算)
   ═══════════════════════════════════════════════════════════════════ */

/* 跑一个 AI 玩家的夜晚行动(返回 target id 或 null)
   —— 直接用 aiSpeak 返回的 target,不走 state.speeches 闭包(避免读旧 state)
   —— 女巫返回结构化决策 {useAntidote, poisonTarget},其他角色 target */
async function runAIAction(
  actor: Player, state: GameState, lang: 'zh' | 'en',
  aiSpeak: (id: number, sys: string, usr: string, silent?: boolean, options?: { temperature?: number; maxTokens?: number }) => Promise<{ speech: string; target: number | null; useAntidote?: boolean }>,
): Promise<{ target: number | null; decision?: { useAntidote: boolean; poisonTarget: number | null } }> {
  // 女巫: 走专用 prompt (P1-#7 修复:用 canWitchSelfSave 统一规则)
  if (actor.role === 'witch') {
    const wolfTarget = state.deadThisNight[0] ?? null;
    const isFirstNight = state.round === 1;
    const selfTarget = wolfTarget === actor.id;
    const mem = actor.privateMemory;
    const canSelfSave = canWitchSelfSave(state.players.length, state.round, selfTarget);
    const canAntidote = !mem.witchAntidoteUsed && (!selfTarget || canSelfSave);
    const canPoison = !mem.witchPoisonUsed;
    // 修复(P0):AI prompt 同样根据板子有没有守卫显示不同文案
    const hasGuard = BOARDS[state.boardId].roles.includes('guard');
    const noTargetHint = hasGuard
      ? (lang === 'zh' ? '没人(守卫挡住了)' : 'nobody (guard blocked)')
      : (lang === 'zh' ? '没人(狼队没选目标)' : 'nobody (wolves picked no target)');
    const sys = lang === 'zh'
      ? `你是"${actor.name}"(第${actor.id + 1}号),身份:女巫 💊
今晚狼人想杀的是:${wolfTarget !== null ? `${wolfTarget + 1}号 ${state.players[wolfTarget].name}` : noTargetHint}
${isFirstNight && selfTarget ? '⚠️ 但因为是首夜(网杀规则),你不能自救。' : ''}
${!canAntidote ? '解药:已用' : '解药:可用'}
${canPoison ? '毒药:可用' : '毒药:已用'}

【强烈建议】作为女巫你应该尽量把两瓶药都用掉 —— 空过 = 浪费神职技能 = 帮好人输。
- 解药:如果能救(首夜不能救自己除外),**应当救**(保住好人战力)
- 毒药:在存活玩家中选一个**最像狼人**的人(发言躲闪 / 立场反常 / 与狼同票),**应当毒**

请决策:
${canAntidote ? '- 是否使用解药救 ${wolfTarget !== null ? state.players[wolfTarget].name : "目标"}? 答 true/false' : ''}
${canPoison ? '- 是否使用毒药? 若是,选最可疑的存活玩家(1-based 座位号,不用填 0)' : ''}

输出 JSON:{"speech":"你的理由","useAntidote":true/false,"poisonTarget":毒药目标座位号(1-based,不用填 0)}`
      : `You are "${actor.name}" (#${actor.id + 1}), Witch 💊
Wolves want to kill: ${wolfTarget !== null ? `${state.players[wolfTarget].name} (#${wolfTarget + 1})` : 'nobody'}
${isFirstNight && selfTarget ? '⚠️ Night 1 (online rule): you cannot save yourself.' : ''}
${!canAntidote ? 'Antidote: USED' : 'Antidote: available'}
${canPoison ? 'Poison: available' : 'Poison: USED'}

【Strong recommendation】As Witch you should generally use BOTH potions — empty = wasted god role = helping evil win.
- Antidote: save if possible (preserve good team)
- Poison: pick the most wolf-suspicious living player

Output JSON: {"speech":"reasoning","useAntidote":true/false,"poisonTarget":target seat (1-based, 0 if none)}`;
    const usr = lang === 'zh' ? '请用 JSON 输出决策' : 'Output JSON decision';
    const { useAntidote, target } = await aiSpeak(actor.id, sys, usr, true);
    return {
      target: null,
      decision: {
        useAntidote: !!useAntidote && canAntidote,
        poisonTarget: (target !== null && target >= 0 && target < state.players.length && state.players[target].alive && target !== actor.id && canPoison) ? target : null,
      },
    };
  }
  // 其他角色: 单 target
  const sys = buildNightPrompt(actor, state, lang);
  const usr = lang === 'zh'
    ? '请用 JSON 格式输出:{"speech":"你的发言(可选)","target":你的目标座位号(1-based,无目标填 0)}'
    : 'Output JSON: {"speech":"your speech (optional)","target":target seat (1-based, 0 if none)}';
  const { target } = await aiSpeak(actor.id, sys, usr, true /* silent:夜晚不暴露 */);
  if (target !== null && target >= 0 && target < state.players.length && state.players[target].alive) {
    return { target };
  }
  // P1-#C 修复:狼 AI 返回 null 时兜底随机选一个非狼存活目标(规则:狼每晚必杀)
  // 否则单狼场景会出现"4 晚连续平安夜"的致命 bug
  if (actor.role === 'werewolf' || actor.role === 'wolfking' || actor.role === 'wolfbeauty') {
    const wolfIdSet = new Set([actor.id, ...actor.privateMemory.wolfTeammates]);
    const candidates = state.players.filter(p => p.alive && !wolfIdSet.has(p.id));
    if (candidates.length > 0) {
      const fallback = candidates[Math.floor(Math.random() * candidates.length)].id;
      return { target: fallback };
    }
  }
  return { target: null };
}

/* 应用女巫夜晚行动(结构化决策)
   ── 自救规则(板子相关):
   ──   · 9 人场:仅首夜可以自救(round>1 也不能自救)
   ──   · 12 人场:首夜不能自救(round>1 可以自救)
   ── 解药记录 witchSavedId(由 resolveNight 决定是否真的生效)
   ── 毒药额外杀 1 人(写入 deadThisNight)
   ── 标记 witchPoisonedId 方便 DayAnnounce 区分「被毒杀」(猎人不能开枪)
   ── ⚠️ 修复:之前在这里直接 newDead.filter 把狼目标移出死亡列表,
   ──   导致「同守同救」(守卫+女巫同时保护同一人)规则失效 —— 应该抵消让目标仍死。
   ──   现在只记录决策,实际是否救人交给 resolveNight 统一处理。 */
function applyWitchAction(s: GameState, witchId: number, useAntidote: boolean, poisonTarget: number | null, _lang: 'zh' | 'en'): GameState {
  const witch = s.players[witchId];
  if (!witch || witch.role !== 'witch') return s;
  const mem = witch.privateMemory;
  const wolfTarget = s.deadThisNight[0] ?? null;
  let newDead = [...s.deadThisNight];
  let newMem = { ...mem };

  // P1-#22 修复(用户反馈):同夜只能 1 瓶药(解药 or 毒药,or 跳过)
  // 优先级:当解药可用 + 狼杀了人(且能救) → 优先用解药(忽略 poisonTarget)
  let effectiveUseAntidote = useAntidote;
  let effectivePoisonTarget = poisonTarget;
  if (useAntidote && poisonTarget !== null) {
    // 同时给了两个 → 优先解药
    effectivePoisonTarget = null;
  }

  // 解药:仅记录使用决策和救了谁(实际是否生效由 resolveNight 决定)
  if (effectiveUseAntidote && !mem.witchAntidoteUsed && wolfTarget !== null) {
    // P1-#7 修复:自救规则统一用 canWitchSelfSave()
    if (canWitchSelfSave(s.players.length, s.round, wolfTarget === witchId)) {
      newMem.witchAntidoteUsed = true;
      newMem.witchSavedId = wolfTarget;
      // 不在这里删 newDead —— 同守同救时会取消
    }
  }

  // 毒药:直接加进 deadThisNight
  if (effectivePoisonTarget !== null && !mem.witchPoisonUsed
    && effectivePoisonTarget !== witchId
    && s.players[effectivePoisonTarget]?.alive
    && !newDead.includes(effectivePoisonTarget)) {
    newMem.witchPoisonUsed = true;
    newMem.witchPoisonedId = effectivePoisonTarget;
    newDead.push(effectivePoisonTarget);
  }

  // P9:记录女巫用药操作,用于强制白天发言公开身份 + 操作
  const usedAntidote = newMem.witchAntidoteUsed && (newMem.witchSavedId !== null);
  const usedPoison = newMem.witchPoisonedId !== null;
  // 修复(P0):女巫用药操作**完全私密**,不写 publicLog
  // 之前写 publicLog 会让所有平民看到"女巫救/毒了谁",这是规则禁止的信息泄露
  // 现在:只更新 state.lastWitchAction(女巫自己 + 系统强制公告逻辑能看到)
  // 当女巫白天发言被强制公开时,公开逻辑会从 lastWitchAction 读数据并 log 公告
  const logEntries: { kind: 'system'; day: number; text: string }[] = [];

  return {
    ...s,
    players: s.players.map(p => p.id === witchId ? { ...p, privateMemory: newMem } : p),
    deadThisNight: newDead,
    publicLog: [...s.publicLog, ...logEntries],  // 空数组 → 不 log
    lastWitchAction: (usedAntidote || usedPoison)
      ? {
          savedId: usedAntidote ? newMem.witchSavedId : null,
          poisonedId: usedPoison ? newMem.witchPoisonedId : null,
          byPlayerId: witchId,
          announced: false,
        }
      : s.lastWitchAction,
  };
}

/* 应用一个夜晚行动到 GameState */
function applyNightAction(
  s: GameState, role: RoleId, actorId: number, target: number | null, _lang: 'zh' | 'en',
  opts: { secondLoverId?: number | null } = {},
): GameState {
  const players = s.players;
  switch (role) {
    case 'werewolf':
    case 'wolfking':
    case 'wolfbeauty': {
      if (target === null) return s;
      // 修复(P0):狼人不能选已死的玩家,否则 resolveNight 会重复 log 死亡
      // 也会防止选自己或空 ID
      if (target < 0 || target >= players.length || !players[target]?.alive) return s;
      // 记录狼队决定的杀(暂存到 publicLog,等结算用)
      return {
        ...s,
        publicLog: [...s.publicLog, { kind: 'system', day: s.round, text: `🐺 狼队已经行动(平民看不到目标)` }],
        players: players.map(p => p.id === actorId
          ? { ...p, privateMemory: { ...p.privateMemory, /* wolf vote 共用 */ } }
          : p),
        // 暂存到 deadThisNight 第一个
        deadThisNight: [target, ...s.deadThisNight.filter(id => id !== target)],
      };
    }
    case 'seer': {
      if (target === null) return s;
      // 修复(P0):预言家不能验自己(规则上 always 失败,且会污染 seerChecks)
      if (target === actorId) return s;
      const isWolf = players[target].faction === 'wolf';
      return {
        ...s,
        players: players.map((p, i) => i === actorId
          ? { ...p, privateMemory: { ...p.privateMemory, seerChecks: [...p.privateMemory.seerChecks, { targetId: target, isWolf, night: s.round }] } }
          : p),
      };
    }
    // P1-#15 修复:witch case 走专用 applyWitchAction(不归这里,避免误用)
    case 'witch': return s;
    case 'guard': {
      if (target === null) return s;
      return {
        ...s,
        players: players.map((p, i) => i === actorId
          ? { ...p, privateMemory: { ...p.privateMemory, guardLastTargetId: target } }
          : p),
        // 暂存"被守的人"
        publicLog: [...s.publicLog, { kind: 'system', day: s.round, text: `🛡️ 守卫守了 ${target + 1}号` }],
      };
    }
    case 'gargoyle': {
      if (target === null) return s;
      // 查验目标是不是"神职"(seer/witch/hunter/guard/knight)
      const godRoles: RoleId[] = ['seer', 'witch', 'hunter', 'guard', 'knight'];
      const isGod = godRoles.includes(players[target].role);
      return {
        ...s,
        players: players.map((p, i) => i === actorId
          ? { ...p, privateMemory: { ...p.privateMemory, gargoyleChecks: [...p.privateMemory.gargoyleChecks, { targetId: target, isGod, night: s.round }] } }
          : p),
        publicLog: [...s.publicLog, { kind: 'system', day: s.round, text: `🗿 石像鬼查验了 ${target + 1}号 (${isGod ? '神职' : '非神职'})` }],
      };
    }
    case 'cupid': {
      // 丘比特首夜连 2 个人 —— 修复:之前第二人是系统随机的,
      // 现在支持 secondLoverId 参数(用户可选 / AI 也可指定)
      if (target === null) return s;
      const aliveOthers = s.players.filter(p => p.alive && p.id !== actorId && p.id !== target);
      let secondId: number | null = null;
      if (opts.secondLoverId !== undefined && opts.secondLoverId !== null) {
        const candidate = s.players[opts.secondLoverId];
        if (candidate && candidate.alive && opts.secondLoverId !== actorId && opts.secondLoverId !== target) {
          secondId = opts.secondLoverId;
        }
      }
      if (secondId === null) {
        secondId = aliveOthers.length > 0 ? aliveOthers[Math.floor(Math.random() * aliveOthers.length)].id : null;
      }
      if (secondId === null) return s;
      return {
        ...s,
        players: players.map((p, i) => {
          if (i === actorId) return { ...p, privateMemory: { ...p.privateMemory, cupidLinkedIds: [target, secondId!] } };
          if (i === target || i === secondId) return { ...p, privateMemory: { ...p.privateMemory, cupidLinkedIds: [target, secondId!] } };
          return p;
        }),
        publicLog: [...s.publicLog, { kind: 'system', day: s.round, text: `💘 丘比特连了 ${target + 1}号 和 ${secondId + 1}号 做情侣` }],
      };
    }
    case 'knight':
    case 'hunter':
    case 'idiot': return s;  // 这些白天发动
    default: return s;
  }
}

/* 夜晚结算:应用狼人选择 + 守卫保护 + 女巫解药(并处理「同守同救」) + 公布死亡
   ── 标准规则「同守同救」:守卫+女巫解药同时作用于同一人 → 抵消,该人仍死
   ── 修复:之前用"先女巫删 → 再守卫删"的串行逻辑,实际效果是「任意一救就活」,
   ──        跟标准规则的"两救抵消"完全相反
   ── 遗言规则:仅首夜夜间死亡的玩家有遗言;非首夜夜间死亡的玩家没有遗言 */
function resolveNight(s: GameState, _lang: 'zh' | 'en'): GameState {
  // 修复(P0):只保留还活着的玩家进 dead set,过滤掉上一夜遗留的死亡
  // 否则会出现"8号 在夜里倒下了"每夜重复 log 的 bug
  let dead = new Set<number>(
    s.deadThisNight.filter(id => id >= 0 && id < s.players.length && s.players[id]?.alive)
  );
  const guard = s.players.find(p => p.alive && p.role === 'guard');
  const witch = s.players.find(p => p.alive && p.role === 'witch');
  const guardTarget = guard?.privateMemory.guardLastTargetId ?? null;
  const witchSaved = witch?.privateMemory.witchSavedId ?? null;
  // 同守同救判定:守卫守了 X 且 女巫解药救了 X(X 是同一狼目标)
  const sameGuardAntidote =
    guardTarget !== null && witchSaved !== null &&
    guardTarget === witchSaved && dead.has(guardTarget);
  if (sameGuardAntidote) {
    // 抵消:让 X 留在 dead 里(死)
    // 不删,留作下面的「应用死亡」处理
  } else {
    // 守卫保护:从 dead 中删除(非同守同救)
    if (guardTarget !== null && dead.has(guardTarget)) {
      dead.delete(guardTarget);
    }
    // 女巫解药:从 dead 中删除(非同守同救)
    if (witchSaved !== null && dead.has(witchSaved)) {
      dead.delete(witchSaved);
    }
  }
  // 应用死亡
  const newPlayers = s.players.map(p => dead.has(p.id) ? { ...p, alive: false } : p);
  const deadList = Array.from(dead);
  // 遗言队列:仅首夜有
  const isFirstNight = s.round === 1;
  // 修复(P0):第一天 12+ 人局,夜间死亡**延后结算**到警徽落地后
  // 目的:第一天死亡的角色在警徽竞选阶段还能有游戏体验(还能上警、投票、看到游戏进展)
  // 之前:resolveNight 立刻标死、log 死亡、进 last-words → 死亡玩家从一开始就看不到警徽竞选
  // 现在:round === 1 + 12+ 人 + 无警长 → 死亡存到 deferredDeaths,跳到 sheriff-election
  //      等警长竞选完成时(选举组件 setStep('done') 阶段)由 applyDeferredDeaths 应用
  const needSheriff = s.players.length >= 12 && !s.players.some(p => p.privateMemory?.isSheriff);
  if (isFirstNight && needSheriff) {
    return {
      ...s,
      // 不标死、不 log,只把死亡延后
      deadThisNight: [],  // 暂时清空(避免后续误判)
      deferredDeaths: deadList,  // 警徽落地后应用
      publicLog: [...s.publicLog, {
        kind: 'system' as const, day: s.round,
        text: `🌙 第 1 夜结算延后,等待警徽竞选落地后公布`,
      }],
      phase: 'sheriff-election',
    };
  }
  const newState: GameState = {
    ...s,
    players: newPlayers,
    deadThisNight: deadList,
    publicLog: [...s.publicLog, ...deadList.map(id => ({
      kind: 'death' as const, day: s.round, playerId: id,
      text: `${s.players[id].name} 在夜里倒下了`,
    }))],
    // 首夜:有遗言 → 进 last-words 阶段;非首夜:无遗言 → 直接 day-announce
    pendingLastWords: isFirstNight ? deadList : [],
    phase: (deadList.length > 0 && isFirstNight) ? 'last-words' : 'day-announce',
  };
  return newState;
}

/* P13:应用延后结算的死亡(警徽落地后调用)
   目的:让第一天夜间死亡的角色在警徽竞选阶段能有游戏体验
   流程:
   - 把 deferredDeaths 里的玩家标死
   - 在 publicLog 补上"X 在夜里倒下了"日志
   - 死亡列表追加到 pendingLastWords(首夜才有遗言)
   - 进 last-words 阶段(如果有死亡)→ 否则进 day-discuss
   - 清空 deferredDeaths(下一夜不会被延后)
   - 同步 isSheriff 标记(死亡玩家如果有警徽会被清掉) */
function applyDeferredDeaths(s: GameState): GameState {
  const deadList = s.deferredDeaths;
  if (deadList.length === 0) {
    // 没有延后死亡 → 直接进 day-discuss
    return { ...s, deferredDeaths: [], phase: 'day-discuss' };
  }
  // 标死 + 同步清 isSheriff(用 killPlayers helper)
  // 这里手动处理避免循环 import(deferredDeaths 通常没有殉情链)
  const newPlayers = s.players.map(p => deadList.includes(p.id)
    ? { ...p, alive: false, privateMemory: { ...p.privateMemory, isSheriff: false } }
    : p);
  const isFirstNight = s.round === 1;
  return {
    ...s,
    players: newPlayers,
    deadThisNight: deadList,
    deferredDeaths: [],  // 清空
    publicLog: [...s.publicLog, ...deadList.map(id => ({
      kind: 'death' as const, day: s.round, playerId: id,
      text: `${s.players[id].name} 在夜里倒下了`,
    })), {
      kind: 'system' as const, day: s.round,
      text: `💀 警徽落地后公布:昨夜 ${deadList.map(id => `${s.players[id].name}`).join('、')} 死亡`,
    }],
    // 首夜:有遗言 → 进 last-words 阶段
    pendingLastWords: isFirstNight ? deadList : [],
    phase: isFirstNight ? 'last-words' : 'day-discuss',
  };
}

/* ═══════════════════════════════════════════════════════════════════
   白痴翻牌阶段 —— 被投票时选择翻牌免死(失去投票权)或认命
   ═══════════════════════════════════════════════════════════════════ */

function IdiotFlip({ state, setState, lang, aiSpeak }: {
  state: GameState; setState: (u: (s: GameState) => GameState) => void;
  lang: 'zh' | 'en';
  aiSpeak: (id: number, sys: string, usr: string, silent?: boolean, options?: { temperature?: number; maxTokens?: number }) => Promise<{ speech: string; target: number | null }>;
}) {
  const idiotId = state.lastVotedOut;
  // P2-#23 修复:用 ref guard 防止 StrictMode 双跑
  const didAutoAdvanceRef = useRef(false);
  if (idiotId === null) {
    useEffect(() => {
      if (didAutoAdvanceRef.current) return;
      didAutoAdvanceRef.current = true;
      setState(s => ({ ...s, phase: 'night', round: s.round + 1 }));
    }, []);
    return null;
  }
  const idiot = state.players[idiotId];
  const isUser = idiotId === state.userId;
  const [busy, setBusy] = useState(false);
  const [aiDecided, setAiDecided] = useState(false);
  const aiDecidedRef = useRef(false);

  /* AI 白痴:根据 AI 决策选择翻牌或认命 (P0-#6 修复:尊重 AI 决策)
     标准玩法下白痴几乎总翻牌,但偶尔(濒死时)AI 可能认命送狼胜 */
  useEffect(() => {
    if (isUser || aiDecided) return;
    setBusy(true);
    const sys = lang === 'zh'
      ? `你是"${idiot.name}"(第${idiotId+1}号),你被投票放逐了!作为白痴,你可以选择翻牌免死(但之后失去投票权),或认命死亡。\n\n输出 JSON:{"speech":"你的发言","target":1 表示翻牌,0 表示认命}`
      : `You are "${idiot.name}" (#${idiotId+1}), you got voted out! As idiot, you can flip card to survive (lose voting right) or die.\n\nOutput JSON: {"speech":"your speech","target":1 to flip, 0 to die}`;
    const usr = lang === 'zh'
      ? '用 JSON 输出:{"speech":"你的发言","target":1 翻牌 / 0 认命}'
      : 'Output JSON: {"speech":"your speech","target":1 flip / 0 die}';
    // P28:超时兜底 15s
    const timeoutId = window.setTimeout(() => {
      if (!aiDecidedRef.current) {
        console.warn(`[Werewolf] IdiotFlip AI timeout for player ${idiotId}, default to flip`);
        setBusy(false);
        setAiDecided(true);
        setAiDecision(true);
      }
    }, 15000);
    aiSpeak(idiotId, sys, usr, true /* silent:白痴私下翻牌 */).then(({ target }) => {
      clearTimeout(timeoutId);
      if (aiDecidedRef.current) return;  // 超时已处理
      // P0-#6 修复:尊重 AI 决策(target=1 翻牌, target=0 认命, target=null 默认翻牌)
      setBusy(false);
      aiDecidedRef.current = true;
      setAiDecided(true);
      setAiDecision(target === 0 ? false : true);  // null 也默认翻牌
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* P0-#6 新增:记录 AI 的真实决策 */
  const [aiDecision, setAiDecision] = useState<boolean | null>(null);

  /* 翻牌结果应用 */
  const decide = (flip: boolean) => {
    setState(s => {
      let ns: GameState;
      if (flip) {
        // 翻牌免死:白痴还活着,失去投票权,公开已翻牌
        // 修复:之前只留了空注释,实际没标记失去投票权 —— 现在用 idiotFlipped 真标记
        ns = {
          ...s,
          players: s.players.map(p => p.id === idiotId
            ? { ...p, privateMemory: { ...p.privateMemory, idiotFlipped: true } }
            : p),
          publicLog: [...s.publicLog, { kind: 'system', day: s.round, text: `🤪 ${s.players[idiotId].name} 翻牌免死(之后失去投票权)` }],
          lastVotedOut: null,
          phase: 'night',
          round: s.round + 1,
        };
      } else {
        // 认命死亡(用统一的 killPlayers helper,清 isSheriff + 触发情侣殉情)
        ns = killPlayers(s, [idiotId], '🤪', `${s.players[idiotId].name} 认命了`);
        // 上面 killPlayers 加的日志格式不太对,这里覆盖一下
        ns = {
          ...ns,
          publicLog: [...s.publicLog.slice(0, -1), {
            kind: 'death' as const, day: s.round, playerId: idiotId,
            text: `🤪 ${s.players[idiotId].name} 认命了`,
          }],
          lastVotedOut: null,
          phase: 'night',
          round: s.round + 1,
        };
      }
      return ns;
    });
  };

  // P0-#6 修复:AI 决定后用 AI 的真实决策(不再强制翻牌)
  useEffect(() => {
    if (!isUser && aiDecided && !busy && aiDecision !== null) {
      decide(aiDecision);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiDecided, busy, isUser, aiDecision]);

  return (
    <div className="p-4 rounded-xl" style={{ background: 'var(--color-card-bg)', border: '1px solid #a855f7' }}>
      <div className="flex items-center gap-2 mb-2 justify-center">
        <Skull size={20} style={{ color: '#a855f7' }} />
        <h3 className="font-semibold" style={{ color: 'var(--color-text)' }}>
          {lang === 'zh' ? '🤪 白痴翻牌' : '🤪 Idiot flip card'}
        </h3>
      </div>
      <p className="text-xs text-center mb-3" style={{ color: 'var(--color-text-muted)' }}>
        {isUser
          ? (lang === 'zh' ? '你被投票放逐了!作为白痴,你可以翻牌免死(但之后失去投票权):' : 'You got voted out! As idiot, flip card to survive (lose voting right):')
          : (lang === 'zh' ? `AI ${idiot.name} 正在决定…` : `AI ${idiot.name} deciding…`)}
      </p>
      {isUser ? (
        <div className="text-center space-x-2">
          <Button onClick={() => decide(true)}>
            {lang === 'zh' ? '翻牌免死' : 'Flip to survive'}
          </Button>
          <Button onClick={() => decide(false)}>
            {lang === 'zh' ? '认命' : 'Accept death'}
          </Button>
        </div>
      ) : (
        <div className="text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>
          {busy ? (lang === 'zh' ? '🤔 思考中…' : '🤔 thinking…') : (lang === 'zh' ? '已决定翻牌' : 'decided to flip')}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   狼王选人 (P0-#53 修复:狼王被投时分独立阶段,让用户/AI 战略选 victim)
   ── 之前是随机选,现在让:
   ── · 用户狼王:UI 选
   ── · AI 狼王:用 LLM 决策(选最值得带的人,如预言家嫌疑、女巫嫌疑)
   ═══════════════════════════════════════════════════════════════════ */

function WolfKingPick({ state, setState, lang, aiSpeak }: {
  state: GameState; setState: (u: (s: GameState) => GameState) => void;
  lang: 'zh' | 'en';
  aiSpeak: (id: number, sys: string, usr: string, silent?: boolean, options?: { temperature?: number; maxTokens?: number }) => Promise<{ speech: string; target: number | null; useAntidote?: boolean }>;
}) {
  const wolfKingId = state.lastVotedOut;
  const [victim, setVictim] = useState<number | null>(state.wolfkingVictim ?? null);
  const [busy, setBusy] = useState(false);
  const [aiDone, setAiDone] = useState(false);

  if (wolfKingId === null) {
    // 不应进入此 phase;兜底跳 night
    useEffect(() => { setState(s => ({ ...s, phase: 'night', round: s.round + 1 })); }, []);
    return null;
  }
  const wolfKing = state.players[wolfKingId];
  const isUser = wolfKingId === state.userId;
  // P29 修复:狼王带人不能选自己的狼队友(规则禁止)
  const wolfKingTeammates = new Set(
    (wolfKing.privateMemory?.wolfTeammates ?? []).concat([wolfKingId])
  );
  // 候选目标:存活的非狼队友(不能选自己 + 不能选狼)
  const aliveOthers = state.players.filter(p =>
    p.alive && p.id !== wolfKingId && !wolfKingTeammates.has(p.id)
  );
  // 兜底:如果没有可带的人(只剩狼队友),就强制跳到 night
  if (aliveOthers.length === 0) {
    useEffect(() => {
      setState(s => ({ ...s, phase: 'night', round: s.round + 1, wolfkingVictim: null }));
    }, []);
    return null;
  }

  /* AI 狼王:用 LLM 战略选 victim(不能选狼队友) */
  useEffect(() => {
    if (isUser || aiDone || busy || victim !== null) return;
    setBusy(true);
    // 收集战略信息:已暴露的"预言家"
    const seerSuspects = state.players.filter(p => p.alive && p.role !== 'seer').slice(0, 3).map(p => `${p.id + 1}号 ${p.name}`);
    const sys = lang === 'zh'
      ? `你是"${wolfKing.name}"(第${wolfKingId+1}号),你是狼王,被投票放逐了!你临死前可以带走一名玩家。\n可带走的非狼队友:${aliveOthers.map(p => `${p.id+1}号 ${p.name}`).join('、')}\n\n战术建议(必须遵守规则):\n- **不能带自己的狼队友**(规则禁止,会浪费技能)\n- 优先带走「最像预言家」的(发言最像神职的)\n- 或带走「女巫」(解药用过的)\n- 重点目标:${seerSuspects.join('、')}\n\n输出 JSON:{"speech":"你的遗言(可选)","target":你要带走的玩家座位号(1-based)}`
      : `You are "${wolfKing.name}" (#${wolfKingId+1}), Wolf King, voted out! Take one victim with you.\nValid non-wolf targets: ${aliveOthers.map(p => `${p.id+1} ${p.name}`).join(', ')}\n\nTactics:\n- **Cannot take wolf teammates** (rule forbids)\n- Prefer Seer (most god-like speech)\n- Or Witch (if antidote used)\n\nOutput JSON: {"speech":"last words (optional)","target":target seat (1-based)}`;
    const usr = lang === 'zh' ? '用 JSON 输出:{"target":目标座位号(1-based)}' : 'Output JSON: {"target":target seat (1-based)}';
    // P28:超时兜底 20s,AI 卡死时随机选最可疑的
    const timeoutId = window.setTimeout(() => {
      console.warn(`[Werewolf] WolfKingPick AI timeout for ${wolfKingId}, fallback random`);
      const pick = aliveOthers[Math.floor(Math.random() * aliveOthers.length)];
      setVictim(pick.id);
      setBusy(false);
      setAiDone(true);
    }, 20000);
    aiSpeak(wolfKingId, sys, usr, true).then(({ target }) => {
      clearTimeout(timeoutId);
      // 验证 target 是合法非狼队友
      if (target !== null && target >= 0 && target < state.players.length
          && state.players[target].alive
          && target !== wolfKingId
          && !wolfKingTeammates.has(target)) {
        setVictim(target);
      }
      setBusy(false);
      setAiDone(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* 应用狼王选择:杀掉 victim + 触发殉情 + 进 last-words */
  const apply = (chosen: number | null) => {
    if (chosen === null) {
      // 跳过 → 直接进 night(无 victim)
      setState(s => ({ ...s, phase: 'night', round: s.round + 1, wolfkingVictim: null }));
      return;
    }
    setState(s => {
      // P0-#3 修复:用 killPlayers helper(清 isSheriff + 触发殉情)
      // P0-#53 修复:`as const` 只能用在值上,不能在类型注解里(用 'death' 字面量类型即可)
      const logEntry: { kind: 'death'; day: number; playerId: number; text: string } = {
        kind: 'death', day: s.round, playerId: chosen,
        text: `👑 ${s.players[chosen].name} 跟着去了(狼王带人)`,
      };
      const killed = killPlayers(s, [chosen], '👑', ` ${s.players[chosen].name} 跟着去了(狼王带人)`);
      // 修正日志(用更适合狼王带人的文案)
      const fixedLog = killed.publicLog.slice(0, -1).concat([logEntry]);
      let ns: GameState = {
        ...killed,
        publicLog: fixedLog,
        pendingLastWords: [...killed.pendingLastWords, chosen],
      };
      // 胜负检查
      const winner = checkWinner(ns);
      if (winner) {
        return { ...ns, phase: 'gameover', winner, wolfkingVictim: chosen };
      }
      // 进 last-words(已死的狼王 + victim + 殉情链)
      return { ...ns, phase: 'last-words', wolfkingVictim: chosen };
    });
  };

  // AI 决定后自动 apply
  useEffect(() => {
    if (!isUser && aiDone && !busy && victim !== null) {
      apply(victim);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiDone, busy, victim, isUser]);

  return (
    <div className="p-4 rounded-xl" style={{ background: 'var(--color-card-bg)', border: '1px solid #dc2626' }}>
      <div className="flex items-center gap-2 mb-2 justify-center">
        <Crown size={20} style={{ color: '#dc2626' }} />
        <h3 className="font-semibold" style={{ color: 'var(--color-text)' }}>
          {lang === 'zh' ? '👑 狼王发动技能' : '👑 Wolf King revenge'}
        </h3>
      </div>
      <p className="text-xs text-center mb-3" style={{ color: 'var(--color-text-muted)' }}>
        {isUser
          ? (lang === 'zh' ? '你被投票放逐!狼王可以带走一名玩家:' : 'You were voted out! Wolf King takes one with them:')
          : (lang === 'zh' ? `AI 狼王 ${wolfKing.name} 正在选人…` : `AI Wolf King ${wolfKing.name} choosing…`)}
      </p>
      {isUser ? (
        <>
          <div className="flex flex-wrap gap-1.5 justify-center">
            {aliveOthers.map(p => (
              <button key={p.id} onClick={() => setVictim(p.id)}
                className="px-2 py-1 rounded text-xs"
                style={{
                  background: victim === p.id ? '#dc2626' : 'var(--color-card-bg)',
                  color: victim === p.id ? '#fff' : 'var(--color-text)',
                }}>{p.id + 1}.{p.name}</button>
            ))}
          </div>
          <div className="text-center mt-3 space-x-2">
            <Button onClick={() => apply(null)}>
              {lang === 'zh' ? '不带走' : 'Skip'}
            </Button>
            <Button onClick={() => apply(victim)} disabled={victim === null}>
              {lang === 'zh' ? '带走!' : 'Take them!'} <Skull size={14} className="ml-1" />
            </Button>
          </div>
        </>
      ) : (
        <div className="text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>
          {busy
            ? (lang === 'zh' ? '🤔 思考中…' : '🤔 thinking…')
            : (lang === 'zh' ? '已选目标,带走!' : 'Target chosen, taking them!')}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   警长竞选(12 人局第一个白天)
   ── 标准规则(用户口径):
   · 阶段 1 报名:所有存活玩家选择"参加"或"不参加"警长竞选
   · 阶段 2 竞选发言:候选人按发言顺序逐一发言(30-60 秒)
   · 阶段 3 退水 / 刚警徽:候选人可以"退水"(退出)或"刚警徽"(继续)
   · 阶段 4 投票:未参与竞选的人在未退水的候选人中选 1 人
   · 阶段 5 平票 PK:若平票,平票者按发言顺序"逆序"再发言,其他人再投票
   · 阶段 6 警徽流失:若 PK 后仍平票,本局无警长
   · 警长 = 1.5 票投票权(vote 票数 = 2,普通玩家 = 1)
   ═══════════════════════════════════════════════════════════════════ */

/* 警长竞选内部阶段(在 sheriff-election phase 内的子阶段) */
type SheriffStep = 'register' | 'speech' | 'withdraw' | 'vote' | 'pk-speech' | 'pk-vote' | 'done';

function SheriffElection({ state, setState, lang, aiSpeak, onExit }: {
  state: GameState; setState: (u: (s: GameState) => GameState) => void;
  lang: 'zh' | 'en';
  aiSpeak: (id: number, sys: string, usr: string, silent?: boolean, options?: { temperature?: number; maxTokens?: number }) => Promise<{ speech: string; target: number | null }>;
  /** P11-A:死者退出按钮 */
  onExit?: () => void;
}) {
  const alivePlayers = state.players.filter(p => p.alive);
  // 初始化 sheriffElection(如果还没有)
  const election = state.sheriffElection ?? { registeredIds: [], withdrawnIds: [], pkRound: 0, speechIdx: 0 };
  /* 推断当前子阶段(根据 state 推导) */
  const [step, setStep] = useState<SheriffStep>('register');
  // 用户本地选择
  const [userRegister, setUserRegister] = useState<boolean | null>(null);
  const [userWithdrew, setUserWithdrew] = useState<boolean | null>(null);
  const [userVote, setUserVote] = useState<number | null>(null);
  const [userSpeech, setUserSpeech] = useState('');
  // 临时状态
  const [busy, setBusy] = useState(false);
  const [tiedIds, setTiedIds] = useState<number[] | null>(null);  // 平票者
  const [aiDecisions, setAiDecisions] = useState<Record<number, 'register' | 'skip' | 'withdraw' | 'stay'>>({});
  const [aiVotes, setAiVotes] = useState<Record<number, number>>({});
  const stateRef = useRef(state);
  stateRef.current = state;

  // P5 修复:死人不能参与警长竞选(用户原话:"我已经上警为啥我还能投警徽票")
  const userAlive = state.players[state.userId]?.alive;
  // P17-fix:观看模式标志 —— 全程自动跑,不渲染用户决策按钮
  const isSpectator = state.spectatorMode;
  // P16:观看模式下用户不在游戏中,不需要 DeadSpectator
  if (!isSpectator && !userAlive) {
    return <DeadSpectator state={state} lang={lang}
      busyHint={busy ? (lang === 'zh' ? '⭐ 警长竞选进行中…' : '⭐ Sheriff election in progress…') : undefined}
      onExit={onExit} />;
  }

  /* 推导:候选人列表(已报名 - 已退水) */
  const candidates = election.registeredIds.filter(id => !election.withdrawnIds.includes(id));
  // 当前阶段的 speakers 列表(根据 step 推导)
  // - step = 'speech'   : 候选人按注册顺序
  // - step = 'pk-speech': 平票者按候选人位置逆序
  const pkSpeakers = (step === 'pk-speech' && tiedIds)
    ? candidates.filter(c => tiedIds.includes(c)).slice().reverse()
    : [];
  const currentSpeakers = step === 'pk-speech' ? pkSpeakers : candidates;
  const currentSpeakerId = currentSpeakers[election.speechIdx];

  /* AI 决定:报名 / 跳过
     P1-#22 修复(用户反馈:预言家必须上警):
     预言家 100% 必报名(警长是预言家的护身符,预言家不上警会被狼集火)
     其他神职 60%(高于之前的 25%,神职上警能带队)
     狼 40%(不变,狼想抢警徽)
     普通村民 15% */
  useEffect(() => {
    if (step !== 'register' || userRegister === null) return;
    if (Object.keys(aiDecisions).length >= alivePlayers.length - (state.userId !== null && userRegister !== null ? 1 : 0)) return;
    const decisions: Record<number, 'register' | 'skip'> = {};
    for (const p of alivePlayers) {
      if (p.id === state.userId) continue;  // 用户自己不算
      let prob = 0.15;
      if (p.role === 'seer') prob = 1.0;  // 预言家 100% 必报名(用户要求)
      else if (p.faction === 'wolf') prob = 0.4;
      else if (['witch', 'hunter', 'guard', 'knight'].includes(p.role)) prob = 0.6;
      decisions[p.id] = Math.random() < prob ? 'register' : 'skip';
    }
    // 修复(P0):真预言家上警后必须强制一只狼对跳(也上警)
    // 之前:seer 100% 报名 + 狼只有 40% → 可能出现"真预 100% 上警,狼一只没上"
    //       → 警徽直接落入真预口袋,狼阵营没翻盘机会,游戏不平衡
    // 现在:检测到有真预报名(AI seer 100% 必报 或 用户是 seer 且 userRegister=true),
    //       且没有任何狼报名 → 强制一只活着的 AI 狼报名(对跳)
    const userIsSeer = state.players[state.userId]?.role === 'seer';
    const userIsRegisteringAsSeer = userIsSeer && userRegister;
    const seerRegistered = userIsRegisteringAsSeer
      || Object.entries(decisions).some(([pid, dec]) =>
        dec === 'register' && state.players[parseInt(pid, 10)]?.role === 'seer'
      );
    if (seerRegistered) {
      const anyWolfRegistered = Object.entries(decisions).some(([pid, dec]) =>
        dec === 'register' && state.players[parseInt(pid, 10)]?.faction === 'wolf'
      );
      if (!anyWolfRegistered) {
        const wolvesAlive = alivePlayers.filter(p => p.faction === 'wolf' && p.id !== state.userId);
        if (wolvesAlive.length > 0) {
          const pickWolf = wolvesAlive[Math.floor(Math.random() * wolvesAlive.length)];
          decisions[pickWolf.id] = 'register';
        }
      }
    }
    setAiDecisions(prev => ({ ...prev, ...decisions }));
  }, [step, userRegister, alivePlayers.length, state.userId, aiDecisions]);

  /* 报名阶段 → 进入发言 */
  const confirmRegister = () => {
    setBusy(true);
    const registered = [...election.registeredIds];
    if (!isSpectator && userRegister) registered.push(state.userId);
    for (const [pid, dec] of Object.entries(aiDecisions)) {
      if (dec === 'register' && !registered.includes(parseInt(pid, 10))) {
        registered.push(parseInt(pid, 10));
      }
    }
    if (registered.length === 0) {
      // 没人报名 → 警徽流失,直接进 day-discuss
      setState(s => ({
        ...s,
        sheriffElection: { ...election, registeredIds: [], withdrawnIds: [], pkRound: 0, speechIdx: 0 },
        publicLog: [...s.publicLog, { kind: 'system', day: s.round, text: '⭐ 无人报名警长竞选,警徽流失。' }],
        phase: 'day-discuss',
      }));
      return;
    }
    setState(s => ({
      ...s,
      sheriffElection: { ...election, registeredIds: registered, withdrawnIds: [], pkRound: 0, speechIdx: 0 },
      publicLog: [...s.publicLog, {
        kind: 'system', day: s.round,
        text: `⭐ 警长竞选报名:${registered.map(id => `${id+1}号 ${s.players[id].name}`).join('、')}(共 ${registered.length} 人)`,
      }],
    }));
    setStep('speech');
    setBusy(false);
  };

  /* 发言阶段:AI 自动逐个发言
     P1-#22 修复(用户反馈:6 号玩家重复发言):
     最后一个候选人发言时,setState 返回 s 不改 speechIdx,导致 useEffect 重跑时
     currentSpeakerId 仍是同一个玩家 → 无限循环。
     修法:在 .then() 里同步推进 setStep(不依赖 listener useEffect),
     并加 lastProcessedSpeakerRef 防止 setState 失败时的 race。

     P15 修复(用户反馈"5 候选人 4 退水还有 1 没发言,卡死"):
     - 加 30 秒超时:AI 不返回就强制下一位 + 占位发言
     - 避免 AI 卡死导致整个警长阶段僵住 */
  const lastProcessedSpeakerRef = useRef<number | null>(null);
  useEffect(() => {
    if (step !== 'speech' || !currentSpeakerId) return;
    if (lastProcessedSpeakerRef.current === currentSpeakerId) return;  // 防止重复
    const speaker = stateRef.current.players[currentSpeakerId];
    if (speaker.id === state.userId) return;  // 用户自己,等用户操作
    if (busy) return;
    lastProcessedSpeakerRef.current = currentSpeakerId;
    setBusy(true);
    // P32 强化(用户反馈"预言家必须报查验"):真预言家 + 悍跳预言家的狼必须在上警发言中报查验
    const isRealSeer = speaker.role === 'seer';
    const speakerChecks = (speaker.privateMemory?.seerChecks ?? []).slice(0, 2);  // 取最近 2 次
    // 悍跳预言家的狼:不是真预言家 + 是狼(只能编造查验)
    const isJumpingSeer = !isRealSeer && speaker.faction === 'wolf';
    const seerExtra = isRealSeer
      ? (lang === 'zh'
          ? `\n\n【硬性要求 · 预言家报查验】你是真预言家,必须在上警发言中报出你的查验结果(至少 1 条):\n${speakerChecks.map(c => `${c.targetId+1}号 → ${c.isWolf ? '狼人' : '好人'}`).join('、')}\n格式参考:"我是预言家,昨晚验了 X 号,他是狼人/好人"。\n不报查验 = 你会自动被强制退水。`
          : `\n\n[MANDATORY · Seer report] You are the real seer. You MUST report your checks (at least 1):\n${speakerChecks.map(c => `#${c.targetId+1} → ${c.isWolf ? 'wolf' : 'good'}`).join(', ')}\nFormat: "I am the seer, last night I checked #X, they are wolf/good".\nNo report = you will be forced to withdraw.`)
      : isJumpingSeer
      ? (lang === 'zh'
          ? `\n\n【硬性要求 · 悍跳预言家】你作为狼人,必须在上警发言中假装预言家并报出"查验结果"(可编造):\n格式:"我是预言家,昨晚验了 X 号,他是狼人/好人"。至少报 1 条。\n不报 = 你会自动被强制退水。`
          : `\n\n[MANDATORY · Wolf posing as seer] You must claim seer and report "checks" (can fabricate):\nFormat: "I am the seer, I checked #X, wolf/good". At least 1.\nNo claim = forced to withdraw.`)
      : '';
    const sys = lang === 'zh'
      ? `你是"${speaker.name}"(第${speaker.id+1}号),你正在参加警长竞选!请发言拉票(30-80 字):\n- 说明你的身份/立场/逻辑(可不暴露真身份)\n- 表态你作为警长会做的事(带队、归票、坚守)\n- 可以攻击其他候选人${seerExtra}\n\n只输出你的竞选发言,不要 JSON 包装。`
      : `You are "${speaker.name}", running for sheriff! Give a 30-80 word campaign speech explaining your stance and attacking other candidates.${seerExtra} Output speech only.`;
    const usr = lang === 'zh' ? '请发言拉票' : 'Give campaign speech';

    // P15:超时保护 — 30 秒没响应强制下一位(用占位发言)
    let timeoutFired = false;
    const timeoutId = window.setTimeout(() => {
      timeoutFired = true;
      advanceSpeech(currentSpeakerId, lang === 'zh'
        ? `(AI 超时未响应,请等待系统强制)`
        : `(AI timed out, system advancing)`);
    }, 30000);

    function advanceSpeech(speakerId: number, speech: string) {
      setBusy(false);
      // P6-#D 修复:警长竞选发言也检测 seer claim(否则退水时没人能留)
      setState(s => {
        const cur = s.sheriffElection!;
        const newClaims = { ...(s.claims || {}) };
        if (!newClaims[s.round]) newClaims[s.round] = { seerClaims: [], witchClaims: [], guardClaims: [] };
        const dayClaims = newClaims[s.round];
        if (/^\s*(我是预言家|我是预|i\s*am\s*the\s*seer)/i.test(speech)) {
          const checkRe = /验了?\s*(\d{1,2})\s*号\s*[,,。\s]*\s*他是?\s*(狼|好人|wolf|good)/gi;
          const matches = [...speech.matchAll(checkRe)];
          const checks: { targetId: number; isWolf: boolean }[] = matches.map(m => {
            const num = parseInt(m[1], 10) - 1;
            const isWolf = /狼|wolf/i.test(m[2]);
            return { targetId: num, isWolf };
          }).filter(c => c.targetId >= 0 && c.targetId < s.players.length);
          // 候选人在警长发言里跳预 → 加入 seerClaims
          // 没具体查验的也允许(简化:加空 checks,但标记有 claim)
          const existing = dayClaims.seerClaims.findIndex(c => c.playerId === speakerId);
          if (existing >= 0) {
            dayClaims.seerClaims[existing] = { playerId: speakerId, checks: checks.length ? checks : [{ targetId: -1, isWolf: false }] };
          } else if (dayClaims.seerClaims.length < 3) {
            dayClaims.seerClaims.push({ playerId: speakerId, checks: checks.length ? checks : [{ targetId: -1, isWolf: false }] });
          }
        }
        // 把发言记入 state.speeches(占位或真发言都要记)
        const newSpeechRecord = { playerId: speakerId, day: s.round, text: speech, phase: 'sheriff-speech' as const };
        const newIdx = cur.speechIdx + 1;
        const totalCands = cur.registeredIds.filter(id => !cur.withdrawnIds.includes(id)).length;
        if (newIdx >= totalCands) {
          setStep('withdraw');
          return { ...s, claims: newClaims, speeches: [...s.speeches, newSpeechRecord] };
        }
        return { ...s, sheriffElection: { ...cur, speechIdx: newIdx }, claims: newClaims, speeches: [...s.speeches, newSpeechRecord] };
      });
    }

    // AI 真实返回 → 用真发言 + 清掉超时
    aiSpeak(speaker.id, sys, usr).then(({ speech }) => {
      if (timeoutFired) return;  // 已经超时走兜底了,不再覆盖
      window.clearTimeout(timeoutId);
      advanceSpeech(currentSpeakerId, speech);
    });
  }, [step, currentSpeakerId, state.userId, busy, aiSpeak, lang]);

  /* 监听:发言结束 → 退水阶段(普通)或 pk-vote(PK) */
  useEffect(() => {
    if (step === 'speech' && candidates.length > 0 && election.speechIdx >= candidates.length) {
      setStep('withdraw');
    }
    if (step === 'pk-speech' && pkSpeakers.length > 0 && election.speechIdx >= pkSpeakers.length) {
      setStep('pk-vote');
    }
  }, [step, election.speechIdx, candidates.length, pkSpeakers.length]);

  // P17-fix:观看模式下全程自动推进 ——
  // 用户不在游戏中,不能依赖任何"点下一步"按钮。
  // 策略:
  //   register   → AI 决策齐了 → confirmRegister()
  //   speech     → AI 发言跑完(由现有 useEffect 自动推到 withdraw)→ 进入下个 step
  //   withdraw   → AI 决策齐了 → confirmWithdraw()(进入 vote 或 done)
  //   vote/pk-vote → AI 投完 → confirmVote()
  //   pk-speech  → AI 发言跑完 → 进入 pk-vote
  const autoTriggeredRef = useRef<string | null>(null);  // 用 step 标识本步已触发
  useEffect(() => {
    if (!isSpectator || busy) return;
    if (autoTriggeredRef.current === step) return;  // 本步骤已自动触发过
    // register:先 setUserRegister(false) 触发 AI 决策 useEffect,等 AI decisions 覆盖完所有活人
    if (step === 'register') {
      if (userRegister === null) {
        setUserRegister(false);  // 触发下方 AI 决策 useEffect 跑(它依赖 userRegister !== null)
        return;
      }
      const aiCount = Object.keys(aiDecisions).length;
      // AI 决策 useEffect 的停止条件是 `alivePlayers.length - 1`(扣掉用户占位),
      // 所以这里同样阈值即可
      if (aiCount >= alivePlayers.length - 1) {
        autoTriggeredRef.current = step;
        confirmRegister();
      }
      return;
    }
    // withdraw:等 AI decisions 覆盖完所有 candidates
    if (step === 'withdraw') {
      // candidates 不包含用户(观看模式 userId=-1)
      const aiCountForCands = candidates.filter(cid => cid !== state.userId).length;
      const decidedCount = candidates.filter(cid => cid !== state.userId && aiDecisions[cid] !== undefined).length;
      if (aiCountForCands === 0 || decidedCount >= aiCountForCands) {
        autoTriggeredRef.current = step;
        confirmWithdraw();
      }
      return;
    }
    // vote / pk-vote:等 aiVotes 覆盖完所有非候选人活人
    if (step === 'vote' || step === 'pk-vote') {
      const targetPool = step === 'pk-vote' && tiedIds ? tiedIds : candidates;
      const voters = step === 'pk-vote' && tiedIds
        ? alivePlayers.filter(p => !tiedIds.includes(p.id) && p.id !== state.userId)
        : alivePlayers.filter(p => !targetPool.includes(p.id) && p.id !== state.userId);
      const votedCount = voters.filter(v => aiVotes[v.id] !== undefined).length;
      if (voters.length === 0 || votedCount >= voters.length) {
        autoTriggeredRef.current = step;
        confirmVote();
      }
      return;
    }
    // speech / pk-speech:已由现有 useEffect 自动跑 AI,无需此处再触发
  }, [step, busy, isSpectator, aiDecisions, aiVotes, candidates, tiedIds, alivePlayers, state.userId]);

  /* 退水阶段:每个候选人决定退水还是刚警徽
     P6-#D 修复(用户反馈:非预言家不该刚警徽):
     - 首轮(没有 isSheriff)→ 非预言家候选人必须退水(只有预言家/悍跳预言家的狼能拿警徽)
     - 后续轮(已有 isSheriff)→ 普通规则
     判定"是否有 claim":在今日 claims.seerClaims 里出现过 = 是预言家(真或假)

     P13 修复(用户反馈"全退水导致游戏卡死"):
     - 跳预言家的候选人(真预 + 悍跳狼)必须刚警徽,**不允许退水**
     - 否则会出现所有候选人都退了,游戏卡在 withdraw 阶段等用户决定
     - "全退水 → 警徽流失"作为兜底保留(只是正常情况下不会触发)

     P14 修复(用户实测"预言家也没上警,全退水卡死"):
     - 不依赖发言首句匹配正则识别预言家(AI 可能不用"我是预言家"开场)
     - 直接查 player.role === 'seer' 识别真预言家 → 强制 stay
     - 悍跳狼靠发言里的 claim 检测(原有逻辑)

     P32 修复(用户反馈"规则细化"):
     - 预言家 + 对跳预言家的狼: 不得退水(必须 stay)
     - 其他 AI 候选人: 原则上自动退水(默认决策 = withdraw,不再随机)
     - 神职/狼里**未跳预言家**的: 100% 退水
     - 普通村民里**未跳预言家**的: 100% 退水 */
  useEffect(() => {
    if (step !== 'withdraw') return;
    const decisions: Record<number, 'withdraw' | 'stay'> = {};
    // 首轮判定:现在还没有 isSheriff
    const isFirstRound = !state.players.some(p => p.privateMemory?.isSheriff);
    // 今日已跳预言家的人(claims.seerClaims 的 playerId)
    const seerClaimerIds = new Set((state.claims?.[state.round]?.seerClaims ?? []).map(c => c.playerId));
    for (const cid of candidates) {
      if (cid === state.userId) continue;
      const c = stateRef.current.players[cid];
      // 修复(P0 强化):真预言家(角色是 seer)直接识别,无需靠发言正则
      // AI 预言家经常不用"我是预言家"开场,导致 seerClaimerIds 检测失败
      if (c.role === 'seer') {
        decisions[cid] = 'stay';  // P32:真预言家不得退水(必须 stay)
        continue;
      }
      // P32:对跳预言家的狼(在 seerClaimerIds 里且不是真预言家)也必须 stay
      if (seerClaimerIds.has(cid)) {
        decisions[cid] = 'stay';  // 对跳预言家的狼不得退水
        continue;
      }
      // P32:其他候选人都强制退水(首轮非预言家 + 后续轮非预言家都不该拿警徽)
      //      只保留 stay 的两类: 真预 + 对跳预言家的狼
      if (isFirstRound) {
        decisions[cid] = 'withdraw';
        continue;
      }
      // 后续轮(已有 isSheriff 死亡触发传承)→ 概率退水,但概率更高(狼 50%,神职 60%,村民 70%)
      const probStay = c.faction === 'wolf' ? 0.5
        : ['seer', 'witch', 'hunter', 'guard', 'knight'].includes(c.role) ? 0.4
        : 0.3;
      decisions[cid] = Math.random() < probStay ? 'stay' : 'withdraw';
    }
    setAiDecisions(prev => {
      const next = { ...prev };
      for (const [k, v] of Object.entries(decisions)) next[parseInt(k, 10)] = v;
      return next;
    });
  }, [step, candidates.length, state.userId, candidates, state.claims?.[state.round]?.seerClaims?.length]);

  /* P11-B:防御性检查 —— 退水前必须确认所有候选人都发过言
     规则:用户原话"上警玩家都发过言后才投警徽票"
     检查:每个候选人必须有 phase='sheriff-speech' 的发言记录 */
  const candidatesHaveSpoken = candidates.every(cid => {
    return state.speeches.some(sp => sp.playerId === cid && sp.day === state.round && sp.phase === 'sheriff-speech');
  });

  /* 用户退水确认 */
  const confirmWithdraw = () => {
    // P11-B 防御性检查:必须所有候选人都发过言才能进投票(观看模式跳过,因为我们也不会卡这个)
    if (!isSpectator && !candidatesHaveSpoken) {
      const silentCandidates = candidates.filter(cid =>
        !state.speeches.some(sp => sp.playerId === cid && sp.day === state.round && sp.phase === 'sheriff-speech')
      ).map(cid => `${cid + 1}号`);
      window.alert(lang === 'zh'
        ? `⚠️ 还有候选人没发言: ${silentCandidates.join('、')}。\n必须所有候选人发过言后才能退水或投票。`
        : `⚠️ Some candidates haven't spoken: ${silentCandidates.join(', ')}.\nAll candidates must speak before withdraw/vote.`);
      return;
    }
    setBusy(true);
    const withdrawn = [...election.withdrawnIds];
    // P26:用户活着 + 选退水 → 加入退水名单(死了就不管了)
    if (!isSpectator && userWithdrew === true && state.players[state.userId]?.alive) {
      if (!withdrawn.includes(state.userId)) withdrawn.push(state.userId);
    }
    for (const [pid, dec] of Object.entries(aiDecisions)) {
      if (dec === 'withdraw' && !withdrawn.includes(parseInt(pid, 10))) {
        withdrawn.push(parseInt(pid, 10));
      }
    }
    const remaining = election.registeredIds.filter(id => !withdrawn.includes(id));
    if (remaining.length === 0) {
      // 全退水 → 警徽流失
      setState(s => {
        const baseState: GameState = {
          ...s,
          sheriffElection: { ...election, withdrawnIds: withdrawn, pkRound: 0, speechIdx: 0 },
          publicLog: [...s.publicLog, { kind: 'system', day: s.round, text: '⭐ 所有候选人都退水了,警徽流失。' }],
        };
        // P13:应用延后结算的死亡(round === 1 时 12+ 人局会有 deferredDeaths)
        if (s.deferredDeaths.length > 0) {
          return applyDeferredDeaths(baseState);
        }
        return { ...baseState, phase: 'day-discuss' };
      });
      setStep('done');
      return;
    }
    if (remaining.length === 1) {
      // 只剩一个 → 自动当选
      const winner = remaining[0];
      setState(s => {
        const baseState: GameState = {
          ...s,
          sheriffElection: { ...election, withdrawnIds: withdrawn, pkRound: 0, speechIdx: 0 },
          players: s.players.map(p => p.id === winner ? { ...p, privateMemory: { ...p.privateMemory, isSheriff: true } } : p),
          publicLog: [...s.publicLog, { kind: 'system', day: s.round, text: `⭐ ${s.players[winner].name} 唯一未退水,自动当选警长(1.5 票)` }],
        };
        // P13:应用延后结算的死亡
        if (s.deferredDeaths.length > 0) {
          return applyDeferredDeaths(baseState);
        }
        return { ...baseState, phase: 'day-discuss' };
      });
      setStep('done');
      return;
    }
    setState(s => ({
      ...s,
      sheriffElection: { ...election, withdrawnIds: withdrawn, pkRound: 0, speechIdx: 0 },
      publicLog: [...s.publicLog, {
        kind: 'system', day: s.round,
        text: `⭐ 退水后剩余候选人:${remaining.map(id => `${id+1}号 ${s.players[id].name}`).join('、')}(共 ${remaining.length} 人)`,
      }],
    }));
    setStep('vote');
    setBusy(false);
  };

  /* 投票阶段:非候选人的所有存活玩家投票(可投平票) */
  useEffect(() => {
    if (step !== 'vote' && step !== 'pk-vote') return;
    if (Object.keys(aiVotes).length > 0) return;
    // 平票时,只让 tiedIds 里的人在剩下的人里重新投票;否则所有非候选人投票
    const voters = step === 'pk-vote' && tiedIds
      ? alivePlayers.filter(p => !tiedIds.includes(p.id) && p.id !== state.userId)
      : alivePlayers.filter(p => !candidates.includes(p.id) && p.id !== state.userId);
    setBusy(true);
    (async () => {
      const votes: Record<number, number> = {};
      const targetPool = step === 'pk-vote' && tiedIds ? tiedIds : candidates;
      for (const p of voters) {
        // 简化 AI 投票:狼投队友(若队友是候选),否则随机
        let choice = targetPool[Math.floor(Math.random() * targetPool.length)];
        if (p.faction === 'wolf') {
          const wolfMate = targetPool.find(id => {
            const c = stateRef.current.players[id];
            return c.faction === 'wolf' && c.id !== p.id;
          });
          if (wolfMate !== undefined) choice = wolfMate;
        }
        votes[p.id] = choice;
      }
      setAiVotes(votes);
      setBusy(false);
    })();
  }, [step, tiedIds, candidates, alivePlayers, state.userId]);

  /* 用户确认投票 → 统计 → 判定胜负或平票 PK */
  const confirmVote = () => {
    if (!isSpectator && userVote === null) return;
    const targetPool = step === 'pk-vote' && tiedIds ? tiedIds : candidates;
    // 收集所有票(AI + 用户)
    const allVotes: { voterId: number; targetId: number }[] = [];
    for (const [vid, tid] of Object.entries(aiVotes)) {
      allVotes.push({ voterId: parseInt(vid, 10), targetId: tid as number });
    }
    if (!isSpectator && userVote !== null && targetPool.includes(userVote)) {
      allVotes.push({ voterId: state.userId, targetId: userVote });
    }
    // 计票
    const tally: Record<number, number> = {};
    allVotes.forEach(v => {
      tally[v.targetId] = (tally[v.targetId] || 0) + 1;
    });
    const maxVotes = Object.values(tally).length > 0 ? Math.max(...Object.values(tally)) : 0;
    const topTied = Object.entries(tally).filter(([_, c]) => c === maxVotes).map(([id]) => parseInt(id, 10));
    if (topTied.length > 1) {
      // 平票 → 推进 pkRound
      const newPkRound = election.pkRound + 1;
      if (newPkRound > 1) {
        // 第二次 PK 还平 → 警徽流失
        setState(s => {
          const baseState: GameState = {
            ...s,
            sheriffElection: { ...election, pkRound: newPkRound, speechIdx: 0 },
            publicLog: [...s.publicLog, { kind: 'system', day: s.round, text: '⭐ PK 后仍平票,警徽流失!' }],
          };
          // P13:应用延后结算的死亡
          if (s.deferredDeaths.length > 0) {
            return applyDeferredDeaths(baseState);
          }
          return { ...baseState, phase: 'day-discuss' };
        });
        setStep('done');
        return;
      }
      // 进入 PK:平票者按发言顺序"逆序"再发言
      setTiedIds(topTied);
      setAiVotes({});  // 清空投票
      setUserVote(null);
      // speechIdx 设为候选人列表中第一个平票者的位置
      const firstTiedInOrder = candidates.findIndex(c => topTied.includes(c));
      setState(s => ({
        ...s,
        sheriffElection: { ...election, pkRound: newPkRound, speechIdx: firstTiedInOrder >= 0 ? firstTiedInOrder : 0 },
        publicLog: [...s.publicLog, {
          kind: 'system', day: s.round,
          text: `⭐ 警长投票平票(${topTied.map(id => `${id+1}号 ${s.players[id].name}`).join('、')}),进入 PK 发言(逆序)`,
        }],
      }));
      setStep('pk-speech');
      return;
    }
    // 有人胜出
    const winner = topTied[0];
    setState(s => {
      const baseState: GameState = {
        ...s,
        sheriffElection: { ...election, pkRound: election.pkRound + 1, speechIdx: 0 },
        players: s.players.map(p => p.id === winner ? { ...p, privateMemory: { ...p.privateMemory, isSheriff: true } } : p),
        publicLog: [...s.publicLog, { kind: 'system', day: s.round, text: `⭐ ${s.players[winner].name} 当选警长(1.5 票投票权)` }],
      };
      // P13:应用延后结算的死亡
      if (s.deferredDeaths.length > 0) {
        return applyDeferredDeaths(baseState);
      }
      return { ...baseState, phase: 'day-discuss' };
    });
    setStep('done');
  };

  /* PK 发言:平票者按候选人列表中的逆序重新发言 */
  useEffect(() => {
    if (step !== 'pk-speech' || !tiedIds) return;
    // 修复(P0):必须与渲染时的 pkSpeakers 顺序一致(都是 reverse),否则用户找不到自己的发言轮
    const tiedInOrder = candidates.filter(c => tiedIds.includes(c)).slice().reverse();
    // 简化:从 election.speechIdx 开始遍历 tiedInOrder
    const curSpeakerId = tiedInOrder[election.speechIdx];
    if (!curSpeakerId) {
      // 全部 PK 发言完 → 进入 pk-vote
      setStep('pk-vote');
      return;
    }
    const speaker = stateRef.current.players[curSpeakerId];
    if (speaker.id === state.userId) return;
    if (busy) return;
    setBusy(true);
    const sys = lang === 'zh'
      ? `你是"${speaker.name}"(第${speaker.id+1}号),你正在参加警长竞选 PK(平票再次发言)!请用更激烈的发言拉票(30-80 字):\n- 强调自己更适合当警长\n- 攻击其他平票者\n- 给出承诺\n\n只输出你的发言。`
      : `You are "${speaker.name}", in sheriff PK! Give a 30-80 word speech to win over voters. Output speech only.`;
    const usr = lang === 'zh' ? 'PK 发言' : 'PK speech';
    aiSpeak(speaker.id, sys, usr).then(() => {
      setBusy(false);
      setState(s => {
        const cur = s.sheriffElection!;
        return { ...s, sheriffElection: { ...cur, speechIdx: cur.speechIdx + 1 } };
      });
    });
  }, [step, tiedIds, election.speechIdx, state.userId, busy, candidates, aiSpeak, lang]);

  /* ─── 渲染 ─── */
  if (step === 'register') {
    return (
      <div className="p-4 rounded-xl" style={{ background: 'var(--color-card-bg)', border: '1px solid #facc15' }}>
        <h3 className="font-semibold mb-2 flex items-center gap-1.5 justify-center" style={{ color: '#facc15' }}>
          ⭐ {lang === 'zh' ? '警长竞选 · 报名' : 'Sheriff · Register'}
        </h3>
        <p className="text-xs text-center mb-3" style={{ color: 'var(--color-text-muted)' }}>
          {lang === 'zh' ? '所有存活玩家选择是否参加警长竞选:' : 'All alive players choose whether to run:'}
        </p>
        {isSpectator ? (
          <p className="text-xs text-center mb-3 py-2" style={{ color: 'var(--color-text-muted)' }}>
            👁️ {lang === 'zh' ? '观看模式:你不在游戏中,所有 AI 自行决定…' : 'Spectator: AI deciding…'}
          </p>
        ) : (
          <>
            <p className="text-xs mb-2" style={{ color: 'var(--color-text-muted)' }}>
              {lang === 'zh' ? '你:' : 'You:'}
            </p>
            <div className="flex gap-2 justify-center mb-3">
              <Button onClick={() => setUserRegister(true)}
                style={userRegister === true ? { background: '#facc15', color: '#000' } : undefined}>
                {lang === 'zh' ? '✅ 参加' : '✅ Run'}
              </Button>
              <Button onClick={() => setUserRegister(false)}
                style={userRegister === false ? { background: '#facc15', color: '#000' } : undefined}>
                {lang === 'zh' ? '❌ 不参加' : '❌ Skip'}
              </Button>
            </div>
          </>
        )}
        <p className="text-[10px] text-center mb-2" style={{ color: 'var(--color-text-muted)' }}>
          {lang === 'zh' ? `已报名(AI):${Object.values(aiDecisions).filter(d => d === 'register').length} 人` : `AI registered: ${Object.values(aiDecisions).filter(d => d === 'register').length}`}
        </p>
        {!isSpectator && (
          <div className="text-center mt-3">
            <Button onClick={confirmRegister} disabled={userRegister === null}>
              {lang === 'zh' ? '下一步' : 'Next'} <ChevronRight size={14} className="ml-1" />
            </Button>
          </div>
        )}
      </div>
    );
  }

  if (step === 'speech' || step === 'pk-speech') {
    const speakers = currentSpeakers;
    const curId = speakers[election.speechIdx];
    if (!curId) {
      // 全部发言完
      setStep(step === 'speech' ? 'withdraw' : 'pk-vote');
      return null;
    }
    const speaker = state.players[curId];
    const isUserTurn = curId === state.userId && !busy;
    const orderHint = step === 'pk-speech' ? (lang === 'zh' ? '(逆序 PK 发言)' : '(reverse PK order)') : '';
    const submitUserSpeech = () => {
      const text = userSpeech.trim() || (lang === 'zh' ? '(我请大家支持我)' : '(please support me)');
      setState(s => {
        const cur = s.sheriffElection!;
        return {
          ...s,
          speeches: [...s.speeches, { playerId: s.userId, day: s.round, text, phase: 'sheriff-speech' }],
          publicLog: [...s.publicLog, { kind: 'speech', day: s.round, playerId: s.userId, text }],
          sheriffElection: { ...cur, speechIdx: cur.speechIdx + 1 },
        };
      });
      setUserSpeech('');
    };
    return (
      <div className="p-4 rounded-xl" style={{ background: 'var(--color-card-bg)', border: '1px solid #facc15' }}>
        <h3 className="font-semibold mb-2 flex items-center gap-1.5 justify-center" style={{ color: '#facc15' }}>
          ⭐ {lang === 'zh' ? `警长竞选发言 ${orderHint}(${Math.min(election.speechIdx + 1, speakers.length)}/${speakers.length})` : `Sheriff Speech ${orderHint}`}
        </h3>
        {busy ? (
          <p className="text-sm text-center py-3" style={{ color: 'var(--color-text-muted)' }}>
            {lang === 'zh' ? `AI ${speaker.name} 正在发言…` : `AI ${speaker.name} speaking…`}
          </p>
        ) : isUserTurn ? (
          <div>
            <p className="text-xs mb-2" style={{ color: 'var(--color-text-muted)' }}>
              {lang === 'zh' ? '🎤 轮到你拉票发言(30-80 字):' : 'Your campaign speech (30-80 words):'}
            </p>
            <textarea
              value={userSpeech}
              onChange={e => setUserSpeech(e.target.value)}
              placeholder={lang === 'zh' ? '介绍自己 / 攻击对手 / 给出承诺' : 'Introduce yourself / attack opponents / make promises'}
              className="w-full p-2 rounded text-sm"
              style={{ background: 'var(--color-bg-deep)', color: 'var(--color-text)', border: '1px solid var(--color-border-light)', minHeight: 60, resize: 'vertical' }}
              maxLength={150}
            />
            <div className="flex items-center justify-between mt-1 text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
              <span>{userSpeech.length}/150</span>
            </div>
            <div className="text-center mt-2">
              <Button onClick={submitUserSpeech}>
                {lang === 'zh' ? '发言完毕 / 下一位' : 'Done / Next'} <ChevronRight size={14} className="ml-1" />
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  if (step === 'withdraw') {
    return (
      <div className="p-4 rounded-xl" style={{ background: 'var(--color-card-bg)', border: '1px solid #facc15' }}>
        <h3 className="font-semibold mb-2 flex items-center gap-1.5 justify-center" style={{ color: '#facc15' }}>
          ⭐ {lang === 'zh' ? '退水 / 刚警徽' : 'Withdraw / Stay'}
        </h3>
        <p className="text-xs text-center mb-3" style={{ color: 'var(--color-text-muted)' }}>
          {lang === 'zh' ? `当前候选人(${candidates.length} 人):` : `Current candidates (${candidates.length}):`}
        </p>
        {candidates.includes(state.userId) ? (
          <>
            <p className="text-xs mb-2" style={{ color: 'var(--color-text-muted)' }}>{lang === 'zh' ? '你:' : 'You:'}</p>
            <div className="flex gap-2 justify-center mb-3">
              <Button onClick={() => setUserWithdrew(true)}
                style={userWithdrew === true ? { background: '#facc15', color: '#000' } : undefined}>
                {lang === 'zh' ? '🚪 退水' : '🚪 Withdraw'}
              </Button>
              <Button onClick={() => setUserWithdrew(false)}
                style={userWithdrew === false ? { background: '#facc15', color: '#000' } : undefined}>
                {lang === 'zh' ? '🛡️ 刚警徽' : '🛡️ Stay'}
              </Button>
            </div>
          </>
        ) : (
          <p className="text-xs text-center mb-3" style={{ color: 'var(--color-text-muted)' }}>
            {lang === 'zh' ? '你未参与竞选,等待其他候选人决定…' : 'You are not a candidate, waiting…'}
          </p>
        )}
        {/* P11-B:警告 —— 还有候选人没发言时显示红色提示 */}
        {!candidatesHaveSpoken && (
          <div className="mb-2 p-2 rounded text-[10px] text-center" style={{ background: 'rgba(220,38,38,0.15)', color: '#dc2626', border: '1px solid #dc2626' }}>
            {lang === 'zh'
              ? `⚠️ 还有候选人没发过言,必须全部发完才能投票`
              : `⚠️ Some candidates haven't spoken yet — all must speak before voting`}
          </div>
        )}
        <p className="text-[10px] text-center mb-2" style={{ color: 'var(--color-text-muted)' }}>
          {lang === 'zh' ? `已退水(AI):${Object.values(aiDecisions).filter(d => d === 'withdraw').length} 人` : `AI withdrawn: ${Object.values(aiDecisions).filter(d => d === 'withdraw').length}`}
        </p>
        <div className="text-center mt-3">
          <Button onClick={confirmWithdraw} disabled={!candidatesHaveSpoken || (candidates.includes(state.userId) ? userWithdrew === null : false)}>
            {lang === 'zh' ? '下一步' : 'Next'} <ChevronRight size={14} className="ml-1" />
          </Button>
        </div>
      </div>
    );
  }

  if (step === 'vote' || step === 'pk-vote') {
    const targetPool = step === 'pk-vote' && tiedIds ? tiedIds : candidates;
    const poolLabel = step === 'pk-vote'
      ? (lang === 'zh' ? 'PK 投票(从平票者中选 1):' : 'PK Vote (pick 1 from tied):')
      : (lang === 'zh' ? '你投票给:' : 'You vote for:');
    return (
      <div className="p-4 rounded-xl" style={{ background: 'var(--color-card-bg)', border: '1px solid #facc15' }}>
        <h3 className="font-semibold mb-2 flex items-center gap-1.5 justify-center" style={{ color: '#facc15' }}>
          ⭐ {step === 'pk-vote' ? (lang === 'zh' ? '警长 PK 投票' : 'Sheriff PK Vote') : (lang === 'zh' ? '警长投票' : 'Sheriff Vote')}
        </h3>
        {busy ? (
          <p className="text-sm text-center py-3" style={{ color: 'var(--color-text-muted)' }}>{lang === 'zh' ? 'AI 正在投票…' : 'AI voting…'}</p>
        ) : (
          <>
            <p className="text-xs mb-2" style={{ color: 'var(--color-text-muted)' }}>{poolLabel}</p>
            <div className="flex flex-wrap gap-1.5 justify-center">
              {targetPool.map(id => (
                <button key={id} onClick={() => setUserVote(id)}
                  className="px-2 py-1 rounded text-xs"
                  style={{
                    background: userVote === id ? '#facc15' : 'var(--color-card-bg)',
                    color: userVote === id ? '#000' : 'var(--color-text)',
                  }}>{id + 1}.{state.players[id].name}</button>
              ))}
            </div>
            <div className="text-center mt-3">
              <Button onClick={confirmVote} disabled={userVote === null}>
                {lang === 'zh' ? '确认投票' : 'Confirm'} <ChevronRight size={14} className="ml-1" />
              </Button>
            </div>
          </>
        )}
      </div>
    );
  }

  return null;
}

/* ═══════════════════════════════════════════════════════════════════
   警长传承 (P6-#F)
   ── 警长死后(无论是投票/技能/狼杀),ta 必须决定:
   ── · 好人:必须 pass(撕警徽规则上好人不能撕,否则你撕了等于狼的胜利)
   ── · 狼人:可以撕(让警徽流失 = 新一轮警长竞选)或 pass 给狼队友(继续控制警徽)
   ── 通过 state.pendingSheriffSuccession 字段触发(在 killPlayers 里设置)
   ═══════════════════════════════════════════════════════════════════ */
function SheriffSuccession({ state, setState, lang, aiSpeak }: {
  state: GameState; setState: (u: (s: GameState) => GameState) => void;
  lang: 'zh' | 'en';
  aiSpeak: (id: number, sys: string, usr: string, silent?: boolean, options?: { temperature?: number; maxTokens?: number }) => Promise<{ speech: string; target: number | null }>;
}) {
  const deadSheriffId = state.pendingSheriffSuccession;
  const [successor, setSuccessor] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [aiDone, setAiDone] = useState(false);
  const aiDoneRef = useRef(false);

  // 兜底:理论上应由 LastWords.next() 在警长死亡后跳到这里
  if (deadSheriffId === null) {
    const didAutoAdvanceRef = useRef(false);
    useEffect(() => {
      if (didAutoAdvanceRef.current) return;
      didAutoAdvanceRef.current = true;
      // 看 lastVotedOut 决定后续阶段
      setState(s => {
        if (s.lastVotedOut !== null && s.players[s.lastVotedOut]?.role === 'idiot' && s.players[s.lastVotedOut]?.alive) {
          return { ...s, phase: 'idiot-flip', pendingSheriffSuccession: null };
        }
        const hunterDied = s.players.find(p => !p.alive && p.role === 'hunter' && p.id === s.lastVotedOut);
        if (hunterDied) {
          return { ...s, phase: 'hunter-shoot', pendingSheriffSuccession: null };
        }
        if (s.lastVotedOut !== null) {
          return { ...s, phase: 'night', round: s.round + 1, pendingSheriffSuccession: null, lastVotedOut: null };
        }
        return { ...s, phase: 'day-announce', pendingSheriffSuccession: null };
      });
    }, []);
    return null;
  }
  const deadSheriff = state.players[deadSheriffId];
  const isUserSheriff = deadSheriffId === state.userId;
  const isWolfSheriff = deadSheriff.faction === 'wolf';
  const aliveOthers = state.players.filter(p => p.alive && p.id !== deadSheriffId);

  /* AI 警长:狼可以选择撕/传,好人必须传
     ── 狼决策:随机选传(给队友) 或 撕;狼传队友的逻辑:概率高(80% 传)
     ── 好人决策:必须传 */
  useEffect(() => {
    if (isUserSheriff || aiDone || busy || successor !== null) return;
    if (aliveOthers.length === 0) {
      // 没人能继承 → 撕(自动)
      finishAsTear();
      return;
    }
    setBusy(true);
    const prompt = isWolfSheriff
      ? lang === 'zh'
        ? `你是"${deadSheriff.name}",刚死,曾任警长。\n你是狼人!你可以:\nA) 撕警徽(让警徽流失,下一轮重新竞选)\nB) 把警徽传给你的狼队友(优先:队友 ID 列表中找)\n\n建议:若场上还有狼队友 → 80% 概率传给狼队友(保持警徽控制);否则撕。\n\n输出 JSON:{"tear":true/false,"successor":传给的玩家 1-based 座位号(撕则填 0)}`
        : `You are "${deadSheriff.name}", were Sheriff. You are a WOLF. Choose:\nA) Tear the badge (new election)\nB) Pass to a wolf teammate\nIf teammates alive: 80% pass. Else tear.\nOutput JSON: {"tear":true/false,"successor":1-based seat (0 if tear)}`
      : lang === 'zh'
        ? `你是"${deadSheriff.name}",刚死,曾任警长。你是好人,必须传警徽给一个存活玩家(不能撕!撕了等于送狼胜)。\n请选一个最值得信任的存活玩家继承。\n\n输出 JSON:{"successor":传给的玩家 1-based 座位号}`
        : `You are "${deadSheriff.name}", were Sheriff. As good player, you MUST pass (cannot tear). Pick a trusted alive player.\nOutput JSON: {"successor":1-based seat}`;
    const sys = prompt;
    const usr = lang === 'zh' ? '输出 JSON 决策' : 'Output JSON decision';
    // P28:超时兜底 15s
    const timeoutId = window.setTimeout(() => {
      console.warn(`[Werewolf] SheriffSuccession AI timeout for ${deadSheriffId}, fallback`);
      if (!aiDoneRef.current) {
        aiDoneRef.current = true;
        // 兜底逻辑同 .then
        let chosen: number | null = null;
        let tear = false;
        if (isWolfSheriff) {
          const wolfMate = aliveOthers.find(p => p.faction === 'wolf');
          chosen = wolfMate ? wolfMate.id : (aliveOthers[0]?.id ?? null);
          tear = chosen === null;
        } else {
          chosen = aliveOthers[0]?.id ?? null;
          tear = chosen === null;
        }
        if (tear || chosen === null) {
          finishAsTear();
        } else {
          setSuccessor(chosen);
        }
        setBusy(false);
        setAiDone(true);
      }
    }, 15000);
    aiSpeak(deadSheriffId, sys, usr, true).then(({ speech }) => {
      clearTimeout(timeoutId);
      if (aiDoneRef.current) return;  // 超时已处理
      // 解析目标(用 decision 解析)
      const decisionMatch = speech.match(/decision\s*[:：]\s*(\d+)/i);
      let chosen: number | null = null;
      let tear = false;
      if (decisionMatch) {
        const num = parseInt(decisionMatch[1], 10);
        if (num === 0) {
          tear = true;
        } else if (num >= 1 && num <= state.players.length && state.players[num - 1]?.alive) {
          chosen = num - 1;
        }
      }
      // 兜底:狼若有狼队友必须传,否则随机活人;好人必须传
      if (!tear && chosen === null && aliveOthers.length > 0) {
        // 优先选狼队友(狼)
        if (isWolfSheriff) {
          const wolfMate = aliveOthers.find(p => p.faction === 'wolf');
          chosen = wolfMate ? wolfMate.id : aliveOthers[Math.floor(Math.random() * aliveOthers.length)].id;
        } else {
          chosen = aliveOthers[Math.floor(Math.random() * aliveOthers.length)].id;
        }
      }
      if (tear || chosen === null) {
        finishAsTear();
      } else {
        setSuccessor(chosen);
      }
      setBusy(false);
      aiDoneRef.current = true;
      setAiDone(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 兜底函数:进入下一阶段(撕警徽 → 下一阶段由调用方决定;传 → 标记继承人)
  const finishAsTear = () => {
    setState(s => {
      // 撕警徽:看 lastVotedOut 决定后续阶段
      const nextPhase = (() => {
        if (s.lastVotedOut !== null) {
          const votedOut = s.players[s.lastVotedOut];
          if (votedOut && votedOut.alive && votedOut.role === 'idiot') return 'idiot-flip';
          return 'night';
        }
        return 'day-announce';
      })();
      const updates: Partial<GameState> = {
        pendingSheriffSuccession: null,
        phase: nextPhase as Phase,
      };
      if (nextPhase === 'night') {
        updates.round = s.round + 1;
        updates.lastVotedOut = null;
      }
      return {
        ...s,
        ...updates,
        publicLog: [...s.publicLog, {
          kind: 'system' as const, day: s.round,
          text: `⭐ 警长 ${deadSheriff.name} 撕掉警徽,警徽流失`,
        }],
      };
    });
  };

  // 用户或 AI 决定后应用
  const apply = (chosen: number | null) => {
    if (chosen === null) {
      // 撕(用户主动选择)
      if (!isWolfSheriff) return;  // 好人不能撕
      finishAsTear();
      return;
    }
    setState(s => {
      // 传给某人
      const target = s.players[chosen];
      if (!target || !target.alive) return s;
      return {
        ...s,
        pendingSheriffSuccession: null,
        // 清所有警长,设置继承人
        players: s.players.map(p => p.id === chosen
          ? { ...p, privateMemory: { ...p.privateMemory, isSheriff: true } }
          : { ...p, privateMemory: { ...p.privateMemory, isSheriff: false } }),
        publicLog: [...s.publicLog, {
          kind: 'system' as const, day: s.round,
          text: `⭐ 警长 ${deadSheriff.name} 死前传警徽给 ${target.name}(继承 1.5 票投票权)`,
        }],
        // 决定下一阶段
        phase: (s.lastVotedOut !== null ? 'night' : 'day-announce') as Phase,
        round: s.lastVotedOut !== null ? s.round + 1 : s.round,
        lastVotedOut: null,
      };
    });
  };

  // AI 决定后自动 apply
  useEffect(() => {
    if (!isUserSheriff && aiDone && !busy && successor !== null) {
      apply(successor);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiDone, busy, successor, isUserSheriff]);

  return (
    <div className="p-4 rounded-xl" style={{ background: 'var(--color-card-bg)', border: '1px solid #facc15' }}>
      <div className="flex items-center gap-2 mb-2 justify-center">
        <Crown size={20} style={{ color: '#facc15' }} />
        <h3 className="font-semibold" style={{ color: 'var(--color-text)' }}>
          {lang === 'zh' ? '⭐ 警长传承' : '⭐ Sheriff Succession'}
        </h3>
      </div>
      <p className="text-xs text-center mb-3" style={{ color: 'var(--color-text-muted)' }}>
        {isUserSheriff
          ? (lang === 'zh' ? `你死前是警长,必须决定警徽:` : 'You were sheriff. Decide:')
          : (isWolfSheriff
              ? (lang === 'zh' ? `${deadSheriff.name} 是狼人,可以选择撕警徽 或 传给狼队友` : `${deadSheriff.name} is wolf — tear or pass to wolf pack`)
              : (lang === 'zh' ? `${deadSheriff.name} 是好人,必须传警徽给一个存活玩家(不能撕!)` : `${deadSheriff.name} is good — must pass (cannot tear!)`))}
      </p>
      {busy ? (
        <div className="text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>
          {lang === 'zh' ? '🤔 警长正在决定…' : '🤔 Sheriff deciding…'}
        </div>
      ) : isUserSheriff ? (
        <>
          <p className="text-xs mb-2 text-center" style={{ color: '#a78bfa' }}>
            {lang === 'zh' ? '选一个继承人(必选,除非你是狼可以撕):' : 'Pick a successor:'}
          </p>
          <div className="flex flex-wrap gap-1.5 justify-center mb-3">
            {aliveOthers.map(p => (
              <button key={p.id} onClick={() => setSuccessor(p.id)}
                className="px-2 py-1 rounded text-xs"
                style={{
                  background: successor === p.id ? '#facc15' : 'var(--color-card-bg)',
                  color: successor === p.id ? '#000' : 'var(--color-text)',
                }}>
                {p.id + 1}.{p.name}
              </button>
            ))}
          </div>
          <div className="text-center mt-2 space-x-2">
            {isWolfSheriff && (
              <Button onClick={() => apply(null)} variant="secondary">
                {lang === 'zh' ? '撕警徽(让警徽流失)' : '🗑️ Tear badge'}
              </Button>
            )}
            <Button onClick={() => apply(successor)} disabled={successor === null}>
              {lang === 'zh' ? '传给继承人' : 'Pass'} <ChevronRight size={14} className="ml-1" />
            </Button>
          </div>
        </>
      ) : (
        <div className="text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>
          {lang === 'zh'
            ? (successor !== null ? `警长决定传给 ${state.players[successor]?.name}` : '警长决定撕警徽')
            : (successor !== null ? `Sheriff passing to ${state.players[successor]?.name}` : 'Sheriff tearing badge')}
        </div>
      )}
    </div>
  );
}

function DayAnnounce({ state, setState, lang }: { state: GameState; setState: (u: (s: GameState) => GameState) => void; lang: 'zh' | 'en' }) {
  const dead = state.deadThisNight;
  // 检测所有死亡者里是否有猎人(包括殉情带走的)
  // 标准规则:猎人被女巫毒杀不能开枪,只有被狼杀/殉情/自爆才能开枪
  const witchPoisoned = state.players.find(p => p.role === 'witch')?.privateMemory.witchPoisonedId ?? null;
  const hunterDead = dead.find(id => state.players[id].role === 'hunter' && id !== witchPoisoned);
  // 12 人局第一天(没有警长时)→ 警长竞选
  // P0-#1 修复:不再有 sheriff-pick-order 阶段(警长在 sheriff-election 结束时直接走默认 cw 顺序)
  // P0-#3 修复:isSheriff 在死亡时已被 killPlayers / applyWolfSelfDestruct / applyKnightDuel 清掉
  const needSheriff = state.players.length >= 12 && !state.players.some(p => p.privateMemory.isSheriff);
  useEffect(() => {
    if (hunterDead !== undefined) {
      setState(s => ({ ...s, phase: 'hunter-shoot', lastVotedOut: hunterDead }));
    } else if (needSheriff) {
      setState(s => ({ ...s, phase: 'sheriff-election' }));
    } else {
      setState(s => ({ ...s, phase: 'day-discuss' }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="p-4 rounded-xl text-center" style={{ background: 'var(--color-card-bg)', border: '1px solid var(--color-border-light)' }}>
      <Sun size={24} className="mx-auto mb-2" style={{ color: 'var(--color-accent)' }} />
      <h3 className="font-semibold mb-2" style={{ color: 'var(--color-text)' }}>
        {lang === 'zh' ? `第 ${state.round} 天 · 天亮了` : `Day ${state.round} · Dawn`}
      </h3>
      {dead.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
          {lang === 'zh' ? '🌙 昨夜是平安夜,无人死亡。' : '🌙 Peaceful night, no deaths.'}
        </p>
      ) : (
        <div className="space-y-1">
          {dead.map(id => (
            <p key={id} className="text-sm" style={{ color: 'var(--color-text)' }}>
              💀 <b>{id + 1}. {state.players[id].name}</b> {lang === 'zh' ? '倒下了' : 'fell'}
              {/* 严格隐藏:身份只到 GameOver 才公开 */}
            </p>
          ))}
        </div>
      )}
      <p className="text-xs mt-2" style={{ color: 'var(--color-text-muted)' }}>{lang === 'zh' ? '正在进入白天讨论…' : 'Entering day discussion…'}</p>
    </div>
  );
}

function HunterShoot({ state, setState, lang, aiSpeak }: {
  state: GameState; setState: (u: (s: GameState) => GameState) => void;
  lang: 'zh' | 'en';
  aiSpeak: (id: number, sys: string, usr: string, silent?: boolean, options?: { temperature?: number; maxTokens?: number }) => Promise<{ speech: string; target: number | null }>;
}) {
  const hunterId = state.lastVotedOut;
  const [target, setTarget] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [aiDone, setAiDone] = useState(false);

  if (hunterId === null) {
    // P2-#23 修复:用 ref guard 防止 StrictMode 双跑
    const didAutoAdvanceRef = useRef(false);
    useEffect(() => {
      if (didAutoAdvanceRef.current) return;
      didAutoAdvanceRef.current = true;
      setState(s => ({ ...s, phase: 'night', round: s.round + 1 }));
    }, []);
    return null;
  }
  // 用 const 收窄类型(从 number | null 收到 number)
  const hid: number = hunterId;

  const aliveOthers = state.players.filter(p => p.alive && p.id !== hid);
  const hunter = state.players[hid];
  const isUser = hid === state.userId;

  /* AI 猎人:异步跑 AI 决策(选 target) */
  useEffect(() => {
    if (isUser || aiDone || busy || target !== null) return;
    if (aliveOthers.length === 0) { setAiDone(true); return; }
    setBusy(true);
    // P25+:猎人必须开枪 —— 强制 prompt "必须选一个" + 狼队友排除
    const todayClaims = state.claims?.[state.round];
    const seerClaimers = (todayClaims?.seerClaims ?? []).map(c => c.playerId);
    const seerClaimerStr = seerClaimers.length > 0
      ? (lang === 'zh' ? `\n公开跳预言家的玩家:${seerClaimers.map(id => `${id+1}号 ${state.players[id].name}`).join('、')} → 大概率真预言家,不要开枪` : `\nSeer claimers: ${seerClaimers.map(id => `${id+1} ${state.players[id].name}`).join(', ')} → likely real seer, do not shoot`)
      : '';
    const wolfMatesStr = hunter.faction === 'wolf' && hunter.privateMemory?.wolfTeammates?.length
      ? (lang === 'zh'
        ? `\n你的狼队友:${hunter.privateMemory.wolfTeammates.map(id => `${id+1}号 ${state.players[id].name}`).join('、')} → 不要开枪自己人`
        : `\nYour wolf pack: ${hunter.privateMemory.wolfTeammates.map(id => `${id+1} ${state.players[id].name}`).join(', ')} → do not shoot teammates`)
      : '';
    const sys = lang === 'zh'
      ? `你是"${hunter.name}"(第${hid+1}号),你已经死了。作为猎人你必须开枪带走一名玩家。\n存活玩家(除你):${aliveOthers.map(p => `${p.id+1}号 ${p.name}`).join('、')}${seerClaimerStr}${wolfMatesStr}\n\n分析:谁最像狼人?\n- 跳预言家的是好人,不要开枪\n- 你的狼队友不要开枪(仅狼)\n- 其他人里发言最可疑 / 站狼队的优先\n\n【硬性约束】必须填一个目标(1-based 座位号),不允许填 0 不开枪。\n\n输出 JSON:{"speech":"你的遗言(可选)","target":目标座位号(1-based,必须填一个有效数字)}`
      : `You are "${hunter.name}" (#${hid+1}), you died. As hunter, you MUST shoot one player.\nAlive (excl. you): ${aliveOthers.map(p => `${p.id+1} ${p.name}`).join(', ')}${seerClaimerStr}${wolfMatesStr}\n\nAnalysis: who looks most like a wolf? Seer claimers are good (don't shoot). Packmates (if wolf) don't shoot. Others: shoot the most suspicious.\n\n【HARD constraint】Must fill a valid target (1-based seat number). Do NOT fill 0 to skip.\n\nOutput JSON: {"speech":"last words (optional)","target":target seat (1-based, REQUIRED)}`;
    const usr = lang === 'zh'
      ? '请用 JSON 格式输出:{"speech":"你的遗言","target":目标座位号(1-based,必须填一个有效数字)}'
      : 'Output JSON: {"speech":"last words","target":target seat (1-based, REQUIRED)}';
    // P25:超时兜底 20s,防止 AI 卡死
    const timeoutId = window.setTimeout(() => {
      // 超时:兜底随机选一个非狼非预言家的活人
      const exclude = new Set<number>([
        ...(seerClaimers ?? []),
        ...(hunter.privateMemory?.wolfTeammates ?? []),
      ]);
      const candidates = aliveOthers.filter(p => !exclude.has(p.id));
      const pick = (candidates.length > 0 ? candidates : aliveOthers)[0];
      console.warn(`[Werewolf] Hunter ${hid} AI timeout, fallback to ${pick.id}`);
      setTarget(pick.id);
      setBusy(false);
      setAiDone(true);
    }, 20000);
    aiSpeak(hid, sys, usr, true /* silent:猎人私下选目标 */).then(({ target: aiT }) => {
      clearTimeout(timeoutId);
      if (aiT !== null && aiT >= 0 && aiT < state.players.length && state.players[aiT].alive && aiT !== hid) {
        // P25:再校验一次(防止 AI 选了不该选的)
        if (seerClaimers.includes(aiT)) {
          // AI 选了跳预言家的,改为选其他活人
          const others = aliveOthers.filter(p => p.id !== aiT && !seerClaimers.includes(p.id));
          if (others.length > 0) {
            setTarget(others[0].id);
            setBusy(false);
            setAiDone(true);
            return;
          }
        }
        setTarget(aiT);
      } else {
        // AI 没选 / 选错 → 兜底
        const exclude = new Set<number>([
          ...(seerClaimers ?? []),
          ...(hunter.privateMemory?.wolfTeammates ?? []),
        ]);
        const candidates = aliveOthers.filter(p => !exclude.has(p.id));
        const pick = (candidates.length > 0 ? candidates : aliveOthers)[0];
        setTarget(pick.id);
      }
      setBusy(false);
      setAiDone(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* 用户/AI 决策后:执行开枪 (P0-#52 修复:射杀后做胜利检查) */
  const fire = (chosen: number | null) => {
    if (chosen === null) {
      // 不开枪 → 直接进夜晚,记 system 日志方便回溯
      setState(s => ({
        ...s,
        lastVotedOut: null,
        publicLog: [...s.publicLog, {
          kind: 'system' as const, day: s.round,
          text: `🏹 ${s.players[hid].name} 选择不开枪,直接进入夜晚`,
        }],
        phase: 'night',
        round: s.round + 1,
      }));
      return;
    }
    setState(s => {
      // 死亡后还要触发情侣殉情链 + 检查其他猎人
      // P0-#3 修复:用 killPlayers helper(清 isSheriff + 殉情)
      const killed = killPlayers(s, [chosen], '🏹', `${s.players[chosen].name} 跟着去了`);
      // killPlayers 加的日志要改下格式(从 "🏹 X号 X" 改成更适合的)
      const fixedLog = killed.publicLog.slice(0, -1).concat([{
        kind: 'death' as const, day: s.round, playerId: chosen,
        text: `🏹 ${s.players[chosen].name} 被 ${s.players[hid].name} 猎人开枪带走`,
      }, {
        kind: 'system' as const, day: s.round,
        text: `🏹 ${s.players[hid].name} 猎人发动技能,射杀 ${s.players[chosen].name}`,
      }]);
      let ns: GameState = { ...killed, publicLog: fixedLog, lastVotedOut: null };

      // P0-#52 修复:射杀后立即检查胜负(避免 "射杀最后狼 → phase=night 闪一下 → gameover")
      const winner = checkWinner(ns);
      if (winner) {
        return { ...ns, phase: 'gameover', winner };
      }
      // 进入夜晚(下一夜)—— 殉情不会再触发新的 hunter(因为 hunter 已经处理过了)
      return { ...ns, phase: 'night', round: s.round + 1 };
    });
  };

  // 用户等选择;AI 已经决定时,自动 fire
  useEffect(() => {
    if (!isUser && aiDone && !busy) {
      fire(target);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiDone, busy, target, isUser]);

  // P25:用户死了 → 不再让用户点按钮(否则卡死),自动兜底随机选一个非狼非预言家的人
  // 用户活着 + 用户是猎人:走主 UI(下面渲染);用户死了:显示 DeadSpectator
  const hunterUserAlive = state.players[state.userId]?.alive;
  if (!state.spectatorMode && hunterUserAlive === false && isUser) {
    // 触发兜底选择(target 还没设置时)
    if (target === null && aliveOthers.length > 0) {
      const todayClaims = state.claims?.[state.round];
      const seerClaimers = new Set((todayClaims?.seerClaims ?? []).map(c => c.playerId));
      const wolfMates = new Set(hunter.privateMemory?.wolfTeammates ?? []);
      const candidates = aliveOthers.filter(p => !seerClaimers.has(p.id) && !wolfMates.has(p.id));
      const pick = (candidates.length > 0 ? candidates : aliveOthers)[0];
      // 用 setTimeout 避免 render 中 setState
      setTimeout(() => fire(pick.id), 0);
    }
    return <DeadSpectator state={state} lang={lang}
      busyHint={lang === 'zh' ? '🏹 猎人技能触发中…' : '🏹 Hunter shooting…'} />;
  }

  return (
    <div className="p-4 rounded-xl" style={{ background: 'var(--color-card-bg)', border: '1px solid #f97316' }}>
      <div className="flex items-center gap-2 mb-2 justify-center">
        <Skull size={20} style={{ color: '#f97316' }} />
        <h3 className="font-semibold" style={{ color: 'var(--color-text)' }}>
          {lang === 'zh' ? '🏹 猎人发动技能' : '🏹 Hunter shoots'}
        </h3>
      </div>
      <p className="text-xs text-center mb-3" style={{ color: 'var(--color-text-muted)' }}>
        {isUser
          ? (lang === 'zh' ? '你死了,可以开枪带走一个人(也可选择不开枪):' : 'You died, can shoot one (or skip):')
          : (lang === 'zh' ? `AI 猎人 ${hunter.name} 正在决定带谁…` : `AI hunter ${hunter.name} choosing…`)}
      </p>
      {isUser ? (
        <>
          <div className="flex flex-wrap gap-1.5 justify-center">
            {aliveOthers.map(p => (
              <button key={p.id} onClick={() => setTarget(p.id)}
                className="px-2 py-1 rounded text-xs"
                style={{
                  background: target === p.id ? '#f97316' : 'var(--color-card-bg)',
                  color: target === p.id ? '#fff' : 'var(--color-text)',
                }}>{p.id + 1}.{p.name}</button>
            ))}
          </div>
          <div className="text-center mt-3 space-x-2">
            <Button onClick={() => fire(null)}>
              {lang === 'zh' ? '不开枪' : 'Skip'}
            </Button>
            <Button onClick={() => fire(target)} disabled={target === null}>
              {lang === 'zh' ? '开枪!' : 'Shoot!'}
            </Button>
          </div>
        </>
      ) : (
        <div className="text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>
          {busy
            ? (lang === 'zh' ? '🤔 思考中…' : '🤔 thinking…')
            : (lang === 'zh' ? '已选目标,开枪!' : 'Target chosen, shooting!')}
        </div>
      )}
    </div>
  );
}

function DayDiscuss({ state, setState, lang, aiSpeak, onExit }: {
  state: GameState; setState: (u: (s: GameState) => GameState) => void;
  lang: 'zh' | 'en';
  /** P11-A:死者退出按钮 */
  onExit?: () => void;
  aiSpeak: (id: number, sys: string, usr: string, silent?: boolean, options?: { temperature?: number; maxTokens?: number }) => Promise<{ speech: string; target: number | null; useAntidote?: boolean }>;
}) {
  const [discussIdx, setDiscussIdx] = useState(0);
  const [busy, setBusy] = useState(false);
  const [userInput, setUserInput] = useState('');
  const [timeLeft, setTimeLeft] = useState(60); // 60s 倒计时
  const [showDuelTarget, setShowDuelTarget] = useState(false);
  const stateRef = useRef(state);
  stateRef.current = state;

  const alivePlayers = state.players.filter(p => p.alive);
  const speakers = alivePlayers; // 每个存活玩家都发言 1 次
  const cur = speakers[discussIdx];
  const isUserTurn = cur && cur.id === state.userId && !busy;

  // P5 修复:死人不能发言,显示观战面板(可看到当前 speaker + 倒计时)
  const userAlive = state.players[state.userId]?.alive;
  // P20 修复:用户死了 → 自动跳过自己的发言,避免 phase 永远卡 day-discuss
  const deadUserSkipRef = useRef(false);
  useEffect(() => {
    if (state.spectatorMode || userAlive || deadUserSkipRef.current) return;
    deadUserSkipRef.current = true;
    // 用户死后本轮:不参与发言,等下一轮 phase 自然推进
    // 这里不做任何事 —— 发言 useEffect 检测 cur 是自己会自然 skip
    // 但 discussIdx 永远指向自己(因为用户还在 speakers 列表里)——
    // 所以要主动 reset discussIdx 到下一个活人(避免 60s 倒计时卡 cur=自己)
    if (cur && cur.id === state.userId) {
      const others = alivePlayers.filter(p => p.id !== state.userId);
      const nextIdx = others.findIndex(p => speakers.indexOf(p) > discussIdx);
      if (nextIdx >= 0) {
        setDiscussIdx(speakers.indexOf(others[nextIdx]));
        setTimeLeft(60);
      } else {
        // 没有下一个活人发言 → 直接进 day-vote
        setState(s => ({ ...s, phase: 'day-vote' }));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // P16:观看模式下用户不在游戏中,不需要 DeadSpectator
  if (!state.spectatorMode && !userAlive) {
    return <DeadSpectator state={state} lang={lang}
      busyHint={cur ? (lang === 'zh'
        ? `🎤 ${cur.name} 正在发言(剩 ${timeLeft}s)…`
        : `🎤 ${cur.name} speaking (${timeLeft}s)…`)
        : undefined}
      onExit={onExit}
      progress={cur ? {
        current: discussIdx + 1,
        total: speakers.length,
        label: lang === 'zh' ? `🗣️ 发言进度 ${discussIdx + 1}/${speakers.length}` : `🗣️ Speech ${discussIdx + 1}/${speakers.length}`,
      } : undefined} />;
  }

  // 推断:用户是否是狼(用于显示自爆按钮)
  const userP = state.players[state.userId];
  const userIsWolf = userP?.alive && userP.faction === 'wolf';

  /* 推进到下一位(用户跳过或发言完毕,或 AI 完成) */
  const nextSpeaker = () => {
    setUserInput('');
    if (discussIdx + 1 >= speakers.length) {
      setState(s => ({ ...s, phase: 'day-vote' }));
      return;
    }
    setDiscussIdx(i => i + 1);
    setTimeLeft(60); // 重置倒计时
  };

  /* 60s 倒计时(超时自动跳过)
     P7-#A 修复:即使 busy=true 也会检查 timeLeft<=0,强制跳过(防止 AI 卡住)
     P19 修复:cur 已死或越界(发言中途被狼杀/被带)→ 自动 nextSpeaker,防止卡死 */
  useEffect(() => {
    if (!cur || !cur.alive) {
      // cur 已死(中途被杀)或越界 → 强制推进
      if (cur === undefined && speakers.length === 0) {
        // 全死/全没了:游戏结束
        setState(s => ({ ...s, phase: 'gameover' }));
        return;
      }
      // 还有活人 → 跳过当前,推进
      setUserInput('');
      if (discussIdx + 1 >= speakers.length) {
        setState(s => ({ ...s, phase: 'day-vote' }));
        return;
      }
      setDiscussIdx(i => i + 1);
      setTimeLeft(60);
      return;
    }
    if (isUserTurn) {
      // 用户输入中,倒计时暂停
      return;
    }
    if (timeLeft <= 0) {
      // 超时:无论 busy 与否都强制 next(AI 兜底用)
      if (lastProcessedSpeakerRef.current === cur.id) {
        lastProcessedSpeakerRef.current = null;
      }
      setBusy(false);  // 强制解除 busy
      if (discussIdx + 1 < speakers.length) {
        setDiscussIdx(i => i + 1);
        setTimeLeft(60);
      } else {
        // 全部说完,直接进 day-vote
        setState(s => ({ ...s, phase: 'day-vote' }));
      }
      return;
    }
    const id = window.setTimeout(() => setTimeLeft(t => Math.max(0, t - 1)), 1000);
    return () => clearTimeout(id);
  }, [timeLeft, busy, isUserTurn, cur, discussIdx, speakers.length]);

  /* AI 发言:在 discussIdx 变化且不是用户时跑
     P1-#22 修复(用户反馈:任何玩家都可能重复发言,比如 10 号):
     跟警长竞选同样的 bug — 跨组件 batch + useEffect 重跑时,cur 仍为同一玩家。
     修法:加 lastProcessedSpeakerRef + 在 setState 内同步推进 discussIdx/phase */
  const lastProcessedSpeakerRef = useRef<number | null>(null);
  // 重置 ref:phase 变化时(包括进入新一轮 day-discuss)
  useEffect(() => {
    lastProcessedSpeakerRef.current = null;
  }, [state.phase, state.round]);
  useEffect(() => {
    if (!cur || !cur.alive) return;  // P19:cur 已死 → 等 timeout useEffect 兜底推进
    if (cur.id === state.userId) return; // 用户自己,等用户输入
    if (busy) return;
    if (lastProcessedSpeakerRef.current === cur.id) return;  // 防止重复
    lastProcessedSpeakerRef.current = cur.id;
    setBusy(true);
    const sys = buildDayDiscussionPrompt(cur, state, lang);
    const temp = extractTempHint(sys);
    const usr = lang === 'zh'
      ? '请发言(30-100 字,口语化,像微信群聊天),带节奏、跟队友呼应'
      : 'Speak in 30-100 words, casual chat style, drive the discussion';
    // P7-#A 修复:AI 发言超时兜底(防止"卡着"—— AI 长时间不响应时强制推进)
    const speechTimeoutMs = 45000;  // 45s 超时
    const timeoutId = window.setTimeout(() => {
      if (lastProcessedSpeakerRef.current === cur.id) {
        // 超时还没返回 → 强制 setBusy(false),让 countdown 继续
        // eslint-disable-next-line no-console
        console.warn(`[Werewolf] AI speech timeout for player ${cur.id}, forcing advance`);
        lastProcessedSpeakerRef.current = null;  // 重置以便 .then() 不会再误触发
        setBusy(false);
        setTimeLeft(0);
      }
    }, speechTimeoutMs);
    aiSpeak(cur.id, sys, usr, false, { temperature: temp }).then(({ speech }) => {
      clearTimeout(timeoutId);
      // P25+:真预言家的发言强制校正 —— LLM 经常幻觉把狼说成好人(或反过来)
      // 校正策略:把发言里所有"X 号是狼/好人"的描述,基于真实 seerChecks 改写
      if (cur.role === 'seer' && (cur.privateMemory?.seerChecks ?? []).length > 0) {
        const realChecks = cur.privateMemory.seerChecks;
        let corrected = speech;
        // 匹配 "X 号是 [狼/好人/wolf/good]" 的所有描述,按真实结果替换
        corrected = corrected.replace(
          /(\d{1,2})\s*号\s*(?:是|=|为|就是|就是|乃|系|就是)\s*(狼|好人|坏人|神职|民|村民|预言家|女巫|守卫|猎人|骑士|白痴|狼人|wolf|good|bad|god|villager)/gi,
          (m, numStr, label) => {
            const num = parseInt(numStr, 10) - 1;
            const realCheck = realChecks.find(c => c.targetId === num);
            if (!realCheck) return m;  // 没验过,不替换
            const isWolfLabel = /狼|wolf/i.test(label);
            // 如果声称的与实际不符,替换为正确标签
            if (realCheck.isWolf !== isWolfLabel) {
              return `${numStr} 号是${realCheck.isWolf ? '🐺 狼人' : '🛡️ 好人'}`;
            }
            return m;
          }
        );
        // 如果校正后文本不同,覆盖
        if (corrected !== speech) {
          console.warn(`[Werewolf] Seer speech hallucination corrected for player ${cur.id}`);
          speech = corrected;
        }
      }
      // P27:重复发言检测 —— AI 经常生成与最近发言 80% 相似的内容
      // 如果重复,加一个"换个角度再说"的引导后缀(不动 speech,直接存)
      // 检测太严格会让 LLM 输出空,这里只 warn + 标记,不强重发
      const recentTexts = state.speeches.slice(-3).map(sp => ({ text: sp.text }));
      if (isRepeatedSpeech(speech, recentTexts, 0.75)) {
        console.warn(`[Werewolf] Player ${cur.id} repeated speech detected`);
        // 不强制重发(可能 LLM 就是没别的可说),但加一个 hint 给后续 prompt
      }
      // P1-#48 修复:AI 发言也检测 claim 关键字
      // 放宽正则:支持 "我是预"/"我验过"/"checked"/"3号位"/"3 是狼"/"3→狼" 等
      // P1-#22: 在 setState 内同步推进 discussIdx/phase(避免 setTimeout race)
      setState(s => {
        const newClaims = { ...(s.claims || {}) };
        if (!newClaims[s.round]) newClaims[s.round] = { seerClaims: [], witchClaims: [], guardClaims: [] };
        const dayClaims = newClaims[s.round];

        // ── 预言家 claim 检测 (P1-#22 严格化修复)
        // 之前:任何提到"验了/预言家"就被当作 seer claim → 误把"我站4号" "4号和5号矛盾" 识别为查验
        // 现在:必须 speech 以"我是预言家"开头(真 claim),才提取"验了 X 号, 他是 [狼/好人]"
        if (/^\s*(我是预言家|我是预|我(?:是|来)验|我(?:刚|昨晚)?(?:验了|查了)?|i\s*am\s*the\s*seer)/i.test(speech)) {
          // 严格模式: 找 "验了 X 号" 后紧跟 "他是 [狼/好人]"
          const checkRe = /验了?\s*(\d{1,2})\s*号\s*[,,。\s]*\s*他是?\s*(狼|好人|wolf|good)/gi;
          const matches = [...speech.matchAll(checkRe)];
          if (matches.length > 0) {
            let checks: { targetId: number; isWolf: boolean }[] = matches.map(m => {
              const num = parseInt(m[1], 10) - 1;
              const isWolf = /狼|wolf/i.test(m[2]);
              return { targetId: num, isWolf };
            }).filter(c => c.targetId >= 0 && c.targetId < s.players.length);
            // P8-#A 修复:真预言家的 claim 必须与实际 seerChecks 一致
            // (LLM 经常幻觉报错信息 —— "6号是好人"但实际是狼)
            // 规则:如果说话者是真正的预言家,且 state.privateMemory.seerChecks 里
            //      有这个 target 的记录,用实际记录覆盖 claim
            //      (悍跳的狼 → claim 保留,作为假情报)
            const speaker = s.players[cur.id];
            const isRealSeer = speaker?.role === 'seer';
            const speakerChecks = speaker?.privateMemory?.seerChecks ?? [];
            if (isRealSeer && speakerChecks.length > 0) {
              const realChecks = speakerChecks;
              checks = checks.map(c => {
                const realCheck = realChecks.find(rc => rc.targetId === c.targetId);
                if (realCheck) {
                  // 用实际结果覆盖(防止 AI 幻觉报反)
                  if (realCheck.isWolf !== c.isWolf) {
                    return { targetId: c.targetId, isWolf: realCheck.isWolf };
                  }
                }
                return c;
              });
              // 如果 AI 没提到某些实际查验过的人,补进去
              for (const rc of realChecks) {
                if (!checks.some(c => c.targetId === rc.targetId)) {
                  checks.push({ targetId: rc.targetId, isWolf: rc.isWolf });
                }
              }
            }
            if (checks.length > 0) {
              const existing = dayClaims.seerClaims.findIndex(c => c.playerId === cur.id);
              if (existing >= 0) {
                // 已经起跳过 → 更新校验结果(可能新增了查验)
                dayClaims.seerClaims[existing] = { playerId: cur.id, checks };
              } else {
                // P10 修复:全局最多 3 人起跳预言家(跨所有轮次)
                // 防止多个狼反复悍跳 + 村民乱起跳稀释真预言家信息
                const globalClaimers = new Set<number>();
                for (const day of Object.values(newClaims)) {
                  for (const c of day.seerClaims || []) globalClaimers.add(c.playerId);
                }
                if (globalClaimers.size < 3) {
                  dayClaims.seerClaims.push({ playerId: cur.id, checks });
                }
                // else: 全局已 3 人起跳过,不再加(→ 写 system 日志,玩家可以从 publicLog 看到"超限被忽略")
              }
            }
          }
        }

        // ── 女巫 claim 检测 ──
        if (/女巫|我是女|解药|毒药|witch|antidote|poison|saved/i.test(speech)) {
          const savedMatch = speech.match(/(?:救了?|我救|saved?|antidote[^\d]{0,8})\s*(\d{1,2})\s*号?/i);
          const poisonedMatch = speech.match(/(?:毒了?|poisoned?)\s*(\d{1,2})\s*号?/i);
          const savedId = savedMatch ? parseInt(savedMatch[1], 10) - 1 : null;
          const poisonedId = poisonedMatch ? parseInt(poisonedMatch[1], 10) - 1 : null;
          if (savedId !== null || poisonedId !== null) {
            const existing = dayClaims.witchClaims.findIndex(c => c.playerId === cur.id);
            if (existing >= 0) dayClaims.witchClaims[existing] = { playerId: cur.id, savedId, poisonedId };
            else dayClaims.witchClaims.push({ playerId: cur.id, savedId, poisonedId });
          }
        }

        // ── 守卫 claim 检测 ──
        if (/守卫|我是守|守了|守过|guard|guarded/i.test(speech)) {
          const guardedMatch = speech.match(/(?:守了?|我守|guarded?)\s*(\d{1,2})\s*号?/i);
          const guardedId = guardedMatch ? parseInt(guardedMatch[1], 10) - 1 : null;
          if (guardedId !== null) {
            const existing = dayClaims.guardClaims.findIndex(c => c.playerId === cur.id);
            if (existing >= 0) dayClaims.guardClaims[existing] = { playerId: cur.id, guardedId };
            else dayClaims.guardClaims.push({ playerId: cur.id, guardedId });
          }
        }
        // 同步给 speeches 加 phase 字段(P3-#39)
        const idx = s.speeches.findIndex(sp => sp.playerId === cur.id && sp.day === s.round && sp.text === speech);
        if (idx >= 0) s.speeches[idx].phase = 'day';
        // P9:女巫刚公开身份/操作后,标记 lastWitchAction.announced = true(下次不再强制)
        if (cur.role === 'witch' && s.lastWitchAction?.byPlayerId === cur.id && !s.lastWitchAction.announced) {
          return {
            ...s,
            claims: newClaims,
            lastWitchAction: { ...s.lastWitchAction, announced: true },
          };
        }
        return { ...s, claims: newClaims };
      });
      setBusy(false);
      // AI 说完,自动推进到下一位(用 setTimeout 避免 setState 还没生效)
      setTimeout(() => {
        if (discussIdx + 1 >= speakers.length) {
          setState(s => ({ ...s, phase: 'day-vote' }));
        } else {
          setDiscussIdx(i => i + 1);
          setTimeLeft(60);
        }
      }, 600);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [discussIdx]);

  /* AI 骑士:概率 25% 主动决斗(讨论阶段最佳时机) */
  useEffect(() => {
    if (!cur) return;
    if (cur.id === state.userId) return;
    if (cur.role !== 'knight' || cur.privateMemory.knightUsed) return;
    if (busy) return;
    // 25% 概率主动决斗
    if (Math.random() < 0.25) {
      // 选最可疑的(随机一个非自己)
      const candidates = state.players.filter(p => p.alive && p.id !== cur.id);
      if (candidates.length === 0) return;
      const target = candidates[Math.floor(Math.random() * candidates.length)].id;
      setState(s => applyKnightDuel(s, cur.id, target, lang));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cur?.id]);

  /* AI 狼自爆:动态概率
     ── 最后 1 狼 → 0%(自爆即输,死规则硬阻断)
     ── 狼优势(aliveWolves > aliveGood / 2)→ 0%(无故自爆送头)
     ── 劣势 → 15%(放手一搏,比之前 10% 高)
     ── 持平 → 5%(保守) */
  useEffect(() => {
    if (!cur) return;
    if (cur.faction !== 'wolf') return;
    if (cur.id === state.userId) return;
    if (busy) return;
    const aliveWolves = state.players.filter(p => p.alive && p.faction === 'wolf').length;
    if (aliveWolves === 0) return;
    // 死亡玩家可能仍在本组件(speakers 已过滤 alive),cur 应该 alive
    if (aliveWolves === 1) return;  // P2-#A:最后一只狼禁止自爆
    const aliveGood = state.players.filter(p => p.alive && p.faction === 'good').length;
    const wolfAdvantage = aliveWolves > aliveGood / 2;  // P2-#B:狼优势
    if (wolfAdvantage) return;
    // 动态概率
    let prob = 0.10;
    if (aliveWolves < aliveGood) prob = 0.15;       // 劣势
    else if (aliveWolves === aliveGood) prob = 0.05; // 持平
    if (Math.random() < prob) {
      setState(s => applyWolfSelfDestruct(s, cur.id, lang));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cur?.id]);

  /* 用户提交发言 */
  const submitUserSpeech = () => {
    if (!cur) return;
    const text = userInput.trim() || (lang === 'zh' ? '(我暂时没有想说的)' : '(I have nothing to say)');
    setState(s => {
      // P1-#48 修复:检测 claim 关键字,加入 state.claims
      const newClaims = { ...(s.claims || {}) };
      if (!newClaims[s.round]) {
        newClaims[s.round] = { seerClaims: [], witchClaims: [], guardClaims: [] };
      }
      const dayClaims = newClaims[s.round];
      const newSpeech: SpeechRecord = { playerId: state.userId, day: s.round, text, phase: 'day' };
      // 简单关键字检测
      if (/预言家|验了|seer|checked/i.test(text)) {
        // 提取查验列表(简化:用所有 N号 提取)
        const checkMatches = text.match(/(\d+)\s*号/g);
        if (checkMatches) {
          const checks: { targetId: number; isWolf: boolean }[] = checkMatches.map(m => {
            const num = parseInt(m, 10) - 1;
            const isWolf = /狼|wolf/i.test(text.substring(text.indexOf(m), text.indexOf(m) + 8));
            return { targetId: num, isWolf };
          });
          // 覆盖或新增
          const existing = dayClaims.seerClaims.findIndex(c => c.playerId === state.userId);
          if (existing >= 0) {
            dayClaims.seerClaims[existing] = { playerId: state.userId, checks };
          } else {
            // P10:全局最多 3 人起跳预言家(跨所有轮次)
            const globalClaimers = new Set<number>();
            for (const day of Object.values(newClaims)) {
              for (const c of day.seerClaims || []) globalClaimers.add(c.playerId);
            }
            if (globalClaimers.size < 3) {
              dayClaims.seerClaims.push({ playerId: state.userId, checks });
            }
            // else: 全局已 3 人,被忽略
          }
        }
      }
      if (/女巫|解药|毒药|witch|antidote|poison/i.test(text)) {
        const savedMatch = text.match(/(?:救了?|saved?)\s*(\d+)\s*号/);
        const poisonedMatch = text.match(/(?:毒了?|poisoned?)\s*(\d+)\s*号/);
        const savedId = savedMatch ? parseInt(savedMatch[1], 10) - 1 : null;
        const poisonedId = poisonedMatch ? parseInt(poisonedMatch[1], 10) - 1 : null;
        const existing = dayClaims.witchClaims.findIndex(c => c.playerId === state.userId);
        if (existing >= 0) dayClaims.witchClaims[existing] = { playerId: state.userId, savedId, poisonedId };
        else dayClaims.witchClaims.push({ playerId: state.userId, savedId, poisonedId });
      }
      if (/守卫|守了|guard|guarded/i.test(text)) {
        const guardedMatch = text.match(/(?:守了?|guarded?)\s*(\d+)\s*号/);
        const guardedId = guardedMatch ? parseInt(guardedMatch[1], 10) - 1 : null;
        const existing = dayClaims.guardClaims.findIndex(c => c.playerId === state.userId);
        if (existing >= 0) dayClaims.guardClaims[existing] = { playerId: state.userId, guardedId };
        else dayClaims.guardClaims.push({ playerId: state.userId, guardedId });
      }
      // P9:女巫提交发言后,标记 lastWitchAction.announced = true
      const witchMark = userP?.role === 'witch' && s.lastWitchAction?.byPlayerId === state.userId && !s.lastWitchAction.announced
        ? { ...s.lastWitchAction, announced: true }
        : s.lastWitchAction;
      return {
        ...s,
        speeches: [...s.speeches, newSpeech],
        publicLog: [...s.publicLog, { kind: 'speech', day: s.round, playerId: state.userId, text }],
        claims: newClaims,
        lastWitchAction: witchMark,
      };
    });
    nextSpeaker();
  };

  /* 用户狼自爆
     ── P2-#A 阻断:最后 1 狼 → 自爆即输,按钮 disabled
     ── P2-#B 阻断:狼优势时(aliveWolves > aliveGood/2)→ 无故自爆送头,按钮 disabled + 解释 */
  const aliveWolvesCount = state.players.filter(p => p.alive && p.faction === 'wolf').length;
  const aliveGoodCount = state.players.filter(p => p.alive && p.faction === 'good').length;
  const isLastWolf = userIsWolf && aliveWolvesCount === 1;
  const wolfAdvantage = userIsWolf && aliveWolvesCount > aliveGoodCount / 2 && aliveWolvesCount > 1;
  const selfDestructBlocked = isLastWolf || wolfAdvantage;
  const selfDestructBlockReason = isLastWolf
    ? (lang === 'zh' ? '⚠️ 你是最后一只狼,自爆狼阵营立刻输!' : '⚠️ You are the last wolf — self-destruct = instant loss!')
    : wolfAdvantage
      ? (lang === 'zh' ? `⚠️ 狼阵营优势(${aliveWolvesCount} 狼 vs ${aliveGoodCount} 好人),无故自爆是送头` : `⚠️ Wolves have advantage (${aliveWolvesCount} vs ${aliveGoodCount}), self-destruct wastes your win`)
      : null;

  const onSelfDestruct = () => {
    if (!userIsWolf) return;
    if (selfDestructBlocked) return;
    if (typeof window !== 'undefined' && !window.confirm(lang === 'zh' ? '确认自爆?翻牌后立即进入夜晚!' : 'Confirm self-detonate? Goes to night immediately!')) return;
    setState(s => applyWolfSelfDestruct(s, state.userId, lang));
  };

  /* 用户骑士决斗 */
  const onKnightDuel = (targetId: number) => {
    if (!userP || userP.role !== 'knight' || userP.privateMemory.knightUsed) return;
    if (targetId === state.userId) return;
    setShowDuelTarget(false);
    setState(s => applyKnightDuel(s, state.userId, targetId, lang));
  };

  return (
    <div className="p-4 rounded-xl" style={{ background: 'var(--color-card-bg)', border: '1px solid var(--color-border-light)' }}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Users size={18} style={{ color: 'var(--color-accent)' }} />
          <h3 className="font-semibold" style={{ color: 'var(--color-text)' }}>
            {lang === 'zh' ? `白天讨论(${Math.min(discussIdx + 1, speakers.length)}/${speakers.length})` : `Day discussion (${Math.min(discussIdx + 1, speakers.length)}/${speakers.length})`}
          </h3>
        </div>
        {cur && (
          <div className="text-[11px] font-mono" style={{ color: timeLeft < 10 ? '#dc2626' : 'var(--color-text-muted)' }}>
            ⏱ {timeLeft}s
          </div>
        )}
      </div>
      {cur && busy ? (
        <div className="text-center text-sm py-3" style={{ color: 'var(--color-text-muted)' }}>
          {lang === 'zh' ? `AI ${cur.name} 正在发言…(剩 ${timeLeft}s)` : `AI ${cur.name} speaking… (${timeLeft}s)`}
        </div>
      ) : isUserTurn ? (
        <div>
          <p className="text-xs mb-2" style={{ color: 'var(--color-text-muted)' }}>
            {lang === 'zh' ? `🎤 轮到你了!请发言(30-100 字,口语化,剩 ${timeLeft}s):` : `🎤 Your turn (30-100 words, ${timeLeft}s):`}
          </p>
          <textarea
            value={userInput}
            onChange={e => setUserInput(e.target.value)}
            placeholder={lang === 'zh' ? '说点你的看法...可疑的人 / 你的站队 / 分析' : 'Share your thoughts... suspect / stance / analysis'}
            className="w-full p-2 rounded text-sm"
            style={{
              background: 'var(--color-bg-deep)', color: 'var(--color-text)',
              border: '1px solid var(--color-border-light)', minHeight: 70, resize: 'vertical',
            }}
            maxLength={200}
          />
          <div className="flex items-center justify-between mt-2 text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
            <span>{userInput.length}/200</span>
          </div>
          <div className="text-center mt-3 space-x-2">
            <Button onClick={submitUserSpeech}>
              {lang === 'zh' ? '发言 / 下一位' : 'Speak / Next'} <ChevronRight size={14} className="ml-1" />
            </Button>
            <Button onClick={nextSpeaker}>
              {lang === 'zh' ? '跳过' : 'Skip'}
            </Button>
          </div>
        </div>
      ) : null}

      {/* 狼自爆按钮(仅存活狼可见)
          P2-#A/P2-#B:最后狼 / 狼优势时 disabled 并显示原因 */}
      {userIsWolf && (
        <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--color-border-light)' }}>
          {selfDestructBlockReason && (
            <div className="mb-1.5 p-1.5 rounded text-[10px] text-center" style={{ background: 'rgba(220,38,38,0.1)', color: '#dc2626' }}>
              {selfDestructBlockReason}
            </div>
          )}
          <button
            onClick={onSelfDestruct}
            disabled={selfDestructBlocked}
            className="w-full px-3 py-2 rounded text-xs font-semibold transition-all"
            style={{
              background: selfDestructBlocked ? 'rgba(107,114,128,0.15)' : 'rgba(220,38,38,0.15)',
              color: selfDestructBlocked ? '#6b7280' : '#dc2626',
              border: `1px solid ${selfDestructBlocked ? '#6b7280' : '#dc2626'}`,
              cursor: selfDestructBlocked ? 'not-allowed' : 'pointer',
              opacity: selfDestructBlocked ? 0.5 : 1,
            }}
            title={selfDestructBlockReason ?? undefined}
          >
            💥 {lang === 'zh' ? '狼人自爆(翻牌 + 立即进夜)' : 'Wolf Self-Detonate'}
          </button>
        </div>
      )}

      {/* 骑士决斗按钮(仅存活 + 未用过的骑士可见) */}
      {userP?.alive && userP.role === 'knight' && !userP.privateMemory.knightUsed && (
        <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--color-border-light)' }}>
          {!showDuelTarget ? (
            <button
              onClick={() => setShowDuelTarget(true)}
              className="w-full px-3 py-2 rounded text-xs font-semibold transition-all hover:scale-105"
              style={{ background: 'rgba(249,115,22,0.15)', color: '#f97316', border: '1px solid #f97316' }}
            >
              ⚔️ {lang === 'zh' ? '骑士决斗(选一个玩家,整局 1 次)' : 'Knight Duel (once per game)'}
            </button>
          ) : (
            <div>
              <p className="text-xs mb-2" style={{ color: 'var(--color-text-muted)' }}>
                {lang === 'zh' ? '⚔️ 选择决斗对象(对方是狼→他死;对方是好人→你死):' : 'Duel target (wolf → they die; good → you die):'}
              </p>
              <div className="flex flex-wrap gap-1 justify-center">
                {state.players.filter(p => p.alive && p.id !== state.userId).map(p => (
                  <button key={p.id} onClick={() => onKnightDuel(p.id)}
                    className="px-2 py-1 rounded text-xs"
                    style={{ background: 'var(--color-bg-deep)', color: 'var(--color-text)', border: '1px solid var(--color-border-light)' }}>
                    {p.id + 1}.{p.name}
                  </button>
                ))}
                <button onClick={() => setShowDuelTarget(false)} className="px-2 py-1 rounded text-xs"
                  style={{ background: 'transparent', color: 'var(--color-text-muted)' }}>
                  {lang === 'zh' ? '取消' : 'Cancel'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DayVote({ state, setState, lang, aiSpeak, onExit }: {
  state: GameState; setState: (u: (s: GameState) => GameState) => void;
  lang: 'zh' | 'en';
  /** P11-A:死者退出按钮 */
  onExit?: () => void;
  aiSpeak: (id: number, sys: string, usr: string, silent?: boolean, options?: { temperature?: number; maxTokens?: number }) => Promise<{ speech: string; target: number | null }>;
}) {
  const alivePlayers = state.players.filter(p => p.alive);
  const [userTarget, setUserTarget] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  // P1-#B 修复:死人不能投票(规则上死亡玩家失去投票权);只可观战
  // P5 增强:dead panel 显示当前阶段 + busy 提示,避免用户以为游戏暂停了
  const userAlive = state.players[state.userId]?.alive;
  // P20 修复:用户死后不能让 phase 永远卡在 day-vote —— 自动跑 AI 投票 + finalize
  const deadUserAutoVoteRef = useRef(false);
  useEffect(() => {
    if (state.spectatorMode || userAlive || deadUserAutoVoteRef.current) return;
    if (alivePlayers.length < 2) return;  // 不够 2 人投票
    deadUserAutoVoteRef.current = true;
    setBusy(true);
    (async () => {
      const newAiVotes: Record<number, number> = {};
      for (const p of alivePlayers) {
        if (!canVote(p)) continue;
        const sys = buildVotePrompt(p, state, lang);
        const usr = lang === 'zh'
          ? '用 JSON 格式输出:{"target":投票给某人的座位号(1-based)}'
          : 'Output JSON: {"target":target seat (1-based)}';
        const { target } = await aiSpeak(p.id, sys, usr, true);
        if (target !== null && target >= 0 && target < state.players.length && state.players[target].alive && target !== p.id) {
          newAiVotes[p.id] = target;
        } else {
          const others = alivePlayers.filter(x => x.id !== p.id && canVote(x));
          if (others.length === 0) continue;
          newAiVotes[p.id] = others[Math.floor(Math.random() * others.length)].id;
        }
      }
      setBusy(false);
      // 用户已死 → 用 0 作占位(userVote 会被 canVote 过滤掉)
      setTimeout(() => finalizeWithVotes(newAiVotes, { voterId: state.userId, targetId: 0 }), 0);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (!state.spectatorMode && !userAlive) {
    return <DeadSpectator state={state} lang={lang}
      busyHint={busy ? (lang === 'zh' ? '🤔 AI 玩家正在投票…' : '🤔 AI players voting…') : undefined}
      onExit={onExit} />;
  }

  // P17:观看模式下自动跑 AI 投票(用户不在场,等不到 confirm)
  // 进入组件时如果还没跑过,自动触发一次
  const autoVoteTriggeredRef = useRef(false);
  useEffect(() => {
    if (!state.spectatorMode || busy || autoVoteTriggeredRef.current) return;
    autoVoteTriggeredRef.current = true;
    setBusy(true);
    (async () => {
      const newAiVotes: Record<number, number> = {};
      for (const p of alivePlayers) {
        if (p.id === state.userId) continue;
        if (!canVote(p)) continue;
        const sys = buildVotePrompt(p, state, lang);
        const usr = lang === 'zh' ? '用 JSON 格式输出:{"target":投票给某人的座位号(1-based)}' : 'Output JSON: {"target":target seat (1-based)}';
        const { target } = await aiSpeak(p.id, sys, usr, true);
        if (target !== null && target >= 0 && target < state.players.length && state.players[target].alive && target !== p.id) {
          newAiVotes[p.id] = target;
        } else {
          const others = alivePlayers.filter(x => x.id !== p.id && canVote(x));
          if (others.length === 0) continue;
          newAiVotes[p.id] = others[Math.floor(Math.random() * others.length)].id;
        }
      }
      setBusy(false);
      setTimeout(() => finalizeWithVotes(newAiVotes, { voterId: state.userId, targetId: 0 }), 0);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // P3-#42 修复:用户点「确认投票」→ 锁住 userTarget → 跑 AI 投票 → finalize
  const confirmAndFinalize = async () => {
    if (userTarget === null) return;
    setBusy(true);
    // 先把 userTarget 立刻写入(锁定)
    const userVoteEntry: { voterId: number; targetId: number } = { voterId: state.userId, targetId: userTarget };
    // 跑 AI 投票
    const newAiVotes: Record<number, number> = {};
    for (const p of alivePlayers) {
      if (p.id === state.userId) continue;
      if (!canVote(p)) continue;
      const sys = buildVotePrompt(p, state, lang);
      const usr = lang === 'zh'
        ? '用 JSON 格式输出:{"target":投票给某人的座位号(1-based)}'
        : 'Output JSON: {"target":target seat (1-based)}';
      const { target } = await aiSpeak(p.id, sys, usr, true);
      if (target !== null && target >= 0 && target < state.players.length && state.players[target].alive && target !== p.id) {
        newAiVotes[p.id] = target;
      } else {
        const others = alivePlayers.filter(x => x.id !== p.id && canVote(x));
        if (others.length === 0) continue;
        newAiVotes[p.id] = others[Math.floor(Math.random() * others.length)].id;
      }
    }
    setBusy(false);
    // finalize 用新的 aiVotes
    setTimeout(() => finalizeWithVotes(newAiVotes, userVoteEntry), 0);
  };

  // finalize 用传入的 votes(用于 P3-#42 同步投票)
  const finalizeWithVotes = (votesArg: Record<number, number>, userVoteArg: { voterId: number; targetId: number }) => {
    // 收集所有投票(用于狼美人殉情)
    const allVotes: { voterId: number; targetId: number }[] = [];
    Object.entries(votesArg).forEach(([voterId, targetId]) => {
      const tid = targetId as number;
      if (tid === null || tid < 0) return;
      allVotes.push({ voterId: parseInt(voterId, 10), targetId: tid });
    });
    allVotes.push(userVoteArg);
    // 票数最多的被投(P0-#2 修复:用 sheriffVoteWeight 1.5 票归票机制)
    const tally: Record<number, number> = {};
    allVotes.forEach(v => {
      const voter = state.players[v.voterId];
      if (!voter || !canVote(voter)) return;
      const weight = sheriffVoteWeight(state, v.voterId);
      tally[v.targetId] = (tally[v.targetId] || 0) + weight;
    });
    const tallyValues = Object.values(tally);
    const maxVotes = tallyValues.length > 0 ? Math.max(...tallyValues) : 0;
    const tied = Object.entries(tally)
      .filter(([_, c]) => c === maxVotes)
      .map(([id]) => parseInt(id, 10));

    if (tied.length > 1) {
      if (state.pkUsed) {
        setState(s => ({
          ...s,
          publicLog: [...s.publicLog, { kind: 'system', day: s.round, text: `🕊️ 再次平票,平安日。直接进入夜晚。` }],
          phase: 'night',
          round: s.round + 1,
          pkPlayers: null,
          pkUsed: false,
          lastVoteData: { allVotes, tally, exiled: null, tied: true },
        }));
        return;
      }
      setState(s => ({
        ...s,
        publicLog: [...s.publicLog, { kind: 'system', day: s.round, text: `⚖️ 投票平票(${tied.map(id => `${id+1}号`).join('、')})!进行 PK 发言` }],
        phase: 'pk-speech',
        pkPlayers: tied,
        pkUsed: true,
        lastVoteData: { allVotes, tally, exiled: null, tied: true },
      }));
      return;
    }

    let exiled: number | null = null;
    Object.entries(tally).forEach(([id, count]) => {
      if (count === maxVotes && maxVotes > 0) exiled = parseInt(id, 10);
    });
    // P6-#E:把这次投票结果追加到 voteHistory(供右侧栏每轮投票面板)
    const pushHistory = (s: GameState, finalExiled: number | null) => ({
      ...s,
      voteHistory: [
        ...(s.voteHistory ?? []),
        { round: s.round, allVotes, tally, exiled: finalExiled },
      ],
    });
    if (exiled === null) {
      setState(s => ({
        ...pushHistory(s, null),
        phase: 'night', round: s.round + 1, pkUsed: false, pkPlayers: null,
        lastVoteData: { allVotes, tally, exiled: null },
      }));
      return;
    }

    setState(s => ({
      ...pushHistory(s, exiled),
      phase: 'vote-results',
      lastVoteData: { allVotes, tally, exiled },
      pkUsed: false,
      pkPlayers: null,
    }));
  };

  // P3-#42 修复:删除旧 useEffect(同步投票不需要自动跑 AI 投票)
  // useEffect(() => { if (Object.keys(aiVotes).length === 0) runVotes(); /* eslint-disable-next-line */ }, []);

  return (
    <div className="p-4 rounded-xl" style={{ background: 'var(--color-card-bg)', border: '1px solid var(--color-accent)' }}>
      <h3 className="font-semibold mb-3 flex items-center gap-1.5" style={{ color: 'var(--color-text)' }}>
        <Swords size={16} style={{ color: 'var(--color-accent)' }} />{lang === 'zh' ? '投票放逐' : 'Vote to exile'}
      </h3>
      {busy ? (
        <p className="text-sm text-center py-3" style={{ color: 'var(--color-text-muted)' }}>{lang === 'zh' ? 'AI 玩家正在投票…' : 'AI voting…'}</p>
      ) : (
        <>
          <p className="text-xs mb-2" style={{ color: 'var(--color-text-muted)' }}>{lang === 'zh' ? '你投票给:' : 'You vote for:'}</p>
          <div className="flex flex-wrap gap-1.5 justify-center">
            {alivePlayers.filter(p => p.id !== state.userId).map(p => (
              <button key={p.id} onClick={() => setUserTarget(p.id)}
                className="px-2 py-1 rounded text-xs"
                style={{
                  background: userTarget === p.id ? 'var(--color-accent)' : 'var(--color-card-bg)',
                  color: userTarget === p.id ? '#fff' : 'var(--color-text)',
                }}>{p.id + 1}.{p.name}</button>
            ))}
          </div>
          <div className="text-center mt-3 space-x-2">
            <Button onClick={() => { setUserTarget(null); }} disabled={userTarget === null}>
              {lang === 'zh' ? '清除' : 'Clear'}
            </Button>
            <Button onClick={confirmAndFinalize} disabled={userTarget === null}>
              {lang === 'zh' ? '确认投票' : 'Confirm'}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   遗言阶段 —— 标准规则:仅首夜+白天死亡的玩家有遗言,按死亡先后顺序
   ═══════════════════════════════════════════════════════════════════ */

function LastWords({ state, setState, lang, aiSpeak }: {
  state: GameState; setState: (u: (s: GameState) => GameState) => void;
  lang: 'zh' | 'en';
  aiSpeak: (id: number, sys: string, usr: string, silent?: boolean, options?: { temperature?: number; maxTokens?: number }) => Promise<{ speech: string; target: number | null }>;
}) {
  // 优先用 pendingLastWords(明确按死亡顺序);空则降级到 deadThisNight(向后兼容)
  const deadIds = state.pendingLastWords.length > 0
    ? state.pendingLastWords.filter(id => state.players[id])
    : [...state.deadThisNight].filter(id => state.players[id]);
  const [lwIdx, setLwIdx] = useState(0);
  const [busy, setBusy] = useState(false);
  const [userInput, setUserInput] = useState('');
  const cur = deadIds[lwIdx];
  const curPlayer = cur !== undefined ? state.players[cur] : null;
  const isUserTurn = curPlayer && curPlayer.id === state.userId && !busy;

  const next = () => {
    setUserInput('');
    if (lwIdx + 1 >= deadIds.length) {
      // 全部说完:清空 pendingLastWords,根据情况进入下一阶段
      setState(s => {
        // P6-#F:优先看警长传承(警长死后选 pass/tear,必须在最后遗言后立即触发)
        if (s.pendingSheriffSuccession !== null) {
          return { ...s, phase: 'sheriff-succession', pendingLastWords: [], lastVotedOut: null };
        }
        // P1-#9 修复:优先看白痴(state.lastVotedOut 指向白痴,人还活着)
        if (s.lastVotedOut !== null) {
          const votedOut = s.players[s.lastVotedOut];
          if (votedOut && votedOut.alive && votedOut.role === 'idiot') {
            return { ...s, phase: 'idiot-flip', pendingLastWords: [] };
          }
        }
        // 其次看是否有猎人被本次白天死亡触发开枪
        const hunterDied = deadIds.find(id => s.players[id]?.role === 'hunter');
        if (hunterDied !== undefined) {
          return { ...s, phase: 'hunter-shoot', lastVotedOut: hunterDied, pendingLastWords: [] };
        }
        // P1-#22 修复(用户反馈:首夜后应进白天,且 12+ 人局要有警长竞选):
        // 用 lastVotedOut 区分来源 — 被投票放逐产生的死亡→下一阶段是夜,其他→下一阶段是 day-announce
        if (s.lastVotedOut !== null) {
          // 白天投票放逐 → 下一阶段是夜晚(round+1)
          return { ...s, phase: 'night', round: s.round + 1, pendingLastWords: [], lastVotedOut: null };
        }
        // 夜间死亡 → 下一阶段是 day-announce(它会检查 12+ 人局进 sheriff-election)
        return { ...s, phase: 'day-announce', pendingLastWords: [] };
      });
      return;
    }
    setLwIdx(i => i + 1);
  };

  // P25 修复:LastWords 加超时兜底 + lastProcessedSpeakerRef 防重入(AI 卡死时强制 next)
  const lastProcessedLwRef = useRef<number | null>(null);
  useEffect(() => {
    if (!curPlayer) return;
    if (curPlayer.id === state.userId) {
      // 用户遗言阶段:跳过 AI useEffect,等用户点"说完"按钮
      // P25:用户死了 → DeadSpectator 应该接管,这里不应该再 return 卡死
      // P31 修复:之前直接 setLwIdx(i+1) 会绕过 next() 里 "lwIdx+1 >= length" 的判断,
      //  导致 deadIds 走完后永远卡在 last-words。改为调用 next(),由它决定是推进还是结算。
      if (!state.players[state.userId]?.alive) {
        const tid = window.setTimeout(() => {
          setBusy(false);
          next();
        }, 100);
        return () => clearTimeout(tid);
      }
      return;
    }
    if (busy) return;
    if (lastProcessedLwRef.current === curPlayer.id) return;
    lastProcessedLwRef.current = curPlayer.id;
    setBusy(true);
    const isDay = state.pendingLastWords.length > 0 && state.deadThisNight.length === 0;
    const diedFrom = isDay ? '白天投票/技能' : '夜间';
    const sys = lang === 'zh'
      ? `你是"${curPlayer.name}"(第${curPlayer.id + 1}号),你因${diedFrom}被杀了!请留遗言(30-80 字):\n- 可以留自己的身份线索(也可不)\n- 可以留怀疑对象\n- 可以感谢/指责某人\n\n只输出你的遗言。`
      : `You are "${curPlayer.name}", you died. Leave last words (30-80 words). Output speech only.`;
    // P25:超时兜底 30s,防止 aiSpeak 永远不返回时 busy 卡死
    const timeoutId = window.setTimeout(() => {
      if (lastProcessedLwRef.current === curPlayer.id) {
        console.warn(`[Werewolf] LastWords AI timeout for player ${curPlayer.id}, forcing next`);
        lastProcessedLwRef.current = null;
        setBusy(false);
        setTimeout(() => next(), 0);
      }
    }, 30000);
    aiSpeak(curPlayer.id, sys, lang === 'zh' ? '请留遗言(30-80 字)' : 'Leave last words (30-80 words)').then(({ speech }) => {
      clearTimeout(timeoutId);
      if (lastProcessedLwRef.current !== curPlayer.id) return;  // 超时已强制 next
      lastProcessedLwRef.current = null;
      // P3-#C 修复:给 AI 遗言打 phase='last-words' 标签(否则右侧栏看不出是遗言)
      setState(s => ({
        ...s,
        speeches: s.speeches.map(sp =>
          sp.playerId === curPlayer.id && sp.day === s.round && sp.text === speech && !sp.phase
            ? { ...sp, phase: 'last-words' as const }
            : sp
        ),
      }));
      setBusy(false);
      setTimeout(() => next(), 500);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lwIdx]);

  const submitUser = () => {
    if (!curPlayer) return;
    const text = userInput.trim() || (lang === 'zh' ? '(我暂时没有想说的)' : '(I have nothing to say)');
    setState(s => ({
      ...s,
      speeches: [...s.speeches, { playerId: state.userId, day: s.round, text, phase: 'last-words' }],
      publicLog: [...s.publicLog, { kind: 'speech', day: s.round, playerId: state.userId, text }],
    }));
    next();
  };

  if (deadIds.length === 0) {
    // P2-#23 修复:用 ref guard 防止 StrictMode 双跑
    const didAutoAdvanceRef = useRef(false);
    useEffect(() => {
      if (didAutoAdvanceRef.current) return;
      didAutoAdvanceRef.current = true;
      setState(s => ({ ...s, phase: 'day-announce', pendingLastWords: [] }));
    }, []);
    return null;
  }

  // P25:用户死后 → 显示 DeadSpectator(让游戏继续,不让卡死)
  const lwUserAlive = state.players[state.userId]?.alive;
  if (!state.spectatorMode && lwUserAlive === false) {
    return <DeadSpectator state={state} lang={lang}
      busyHint={lang === 'zh'
        ? `🕯️ 遗言阶段(${lwIdx + 1}/${deadIds.length}) · AI 正在留遗言…`
        : `🕯️ Last Words (${lwIdx + 1}/${deadIds.length}) · AI speaking…`}
      progress={{ current: lwIdx + 1, total: deadIds.length, label: lang === 'zh' ? `🕯️ 遗言进度` : `🕯️ Last words progress` }} />;
  }

  return (
    <div className="p-4 rounded-xl" style={{ background: 'var(--color-card-bg)', border: '1px solid #6b7280' }}>
      <h3 className="font-semibold mb-2 flex items-center gap-1.5" style={{ color: '#9ca3af' }}>
        <Skull size={16} />{lang === 'zh' ? `🕯️ 遗言阶段(${lwIdx + 1}/${deadIds.length})` : `Last Words (${lwIdx + 1}/${deadIds.length})`}
      </h3>
      <p className="text-xs text-center mb-3" style={{ color: 'var(--color-text-muted)' }}>
        {lang === 'zh' ? '死者按死亡顺序留遗言:' : 'Dead players speak in death order:'}
      </p>
      {curPlayer && busy ? (
        <div className="text-center text-sm py-3" style={{ color: 'var(--color-text-muted)' }}>
          {lang === 'zh' ? `AI ${curPlayer.name} 正在留遗言…` : `AI ${curPlayer.name} leaving last words…`}
        </div>
      ) : isUserTurn ? (
        <div>
          <p className="text-xs mb-2" style={{ color: 'var(--color-text-muted)' }}>
            🕯️ {lang === 'zh' ? '你被杀了,留遗言:' : 'You died, leave last words:'}
          </p>
          <textarea
            value={userInput}
            onChange={e => setUserInput(e.target.value)}
            placeholder={lang === 'zh' ? '留你的遗言、身份线索、怀疑对象…' : 'Last words, identity hint, suspects…'}
            className="w-full p-2 rounded text-sm"
            style={{ background: 'var(--color-bg-deep)', color: 'var(--color-text)', border: '1px solid var(--color-border-light)', minHeight: 60, resize: 'vertical' }}
            maxLength={150}
          />
          <div className="text-center mt-3">
            <Button onClick={submitUser}>
              {lang === 'zh' ? '说完 / 下一位' : 'Done / Next'} <ChevronRight size={14} className="ml-1" />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   投票结果 —— 完整公开投票详情(谁投了谁、票数、被放逐者)
   ── 关键 UX 修复:之前用户看不到投票过程,现在每个人都能看到完整投票
   ═══════════════════════════════════════════════════════════════════ */

function VoteResults({ state, setState, lang }: {
  state: GameState; setState: (u: (s: GameState) => GameState) => void;
  lang: 'zh' | 'en';
}) {
  const data = state.lastVoteData;
  // 内部 helper:从 playerId 拿名字(避免重复写 s(id))
  const name = (id: number) => state.players[id]?.name ?? `?${id}`;
  if (!data) {
    // P2-#23 修复:用 ref guard 防止 StrictMode 双跑
    const didAutoAdvanceRef = useRef(false);
    useEffect(() => {
      if (didAutoAdvanceRef.current) return;
      didAutoAdvanceRef.current = true;
      setState(s => ({ ...s, phase: 'night', round: s.round + 1 }));
    }, []);
    return null;
  }
  const { allVotes, tally, exiled } = data;
  const sortedTally = Object.entries(tally).sort(([, a], [, b]) => b - a);

  /* 继续到下一阶段(白痴翻牌 / 猎人开枪 / 遗言 / 直接进夜)
   ── 修复:之前白天死亡后直接跳到下一阶段,没有遗言;
   ──   现在按用户口径:白天死亡玩家有遗言,按死亡先后顺序发言
   ── P0-#53 修复:狼王被投时分两阶段(先狼王说遗言,再 wolfking-pick 选 victim) */
  const proceed = () => {
    setState(s => {
      if (exiled === null) {
        return { ...s, phase: 'night', round: s.round + 1, lastVoteData: null, pendingLastWords: [] };
      }
      const exiledRole = s.players[exiled].role;
      if (exiledRole === 'idiot') {
        // P1-#9 修复:白痴被投也进 last-words(白痴先说遗言,然后 idiot-flip 选择翻牌)
        return {
          ...s,
          phase: 'last-words',
          lastVotedOut: exiled,
          lastVoteData: null,
          publicLog: [...s.publicLog, { kind: 'death' as const, day: s.round, playerId: exiled, text: `🗳️ ${s.players[exiled].name} 被投票放逐` }],
          deadThisDay: exiled,
          pendingLastWords: [exiled],
        };
      }
      const logEntries: { kind: 'death'; day: number; playerId: number; text: string }[] = [
        { kind: 'death' as const, day: s.round, playerId: exiled, text: `🗳️ ${s.players[exiled].name} 被投票放逐` },
      ];
      // P0-#53 修复:狼王被投 → 进 wolfking-pick 阶段(独立 UI,让用户/AI 选 victim)
      if (exiledRole === 'wolfking') {
        const aliveAfter = s.players.filter(p => p.alive && p.id !== exiled);
        if (aliveAfter.length > 0) {
          return {
            ...s,
            publicLog: [...s.publicLog, ...logEntries],
            deadThisDay: exiled,
            lastVotedOut: exiled,
            pendingLastWords: [exiled],  // 狼王先念遗言
            phase: 'wolfking-pick',  // 独立阶段:狼王选 victim
            wolfkingVictim: null,    // 等选人
            lastVoteData: null,
          };
        }
      }
      // 其他角色(普通 / 狼美人 / 猎人 / 守卫 等):走原来的链式处理
      let newlyDead: number[] = [exiled];
      if (exiledRole === 'wolfbeauty') {
        const lastVoter = [...allVotes].reverse().find(v => v.targetId === exiled);
        if (lastVoter) {
          newlyDead.push(lastVoter.voterId);
          logEntries.push({ kind: 'death' as const, day: s.round, playerId: lastVoter.voterId, text: `💋 ${s.players[lastVoter.voterId].name} 跟着去了` });
        }
      }
      const deadSet = new Set(newlyDead);
      let updatedPlayers = s.players.map(p => deadSet.has(p.id) ? { ...p, alive: false } : p);
      const { state: afterLovers, chained } = applyLoversChain({ ...s, players: updatedPlayers }, newlyDead);
      updatedPlayers = afterLovers.players;
      newlyDead = chained.length > 0 ? [...newlyDead, ...chained] : newlyDead;
      return {
        ...s,
        players: updatedPlayers,
        publicLog: [...s.publicLog, ...logEntries],
        deadThisDay: exiled,
        lastVotedOut: exiled,
        pendingLastWords: newlyDead,
        phase: 'last-words',
        lastVoteData: null,
      };
    });
  };

  return (
    <div className="p-4 rounded-xl" style={{ background: 'var(--color-card-bg)', border: '1px solid #a855f7' }}>
      <h3 className="font-semibold mb-3 flex items-center gap-1.5" style={{ color: '#a855f7' }}>
        <Swords size={16} />{lang === 'zh' ? '🗳️ 投票结果' : 'Vote Results'}
      </h3>

      {/* 投票详情:每个人投了谁 */}
      <div className="mb-3">
        <div className="text-[10px] font-semibold mb-1" style={{ color: 'var(--color-text-muted)' }}>
          {lang === 'zh' ? '📋 投票详情:' : '📋 Vote details:'}
        </div>
        <div className="space-y-0.5 max-h-32 overflow-y-auto">
          {allVotes.map((v, i) => {
            const isUserVoter = v.voterId === state.userId;
            return (
              <div key={i} className="text-[11px] flex items-center gap-1 px-1.5 py-0.5 rounded"
                style={{ background: isUserVoter ? 'rgba(168,85,247,0.1)' : 'transparent' }}>
                <span style={{ color: isUserVoter ? '#a855f7' : 'var(--color-text)' }}>{name(v.voterId)}</span>
                <span style={{ color: 'var(--color-text-muted)' }}>→</span>
                <span style={{ color: '#a855f7' }}>{name(v.targetId)}</span>
                {state.players[v.voterId]?.privateMemory?.isSheriff && <span style={{ color: '#facc15' }}>⭐</span>}
              </div>
            );
          })}
        </div>
      </div>

      {/* 票数统计 */}
      <div className="mb-3">
        <div className="text-[10px] font-semibold mb-1" style={{ color: 'var(--color-text-muted)' }}>
          {lang === 'zh' ? '📊 票数统计:' : '📊 Tally:'}
        </div>
        <div className="space-y-0.5">
          {sortedTally.map(([id, count]) => {
            const pid = parseInt(id, 10);
            const player = state.players[pid];
            const isExiled = pid === exiled;
            return (
              <div key={id} className="text-[11px] flex items-center gap-2 px-2 py-1 rounded"
                style={{ background: isExiled ? 'rgba(220,38,38,0.15)' : 'var(--color-bg-deep)' }}>
                <span style={{ color: isExiled ? '#dc2626' : 'var(--color-text)', fontWeight: isExiled ? 'bold' : 'normal' }}>
                  {player.name}
                </span>
                <span style={{ color: isExiled ? '#dc2626' : 'var(--color-text-muted)' }}>{count} {lang === 'zh' ? '票' : 'votes'}</span>
                {player.privateMemory?.isSheriff && <span style={{ color: '#facc15' }}>⭐{lang === 'zh' ? '警长' : 'sheriff'}</span>}
                {isExiled && <span className="ml-auto" style={{ color: '#dc2626' }}>💀 {lang === 'zh' ? '放逐' : 'exile'}</span>}
              </div>
            );
          })}
        </div>
      </div>

      {exiled === null && (
        <div className="text-sm mb-3 text-center p-2 rounded" style={{ background: 'rgba(34,197,94,0.1)', color: '#16a34a' }}>
          🕊️ {lang === 'zh' ? '无人被放逐(平安日)' : 'No exile (peaceful day)'}
        </div>
      )}

      <div className="text-center">
        <Button onClick={proceed}>
          {lang === 'zh' ? '继续' : 'Continue'} <ChevronRight size={14} className="ml-1" />
        </Button>
      </div>
    </div>
  );
}

function PKSpeech({ state, setState, lang, aiSpeak }: {
  state: GameState; setState: (u: (s: GameState) => GameState) => void;
  lang: 'zh' | 'en';
  aiSpeak: (id: number, sys: string, usr: string, silent?: boolean, options?: { temperature?: number; maxTokens?: number }) => Promise<{ speech: string; target: number | null }>;
}) {
  const tiedIds = state.pkPlayers ?? [];
  const [pkIdx, setPkIdx] = useState(0);
  const [busy, setBusy] = useState(false);
  const [userInput, setUserInput] = useState('');
  const cur = tiedIds[pkIdx];
  const curPlayer = cur !== undefined ? state.players[cur] : null;
  const isUserTurn = curPlayer && curPlayer.id === state.userId && !busy;

  const next = () => {
    setUserInput('');
    if (pkIdx + 1 >= tiedIds.length) {
      // PK 发言完 → 进入 PK 投票
      setState(s => ({ ...s, phase: 'pk-vote' }));
      return;
    }
    setPkIdx(i => i + 1);
  };

  useEffect(() => {
    if (!curPlayer) return;
    if (curPlayer.id === state.userId) return;
    if (busy) return;
    setBusy(true);
    const sys = lang === 'zh'
      ? `你是"${curPlayer.name}"(第${curPlayer.id + 1}号),你和 ${tiedIds.filter(i => i !== curPlayer.id).map(i => `${i+1}号 ${state.players[i].name}`).join('、')} 票数一样,需要再发言一次说服大家投你。\n\n请发言(30-80 字,要更激烈、更具体地为自己辩护,指责其他平票者)。\n\n只输出发言内容。`
      : `You are "${curPlayer.name}", tied with others. Give a 30-80 word speech to convince voters. Output speech only.`;
    aiSpeak(curPlayer.id, sys, lang === 'zh' ? '请用口语发言(30-80 字)' : 'Speak 30-80 words').then(() => {
      setBusy(false);
      setTimeout(() => next(), 500);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pkIdx]);

  const submitUser = () => {
    if (!curPlayer) return;
    const text = userInput.trim() || (lang === 'zh' ? '(我坚持立场,大家投我)' : '(I stand by my position)');
    setState(s => ({
      ...s,
      speeches: [...s.speeches, { playerId: state.userId, day: s.round, text, phase: 'pk' }],
      publicLog: [...s.publicLog, { kind: 'speech', day: s.round, playerId: state.userId, text }],
    }));
    next();
  };

  return (
    <div className="p-4 rounded-xl" style={{ background: 'var(--color-card-bg)', border: '1px solid #f97316' }}>
      <h3 className="font-semibold mb-2 flex items-center gap-1.5" style={{ color: '#f97316' }}>
        <Swords size={16} />{lang === 'zh' ? `⚔️ PK 发言(${pkIdx + 1}/${tiedIds.length})` : `PK Speech (${pkIdx + 1}/${tiedIds.length})`}
      </h3>
      <p className="text-xs text-center mb-3" style={{ color: 'var(--color-text-muted)' }}>
        {lang === 'zh' ? '平票玩家轮流再发言一次:' : 'Tied players give another speech:'}
      </p>
      {curPlayer && busy ? (
        <div className="text-center text-sm py-3" style={{ color: 'var(--color-text-muted)' }}>
          {lang === 'zh' ? `AI ${curPlayer.name} 正在 PK 发言…` : `AI ${curPlayer.name} PK speaking…`}
        </div>
      ) : isUserTurn ? (
        <div>
          <p className="text-xs mb-2" style={{ color: 'var(--color-text-muted)' }}>
            🎤 {lang === 'zh' ? 'PK 轮到你,再说服大家:' : 'PK: your turn to convince:'}
          </p>
          <textarea
            value={userInput}
            onChange={e => setUserInput(e.target.value)}
            placeholder={lang === 'zh' ? '为自己辩护 / 指出对手可疑' : 'Defend yourself / accuse opponents'}
            className="w-full p-2 rounded text-sm"
            style={{ background: 'var(--color-bg-deep)', color: 'var(--color-text)', border: '1px solid var(--color-border-light)', minHeight: 60, resize: 'vertical' }}
            maxLength={150}
          />
          <div className="text-center mt-3">
            <Button onClick={submitUser}>
              {lang === 'zh' ? '发言 / 下一位' : 'Speak / Next'} <ChevronRight size={14} className="ml-1" />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   PK 投票 —— PK 发言后,所有存活玩家再投一次(只能投平票玩家)
   ═══════════════════════════════════════════════════════════════════ */

function PKVote({ state, setState, lang, aiSpeak }: {
  state: GameState; setState: (u: (s: GameState) => GameState) => void;
  lang: 'zh' | 'en';
  aiSpeak: (id: number, sys: string, usr: string, silent?: boolean, options?: { temperature?: number; maxTokens?: number }) => Promise<{ speech: string; target: number | null }>;
}) {
  const tiedIds = state.pkPlayers ?? [];
  const alivePlayers = state.players.filter(p => p.alive);
  const [userTarget, setUserTarget] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [aiVotes, setAiVotes] = useState<Record<number, number>>({});

  const runVotes = async () => {
    setBusy(true);
    const votes: Record<number, number> = {};
    for (const p of alivePlayers) {
      if (p.id === state.userId) continue;
      if (!canVote(p)) continue;  // 修复:翻牌白痴不投票
      // P31 修复(用户反馈):平票上 PK 的玩家没有投票权(只能被投,不能投别人)
      if (tiedIds.includes(p.id)) continue;
      // 只能投平票玩家之一
      const sys = lang === 'zh'
        ? `你是"${p.name}",PK 后再投一次,只能投这几个人之一:${tiedIds.map(id => `${id+1}号 ${state.players[id].name}`).join('、')}\n请用 JSON 输出:{"target":投票给某人的座位号(1-based)}`
        : `You are "${p.name}". Re-vote among: ${tiedIds.map(id => `${id+1} ${state.players[id].name}`).join(', ')}\nOutput JSON: {"target":target seat (1-based)}`;
      const usr = lang === 'zh' ? '用 JSON 输出:{"target":目标座位号(1-based)}' : 'Output JSON: {"target":target seat (1-based)}';
      const { target } = await aiSpeak(p.id, sys, usr, true);
      if (target !== null && tiedIds.includes(target) && target !== p.id) {
        votes[p.id] = target;
      } else {
        // fallback: 随机投一个
        votes[p.id] = tiedIds[Math.floor(Math.random() * tiedIds.length)];
      }
    }
    setAiVotes(votes);
    setBusy(false);
  };

  useEffect(() => { if (Object.keys(aiVotes).length === 0) runVotes(); /* eslint-disable-next-line */ }, []);

  // P17:观看模式下,AI 投完票后自动 finalize(用户不在场等不到 confirm)
  useEffect(() => {
    if (!state.spectatorMode) return;
    if (busy) return;
    if (Object.keys(aiVotes).length === 0) return;  // 还在跑
    const tid = window.setTimeout(() => finalize(), 300);
    return () => clearTimeout(tid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiVotes, busy, state.spectatorMode]);

  const finalize = () => {
    const allVotes: { voterId: number; targetId: number }[] = [];
    Object.entries(aiVotes).forEach(([voterId, targetId]) => {
      allVotes.push({ voterId: parseInt(voterId, 10), targetId: targetId as number });
    });
    if (userTarget !== null) allVotes.push({ voterId: state.userId, targetId: userTarget });
    const tally: Record<number, number> = {};
    allVotes.forEach(v => {
      const voter = state.players[v.voterId];
      if (!voter || !canVote(voter)) return;
      // P0-#2 修复:用 sheriffVoteWeight 1.5 票归票机制
      const weight = sheriffVoteWeight(state, v.voterId);
      tally[v.targetId] = (tally[v.targetId] || 0) + weight;
    });
    const tallyValues = Object.values(tally);
    const maxVotes = tallyValues.length > 0 ? Math.max(...tallyValues) : 0;
    const stillTied = Object.entries(tally).filter(([_, c]) => c === maxVotes).map(([id]) => parseInt(id, 10));

    if (stillTied.length > 1) {
      // 再次平票 = 平安日
      setState(s => ({
        ...s,
        publicLog: [...s.publicLog, { kind: 'system', day: s.round, text: `🕊️ PK 后仍平票,平安日。` }],
        phase: 'night',
        round: s.round + 1,
        pkUsed: false,
        pkPlayers: null,
        lastVoteData: { allVotes, tally, exiled: null, tied: true },
      }));
      return;
    }
    // 有结果 → 走放逐(进 vote-results 显示详情后再处理)
    const exiled = stillTied[0];
    setState(s => ({
      ...s,
      voteHistory: [...(s.voteHistory ?? []), { round: s.round, allVotes, tally, exiled }],
      phase: 'vote-results',
      lastVoteData: { allVotes, tally, exiled },
      pkUsed: false,
      pkPlayers: null,
    }));
  };

  return (
    <div className="p-4 rounded-xl" style={{ background: 'var(--color-card-bg)', border: '1px solid #f97316' }}>
      <h3 className="font-semibold mb-3 flex items-center gap-1.5" style={{ color: '#f97316' }}>
        <Swords size={16} />{lang === 'zh' ? '🗳️ PK 投票' : 'PK Vote'}
      </h3>
      {busy ? (
        <p className="text-sm text-center py-3" style={{ color: 'var(--color-text-muted)' }}>{lang === 'zh' ? 'AI 玩家 PK 投票中…' : 'AI PK voting…'}</p>
      ) : tiedIds.includes(state.userId) ? (
        // P31 修复(用户反馈):平票上 PK 的玩家没有投票权,显示提示并禁用按钮
        <div className="text-center py-3">
          <p className="text-sm mb-1" style={{ color: '#f97316' }}>{lang === 'zh' ? '⚠️ 你上了 PK,没有投票权' : '⚠️ You are on PK, no voting right'}</p>
          <p className="text-xs mb-3" style={{ color: 'var(--color-text-muted)' }}>{lang === 'zh' ? '等其他玩家投完看结果' : 'Wait for others to vote'}</p>
          <Button onClick={finalize}>
            {lang === 'zh' ? '跳过 / 看结果' : 'Skip / View Result'} <ChevronRight size={14} className="ml-1" />
          </Button>
        </div>
      ) : (
        <>
          <p className="text-xs mb-2" style={{ color: 'var(--color-text-muted)' }}>{lang === 'zh' ? `只能投平票玩家之一(${tiedIds.map(id => `${id+1}号`).join('、')}):` : `Vote among: ${tiedIds.map(id => `${id+1}`).join(', ')}`}</p>
          <div className="flex flex-wrap gap-1.5 justify-center">
            {tiedIds.map(id => (
              <button key={id} onClick={() => setUserTarget(id)}
                className="px-2 py-1 rounded text-xs"
                style={{
                  background: userTarget === id ? '#f97316' : 'var(--color-card-bg)',
                  color: userTarget === id ? '#fff' : 'var(--color-text)',
                }}>{id + 1}.{state.players[id].name}</button>
            ))}
          </div>
          <div className="text-center mt-3">
            <Button onClick={finalize} disabled={userTarget === null}>
              {lang === 'zh' ? '确认 PK 投票' : 'Confirm PK Vote'} <ChevronRight size={14} className="ml-1" />
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function GameOver({ state, winner, lang, onExit, onReplay }: {
  state: GameState; winner: 'wolf' | 'good' | 'third'; lang: 'zh' | 'en';
  onExit: () => void; onReplay: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [copiedOps, setCopiedOps] = useState(false);
  const title = winner === 'good'
    ? (lang === 'zh' ? '🌟 好人胜利!' : '🌟 Good wins!')
    : winner === 'wolf'
      ? (lang === 'zh' ? '🐺 狼人胜利!' : '🐺 Wolves win!')
      : (lang === 'zh' ? '🎭 第三方胜利!' : '🎭 Third party wins!');
  // P3-#56 修复:显示胜利原因
  const reason = winner === 'good'
    ? (lang === 'zh' ? '所有狼人已被放逐' : 'All wolves eliminated')
    : winner === 'wolf'
      ? (lang === 'zh' ? '狼人阵营达成胜利条件(神/民任一方全灭)' : 'Wolves achieved win condition (gods or villagers all dead)')
      : (lang === 'zh' ? '第三方达成胜利条件' : 'Third party achieved win condition');

  // P1-#22 修复(用户反馈):导出对话功能
  // 复制整个游戏的对话日志到剪贴板,方便发回给 Claude 调试
  const exportDialogue = async () => {
    const text = formatGameLog(state, lang);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      // 兜底:用 prompt 显示
      window.prompt(lang === 'zh' ? '复制下面的对话:' : 'Copy the dialogue below:', text);
    }
  };

  // P24+:导出操作日志(不含对话)—— 用户想看纯操作流水
  const exportOperations = async () => {
    const text = formatOpsLog(state, lang);
    try {
      await navigator.clipboard.writeText(text);
      setCopiedOps(true);
      setTimeout(() => setCopiedOps(false), 2000);
    } catch (e) {
      window.prompt(lang === 'zh' ? '复制下面的操作日志:' : 'Copy the operation log below:', text);
    }
  };

  const winnerColor = winner === 'good' ? '#22c55e' : winner === 'wolf' ? '#dc2626' : '#a855f7';
  const winnerEmoji = winner === 'good' ? '🌟' : winner === 'wolf' ? '🐺' : '🎭';
  const winnerBg = winner === 'good'
    ? 'linear-gradient(135deg, rgba(34,197,94,0.12), rgba(34,197,94,0.04))'
    : winner === 'wolf'
      ? 'linear-gradient(135deg, rgba(220,38,38,0.12), rgba(220,38,38,0.04))'
      : 'linear-gradient(135deg, rgba(168,85,247,0.12), rgba(168,85,247,0.04))';

  return (
    <div className="p-5 rounded-2xl text-center"
      style={{
        background: winnerBg,
        border: `2px solid ${winnerColor}`,
        boxShadow: `0 0 24px ${winnerColor}33`,
      }}>
      {/* 大号胜利 emoji */}
      <div className="text-7xl mb-2 animate-bounce inline-block">{winnerEmoji}</div>
      <h2 className="text-3xl font-black mb-1" style={{ color: winnerColor }}>{title}</h2>
      <div className="text-xs mb-4 px-4 py-1.5 rounded-full inline-block"
        style={{ background: 'var(--color-bg-deep)', color: 'var(--color-text-muted)' }}>
        {lang === 'zh' ? '胜利原因' : 'Reason'}: {reason}
      </div>

      {/* P12-D:角色分配用 grid 卡片展示,清晰列出每个人 + 阵营 */}
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 mb-4 text-left">
        {state.players.map(p => {
          const faction = ROLES[p.role].faction;
          const factionColor = faction === 'wolf' ? '#dc2626' : faction === 'good' ? '#22c55e' : '#a855f7';
          const factionBg = faction === 'wolf' ? 'rgba(220,38,38,0.15)' : faction === 'good' ? 'rgba(34,197,94,0.15)' : 'rgba(168,85,247,0.15)';
          const factionEmoji = faction === 'wolf' ? '🐺' : faction === 'good' ? '🛡️' : '🎭';
          return (
            <div key={p.id} className="rounded-lg p-2 text-[11px] flex flex-col gap-0.5"
              style={{ background: 'var(--color-bg-deep)', border: `1px solid ${factionColor}55` }}>
              <div className="flex items-center gap-1">
                <span className="text-base">{p.alive ? '🟢' : '💀'}</span>
                <span className="font-semibold truncate" style={{ color: 'var(--color-text)' }}>
                  {p.id + 1}.{p.name}{p.isUser ? ' ⭐' : ''}
                </span>
              </div>
              <div className="text-[10px] truncate" style={{ color: 'var(--color-text-muted)' }}>
                {ROLES[p.role].emoji} {ROLES[p.role].name[lang]}
              </div>
              <div className="text-[10px] inline-flex items-center gap-1 px-1.5 rounded w-fit" style={{ background: factionBg, color: factionColor }}>
                {factionEmoji} {faction === 'wolf' ? (lang === 'zh' ? '狼' : 'Wolf') : faction === 'good' ? (lang === 'zh' ? '好人' : 'Good') : (lang === 'zh' ? '第三方' : 'Third')}
              </div>
            </div>
          );
        })}
      </div>

      {/* P19:游戏总结报告 —— 每轮发生了什么 + 谁被放逐/技能带走 */}
      <SummaryReport state={state} lang={lang} />

      {/* 复制对话 + 重玩 / 换板子 */}
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button onClick={exportDialogue} variant="secondary" className="text-xs">
          {copied
            ? (lang === 'zh' ? '✓ 已复制' : '✓ Copied')
            : (lang === 'zh' ? '📋 复制对话日志' : '📋 Copy dialogue log')}
        </Button>
        <Button onClick={exportOperations} variant="secondary" className="text-xs">
          {copiedOps
            ? (lang === 'zh' ? '✓ 已复制' : '✓ Copied')
            : (lang === 'zh' ? '⚡ 复制操作日志' : '⚡ Copy operation log')}
        </Button>
        <Button onClick={onReplay}>{lang === 'zh' ? '🔁 重玩此板子' : '🔁 Replay board'}</Button>
        <Button onClick={onExit} variant="secondary">{lang === 'zh' ? '🔄 换板子' : '🔄 Change board'}</Button>
      </div>
    </div>
  );
}

/* P19:游戏总结报告 —— 直接在 GameOver 卡片里展示每轮关键事件
   内容:
   · 每轮(夜 + 白天):谁死了(夜间死亡 + 白天放逐 + 技能带走 + 自爆)
   · 关键操作:谁预言了谁、女巫救人/毒人、猎人带走、守卫守人
   · 放逐明细:投票 → 谁被票出去 */
/* P24:玩家档案 —— 点击头像后显示该玩家的完整发言 + 操作日志 */
function PlayerProfile({ state, playerId, lang, onClose }: {
  state: GameState; playerId: number; lang: 'zh' | 'en'; onClose: () => void;
}) {
  const L = (zh: string, en: string) => lang === 'zh' ? zh : en;
  const p = state.players[playerId];
  if (!p) return null;
  const role = ROLES[p.role];
  const factionColor = role.faction === 'wolf' ? '#dc2626' : role.faction === 'good' ? '#22c55e' : '#a855f7';
  const factionBg = role.faction === 'wolf' ? 'rgba(220,38,38,0.15)' : role.faction === 'good' ? 'rgba(34,197,94,0.15)' : 'rgba(168,85,247,0.15)';
  const factionLabel = role.faction === 'wolf' ? L('🐺 狼人', '🐺 Wolf') : role.faction === 'good' ? L('🛡️ 好人', '🛡️ Good') : L('🎭 第三方', '🎭 Third');
  // 该玩家所有发言(按 round 分组)
  const speeches = state.speeches.filter(sp => sp.playerId === playerId).sort((a, b) => a.day - b.day);
  const speechesByDay = new Map<number, typeof speeches>();
  for (const sp of speeches) {
    if (!speechesByDay.has(sp.day)) speechesByDay.set(sp.day, []);
    speechesByDay.get(sp.day)!.push(sp);
  }
  // 该玩家关键操作(从 publicLog 提取)
  const myActions: { day: number; text: string }[] = [];
  for (const e of state.publicLog) {
    const t = e.text;
    if (e.playerId === playerId) {
      // 自家死亡/被放逐/技能带走
      if (e.kind === 'death') myActions.push({ day: e.day, text: t });
    } else {
      // voteHistory/claim 涉及该玩家
      if (t.includes(`${playerId + 1}号`) || t.includes(`${playerId + 1}.`)) {
        if (e.kind === 'speech' || e.kind === 'death' || e.kind === 'system') {
          myActions.push({ day: e.day, text: `→ ${t.slice(0, 60)}${t.length > 60 ? '…' : ''}` });
        }
      }
    }
  }
  return (
    <div className="p-4 rounded-2xl" style={{ background: 'var(--color-card-bg)', border: `2px solid ${factionColor}` }}>
      {/* 头部:头像 + 角色 + 阵营 + 关闭按钮 */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="text-2xl">{p.alive ? role.emoji : '💀'}</div>
          <div>
            <div className="font-bold text-base" style={{ color: 'var(--color-text)' }}>
              {p.id + 1}. {p.name}{p.isUser ? ' ⭐' : ''}
            </div>
            <div className="text-[11px] flex items-center gap-1 mt-0.5">
              <span className="px-1.5 rounded" style={{ background: factionBg, color: factionColor }}>
                {role.emoji} {role.name[lang]}
              </span>
              <span style={{ color: 'var(--color-text-muted)' }}>{factionLabel}</span>
              {p.privateMemory?.isSheriff && <span style={{ color: '#facc15' }}>⭐ {L('警长', 'Sheriff')}</span>}
            </div>
          </div>
        </div>
        <button onClick={onClose}
          className="px-2 py-1 rounded text-xs hover:bg-black/20"
          style={{ background: 'var(--color-bg-deep)', color: 'var(--color-text-muted)' }}>
          ✕ {L('关闭', 'Close')}
        </button>
      </div>
      {/* 操作日志 */}
      <div className="mb-3">
        <div className="text-xs font-semibold mb-1" style={{ color: factionColor }}>
          ⚡ {L('操作记录', 'Actions')} ({myActions.length})
        </div>
        <div className="max-h-32 overflow-y-auto rounded p-1.5 text-[11px] space-y-0.5" style={{ background: 'var(--color-bg-deep)' }}>
          {myActions.length === 0 ? (
            <div style={{ color: 'var(--color-text-muted)' }}>—</div>
          ) : myActions.slice(0, 15).map((a, i) => (
            <div key={i} className="flex gap-1">
              <span style={{ color: 'var(--color-text-muted)', minWidth: 36, flexShrink: 0 }}>
                {L('第', 'Day ')}{a.day}{L('天', '')}
              </span>
              <span style={{ color: 'var(--color-text)' }} className="flex-1">{a.text}</span>
            </div>
          ))}
        </div>
      </div>
      {/* 发言历史(按天分组) */}
      <div>
        <div className="text-xs font-semibold mb-1" style={{ color: factionColor }}>
          🗣️ {L('发言历史', 'Speeches')} ({speeches.length} {L('条', 'total')})
        </div>
        <div className="max-h-72 overflow-y-auto rounded p-1.5 space-y-1" style={{ background: 'var(--color-bg-deep)' }}>
          {speeches.length === 0 ? (
            <div style={{ color: 'var(--color-text-muted)' }} className="text-[11px]">—</div>
          ) : Array.from(speechesByDay.entries()).sort((a, b) => a[0] - b[0]).map(([day, sps]) => (
            <div key={day}>
              <div className="text-[10px] font-bold mb-0.5" style={{ color: 'var(--color-text-muted)' }}>
                📅 {L('第', 'Day ')}{day}{L('天', '')}
              </div>
              {sps.map((sp, i) => (
                <div key={i} className="text-[11px] mb-1 px-1.5 py-1 rounded" style={{
                  background: sp.phase === 'last-words' ? 'rgba(107,114,128,0.15)' :
                              sp.phase === 'pk' ? 'rgba(249,115,22,0.1)' :
                              sp.phase === 'sheriff-speech' ? 'rgba(250,204,21,0.1)' :
                              'rgba(99,102,241,0.06)',
                  color: 'var(--color-text)',
                }}>
                  {sp.phase === 'last-words' ? '🕯️ ' : sp.phase === 'pk' ? '⚔️ ' : sp.phase === 'sheriff-speech' ? '⭐ ' : '💬 '}
                  {sp.text}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SummaryReport({ state, lang }: { state: GameState; lang: 'zh' | 'en' }) {
  const L = (zh: string, en: string) => lang === 'zh' ? zh : en;
  const roleName = (id: number) => `${ROLES[state.players[id].role].emoji} ${id + 1}.${state.players[id].name}(${ROLES[state.players[id].role].name[lang]})`;

  // 把 publicLog 按 round 分组
  const byRound = new Map<number, typeof state.publicLog>();
  for (const e of state.publicLog) {
    if (!byRound.has(e.day)) byRound.set(e.day, []);
    byRound.get(e.day)!.push(e);
  }

  // 提取关键事件
  type KeyEv = { day: number; text: string; tone: 'death' | 'exile' | 'ability' | 'system' | 'vote' };
  const events: KeyEv[] = [];
  for (const e of state.publicLog) {
    const t = e.text;
    if (/死亡|被放逐|出局|走了|被带走|被毒|被猎|撕警徽/.test(t)) {
      events.push({ day: e.day, text: t, tone: 'death' });
    } else if (/放逐|票出|被票/.test(t)) {
      events.push({ day: e.day, text: t, tone: 'exile' });
    } else if (/验了|查验|救了|毒了|守了|自爆|撕警徽|警徽/.test(t)) {
      events.push({ day: e.day, text: t, tone: 'ability' });
    } else if (/投票/.test(t)) {
      events.push({ day: e.day, text: t, tone: 'vote' });
    }
  }

  // 玩家操作摘要(谁做了什么关键操作)
  type PlayerOp = { id: number; ops: string[] };
  const playerOps: PlayerOp[] = [];
  for (const p of state.players) {
    // P23 防御:p.privateMemory 万一缺失用 defaultMemory 兜底(理论上 useMemo 已 sanitize)
    const pm = p.privateMemory ?? defaultMemory();
    const ops: string[] = [];
    // 预言家查验
    if (p.role === 'seer') {
      for (const c of (pm.seerChecks ?? [])) {
        const target = state.players[c.targetId];
        if (!target) continue;
        ops.push(L(
          `🔮 第${c.night}夜 查验 ${target.id + 1}.${target.name} → ${c.isWolf ? '🐺狼人' : '🛡️好人'}`,
          `🔮 Night ${c.night} checked ${target.id + 1}.${target.name} → ${c.isWolf ? 'wolf' : 'good'}`
        ));
      }
    }
    // 女巫
    if (p.role === 'witch') {
      if (pm.witchSavedId !== null && pm.witchSavedId !== undefined) {
        const t = state.players[pm.witchSavedId];
        if (t) ops.push(L(`💊 救了 ${t.id + 1}.${t.name}`, `💊 saved ${t.id + 1}.${t.name}`));
      }
      if (pm.witchPoisonedId !== null && pm.witchPoisonedId !== undefined) {
        const t = state.players[pm.witchPoisonedId];
        if (t) ops.push(L(`☠️ 毒了 ${t.id + 1}.${t.name}`, `☠️ poisoned ${t.id + 1}.${t.name}`));
      }
    }
    // 守卫
    if (p.role === 'guard' && pm.guardLastTargetId !== null) {
      const t = state.players[pm.guardLastTargetId];
      if (t) ops.push(L(`🛡️ 守了 ${t.id + 1}.${t.name}`, `🛡️ guarded ${t.id + 1}.${t.name}`));
    }
    if (ops.length > 0) playerOps.push({ id: p.id, ops });
  }

  return (
    <div className="text-left mt-3 mb-4">
      {/* 关键事件时间线 */}
      <details open className="mb-3">
        <summary className="cursor-pointer text-xs font-semibold mb-2 select-none"
          style={{ color: 'var(--color-accent)' }}>
          📜 {L('游戏事件时间线', 'Game Timeline')} ({events.length})
        </summary>
        <div className="rounded-lg p-2 text-[11px] space-y-1" style={{ background: 'var(--color-bg-deep)', border: '1px solid var(--color-border-light)' }}>
          {events.length === 0 ? (
            <div style={{ color: 'var(--color-text-muted)' }}>—</div>
          ) : events.map((ev, i) => {
            const color = ev.tone === 'death' ? '#dc2626' : ev.tone === 'exile' ? '#facc15' : ev.tone === 'ability' ? '#22c55e' : 'var(--color-text-muted)';
            const icon = ev.tone === 'death' ? '💀' : ev.tone === 'exile' ? '⚖️' : ev.tone === 'ability' ? '⚡' : ev.tone === 'vote' ? '🗳️' : '📢';
            return (
              <div key={i} className="flex gap-1.5 items-start">
                <span style={{ color: 'var(--color-text-muted)', minWidth: 30, flexShrink: 0 }}>
                  {L('第', 'Day ')}{ev.day}{L('天', '')}
                </span>
                <span style={{ color }}>{icon}</span>
                <span style={{ color: 'var(--color-text)' }} className="flex-1">{ev.text}</span>
              </div>
            );
          })}
        </div>
      </details>

      {/* 关键玩家操作 */}
      <details className="mb-3">
        <summary className="cursor-pointer text-xs font-semibold mb-2 select-none"
          style={{ color: 'var(--color-accent)' }}>
          ⚡ {L('关键玩家操作', 'Key Player Actions')} ({playerOps.length} {L('人', 'players')})
        </summary>
        <div className="rounded-lg p-2 text-[11px] space-y-2" style={{ background: 'var(--color-bg-deep)', border: '1px solid var(--color-border-light)' }}>
          {playerOps.length === 0 ? (
            <div style={{ color: 'var(--color-text-muted)' }}>—</div>
          ) : playerOps.map(po => (
            <div key={po.id}>
              <div className="font-semibold mb-0.5" style={{ color: 'var(--color-text)' }}>{roleName(po.id)}</div>
              <div className="pl-2 space-y-0.5" style={{ color: 'var(--color-text-muted)' }}>
                {po.ops.map((op, i) => <div key={i}>· {op}</div>)}
              </div>
            </div>
          ))}
        </div>
      </details>

      {/* 投票明细(每轮最后一次投票) */}
      {state.voteHistory && state.voteHistory.length > 0 && (
        <details>
          <summary className="cursor-pointer text-xs font-semibold mb-2 select-none"
            style={{ color: 'var(--color-accent)' }}>
            🗳️ {L('投票明细', 'Vote Details')} ({state.voteHistory.length} {L('轮', 'rounds')})
          </summary>
          <div className="rounded-lg p-2 text-[11px] space-y-2" style={{ background: 'var(--color-bg-deep)', border: '1px solid var(--color-border-light)' }}>
            {state.voteHistory.map((vh, i) => {
              const tally = vh.tally || {};
              const tallySorted = Object.entries(tally).sort((a, b) => (b[1] as number) - (a[1] as number));
              const topVotes = Math.max(1, ...Object.values(tally).map(v => v as number));
              return (
                <div key={i}>
                  <div className="font-semibold mb-0.5" style={{ color: 'var(--color-text)' }}>
                    {L('第', 'Day ')}{vh.round}{L('天投票', ' vote')}
                    {vh.exiled !== null && vh.exiled !== undefined && (
                      <span className="ml-2 px-1.5 rounded text-[10px]"
                        style={{ background: 'rgba(220,38,38,0.2)', color: '#dc2626' }}>
                        ⚖️ {L('放逐', 'exile')}: {state.players[vh.exiled] ? `${vh.exiled + 1}.${state.players[vh.exiled].name}` : '?'}
                      </span>
                    )}
                  </div>
                  <div className="pl-2 space-y-0.5" style={{ color: 'var(--color-text-muted)' }}>
                    {tallySorted.map(([tid, cnt]) => {
                      const isTop = (cnt as number) === topVotes;
                      return (
                        <div key={tid} className="flex items-center gap-1.5">
                          <span style={{ color: isTop ? '#dc2626' : 'var(--color-text-muted)', minWidth: 16 }}>
                            {isTop ? '🔴' : '⚪'}
                          </span>
                          <span>{state.players[parseInt(tid, 10)] ? `${parseInt(tid, 10) + 1}.${state.players[parseInt(tid, 10)].name}` : '?'}</span>
                          <span className="text-[10px]">→ {cnt} {L('票', 'v')}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </details>
      )}
    </div>
  );
}

function formatGameLog(state: GameState, lang: 'zh' | 'en'): string {
  const lines: string[] = [];
  const L = (zh: string, en: string) => lang === 'zh' ? zh : en;
  const roleName = (r: RoleId) => ROLES[r].name[lang];

  lines.push('═'.repeat(40));
  lines.push(`🐺 ${L('狼人杀游戏日志', 'Werewolf Game Log')}`);
  lines.push('═'.repeat(40));
  lines.push(`${L('板子', 'Board')}: ${BOARDS[state.boardId].name[lang]}`);
  lines.push(`${L('总轮数', 'Total rounds')}: ${state.round}`);
  lines.push(`${L('结果', 'Result')}: ${state.winner ? (state.winner === 'good' ? L('好人胜', 'Good wins') : state.winner === 'wolf' ? L('狼人胜', 'Wolves win') : L('第三方胜', 'Third wins')) : L('进行中', 'In progress')}`);
  lines.push('');

  // 角色表
  lines.push(`── ${L('角色分配', 'Role Assignment')} ──`);
  for (const p of state.players) {
    const role = roleName(p.role);
    const personality = p.personality;
    const faction = ROLES[p.role].faction;
    const factionStr = faction === 'wolf' ? '🐺' : faction === 'good' ? '🛡️' : '🎭';
    const isUser = p.isUser ? ` ${L('(你)', '(You)')}` : '';
    const isSheriff = p.privateMemory?.isSheriff ? ` ⭐${L('警长', 'Sheriff')}` : '';
    const alive = p.alive ? '🟢' : '💀';
    lines.push(`${alive} ${p.id + 1}. ${p.name} (${factionStr}${role}) [${personality}]${isSheriff}${isUser}`);
  }
  lines.push('');

  // 按轮次整理
  const eventsByRound = new Map<number, typeof state.publicLog>();
  for (const e of state.publicLog) {
    if (!eventsByRound.has(e.day)) eventsByRound.set(e.day, []);
    eventsByRound.get(e.day)!.push(e);
  }

  // 发言按玩家整理
  const speechesByPlayer = new Map<number, Array<{ day: number; text: string; phase?: string }>>();
  for (const sp of state.speeches) {
    if (!speechesByPlayer.has(sp.playerId)) speechesByPlayer.set(sp.playerId, []);
    speechesByPlayer.get(sp.playerId)!.push({ day: sp.day, text: sp.text, phase: sp.phase });
  }

  // 死亡记录
  const deathById = new Map<number, string>();
  for (const e of state.publicLog) {
    if (e.kind === 'death' && e.playerId !== undefined) {
      const cur = deathById.get(e.playerId) || '';
      deathById.set(e.playerId, cur + (cur ? '; ' : '') + e.text);
    }
  }

  // 查验记录
  const seerChecks: Array<{ playerId: number; targetId: number; isWolf: boolean; night: number }> = [];
  for (const p of state.players) {
    if (p.role === 'seer') {
      for (const c of (p.privateMemory?.seerChecks ?? [])) seerChecks.push({ playerId: p.id, ...c });
    }
  }

  // 守卫记录
  const guardHistory: Array<{ playerId: number; targetId: number | null; night: number }> = [];
  for (const p of state.players) {
    if (p.role === 'guard' && p.privateMemory?.guardLastTargetId !== null && p.privateMemory?.guardLastTargetId !== undefined) {
      guardHistory.push({ playerId: p.id, targetId: p.privateMemory.guardLastTargetId, night: state.round });
    }
  }

  // 女巫记录
  const witchHistory: Array<{ playerId: number; savedId: number | null; poisonedId: number | null }> = [];
  for (const p of state.players) {
    if (p.role === 'witch') {
      witchHistory.push({
        playerId: p.id,
        savedId: p.privateMemory?.witchSavedId ?? null,
        poisonedId: p.privateMemory?.witchPoisonedId ?? null,
      });
    }
  }

  // 投票记录 (lastVoteData)
  if (state.lastVoteData) {
    lines.push(`── ${L('最近一次投票', 'Last Vote')} ──`);
    for (const v of state.lastVoteData.allVotes) {
      lines.push(`  ${v.voterId + 1}.${state.players[v.voterId].name} → ${v.targetId + 1}.${state.players[v.targetId].name}`);
    }
    lines.push(`${L('票数', 'Tally')}: ${JSON.stringify(state.lastVoteData.tally)}`);
    if (state.lastVoteData.exiled !== null) {
      lines.push(`${L('放逐', 'Exiled')}: ${state.lastVoteData.exiled + 1}.${state.players[state.lastVoteData.exiled].name}`);
    }
    lines.push('');
  }

  // 查验
  if (seerChecks.length) {
    lines.push(`── ${L('预言家查验记录', 'Seer Check Log')} ──`);
    for (const c of seerChecks) {
      lines.push(`  ${L('第', 'Night ')}${c.night}${L('夜', '')}: ${c.playerId + 1}.${state.players[c.playerId].name} 查验 ${c.targetId + 1}.${state.players[c.targetId].name} → ${c.isWolf ? L('狼', 'wolf') : L('好人', 'good')}`);
    }
    lines.push('');
  }

  // 守卫
  if (guardHistory.length) {
    lines.push(`── ${L('守卫记录', 'Guard Log')} ──`);
    for (const g of guardHistory) {
      lines.push(`  ${g.playerId + 1}.${state.players[g.playerId].name} 守了 ${g.targetId !== null ? (g.targetId + 1) + '.' + state.players[g.targetId].name : L('(空守)', '(none)')}`);
    }
    lines.push('');
  }

  // 女巫
  if (witchHistory.length && (witchHistory[0].savedId !== null || witchHistory[0].poisonedId !== null)) {
    lines.push(`── ${L('女巫用药', 'Witch Potions')} ──`);
    for (const w of witchHistory) {
      if (w.savedId !== null) lines.push(`  ${w.playerId + 1}.${state.players[w.playerId].name} 解药救了 ${w.savedId + 1}.${state.players[w.savedId].name}`);
      if (w.poisonedId !== null) lines.push(`  ${w.playerId + 1}.${state.players[w.playerId].name} 毒药杀了 ${w.poisonedId + 1}.${state.players[w.poisonedId].name}`);
    }
    lines.push('');
  }

  // 警长
  if (state.sheriffElection) {
    const el = state.sheriffElection;
    lines.push(`── ${L('警长竞选', 'Sheriff Election')} ──`);
    lines.push(`  ${L('报名', 'Registered')}: ${el.registeredIds.map(id => `${id+1}.${state.players[id].name}`).join('、') || L('(无)', '(none)')}`);
    lines.push(`  ${L('退水', 'Withdrew')}: ${el.withdrawnIds.map(id => `${id+1}.${state.players[id].name}`).join('、') || L('(无)', '(none)')}`);
    lines.push('');
  }

  // 公开日志(按时间)
  lines.push(`── ${L('公开事件流(死亡/系统消息)', 'Public Event Log (deaths/system)')} ──`);
  for (const e of state.publicLog) {
    if (e.kind === 'death') {
      lines.push(`  💀 ${L('第', 'Day ')}${e.day}${L('天', '')}: ${e.text}`);
    } else if (e.kind === 'system') {
      lines.push(`  ⚖️ ${e.text}`);
    }
  }
  lines.push('');

  // 完整发言
  lines.push(`── ${L('完整发言记录', 'All Speeches')} ──`);
  for (let day = 1; day <= state.round; day++) {
    const daySpeeches = state.speeches.filter(s => s.day === day);
    if (daySpeeches.length === 0) continue;
    lines.push(`  ${L('--- 第', '--- Day ')}${day}${L('天 ---', ' ---')}`);
    for (const sp of daySpeeches) {
      const phase = sp.phase === 'night' ? L('夜', 'night')
                   : sp.phase === 'pk' ? 'PK'
                   : sp.phase === 'last-words' ? L('遗言', 'last-words')
                   : sp.phase === 'sheriff-speech' ? L('警长竞选', 'sheriff')
                   : L('白天', 'day');
      lines.push(`  [${phase}] ${sp.playerId + 1}.${state.players[sp.playerId].name}: ${sp.text}`);
    }
  }
  lines.push('');

  // 死亡总结
  lines.push(`── ${L('死亡总结', 'Death Summary')} ──`);
  for (const [id, txt] of deathById) {
    lines.push(`  ${id + 1}.${state.players[id].name} (${roleName(state.players[id].role)}): ${txt}`);
  }

  lines.push('');
  lines.push('═'.repeat(40));
  lines.push(L('【日志结束】', '【End of log】'));
  lines.push(`${L('导出时间', 'Exported at')}: ${new Date().toISOString()}`);
  lines.push(L('给 Claude:贴回这个对话 + 你认为有问题的部分', 'For Claude: paste this back + describe what looks wrong'));

  return lines.join('\n');
}

/* P24+:操作日志(不含对话) —— 给用户导出"纯操作流水"
   包含:夜间行动(谁查验/守/毒/杀)+ 投票放逐 + 警徽流转 + 死亡/技能记录
   不包含:玩家发言文本 */
function formatOpsLog(state: GameState, lang: 'zh' | 'en'): string {
  const L = (zh: string, en: string) => lang === 'zh' ? zh : en;
  const lines: string[] = [];
  lines.push('═'.repeat(40));
  lines.push(`⚡ ${L('狼人杀操作日志', 'Werewolf Operation Log')}`);
  lines.push('═'.repeat(40));
  lines.push(`${L('板子', 'Board')}: ${BOARDS[state.boardId].name[lang]}`);
  lines.push(`${L('总轮数', 'Total rounds')}: ${state.round}`);
  lines.push(`${L('结果', 'Result')}: ${state.winner ? (state.winner === 'good' ? L('好人胜', 'Good wins') : state.winner === 'wolf' ? L('狼人胜', 'Wolves win') : L('第三方胜', 'Third wins')) : L('进行中', 'In progress')}`);
  lines.push('');

  // 角色分配
  lines.push(`── ${L('角色分配', 'Role Assignment')} ──`);
  for (const p of state.players) {
    const role = ROLES[p.role];
    const faction = role.faction;
    const factionStr = faction === 'wolf' ? '🐺' : faction === 'good' ? '🛡️' : '🎭';
    const isUser = p.isUser ? ` ${L('(你)', '(You)')}` : '';
    const isSheriff = p.privateMemory?.isSheriff ? ` ⭐${L('警长', 'Sheriff')}` : '';
    const alive = p.alive ? '🟢' : '💀';
    lines.push(`${alive} ${p.id + 1}. ${p.name} (${factionStr}${role.name[lang]})${isSheriff}${isUser}`);
  }
  lines.push('');

  // 夜间行动(从 privateMemory 汇总)
  lines.push(`── ${L('夜间行动', 'Night Actions')} ──`);
  for (const p of state.players) {
    const mem = p.privateMemory;
    if (!mem) continue;
    if (p.role === 'seer' && mem.seerChecks?.length) {
      for (const c of mem.seerChecks) {
        const target = state.players[c.targetId];
        if (!target) continue;
        lines.push(`  🔮 ${L('第', 'Night ')}${c.night}${L('夜', '')}: ${p.id + 1}.${p.name} ${L('查验', 'checked')} ${target.id + 1}.${target.name} → ${c.isWolf ? L('🐺狼人', '🐺wolf') : L('🛡️好人', '🛡️good')}`);
      }
    }
    if (p.role === 'witch') {
      if (mem.witchSavedId !== null && mem.witchSavedId !== undefined) {
        const t = state.players[mem.witchSavedId];
        if (t) lines.push(`  💊 ${L('第', 'Night ')}${state.round}${L('夜', '')}: ${p.id + 1}.${p.name} ${L('解药救了', 'saved')} ${t.id + 1}.${t.name}`);
      }
      if (mem.witchPoisonedId !== null && mem.witchPoisonedId !== undefined) {
        const t = state.players[mem.witchPoisonedId];
        if (t) lines.push(`  ☠️ ${L('第', 'Night ')}${state.round}${L('夜', '')}: ${p.id + 1}.${p.name} ${L('毒药杀了', 'poisoned')} ${t.id + 1}.${t.name}`);
      }
    }
    if (p.role === 'guard' && mem.guardLastTargetId !== null && mem.guardLastTargetId !== undefined) {
      const t = state.players[mem.guardLastTargetId];
      if (t) lines.push(`  🛡️ ${L('守卫', 'Guard')}: ${p.id + 1}.${p.name} ${L('守了', 'guarded')} ${t.id + 1}.${t.name}`);
    }
    if (p.role === 'knight' && mem.knightUsed && mem.knightDuelTargetId !== null) {
      const t = state.players[mem.knightDuelTargetId];
      if (t) lines.push(`  ⚔️ ${L('骑士决斗', 'Knight duel')}: ${p.id + 1}.${p.name} ${L('挑战了', 'challenged')} ${t.id + 1}.${t.name}`);
    }
  }
  lines.push('');

  // 投票放逐(每轮最后一次投票)
  if (state.voteHistory && state.voteHistory.length > 0) {
    lines.push(`── ${L('投票放逐', 'Vote Exiles')} ──`);
    for (const vh of state.voteHistory) {
      if (vh.exiled === null) {
        lines.push(`  ${L('第', 'Day ')}${vh.round}${L('天: 平安日,无人被投出', ': peaceful day')}`);
        continue;
      }
      const ex = state.players[vh.exiled];
      const tallyStr = Object.entries(vh.tally).sort((a, b) => (b[1] as number) - (a[1] as number))
        .map(([tid, cnt]) => `${parseInt(tid, 10) + 1}.${state.players[parseInt(tid, 10)]?.name ?? '?'} ${cnt}${L('票', '')}`)
        .join(', ');
      lines.push(`  ${L('第', 'Day ')}${vh.round}${L('天: ', ': ')}${ex?.id !== undefined ? `${ex.id + 1}.${ex.name}` : '?'} ${L('被投出', 'exiled')} (${tallyStr})`);
    }
    lines.push('');
  }

  // 死亡/技能记录(从 publicLog 提取 death)
  lines.push(`── ${L('死亡记录', 'Death Records')} ──`);
  for (const e of state.publicLog) {
    if (e.kind === 'death') {
      lines.push(`  ${L('第', 'Day ')}${e.day}${L('天', '')}: ${e.text}`);
    }
  }
  lines.push('');

  // 警徽流转(从 publicLog 提取 system 涉及警徽/警长)
  lines.push(`── ${L('警徽流转', 'Sheriff Transfer')} ──`);
  for (const e of state.publicLog) {
    if (e.kind === 'system' && /警|⭐/.test(e.text)) {
      lines.push(`  ${L('第', 'Day ')}${e.day}${L('天', '')}: ${e.text}`);
    }
  }
  lines.push('');

  lines.push('═'.repeat(40));
  lines.push(`${L('导出时间', 'Exported at')}: ${new Date().toISOString()}`);

  return lines.join('\n');
}

/* ═══════════════════════════════════════════════════════════════════
   系统 Prompt 构建器(夜晚 + 白天讨论 + 投票)
   ═══════════════════════════════════════════════════════════════════ */

function buildNightPrompt(actor: Player, state: GameState, lang: 'zh' | 'en'): string {
  // P21 防御:actor 可能因 race condition 变 undefined(夜行中有人死了导致 player 列表不同步)
  if (!actor || !actor.privateMemory) {
    return lang === 'zh'
      ? `系统提示: 角色数据异常,请选择任意存活玩家作为目标。`
      : `System: role data missing, pick any alive player as target.`;
  }
  const role = ROLES[actor.role];
  const visible = actor.privateMemory;
  const alive = state.players.filter(x => x.alive).map(x => `${x.name}`).join('、');
  let contextExtra = '';
  if (actor.faction === 'wolf' && visible.wolfTeammates.length) {
    const mates = visible.wolfTeammates.map(id => `${state.players[id].name}`).join('、');
    contextExtra += lang === 'zh' ? `\n🐺 你的狼队友:${mates}` : `\n🐺 Wolf pack: ${mates}`;
  }
  const roleActions: Partial<Record<RoleId, { zh: string; en: string }>> = {
    werewolf: { zh: '今晚跟狼队友协商,选一个人杀', en: 'Coordinate with pack, choose one to kill' },
    wolfking: { zh: '你是狼王,今晚选一个人杀。被投票放逐时可带人', en: 'Wolf King: pick victim. Can take one when voted out' },
    wolfbeauty: { zh: '你是狼美人,今晚选一个人杀。被投票放逐时带最后投票人', en: 'Wolf Beauty: pick victim. Take last voter when voted out' },
    seer: { zh: '每晚查验一人是好人还是狼人', en: 'Check one player' },
    witch: { zh: '狼杀了 1 个人,你可以用解药救 / 毒药杀(或不用)', en: 'Wolf killed 1, can use antidote/poison' },
    hunter: { zh: '你是猎人,死亡时可开枪', en: 'Hunter: can shoot on death' },
    guard: { zh: '你是守卫,选一个人守护(不能连守同一人)', en: 'Guard: protect one (not same as last night)' },
    idiot: { zh: '你是白痴,被投时翻牌免死', en: 'Idiot: flip card when voted out' },
    knight: { zh: '你是骑士,白天可决斗一人', en: 'Knight: can duel one during day' },
    gargoyle: { zh: '你是石像鬼,查验一人是不是神职', en: 'Gargoyle: check if player is god role' },
    cupid: { zh: '你是丘比特,首夜连两人做情侣', en: 'Cupid: link two lovers on night 1' },
  };
  // 守卫特殊规则补充(标准规则):
  //  · 首夜可选择「空守」(不守任何人,target=0)
  //  · 但**不能连续两夜都空守** —— 若上一轮已空守,本轮必须守一个非自己的玩家
  if (actor.role === 'guard') {
    const lastTarget = visible.guardLastTargetId;
    const lastRoundSkipped = lastTarget === null;
    if (lang === 'zh') {
      if (lastRoundSkipped) {
        contextExtra += `\n🛡️ 你上一夜空守了,这一夜必须守一个非自己的玩家(不能连续两夜空守)`;
      } else {
        contextExtra += `\n🛡️ 你可以首夜空守(target=0),但要承担保护失败的风险`;
      }
    } else {
      contextExtra += lastRoundSkipped
        ? `\n🛡️ You skipped last night — must guard a non-self player this night`
        : `\n🛡️ You may skip (target=0) on first night, but risk losing protection`;
    }
  }
  // 女巫特殊规则补充(标准规则):
  //  · 首夜:如果被刀,大概率用解药救(可以空过让对方死)
  //  · 后续:大概率用毒药毒自己怀疑是狼的玩家;应在自己存活周期内把毒药/解药用掉
  if (actor.role === 'witch') {
    if (lang === 'zh') {
      const isFirstNight = state.round === 1;
      const wolfTarget = state.deadThisNight[0] ?? null;
      if (isFirstNight && wolfTarget !== null) {
        contextExtra += `\n💊 首夜 ${state.players[wolfTarget].name} 被刀,你可以救(大概率要救,活人比死人更有用) / 不救`;
      }
      if (!visible.witchAntidoteUsed || !visible.witchPoisonUsed) {
        contextExtra += `\n💊 你的解药${visible.witchAntidoteUsed ? '已用' : '可用'},毒药${visible.witchPoisonUsed ? '已用' : '可用'} —— 应该尽量在存活期间把两个药都用掉,不要浪费`;
      }
    } else {
      contextExtra += `\n💊 Antidote ${visible.witchAntidoteUsed ? 'used' : 'available'}, poison ${visible.witchPoisonUsed ? 'used' : 'available'} — use both during your survival`;
    }
  }
  return lang === 'zh'
    ? `你是"${actor.name}"(第${actor.id + 1}号),身份:${role.name.zh} ${role.emoji}\n存活玩家:${alive}${contextExtra}\n\n今晚任务:${roleActions[actor.role]?.zh ?? '执行你的角色技能'}\n\n输出 JSON:{"speech":"你的发言(30-100字)","target":目标座位号(1-based,守卫/无目标填 0)}`
    : `You are "${actor.name}" (#${actor.id + 1}), role: ${role.name.en} ${role.emoji}\nAlive: ${alive}${contextExtra}\n\nTonight: ${roleActions[actor.role]?.en ?? 'Execute your role ability'}\n\nOutput JSON: {"speech":"your speech (30-100 words)","target":target seat (1-based, 0 if none)}`;
}

function buildDayDiscussionPrompt(actor: Player, state: GameState, lang: 'zh' | 'en'): string {
  const role = ROLES[actor.role];
  const alive = state.players.filter(x => x.alive).map(x => `${x.name}`).join('、');
  const dead = state.deadThisNight.map(id => `${state.players[id].name}`).join('、');
  const isZh = lang === 'zh';

  // 今日是否已有人跳预言家 / 对跳预言家
  const seerClaimsThisRound = state.claims?.[state.round]?.seerClaims ?? [];
  const seerClaimed = seerClaimsThisRound.length > 0;
  // 当前发言者自己是否就是今日的跳预言家
  const actorIsClaimer = seerClaimsThisRound.some(c => c.playerId === actor.id);

  // 站边逻辑块(只要场上有人跳预言家,非跳预言家的所有人必须站边)
  const needStance = seerClaimed && !actorIsClaimer && actor.role !== 'seer';

  // P26+:性格注入 —— 让 LLM 按 personality 说话(不再机械八股)
  const personalityMap: Record<string, { zh: string; en: string; style: string }> = {
    strategist: { zh: '老谋深算', en: 'strategist', style: isZh ? '分析型 — 喜欢用逻辑链推演,引用别人的话拆解,说话冷静不冲动' : 'analytical — uses logic chains, quotes others and deconstructs, calm' },
    aggressive: { zh: '激进', en: 'aggressive', style: isZh ? '攻击型 — 直接指控,语气强硬,喜欢打断和施压' : 'aggressive — directly accuses, strong tone, pressures others' },
    mysterious: { zh: '神秘', en: 'mysterious', style: isZh ? '隐晦型 — 话少留白,用反问和暗示引导' : 'cryptic — short, leaves blanks, uses rhetorical questions' },
    loyal: { zh: '死忠', en: 'loyalist', style: isZh ? '从众型 — 跟主流意见,强调团结,不太独立思考' : 'follower — goes with majority, emphasizes unity, less independent' },
    backstab: { zh: '反水', en: 'backstabber', style: isZh ? '投机型 — 看风使舵,会根据形势翻脸' : 'opportunist — switches sides based on power dynamics' },
    cute: { zh: '萌新', en: 'newbie', style: isZh ? '新手型 — 不太确定,会问别人,有点天真' : 'newbie — uncertain, asks others, a bit naive' },
  };
  const persona = personalityMap[actor.personality] ?? personalityMap.strategist;
  const personalityLine = isZh
    ? `\n【你的性格】${persona.zh} — 说话风格:${persona.style}。你的发言要体现这个性格,不要变得跟别人一样。`
    : `\n【Your personality】${persona.en} — Style: ${persona.style}. Your speech must reflect this, don't blend with others.`;

  // ─────────────────────────────────────────────
  // 1) 角色专属"必须/禁止"块(放最顶部,让 LLM 先看)
  // P26:从机械八股改为对话引导 —— 像在跟玩家解释策略,而不是写八股文
  // ─────────────────────────────────────────────
  let roleBlock = '';
  let outputFormat = '';
  let suggestedTemp: number | undefined = undefined;

  if (actor.role === 'seer') {
    // P1-#22 修复(用户反馈:预言家不上警不报查验,都说套话):
    // 关键:seer 永远在 seer 块里,**不**依赖 seerChecks.length
    // 之前用 `actor.role === 'seer' && seerChecks.length` 当 gate,
    //   → seer 没 checks 时会 fall through 到村民块,prompt 撒谎说"你是村民"
    // P23:用 ?? [] 兜底,防止 seerChecks 是 undefined
    const seerChecksList = actor.privateMemory?.seerChecks ?? [];
    if (seerChecksList.length) {
      const checks = seerChecksList.map(c => `${c.targetId + 1}号 → ${c.isWolf ? '狼' : '好人'}`).join('、');
      roleBlock = isZh
        ? `【你的身份:预言家 🔮】\n你的查验结果(必须公开报给好人阵营):${checks}\n\n你是好人阵营的核心情报源。如果不报查验,好人无法利用你的信息,等于浪费预言家。`
        : `【Your role: Seer 🔮】\nYour checks (you MUST announce to the village): ${checks}\n\nYou are the village's main info source. Without announcing, your info is wasted.`;
    } else {
      roleBlock = isZh
        ? `【你的身份:预言家 🔮】\n你暂时还没查验(异常情况,首夜应该有 1 个查验)。\n仍然要明确报"我是预言家",引导好人阵营。`
        : `【Your role: Seer 🔮】\nNo checks yet (unusual). Still claim "I am the Seer" and lead the good team.`;
    }
    outputFormat = isZh
      ? `【发言引导 - 不是八股】\n\n作为预言家,你今天的发言要让好人阵营信任你、跟着你投。\n\n可以这样组织:\n- 开场直接亮身份"我是预言家"\n- 紧接着报你昨晚的查验(必须!)\n- 然后**回应**最近几条发言(谁在质疑你 / 谁在挺你 / 你的查验和谁的观点冲突)\n- 给出你的投票建议(投谁)\n\n【硬约束】\n- 必须报查验(具体到"X 号是狼/好人")\n- 不要 JSON 包装,直接口语\n- 如果上一条发言是你的队友/挺你的人,可以感谢;如果是质疑你的,必须反驳\n- 30-100 字,像微信群聊天`
      : `【Speech guidance - not robotic】\nAs Seer, you want villagers to trust and follow you.\n\nStructure your speech:\n- Open by claiming "I am the Seer"\n- Immediately announce your check\n- **Respond** to recent speeches (who questioned you, who backed you, how your check conflicts)\n- Recommend who to vote\n\nHard constraints:\n- MUST announce a check (specific "#X is wolf/good")\n- No JSON, plain speech\n- If someone backed you, thank them; if questioned, defend yourself\n- 30-100 words casual chat style`;
    suggestedTemp = 0.4;
  } else if (actor.faction === 'wolf' && (actor.privateMemory?.wolfTeammates ?? []).length) {
    // P0-#47 狼人悍跳策略(可选项)
    const mates = (actor.privateMemory?.wolfTeammates ?? []).map(id => `${state.players[id]?.name ?? '?'}`).join('、');
    const realSeerAlive = state.players.some(p => p.alive && p.role === 'seer');
    const counterClaimAlready = (state.claims?.[state.round]?.seerClaims ?? []).some(c => state.players[c.playerId]?.faction !== 'wolf');
    const shouldCounterClaim = realSeerAlive && !counterClaimAlready && Math.random() < 0.5;
    if (shouldCounterClaim) {
      // 狼悍跳预言家:必须按"预言家格式"输出
      roleBlock = isZh
        ? `【你的身份:狼人 🐺(悍跳预言家)】\n你的队友:${mates}。\n\n策略:假扮预言家,报"我验了 X 号,他是好人"(指队友保他)或"我验了 Y 号,他是狼"(咬你想投的人)。这会让好人分不清谁真谁假,你的队友被保,你的目标被放逐。`
        : `【Your role: Werewolf 🐺 (counter-claiming as Seer)】\nPack: ${mates}.\n\nStrategy: Pretend to be the seer. Claim "I checked #X, he is good" (protect a packmate) or "I checked #Y, he is wolf" (target your victim).`;
      outputFormat = isZh
        ? `【输出格式 - 必须遵守】\n你的发言必须严格按以下结构:\n第 1 句:"我是预言家"\n第 2 句(必含编造的查验):"昨晚我验了 X 号,他是 [狼/好人]"\n第 3 句起:30-80 字分析\n\n不要 JSON 包装。编的查验要具体到"几号是狼/好人",越具体越好。`
        : `【Output format - MUST follow】\nSentence 1: "I am the Seer"\nSentence 2 (MUST include a fabricated check): "I checked #X, he is [wolf/good]"\nThen 30-80 words analysis.`;
      suggestedTemp = 0.4;
    } else {
      roleBlock = isZh
        ? `【你的身份:狼人 🐺】\n你的队友:${mates}。\n\n要隐藏身份、转移视线。如果有人跳预言家(尤其是悍跳的),可以咬回去(说对方是悍跳狼)。\n注意:你今天**不应主动跳预言家**——已经有人跳了,你再跳是"对跳",会暴露。`
        : `【Your role: Werewolf 🐺】\nPack: ${mates}.\n\nHide, deflect. If someone claims seer, you can attack them. Do NOT claim seer yourself if someone already did—counter-counter-claims expose you.`;
      outputFormat = isZh
        ? `【输出格式】\n30-100 字口语发言(像微信群)。可以怀疑/拉票/站队,但不要直接报"我是预言家"除非你想悍跳。`
        : `【Output format】\n30-100 words casual speech. Suspect, lobby, take sides. Do NOT claim seer unless intentionally counter-claiming.`;
    }
  } else if (actor.role === 'witch') {
    const mem = actor.privateMemory;
    const info: string[] = [];
    if (mem.witchAntidoteUsed === false) info.push(isZh ? '解药还没用' : 'antidote unused');
    if (mem.witchPoisonedId !== null) info.push(isZh ? `已毒 ${state.players[mem.witchPoisonedId]?.name}` : `poisoned ${state.players[mem.witchPoisonedId]?.name}`);
    if (mem.witchSavedId !== null) info.push(isZh ? `已救 ${state.players[mem.witchSavedId]?.name}` : `saved ${state.players[mem.witchSavedId]?.name}`);
    roleBlock = isZh
      ? `【你的身份:女巫 💊】\n状态:${info.length ? info.join('、') : '解药毒药都还没用'}}\n\n策略(可选):\n- 报"昨晚我救了 X 号(没用毒)"证明自己是女巫,但会暴露给狼队\n- 报"我毒了 Y 号"反驳怀疑你的人\n- 也可以沉默保命`
      : `【Your role: Witch 💊】\nStatus: ${info.length ? info.join(', ') : 'both unused'}\n\nOptional strategies:\n- Claim "I saved X (no poison)" to prove yourself (but reveals to wolves)\n- Claim "I poisoned Y" to refute suspects\n- Stay silent to survive.`;
    // P9:女巫用了药必须公开身份 + 操作(不能藏)
    // 如果 lastWitchAction.byPlayerId === actor.id 且 !announced → 强制在发言里说
    const lastWitch = state.lastWitchAction;
    const mustAnnounce = lastWitch && lastWitch.byPlayerId === actor.id && !lastWitch.announced;
    if (mustAnnounce) {
      const announceZh = (lastWitch.savedId !== null ? `我昨晚解药救了 ${lastWitch.savedId + 1}号 ${state.players[lastWitch.savedId]?.name}` : '') +
        (lastWitch.savedId !== null && lastWitch.poisonedId !== null ? ',并且' : (lastWitch.poisonedId !== null ? '我' : '我')) +
        (lastWitch.poisonedId !== null ? `昨晚毒药杀了 ${lastWitch.poisonedId + 1}号 ${state.players[lastWitch.poisonedId]?.name}` : '');
      const announceEn = (lastWitch.savedId !== null ? `I used antidote to save #${lastWitch.savedId + 1} ${state.players[lastWitch.savedId]?.name}` : '') +
        (lastWitch.savedId !== null && lastWitch.poisonedId !== null ? ', and' : (lastWitch.poisonedId !== null ? 'I' : 'I')) +
        (lastWitch.poisonedId !== null ? `used poison to kill #${lastWitch.poisonedId + 1} ${state.players[lastWitch.poisonedId]?.name}` : '');
      outputFormat = isZh
        ? `【输出格式 - P9 强制】\n第 1 句必须是:"我是女巫,${announceZh}"\n第 2 句起:30-100 字分析(为什么救/毒)\n\n不要 JSON 包装。`
        : `【Output format - P9 MANDATORY】\nSentence 1 MUST be: "I am the Witch, ${announceEn}"\nSentence 2+: 30-100 words analysis.\n\nNo JSON wrapping.`;
      suggestedTemp = 0.3;
    } else {
      outputFormat = isZh
        ? `【输出格式】\n30-100 字口语发言。如果选择报身份,必须明确说"我是女巫"开头。`
        : `【Output format】\n30-100 words casual speech. If claiming, MUST start with "I am the Witch".`;
    }
  } else if (actor.role === 'guard') {
    const lastGuard = actor.privateMemory.guardLastTargetId;
    roleBlock = isZh
      ? `【你的身份:守卫 🛡️】\n上一夜守了:${lastGuard !== null ? state.players[lastGuard].name : '(空守)'}\n\n策略(可选):\n- 报"我守了 X"反驳预言家对 X 的怀疑(真话可挡刀)\n- 故意报错(谎报)可误导狼队,让他们明晚避开"以为安全"的人\n- 沉默保命也可以`
      : `【Your role: Guard 🛡️】\nLast guarded: ${lastGuard !== null ? state.players[lastGuard].name : '(none)'}\n\nOptional strategies:\n- Claim "I guarded X" to refute seer's suspicion of X (truth blocks the kill)\n- Lie to mislead wolves\n- Stay silent.`;
    outputFormat = isZh
      ? `【输出格式】\n30-100 字口语发言。如果选择报身份,必须明确说"我是守卫"开头。`
      : `【Output format】\n30-100 words. If claiming, MUST start with "I am the Guard".`;
  } else {
    // 普通村民 / 猎人 / 白痴 / 骑士 / 石像鬼 / 丘比特
    roleBlock = isZh
      ? `【你的身份:${role.name.zh} ${role.emoji}】\n阵营:${actor.faction === 'good' ? '好人' : actor.faction === 'wolf' ? '狼人' : '第三方'}。\n\n白天是发言+投票阶段。要主动站队/怀疑别人/分析局势。`
      : `【Your role: ${role.name.en} ${role.emoji}】\nFaction: ${actor.faction}. Speak and vote. Take sides, analyze.`;
    outputFormat = isZh
      ? `【输出格式】\n30-100 字口语发言(像微信群)。不要 JSON 包装。`
      : `【Output format】\n30-100 words casual chat. No JSON.`;
  }

  // ─────────────────────────────────────────────
  // 1.5) 站边块(有人跳预言家时,所有非跳预言家的玩家必须站边)
  // 排除:预言家本人(他在报查验)、悍跳的狼(它的"立场"是表演,真正目的是搅局)
  // 守卫/女巫等报身份的也算"已表态",如果他也跳了(claims 里有他),则不强制他再站
  // ─────────────────────────────────────────────
  let stanceBlock = '';
  if (needStance) {
    const claimerList = seerClaimsThisRound
      .map(c => {
        const p = state.players[c.playerId];
        const summary = c.checks.map(x => `${x.targetId + 1}号=${x.isWolf ? '狼' : '好人'}`).join('、');
        return `${c.playerId + 1}号 ${p?.name ?? '?'}(报:${summary})`;
      })
      .join('\n  ');
    const isWolfActor = actor.faction === 'wolf';
    if (isZh) {
      stanceBlock = isWolfActor
        ? `【站边 - 狼人策略】\n场上已有人跳预言家(可能是真预言家,可能是悍跳):\n  ${claimerList}\n\n你作为狼,需要演戏。建议:\n- 站一个跳预言家的(保护队友/混淆视听) → "我站 X 号,因为他报的查验有逻辑"\n- 反站另一个(把真预言家投出去) → "我反对 X 号,因为他跳得太晚 / 报的查验有矛盾"\n- 装糊涂(信息不足) → "现在信息太少,我暂不站边"\n\n但务必给出**符合好人逻辑**的理由(不能直接说"我是狼"),这样其他玩家才信你。\n`
        : `【站边 - 必填】\n场上已有人跳预言家,你必须明确表态(站边 / 反站 / 不站),并给出符合狼人杀逻辑的理由。\n\n今日跳预言家的人:\n  ${claimerList}\n\n可选立场:\n- 【站 X 号】:"我站 X 号(真预言家),因为..."\n  - 理由可以是:X 先跳(后跳的多半悍跳)/X 报的查验里 Y 昨晚确实死了(说明 X 没验错)/X 查的好人到现在都活着(悍跳保不了这么多人)/X 发言逻辑清晰没回避问题\n- 【反站 X 号 / 站 Y 号】:"我反 X 号(悍跳),我站 Y 号, 因为..."\n  - 理由可以是:X 跳得太晚(被投才跳是典型悍跳)/X 报的查验和已知死因冲突/X 查的全是好人(像在保队友)\n- 【不站边】:"目前 X 和 Y 都跳了,信息不足,我暂不站边,理由是..."\n  - 理由可以是:两边报的查验互相矛盾没法判断/要等今晚死的是谁才能定/要观察 X 和 Y 的投票行为\n\n【强制】\n- 必须在发言前 30 字内明确说出"我站 X"/"我反对 X"/"我暂不站边"之一\n- 理由必须**具体引用场上信息**(某个人的发言/某个查验/某个死因),不能空话\n- 不能直接说"因为感觉"\n- 如果你是狼,理由要**符合好人逻辑**,让其他玩家信你\n`;
    } else {
      stanceBlock = isWolfActor
        ? `【Stance - Wolf strategy】\nSeer(s) have claimed:\n  ${claimerList}\n\nAs a wolf, you must perform. Pick a stance and give a good-faction-logical reason (never reveal you're a wolf):\n- "I trust #X" / "I distrust #X" / "I abstain for now"\n`
        : `【Stance - MANDATORY】\nSeer(s) have claimed today. You MUST take a stance with a werewolf-logical reason:\n  ${claimerList}\n\nOptions:\n- "I trust #X" — give a specific reason (who claimed first, which check matches deaths, etc.)\n- "I distrust #X" — specific counter-evidence (claimed too late, checks conflict with deaths, etc.)\n- "I abstain" — explain what info is missing\n\nYour reason MUST cite specific game events (a player's speech, a check, a death), not vague feelings.`;
    }
  }

  // ─────────────────────────────────────────────
  // 2) 上下文块(之前发言摘要 + 今日声明)
  // ─────────────────────────────────────────────
  const contextParts: string[] = [];
  // 之前发言(今天 + 昨天) —— P4-#A:扩到 10 条,含 ID 前缀,便于 AI 引用
  // P27:同时显示自己之前发过的(避免重复)+ 其他活人的发言
  const todayStart = state.speeches.findIndex(s => s.day === state.round);
  const recentSpeeches = state.speeches.slice(Math.max(0, todayStart - 8), todayStart);
  const myPrevSpeeches = state.speeches.filter(sp => sp.playerId === actor.id);
  if (myPrevSpeeches.length > 0) {
    const myLines = myPrevSpeeches.slice(-3).map(sp =>
      `${sp.day}天: ${sp.text.slice(0, 100)}${sp.text.length > 100 ? '…' : ''}`
    ).join('\n');
    contextParts.push(isZh
      ? `【你(本玩家)之前说过的发言 - 严禁重复,要说新内容】\n${myLines}`
      : `【Your previous speeches - DO NOT repeat, say something NEW】\n${myLines}`);
  }
  if (recentSpeeches.length > 0) {
    const lines = recentSpeeches.slice(-10).map(sp => {
      const p = state.players[sp.playerId];
      if (!p || !p.alive) return null;
      return `${p.id + 1}号 ${p.name}: ${sp.text.slice(0, 80)}${sp.text.length > 80 ? '…' : ''}`;
    }).filter(Boolean);
    if (lines.length) {
      contextParts.push(isZh
        ? `【近期发言摘要(必看,发言时引用具体编号和观点)】\n${lines.join('\n')}`
        : `【Recent speeches (must reference specific IDs/arguments)】\n${lines.join('\n')}`);
    }
  }
  // 今日身份声明(本轮)
  const todayClaims = state.claims?.[state.round];
  if (todayClaims) {
    const claimLines: string[] = [];
    todayClaims.seerClaims.forEach(c => {
      const p = state.players[c.playerId];
      if (p?.alive) {
        claimLines.push(isZh
          ? `🔮 ${c.playerId + 1}号 ${p.name} 跳预言家:${c.checks.map(x => `${x.targetId + 1}号=${x.isWolf ? '狼' : '好人'}`).join('、')}`
          : `🔮 #${c.playerId + 1} ${p.name} claims seer: ${c.checks.map(x => `#${x.targetId + 1}=${x.isWolf ? 'wolf' : 'good'}`).join(', ')}`);
      }
    });
    todayClaims.witchClaims.forEach(c => {
      const p = state.players[c.playerId];
      if (p?.alive) {
        claimLines.push(isZh
          ? `💊 ${c.playerId + 1}号 ${p.name} 跳女巫:${c.savedId !== null ? `救了${c.savedId + 1}号 ` : ''}${c.poisonedId !== null ? `毒了${c.poisonedId + 1}号` : ''}`
          : `💊 #${c.playerId + 1} ${p.name} claims witch: ${c.savedId !== null ? `saved #${c.savedId + 1} ` : ''}${c.poisonedId !== null ? `poisoned #${c.poisonedId + 1}` : ''}`);
      }
    });
    todayClaims.guardClaims.forEach(c => {
      const p = state.players[c.playerId];
      if (p?.alive) {
        claimLines.push(isZh
          ? `🛡️ ${c.playerId + 1}号 ${p.name} 跳守卫:${c.guardedId !== null ? `守了${c.guardedId + 1}号` : '空守'}`
          : `🛡️ #${c.playerId + 1} ${p.name} claims guard: ${c.guardedId !== null ? `guarded #${c.guardedId + 1}` : 'no guard'}`);
      }
    });
    if (claimLines.length) {
      contextParts.push(isZh
        ? `【今日身份声明(已经有 X 人跳了预言家/女巫/守卫)】\n${claimLines.join('\n')}\n你可以质疑、相信、或者补充。`
        : `【Today's claims】\n${claimLines.join('\n')}`);
    }
  }

  const contextBlock = contextParts.length ? `\n${contextParts.join('\n\n')}\n` : '';

  // ─────────────────────────────────────────────
  // 2.5) P26:全局反八股约束(更自然)
  // ─────────────────────────────────────────────
  const commonRules = isZh
    ? `\n【发言要像真人,不像机器人】
- 不要复述别人刚说的话 —— 别人说过的内容你再说一遍就是废话
- 如果有"近期发言摘要",**必须**引用至少 1 条(用"X 号说..."或"X 号提的..."开头)
- 严禁"大家早上好 / 我觉得 / 咱们得团结"这种空话开头
- 严禁只重复别人说过的观点 —— 要么补充新信息,要么反驳,要么换个角度
- 不要解释规则,不要"作为预言家,我的看法是"这种套话,直接开口
- 不要 JSON 包装,30-100 字口语化(像微信群)
- 可以用语气词("嗯""啧""说实话")让你的发言更像人`
    : `\n【Speak like a real person, not a robot】
- Don't repeat what others just said — that wastes your turn
- If "recent speeches" is provided, MUST reference at least 1 (e.g. "X said...")
- NO generic openings: "good morning everyone", "I think", "we should unite"
- NO repeating others' points — either add new info, refute, or change angle
- Don't explain rules, don't say "as the seer, my view is" — just open your mouth
- No JSON, 30-100 words casual chat
- Use filler words like "well", "honestly" to feel more human`;

  // ─────────────────────────────────────────────
  // 3) 拼装
  // ─────────────────────────────────────────────
  return (isZh
    ? `${roleBlock}\n${outputFormat}${commonRules}${personalityLine}${contextBlock}${stanceBlock}\n【局势】\n昨晚死亡:${dead || '无(平安夜)'}\n存活玩家:${alive}\n现在是第 ${state.round} 轮白天讨论。`
    : `${roleBlock}\n${outputFormat}${commonRules}${personalityLine}${contextBlock}${stanceBlock}\n【Situation】\nLast night deaths: ${dead || 'none'}\nAlive: ${alive}\nRound ${state.round} day discussion.`)
    // 把 temperature hint 附在最后供调用方读取(解析时 grep TEMP_HINT)
    + `\n<!-- TEMP_HINT:${suggestedTemp ?? 0.9} -->`;
}

/** 解析 TEMP_HINT 注释,取出建议 temperature */
function extractTempHint(prompt: string): number {
  const m = prompt.match(/TEMP_HINT:([\d.]+)/);
  return m ? parseFloat(m[1]) : 0.9;
}

/** P27:发言相似度检测 —— 防止 AI 重复发言
   算法:把两段发言拆成字符集合(忽略标点和空格),计算 Jaccard 相似度
   返回 0-1,>0.7 视为重复 */
function speechSimilarity(a: string, b: string): number {
  const norm = (s: string) => s.replace(/[\s\p{P}]/gu, '').toLowerCase();
  const setA = new Set(norm(a));
  const setB = new Set(norm(b));
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersect = 0;
  for (const c of setA) if (setB.has(c)) intersect++;
  const union = setA.size + setB.size - intersect;
  return intersect / union;
}

/** P27:检查发言是否与最近 N 条重复 */
function isRepeatedSpeech(text: string, recentSpeeches: { text: string }[], threshold = 0.7): boolean {
  for (const sp of recentSpeeches.slice(-3)) {
    if (speechSimilarity(text, sp.text) >= threshold) return true;
  }
  return false;
}

function buildVotePrompt(actor: Player, state: GameState, lang: 'zh' | 'en'): string {
  const alive = state.players.filter(x => x.alive).filter(x => x.id !== actor.id).map(x => `${x.name}`).join('、');
  let extra = '';
  // P23:wolfTeammates 用可选链 + 兜底
  const wolfMates = actor.privateMemory?.wolfTeammates ?? [];
  if (actor.faction === 'wolf' && wolfMates.length) {
    const mates = wolfMates.map(id => `${state.players[id]?.name ?? '?'}`).join('、');
    extra = lang === 'zh' ? `\n🐺 你是狼,队友:${mates}。要保护队友,把票投给一个好人(最好是发言最像神职的)。` : `\n🐺 You're a wolf. Pack: ${mates}. Protect them, vote for a good player.`;
  }
  const seerChecksList = actor.privateMemory?.seerChecks ?? [];
  if (actor.role === 'seer' && seerChecksList.length) {
    const last = seerChecksList[seerChecksList.length - 1];
    extra = lang === 'zh' ? `\n🔮 你最近验的人:${last.targetId + 1}号 → ${last.isWolf ? '狼' : '好人'}。投票给狼。` : `\n🔮 Your last check: ${last.targetId + 1} → ${last.isWolf ? 'wolf' : 'good'}. Vote them.`;
  }
  return lang === 'zh'
    ? `你是"${actor.name}"(第${actor.id + 1}号),身份:${ROLES[actor.role].name.zh}\n存活玩家(除你):${alive}${extra}\n\n现在投票放逐,你选一个人。\n\n输出 JSON:{"target":投票给某人的座位号(1-based)}`
    : `You are "${actor.name}" (#${actor.id + 1}), role: ${ROLES[actor.role].name.en}\nAlive (excluding you): ${alive}${extra}\n\nVote to exile.\n\nOutput JSON: {"target":target seat (1-based)}`;
}

/* ═══════════════════════════════════════════════════════════════════
   狼人自爆 + 骑士决斗 + 警长指定继承人 已迁移到 engine.ts(见 imports)
   ═══════════════════════════════════════════════════════════════════ */
