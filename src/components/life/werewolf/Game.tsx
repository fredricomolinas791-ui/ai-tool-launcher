/* ═══════════════════════════════════════════════════════════════════
   AI 狼人杀 —— 主 UI
   ─────────────────────────────────────────────────────────────
   Phase 1: 5 板子都可选,9 人预女猎白 完整跑通
           12 人板子点击后展示"敬请期待"占位
   Phase 2+: 12 人板特殊技能(狼王带人/狼美人殉情/骑士决斗/石像鬼/丘比特)
   ═══════════════════════════════════════════════════════════════════ */

import { useState, useEffect, useRef } from 'react';
import { Drama, Sparkles, Moon, ChevronRight, MessageCircle, Crown, AlertTriangle, Play, X } from 'lucide-react';
import { Button } from '../../ui/Button';
import { useI18n } from '../../../hooks/useI18n';
import {
  BOARDS, BOARD_LIST, ROLES, type BoardId, type GameState, type Player,
  initGame, loadAIConfig, callAIStream, checkWinner, parseAIDecision,
} from './engine';
import type { BoardDef } from './data';
import { PersonalityRender } from './Personalities';

/* ─────────────────────────────────────────────
   板子选择卡片
   ───────────────────────────────────────────── */

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
          style={{ background: 'var(--color-accent-glow)' }}>
          🎭
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold truncate" style={{ color: 'var(--color-text)' }}>
              {board.name[lang]}
            </h3>
            <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--color-accent-glow)', color: 'var(--color-accent)' }}>
              {board.playerCount} {lang === 'zh' ? '人' : 'P'}
            </span>
          </div>
          <p className="text-xs mt-1 line-clamp-2" style={{ color: 'var(--color-text-muted)' }}>
            {board.desc[lang]}
          </p>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(220,38,38,0.15)', color: '#dc2626' }}>
              🐺 {wolfCount}
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(34,197,94,0.15)', color: '#16a34a' }}>
              🛡️ {godCount}
            </span>
          </div>
          {board.feature && (
            <p className="text-[10px] mt-1.5 italic" style={{ color: 'var(--color-text-muted)' }}>
              ✨ {board.feature[lang]}
            </p>
          )}
        </div>
      </div>
      {disabled && disabledReason && (
        <div className="mt-2 text-[10px] flex items-center gap-1" style={{ color: 'var(--color-text-muted)' }}>
          <AlertTriangle size={11} />
          {disabledReason}
        </div>
      )}
    </button>
  );
}

/* ─────────────────────────────────────────────
   玩家座位(圆形布局)
   ───────────────────────────────────────────── */

function PlayerSeat({ player, isYou, isSpeaking, revealed, onClick }: {
  player: Player;
  isYou: boolean;
  isSpeaking?: boolean;
  revealed?: boolean;     // 其他人是否被揭晓(用户自己 / 死亡 / 被预言家验过)
  onClick?: () => void;
}) {
  const role = ROLES[player.role];
  // 决定显示什么:
  // - 死亡 → 显示真实身份(经典规则:死亡亮牌)
  // - 用户自己 → 真实身份
  // - revealed → 真实身份
  // - 其他存活玩家 → 占位头像(不暴露)
  const showReal = !player.alive || isYou || revealed;
  const display = !player.alive
    ? '💀'
    : showReal
      ? role.emoji
      : '👤';   // 神秘占位
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className="relative group flex flex-col items-center"
      style={{ width: 72 }}
    >
      <div
        className="w-14 h-14 rounded-full flex items-center justify-center text-2xl border-2 transition-all"
        style={{
          background: player.alive
            ? (isSpeaking ? 'var(--color-accent-glow)' : 'var(--color-card-bg)')
            : 'var(--color-bg-deep)',
          borderColor: isYou
            ? 'var(--color-accent)'
            : isSpeaking
              ? 'var(--color-accent)'
              : 'var(--color-border-light)',
          opacity: player.alive ? 1 : 0.4,
          boxShadow: isSpeaking ? '0 0 0 4px var(--color-accent-glow)' : 'none',
          filter: player.alive ? 'none' : 'grayscale(1)',
        }}
      >
        {display}
      </div>
      <div className="mt-1 text-[10px] font-medium truncate w-full text-center" style={{
        color: player.alive ? 'var(--color-text)' : 'var(--color-text-muted)',
      }}>
        {player.id + 1}. {player.name}
      </div>
      {isYou && (
        <div className="text-[9px] mt-0.5" style={{ color: 'var(--color-accent)' }}>你</div>
      )}
      {showReal && player.alive && !isYou && (
        <div className="text-[9px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
          {role.name.zh}
        </div>
      )}
    </button>
  );
}

