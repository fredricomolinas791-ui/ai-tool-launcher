/* ═══════════════════════════════════════════════════════════════════
   AI 狼人杀 —— 主 UI
   ─────────────────────────────────────────────────────────────
   Phase 2-A: 9 人预女猎白 + 12 人狼王守卫 完整跑通
             其他 3 个 12 人板点进去显示"敬请推出"
   ═══════════════════════════════════════════════════════════════════ */

import { useState, useEffect, useRef } from 'react';
import { Drama, Sparkles, Sun, ChevronRight, Crown, AlertTriangle, Play, X, Skull, Shield, Users, Swords } from 'lucide-react';
import { Button } from '../../ui/Button';
import { useI18n } from '../../../hooks/useI18n';
import {
  BOARDS, BOARD_LIST, ROLES, type BoardId, type GameState, type Player, type RoleId,
  initGame, loadAIConfig, callAIStream, checkWinner, parseAIDecision,
} from './engine';
import type { BoardDef } from './data';
import { PersonalityRender } from './Personalities';

/* ── 哪些板子 Phase 2-A 完整跑通 ── */
const PLAYABLE_BOARDS: BoardId[] = ['p9-classic', 'p12-classic', 'p12-wolfking'];

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
   顶层组件
   ═══════════════════════════════════════════════════════════════════ */

