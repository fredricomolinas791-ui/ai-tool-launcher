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
  /** 预言家验过的 [{target, isWolf}],按时间顺序追加 */
  seerChecks: { targetId: number; isWolf: boolean; night: number }[];
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
  gargoyleChecks: { targetId: number; isGod: boolean; night: number }[];
  /** 骑士是否已用过决斗(整局限一次) */
  knightUsed: boolean;
  /** 骑士今晚的决斗目标(白天发动) */
  knightDuelTargetId: number | null;
  /** 被投票放逐时的"狼美人"被投记录 — 谁最后投了我 */
  wolfbeautyLastVoter: number | null;
  /** 是否是警长(12 人局首日竞选产生) */
  isSheriff: boolean;
  /** 白痴是否已翻牌免死(翻牌后失去投票权) */
  idiotFlipped: boolean;
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
  /** PK 阶段:被 PK 的玩家 id 列表(平票时) */
  pkPlayers: number[] | null;
  /** 上一轮投票是否已 PK 过(再次平票 = 平安日) */
  pkUsed: boolean;
  /** 最近一次投票的完整数据(用于 vote-results 阶段展示) */
  lastVoteData: {
    allVotes: { voterId: number; targetId: number }[];
    tally: Record<number, number>;
    exiled: number | null;
    tied?: boolean;
  } | null;
  winner: Faction | null;
  /** 公开事件日志(所有人都能看到的) */
  publicLog: { kind: 'speech' | 'death' | 'system'; text: string; day: number; playerId?: number }[];
  /** AI 内部记忆:每个 AI 玩家发言历史 */
  speeches: SpeechRecord[];
  /** 用户语言偏好(zh / en) */
  lang: 'zh' | 'en';
  /** 警长竞选状态(12 人局第一个白天) */
  sheriffElection?: {
    /** 已报名参与警长竞选的玩家 ID 列表(发言顺序) */
    registeredIds: number[];
    /** 已退水的玩家 ID 列表 */
    withdrawnIds: number[];
    /** PK 轮数(0 = 首次投票,1+ = 平票后再投) */
    pkRound: number;
    /** 发言序号(用于按顺序播报) */
    speechIdx: number;
  };
  /**
   * 警长上警后选的发言顺序(影响白天讨论顺序)
   *  - direction: 'cw' = 顺时针,'ccw' = 逆时针
   *  - startFromDeathId: 仅当「上一夜只死 1 人」时有效(从该死者左/右侧开始)
   *    当 0 人或 2+ 人死亡时,该字段为 null,以警长本人为锚点
   * 首日警长竞选结束后会进入「sheriff-pick-order」阶段让警长选;
   * 之后每天都用这个顺序(若警长一直没变,顺序也一直有效)。
   */
  sheriffSpeechOrder?: {
    direction: 'cw' | 'ccw';
    startFromDeathId: number | null;
  };
  /**
   * 警长归票目标(白天投票环节,警长公开归票 1 人 → 警长自己那票 = 1.5)
   * null = 未归票,weight = 1
   * 任意 number = 归票了该玩家(weight = 1.5 票)
   * 注:每轮投票后清空(下一天可重新归票)
   */
  sheriffEndorsement: number | null;
  /**
   * 待发言的遗言队列(标准规则:仅首夜+白天死亡的玩家有遗言,按死亡顺序)
   *  - 夜间:仅首夜(s.round === 1)有遗言
   *  - 白天:被放逐/被技能致死的玩家有遗言(按死亡先后顺序)
   *  - 数组顺序就是发言顺序,清空时表示这一批遗言都讲完了
   */
  pendingLastWords: number[];
  /**
   * 狼队本夜投票(每只狼的目标)。NightPanel 在狼队回合收集所有狼的 aiSpeak.target,
   * 然后用 aggregateWolfVotes 决定最终击杀目标。
   *  - number[] 每个狼投票的玩家 ID(1-based→0-based 已转换)
   *  - 投票结束后由 resolveNight / applyNightAction 处理
   */
  wolfVotes: number[];
}

