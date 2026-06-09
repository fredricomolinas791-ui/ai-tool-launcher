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

import { useState, useEffect, useRef, type Dispatch, type SetStateAction } from 'react';
import { Drama, Sparkles, Sun, ChevronRight, Crown, AlertTriangle, Play, X, Skull, Shield, Users, Swords } from 'lucide-react';
import { Button } from '../../ui/Button';
import { useI18n } from '../../../hooks/useI18n';
import {
  BOARDS, BOARD_LIST, ROLES, type BoardId, type GameState, type Player, type RoleId, type SpeechRecord,
  initGame, loadAIConfig, callAIStream, checkWinner, parseAIDecision, tryJsonExtract, applyLoversChain,
  applyKnightDuel, applyWolfSelfDestruct, canVote, killPlayers,
  sheriffVoteWeight, aggregateWolfVotesLegacy, parseAIDecisionToTargetId,
} from './engine';
import type { BoardDef } from './data';
import { canWitchSelfSave } from './data';
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

function PlayerSeat({ player, isYou, isSpeaking, isActing, lang }: {
  player: Player; isYou: boolean; isSpeaking?: boolean; isActing?: boolean; lang: 'zh' | 'en';
}) {
  // isActing:boolean
  const role = ROLES[player.role];
  // 严格隐藏:座位框里永远不显示角色名,只用 emoji(只对自己显示真实身份)
  const display = !player.alive ? '💀' : isYou ? role.emoji : '👤';
  const isSheriff = player.privateMemory.isSheriff;
  return (
    <div className="relative flex flex-col items-center" style={{ width: 72 }}>
      <div
        className={`w-14 h-14 rounded-full flex items-center justify-center text-2xl border-2 transition-all ${isActing ? 'animate-pulse' : ''}`}
        style={{
          background: player.alive
            ? (isActing ? 'rgba(250,204,21,0.25)' : (isSpeaking ? 'var(--color-accent-glow)' : 'var(--color-card-bg)'))
            : 'var(--color-bg-deep)',
          borderColor: isYou ? 'var(--color-accent)'
            : isActing ? '#facc15'
            : isSpeaking ? 'var(--color-accent)'
            : 'var(--color-border-light)',
          opacity: player.alive ? 1 : 0.4,
          boxShadow: isActing
            ? '0 0 0 4px rgba(250,204,21,0.35), 0 0 16px rgba(250,204,21,0.5)'
            : (isSpeaking ? '0 0 0 4px var(--color-accent-glow)' : 'none'),
        }}
      >{display}</div>
      <div className="mt-1 text-[10px] font-medium truncate w-full text-center" style={{ color: player.alive ? 'var(--color-text)' : 'var(--color-text-muted)' }}>
        {player.id + 1}. {player.name}
      </div>
      {isYou && <div className="text-[9px] mt-0.5" style={{ color: 'var(--color-accent)' }}>{lang === 'zh' ? '你' : 'You'}</div>}
      {isSheriff && player.alive && (
        <div className="text-[9px] mt-0.5" title={lang === 'zh' ? '警长(1.5 票)' : 'Sheriff (1.5 votes)'} style={{ color: '#facc15' }}>⭐ {lang === 'zh' ? '警长' : 'Sheriff'}</div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   发言气泡
   ═══════════════════════════════════════════════════════════════════ */

function SpeechBubble({ player, text, streaming, lang }: {
  player: Player; text: string; streaming?: boolean; lang: 'zh' | 'en';
}) {
  return (
    <div className="flex gap-2 mb-2 animate-fade-in">
      <div className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-base"
        style={{ background: 'var(--color-accent-glow)' }}>
        {/* 严格隐藏:气泡里永远不显示身份 emoji,统一用 👤 */}
        👤
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[11px] mb-0.5 flex items-center gap-1.5" style={{ color: 'var(--color-text-muted)' }}>
          <span className="font-medium" style={{ color: 'var(--color-text)' }}>{player.id + 1}. {player.name}</span>
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
    onExit={() => { setState(null); setPhase('select'); sessionStorage.removeItem(WEREWOLF_SAVE_KEY); }}
    onReplay={() => replayLastBoard(state.boardId)} />;
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

function GameRunner({ state: initial, setState: setStateProp, aiConfig, lang, onExit, onReplay }: {
  state: GameState;
  setState: Dispatch<SetStateAction<GameState | null>>;
  aiConfig: NonNullable<ReturnType<typeof loadAIConfig>>;
  lang: 'zh' | 'en'; onExit: () => void; onReplay: () => void;
}) {
  // 内部 state 仅用于派生 UI(比如 streamingText),游戏 state 走 prop
  const [streamingText, setStreamingText] = useState<{ playerId: number; text: string } | null>(null);
  /* 当前夜晚正在行动的玩家 IDs(用于座位高亮)—— 仅对行动者(及其队友,如狼队)可见,平民看不到 */
  const [actingPlayerIds, setActingPlayerIds] = useState<number[]>([]);
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
                {leftIds.map(p => (
                  <PlayerSeat key={p.id} player={p}
                    isYou={p.id === state.userId}
                    isSpeaking={streamingText?.playerId === p.id}
                    isActing={actingPlayerIds.includes(p.id)}
                    lang={lang} />
                ))}
              </div>
              {/* 右列 */}
              <div className="flex flex-col gap-1.5">
                {rightIds.map(p => (
                  <PlayerSeat key={p.id} player={p}
                    isYou={p.id === state.userId}
                    isSpeaking={streamingText?.playerId === p.id}
                    isActing={actingPlayerIds.includes(p.id)}
                    lang={lang} />
                ))}
              </div>
            </div>
          </div>
          {/* 当前阶段 UI */}
          {state.phase === 'role-reveal' && <RoleRevealPanel state={state} lang={lang} onContinue={() => setState(s => ({ ...s, phase: 'night', round: s.round + 1 }))} />}
          {state.phase === 'night' && <NightPanel state={state} setState={setState} lang={lang} aiSpeak={aiSpeak} onActingChange={setActingPlayerIds} />}
          {state.phase === 'last-words' && <LastWords state={state} setState={setState} lang={lang} aiSpeak={aiSpeak} />}
          {state.phase === 'day-announce' && <DayAnnounce state={state} setState={setState} lang={lang} />}
          {state.phase === 'sheriff-election' && <SheriffElection state={state} setState={setState} lang={lang} aiSpeak={aiSpeak} />}
          {state.phase === 'day-discuss' && <DayDiscuss state={state} setState={setState} lang={lang} aiSpeak={aiSpeak} />}
          {state.phase === 'day-vote' && <DayVote state={state} setState={setState} lang={lang} aiSpeak={aiSpeak} />}
          {state.phase === 'vote-results' && <VoteResults state={state} setState={setState} lang={lang} />}
          {state.phase === 'pk-speech' && <PKSpeech state={state} setState={setState} lang={lang} aiSpeak={aiSpeak} />}
          {state.phase === 'pk-vote' && <PKVote state={state} setState={setState} lang={lang} aiSpeak={aiSpeak} />}
          {state.phase === 'hunter-shoot' && <HunterShoot state={state} setState={setState} lang={lang} aiSpeak={aiSpeak} />}
          {state.phase === 'idiot-flip' && <IdiotFlip state={state} setState={setState} lang={lang} aiSpeak={aiSpeak} />}
          {state.phase === 'wolfking-pick' && <WolfKingPick state={state} setState={setState} lang={lang} aiSpeak={aiSpeak} />}
        </div>

        {/* 右侧:信息流(发言 + 法官 + 死亡 + 投票,可滚动) */}
        <InfoStream state={state} lang={lang} streamingText={streamingText} />
      </div>

      {state.phase === 'gameover' && winner && <GameOver state={state} winner={winner} lang={lang} onExit={onExit} onReplay={onReplay} />}
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

  // 死亡记录
  const deaths = state.publicLog.filter(e => e.kind === 'death');
  // 法官字幕(系统消息)
  const systemEvents = state.publicLog.filter(e => e.kind === 'system');
  // 投票放逐记录
  const exiles = state.publicLog.filter(e => e.kind === 'death' && e.text.startsWith('🗳️'));
  // P1-#48 修复:今日 claim 面板
  const todayClaims = state.claims?.[state.round];

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

      {/* P1-#48 修复:今日 claim 面板(谁跳了预言家/守卫/女巫) */}
      {todayClaims && (todayClaims.seerClaims.length > 0 || todayClaims.witchClaims.length > 0 || todayClaims.guardClaims.length > 0) && (
        <div>
          <div className="text-[10px] mb-1.5 flex items-center gap-1 font-semibold" style={{ color: '#a855f7' }}>
            📜 {lang === 'zh' ? '今日身份声明' : 'Today\'s claims'}
          </div>
          {todayClaims.seerClaims.map(c => (
            <div key={`seer-${c.playerId}`} className="text-[11px] py-1 px-2 rounded mb-1" style={{ background: 'rgba(99,102,241,0.1)', color: 'var(--color-text)' }}>
              🔮 <b>{c.playerId + 1}号 {state.players[c.playerId].name}</b> {lang === 'zh' ? '跳预言家:' : 'claims seer:'} {c.checks.map(x => `${x.targetId + 1}号=${x.isWolf ? (lang === 'zh' ? '狼' : 'wolf') : (lang === 'zh' ? '好人' : 'good')}`).join('、')}
            </div>
          ))}
          {todayClaims.witchClaims.map(c => (
            <div key={`witch-${c.playerId}`} className="text-[11px] py-1 px-2 rounded mb-1" style={{ background: 'rgba(168,85,247,0.1)', color: 'var(--color-text)' }}>
              💊 <b>{c.playerId + 1}号 {state.players[c.playerId].name}</b> {lang === 'zh' ? '跳女巫:' : 'claims witch:'} {c.savedId !== null ? `${lang === 'zh' ? '救了' : 'saved'} ${c.savedId + 1}号` : ''} {c.poisonedId !== null ? `${lang === 'zh' ? ', 毒了' : ', poisoned'} ${c.poisonedId + 1}号` : ''}
            </div>
          ))}
          {todayClaims.guardClaims.map(c => (
            <div key={`guard-${c.playerId}`} className="text-[11px] py-1 px-2 rounded mb-1" style={{ background: 'rgba(34,197,94,0.1)', color: 'var(--color-text)' }}>
              🛡️ <b>{c.playerId + 1}号 {state.players[c.playerId].name}</b> {lang === 'zh' ? '跳守卫:' : 'claims guard:'} {c.guardedId !== null ? `${lang === 'zh' ? '守了' : 'guarded'} ${c.guardedId + 1}号` : (lang === 'zh' ? '空守' : 'no guard')}
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
          return <SpeechBubble key={i} player={p} text={sp.text} lang={lang} />;
        })}
        {streamingText && (
          <SpeechBubble player={state.players[streamingText.playerId]} text={streamingText.text}
            streaming lang={lang} />
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
    const mates = userP.privateMemory.wolfTeammates.map(id => `${state.players[id].name}`).join('、');
    extra = lang === 'zh' ? `\n🐺 你的狼队友:${mates}` : `\n🐺 Your wolf pack: ${mates}`;
  }
  // P2-#32 修复:神职状态 HUD
  let statusHud = '';
  const mem = userP.privateMemory;
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

function NightPanel({ state, setState, lang, aiSpeak, onActingChange }: {
  state: GameState; setState: (updater: (s: GameState) => GameState) => void;
  lang: 'zh' | 'en';
  aiSpeak: (playerId: number, system: string, user: string, silent?: boolean) => Promise<{ speech: string; target: number | null }>;
  onActingChange?: (playerIds: number[]) => void;
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
  }, [state.round]);

  const cur = actions[actionIdx];
  // 用户是否在当前行动组(狼队或单人)
  const isUserActor = cur ? cur.playerIds.includes(state.userId) : false;

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
            // 超时:不强制投谁,让 aggregateWolfVotes 用现有票数(可能全空 → null)
            // P1-#10 修复:用新签名 aggregateWolfVotesLegacy(只需 votes 数组)
            const target = aggregateWolfVotesLegacy(stateRef.current.wolfVotes);
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
            // P1-#10 修复:用新签名 aggregateWolfVotesLegacy(只需 votes 数组)
            const validVotes = votes.filter((v): v is number => v !== null);
            const target = aggregateWolfVotesLegacy(validVotes);
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
          startCountdown(timeoutSec, () => {
            if (aiDoneRef.current) return;
            aiDoneRef.current = true;
            if (cancelled) return;
            if (cur.role === 'witch') {
              setState(s => applyWitchAction(s, actorId, false, null, lang));
            } else {
              setState(s => applyNightAction(s, cur.role, actorId, null, lang));
            }
            setBusy(false);
            setScene('outro');
          });
          runAIAction(actor, stateRef.current, lang, aiSpeakRef.current).then((result) => {
            if (cancelled || aiDoneRef.current) return;
            aiDoneRef.current = true;
            if (cur.role === 'witch' && result.decision) {
              setState(s => applyWitchAction(s, actorId, result.decision!.useAntidote ?? false, result.decision!.poisonTarget ?? null, lang));
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
  // 标准规则:夜间只有行动者(及其同阵营可见)能看到行动信息
  // 狼队回合:所有狼人可见(包括用户若为狼)
  // 其他角色回合:只有自己可见
  const userP = state.players[state.userId];
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
          : (lang === 'zh' ? `${role.name.zh} 正在行动…` : `${role.name.en} acting…`)}
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
  onConfirm: (target: number | null, extra?: { useAntidote?: boolean; poisonTarget?: number | null }) => void;
}) {
  const userP = state.players[state.userId];
  const aliveOthers = state.players.filter(p => p.alive && p.id !== state.userId);
  const [selected, setSelected] = useState<number | null>(null);

  // 守卫:不能连守同一人 + 上一夜空守则本夜必须守人(P0-#5 修复)
  if (role === 'guard') {
    const lastTarget = userP.privateMemory.guardLastTargetId;
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
    // P1-#7 修复:自救规则统一用 canWitchSelfSave() 后 ruleHint 改在 UI 内联生成(避免未用变量)
    return (
      <div>
        <p className="text-xs mb-2" style={{ color: 'var(--color-text-muted)' }}>
          {lang === 'zh'
            ? `今晚狼人想杀的是:${wolfTarget !== null ? `${wolfTarget + 1}号 ${state.players[wolfTarget].name}` : '没人(守卫挡住了)'}${isFirstNight && selfTarget ? '(首夜你自己,网杀规则不能自救)' : ''}`
            : `Wolves target: ${wolfTarget !== null ? `${state.players[wolfTarget].name}` : 'nobody'}${isFirstNight && selfTarget ? ' (night 1, online: no self-save)' : ''}`}
        </p>
        <div className="space-y-1.5">
          <label className={`flex items-center gap-2 text-xs ${canAntidote ? '' : 'opacity-50'}`}>
            <input type="checkbox" checked={useAntidote} disabled={!canAntidote}
              onChange={e => setUseAntidote(e.target.checked)} />
            💊 {lang === 'zh' ? '使用解药救' : 'Use antidote on'} {wolfTarget !== null ? state.players[wolfTarget].name : '目标'}
            {!canAntidote && (lang === 'zh' ? ' (不可用)' : ' (unavailable)')}
          </label>
          <div>
            <label className={`flex items-center gap-2 text-xs ${canPoison ? '' : 'opacity-50'}`}>
              <input type="checkbox" checked={poisonTarget !== null} disabled={!canPoison}
                onChange={e => setPoisonTarget(e.target.checked ? (aliveOthers[0]?.id ?? null) : null)} />
              ☠️ {lang === 'zh' ? '使用毒药(选一个人杀)' : 'Use poison (kill someone)'}
              {!canPoison && (lang === 'zh' ? ' (已用)' : ' (used)')}
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
    const sys = lang === 'zh'
      ? `你是"${actor.name}"(第${actor.id + 1}号),身份:女巫 💊
今晚狼人想杀的是:${wolfTarget !== null ? `${wolfTarget + 1}号 ${state.players[wolfTarget].name}` : '没人(没狼/守卫挡了)'}
${isFirstNight && selfTarget ? '⚠️ 但因为是首夜(网杀规则),你不能自救。' : ''}
${!canAntidote ? '解药:已用' : '解药:可用'}
${canPoison ? '毒药:可用' : '毒药:已用'}

请决策:
${canAntidote ? '- 是否使用解药救 ${wolfTarget !== null ? state.players[wolfTarget].name : "目标"}?' : ''}
${canPoison ? '- 是否使用毒药毒一个人?' : ''}

输出 JSON:{"speech":"你的理由(可选)","useAntidote":true/false,"poisonTarget":毒药目标座位号(1-based,不用填 0)}`
      : `You are "${actor.name}" (#${actor.id + 1}), Witch 💊
Wolves want to kill: ${wolfTarget !== null ? `${state.players[wolfTarget].name} (#${wolfTarget + 1})` : 'nobody'}
${isFirstNight && selfTarget ? '⚠️ Night 1 (online rule): you cannot save yourself.' : ''}
${!canAntidote ? 'Antidote: USED' : 'Antidote: available'}
${canPoison ? 'Poison: available' : 'Poison: USED'}

Output JSON: {"speech":"reasoning (optional)","useAntidote":true/false,"poisonTarget":target seat (1-based, 0 if none)}`;
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

  // 解药:仅记录使用决策和救了谁(实际是否生效由 resolveNight 决定)
  if (useAntidote && !mem.witchAntidoteUsed && wolfTarget !== null) {
    // P1-#7 修复:自救规则统一用 canWitchSelfSave()
    if (canWitchSelfSave(s.players.length, s.round, wolfTarget === witchId)) {
      newMem.witchAntidoteUsed = true;
      newMem.witchSavedId = wolfTarget;
      // 不在这里删 newDead —— 同守同救时会取消
    }
  }

  // 毒药:直接加进 deadThisNight
  if (poisonTarget !== null && !mem.witchPoisonUsed
    && poisonTarget !== witchId
    && s.players[poisonTarget]?.alive
    && !newDead.includes(poisonTarget)) {
    newMem.witchPoisonUsed = true;
    newMem.witchPoisonedId = poisonTarget;
    newDead.push(poisonTarget);
  }

  return {
    ...s,
    players: s.players.map(p => p.id === witchId ? { ...p, privateMemory: newMem } : p),
    deadThisNight: newDead,
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
  let dead = new Set<number>(s.deadThisNight);
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
    aiSpeak(idiotId, sys, usr, true /* silent:白痴私下翻牌 */).then(({ target }) => {
      // P0-#6 修复:尊重 AI 决策(target=1 翻牌, target=0 认命, target=null 默认翻牌)
      setBusy(false);
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
  const aliveOthers = state.players.filter(p => p.alive && p.id !== wolfKingId);

  /* AI 狼王:用 LLM 战略选 victim */
  useEffect(() => {
    if (isUser || aiDone || busy || victim !== null) return;
    if (aliveOthers.length === 0) { setAiDone(true); return; }
    setBusy(true);
    // 收集战略信息:已暴露的"预言家"(从 seerSuspects 算)
    const seerSuspects = state.players.filter(p => p.alive && p.role !== 'seer').slice(0, 3).map(p => `${p.id + 1}号 ${p.name}`);
    const sys = lang === 'zh'
      ? `你是"${wolfKing.name}"(第${wolfKingId+1}号),你是狼王,被投票放逐了!你临死前可以带走一名玩家。\n存活玩家:${aliveOthers.map(p => `${p.id+1}号 ${p.name}`).join('、')}\n\n战术建议:\n- 优先带走「最像预言家」的人(发言最像神职的)\n- 或带走「女巫」(解药用过的)\n- 避免带走自己的狼队友(虽然规则允许,但浪费)\n- 重点目标:${seerSuspects.join('、')}\n\n输出 JSON:{"speech":"你的遗言(可选)","target":你要带走的玩家座位号(1-based)}`
      : `You are "${wolfKing.name}" (#${wolfKingId+1}), Wolf King, voted out! Take one victim with you.\nAlive: ${aliveOthers.map(p => `${p.id+1} ${p.name}`).join(', ')}\n\nOutput JSON: {"speech":"last words (optional)","target":target seat (1-based)}`;
    const usr = lang === 'zh' ? '用 JSON 输出:{"target":目标座位号(1-based)}' : 'Output JSON: {"target":target seat (1-based)}';
    aiSpeak(wolfKingId, sys, usr, true).then(({ target }) => {
      if (target !== null && target >= 0 && target < state.players.length && state.players[target].alive && target !== wolfKingId) {
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

function SheriffElection({ state, setState, lang, aiSpeak }: {
  state: GameState; setState: (u: (s: GameState) => GameState) => void;
  lang: 'zh' | 'en';
  aiSpeak: (id: number, sys: string, usr: string, silent?: boolean, options?: { temperature?: number; maxTokens?: number }) => Promise<{ speech: string; target: number | null }>;
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
    setAiDecisions(prev => ({ ...prev, ...decisions }));
  }, [step, userRegister, alivePlayers.length, state.userId, aiDecisions]);

  /* 报名阶段 → 进入发言 */
  const confirmRegister = () => {
    setBusy(true);
    const registered = [...election.registeredIds];
    if (userRegister) registered.push(state.userId);
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
     并加 lastProcessedSpeakerRef 防止 setState 失败时的 race。 */
  const lastProcessedSpeakerRef = useRef<number | null>(null);
  useEffect(() => {
    if (step !== 'speech' || !currentSpeakerId) return;
    if (lastProcessedSpeakerRef.current === currentSpeakerId) return;  // 防止重复
    const speaker = stateRef.current.players[currentSpeakerId];
    if (speaker.id === state.userId) return;  // 用户自己,等用户操作
    if (busy) return;
    lastProcessedSpeakerRef.current = currentSpeakerId;
    setBusy(true);
    const sys = lang === 'zh'
      ? `你是"${speaker.name}"(第${speaker.id+1}号),你正在参加警长竞选!请发言拉票(30-80 字):\n- 说明你的身份/立场/逻辑(可不暴露真身份)\n- 表态你作为警长会做的事(带队、归票、坚守)\n- 可以攻击其他候选人\n\n只输出你的竞选发言,不要 JSON 包装。`
      : `You are "${speaker.name}", running for sheriff! Give a 30-80 word campaign speech explaining your stance and attacking other candidates. Output speech only.`;
    const usr = lang === 'zh' ? '请发言拉票' : 'Give campaign speech';
    aiSpeak(speaker.id, sys, usr).then(() => {
      setBusy(false);
      // 推进一步
      setState(s => {
        const cur = s.sheriffElection!;
        const newIdx = cur.speechIdx + 1;
        const totalCands = cur.registeredIds.filter(id => !cur.withdrawnIds.includes(id)).length;
        if (newIdx >= totalCands) {
          // 全部发言完 → 同步推进 setStep(避免 useEffect 重跑时 currentSpeakerId 仍是这个玩家)
          setStep('withdraw');
          return s;
        }
        return { ...s, sheriffElection: { ...cur, speechIdx: newIdx } };
      });
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

  /* 退水阶段:每个候选人决定退水还是刚警徽 */
  useEffect(() => {
    if (step !== 'withdraw') return;
    const decisions: Record<number, 'withdraw' | 'stay'> = {};
    for (const cid of candidates) {
      if (cid === state.userId) continue;
      // 简化:如果是非神职普通村民,有 30% 概率退水(觉得争不过)
      const c = stateRef.current.players[cid];
      const probWithdraw = c.faction === 'wolf' ? 0.15
        : ['seer', 'witch', 'hunter', 'guard', 'knight'].includes(c.role) ? 0.1
        : 0.3;
      decisions[cid] = Math.random() < probWithdraw ? 'withdraw' : 'stay';
    }
    setAiDecisions(prev => {
      // 合并时不要覆盖 register 阶段已存的 key
      const next = { ...prev };
      for (const [k, v] of Object.entries(decisions)) next[parseInt(k, 10)] = v;
      return next;
    });
  }, [step, candidates.length, state.userId, candidates]);

  /* 用户退水确认 */
  const confirmWithdraw = () => {
    setBusy(true);
    const withdrawn = [...election.withdrawnIds];
    if (userWithdrew === true) {
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
      setState(s => ({
        ...s,
        sheriffElection: { ...election, withdrawnIds: withdrawn, pkRound: 0, speechIdx: 0 },
        publicLog: [...s.publicLog, { kind: 'system', day: s.round, text: '⭐ 所有候选人都退水了,警徽流失。' }],
        phase: 'day-discuss',
      }));
      setStep('done');
      return;
    }
    if (remaining.length === 1) {
      // 只剩一个 → 自动当选
      const winner = remaining[0];
      setState(s => ({
        ...s,
        sheriffElection: { ...election, withdrawnIds: withdrawn, pkRound: 0, speechIdx: 0 },
        players: s.players.map(p => p.id === winner ? { ...p, privateMemory: { ...p.privateMemory, isSheriff: true } } : p),
        publicLog: [...s.publicLog, { kind: 'system', day: s.round, text: `⭐ ${s.players[winner].name} 唯一未退水,自动当选警长(1.5 票)` }],
        phase: 'day-discuss',
      }));
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
    if (userVote === null) return;
    const targetPool = step === 'pk-vote' && tiedIds ? tiedIds : candidates;
    // 收集所有票(AI + 用户)
    const allVotes: { voterId: number; targetId: number }[] = [];
    for (const [vid, tid] of Object.entries(aiVotes)) {
      allVotes.push({ voterId: parseInt(vid, 10), targetId: tid as number });
    }
    if (userVote !== null && targetPool.includes(userVote)) {
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
        setState(s => ({
          ...s,
          sheriffElection: { ...election, pkRound: newPkRound, speechIdx: 0 },
          publicLog: [...s.publicLog, { kind: 'system', day: s.round, text: '⭐ PK 后仍平票,警徽流失!' }],
          phase: 'day-discuss',
        }));
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
    setState(s => ({
      ...s,
      sheriffElection: { ...election, pkRound: election.pkRound + 1, speechIdx: 0 },
      players: s.players.map(p => p.id === winner ? { ...p, privateMemory: { ...p.privateMemory, isSheriff: true } } : p),
      publicLog: [...s.publicLog, { kind: 'system', day: s.round, text: `⭐ ${s.players[winner].name} 当选警长(1.5 票投票权)` }],
      phase: 'day-discuss',
    }));
    setStep('done');
  };

  /* PK 发言:平票者按候选人列表中的逆序重新发言 */
  useEffect(() => {
    if (step !== 'pk-speech' || !tiedIds) return;
    // 找出 tiedIds 在 candidates 中的位置,按逆序
    const tiedInOrder = candidates.filter(c => tiedIds.includes(c));
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
        <p className="text-[10px] text-center mb-2" style={{ color: 'var(--color-text-muted)' }}>
          {lang === 'zh' ? `已报名(AI):${Object.values(aiDecisions).filter(d => d === 'register').length} 人` : `AI registered: ${Object.values(aiDecisions).filter(d => d === 'register').length}`}
        </p>
        <div className="text-center mt-3">
          <Button onClick={confirmRegister} disabled={userRegister === null}>
            {lang === 'zh' ? '下一步' : 'Next'} <ChevronRight size={14} className="ml-1" />
          </Button>
        </div>
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
          speeches: [...s.speeches, { playerId: s.userId, day: s.round, text }],
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
        <p className="text-[10px] text-center mb-2" style={{ color: 'var(--color-text-muted)' }}>
          {lang === 'zh' ? `已退水(AI):${Object.values(aiDecisions).filter(d => d === 'withdraw').length} 人` : `AI withdrawn: ${Object.values(aiDecisions).filter(d => d === 'withdraw').length}`}
        </p>
        <div className="text-center mt-3">
          <Button onClick={confirmWithdraw} disabled={candidates.includes(state.userId) ? userWithdrew === null : false}>
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
    const sys = lang === 'zh'
      ? `你是"${hunter.name}"(第${hid+1}号),你已经死了。作为猎人你可以开枪带走一名玩家(也可以不开枪)。\n存活玩家(除你):${aliveOthers.map(p => `${p.id+1}号 ${p.name}`).join('、')}\n\n输出 JSON:{"speech":"你的遗言(可选)","target":你要带走的玩家座位号(1-based,不开枪填 0)}`
      : `You are "${hunter.name}" (#${hid+1}), you died. As hunter, you can shoot one player (or skip).\nAlive (excl. you): ${aliveOthers.map(p => `${p.id+1} ${p.name}`).join(', ')}\n\nOutput JSON: {"speech":"last words (optional)","target":target seat (1-based, 0 if skip)}`;
    const usr = lang === 'zh'
      ? '请用 JSON 格式输出:{"speech":"你的遗言","target":目标座位号(1-based,不开枪填 0)}'
      : 'Output JSON: {"speech":"last words","target":target seat (1-based, 0 if skip)}';
    aiSpeak(hid, sys, usr, true /* silent:猎人私下选目标 */).then(({ target: aiT }) => {
      if (aiT !== null && aiT >= 0 && aiT < state.players.length && state.players[aiT].alive && aiT !== hid) {
        setTarget(aiT);
      }
      setBusy(false);
      setAiDone(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* 用户/AI 决策后:执行开枪 (P0-#52 修复:射杀后做胜利检查) */
  const fire = (chosen: number | null) => {
    if (chosen === null) {
      // 不开枪 → 直接进夜晚
      setState(s => ({ ...s, lastVotedOut: null, phase: 'night', round: s.round + 1 }));
      return;
    }
    setState(s => {
      // 死亡后还要触发情侣殉情链 + 检查其他猎人
      // P0-#3 修复:用 killPlayers helper(清 isSheriff + 殉情)
      const killed = killPlayers(s, [chosen], '🏹', `${s.players[chosen].name} 跟着去了`);
      // killPlayers 加的日志要改下格式(从 "🏹 X号 X" 改成更适合的)
      const fixedLog = killed.publicLog.slice(0, -1).concat([{
        kind: 'death' as const, day: s.round, playerId: chosen,
        text: `🏹 ${s.players[chosen].name} 跟着去了`,
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

function DayDiscuss({ state, setState, lang, aiSpeak }: {
  state: GameState; setState: (u: (s: GameState) => GameState) => void;
  lang: 'zh' | 'en';
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

  /* 60s 倒计时(超时自动跳过) */
  useEffect(() => {
    if (!cur) return;
    if (busy || isUserTurn) {
      // AI 思考中或用户输入中,倒计时暂停
      return;
    }
    if (timeLeft <= 0) {
      // 超时:AI 自动 next(应该已经 busy=false 时已经过 nextSpeaker 了,这里兜底)
      if (discussIdx + 1 < speakers.length) {
        setDiscussIdx(i => i + 1);
        setTimeLeft(60);
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
    if (!cur) return;
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
    aiSpeak(cur.id, sys, usr, false, { temperature: temp }).then(({ speech }) => {
      // P1-#48 修复:AI 发言也检测 claim 关键字
      // 放宽正则:支持 "我是预"/"我验过"/"checked"/"3号位"/"3 是狼"/"3→狼" 等
      // P1-#22: 在 setState 内同步推进 discussIdx/phase(避免 setTimeout race)
      setState(s => {
        const newClaims = { ...(s.claims || {}) };
        if (!newClaims[s.round]) newClaims[s.round] = { seerClaims: [], witchClaims: [], guardClaims: [] };
        const dayClaims = newClaims[s.round];

        // ── 预言家 claim 检测 ──
        if (/预言家|我是预|验了|验过|我查|seer|checked|verify/i.test(speech)) {
          const checkRe = /(\d{1,2})\s*号(?:位|座位)?|\b(\d{1,2})\s*(?:是|为|=|→|->)\s*(?:狼|好人|神|民|wolf|good|god|villager)/gi;
          const matches = [...speech.matchAll(checkRe)];
          if (matches.length > 0) {
            const checks: { targetId: number; isWolf: boolean }[] = matches.map(m => {
              const numStr = m[1] ?? m[2];
              const num = parseInt(numStr, 10) - 1;
              const after = speech.slice(m.index ?? 0, (m.index ?? 0) + 30).toLowerCase();
              const isWolf = /狼|wolf/.test(after);
              return { targetId: num, isWolf };
            }).filter(c => c.targetId >= 0 && c.targetId < s.players.length);
            if (checks.length > 0) {
              const existing = dayClaims.seerClaims.findIndex(c => c.playerId === cur.id);
              if (existing >= 0) dayClaims.seerClaims[existing] = { playerId: cur.id, checks };
              else dayClaims.seerClaims.push({ playerId: cur.id, checks });
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

  /* AI 狼自爆:10% 概率在白天讨论中自爆(绝望时刻) */
  useEffect(() => {
    if (!cur) return;
    if (cur.faction !== 'wolf') return;
    if (cur.id === state.userId) return;
    if (busy) return;
    // 10% 概率自爆
    if (Math.random() < 0.10) {
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
          if (existing >= 0) dayClaims.seerClaims[existing] = { playerId: state.userId, checks };
          else dayClaims.seerClaims.push({ playerId: state.userId, checks });
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
      return {
        ...s,
        speeches: [...s.speeches, newSpeech],
        publicLog: [...s.publicLog, { kind: 'speech', day: s.round, playerId: state.userId, text }],
        claims: newClaims,
      };
    });
    nextSpeaker();
  };

  /* 用户狼自爆 */
  const onSelfDestruct = () => {
    if (!userIsWolf) return;
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

      {/* 狼自爆按钮(仅存活狼可见) */}
      {userIsWolf && (
        <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--color-border-light)' }}>
          <button
            onClick={onSelfDestruct}
            className="w-full px-3 py-2 rounded text-xs font-semibold transition-all hover:scale-105"
            style={{ background: 'rgba(220,38,38,0.15)', color: '#dc2626', border: '1px solid #dc2626' }}
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

function DayVote({ state, setState, lang, aiSpeak }: {
  state: GameState; setState: (u: (s: GameState) => GameState) => void;
  lang: 'zh' | 'en';
  aiSpeak: (id: number, sys: string, usr: string, silent?: boolean, options?: { temperature?: number; maxTokens?: number }) => Promise<{ speech: string; target: number | null }>;
}) {
  const alivePlayers = state.players.filter(p => p.alive);
  const [userTarget, setUserTarget] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

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
    if (exiled === null) {
      setState(s => ({ ...s, phase: 'night', round: s.round + 1, pkUsed: false, pkPlayers: null, lastVoteData: { allVotes, tally, exiled: null } }));
      return;
    }

    setState(s => ({
      ...s,
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
        // P1-#22 修复(用户反馈:首夜后应进白天,不是直接进夜):
        // 用 lastVotedOut 区分来源 — 被投票放逐产生的死亡→下一阶段是夜,其他→下一阶段是天
        if (s.lastVotedOut !== null) {
          // 白天投票放逐 → 下一阶段是夜晚(round+1)
          return { ...s, phase: 'night', round: s.round + 1, pendingLastWords: [], lastVotedOut: null };
        }
        // 夜间死亡(首夜狼杀)→ 下一阶段是白天(12+ 人局会先进 sheriff-election)
        return { ...s, phase: 'day-discuss', pendingLastWords: [] };
      });
      return;
    }
    setLwIdx(i => i + 1);
  };

  useEffect(() => {
    if (!curPlayer) return;
    if (curPlayer.id === state.userId) return;
    if (busy) return;
    setBusy(true);
    const isDay = state.pendingLastWords.length > 0 && state.deadThisNight.length === 0;
    const diedFrom = isDay ? '白天投票/技能' : '夜间';
    const sys = lang === 'zh'
      ? `你是"${curPlayer.name}"(第${curPlayer.id + 1}号),你因${diedFrom}被杀了!请留遗言(30-80 字):\n- 可以留自己的身份线索(也可不)\n- 可以留怀疑对象\n- 可以感谢/指责某人\n\n只输出你的遗言。`
      : `You are "${curPlayer.name}", you died. Leave last words (30-80 words). Output speech only.`;
    aiSpeak(curPlayer.id, sys, lang === 'zh' ? '请留遗言(30-80 字)' : 'Leave last words (30-80 words)').then(() => {
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
      speeches: [...s.speeches, { playerId: state.userId, day: s.round, text }],
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
                {state.players[v.voterId].privateMemory.isSheriff && <span style={{ color: '#facc15' }}>⭐</span>}
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
                {player.privateMemory.isSheriff && <span style={{ color: '#facc15' }}>⭐{lang === 'zh' ? '警长' : 'sheriff'}</span>}
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
      speeches: [...s.speeches, { playerId: state.userId, day: s.round, text }],
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

  return (
    <div className="p-6 rounded-xl text-center" style={{
      background: 'var(--color-card-bg)',
      border: `2px solid ${winner === 'good' ? '#22c55e' : winner === 'wolf' ? '#dc2626' : '#a855f7'}`,
    }}>
      <Crown size={48} className="mx-auto mb-2" style={{ color: winner === 'good' ? '#22c55e' : winner === 'wolf' ? '#dc2626' : '#a855f7' }} />
      <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--color-text)' }}>{title}</h2>
      <div className="text-xs mb-3 p-2 rounded" style={{ background: 'var(--color-bg-deep)', color: 'var(--color-text-muted)' }}>
        {lang === 'zh' ? '胜利原因' : 'Reason'}: {reason}
      </div>
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
      {/* P1-#22 修复:导出对话按钮(给 Claude 调试用) */}
      <div className="mb-3">
        <Button onClick={exportDialogue} variant="secondary" className="text-xs">
          {copied
            ? (lang === 'zh' ? '✓ 已复制到剪贴板' : '✓ Copied')
            : (lang === 'zh' ? '📋 复制对话日志(发回给 Claude 调试)' : '📋 Copy dialogue log (debug)')}
        </Button>
      </div>
      {/* P3-#41 修复:重玩同板子 + 换板子 两个按钮 */}
      <div className="space-x-2">
        <Button onClick={onReplay}>{lang === 'zh' ? '重玩此板子' : 'Replay board'}</Button>
        <Button onClick={onExit} variant="secondary">{lang === 'zh' ? '换板子' : 'Change board'}</Button>
      </div>
    </div>
  );
}

/* P1-#22: 导出对话日志(纯文本格式,方便发回给 Claude 调试) */
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
    const isSheriff = p.privateMemory.isSheriff ? ` ⭐${L('警长', 'Sheriff')}` : '';
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
      for (const c of p.privateMemory.seerChecks) seerChecks.push({ playerId: p.id, ...c });
    }
  }

  // 守卫记录
  const guardHistory: Array<{ playerId: number; targetId: number | null; night: number }> = [];
  for (const p of state.players) {
    if (p.role === 'guard' && p.privateMemory.guardLastTargetId !== null) {
      guardHistory.push({ playerId: p.id, targetId: p.privateMemory.guardLastTargetId, night: state.round });
    }
  }

  // 女巫记录
  const witchHistory: Array<{ playerId: number; savedId: number | null; poisonedId: number | null }> = [];
  for (const p of state.players) {
    if (p.role === 'witch') {
      witchHistory.push({
        playerId: p.id,
        savedId: p.privateMemory.witchSavedId,
        poisonedId: p.privateMemory.witchPoisonedId,
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

/* ═══════════════════════════════════════════════════════════════════
   系统 Prompt 构建器(夜晚 + 白天讨论 + 投票)
   ═══════════════════════════════════════════════════════════════════ */

function buildNightPrompt(actor: Player, state: GameState, lang: 'zh' | 'en'): string {
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
  // 跳过:预言家本人、正在悍跳的狼(它们的"立场"是表演,不需要真正站边)
  const needStance = seerClaimed && !actorIsClaimer && actor.role !== 'seer';

  // ─────────────────────────────────────────────
  // 1) 角色专属"必须/禁止"块(放最顶部,让 LLM 先看)
  // ─────────────────────────────────────────────
  let roleBlock = '';
  let outputFormat = '';
  let suggestedTemp: number | undefined = undefined;

  if (actor.role === 'seer') {
    // P1-#22 修复(用户反馈:预言家不上警不报查验,都说套话):
    // 关键:seer 永远在 seer 块里,**不**依赖 seerChecks.length
    // 之前用 `actor.role === 'seer' && seerChecks.length` 当 gate,
    //   → seer 没 checks 时会 fall through 到村民块,prompt 撒谎说"你是村民"
    if (actor.privateMemory.seerChecks.length) {
      const checks = actor.privateMemory.seerChecks.map(c => `${c.targetId + 1}号 → ${c.isWolf ? '狼' : '好人'}`).join('、');
      roleBlock = isZh
        ? `【你的身份:预言家 🔮】\n你的查验结果(必须公开报给好人阵营):${checks}\n\n你是好人阵营的核心情报源。如果不报查验,好人无法利用你的信息,等于浪费预言家。`
        : `【Your role: Seer 🔮】\nYour checks (you MUST announce to the village): ${checks}\n\nYou are the village's main info source. Without announcing, your info is wasted.`;
    } else {
      roleBlock = isZh
        ? `【你的身份:预言家 🔮】\n你暂时还没查验(异常情况,首夜应该有 1 个查验)。\n仍然要明确报"我是预言家",引导好人阵营。`
        : `【Your role: Seer 🔮】\nNo checks yet (unusual). Still claim "I am the Seer" and lead the good team.`;
    }
    outputFormat = isZh
      ? `【输出格式 - 硬性约束,违反 = 发言无效】\n第 1 句(必含):"我是预言家"\n第 2 句(必含查验):"昨晚/前 N 晚我验了 X 号,他是 [狼/好人]"\n第 3 句起:30-80 字分析(谁可疑 / 该投谁 / 回应别人)\n\n不要 JSON 包装。不要解释,直接给发言。如果不知道"该说什么",哪怕只重复"我是预言家,昨晚验了 X 号是狼/好人"也行,不要输出空话。`
      : `【Output format - HARD constraint】\nSentence 1: "I am the Seer"\nSentence 2 (MUST include a check): "Last night I checked #X, he is [wolf/good]"\nThen 30-80 words analysis.\n\nNo JSON. No preamble. If unsure, just repeat "I am the Seer, I checked #X he is wolf/good".`;
    suggestedTemp = 0.3;
  } else if (actor.faction === 'wolf' && actor.privateMemory.wolfTeammates.length) {
    // P0-#47 狼人悍跳策略(可选项)
    const mates = actor.privateMemory.wolfTeammates.map(id => `${state.players[id].name}`).join('、');
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
    outputFormat = isZh
      ? `【输出格式】\n30-100 字口语发言。如果选择报身份,必须明确说"我是女巫"开头。`
      : `【Output format】\n30-100 words casual speech. If claiming, MUST start with "I am the Witch".`;
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
  // 之前发言(今天 + 昨天)
  const todayStart = state.speeches.findIndex(s => s.day === state.round);
  const recentSpeeches = state.speeches.slice(Math.max(0, todayStart - 8), todayStart);
  if (recentSpeeches.length > 0) {
    const lines = recentSpeeches.slice(-6).map(sp => {
      const p = state.players[sp.playerId];
      if (!p || !p.alive) return null;
      return `${p.id + 1}号 ${p.name}: ${sp.text.slice(0, 60)}${sp.text.length > 60 ? '…' : ''}`;
    }).filter(Boolean);
    if (lines.length) {
      contextParts.push(isZh
        ? `【近期发言摘要(供参考,不是必须回应)】\n${lines.join('\n')}`
        : `【Recent speech summary】\n${lines.join('\n')}`);
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
  // 3) 拼装
  // ─────────────────────────────────────────────
  return (isZh
    ? `${roleBlock}\n${outputFormat}${contextBlock}${stanceBlock}\n【局势】\n昨晚死亡:${dead || '无(平安夜)'}\n存活玩家:${alive}\n现在是第 ${state.round} 轮白天讨论。`
    : `${roleBlock}\n${outputFormat}${contextBlock}${stanceBlock}\n【Situation】\nLast night deaths: ${dead || 'none'}\nAlive: ${alive}\nRound ${state.round} day discussion.`)
    // 把 temperature hint 附在最后供调用方读取(解析时 grep TEMP_HINT)
    + `\n<!-- TEMP_HINT:${suggestedTemp ?? 0.9} -->`;
}

/** 解析 TEMP_HINT 注释,取出建议 temperature */
function extractTempHint(prompt: string): number {
  const m = prompt.match(/TEMP_HINT:([\d.]+)/);
  return m ? parseFloat(m[1]) : 0.9;
}

function buildVotePrompt(actor: Player, state: GameState, lang: 'zh' | 'en'): string {
  const alive = state.players.filter(x => x.alive).filter(x => x.id !== actor.id).map(x => `${x.name}`).join('、');
  let extra = '';
  if (actor.faction === 'wolf' && actor.privateMemory.wolfTeammates.length) {
    const mates = actor.privateMemory.wolfTeammates.map(id => `${state.players[id].name}`).join('、');
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

/* ═══════════════════════════════════════════════════════════════════
   狼人自爆 + 骑士决斗 + 警长指定继承人 已迁移到 engine.ts(见 imports)
   ═══════════════════════════════════════════════════════════════════ */
