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
  initGame, loadAIConfig, callAIStream, checkWinner, parseAIDecision, tryJsonExtract, applyLoversChain,
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
     target 是 1-based 座位号(0 表示无目标),由 parseAIDecision 从 AI 输出中解析。
     silent=true:不把 speech 写进公开记录(用于夜晚,避免 AI 自爆身份)
     重要:即使 prompt 没说要用 JSON 包装,AI 经常自己加 JSON。
     这里用 tryJsonExtract 把纯文本从可能的 JSON 包装里抽出来,避免显示 {"speech":"..."} 这种原始 JSON。 */
  const aiSpeak = async (playerId: number, systemPrompt: string, userPrompt: string, silent: boolean = false): Promise<{ speech: string; target: number | null }> => {
    let full = '';
    setStreamingText({ playerId, text: '' });
    const h = callAIStream(aiConfig, systemPrompt, userPrompt, (chunk: string) => {
      full += chunk;
      if (!silent) setStreamingText({ playerId, text: full });
    });
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
          {state.phase === 'sheriff-election' && <SheriffElection state={state} setState={setState} lang={lang} />}
          {state.phase === 'day-discuss' && <DayDiscuss state={state} setState={setState} lang={lang} aiSpeak={aiSpeak} />}
          {state.phase === 'day-vote' && <DayVote state={state} setState={setState} lang={lang} aiSpeak={aiSpeak} />}
          {state.phase === 'vote-results' && <VoteResults state={state} setState={setState} lang={lang} />}
          {state.phase === 'pk-speech' && <PKSpeech state={state} setState={setState} lang={lang} aiSpeak={aiSpeak} />}
          {state.phase === 'pk-vote' && <PKVote state={state} setState={setState} lang={lang} aiSpeak={aiSpeak} />}
          {state.phase === 'hunter-shoot' && <HunterShoot state={state} setState={setState} lang={lang} aiSpeak={aiSpeak} />}
          {state.phase === 'idiot-flip' && <IdiotFlip state={state} setState={setState} lang={lang} aiSpeak={aiSpeak} />}
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
  return (
    <div className="p-6 rounded-xl text-center" style={{ background: 'var(--color-card-bg)', border: '1px solid var(--color-accent)' }}>
      <div className="text-5xl mb-2">{role.emoji}</div>
      <h3 className="text-xl font-bold whitespace-pre-line" style={{ color: 'var(--color-text)' }}>
        {lang === 'zh' ? '你的身份是' : 'Your role is'}: {role.name[lang]}{extra}
      </h3>
      <p className="text-sm mt-2" style={{ color: 'var(--color-text-muted)' }}>{role.shortDesc[lang]}</p>
      <p className="text-xs mt-2 px-4" style={{ color: 'var(--color-text-muted)' }}>{role.skillHint[lang]}</p>
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
  useEffect(() => {
    const aliveRoles = state.players.filter(p => p.alive && ROLES[p.role].hasNightAction);
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

  // 通知 GameRunner 当前行动玩家 —— 关键隐私修复:
  // 只在用户本身是行动者(或用户是狼队成员,狼队内部互见)时才点亮座位
  // 平民/其他神职完全看不到行动者是谁(避免开局就分辨出狼)
  useEffect(() => {
    if (scene === 'action' && cur && isUserActor) {
      onActingChange?.(cur.playerIds);
    } else {
      onActingChange?.([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, actionIdx, cur?.playerIds, isUserActor]);

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
        // AI 行动:异步跑 runAIAction + 同步倒计时(超时强制 null 兜底)
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

    return () => {
      cancelled = true;
      timeouts.forEach(clearTimeout);
      intervals.forEach(clearInterval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, actionIdx, actions.length]);

  // 用户手动确认行动
  function onUserAction(target: number | null, extra?: { useAntidote?: boolean; poisonTarget?: number | null }) {
    if (!cur) return;
    const actorId = cur.playerIds[0];
    if (cur.role === 'witch') {
      const useAntidote = extra?.useAntidote ?? false;
      const poisonTarget = extra?.poisonTarget ?? null;
      setState(s => applyWitchAction(s, actorId, useAntidote, poisonTarget, lang));
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
  cur: { role: RoleId; playerIds: number[] };
  state: GameState; lang: 'zh' | 'en';
  timeLeft: number;
  onUserAction: (t: number | null, extra?: { useAntidote?: boolean; poisonTarget?: number | null }) => void;
  busy: boolean;
}) {
  const role = ROLES[cur.role];
  const isMe = cur.playerIds.includes(state.userId);
  const isWolfPack = cur.playerIds.length > 1;

  // 字幕
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
    // 系统告诉女巫"今晚狼人想杀的人是 X 号"
    // deadThisNight[0] 是狼队决定的目标(在狼人行动后写入,女巫此时在狼之后行动)
    const wolfTarget = state.deadThisNight[0] ?? null;
    const isFirstNight = state.round === 1;
    const selfTarget = wolfTarget === state.userId;
    // 网杀规则:首夜不能自救
    const canAntidote = !mem.witchAntidoteUsed && wolfTarget !== null && !(isFirstNight && selfTarget);
    const canPoison = !mem.witchPoisonUsed;
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
   —— 直接用 aiSpeak 返回的 target,不走 state.speeches 闭包(避免读旧 state)
   —— 女巫返回结构化决策 {useAntidote, poisonTarget},其他角色 target */
async function runAIAction(
  actor: Player, state: GameState, lang: 'zh' | 'en',
  aiSpeak: (id: number, sys: string, usr: string, silent?: boolean) => Promise<{ speech: string; target: number | null; useAntidote?: boolean }>,
): Promise<{ target: number | null; decision?: { useAntidote: boolean; poisonTarget: number | null } }> {
  // 女巫: 走专用 prompt
  if (actor.role === 'witch') {
    const wolfTarget = state.deadThisNight[0] ?? null;
    const isFirstNight = state.round === 1;
    const selfTarget = wolfTarget === actor.id;
    const mem = actor.privateMemory;
    const canAntidote = !mem.witchAntidoteUsed && !(isFirstNight && selfTarget);
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
   ── 网杀规则:首夜被狼杀自己时不能自救(round===1 && target===self)
   ── 解药救 deadThisNight[0],毒药额外杀 1 人
   ── 标记 witchPoisonedId 方便 DayAnnounce 区分「被毒杀」(猎人不能开枪) */
function applyWitchAction(s: GameState, witchId: number, useAntidote: boolean, poisonTarget: number | null, _lang: 'zh' | 'en'): GameState {
  const witch = s.players[witchId];
  if (!witch || witch.role !== 'witch') return s;
  const mem = witch.privateMemory;
  const wolfTarget = s.deadThisNight[0] ?? null;
  let newDead = [...s.deadThisNight];
  let newMem = { ...mem };

  // 解药
  if (useAntidote && !mem.witchAntidoteUsed && wolfTarget !== null) {
    const isFirstNightSelf = s.round === 1 && wolfTarget === witchId;
    if (!isFirstNightSelf) {
      newMem.witchAntidoteUsed = true;
      newMem.witchSavedId = wolfTarget;
      newDead = newDead.filter(id => id !== wolfTarget);
    }
  }

  // 毒药
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
  const deadList = Array.from(dead);
  // 标准规则:首夜死亡玩家有遗言(~1 分钟)
  // 这里把"夜间死者"放到 last-words 阶段让他们说遗言,再进 day-announce
  // 但如果 round > 1,按简化规则也可以直接 day-announce
  const newState: GameState = {
    ...s,
    players: newPlayers,
    deadThisNight: deadList,
    publicLog: [...s.publicLog, ...deadList.map(id => ({
      kind: 'death' as const, day: s.round, playerId: id,
      text: `${s.players[id].name} 在夜里倒下了`,
    }))],
    // 首夜死过人 → 进 last-words;否则直接 day-announce
    phase: deadList.length > 0 ? 'last-words' : 'day-announce',
  };
  return newState;
}

/* ═══════════════════════════════════════════════════════════════════
   白痴翻牌阶段 —— 被投票时选择翻牌免死(失去投票权)或认命
   ═══════════════════════════════════════════════════════════════════ */

function IdiotFlip({ state, setState, lang, aiSpeak }: {
  state: GameState; setState: (u: (s: GameState) => GameState) => void;
  lang: 'zh' | 'en';
  aiSpeak: (id: number, sys: string, usr: string, silent?: boolean) => Promise<{ speech: string; target: number | null }>;
}) {
  const idiotId = state.lastVotedOut;
  if (idiotId === null) {
    useEffect(() => { setState(s => ({ ...s, phase: 'night', round: s.round + 1 })); }, []);
    return null;
  }
  const idiot = state.players[idiotId];
  const isUser = idiotId === state.userId;
  const [busy, setBusy] = useState(false);
  const [aiDecided, setAiDecided] = useState(false);

  /* AI 白痴:自动翻牌(标准规则:白痴几乎总是翻牌免死) */
  useEffect(() => {
    if (isUser || aiDecided) return;
    setBusy(true);
    const sys = lang === 'zh'
      ? `你是"${idiot.name}"(第${idiotId+1}号),你被投票放逐了!作为白痴,你可以选择翻牌免死(但之后失去投票权),或认命死亡。\n\n输出 JSON:{"speech":"你的发言","target":1 表示翻牌,0 表示认命}`
      : `You are "${idiot.name}" (#${idiotId+1}), you got voted out! As idiot, you can flip card to survive (lose voting right) or die.\n\nOutput JSON: {"speech":"your speech","target":1 to flip, 0 to die}`;
    const usr = lang === 'zh'
      ? '用 JSON 输出:{"speech":"你的发言","target":1 翻牌 / 0 认命}'
      : 'Output JSON: {"speech":"your speech","target":1 flip / 0 die}';
    aiSpeak(idiotId, sys, usr, true /* silent:白痴私下翻牌 */).then(() => {
      setBusy(false);
      setAiDecided(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* 翻牌结果应用 */
  const decide = (flip: boolean) => {
    setState(s => {
      let ns: GameState;
      if (flip) {
        // 翻牌免死:白痴还活着,失去投票权,公开已翻牌
        ns = {
          ...s,
          players: s.players.map(p => p.id === idiotId
            ? { ...p, privateMemory: { ...p.privateMemory, /* idiot 已翻牌:失去投票权 */ } }
            : p),
          publicLog: [...s.publicLog, { kind: 'system', day: s.round, text: `🤪 ${s.players[idiotId].name} 翻牌免死(之后失去投票权)` }],
          lastVotedOut: null,
          phase: 'night',
          round: s.round + 1,
        };
      } else {
        // 认命死亡
        ns = {
          ...s,
          players: s.players.map(p => p.id === idiotId ? { ...p, alive: false } : p),
          publicLog: [...s.publicLog, { kind: 'death', day: s.round, playerId: idiotId, text: `🤪 ${s.players[idiotId].name} 认命了` }],
          lastVotedOut: null,
          phase: 'night',
          round: s.round + 1,
        };
        // 情侣殉情链
        const { state: afterLovers } = applyLoversChain(ns, [idiotId]);
        ns = afterLovers;
      }
      return ns;
    });
  };

  // AI 决定后:AI 自动翻牌(标准玩法)
  useEffect(() => {
    if (!isUser && aiDecided && !busy) {
      // AI 智能: 简单版 → 总翻牌免死
      decide(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiDecided, busy, isUser]);

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
   白天:死亡公布 / 讨论 / 投票
   ═══════════════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════════════
   警长竞选(只在 12 人局 + 没有警长时出现一次,第一个白天)
   ── 所有存活玩家投票选警长(可以选自己,不能弃权,简化版)
   ── 票数最多的当警长(同票随机)
   ── 警长 = 1.5 票投票权(vote 票数 = 2,普通玩家 = 1)
   ═══════════════════════════════════════════════════════════════════ */

function SheriffElection({ state, setState, lang }: {
  state: GameState; setState: (u: (s: GameState) => GameState) => void;
  lang: 'zh' | 'en';
}) {
  const alivePlayers = state.players.filter(p => p.alive);
  const [userPick, setUserPick] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [aiVotes, setAiVotes] = useState<Record<number, number>>({});

  const runVotes = async () => {
    setBusy(true);
    const votes: Record<number, number> = {};
    for (const p of alivePlayers) {
      if (p.id === state.userId) continue;
      // 随机选一个(包括自己)
      const choice = alivePlayers[Math.floor(Math.random() * alivePlayers.length)].id;
      votes[p.id] = choice;
    }
    setAiVotes(votes);
    setBusy(false);
  };

  useEffect(() => { if (Object.keys(aiVotes).length === 0) runVotes(); /* eslint-disable-next-line */ }, []);

  const finalize = () => {
    const tally: Record<number, number> = {};
    Object.values(aiVotes).forEach(t => { tally[t] = (tally[t] || 0) + 1; });
    if (userPick !== null) tally[userPick] = (tally[userPick] || 0) + 1;
    let winner: number | null = null;
    const candidates = Object.entries(tally).filter(([_, c]) => c === Math.max(...Object.values(tally)));
    if (candidates.length > 0) {
      winner = parseInt(candidates[Math.floor(Math.random() * candidates.length)][0], 10);
    }
    if (winner === null) {
      // 兜底:随机选
      winner = alivePlayers[Math.floor(Math.random() * alivePlayers.length)].id;
    }
    setState(s => ({
      ...s,
      players: s.players.map(p => p.id === winner ? { ...p, privateMemory: { ...p.privateMemory, isSheriff: true } } : p),
      publicLog: [...s.publicLog, { kind: 'system', day: s.round, text: `⭐ ${state.players[winner].name} 当选警长(拥有 1.5 票投票权)` }],
      phase: 'day-discuss',
    }));
  };

  return (
    <div className="p-4 rounded-xl" style={{ background: 'var(--color-card-bg)', border: '1px solid #facc15' }}>
      <h3 className="font-semibold mb-2 flex items-center gap-1.5 justify-center" style={{ color: '#facc15' }}>
        ⭐ {lang === 'zh' ? '警长竞选' : 'Sheriff Election'}
      </h3>
      <p className="text-xs text-center mb-3" style={{ color: 'var(--color-text-muted)' }}>
        {lang === 'zh' ? '首日警长竞选!每人选 1 个玩家(含自己),票数最多者当选(1.5 票投票权)' : 'Day 1 sheriff election! Pick 1 (incl. yourself). Most votes wins (1.5 vote power)'}
      </p>
      {busy ? (
        <p className="text-sm text-center py-3" style={{ color: 'var(--color-text-muted)' }}>{lang === 'zh' ? 'AI 玩家正在投票…' : 'AI voting…'}</p>
      ) : (
        <>
          <p className="text-xs mb-2" style={{ color: 'var(--color-text-muted)' }}>{lang === 'zh' ? '你选:' : 'You pick:'}</p>
          <div className="flex flex-wrap gap-1.5 justify-center">
            {alivePlayers.map(p => (
              <button key={p.id} onClick={() => setUserPick(p.id)}
                className="px-2 py-1 rounded text-xs"
                style={{
                  background: userPick === p.id ? '#facc15' : 'var(--color-card-bg)',
                  color: userPick === p.id ? '#000' : 'var(--color-text)',
                }}>{p.id + 1}.{p.name}{p.id === state.userId && (lang === 'zh' ? ' (你)' : ' (You)')}</button>
            ))}
          </div>
          <div className="text-center mt-3">
            <Button onClick={finalize} disabled={userPick === null}>
              {lang === 'zh' ? '确认 + 揭晓' : 'Confirm & Reveal'} <ChevronRight size={14} className="ml-1" />
            </Button>
          </div>
        </>
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
  // 12 人局第一天(没有警长时)→ 警长竞选;否则 → 讨论
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
  aiSpeak: (id: number, sys: string, usr: string, silent?: boolean) => Promise<{ speech: string; target: number | null }>;
}) {
  const hunterId = state.lastVotedOut;
  const [target, setTarget] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [aiDone, setAiDone] = useState(false);

  if (hunterId === null) {
    useEffect(() => { setState(s => ({ ...s, phase: 'night', round: s.round + 1 })); }, []);
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

  /* 用户/AI 决策后:执行开枪 */
  const fire = (chosen: number | null) => {
    if (chosen === null) {
      // 不开枪 → 直接进夜晚
      setState(s => ({ ...s, lastVotedOut: null, phase: 'night', round: s.round + 1 }));
      return;
    }
    setState(s => {
      // 死亡后还要触发情侣殉情链 + 检查其他猎人
      let ns: GameState = {
        ...s,
        players: s.players.map(p => p.id === chosen ? { ...p, alive: false } : p),
        publicLog: [...s.publicLog, { kind: 'death', day: s.round, playerId: chosen, text: `🏹 ${s.players[chosen].name} 跟着去了` }],
        lastVotedOut: null,
      };
      // 情侣殉情
      const { state: afterLovers } = applyLoversChain(ns, [chosen]);
      ns = afterLovers;
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
  aiSpeak: (id: number, sys: string, usr: string, silent?: boolean) => Promise<{ speech: string; target: number | null; useAntidote?: boolean }>;
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

  /* AI 发言:在 discussIdx 变化且不是用户时跑 */
  useEffect(() => {
    if (!cur) return;
    if (cur.id === state.userId) return; // 用户自己,等用户输入
    if (busy) return;
    setBusy(true);
    const sys = buildDayDiscussionPrompt(cur, state, lang);
    const usr = lang === 'zh'
      ? '请发言(30-100 字,口语化,像微信群聊天),带节奏、跟队友呼应'
      : 'Speak in 30-100 words, casual chat style, drive the discussion';
    aiSpeak(cur.id, sys, usr).then(() => {
      setBusy(false);
      // AI 说完,自动推进到下一位
      setTimeout(() => nextSpeaker(), 600);
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
    setState(s => ({
      ...s,
      speeches: [...s.speeches, { playerId: state.userId, day: s.round, text }],
      publicLog: [...s.publicLog, { kind: 'speech', day: s.round, playerId: state.userId, text }],
    }));
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
  aiSpeak: (id: number, sys: string, usr: string, silent?: boolean) => Promise<{ speech: string; target: number | null }>;
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
      const { target } = await aiSpeak(p.id, sys, usr, true /* silent:投票是私下的 */);
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
  // 关键逻辑:投票放逐后根据被投者角色进入不同分支
  //   白痴   → idiot-flip(免死选择)
  //   猎人   → hunter-shoot(立刻开枪)
  //   狼王   → 标记死亡,带一个陪葬,然后看是否触发猎人
  //   狼美人 → 标记死亡,带最后投票人殉情,然后看是否触发猎人
  //   普通   → 触发情侣殉情链,然后看是否触发猎人
  //   任何链式死亡后,若新人里有猎人,触发 hunter-shoot
  //   平票  → pk-speech(平票者发言)→ pk-vote(再投)→ 平安日
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
    // 票数最多的被投(警长的票算 2 票 = 1.5 票权重,简化取整)
    const tally: Record<number, number> = {};
    allVotes.forEach(v => {
      const weight = state.players[v.voterId]?.privateMemory.isSheriff ? 2 : 1;
      tally[v.targetId] = (tally[v.targetId] || 0) + weight;
    });

    // 平票检测:找最大票数 + 拿到所有 maxVotes 的玩家
    const tallyValues = Object.values(tally);
    const maxVotes = tallyValues.length > 0 ? Math.max(...tallyValues) : 0;
    const tied = Object.entries(tally)
      .filter(([_, c]) => c === maxVotes)
      .map(([id]) => parseInt(id, 10));

    if (tied.length > 1) {
      // 平票
      if (state.pkUsed) {
        // 已经 PK 过一次,再次平票 = 平安日
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
      // 第一次平票 → PK
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

    // 跳到 vote-results 阶段(用户能看到完整投票详情,再继续)
    setState(s => ({
      ...s,
      phase: 'vote-results',
      lastVoteData: { allVotes, tally, exiled },
      pkUsed: false,
      pkPlayers: null,
    }));
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
   遗言阶段 —— 夜间死亡的玩家在公布前先说遗言(首夜标准规则)
   ═══════════════════════════════════════════════════════════════════ */

function LastWords({ state, setState, lang, aiSpeak }: {
  state: GameState; setState: (u: (s: GameState) => GameState) => void;
  lang: 'zh' | 'en';
  aiSpeak: (id: number, sys: string, usr: string, silent?: boolean) => Promise<{ speech: string; target: number | null }>;
}) {
  const deadIds = [...state.deadThisNight].filter(id => state.players[id]);
  const [lwIdx, setLwIdx] = useState(0);
  const [busy, setBusy] = useState(false);
  const [userInput, setUserInput] = useState('');
  const cur = deadIds[lwIdx];
  const curPlayer = cur !== undefined ? state.players[cur] : null;
  const isUserTurn = curPlayer && curPlayer.id === state.userId && !busy;

  const next = () => {
    setUserInput('');
    if (lwIdx + 1 >= deadIds.length) {
      setState(s => ({ ...s, phase: 'day-announce' }));
      return;
    }
    setLwIdx(i => i + 1);
  };

  useEffect(() => {
    if (!curPlayer) return;
    if (curPlayer.id === state.userId) return;
    if (busy) return;
    setBusy(true);
    const sys = lang === 'zh'
      ? `你是"${curPlayer.name}"(第${curPlayer.id + 1}号),你今晚被杀了!请留遗言(30-80 字):\n- 可以留自己的身份线索(也可不)\n- 可以留怀疑对象\n- 可以感谢/指责某人\n\n只输出你的遗言。`
      : `You are "${curPlayer.name}", you died tonight. Leave last words (30-80 words). Output speech only.`;
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
    useEffect(() => { setState(s => ({ ...s, phase: 'day-announce' })); }, []);
    return null;
  }

  return (
    <div className="p-4 rounded-xl" style={{ background: 'var(--color-card-bg)', border: '1px solid #6b7280' }}>
      <h3 className="font-semibold mb-2 flex items-center gap-1.5" style={{ color: '#9ca3af' }}>
        <Skull size={16} />{lang === 'zh' ? `🕯️ 遗言阶段(${lwIdx + 1}/${deadIds.length})` : `Last Words (${lwIdx + 1}/${deadIds.length})`}
      </h3>
      <p className="text-xs text-center mb-3" style={{ color: 'var(--color-text-muted)' }}>
        {lang === 'zh' ? '夜间死者留遗言(约 1 分钟):' : 'Dead players leave last words:'}
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
    useEffect(() => { setState(s => ({ ...s, phase: 'night', round: s.round + 1 })); }, []);
    return null;
  }
  const { allVotes, tally, exiled } = data;
  const sortedTally = Object.entries(tally).sort(([, a], [, b]) => b - a);

  /* 继续到下一阶段(白痴翻牌 / 猎人开枪 / 直接进夜) */
  const proceed = () => {
    setState(s => {
      if (exiled === null) {
        return { ...s, phase: 'night', round: s.round + 1, lastVoteData: null };
      }
      const exiledRole = s.players[exiled].role;
      if (exiledRole === 'idiot') {
        return {
          ...s,
          phase: 'idiot-flip',
          lastVotedOut: exiled,
          lastVoteData: null,
          publicLog: [...s.publicLog, { kind: 'death' as const, day: s.round, playerId: exiled, text: `🗳️ ${s.players[exiled].name} 被投票放逐` }],
          deadThisDay: exiled,
        };
      }
      let newlyDead: number[] = [exiled];
      const logEntries: { kind: 'death'; day: number; playerId: number; text: string }[] = [
        { kind: 'death' as const, day: s.round, playerId: exiled, text: `🗳️ ${s.players[exiled].name} 被投票放逐` },
      ];
      if (exiledRole === 'wolfbeauty') {
        const lastVoter = [...allVotes].reverse().find(v => v.targetId === exiled);
        if (lastVoter) {
          newlyDead.push(lastVoter.voterId);
          logEntries.push({ kind: 'death' as const, day: s.round, playerId: lastVoter.voterId, text: `💋 ${s.players[lastVoter.voterId].name} 跟着去了` });
        }
      }
      if (exiledRole === 'wolfking') {
        const aliveAfter = s.players.filter(p => p.alive && p.id !== exiled);
        if (aliveAfter.length > 0) {
          const victim = aliveAfter[Math.floor(Math.random() * aliveAfter.length)].id;
          newlyDead.push(victim);
          logEntries.push({ kind: 'death' as const, day: s.round, playerId: victim, text: `👑 ${s.players[victim].name} 跟着去了` });
        }
      }
      const deadSet = new Set(newlyDead);
      let updatedPlayers = s.players.map(p => deadSet.has(p.id) ? { ...p, alive: false } : p);
      const { state: afterLovers, chained } = applyLoversChain({ ...s, players: updatedPlayers }, newlyDead);
      updatedPlayers = afterLovers.players;
      newlyDead = chained.length > 0 ? [...newlyDead, ...chained] : newlyDead;
      const hunterDead = newlyDead.find(id => s.players[id].role === 'hunter');
      if (hunterDead !== undefined) {
        return {
          ...s,
          players: updatedPlayers,
          publicLog: [...s.publicLog, ...logEntries],
          deadThisDay: exiled,
          lastVotedOut: hunterDead,
          phase: 'hunter-shoot',
          lastVoteData: null,
        };
      }
      return {
        ...s,
        players: updatedPlayers,
        publicLog: [...s.publicLog, ...logEntries],
        deadThisDay: exiled,
        lastVotedOut: exiled,
        phase: 'night',
        round: s.round + 1,
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
  aiSpeak: (id: number, sys: string, usr: string, silent?: boolean) => Promise<{ speech: string; target: number | null }>;
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
  aiSpeak: (id: number, sys: string, usr: string, silent?: boolean) => Promise<{ speech: string; target: number | null }>;
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
      const weight = state.players[v.voterId]?.privateMemory.isSheriff ? 2 : 1;
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
  return lang === 'zh'
    ? `你是"${actor.name}"(第${actor.id + 1}号),身份:${role.name.zh} ${role.emoji}\n存活玩家:${alive}${contextExtra}\n\n今晚任务:${roleActions[actor.role]?.zh ?? '执行你的角色技能'}\n\n输出 JSON:{"speech":"你的发言(30-100字)","target":目标座位号(1-based,守卫/无目标填 0)}`
    : `You are "${actor.name}" (#${actor.id + 1}), role: ${role.name.en} ${role.emoji}\nAlive: ${alive}${contextExtra}\n\nTonight: ${roleActions[actor.role]?.en ?? 'Execute your role ability'}\n\nOutput JSON: {"speech":"your speech (30-100 words)","target":target seat (1-based, 0 if none)}`;
}

function buildDayDiscussionPrompt(actor: Player, state: GameState, lang: 'zh' | 'en'): string {
  const role = ROLES[actor.role];
  const alive = state.players.filter(x => x.alive).map(x => `${x.name}`).join('、');
  const dead = state.deadThisNight.map(id => `${state.players[id].name}`).join('、');
  let extra = '';
  if (actor.faction === 'wolf' && actor.privateMemory.wolfTeammates.length) {
    const mates = actor.privateMemory.wolfTeammates.map(id => `${state.players[id].name}`).join('、');
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
   狼人自爆 + 骑士决斗 + 警长指定继承人 共享 helper
   ── 在任何白天阶段(discuss / vote / PK)都能发生
   ── 标准规则:
   · 狼自爆 → 翻牌 + 立即进夜 + 不能发言/用技能
   · 骑士决斗 → 白天发动,目标是狼→目标死,目标是好人→骑士死;整局限 1 次
   · 警长死 → 死前指定一个存活玩家继承警徽(1.5 票)
   ═══════════════════════════════════════════════════════════════════ */

/* 狼自爆:从当前 state 出发,把 wolfId 标记死亡 + 跳到夜晚(带情侣殉情链)
   返回新 state,而不是 setState(让调用方控制) */
function applyWolfSelfDestruct(s: GameState, wolfId: number, _lang: 'zh' | 'en'): GameState {
  if (s.players[wolfId].faction !== 'wolf') return s;
  // 标记狼死
  let updated = s.players.map(p => p.id === wolfId ? { ...p, alive: false } : p);
  // 情侣殉情
  const { state: afterLovers } = applyLoversChain({ ...s, players: updated }, [wolfId]);
  return {
    ...afterLovers,
    publicLog: [...afterLovers.publicLog, { kind: 'death' as const, day: s.round, playerId: wolfId, text: `💥 ${s.players[wolfId].name} 狼人自爆!立即进入夜晚` }],
    deadThisDay: wolfId,
    phase: 'night',
    round: s.round + 1,
    pkUsed: false, pkPlayers: null,
  };
}

/* 骑士决斗:对 target 发动技能
   ── target 是狼 → target 死(带情侣链)
   ── target 是好人 → 骑士死(带情侣链)
   ── 检查是否有猎人死 → 进 hunter-shoot
   ── 否则进夜晚 */
function applyKnightDuel(s: GameState, knightId: number, targetId: number, _lang: 'zh' | 'en'): GameState {
  const knight = s.players[knightId];
  const target = s.players[targetId];
  if (knight.role !== 'knight' || knight.privateMemory.knightUsed) return s;
  if (target.faction === 'wolf') {
    // 目标死
    let updated = s.players.map(p => p.id === targetId ? { ...p, alive: false } : p);
    const { state: afterLovers, chained } = applyLoversChain({ ...s, players: updated }, [targetId]);
    const logEntries = [
      { kind: 'death' as const, day: s.round, playerId: targetId, text: `⚔️ ${target.name} 被骑士决斗击杀!` },
    ];
    let newlyDead = [targetId, ...chained];
    // 检查猎人
    const hunterDead = newlyDead.find(id => s.players[id].role === 'hunter');
    return {
      ...afterLovers,
      players: afterLovers.players.map(p => p.id === knightId ? { ...p, privateMemory: { ...p.privateMemory, knightUsed: true } } : p),
      publicLog: [...afterLovers.publicLog, ...logEntries],
      lastVotedOut: hunterDead ?? null,
      phase: hunterDead !== undefined ? 'hunter-shoot' : 'night',
      round: hunterDead !== undefined ? s.round : s.round + 1,
      pkUsed: false, pkPlayers: null,
    };
  } else {
    // 骑士死
    let updated = s.players.map(p => p.id === knightId ? { ...p, alive: false } : p);
    const { state: afterLovers, chained } = applyLoversChain({ ...s, players: updated }, [knightId]);
    const newlyDead = [knightId, ...chained];
    const hunterDead = newlyDead.find(id => s.players[id].role === 'hunter');
    return {
      ...afterLovers,
      players: afterLovers.players.map(p => p.id === knightId ? { ...p, privateMemory: { ...p.privateMemory, knightUsed: true } } : p),
      publicLog: [...afterLovers.publicLog, { kind: 'death' as const, day: s.round, playerId: knightId, text: `⚔️ ${knight.name} 决斗失败!对方是好人,骑士自尽` }],
      lastVotedOut: hunterDead ?? null,
      phase: hunterDead !== undefined ? 'hunter-shoot' : 'night',
      round: hunterDead !== undefined ? s.round : s.round + 1,
      pkUsed: false, pkPlayers: null,
    };
  }
}

/* 警长指定继承人:把 isSheriff 转移给 targetId
   ── 暂时没接入(需要在每个警长死亡的 flow 后调用,做 sheriff-succession phase)
   ── 这里只保留作为 helper 备查 */
void (function _applySheriffSuccessionDoc(s: GameState, targetId: number, _lang: 'zh' | 'en'): GameState {
  return {
    ...s,
    players: s.players.map(p => p.id === targetId ? { ...p, privateMemory: { ...p.privateMemory, isSheriff: true } } : p),
    publicLog: [...s.publicLog, { kind: 'system' as const, day: s.round, text: `⭐ ${s.players[targetId].name} 继承警长(1.5 票投票权)` }],
  };
});