const defaultMemory = (): PrivateMemory => ({
  wolfTeammates: [], seerChecks: [], witchAntidoteUsed: false, witchPoisonUsed: false,
  witchSavedId: null, witchPoisonedId: null, guardLastTargetId: null, guardHistory: [],
  cupidLinkedIds: null, gargoyleChecks: [],
  knightUsed: false, knightDuelTargetId: null, wolfbeautyLastVoter: null,
  isSheriff: false, idiotFlipped: false,
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
    deadThisNight: [], deadThisDay: null, lastVotedOut: null,
    pkPlayers: null, pkUsed: false, lastVoteData: null,
    winner: null,
    publicLog: [], speeches: [], lang,
    sheriffEndorsement: null,
    pendingLastWords: [],
    wolfVotes: [],
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
export function tryJsonExtract(text: string): { speech?: string; target?: number | null; useAntidote?: boolean } {
  // 找第一个 { ... } 块(用贪婪匹配平衡括号不靠谱,简单找最大块)
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return {};
  try {
    const obj = JSON.parse(match[0]);
    return {
      speech: typeof obj.speech === 'string' ? obj.speech : undefined,
      target: typeof obj.target === 'number' ? obj.target : (typeof obj.target === 'string' ? parseInt(obj.target, 10) : undefined),
      useAntidote: typeof obj.useAntidote === 'boolean' ? obj.useAntidote : undefined,
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
   是否能投票(标准规则)
   ── 活着的玩家 + 没翻牌的白痴
   ── 警长(被放逐)死前可指定继承;helper 留好
   ───────────────────────────────────────────── */
export function canVote(player: Player): boolean {
  if (!player.alive) return false;
  if (player.privateMemory.idiotFlipped) return false;
  return true;
}

/* ─────────────────────────────────────────────
   警长票权重
   ── 警长公开「归票」1 名玩家 → 警长自己的那票 = 1.5
   ── 警长未归票 / 归票超过 1 人 → 警长那票 = 1
   ── (归票超过 1 人的实现:实际只取 endorsement 字段的 1 个值;
   ──   这里是给"已归票"状态用 1.5,其他情况 1)
   ───────────────────────────────────────────── */
export function sheriffVoteWeight(state: GameState, voterId: number): number {
  const voter = state.players[voterId];
  if (!voter || !voter.privateMemory.isSheriff) return 1;
  // 警长本人,且 endorsement 已设置(归票了 1 人) → 1.5
  if (state.sheriffEndorsement !== null) return 1.5;
  return 1;
}

/* ─────────────────────────────────────────────
   按警长选的发言顺序,计算 alivePlayers 的发言序列
   ── direction: 'cw' 顺时针,'ccw' 逆时针
   ── startFromDeathId: 非空 = 从该死者左/右开始(基于其位置)
   ─────────────────────────────────────────── */
export function orderedSpeakers(
  state: GameState,
  alivePlayers: Player[],
  direction: 'cw' | 'ccw',
  startFromDeathId: number | null,
): Player[] {
  if (alivePlayers.length === 0) return [];
  const totalSeats = state.players.length;
  // 以 id 升序作为座位顺序
  // 起点:若 startFromDeathId 有效,从该死亡位置 +1 (cw) 或 -1 (ccw) 开始
  let startId: number;
  if (startFromDeathId !== null && state.players[startFromDeathId]) {
    startId = direction === 'cw'
      ? (startFromDeathId + 1) % totalSeats
      : (startFromDeathId - 1 + totalSeats) % totalSeats;
  } else {
    // 用警长本人为锚点
    const sheriff = alivePlayers.find(p => p.privateMemory.isSheriff);
    if (!sheriff) {
      // 无警长 → 退回到座位顺序
      return [...alivePlayers].sort((a, b) => a.id - b.id);
    }
    startId = direction === 'cw'
      ? (sheriff.id + 1) % totalSeats
      : (sheriff.id - 1 + totalSeats) % totalSeats;
  }
  // 沿着方向走,收集还活着的
  const result: Player[] = [];
  const aliveSet = new Set(alivePlayers.map(p => p.id));
  let cur = startId;
  for (let i = 0; i < totalSeats; i++) {
    if (aliveSet.has(cur)) {
      result.push(state.players[cur]);
    }
    cur = direction === 'cw' ? (cur + 1) % totalSeats : (cur - 1 + totalSeats) % totalSeats;
  }
  return result;
}

/* ─────────────────────────────────────────────
   同守同救检测
   ── 标准规则:守卫+女巫解药同时作用于同一人 → 抵消,该人仍死
   ── 返回值:{ cancelled: true } 表示「抵消了」
   ── 调用方:在 resolveNight 应用守卫前,先检测这个
   ───────────────────────────────────────────── */
export function sameGuardAntidote(state: GameState, wolfTarget: number): boolean {
  const guard = state.players.find(p => p.alive && p.role === 'guard');
  if (!guard) return false;
  const witch = state.players.find(p => p.alive && p.role === 'witch');
  if (!witch) return false;
  return guard.privateMemory.guardLastTargetId === wolfTarget
      && witch.privateMemory.witchAntidoteUsed
      && witch.privateMemory.witchSavedId === wolfTarget;
}

/* ─────────────────────────────────────────────
   警长继承 —— 警长被放逐/殉情/狼杀时,在死前指定一个存活玩家继承
   ── 简化版:如果警长死亡,系统自动随机指定一个非警长玩家继承
   ── 留作 helper,正式接入需在前端做「指定继承人 UI」
   ───────────────────────────────────────────── */
export function applySheriffSuccession(s: GameState, successorId: number): GameState {
  return {
    ...s,
    players: s.players.map(p => p.id === successorId
      ? { ...p, privateMemory: { ...p.privateMemory, isSheriff: true } }
      : { ...p, privateMemory: { ...p.privateMemory, isSheriff: false } }),
    publicLog: [...s.publicLog, {
      kind: 'system' as const, day: s.round,
      text: `⭐ ${s.players[successorId].name} 继承警长(1.5 票投票权)`,
    }],
  };
}

/* ─────────────────────────────────────────────
   狼自爆(任何白天阶段都能发生)
   ── 修复:之前直接进夜晚没检查猎人;现在会先触发情侣殉情,再检测猎人
   ───────────────────────────────────────────── */
export function applyWolfSelfDestruct(s: GameState, wolfId: number, _lang: 'zh' | 'en'): GameState {
  if (s.players[wolfId].faction !== 'wolf') return s;
  // 1) 标记狼死
  let updated = s.players.map(p => p.id === wolfId ? { ...p, alive: false } : p);
  // 2) 情侣殉情
  const { state: afterLovers, chained } = applyLoversChain({ ...s, players: updated }, [wolfId]);
  updated = afterLovers.players;
  // 3) 检查是否有猎人(包括殉情带走的)
  const newlyDead = [wolfId, ...chained];
  const hunterDead = newlyDead.find(id => s.players[id].role === 'hunter');
  return {
    ...afterLovers,
    players: updated,
    publicLog: [...afterLovers.publicLog, {
      kind: 'death' as const, day: s.round, playerId: wolfId,
      text: `💥 ${s.players[wolfId].name} 狼人自爆!立即进入夜晚`,
    }],
    deadThisDay: wolfId,
    lastVotedOut: hunterDead ?? null,
    phase: hunterDead !== undefined ? 'hunter-shoot' : 'night',
    round: hunterDead !== undefined ? s.round : s.round + 1,
    pkUsed: false, pkPlayers: null,
  };
}

/* ─────────────────────────────────────────────
   骑士决斗 —— 白天发动
   ── target 是狼 → target 死
   ── target 是好人 → knight 死
   ── 触发情侣殉情 + 猎人检测
   ───────────────────────────────────────────── */
export function applyKnightDuel(s: GameState, knightId: number, targetId: number, _lang: 'zh' | 'en'): GameState {
  const knight = s.players[knightId];
  const target = s.players[targetId];
  if (knight.role !== 'knight' || knight.privateMemory.knightUsed) return s;
  const markKnightUsed = (next: GameState): GameState => ({
    ...next,
    players: next.players.map(p => p.id === knightId
      ? { ...p, privateMemory: { ...p.privateMemory, knightUsed: true } }
      : p),
  });
  if (target.faction === 'wolf') {
    // 目标死
    let updated = s.players.map(p => p.id === targetId ? { ...p, alive: false } : p);
    const { state: afterLovers, chained } = applyLoversChain({ ...s, players: updated }, [targetId]);
    const newlyDead = [targetId, ...chained];
    const hunterDead = newlyDead.find(id => s.players[id].role === 'hunter');
    return markKnightUsed({
      ...afterLovers,
      players: afterLovers.players,
      publicLog: [...afterLovers.publicLog, {
        kind: 'death' as const, day: s.round, playerId: targetId,
        text: `⚔️ ${target.name} 被骑士决斗击杀!`,
      }],
      lastVotedOut: hunterDead ?? null,
      phase: hunterDead !== undefined ? 'hunter-shoot' : 'night',
      round: hunterDead !== undefined ? s.round : s.round + 1,
      pkUsed: false, pkPlayers: null,
    });
  } else {
    // 骑士死
    let updated = s.players.map(p => p.id === knightId ? { ...p, alive: false } : p);
    const { state: afterLovers, chained } = applyLoversChain({ ...s, players: updated }, [knightId]);
    const newlyDead = [knightId, ...chained];
    const hunterDead = newlyDead.find(id => s.players[id].role === 'hunter');
    return markKnightUsed({
      ...afterLovers,
      players: afterLovers.players,
      publicLog: [...afterLovers.publicLog, {
        kind: 'death' as const, day: s.round, playerId: knightId,
        text: `⚔️ ${knight.name} 决斗失败!对方是好人,骑士自尽`,
      }],
      lastVotedOut: hunterDead ?? null,
      phase: hunterDead !== undefined ? 'hunter-shoot' : 'night',
      round: hunterDead !== undefined ? s.round : s.round + 1,
      pkUsed: false, pkPlayers: null,
    });
  }
}

/* ─────────────────────────────────────────────
   狼队投票聚合
   ── 输入:每只狼的目标 ID 列表(可能为空)
   ── 规则:
   · 票数最多的玩家被选为击杀目标
   · 平票 → 从平票者中随机选一个
   · 全部为空(狼超时未选) → 返回 null(守卫/女巫等可挡)
   ───────────────────────────────────────────── */
export function aggregateWolfVotes(state: GameState, votes: number[]): number | null {
  const alive = new Set(state.players.filter(p => p.alive).map(p => p.id));
  // 只统计有效票(target 存活,且不是投票狼自己)
  const validVotes = votes.filter(v => alive.has(v));
  if (validVotes.length === 0) return null;
  // 计票
  const tally: Record<number, number> = {};
  validVotes.forEach(v => { tally[v] = (tally[v] || 0) + 1; });
  const maxVotes = Math.max(...Object.values(tally));
  const topCandidates = Object.entries(tally)
    .filter(([_, c]) => c === maxVotes)
    .map(([id]) => parseInt(id, 10));
  if (topCandidates.length === 1) return topCandidates[0];
  // 平票 → 随机
  return topCandidates[Math.floor(Math.random() * topCandidates.length)];
}

/* ─────────────────────────────────────────────
   暴露给上层 Game.tsx 的工具
   ───────────────────────────────────────────── */

export { ROLES, BOARDS, BOARD_LIST };
export type { RoleId, Faction, Phase, Personality, BoardId };
