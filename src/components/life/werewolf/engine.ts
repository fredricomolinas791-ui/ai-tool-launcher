/* ═══════════════════════════════════════════════════════════════════
   AI 狼人杀 —— 游戏引擎
   ─────────────────────────────────────────────────────────────
   状态机 + 行动协调 + AI 调用封装(纯模块,无 React 依赖)
   AI 调用通过 fetch 流式从 localStorage 拿 key/baseURL/model
   ═══════════════════════════════════════════════════════════════════ */

import {
  ROLES, BOARDS, BOARD_LIST, type RoleId, type Faction, type Phase, type Personality,
  type BoardId, pickPersonality,
} from './data';

/* ─────────────────────────────────────────────
   状态类型
   ───────────────────────────────────────────── */

export interface Player {
  id: number;                 // 座位号 0-based
  name: string;
  isUser: boolean;
  role: RoleId;
  faction: Faction;
  personality: Personality;
  alive: boolean;
  /** 该玩家看到的"私密信息"(如验人结果、队友身份) */
  privateMemory: PrivateMemory;
}

export interface PrivateMemory {
  /** 狼人知道的队友 ID 列表 */
  wolfTeammates: number[];
  /** 预言家验过的 [{target, isWolf}] */
  seerChecks: { targetId: number; isWolf: boolean }[];
  /** 女巫是否用过解药/毒药 */
  witchAntidoteUsed: boolean;
  witchPoisonUsed: boolean;
  /** 女巫救过/毒过的人 */
  witchSavedId: number | null;
  witchPoisonedId: number | null;
  /** 守卫守过的人(最近一夜的) */
  guardLastTargetId: number | null;
  /** 守卫已守过的人(本局,用于「不可连守」) */
  guardHistory: number[];
  /** 丘比特连的情侣 */
  cupidLinkedIds: [number, number] | null;
  /** 石像鬼查过的人 */
  gargoyleChecks: { targetId: number; isGod: boolean }[];
  /** 骑士是否已用过决斗(整局限一次) */
  knightUsed: boolean;
  /** 骑士今晚的决斗目标(白天发动) */
  knightDuelTargetId: number | null;
  /** 被投票放逐时的"狼美人"被投记录 — 谁最后投了我 */
  wolfbeautyLastVoter: number | null;
}

export interface SpeechRecord {
  playerId: number;
  day: number;          // 第几天(白天序号)
  text: string;
  isStreaming?: boolean;
}

export interface NightLog {
  day: number;          // 第几夜
  events: { kind: string; text: string }[];
}

export interface GameState {
  boardId: BoardId;
  round: number;        // 当前是第几天
  phase: Phase;
  players: Player[];
  userId: number;       // 用户的座位
  deadThisNight: number[];      // 本夜死亡的人
  deadThisDay: number | null;   // 本日被投票放逐的人
  lastVotedOut: number | null;  // 最近被放逐的人(白痴翻牌后变 null)
  winner: Faction | null;
  /** 公开事件日志(所有人都能看到的) */
  publicLog: { kind: 'speech' | 'death' | 'system'; text: string; day: number; playerId?: number }[];
  /** AI 内部记忆:每个 AI 玩家发言历史 */
  speeches: SpeechRecord[];
  /** 用户语言偏好(zh / en) */
  lang: 'zh' | 'en';
}

const defaultMemory = (): PrivateMemory => ({
  wolfTeammates: [], seerChecks: [], witchAntidoteUsed: false, witchPoisonUsed: false,
  witchSavedId: null, witchPoisonedId: null, guardLastTargetId: null, guardHistory: [],
  cupidLinkedIds: null, gargoyleChecks: [],
  knightUsed: false, knightDuelTargetId: null, wolfbeautyLastVoter: null,
});

/* ─────────────────────────────────────────────
   初始化
   ───────────────────────────────────────────── */

