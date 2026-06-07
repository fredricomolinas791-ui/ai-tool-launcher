/* ═══════════════════════════════════════════════════════════════════
   AI 狼人杀 —— 主 UI
   ─────────────────────────────────────────────────────────────
   Phase 2-A: 9 人预女猎白 + 12 人狼王守卫 完整跑通
             其他 3 个 12 人板点进去显示"敬请推出"
   ═══════════════════════════════════════════════════════════════════ */

import { useState, useEffect, useRef, type Dispatch, type SetStateAction } from 'react';
import { Drama, Sparkles, Sun, ChevronRight, Crown, AlertTriangle, Play, X, Skull, Shield, Users, Swords } from 'lucide-react';
import { Button } from '../../ui/Button';
import { useI18n } from '../../../hooks/useI18n';
import {
  BOARDS, BOARD_LIST, ROLES, type BoardId, type GameState, type Player, type RoleId,
  initGame, loadAIConfig, callAIStream, checkWinner, parseAIDecision, applyLoversChain,
} from './engine';
import type { BoardDef } from './data';
import { PersonalityRender } from './Personalities';

/* ── 所有 6 个板子都可玩 ── */
const PLAYABLE_BOARDS: BoardId[] = [
  'p9-classic', 'p12-classic', 'p12-wolfking',
  'p12-wolfbeauty', 'p12-gargoyle', 'p12-cupid',
];

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