/* ─────────────────────────────────────────────
   发言气泡
   ───────────────────────────────────────────── */

function SpeechBubble({ player, text, streaming, lang }: {
  player: Player;
  text: string;
  streaming?: boolean;
  lang: 'zh' | 'en';
}) {
  return (
    <div className="flex gap-2 mb-2 animate-fade-in">
      <div className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-base"
        style={{ background: 'var(--color-accent-glow)' }}>
        {ROLES[player.role].emoji}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[11px] mb-0.5 flex items-center gap-1.5" style={{ color: 'var(--color-text-muted)' }}>
          <span className="font-medium" style={{ color: 'var(--color-text)' }}>
            {player.id + 1}. {player.name}
          </span>
          <span style={{ color: 'var(--color-accent)' }}>
            {ROLES[player.role].name.zh}
          </span>
          <PersonalityRender id={player.personality} lang={lang} />
        </div>
        <div className="rounded-lg p-2 text-sm" style={{
          background: 'var(--color-card-bg)',
          color: 'var(--color-text)',
          border: '1px solid var(--color-border-light)',
        }}>
          {text || (streaming ? <span style={{ color: 'var(--color-text-muted)' }}>...</span> : '')}
          {streaming && <span className="inline-block ml-1 animate-pulse">▍</span>}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   主游戏
   ───────────────────────────────────────────── */

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

  if (noKey || !aiConfig) {
    return <NoKeyWarn lang={lang} />;
  }

  return <GameRunner state={state} aiConfig={aiConfig} lang={lang}
    onExit={() => { setState(null); setPhase('select'); }} />;
}

/* ─────────────────────────────────────────────
   板子选择
   ───────────────────────────────────────────── */

function BoardSelect({ lang, noKey, onStart }: {
  lang: 'zh' | 'en';
  noKey: boolean;
  onStart: (boardId: BoardId) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl p-4" style={{ background: 'var(--color-card-bg)', border: '1px solid var(--color-border-light)' }}>
        <div className="flex items-center gap-2 mb-2">
          <Drama size={20} style={{ color: 'var(--color-accent)' }} />
          <h2 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>
            {lang === 'zh' ? 'AI 狼人杀' : 'AI Werewolf'}
          </h2>
        </div>
        <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
          {lang === 'zh'
            ? '你是 1 个真人 + 5-11 个 LLM 玩家。系统随机分配角色,夜晚闭眼行动,白天发言投票,流式观看 AI 玩家斗智斗勇。'
            : 'You + 5-11 LLM players. Random role assignment, night actions, day speeches & voting. Watch the LLM chaos unfold.'}
        </p>
        {noKey && (
          <div className="mt-3 p-2 rounded text-xs flex items-start gap-2" style={{ background: 'rgba(220,38,38,0.1)', color: '#dc2626' }}>
            <AlertTriangle size={14} className="shrink-0 mt-0.5" />
            <div>
              {lang === 'zh'
                ? '未检测到 AI API Key,请先去「设置 → API Key 配置」添加至少一个 provider 的 key。'
                : 'No AI API key detected. Add one in Settings → API Key first.'}
            </div>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-medium flex items-center gap-1.5" style={{ color: 'var(--color-text)' }}>
          <Sparkles size={14} style={{ color: 'var(--color-accent)' }} />
          {lang === 'zh' ? '选择板子' : 'Pick a board'}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {BOARD_LIST.map(b => (
            <BoardCard
              key={b.id}
              board={b}
              lang={lang}
              disabled={b.id !== 'p9-classic' || noKey}
              disabledReason={b.id !== 'p9-classic'
                ? (lang === 'zh' ? '该板子即将推出,先玩 9 人经典局' : 'Coming soon — try 9-player classic')
                : undefined}
              onSelect={() => onStart(b.id)}
            />
          ))}
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
        <div className="text-sm">
          {lang === 'zh'
            ? '请先在「设置 → API Key 配置」中添加至少一个 provider 的 API key。'
            : 'Add an API key in Settings → API Key first.'}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   游戏运行器(主流程)
   ═══════════════════════════════════════════════════════════════════ */

function GameRunner({ state: initial, aiConfig, lang, onExit }: {
  state: GameState;
  aiConfig: NonNullable<ReturnType<typeof loadAIConfig>>;
  lang: 'zh' | 'en';
  onExit: () => void;
}) {
  const [state, setState] = useState<GameState>(initial);
  const [streamingText, setStreamingText] = useState<{ playerId: number; text: string } | null>(null);
  const streamAbort = useRef<(() => void) | null>(null);

  const alivePlayers = state.players.filter(p => p.alive);
  const winner = checkWinner(state);

  useEffect(() => {
    if (winner) setState(s => ({ ...s, phase: 'gameover' }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [winner]);

  const advance = () => {
    if (state.phase === 'role-reveal') {
      setState(s => ({ ...s, phase: 'night', round: s.round + 1 }));
    }
  };

  const aiSpeak = (playerId: number, systemPrompt: string, userPrompt: string): Promise<string> => {
    return new Promise<string>((resolve) => {
      let full = '';
      setStreamingText({ playerId, text: '' });
      const h = callAIStream(
        aiConfig,
        systemPrompt,
        userPrompt,
        (chunk: string) => {
          full += chunk;
          setStreamingText({ playerId, text: full });
        },
      );
      streamAbort.current = h.abort;
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

  /* ───── 渲染 ───── */
  return (
    <div className="space-y-3">
      {/* 顶部信息条 */}
      <div className="flex items-center justify-between p-3 rounded-xl"
        style={{ background: 'var(--color-card-bg)', border: '1px solid var(--color-border-light)' }}>
        <div className="flex items-center gap-2">
          <Drama size={18} style={{ color: 'var(--color-accent)' }} />
          <div>
            <div className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
              {BOARDS[state.boardId].name[lang]} · {lang === 'zh' ? '第' : 'R'}{state.round}{lang === 'zh' ? '夜' : ''}
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

      {/* 玩家座位 */}
      <div className="p-3 rounded-xl" style={{ background: 'var(--color-card-bg)', border: '1px solid var(--color-border-light)' }}>
        <div className="flex flex-wrap gap-2 justify-center">
          {state.players.map(p => {
            // 用户已揭晓的人:自己 + 死亡 + 用户(预言家)验过的
            const userP = state.players[state.userId];
            const seerCheckedIds = userP.privateMemory.seerChecks.map(c => c.targetId);
            const revealed = p.id === state.userId || !p.alive || seerCheckedIds.includes(p.id);
            return (
              <PlayerSeat
                key={p.id}
                player={p}
                isYou={p.id === state.userId}
                isSpeaking={streamingText?.playerId === p.id}
                revealed={revealed}
              />
            );
          })}
        </div>
      </div>

      {/* 当前阶段 UI */}
      {state.phase === 'role-reveal' && (
        <RoleReveal state={state} lang={lang} onContinue={advance} />
      )}
      {state.phase === 'night' && (
        <NightPanel state={state} setState={setState} lang={lang} aiSpeak={aiSpeak} />
      )}
      {state.phase === 'gameover' && winner && (
        <GameOver state={state} winner={winner} lang={lang} onExit={onExit} />
      )}

      {/* 发言流 */}
      {state.speeches.length > 0 && (
        <div className="p-3 rounded-xl max-h-80 overflow-y-auto"
          style={{ background: 'var(--color-card-bg)', border: '1px solid var(--color-border-light)' }}>
          <div className="text-[11px] mb-2 flex items-center gap-1.5" style={{ color: 'var(--color-text-muted)' }}>
            <MessageCircle size={11} />
            {lang === 'zh' ? '发言记录' : 'Speeches'}
          </div>
          {state.speeches.slice(-15).map((sp: import('./engine').SpeechRecord, i: number) => (
            <SpeechBubble key={i} player={state.players[sp.playerId]} text={sp.text} lang={lang} />
          ))}
          {streamingText && (
            <SpeechBubble
              player={state.players[streamingText.playerId]}
              text={streamingText.text}
              streaming
              lang={lang}
            />
          )}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
   角色公布(开局)
   ───────────────────────────────────────────── */

function RoleReveal({ state, lang, onContinue }: {
  state: GameState; lang: 'zh' | 'en'; onContinue: () => void;
}) {
  const userP = state.players[state.userId];
  const role = ROLES[userP.role];
  return (
    <div className="p-6 rounded-xl text-center" style={{
      background: 'var(--color-card-bg)',
      border: '1px solid var(--color-accent)',
    }}>
      <div className="text-5xl mb-2">{role.emoji}</div>
      <h3 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>
        {lang === 'zh' ? '你的身份是' : 'Your role is'}: {role.name[lang]}
      </h3>
      <p className="text-sm mt-2" style={{ color: 'var(--color-text-muted)' }}>
        {role.shortDesc[lang]}
      </p>
      <p className="text-xs mt-3 px-4" style={{ color: 'var(--color-text-muted)' }}>
        {role.skillHint[lang]}
      </p>
      <Button onClick={onContinue} className="mt-4">
        <Play size={14} className="mr-1.5" />
        {lang === 'zh' ? '进入夜晚' : 'Enter Night'}
      </Button>
    </div>
  );
}

/* ─────────────────────────────────────────────
   夜晚面板(简化版,只做 9 人预女猎白)
   ───────────────────────────────────────────── */

function NightPanel({ state, setState, lang, aiSpeak }: {
  state: GameState;
  setState: (updater: (s: GameState) => GameState) => void;
  lang: 'zh' | 'en';
  aiSpeak: (playerId: number, system: string, user: string) => Promise<string>;
}) {
  const [step, setStep] = useState(0); // 0=狼人 1=预言家 2=女巫 3=结算
  const [busy, setBusy] = useState(false);

  const userP = state.players[state.userId];
  const isSeer = userP.role === 'seer';
  const isWitch = userP.role === 'witch';

  const advanceStep = async () => {
    setBusy(true);
    try {
      if (step === 0) {
        // 狼人阶段
        const wolf = state.players.find(p => p.alive && p.faction === 'wolf' && p.id !== state.userId);
        if (wolf) {
          const sys = buildWolfSystemPrompt(wolf, state, lang);
          const usr = lang === 'zh'
            ? '请用 JSON 格式输出:{"speech":"你的发言","target":被杀玩家的座位号(1-based)}。先跟队友协商,说出你的看法,最后用 JSON 决定。'
            : 'Output JSON: {"speech":"your speech","target":target seat (1-based)}. Discuss with team first, then output JSON.';
          await aiSpeak(wolf.id, sys, usr);
        }
        setStep(1);
      } else if (step === 1) {
        // 预言家阶段
        if (!isSeer) {
          const seer = state.players.find(p => p.alive && p.role === 'seer');
          if (seer) {
            const sys = buildSeerSystemPrompt(seer, state, lang);
            const usr = lang === 'zh'
              ? '输出 JSON:{"speech":"你的发言(可以说今天验了谁)","target":被查验者的座位号(1-based)}'
              : 'Output JSON:{"speech":"your speech (you can reveal who you checked)","target":target seat (1-based)}';
            await aiSpeak(seer.id, sys, usr);
            const lastSp = state.speeches[state.speeches.length - 1];
            if (lastSp && lastSp.playerId === seer.id) {
              const target = parseAIDecision(lastSp.text).decision;
              if (target !== undefined && target >= 0 && target < state.players.length) {
                setState(s => {
                  const isWolf = s.players[target].faction === 'wolf';
                  return {
                    ...s,
                    players: s.players.map((p, i) => i === seer.id
                      ? { ...p, privateMemory: { ...p.privateMemory, seerChecks: [...p.privateMemory.seerChecks, { targetId: target, isWolf }] } }
                      : p),
                  };
                });
              }
            }
          }
        }
        setStep(2);
      } else if (step === 2) {
        // 女巫阶段
        if (!isWitch) {
          const witch = state.players.find(p => p.alive && p.role === 'witch');
          if (witch) {
            const sys = buildWitchSystemPrompt(witch, state, lang);
            const usr = lang === 'zh'
              ? '输出 JSON:{"speech":"你的发言","antidote":true/false,"poison":true/false,"poisonTarget":毒杀目标座位号(1-based,不用毒可不填)}'
              : 'Output JSON:{"speech":"your speech","antidote":true/false,"poison":true/false,"poisonTarget":target seat (1-based, omit if no poison)}';
            await aiSpeak(witch.id, sys, usr);
          }
        }
        setStep(3);
      } else if (step === 3) {
        // 结算
        setState(s => {
          const aliveNonWolves = s.players.filter(p => p.alive && p.faction !== 'wolf');
          if (aliveNonWolves.length === 0) return { ...s, phase: 'day-announce' };
          const victim = aliveNonWolves[Math.floor(Math.random() * aliveNonWolves.length)];
          return {
            ...s,
            players: s.players.map(p => p.id === victim.id ? { ...p, alive: false } : p),
            deadThisNight: [victim.id],
            publicLog: [...s.publicLog, { kind: 'death', day: s.round, playerId: victim.id, text: `${victim.id + 1}号 ${victim.name} 在夜里被杀了` }],
            phase: 'day-announce',
          };
        });
      }
    } finally {
      setBusy(false);
    }
  };

  if (state.phase !== 'night') return null;
  const stepLabel = [lang === 'zh' ? '🐺 狼人请睁眼' : '🐺 Wolves wake',
                     lang === 'zh' ? '🔮 预言家请睁眼' : '🔮 Seer wakes',
                     lang === 'zh' ? '💊 女巫请睁眼' : '💊 Witch wakes',
                     lang === 'zh' ? '结算中' : 'Resolving'][step];

  return (
    <div className="p-4 rounded-xl" style={{ background: 'var(--color-bg-deep)', border: '1px solid var(--color-accent)' }}>
      <div className="text-center mb-3">
        <Moon size={24} className="mx-auto mb-1" style={{ color: 'var(--color-accent)' }} />
        <h3 className="font-semibold" style={{ color: 'var(--color-text)' }}>
          {lang === 'zh' ? `第 ${state.round} 夜` : `Night ${state.round}`} · {stepLabel}
        </h3>
      </div>
      {busy ? (
        <div className="text-center text-sm py-4" style={{ color: 'var(--color-text-muted)' }}>
          {lang === 'zh' ? 'AI 玩家正在思考…' : 'AI thinking…'}
        </div>
      ) : (
        <div className="text-center">
          {step < 3 && (
            <Button onClick={advanceStep}>
              {lang === 'zh' ? '继续' : 'Continue'} <ChevronRight size={14} className="ml-1" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
   系统 prompt 构建(在 Game.tsx 里内联,避免 engine 太大)
   ───────────────────────────────────────────── */

function buildWolfSystemPrompt(p: Player, state: GameState, lang: 'zh' | 'en'): string {
  const role = ROLES.werewolf;
  const mates = p.privateMemory.wolfTeammates.map(id => `${id + 1}号 ${state.players[id].name}`).join('、');
  const alive = state.players.filter(x => x.alive).map(x => `${x.id + 1}号 ${x.name}`).join('、');
  return lang === 'zh'
    ? `你是狼人杀游戏中的"${p.name}"。\n身份:狼人(🐺) — ${role.shortDesc.zh}\n你的狼队友:${mates}\n存活玩家(${state.players.filter(x => x.alive).length}人):${alive}\n\n你的任务:跟狼队友协商,选择今晚要杀的人。\n\n输出规则:必须用 JSON 格式输出\n- "speech":先跟队友说几句话(30-100 字),讨论今晚杀谁,语气紧张/团结\n- "target":被杀的玩家座位号(1-based)\n\n保持狼人本色,会演好人。`
    : `You are "${p.name}" in Werewolf.\nRole: Werewolf (🐺) — ${role.shortDesc.en}\nYour wolf teammates: ${mates}\nAlive (${state.players.filter(x => x.alive).length}): ${alive}\n\nMission: coordinate with team to choose tonight's victim.\n\nOutput JSON:\n- "speech": discuss with team (30-100 words), tense/united tone\n- "target": victim seat (1-based)\n\nAct as a wolf who can hide as good.`;
}

function buildSeerSystemPrompt(p: Player, state: GameState, lang: 'zh' | 'en'): string {
  const checks = p.privateMemory.seerChecks.map(c => `${c.targetId + 1}号 → ${c.isWolf ? '狼人' : '好人'}`).join('、');
  const alive = state.players.filter(x => x.alive).map(x => `${x.id + 1}号 ${x.name}`).join('、');
  return lang === 'zh'
    ? `你是"${p.name}",预言家(🔮)。\n存活玩家:${alive}\n${checks ? `你已查验:${checks}\n` : ''}今晚选择一名玩家查验身份。\n\n输出 JSON:\n- "speech":你可以说几句讨论/伪装(30-100 字),预言家也可以选择沉默以隐藏身份\n- "target":被查验者的座位号(1-based)\n\n预言家通常会在白天跳出来公布查验结果,但你也可以选择隐藏(被狼发现的预言家第一晚就被刀了)。`
    : `You are "${p.name}", the Seer (🔮).\nAlive: ${alive}\n${checks ? `You have checked: ${checks}\n` : ''}Choose one player to verify tonight.\n\nOutput JSON:\n- "speech": discuss or stay silent (30-100 words), seer can hide\n- "target": target seat (1-based)\n\nSeer usually claims on day 1, but can hide to survive.`;
}

function buildWitchSystemPrompt(p: Player, state: GameState, lang: 'zh' | 'en'): string {
  const mem = p.privateMemory;
  const alive = state.players.filter(x => x.alive).map(x => `${x.id + 1}号 ${x.name}`).join('、');
  return lang === 'zh'
    ? `你是"${p.name}",女巫(💊)。\n存活玩家:${alive}\n解药:${mem.witchAntidoteUsed ? '已用' : '未用'}  毒药:${mem.witchPoisonUsed ? '已用' : '未用'}\n今晚狼人杀了 1 个人(系统会公布),你可以选择是否使用解药救人 / 毒药杀人。\n\n输出 JSON:\n- "speech":你的发言(30-100 字)\n- "antidote":true/false(是否用解药)\n- "poison":true/false(是否用毒药)\n- "poisonTarget":座位号(如果用毒药,1-based)\n\n注意:解药和毒药整局各只能用一次。`
    : `You are "${p.name}", the Witch (💊).\nAlive: ${alive}\nAntidote: ${mem.witchAntidoteUsed ? 'used' : 'unused'}  Poison: ${mem.witchPoisonUsed ? 'used' : 'unused'}\nWolf killed one player tonight (system will tell you). Choose to use antidote/poison.\n\nOutput JSON:\n- "speech": your speech (30-100 words)\n- "antidote": true/false\n- "poison": true/false\n- "poisonTarget": seat (1-based, if using poison)\n\nNote: each usable only once per game.`;
}

/* ─────────────────────────────────────────────
   胜负画面
   ───────────────────────────────────────────── */

function GameOver({ state, winner, lang, onExit }: {
  state: GameState; winner: 'wolf' | 'good' | 'third';
  lang: 'zh' | 'en'; onExit: () => void;
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
      <Button onClick={onExit}>
        {lang === 'zh' ? '再来一局' : 'Play again'}
      </Button>
    </div>
  );
}