export function WerewolfGame() {
  const { lang: iLang } = useI18n();
  const lang = (iLang === 'en' ? 'en' : 'zh') as 'zh' | 'en';
  const [phase, setPhase] = useState<'select' | 'playing'>('select');
  const [state, setState] = useState<GameState | null>(null);
  const [aiConfig, setAIConfig] = useState<ReturnType<typeof loadAIConfig>>(null);
  const [noKey, setNoKey] = useState(false);

  useEffect(() => {
    const cfg = loadAIConfig();
    setAIConfig(cfg);
    if (!cfg) setNoKey(true);
  }, []);

  if (phase === 'select' || !state) {
    return <BoardSelect lang={lang} noKey={noKey}
      onStart={(boardId) => {
        const g = initGame(boardId, lang === 'zh' ? '你' : 'You', lang);
        setState(g);
        setPhase('playing');
      }} />;
  }
  if (noKey || !aiConfig) return <NoKeyWarn lang={lang} />;
  return <GameRunner state={state} aiConfig={aiConfig} lang={lang}
    onExit={() => { setState(null); setPhase('select'); }} />;
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

function GameRunner({ state: initial, aiConfig, lang, onExit }: {
  state: GameState; aiConfig: NonNullable<ReturnType<typeof loadAIConfig>>;
  lang: 'zh' | 'en'; onExit: () => void;
}) {
  const [state, setState] = useState<GameState>(initial);
  const [streamingText, setStreamingText] = useState<{ playerId: number; text: string } | null>(null);

  const alivePlayers = state.players.filter(p => p.alive);
  const winner = checkWinner(state);

  useEffect(() => {
    if (winner) setState(s => ({ ...s, phase: 'gameover' }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [winner]);

  const aiSpeak = (playerId: number, systemPrompt: string, userPrompt: string): Promise<string> => {
    return new Promise<string>((resolve) => {
      let full = '';
      setStreamingText({ playerId, text: '' });
      const h = callAIStream(aiConfig, systemPrompt, userPrompt, (chunk: string) => {
        full += chunk;
        setStreamingText({ playerId, text: full });
      });
      h.promise.then((text: string) => {
        setStreamingText(null);
        const parsed = parseAIDecision(text);
        const speech = parsed.speech || text;
        setState(s => ({
          ...s,
          speeches: [...s.speeches, { playerId, day: s.round, text: speech }],
          publicLog: [...s.publicLog, { kind: 'speech', day: s.round, playerId, text: speech }],
        }));
        resolve(speech);
      });
    });
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
   夜晚面板 —— 分幕模式
   ── 每幕 3 阶段:睁眼字幕(2s) → 行动(用户/AI,30s 倒计时)→ 闭眼字幕(1.5s)
   ── 所有人都能看到字幕(村民 / 守卫 / 女巫 / 狼都能看,但不知道具体行动)
   ═══════════════════════════════════════════════════════════════════ */

const NIGHT_INTRO_SEC = 2.5;    // 睁眼字幕时长
const NIGHT_OUTRO_SEC = 1.5;    // 闭眼字幕时长
const NIGHT_ACTION_TIMEOUT = 35; // 行动阶段超时(秒)

function NightPanel({ state, setState, lang, aiSpeak }: {
  state: GameState; setState: (updater: (s: GameState) => GameState) => void;
  lang: 'zh' | 'en';
  aiSpeak: (playerId: number, system: string, user: string) => Promise<string>;
}) {
  // 夜晚行动队列(按 nightOrder 排序,只包含有 nightAction 的角色)
  const actions = useRef<{ role: RoleId; playerId: number }[]>([]);
  const [actionIdx, setActionIdx] = useState(0);
  const [scene, setScene] = useState<'intro' | 'action' | 'outro' | 'done'>('intro');
  const [timeLeft, setTimeLeft] = useState(NIGHT_INTRO_SEC);
  const [busy, setBusy] = useState(false);
  const timerRef = useRef<number | null>(null);

  // 初始化行动队列(当 round 变化)
  useEffect(() => {
    const aliveRoles = state.players.filter(p => p.alive && ROLES[p.role].hasNightAction);
    actions.current = aliveRoles
      .map(p => ({ role: p.role, playerId: p.id }))
      .sort((a, b) => ROLES[a.role].nightOrder - ROLES[b.role].nightOrder);
    setActionIdx(0);
    setScene('intro');
    setTimeLeft(NIGHT_INTRO_SEC);
  }, [state.round]);

  const cur = actions.current[actionIdx];

  // 倒计时管理
  useEffect(() => {
    if (timerRef.current) { window.clearInterval(timerRef.current); timerRef.current = null; }
    if (scene === 'done' || !cur) return;
    timerRef.current = window.setInterval(() => {
      setTimeLeft(t => Math.max(0, t - 0.1));
    }, 100);
    return () => { if (timerRef.current) { window.clearInterval(timerRef.current); timerRef.current = null; } };
  }, [scene, actionIdx]);

  // 阶段超时自动推进
  useEffect(() => {
    if (scene === 'intro' && timeLeft <= 0) { setScene('action'); setTimeLeft(NIGHT_ACTION_TIMEOUT); return; }
    if (scene === 'outro' && timeLeft <= 0) { advanceAction(); return; }
    if (scene === 'action' && timeLeft <= 0 && !busy) {
      // 超时:对 AI 玩家强制推进,对 用户 自动用默认(null)
      handleTimeout();
      return;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft, scene, busy]);

  function advanceAction() {
    if (actionIdx + 1 >= actions.current.length) {
      // 夜晚结束,进入白天
      setScene('done');
      setState(s => resolveNight(s, lang));
    } else {
      setActionIdx(i => i + 1);
      setScene('intro');
      setTimeLeft(NIGHT_INTRO_SEC);
    }
  }

  // AI 行动(开场:scene 进入 action 时)
  useEffect(() => {
    if (scene !== 'action' || busy || !cur) return;
    if (cur.playerId === state.userId) return; // 等用户操作
    setBusy(true);
    (async () => {
      const actor = state.players[cur.playerId];
      try {
        const target = await runAIAction(actor, state, lang, aiSpeak);
        if (target !== null) {
          setState(s => applyNightAction(s, cur.role, cur.playerId, target, lang));
        }
      } finally {
        setBusy(false);
        // 行动完毕 → outro
        setScene('outro');
        setTimeLeft(NIGHT_OUTRO_SEC);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, actionIdx]);

  function handleTimeout() {
    if (!cur) return;
    if (cur.playerId === state.userId) {
      // 用户超时:自动跳过(无目标)
      onUserAction(null);
    }
    // AI 超时:runAIAction 会自然完成(可能 null),不用管
  }

  function onUserAction(target: number | null) {
    if (!cur) return;
    setState(s => applyNightAction(s, cur.role, cur.playerId, target, lang));
    setScene('outro');
    setTimeLeft(NIGHT_OUTRO_SEC);
  }

  if (state.phase !== 'night') return null;

  // 渲染:全暗幕布,中央显示字幕 + 倒计时
  return (
    <div className="p-6 rounded-xl text-center" style={{
      background: 'rgba(0,0,0,0.6)', border: '1px solid var(--color-accent)',
      minHeight: 200, position: 'relative',
    }}>
      <div className="text-[10px] mb-2" style={{ color: 'var(--color-text-muted)' }}>
        {lang === 'zh' ? `第 ${state.round} 夜` : `Night ${state.round}`}
      </div>
      {cur && scene !== 'done' && (
        <NightSceneDisplay
          scene={scene}
          cur={cur}
          state={state}
          lang={lang}
          timeLeft={timeLeft}
          onUserAction={onUserAction}
          busy={busy}
        />
      )}
      {scene === 'done' && (
        <div className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
          {lang === 'zh' ? '🌅 天快亮了…' : '🌅 Dawn approaching…'}
        </div>
      )}
      {/* 当前行动玩家头像高亮提示(座位 UI 之外) */}
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

  // 石像鬼/丘比特 默认占位(完整版后续实现)
  return (
    <div className="text-center">
      <p className="text-xs mb-3" style={{ color: 'var(--color-text-muted)' }}>
        {lang === 'zh' ? `你(${ROLES[role].name.zh})的行动(简化版:跳过)` : `Your ${ROLES[role].name.en} action (simplified: skip)`}
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

/* 跑一个 AI 玩家的夜晚行动(返回 target id 或 null) */
async function runAIAction(
  actor: Player, state: GameState, lang: 'zh' | 'en',
  aiSpeak: (id: number, sys: string, usr: string) => Promise<string>,
): Promise<number | null> {
  const sys = buildNightPrompt(actor, state, lang);
  const usr = lang === 'zh'
    ? '请用 JSON 格式输出:{"speech":"你的发言(可选)","target":你的目标座位号(1-based,无目标填 0)}'
    : 'Output JSON: {"speech":"your speech (optional)","target":target seat (1-based, 0 if none)}';
  await aiSpeak(actor.id, sys, usr);
  // 从最近一条发言中解析 target
  const lastSp = state.speeches[state.speeches.length - 1];
  if (lastSp && lastSp.playerId === actor.id) {
    const target = parseAIDecision(lastSp.text).decision;
    if (target !== undefined && target >= 0 && target < state.players.length) {
      return target === 0 ? null : target - 1; // 0 表示无目标
    }
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
  aiSpeak: (id: number, sys: string, usr: string) => Promise<string>;
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
  aiSpeak: (id: number, sys: string, usr: string) => Promise<string>;
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
      await aiSpeak(p.id, sys, usr);
      const lastSp = state.speeches[state.speeches.length - 1];
      if (lastSp && lastSp.playerId === p.id) {
        const t = parseAIDecision(lastSp.text).decision;
        if (t !== undefined && t >= 0 && t < state.players.length && state.players[t].alive) {
          votes[p.id] = t - 1;
        } else {
          // fallback:随机投一个非自己
          const others = alivePlayers.filter(x => x.id !== p.id);
          votes[p.id] = others[Math.floor(Math.random() * others.length)].id;
        }
      }
    }
    setAiVotes(votes);
    setBusy(false);
  };

  // 汇总投票 → 放逐
  const finalize = () => {
    const tally: Record<number, number> = {};
    Object.entries({ ...aiVotes, [state.userId]: userTarget ?? -1 }).forEach(([_voterId, targetId]) => {
      const tid = targetId as number;
      if (tid === null || tid < 0) return;
      tally[tid] = (tally[tid] || 0) + 1;
    });
    // 票数最多的被投
    let maxVotes = 0, exiled: number | null = null;
    Object.entries(tally).forEach(([id, count]) => {
      if (count > maxVotes) { maxVotes = count; exiled = parseInt(id, 10); }
    });
    if (exiled === null) {
      // 没人被投(应该不会发生),跳过
      setState(s => ({ ...s, phase: 'night', round: s.round + 1 }));
      return;
    }
    setState(s => ({
      ...s,
      players: s.players.map(p => p.id === exiled ? { ...p, alive: false } : p),
      publicLog: [...s.publicLog, { kind: 'death', day: s.round, playerId: exiled!, text: `🗳️ 投票放逐:${exiled! + 1}号 ${s.players[exiled!].name} (${ROLES[s.players[exiled!].role].name[lang]})` }],
      deadThisDay: exiled,
      lastVotedOut: exiled,
      // 狼王被投 → 触发狼王带人
      phase: s.players[exiled!].role === 'wolfking' ? 'day-vote' : 'night',
      // 简化:狼王带人机制放到下次 commit
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