function PlayerSeat({ player, isYou, isSpeaking, revealed }: {
  player: Player; isYou: boolean; isSpeaking?: boolean; revealed?: boolean;
}) {
  const role = ROLES[player.role];
  const showReal = !player.alive || isYou || revealed;
  const display = !player.alive ? '💀' : showReal ? role.emoji : '👤';
  return (
    <div className="relative flex flex-col items-center" style={{ width: 72 }}>
      <div
        className="w-14 h-14 rounded-full flex items-center justify-center text-2xl border-2 transition-all"
        style={{
          background: player.alive ? (isSpeaking ? 'var(--color-accent-glow)' : 'var(--color-card-bg)') : 'var(--color-bg-deep)',
          borderColor: isYou ? 'var(--color-accent)' : isSpeaking ? 'var(--color-accent)' : 'var(--color-border-light)',
          opacity: player.alive ? 1 : 0.4,
          boxShadow: isSpeaking ? '0 0 0 4px var(--color-accent-glow)' : 'none',
        }}
      >{display}</div>
      <div className="mt-1 text-[10px] font-medium truncate w-full text-center" style={{ color: player.alive ? 'var(--color-text)' : 'var(--color-text-muted)' }}>
        {player.id + 1}. {player.name}
      </div>
      {isYou && <div className="text-[9px] mt-0.5" style={{ color: 'var(--color-accent)' }}>你</div>}
      {showReal && player.alive && !isYou && (
        <div className="text-[9px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{role.name.zh}</div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   发言气泡
   ═══════════════════════════════════════════════════════════════════ */

function SpeechBubble({ player, text, streaming, lang, isRevealed }: {
  player: Player; text: string; streaming?: boolean; lang: 'zh' | 'en'; isRevealed?: boolean;
}) {
  return (
    <div className="flex gap-2 mb-2 animate-fade-in">
      <div className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-base"
        style={{ background: 'var(--color-accent-glow)' }}>
        {isRevealed ? ROLES[player.role].emoji : '👤'}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[11px] mb-0.5 flex items-center gap-1.5" style={{ color: 'var(--color-text-muted)' }}>
          <span className="font-medium" style={{ color: 'var(--color-text)' }}>{player.id + 1}. {player.name}</span>
          {isRevealed && <span style={{ color: 'var(--color-accent)' }}>{ROLES[player.role].name.zh}</span>}
          <PersonalityRender id={player.personality} lang={lang} />
        </div>
        <div className="rounded-lg p-2 text-sm" style={{
          background: 'var(--color-card-bg)', color: 'var(--color-text)',
          border: '1px solid var(--color-border-light)',
        }}>
          {text || (streaming ? <span style={{ color: 'var(--color-text-muted)' }}>...</span> : '')}
          {streaming && <span className="inline-block ml-1 animate-pulse">▍</span>}
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
  /* 初始化时优先从 sessionStorage 恢复(避免关闭弹窗后状态全丢) */
  const [state, setState] = useState<GameState | null>(() => {
    try {
      const raw = sessionStorage.getItem(WEREWOLF_SAVE_KEY);
      if (raw) {
        const s = JSON.parse(raw) as GameState;
        // 简单健全性检查
        if (s && s.boardId && Array.isArray(s.players) && s.players.length >= 5) return s;
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

  /* 同步 state 到 sessionStorage —— 关闭弹窗后重开可恢复 */
  useEffect(() => {
    try {
      if (state) {
        sessionStorage.setItem(WEREWOLF_SAVE_KEY, JSON.stringify(state));
        if (phase === 'playing') setPhase('playing'); // 触发 select/playing 切回
      } else {
        sessionStorage.removeItem(WEREWOLF_SAVE_KEY);
      }
    } catch { /* quota / 隐私模式 ignore */ }
  }, [state]);

  // 如果有恢复的 state,直接进入 playing
  useEffect(() => {
    if (state && phase === 'select') setPhase('playing');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  if (phase === 'select' || !state) {
    return <BoardSelect lang={lang} noKey={noKey}
      onStart={(boardId) => {
        const g = initGame(boardId, lang === 'zh' ? '你' : 'You', lang);
        setState(g);
        setPhase('playing');
      }} />;
  }
  if (noKey || !aiConfig) return <NoKeyWarn lang={lang} />;
  return <GameRunner
    state={state}
    setState={setState}
    aiConfig={aiConfig}
    lang={lang}
    onExit={() => { setState(null); setPhase('select'); sessionStorage.removeItem(WEREWOLF_SAVE_KEY); }} />;
}

function BoardSelect({ lang, noKey, onStart }: {
  lang: 'zh' | 'en'; noKey: boolean; onStart: (boardId: BoardId) => void;
}) {
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
      <div className="space-y-2">
        <h3 className="text-sm font-medium flex items-center gap-1.5" style={{ color: 'var(--color-text)' }}>
          <Sparkles size={14} style={{ color: 'var(--color-accent)' }} />{lang === 'zh' ? '选择板子' : 'Pick a board'}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {BOARD_LIST.map(b => {
            const isPlayable = PLAYABLE_BOARDS.includes(b.id);
            return (
              <BoardCard key={b.id} board={b} lang={lang}
                disabled={!isPlayable || noKey}
                disabledReason={!isPlayable
                  ? (lang === 'zh' ? '该板子即将推出,先玩 9 人经典 / 12 人狼王守卫' : 'Coming soon — try 9P classic / 12P wolf king')
                  : undefined}
                onSelect={() => onStart(b.id)} />
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
   游戏运行器 —— 完整循环
   ═══════════════════════════════════════════════════════════════════ */

function GameRunner({ state: initial, setState: setStateProp, aiConfig, lang, onExit }: {
  state: GameState;
  setState: Dispatch<SetStateAction<GameState | null>>;
  aiConfig: NonNullable<ReturnType<typeof loadAIConfig>>;
  lang: 'zh' | 'en'; onExit: () => void;
}) {
  // 内部 state 仅用于派生 UI(比如 streamingText),游戏 state 走 prop
  const [streamingText, setStreamingText] = useState<{ playerId: number; text: string } | null>(null);
  /* setState wrapper:把 (s:GameState) => GameState 形式适配到 prop 的 Dispatch<SetStateAction<GameState|null>>
     —— 子组件里都假设 state 非 null,这里用 prev ? u(prev) : prev 兜底(理论上 prop 永远非 null) */
  const setState = (u: (s: GameState) => GameState) =>
    setStateProp((prev) => (prev ? u(prev) : prev));
  const state = initial;

  const alivePlayers = state.players.filter(p => p.alive);
  const winner = checkWinner(state);

  useEffect(() => {
    if (winner) setState(s => ({ ...s, phase: 'gameover' }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [winner]);

  /* aiSpeak 返回 {speech, target} —— 让调用方(夜晚行动/投票)能直接拿到 target,
     避免「读 state.speeches[length-1]」的闭包过时问题。
     target 是 1-based 座位号(0 表示无目标),由 parseAIDecision 从 AI 输出中解析。 */
  const aiSpeak = async (playerId: number, systemPrompt: string, userPrompt: string): Promise<{ speech: string; target: number | null }> => {
    let full = '';
    setStreamingText({ playerId, text: '' });
    const h = callAIStream(aiConfig, systemPrompt, userPrompt, (chunk: string) => {
      full += chunk;
      setStreamingText({ playerId, text: full });
    });
    const text = await h.promise;
    setStreamingText(null);
    const parsed = parseAIDecision(text);
    const speech = (parsed.speech || text || '').trim();
    // 直接同步写进 state(不读闭包)
    setState(s => ({
      ...s,
      speeches: [...s.speeches, { playerId, day: s.round, text: speech }],
      publicLog: [...s.publicLog, { kind: 'speech', day: s.round, playerId, text: speech }],
    }));
    // 解析 target:0-based,无目标=0 转为 null
    let target: number | null = null;
    if (parsed.decision !== undefined) {
      const t1 = parsed.decision + 1; // 0-based → 1-based
      if (t1 >= 1 && t1 <= initial.players.length) target = t1 - 1;
    }
    return { speech, target };
  };

  // 座位分栏:9 人 → 左 6 / 右 3;12 人 → 左 6 / 右 6
  const leftIds = state.players.slice(0, Math.ceil(state.players.length / 2));
  const rightIds = state.players.slice(Math.ceil(state.players.length / 2));

  return (
    <div className="space-y-3">
      {/* 顶部信息条 */}
      <div className="flex items-center justify-between p-3 rounded-xl"
        style={{ background: 'var(--color-card-bg)', border: '1px solid var(--color-border-light)' }}>
        <div className="flex items-center gap-2">
          <Drama size={18} style={{ color: 'var(--color-accent)' }} />
          <div>
            <div className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
              {BOARDS[state.boardId].name[lang]} · {lang === 'zh' ? '第' : 'R'}{state.round}{lang === 'zh' ? '轮' : ''}
            </div>
            <div className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
              {lang === 'zh' ? '存活' : 'Alive'} {alivePlayers.length}/{state.players.length} ·{' '}
              {ROLES[state.players[state.userId].role].name[lang]} ·{' '}
              {ROLES[state.players[state.userId].role].emoji}
            </div>
          </div>
        </div>
        <button onClick={onExit} className="p-1.5 rounded-lg" style={{ background: 'var(--color-bg-deep)' }}>
          <X size={14} style={{ color: 'var(--color-text-muted)' }} />
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
                {leftIds.map(p => {
                  const userP = state.players[state.userId];
                  const seerCheckedIds = userP.privateMemory.seerChecks.map(c => c.targetId);
                  const revealed = p.id === state.userId || !p.alive || seerCheckedIds.includes(p.id);
                  return (
                    <PlayerSeat key={p.id} player={p}
                      isYou={p.id === state.userId}
                      isSpeaking={streamingText?.playerId === p.id}
                      revealed={revealed} />
                  );
                })}
              </div>
              {/* 右列 */}
              <div className="flex flex-col gap-1.5">
                {rightIds.map(p => {
                  const userP = state.players[state.userId];
                  const seerCheckedIds = userP.privateMemory.seerChecks.map(c => c.targetId);
                  const revealed = p.id === state.userId || !p.alive || seerCheckedIds.includes(p.id);
                  return (
                    <PlayerSeat key={p.id} player={p}
                      isYou={p.id === state.userId}
                      isSpeaking={streamingText?.playerId === p.id}
                      revealed={revealed} />
                  );
                })}
              </div>
            </div>
          </div>
          {/* 当前阶段 UI */}
          {state.phase === 'role-reveal' && <RoleRevealPanel state={state} lang={lang} onContinue={() => setState(s => ({ ...s, phase: 'night', round: s.round + 1 }))} />}
          {state.phase === 'night' && <NightPanel state={state} setState={setState} lang={lang} aiSpeak={aiSpeak} />}
          {state.phase === 'day-announce' && <DayAnnounce state={state} setState={setState} lang={lang} />}
          {state.phase === 'day-discuss' && <DayDiscuss state={state} setState={setState} lang={lang} aiSpeak={aiSpeak} />}
          {state.phase === 'day-vote' && <DayVote state={state} setState={setState} lang={lang} aiSpeak={aiSpeak} />}
          {state.phase === 'hunter-shoot' && <HunterShoot state={state} setState={setState} lang={lang} />}
        </div>

        {/* 右侧:信息流(发言 + 法官 + 死亡 + 投票,可滚动) */}
        <InfoStream state={state} lang={lang} streamingText={streamingText} />
      </div>

      {state.phase === 'gameover' && winner && <GameOver state={state} winner={winner} lang={lang} onExit={onExit} />}
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
  // 自动滚到底
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [state.publicLog.length, state.speeches.length, streamingText]);

  const userP = state.players[state.userId];
  const seerCheckedIds = userP.privateMemory.seerChecks.map(c => c.targetId);

  // 死亡记录
  const deaths = state.publicLog.filter(e => e.kind === 'death');
  // 法官字幕(系统消息)
  const systemEvents = state.publicLog.filter(e => e.kind === 'system');
  // 投票放逐记录
  const exiles = state.publicLog.filter(e => e.kind === 'death' && e.text.startsWith('🗳️'));

  return (
    <div ref={ref} className="p-3 rounded-xl space-y-3 overflow-y-auto"
      style={{
        background: 'var(--color-card-bg)', border: '1px solid var(--color-border-light)',
        maxHeight: 'calc(100vh - 200px)', minHeight: 400,
      }}>
      {/* 法官字幕(系统事件) */}
      {systemEvents.length > 0 && (
        <div>
          <div className="text-[10px] mb-1.5 flex items-center gap-1 font-semibold" style={{ color: 'var(--color-accent)' }}>
            ⚖️ {lang === 'zh' ? '法官信息' : 'Judge'}
          </div>
          {systemEvents.slice(-8).map((e, i) => (
            <div key={i} className="text-[11px] py-1 px-2 rounded mb-1"
              style={{ background: 'var(--color-bg-deep)', color: 'var(--color-text-muted)' }}>
              {e.text}
            </div>
          ))}
        </div>
      )}

      {/* 死亡记录 */}
      {deaths.length > 0 && (
        <div>
          <div className="text-[10px] mb-1.5 flex items-center gap-1 font-semibold" style={{ color: '#dc2626' }}>
            💀 {lang === 'zh' ? '死亡记录' : 'Deaths'}
          </div>
          {deaths.slice(-8).map((e, i) => (
            <div key={i} className="text-[11px] py-1 px-2 rounded mb-1 flex items-center gap-1.5"
              style={{ background: 'rgba(220,38,38,0.08)', color: 'var(--color-text)' }}>
              {e.text}
            </div>
          ))}
        </div>
      )}

      {/* 投票放逐 */}
      {exiles.length > 0 && (
        <div>
          <div className="text-[10px] mb-1.5 flex items-center gap-1 font-semibold" style={{ color: '#a855f7' }}>
            🗳️ {lang === 'zh' ? '投票放逐' : 'Exile'}
          </div>
          {exiles.slice(-5).map((e, i) => (
            <div key={i} className="text-[11px] py-1 px-2 rounded mb-1"
              style={{ background: 'rgba(168,85,247,0.08)', color: 'var(--color-text)' }}>
              {e.text}
            </div>
          ))}
        </div>
      )}

      {/* 发言流 */}
      <div>
        <div className="text-[10px] mb-1.5 flex items-center gap-1 font-semibold" style={{ color: 'var(--color-text-muted)' }}>
          🗣️ {lang === 'zh' ? '发言' : 'Speeches'} ({state.speeches.length})
        </div>
        {state.speeches.slice(-15).map((sp, i) => {
          const p = state.players[sp.playerId];
          const isRevealed = sp.playerId === state.userId || !p.alive || seerCheckedIds.includes(sp.playerId);
          return <SpeechBubble key={i} player={p} text={sp.text} lang={lang} isRevealed={isRevealed} />;
        })}
        {streamingText && (
          <SpeechBubble player={state.players[streamingText.playerId]} text={streamingText.text}
            streaming lang={lang} isRevealed />
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   角色公布
   ═══════════════════════════════════════════════════════════════════ */

function RoleRevealPanel({ state, lang, onContinue }: { state: GameState; lang: 'zh' | 'en'; onContinue: () => void }) {
  const userP = state.players[state.userId];
  const role = ROLES[userP.role];
  // 狼人/狼王/狼美人/石像鬼 队友可见
  let extra = '';
  if (userP.faction === 'wolf' && userP.privateMemory.wolfTeammates.length) {
    const mates = userP.privateMemory.wolfTeammates.map(id => `${id + 1}号 ${state.players[id].name}`).join('、');
    extra = lang === 'zh' ? `\n🐺 你的狼队友:${mates}` : `\n🐺 Your wolf pack: ${mates}`;
  }
  return (
    <div className="p-6 rounded-xl text-center" style={{ background: 'var(--color-card-bg)', border: '1px solid var(--color-accent)' }}>
      <div className="text-5xl mb-2">{role.emoji}</div>
      <h3 className="text-xl font-bold whitespace-pre-line" style={{ color: 'var(--color-text)' }}>
        {lang === 'zh' ? '你的身份是' : 'Your role is'}: {role.name[lang]}{extra}
      </h3>
      <p className="text-sm mt-2" style={{ color: 'var(--color-text-muted)' }}>{role.shortDesc[lang]}</p>
      <p className="text-xs mt-2 px-4" style={{ color: 'var(--color-text-muted)' }}>{role.skillHint[lang]}</p>
      <Button onClick={onContinue} className="mt-4">
        <Play size={14} className="mr-1.5" />{lang === 'zh' ? '进入夜晚' : 'Enter Night'}
      </Button>
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
const NIGHT_ACTION_TIMEOUT = 35;

function NightPanel({ state, setState, lang, aiSpeak }: {
  state: GameState; setState: (updater: (s: GameState) => GameState) => void;
  lang: 'zh' | 'en';
  aiSpeak: (playerId: number, system: string, user: string) => Promise<{ speech: string; target: number | null }>;
}) {
  // 行动队列(用 useState,render 时能拿到)
  const [actions, setActions] = useState<{ role: RoleId; playerId: number }[]>([]);
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

  // 当 round 变化时,初始化行动队列
  useEffect(() => {
    const aliveRoles = state.players.filter(p => p.alive && ROLES[p.role].hasNightAction);
    const sorted = aliveRoles
      .map(p => ({ role: p.role, playerId: p.id }))
      .sort((a, b) => ROLES[a.role].nightOrder - ROLES[b.role].nightOrder);
    setActions(sorted);
    setActionIdx(0);
    setScene('intro');
    setTimeLeft(NIGHT_INTRO_SEC);
  }, [state.round]);

  const cur = actions[actionIdx];

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
      if (cur.playerId === state.userId) {
        // 用户行动:不调 AI,等用户点;超时强制 null
        setBusy(false);
        startCountdown(NIGHT_ACTION_TIMEOUT, () => {
          if (cancelled) return;
          setState(s => applyNightAction(s, cur.role, cur.playerId, null, lang));
          setScene('outro');
        });
      } else {
        // AI 行动:异步跑 runAIAction + 同步倒计时(超时强制 null 兜底)
        const actor = state.players[cur.playerId];
        startCountdown(NIGHT_ACTION_TIMEOUT, () => {
          if (aiDoneRef.current) return;
          aiDoneRef.current = true;
          if (cancelled) return;
          setState(s => applyNightAction(s, cur.role, cur.playerId, null, lang));
          setBusy(false);
          setScene('outro');
        });
        runAIAction(actor, stateRef.current, lang, aiSpeakRef.current).then((target) => {
          if (cancelled || aiDoneRef.current) return;
          aiDoneRef.current = true;
          if (target !== null) {
            setState(s => applyNightAction(s, cur.role, cur.playerId, target, lang));
          }
          setBusy(false);
          setScene('outro');
        });
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
  function onUserAction(target: number | null) {
    if (!cur) return;
    setState(s => applyNightAction(s, cur.role, cur.playerId, target, lang));
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
      {cur && scene === 'action' && (
        <div className="mt-3 text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
          {lang === 'zh' ? '当前行动:' : 'Acting now:'} {ROLES[cur.role].emoji} {ROLES[cur.role].name[lang]}
        </div>
      )}
    </div>
  );
}

/* ── 夜晚分幕具体显示 ── */
function NightSceneDisplay({ scene, cur, state, lang, timeLeft, onUserAction, busy }: {
  scene: 'intro' | 'action' | 'outro';
  cur: { role: RoleId; playerId: number };
  state: GameState; lang: 'zh' | 'en';
  timeLeft: number;
  onUserAction: (t: number | null) => void;
  busy: boolean;
}) {
  const role = ROLES[cur.role];
  const isMe = cur.playerId === state.userId;
  const actorName = state.players[cur.playerId].name;

  // 字幕
  if (scene === 'intro') {
    return (
      <div>
        <div className="text-5xl mb-3 animate-pulse">{role.emoji}</div>
        <div className="text-2xl font-bold mb-2" style={{ color: 'var(--color-accent)' }}>
          {lang === 'zh' ? `${role.name.zh}请睁眼` : `${role.name.en}, wake up`}
        </div>
        <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          {lang === 'zh' ? `${(timeLeft).toFixed(1)}s 后开始行动` : `Action starts in ${timeLeft.toFixed(1)}s`}
        </div>
      </div>
    );
  }
  if (scene === 'outro') {
    return (
      <div>
        <div className="text-5xl mb-3">😴</div>
        <div className="text-2xl font-bold mb-2" style={{ color: 'var(--color-text)' }}>
          {lang === 'zh' ? `${role.name.zh}请闭眼` : `${role.name.en}, close your eyes`}
        </div>
        <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          {lang === 'zh' ? `下一位…` : 'Next…'}
        </div>
      </div>
    );
  }
  // action
  return (
    <div>
      <div className="text-4xl mb-2">{role.emoji}</div>
      <div className="text-sm mb-1" style={{ color: 'var(--color-text)' }}>
        {isMe
          ? (lang === 'zh' ? '轮到你了' : 'Your turn')
          : (lang === 'zh' ? `AI ${actorName} 正在行动` : `AI ${actorName} acting`)}
      </div>
      <div className="text-[10px] mb-3" style={{ color: timeLeft < 10 ? '#dc2626' : 'var(--color-text-muted)' }}>
        ⏱ {timeLeft.toFixed(1)}s {lang === 'zh' ? '后超时自动跳过' : 'timeout auto-skip'}
      </div>
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
  onConfirm: (target: number | null) => void;
}) {
  const userP = state.players[state.userId];
  const aliveOthers = state.players.filter(p => p.alive && p.id !== state.userId);
  const [selected, setSelected] = useState<number | null>(null);

  // 守卫:不能连守同一人
  if (role === 'guard') {
    const lastTarget = userP.privateMemory.guardLastTargetId;
    return (
      <div>
        <p className="text-xs mb-2" style={{ color: 'var(--color-text-muted)' }}>
          {lang === 'zh' ? '请选择今晚要守护的人:' : 'Choose who to guard:'}
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
        <div className="text-center mt-3">
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
    // 简单化:系统告诉女巫"今晚狼人想杀的人是 X 号"
    // (实际:从 state.deadThisNight 找,现在还没结算,假定为第一个非狼的随机)
    return (
      <div>
        <p className="text-xs mb-2" style={{ color: 'var(--color-text-muted)' }}>
          {lang === 'zh' ? '今晚狼人想杀 1 个好人(系统已随机选好)。你可以:' : 'Wolves killed one player. You can:'}
        </p>
        <div className="space-y-1.5">
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={useAntidote} disabled={mem.witchAntidoteUsed}
              onChange={e => setUseAntidote(e.target.checked)} />
            💊 {lang === 'zh' ? '使用解药' : 'Use antidote'} {mem.witchAntidoteUsed ? '(已用)' : '(unused)'}
          </label>
          <div>
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={poisonTarget !== null} disabled={mem.witchPoisonUsed}
                onChange={e => setPoisonTarget(e.target.checked ? (aliveOthers[0]?.id ?? null) : null)} />
              ☠️ {lang === 'zh' ? '使用毒药(选一个人杀)' : 'Use poison (kill someone)'} {mem.witchPoisonUsed ? '(已用)' : '(unused)'}
            </label>
            {poisonTarget !== null && (
              <div className="flex flex-wrap gap-1 mt-1 ml-5">
                {aliveOthers.map(p => (
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
          <Button onClick={() => onConfirm(poisonTarget)}>
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

  // 丘比特:首夜连 2 个人做情侣
  if (role === 'cupid') {
    return (
      <div>
        <p className="text-xs mb-2" style={{ color: 'var(--color-text-muted)' }}>
          {lang === 'zh' ? '💘 选第 1 个情侣(另一个系统随机):' : 'Cupid: pick lover #1 (lover #2 random):'}
        </p>
        <div className="flex flex-wrap gap-1.5 justify-center">
          {aliveOthers.map(p => (
            <button key={p.id} onClick={() => setSelected(p.id)}
              className="px-2 py-1 rounded text-xs"
              style={{
                background: selected === p.id ? '#ec4899' : 'var(--color-card-bg)',
                color: selected === p.id ? '#fff' : 'var(--color-text)',
              }}>{p.id + 1}.{p.name}</button>
          ))}
        </div>
        <div className="text-center mt-3">
          <Button onClick={() => onConfirm(selected)} disabled={selected === null}>
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
   —— 直接用 aiSpeak 返回的 target,不走 state.speeches 闭包(避免读旧 state) */
async function runAIAction(
  actor: Player, state: GameState, lang: 'zh' | 'en',
  aiSpeak: (id: number, sys: string, usr: string) => Promise<{ speech: string; target: number | null }>,
): Promise<number | null> {
  const sys = buildNightPrompt(actor, state, lang);
  const usr = lang === 'zh'
    ? '请用 JSON 格式输出:{"speech":"你的发言(可选)","target":你的目标座位号(1-based,无目标填 0)}'
    : 'Output JSON: {"speech":"your speech (optional)","target":target seat (1-based, 0 if none)}';
  const { target } = await aiSpeak(actor.id, sys, usr);
  // target 已经是 0-based(null 表示无目标)
  if (target !== null && target >= 0 && target < state.players.length && state.players[target].alive) {
    return target;
  }
  return null;
}

/* 应用一个夜晚行动到 GameState */
function applyNightAction(s: GameState, role: RoleId, actorId: number, target: number | null, _lang: 'zh' | 'en'): GameState {
  const players = s.players;
  switch (role) {
    case 'werewolf':
    case 'wolfking':
    case 'wolfbeauty': {
      if (target === null) return s;
      // 记录狼队决定的杀(暂存到 publicLog,等结算用)
      return {
        ...s,
        publicLog: [...s.publicLog, { kind: 'system', day: s.round, text: `🐺 狼队选择目标:${target + 1}号` }],
        players: players.map(p => p.id === actorId
          ? { ...p, privateMemory: { ...p.privateMemory, /* wolf vote 共用 */ } }
          : p),
        // 暂存到 deadThisNight 第一个
        deadThisNight: [target, ...s.deadThisNight.filter(id => id !== target)],
      };
    }
    case 'seer': {
      if (target === null) return s;
      const isWolf = players[target].faction === 'wolf';
      return {
        ...s,
        players: players.map((p, i) => i === actorId
          ? { ...p, privateMemory: { ...p.privateMemory, seerChecks: [...p.privateMemory.seerChecks, { targetId: target, isWolf }] } }
          : p),
      };
    }
    case 'witch': {
      if (target === null) {
        // 仅用解药
        return {
          ...s,
          players: players.map((p, i) => i === actorId
            ? { ...p, privateMemory: { ...p.privateMemory, witchAntidoteUsed: true, witchSavedId: s.deadThisNight[0] ?? null } }
            : p),
        };
      }
      return {
        ...s,
        players: players.map((p, i) => i === actorId
          ? { ...p, privateMemory: { ...p.privateMemory, witchPoisonUsed: true, witchPoisonedId: target } }
          : p),
        deadThisNight: [...s.deadThisNight, target],
      };
    }
    case 'guard': {
      if (target === null) return s;
      return {
        ...s,
        players: players.map((p, i) => i === actorId
          ? { ...p, privateMemory: { ...p.privateMemory, guardLastTargetId: target, guardHistory: [...p.privateMemory.guardHistory, target] } }
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
          ? { ...p, privateMemory: { ...p.privateMemory, gargoyleChecks: [...p.privateMemory.gargoyleChecks, { targetId: target, isGod }] } }
          : p),
        publicLog: [...s.publicLog, { kind: 'system', day: s.round, text: `🗿 石像鬼查验了 ${target + 1}号 (${isGod ? '神职' : '非神职'})` }],
      };
    }
    case 'cupid': {
      // 丘比特首夜连 2 个人(我们把 target 当作第 1 个,默认连自己随机另一个)
      // 简化:用 target 字段存"第一个人",第二人随机
      if (target === null) return s;
      const aliveOthers = s.players.filter(p => p.alive && p.id !== actorId && p.id !== target);
      const secondId = aliveOthers.length > 0 ? aliveOthers[Math.floor(Math.random() * aliveOthers.length)].id : null;
      if (secondId === null) return s;
      return {
        ...s,
        players: players.map((p, i) => {
          if (i === actorId) return { ...p, privateMemory: { ...p.privateMemory, cupidLinkedIds: [target, secondId] } };
          if (i === target || i === secondId) return { ...p, privateMemory: { ...p.privateMemory, cupidLinkedIds: [target, secondId] } };
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

/* 夜晚结算:应用狼人选择 + 守卫保护 + 猎人发动? + 公布死亡 */
function resolveNight(s: GameState, _lang: 'zh' | 'en'): GameState {
  const dead = new Set<number>(s.deadThisNight);
  // 应用守卫保护:如果 deadThisNight[0] 是守卫守的人,从 dead 中移除
  const guard = s.players.find(p => p.alive && p.role === 'guard');
  if (guard) {
    const guarded = guard.privateMemory.guardLastTargetId;
    if (guarded !== null && dead.has(guarded)) {
      dead.delete(guarded);
      // 女巫的解药也被消耗?简化:假定女巫没用解药
    }
  }
  // 应用死亡
  const newPlayers = s.players.map(p => dead.has(p.id) ? { ...p, alive: false } : p);
  // 简化:这里不立即触发猎人,放到 day-announce 后再处理
  const newState = {
    ...s,
    players: newPlayers,
    deadThisNight: Array.from(dead),
    publicLog: [...s.publicLog, ...Array.from(dead).map(id => ({
      kind: 'death' as const, day: s.round, playerId: id,
      text: `${id + 1}号 ${s.players[id].name} 在夜里倒下了`,
    }))],
    phase: 'day-announce' as const,
  };
  return newState;
}

/* ═══════════════════════════════════════════════════════════════════
   白天:死亡公布 / 讨论 / 投票
   ═══════════════════════════════════════════════════════════════════ */

function DayAnnounce({ state, setState, lang }: { state: GameState; setState: (u: (s: GameState) => GameState) => void; lang: 'zh' | 'en' }) {
  const dead = state.deadThisNight;
  // 检测猎人
  const hunterDead = dead.find(id => state.players[id].role === 'hunter');
  useEffect(() => {
    if (hunterDead !== undefined) {
      setState(s => ({ ...s, phase: 'hunter-shoot', lastVotedOut: hunterDead }));
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
              💀 <b>{id + 1}. {state.players[id].name}</b> 倒下了
              <span style={{ color: 'var(--color-accent)' }}>({ROLES[state.players[id].role].name[lang]})</span>
            </p>
          ))}
        </div>
      )}
      <p className="text-xs mt-2" style={{ color: 'var(--color-text-muted)' }}>{lang === 'zh' ? '正在进入白天讨论…' : 'Entering day discussion…'}</p>
    </div>
  );
}

function HunterShoot({ state, setState, lang }: {
  state: GameState; setState: (u: (s: GameState) => GameState) => void;
  lang: 'zh' | 'en';
}) {
  const hunterId = state.lastVotedOut;
  if (hunterId === null) {
    useEffect(() => { setState(s => ({ ...s, phase: 'day-discuss' })); }, []);
    return null;
  }
  const hunter = state.players[hunterId];
  const isUser = hunterId === state.userId;
  const aliveOthers = state.players.filter(p => p.alive && p.id !== hunterId);
  const [target, setTarget] = useState<number | null>(null);

  const confirm = () => {
    if (target === null) {
      setState(s => ({ ...s, phase: 'day-discuss' }));
      return;
    }
    setState(s => ({
      ...s,
      players: s.players.map(p => p.id === target ? { ...p, alive: false } : p),
      publicLog: [...s.publicLog, { kind: 'death', day: s.round, playerId: target, text: `🏹 猎人开枪带走了 ${target + 1}号 ${s.players[target].name}` }],
      deadThisNight: s.deadThisNight.includes(target) ? s.deadThisNight : [...s.deadThisNight, target],
      lastVotedOut: null,
      phase: 'day-discuss',
    }));
  };

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
            <Button onClick={() => { setTarget(null); confirm(); }}>
              {lang === 'zh' ? '不开枪' : 'Skip'}
            </Button>
            <Button onClick={confirm} disabled={target === null}>
              {lang === 'zh' ? '开枪!' : 'Shoot!'}
            </Button>
          </div>
        </>
      ) : (
        <div className="text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>
          {lang === 'zh' ? '(AI 猎人自动选择,简化版:跳过)' : '(auto-skip in simplified version)'}
        </div>
      )}
    </div>
  );
}

function DayDiscuss({ state, setState, lang, aiSpeak }: {
  state: GameState; setState: (u: (s: GameState) => GameState) => void;
  lang: 'zh' | 'en';
  aiSpeak: (id: number, sys: string, usr: string) => Promise<{ speech: string; target: number | null }>;
}) {
  const [discussIdx, setDiscussIdx] = useState(0);
  const [busy, setBusy] = useState(false);

  const alivePlayers = state.players.filter(p => p.alive);
  const speakers = alivePlayers; // 简化:每个存活玩家都发言 1 次

  const nextSpeaker = () => {
    if (discussIdx >= speakers.length) {
      setState(s => ({ ...s, phase: 'day-vote' }));
      return;
    }
    const cur = speakers[discussIdx];
    if (cur.id === state.userId) {
      // 跳过用户发言
      setDiscussIdx(i => i + 1);
      return;
    }
    setBusy(true);
    const sys = buildDayDiscussionPrompt(cur, state, lang);
    const usr = lang === 'zh'
      ? '请发言(30-100 字,口语化,像微信群聊天),带节奏、跟队友呼应'
      : 'Speak in 30-100 words, casual chat style, drive the discussion';
    aiSpeak(cur.id, sys, usr).then(() => {
      setBusy(false);
      setDiscussIdx(i => i + 1);
    });
  };

  useEffect(() => { if (discussIdx === 0 && !busy) nextSpeaker(); /* eslint-disable-next-line */ }, [discussIdx]);

  const cur = speakers[discussIdx];

  return (
    <div className="p-4 rounded-xl" style={{ background: 'var(--color-card-bg)', border: '1px solid var(--color-border-light)' }}>
      <div className="flex items-center gap-2 mb-2">
        <Users size={18} style={{ color: 'var(--color-accent)' }} />
        <h3 className="font-semibold" style={{ color: 'var(--color-text)' }}>
          {lang === 'zh' ? `白天讨论(${discussIdx + 1}/${speakers.length})` : `Day discussion (${discussIdx + 1}/${speakers.length})`}
        </h3>
      </div>
      {busy ? (
        <div className="text-center text-sm py-3" style={{ color: 'var(--color-text-muted)' }}>
          {lang === 'zh' ? `AI ${cur.name} 正在发言…` : `AI ${cur.name} speaking…`}
        </div>
      ) : (
        <div className="text-center">
          <Button onClick={nextSpeaker}>
            {discussIdx >= speakers.length - 1
              ? (lang === 'zh' ? '进入投票' : 'Vote')
              : (lang === 'zh' ? '下一位' : 'Next')} <ChevronRight size={14} className="ml-1" />
          </Button>
        </div>
      )}
    </div>
  );
}

function DayVote({ state, setState, lang, aiSpeak }: {
  state: GameState; setState: (u: (s: GameState) => GameState) => void;
  lang: 'zh' | 'en';
  aiSpeak: (id: number, sys: string, usr: string) => Promise<{ speech: string; target: number | null }>;
}) {
  const alivePlayers = state.players.filter(p => p.alive);
  const [userTarget, setUserTarget] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [aiVotes, setAiVotes] = useState<Record<number, number>>({});

  // 跑 AI 投票
  const runVotes = async () => {
    setBusy(true);
    const votes: Record<number, number> = {};
    for (const p of alivePlayers) {
      if (p.id === state.userId) continue;
      const sys = buildVotePrompt(p, state, lang);
      const usr = lang === 'zh'
        ? '用 JSON 格式输出:{"target":投票给某人的座位号(1-based)}'
        : 'Output JSON: {"target":target seat (1-based)}';
      // 直接用 aiSpeak 返回的 target,不走 state.speeches 闭包
      const { target } = await aiSpeak(p.id, sys, usr);
      if (target !== null && target >= 0 && target < state.players.length && state.players[target].alive && target !== p.id) {
        votes[p.id] = target;
      } else {
        // fallback:随机投一个非自己
        const others = alivePlayers.filter(x => x.id !== p.id);
        votes[p.id] = others[Math.floor(Math.random() * others.length)].id;
      }
    }
    setAiVotes(votes);
    setBusy(false);
  };

  // 汇总投票 → 放逐
  const finalize = () => {
    // 收集所有投票(用于狼美人殉情)
    const allVotes: { voterId: number; targetId: number }[] = [];
    Object.entries(aiVotes).forEach(([voterId, targetId]) => {
      const tid = targetId as number;
      if (tid === null || tid < 0) return;
      allVotes.push({ voterId: parseInt(voterId, 10), targetId: tid });
    });
    if (userTarget !== null && userTarget >= 0) {
      allVotes.push({ voterId: state.userId, targetId: userTarget });
    }
    // 票数最多的被投
    const tally: Record<number, number> = {};
    allVotes.forEach(v => { tally[v.targetId] = (tally[v.targetId] || 0) + 1; });
    let maxVotes = 0, exiled: number | null = null;
    Object.entries(tally).forEach(([id, count]) => {
      if (count > maxVotes) { maxVotes = count; exiled = parseInt(id, 10); }
    });
    if (exiled === null) {
      setState(s => ({ ...s, phase: 'night', round: s.round + 1 }));
      return;
    }
    setState(s => {
      let newState: GameState = {
        ...s,
        players: s.players.map(p => p.id === exiled ? { ...p, alive: false } : p),
        publicLog: [...s.publicLog, { kind: 'death', day: s.round, playerId: exiled!, text: `🗳️ 投票放逐:${exiled! + 1}号 ${s.players[exiled!].name} (${ROLES[s.players[exiled!].role].name[lang]})` }],
        deadThisDay: exiled,
        lastVotedOut: exiled,
        phase: 'night',
      };
      // 狼美人殉情:被投人是 wolfbeauty → 找最后投 ta 的人 → 也死
      if (s.players[exiled!].role === 'wolfbeauty') {
        const lastVoter = [...allVotes].reverse().find(v => v.targetId === exiled!);
        if (lastVoter) {
          newState = {
            ...newState,
            players: newState.players.map(p => p.id === lastVoter.voterId ? { ...p, alive: false } : p),
            publicLog: [...newState.publicLog, { kind: 'death', day: s.round, playerId: lastVoter.voterId, text: `💋 狼美人殉情:带走了 ${lastVoter.voterId + 1}号 ${s.players[lastVoter.voterId].name}` }],
          };
          // 触发情侣殉情链
          const { state: afterLovers } = applyLoversChain(newState, [exiled!, lastVoter.voterId]);
          newState = afterLovers;
        }
      }
      // 狼王带人(简化版:随机带一个,后续可让用户选)
      if (s.players[exiled!].role === 'wolfking') {
        const aliveAfter = newState.players.filter(p => p.alive);
        if (aliveAfter.length > 0) {
          const victim = aliveAfter[Math.floor(Math.random() * aliveAfter.length)].id;
          newState = {
            ...newState,
            players: newState.players.map(p => p.id === victim ? { ...p, alive: false } : p),
            publicLog: [...newState.publicLog, { kind: 'death', day: s.round, playerId: victim, text: `👑 狼王被投,带走 ${victim + 1}号 ${s.players[victim].name}` }],
          };
          const { state: afterLovers2 } = applyLoversChain(newState, [exiled!, victim]);
          newState = afterLovers2;
        }
      }
      // 情侣殉情(如果被投人是情侣)
      if (s.players[exiled!].role !== 'wolfbeauty' && s.players[exiled!].role !== 'wolfking') {
        const { state: afterLovers3 } = applyLoversChain(newState, [exiled!]);
        newState = afterLovers3;
      }
      return newState;
    });
  };

  useEffect(() => { if (Object.keys(aiVotes).length === 0) runVotes(); /* eslint-disable-next-line */ }, []);

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
            <Button onClick={() => { setUserTarget(null); finalize(); }} disabled={userTarget === null}>
              {lang === 'zh' ? '弃票' : 'Abstain'}
            </Button>
            <Button onClick={finalize} disabled={userTarget === null}>
              {lang === 'zh' ? '确认投票' : 'Confirm'}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   胜负画面
   ═══════════════════════════════════════════════════════════════════ */

function GameOver({ state, winner, lang, onExit }: {
  state: GameState; winner: 'wolf' | 'good' | 'third'; lang: 'zh' | 'en'; onExit: () => void;
}) {
  const title = winner === 'good'
    ? (lang === 'zh' ? '🌟 好人胜利!' : '🌟 Good wins!')
    : winner === 'wolf'
      ? (lang === 'zh' ? '🐺 狼人胜利!' : '🐺 Wolves win!')
      : (lang === 'zh' ? '🎭 第三方胜利!' : '🎭 Third party wins!');
  return (
    <div className="p-6 rounded-xl text-center" style={{
      background: 'var(--color-card-bg)',
      border: `2px solid ${winner === 'good' ? '#22c55e' : winner === 'wolf' ? '#dc2626' : '#a855f7'}`,
    }}>
      <Crown size={48} className="mx-auto mb-2" style={{ color: winner === 'good' ? '#22c55e' : winner === 'wolf' ? '#dc2626' : '#a855f7' }} />
      <h2 className="text-2xl font-bold mb-3" style={{ color: 'var(--color-text)' }}>{title}</h2>
      <div className="text-xs space-y-1 mb-4 text-left max-w-md mx-auto" style={{ color: 'var(--color-text-muted)' }}>
        {state.players.map(p => (
          <div key={p.id} className="flex items-center gap-2">
            <span>{p.alive ? '🟢' : '💀'}</span>
            <span>{p.id + 1}. {p.name}</span>
            <span className="ml-auto" style={{ color: ROLES[p.role].faction === 'wolf' ? '#dc2626' : ROLES[p.role].faction === 'good' ? '#22c55e' : '#a855f7' }}>
              {ROLES[p.role].name[lang]}
            </span>
          </div>
        ))}
      </div>
      <Button onClick={onExit}>{lang === 'zh' ? '再来一局' : 'Play again'}</Button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   系统 Prompt 构建器(夜晚 + 白天讨论 + 投票)
   ═══════════════════════════════════════════════════════════════════ */

function buildNightPrompt(actor: Player, state: GameState, lang: 'zh' | 'en'): string {
  const role = ROLES[actor.role];
  const visible = actor.privateMemory;
  const alive = state.players.filter(x => x.alive).map(x => `${x.id + 1}号 ${x.name}`).join('、');
  let contextExtra = '';
  if (actor.faction === 'wolf' && visible.wolfTeammates.length) {
    const mates = visible.wolfTeammates.map(id => `${id + 1}号 ${state.players[id].name}`).join('、');
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
  return lang === 'zh'
    ? `你是"${actor.name}"(第${actor.id + 1}号),身份:${role.name.zh} ${role.emoji}\n存活玩家:${alive}${contextExtra}\n\n今晚任务:${roleActions[actor.role]?.zh ?? '执行你的角色技能'}\n\n输出 JSON:{"speech":"你的发言(30-100字)","target":目标座位号(1-based,守卫/无目标填 0)}`
    : `You are "${actor.name}" (#${actor.id + 1}), role: ${role.name.en} ${role.emoji}\nAlive: ${alive}${contextExtra}\n\nTonight: ${roleActions[actor.role]?.en ?? 'Execute your role ability'}\n\nOutput JSON: {"speech":"your speech (30-100 words)","target":target seat (1-based, 0 if none)}`;
}

function buildDayDiscussionPrompt(actor: Player, state: GameState, lang: 'zh' | 'en'): string {
  const role = ROLES[actor.role];
  const alive = state.players.filter(x => x.alive).map(x => `${x.id + 1}号 ${x.name}`).join('、');
  const dead = state.deadThisNight.map(id => `${id + 1}号 ${state.players[id].name}`).join('、');
  let extra = '';
  if (actor.faction === 'wolf' && actor.privateMemory.wolfTeammates.length) {
    const mates = actor.privateMemory.wolfTeammates.map(id => `${id + 1}号 ${state.players[id].name}`).join('、');
    extra = lang === 'zh' ? `\n🐺 你是狼,你的队友:${mates}。要隐藏身份、转移视线。` : `\n🐺 You're a wolf. Pack: ${mates}. Hide and deflect.`;
  }
  if (actor.role === 'seer' && actor.privateMemory.seerChecks.length) {
    const checks = actor.privateMemory.seerChecks.map(c => `${c.targetId + 1}号 → ${c.isWolf ? '狼' : '好人'}`).join('、');
    extra = lang === 'zh' ? `\n🔮 你的查验结果:${checks}` : `\n🔮 Your checks: ${checks}`;
  }
  return lang === 'zh'
    ? `你是"${actor.name}"(第${actor.id + 1}号),身份:${role.name.zh}\n昨晚死亡:${dead || '无(平安夜)'}\n存活玩家:${alive}${extra}\n\n现在白天讨论,所有人轮流发言。你有 30-100 字,用微信群聊天的口吻。要主动站队 / 怀疑别人。\n\n只输出你的发言,不要 JSON 包装。`
    : `You are "${actor.name}" (#${actor.id + 1}), role: ${role.name.en}\nLast night deaths: ${dead || 'none'}\nAlive: ${alive}${extra}\n\nDay discussion. Speak 30-100 words, casual chat. Take sides, accuse others.\n\nOutput speech only (no JSON).`;
}

function buildVotePrompt(actor: Player, state: GameState, lang: 'zh' | 'en'): string {
  const alive = state.players.filter(x => x.alive).filter(x => x.id !== actor.id).map(x => `${x.id + 1}号 ${x.name}`).join('、');
  let extra = '';
  if (actor.faction === 'wolf' && actor.privateMemory.wolfTeammates.length) {
    const mates = actor.privateMemory.wolfTeammates.map(id => `${id + 1}号 ${state.players[id].name}`).join('、');
    extra = lang === 'zh' ? `\n🐺 你是狼,队友:${mates}。要保护队友,把票投给一个好人(最好是发言最像神职的)。` : `\n🐺 You're a wolf. Pack: ${mates}. Protect them, vote for a good player.`;
  }
  if (actor.role === 'seer' && actor.privateMemory.seerChecks.length) {
    const last = actor.privateMemory.seerChecks[actor.privateMemory.seerChecks.length - 1];
    extra = lang === 'zh' ? `\n🔮 你最近验的人:${last.targetId + 1}号 → ${last.isWolf ? '狼' : '好人'}。投票给狼。` : `\n🔮 Your last check: ${last.targetId + 1} → ${last.isWolf ? 'wolf' : 'good'}. Vote them.`;
  }
  return lang === 'zh'
    ? `你是"${actor.name}"(第${actor.id + 1}号),身份:${ROLES[actor.role].name.zh}\n存活玩家(除你):${alive}${extra}\n\n现在投票放逐,你选一个人。\n\n输出 JSON:{"target":投票给某人的座位号(1-based)}`
    : `You are "${actor.name}" (#${actor.id + 1}), role: ${ROLES[actor.role].name.en}\nAlive (excluding you): ${alive}${extra}\n\nVote to exile.\n\nOutput JSON: {"target":target seat (1-based)}`;
}