export function initGame(boardId: BoardId, userName: string, lang: 'zh' | 'en' = 'zh'): GameState {
  const board = BOARDS[boardId];
  // 洗牌角色
  const shuffledRoles = [...board.roles].sort(() => Math.random() - 0.5);
  // 玩家名字(用户位置随机)
  const nameObjs = generatePlayerNamesLocal(board.playerCount, userName);
  // 性格随机
  const players: Player[] = nameObjs.map((n, i) => {
    const role = shuffledRoles[i];
    return {
      id: i,
      name: n.name,
      isUser: n.isUser,
      role,
      faction: ROLES[role].faction,
      personality: pickPersonality(),
      alive: true,
      privateMemory: defaultMemory(),
    };
  });
  // 找到用户 ID
  const userId = players.find(p => p.isUser)!.id;
  // 给狼人互知
  const wolfIds = players.filter(p => p.faction === 'wolf').map(p => p.id);
  players.forEach(p => {
    if (p.faction === 'wolf') p.privateMemory.wolfTeammates = wolfIds.filter(id => id !== p.id);
  });
  return {
    boardId, round: 0, phase: 'role-reveal', players, userId,
    deadThisNight: [], deadThisDay: null, lastVotedOut: null, winner: null,
    publicLog: [], speeches: [], lang,
  };
}

function generatePlayerNamesLocal(count: number, userName: string): { name: string; isUser: boolean }[] {
  // 全部用「X号玩家」,不用真名(避免 AI 起假名露馅)
  const u = Math.floor(Math.random() * count);
  return Array.from({ length: count }, (_, i) => ({
    name: i === u ? userName : `${i + 1}号玩家`,
    isUser: i === u,
  }));
}

/* ─────────────────────────────────────────────
   AI 配置(从项目统一的 aiStore 取,XOR 加密由 aiStore 内部处理)
   ───────────────────────────────────────────── */

import { aiStore } from '../../../lib/ai';

export interface AIConfig {
  apiKey: string;
  baseURL: string;
  model: string;
}

export function loadAIConfig(): AIConfig | null {
  // 1) 优先当前激活 provider
  const active = aiStore.getActiveKey();
  if (active && active.apiKey) {
    return {
      apiKey: active.apiKey,
      baseURL: active.baseURL || 'https://api.openai.com/v1',
      model: active.model || 'gpt-4o-mini',
    };
  }
  // 2) 兜底:任意一个有 key 的 provider
  const all = aiStore.getKeys();
  for (const id of Object.keys(all)) {
    const k = all[id];
    if (k && k.apiKey) {
      return {
        apiKey: k.apiKey,
        baseURL: k.baseURL || 'https://api.openai.com/v1',
        model: k.model || 'gpt-4o-mini',
      };
    }
  }
  return null;
}

/* ─────────────────────────────────────────────
   AI 流式调用(基于 fetch + SSE)
   ───────────────────────────────────────────── */

export interface AIStreamHandle {
  abort: () => void;
  promise: Promise<string>;
}

export function callAIStream(
  cfg: AIConfig,
  systemPrompt: string,
  userPrompt: string,
  onToken: (chunk: string) => void,
): AIStreamHandle {
  const ctrl = new AbortController();
  const promise = (async () => {
    const url = `${cfg.baseURL.replace(/\/$/, '')}/chat/completions`;
    const res = await fetch(url, {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify({
        model: cfg.model,
        stream: true,
        temperature: 0.9,
        max_tokens: 400,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
    });
    if (!res.ok || !res.body) throw new Error(`AI request failed: ${res.status}`);
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let full = '';
    let buf = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop() || '';
      for (const line of lines) {
        const t = line.trim();
        if (!t.startsWith('data:')) continue;
        const data = t.slice(5).trim();
        if (data === '[DONE]') return full;
        try {
          const json = JSON.parse(data);
          const delta = json.choices?.[0]?.delta?.content;
          if (delta) {
            full += delta;
            onToken(delta);
          }
        } catch { /* 忽略解析错误 */ }
      }
    }
    return full;
  })().catch(e => { console.error('AI stream error:', e); return ''; });
  return { abort: () => ctrl.abort(), promise };
}

/* ─────────────────────────────────────────────
   简单 JSON 解析(让 AI 输出 "decision: 5" / "speech: ..." 这种)
   ───────────────────────────────────────────── */

export function parseAIDecision(text: string): { decision?: number; speech?: string } {
  const out: { decision?: number; speech?: string } = {};
  const dMatch = text.match(/decision\s*[:：]\s*(\d+)/i);
  if (dMatch) out.decision = parseInt(dMatch[1], 10) - 1; // 1-based → 0-based
  const sMatch = text.match(/speech\s*[:：]\s*([\s\S]+)$/i);
  if (sMatch) out.speech = sMatch[1].trim();
  return out;
}

/* 容错抽取:AI 经常输出 {"speech":"...","target":N} 包装,
   但 prompt 可能没要求 JSON。这里用 JSON.parse 试抽,
   抽到 speech 字段就返回。 */
export function tryJsonExtract(text: string): { speech?: string; target?: number | null } {
  // 找第一个 { ... } 块(用贪婪匹配平衡括号不靠谱,简单找最大块)
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return {};
  try {
    const obj = JSON.parse(match[0]);
    return {
      speech: typeof obj.speech === 'string' ? obj.speech : undefined,
      target: typeof obj.target === 'number' ? obj.target : (typeof obj.target === 'string' ? parseInt(obj.target, 10) : undefined),
    };
  } catch {
    return {};
  }
}

/* ─────────────────────────────────────────────
   胜负判定
   ───────────────────────────────────────────── */

export function checkWinner(state: GameState): Faction | null {
  const alive = state.players.filter(p => p.alive);
  const wolves = alive.filter(p => p.faction === 'wolf').length;
  const goods = alive.filter(p => p.faction === 'good').length;
  const thirds = alive.filter(p => p.faction === 'third').length;
  // 丘比特胜利:任意情侣阵营胜利(好人/狼人),丘比特也胜
  // 简化:第三方(丘比特)如果还活着 + (狼0 → 好人胜,或好人压倒 → 狼胜),丘比特胜
  if (wolves === 0 && thirds === 0) return 'good';
  if (wolves >= goods + thirds && thirds > 0) return 'wolf';      // 狼阵营胜(丘比特+狼)
  if (wolves >= goods + thirds && thirds === 0) return 'wolf';    // 纯狼阵营胜
  if (wolves === 0 && thirds > 0) return 'third';                  // 丘比特+好人阵营胜(丘比特随好人阵营胜)
  // 第三方独立胜利:只剩 1 个第三方 + 1 个其他
  if (thirds === 1 && alive.length === 2) {
    const t = alive.find(p => p.faction === 'third')!;
    if (t.role === 'gargoyle' || t.role === 'cupid') return 'third';
  }
  return null;
}

/* ─────────────────────────────────────────────
   情侣殉情 helper
   ── 输入:已死的人 id 列表,返回新增殉情死亡的人
   ── 规则:任一情侣死亡,另一人也死亡
   ───────────────────────────────────────────── */
export function applyLoversChain(state: GameState, newlyDead: number[]): { state: GameState; chained: number[] } {
  let s = state;
  const chained: number[] = [];
  // 找所有情侣(从任一死者的 cupidLinkedIds 字段)
  for (const deadId of newlyDead) {
    const dead = s.players[deadId];
    if (!dead) continue;
    // 找这个人的情侣
    let loverId: number | null = null;
    for (const p of s.players) {
      const linked = p.privateMemory.cupidLinkedIds;
      if (linked && linked.includes(deadId)) {
        loverId = linked.find(id => id !== deadId) ?? null;
        break;
      }
    }
    if (loverId !== null && s.players[loverId].alive && !chained.includes(loverId) && !newlyDead.includes(loverId)) {
      s = {
        ...s,
        players: s.players.map(p => p.id === loverId ? { ...p, alive: false } : p),
        publicLog: [...s.publicLog, {
          kind: 'death', day: s.round, playerId: loverId,
          text: `💘 情侣殉情:${loverId + 1}号 ${s.players[loverId].name} 跟着去了`,
        }],
      };
      chained.push(loverId);
    }
  }
  return { state: s, chained };
}

/* ─────────────────────────────────────────────
   通用"杀 N 个人" helper
   ───────────────────────────────────────────── */
export function killPlayers(state: GameState, ids: number[], reason: string, killer: string): GameState {
  const dead = ids.filter(id => state.players[id].alive);
  if (dead.length === 0) return state;
  let s: GameState = {
    ...state,
    players: state.players.map(p => dead.includes(p.id) ? { ...p, alive: false } : p),
    publicLog: [...state.publicLog, ...dead.map(id => ({
      kind: 'death' as const, day: state.round, playerId: id,
      text: `${reason} ${id + 1}号 ${state.players[id].name}`,
    }))],
  };
  // 触发情侣殉情
  const { state: s2, chained } = applyLoversChain(s, dead);
  s = s2;
  if (chained.length > 0) void killer; // 暂时 unused
  return s;
}

/* ─────────────────────────────────────────────
   暴露给上层 Game.tsx 的工具
   ───────────────────────────────────────────── */

export { ROLES, BOARDS, BOARD_LIST };
export type { RoleId, Faction, Phase, Personality, BoardId };
