/* ═══════════════════════════════════════════════════════════════════
   AI 狼人杀 —— 游戏引擎
   ─────────────────────────────────────────────────────────────
   状态机 + 行动协调 + AI 调用封装(纯模块,无 React 依赖)
   AI 调用通过 fetch 流式从 localStorage 拿 key/baseURL/model
   ═══════════════════════════════════════════════════════════════════ */

import {
  ROLES, BOARDS, BOARD_LIST, type RoleId, type Faction, type Phase, type Personality,
  type BoardId,
  pickPersonality,
} from './data';

/* ═══════════════════════════════════════════════════════════════════
   状态类型
   ═══════════════════════════════════════════════════════════════════ */

export interface Player {
  id: number;                 // 座位号 0-based
  name: string;
  isUser: boolean;
  role: RoleId;
  faction: Faction;
  personality: Personality;
  alive: boolean;
  /** P30:玩家个性化头像(12 个动物 emoji 之一),initGame 时随机分配;保持到死亡 → 💀 */
  avatar: string;
  /** 该玩家看到的"私密信息"(如验人结果、队友身份) */
  privateMemory: PrivateMemory;
}

/** P30:12 个动物头像池(避开角色 emoji,不会混淆身份) */
export const PLAYER_AVATARS: string[] = [
  '🐶', '🐱', '🐰', '🐻', '🦊', '🐼',
  '🐯', '🦁', '🐮', '🐷', '🐸', '🐵',
];

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
  /** P0 修复:女巫在第几夜救/毒的(用于操作日志准确显示) */
  witchSavedAtNight: number | null;
  witchPoisonedAtNight: number | null;
  /** 守卫守过的人(最近一夜的) */
  guardLastTargetId: number | null;
  /** 守卫已守过的人(本局,用于「不可连守」) —— P1-#18 修复:用 guardLastTargetId 已足够,标记 optional 不再写入 */
  guardHistory?: number[];  // 保留以兼容旧 sessionStorage 数据,新代码不再写入
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
  /** P3-#39 修复:发言阶段(区分夜/昼/pk/last-words/sheriff-speech) */
  phase?: 'night' | 'day' | 'pk' | 'last-words' | 'sheriff-speech';
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
  /**
   * 「报查验 / 悍跳」追踪(P1-#48)
   * key = 第几天(round),value = 当天所有 claim
   */
  claims: import('./data').ClaimsByDay;
  /**
   * 狼王被投后,等待狼王选 victim (P0-#53)
   * null = 未选(或 phase 不是 wolfking-pick)
   */
  wolfkingVictim: number | null;
  /**
   * P1-#22: 用户手动标记(身份猜测,纯笔记用,不影响游戏逻辑)
   * key = 玩家 ID,value = 标记文字(如"狼""守卫""预言家""存疑")
   */
  userMarks: Record<number, string>;
  /**
   * P6-#E:每轮投票历史(累积,用于右侧栏展示投票模式 → 看阵营)
   * 数组每个元素:{round, votes, tally, exiled}
   */
  voteHistory: Array<{
    round: number;
    allVotes: { voterId: number; targetId: number }[];
    tally: Record<number, number>;
    exiled: number | null;
  }>;
  /**
   * P6-#F:警长死后,等待警长选 pass/tear
   * - null = 不需要处理(警长没死 / 已处理完)
   * - number = 死掉的警长 ID,等 next() 跳到 sheriff-succession 阶段
   */
  pendingSheriffSuccession: number | null;
  /**
   * P9:女巫最近一次用药操作(用于强制女巫在白天发言时公开身份 + 操作)
   * - savedId: 用解药救了谁(null = 没用)
   * - poisonedId: 用毒药杀了谁(null = 没用)
   * - byPlayerId: 操作的女巫 ID
   * - announced: 女巫是否已经在发言里公开过(避免重复公告)
   */
  lastWitchAction: {
    savedId: number | null;
    poisonedId: number | null;
    byPlayerId: number;
    announced: boolean;
  } | null;
  /**
   * P13:延后结算的死亡(白天第一天的夜间死亡不立刻结算,等警徽落地后才公布)
   *  - 目的:让第一天死亡的角色在警徽竞选阶段还能有游戏体验
   *  - 流程:resolveNight 在 day 1 + needSheriff 时,把死亡存这里,跳到 sheriff-election
   *  - 应用:警长竞选结束(警徽落地)时,applyDeferredDeaths 应用这些死亡
   *  - 用后清空(下一次死亡不被延后)
   */
  deferredDeaths: number[];
  /**
   * P16:全 AI 观看模式
   *  - true:开局时 userId = -1,所有玩家都是 AI,用户不参与任何行动
   *  - false:用户是其中一个玩家(默认行为)
   *  - 用户需求:"游戏开始可选择加入还是只看 AI 对局"
   */
  spectatorMode: boolean;
}

export const defaultMemory = (): PrivateMemory => ({
  wolfTeammates: [], seerChecks: [], witchAntidoteUsed: false, witchPoisonUsed: false,
  witchSavedId: null, witchPoisonedId: null,
  witchSavedAtNight: null, witchPoisonedAtNight: null,
  guardLastTargetId: null, guardHistory: [],
  cupidLinkedIds: null, gargoyleChecks: [],
  knightUsed: false, knightDuelTargetId: null, wolfbeautyLastVoter: null,
  isSheriff: false, idiotFlipped: false,
});

/* P22+:sanitizeState —— 给 state.players 每个 player 强制补齐 privateMemory 缺失字段
   任何引擎函数返回 state 前调用一次,保证下游访问永远拿到完整对象 */
export function sanitizeState(state: GameState): GameState {
  const def = defaultMemory();
  return {
    ...state,
    players: state.players.map(p => {
      if (!p.privateMemory) return { ...p, privateMemory: { ...def } };
      const merged = { ...def, ...p.privateMemory };
      if (!Array.isArray(merged.wolfTeammates)) merged.wolfTeammates = [];
      if (!Array.isArray(merged.seerChecks)) merged.seerChecks = [];
      if (!Array.isArray(merged.guardHistory)) merged.guardHistory = [];
      if (!Array.isArray(merged.gargoyleChecks)) merged.gargoyleChecks = [];
      return { ...p, privateMemory: merged };
    }),
  };
}

/* ─────────────────────────────────────────────
   初始化
   ───────────────────────────────────────────── */

export function initGame(boardId: BoardId, userName: string, lang: 'zh' | 'en' = 'zh', spectatorMode: boolean = false): GameState {
  const board = BOARDS[boardId];
  // 洗牌角色
  const shuffledRoles = [...board.roles].sort(() => Math.random() - 0.5);
  // 玩家名字(用户位置随机);观看模式下没有真人,全是 AI
  const nameObjs = generatePlayerNamesLocal(board.playerCount, spectatorMode ? '' : userName);
  // P30:给每个玩家随机分配一个动物头像(避免重复出现,12 人以内用 shuffle 前 N 个)
  const avatarPool = [...PLAYER_AVATARS].sort(() => Math.random() - 0.5);
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
      avatar: avatarPool[i % avatarPool.length],  // P30:每个人一个头像,死亡前不变
      privateMemory: defaultMemory(),
    };
  });
  // 找到用户 ID(观看模式下 userId 为 -1,表示无真人)
  const userId = spectatorMode ? -1 : players.find(p => p.isUser)!.id;
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
    claims: {},
    wolfkingVictim: null,
    userMarks: {},
    voteHistory: [],
    pendingSheriffSuccession: null,
    lastWitchAction: null,
    deferredDeaths: [],
    spectatorMode,  // P16:全 AI 对局观看模式(true = 用户不参与,纯观看)
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
  options?: { temperature?: number; maxTokens?: number },
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
        // 默认 0.9(讨论/演讲场景);神职报身份场景会传 0.3
        temperature: options?.temperature ?? 0.9,
        max_tokens: options?.maxTokens ?? 400,
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

/* ═══════════════════════════════════════════════════════════════════
   简单 JSON 解析(让 AI 输出 "decision: 5" / "speech: ..." 这种)
   ═══════════════════════════════════════════════════════════════════ */

/* P0-#4 修复:decision 字段保持 1-based,不要在这里 -1。
   调用方负责 1-based → 0-based 转换,且 0 表示「无目标」 */
export function parseAIDecision(text: string): { decision?: number; speech?: string } {
  const out: { decision?: number; speech?: string } = {};
  const dMatch = text.match(/decision\s*[:：]\s*(\d+)/i);
  if (dMatch) out.decision = parseInt(dMatch[1], 10); // 保持 1-based(0 = 无目标)
  const sMatch = text.match(/speech\s*[:：]\s*([\s\S]+)$/i);
  if (sMatch) out.speech = sMatch[1].trim();
  return out;
}

/* 容错抽取:AI 经常输出 {"speech":"...","target":N} 包装,
   但 prompt 可能没要求 JSON。这里用 JSON.parse 试抽,
   抽到 speech 字段就返回。
   target 保持 1-based(0 = 无目标),由调用方转换 */
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

/* 1-based (1...N) / 0-based (0 = 无) → 0-based 转换 helper
   decision === 0 视为「无目标」返回 null (P0-#4 修复核心) */
export function parseAIDecisionToTargetId(decision: number | undefined, totalPlayers: number): number | null {
  if (decision === undefined) return null;
  if (decision === 0) return null;  // 0 显式无目标
  const t = decision - 1;  // 1-based → 0-based
  if (t < 0 || t >= totalPlayers) return null;  // 越界也视为无目标
  return t;
}

/* ═══════════════════════════════════════════════════════════════════
   胜负判定 (P0-#51 修复)
   ── 用户口径规则:
   ── 1) 狼人全部死亡 → 好人胜利(无论神/民/第三方剩余多少)
   ── 2) 只要有狼存活 + (神职全部死亡 OR 平民全部死亡) → 狼人胜利
   ── 3) 第三方独立胜利:石像鬼只剩自己+1玩家时,或丘比特任一情侣阵营胜
   ═══════════════════════════════════════════════════════════════════ */
export function checkWinner(state: GameState): Faction | null {
  const alive = state.players.filter(p => p.alive);
  const wolves = alive.filter(p => p.faction === 'wolf');
  const gods = alive.filter(p => p.faction === 'good' && ROLES[p.role].isGod);
  const villagers = alive.filter(p => p.faction === 'good' && !ROLES[p.role].isGod);
  const thirds = alive.filter(p => p.faction === 'third');

  const wolfCount = wolves.length;
  const godCount = gods.length;
  const villagerCount = villagers.length;
  const thirdCount = thirds.length;

  // ── 规则 1: 狼人全灭 → 好人胜(包含丘比特"随好人阵营胜"的情况) ──
  if (wolfCount === 0) {
    // 第三方(cupid/gargoyle)如果有,根据其特殊条件处理
    if (thirdCount === 0) return 'good';
    if (thirds[0].role === 'gargoyle') {
      // 石像鬼:只剩自己+1玩家时石像鬼胜
      if (alive.length === 2 && thirdCount === 1) return 'third';
    }
    if (thirds[0].role === 'cupid') {
      // 丘比特:任意情侣阵营胜时,丘比特也胜;此时狼全灭+丘比特活 = 好人+丘比特双胜
      // 显示为 'good'(主导阵营),但 'third' 也胜(同画面显示)
      return 'good';
    }
    return 'good';
  }

  // ── 规则 2: 狼存活 + (神全灭 OR 民全灭) → 狼胜 ──
  if (godCount === 0 || villagerCount === 0) {
    // 丘比特随狼阵营胜(同 good 一样处理:主导阵营)
    return 'wolf';
  }

  // ── 规则 3: 第三方独立胜利 (cupid/gargoyle 特殊条件) ──
  // 石像鬼:只剩自己+1玩家
  if (thirdCount === 1 && alive.length === 2 && thirds[0].role === 'gargoyle') {
    return 'third';
  }
  // 丘比特:在狼胜 + 丘比特是情侣一方时(已经被规则 2 覆盖),或者
  // 丘比特+狼+0 神/0 民时由规则 2 覆盖;这里仅处理丘比特独立胜利(罕见)

  return null;  // 游戏继续
}

/* ═══════════════════════════════════════════════════════════════════
   情侣殉情 helper (P1-#13 修复:殉情人会加入 pendingLastWords)
   ═══════════════════════════════════════════════════════════════════ */
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
      // P1-#13: 殉情人加进 pendingLastWords(让 last-words 念遗言)
      s = {
        ...s,
        players: s.players.map(p => p.id === loverId ? { ...p, alive: false } : p),
        publicLog: [...s.publicLog, {
          kind: 'death', day: s.round, playerId: loverId,
          text: `💘 情侣殉情:${loverId + 1}号 ${s.players[loverId].name} 跟着去了`,
        }],
        pendingLastWords: [...(s.pendingLastWords || []), loverId],
      };
      chained.push(loverId);
    }
  }
  // P0 修复(用户反馈"守卫死后应公布守人记录"):守卫死亡时公布他最后一夜守的人
  // 让好人知道"守卫守过谁",避免信息永远埋没在 privateMemory
  for (const deadId of newlyDead) {
    const dead = s.players[deadId];
    if (!dead || dead.role !== 'guard') continue;
    const lastGuardTarget = dead.privateMemory.guardLastTargetId;
    if (lastGuardTarget !== null && lastGuardTarget !== undefined && s.players[lastGuardTarget]) {
      const targetPlayer = s.players[lastGuardTarget];
      s = {
        ...s,
        publicLog: [...s.publicLog, {
          kind: 'system' as const, day: s.round,
          text: `🛡️ 守卫 ${dead.name} 死后公布:他最后一夜守了 ${lastGuardTarget + 1}号 ${targetPlayer.name}`,
        }],
      };
    }
  }
  return { state: s, chained };
}

/* ═══════════════════════════════════════════════════════════════════
   死亡 helper —— 统一处理"死亡"必须做的事 (P0-#3 修复)
   ── 1) 标记 alive=false
   ── 2) 清除 isSheriff(警长死后不再是警长)
   ── 3) 加 publicLog
   ── 4) 触发情侣殉情
   ── 5) P6-#F:检测警长死亡 → 设置 pendingSheriffSuccession 触发传承选择
   ═══════════════════════════════════════════════════════════════════ */
export function killPlayers(state: GameState, ids: number[], reason: string, killer: string): GameState {
  const dead = ids.filter(id => state.players[id].alive);
  if (dead.length === 0) return state;
  // P6-#F:找出死亡者中谁是警长
  const deadSheriffId = dead.find(id => state.players[id].privateMemory.isSheriff) ?? null;
  let s: GameState = {
    ...state,
    pendingSheriffSuccession: deadSheriffId !== null ? deadSheriffId : state.pendingSheriffSuccession,
    players: state.players.map(p => {
      if (!dead.includes(p.id)) return p;
      // 死人:alive=false + 清 isSheriff
      return {
        ...p,
        alive: false,
        privateMemory: { ...p.privateMemory, isSheriff: false },
      };
    }),
    publicLog: [...state.publicLog, ...dead.map(id => ({
      kind: 'death' as const, day: state.round, playerId: id,
      text: `${reason} ${id + 1}号 ${state.players[id].name}`,
    }))],
  };
  // 触发情侣殉情
  const { state: s2, chained } = applyLoversChain(s, dead);
  s = s2;
  // 殉情人有猎人(罕见的殉情链带猎人)→ 这里不处理(由调用方负责 hunter-shoot 流程)
  void killer; void chained;  // 保留参数兼容旧调用
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

/* ═══════════════════════════════════════════════════════════════════
   警长票权重 (P0-#2 统一:1.5 票归票机制)
   ── 警长公开「归票」1 名玩家 → 警长自己那票 = 1.5
   ── 警长未归票 → 警长那票 = 1
   ── 警长死后 → 没人是警长,所有票 = 1
   ═══════════════════════════════════════════════════════════════════ */
export function sheriffVoteWeight(state: GameState, voterId: number): number {
  const voter = state.players[voterId];
  if (!voter || !voter.privateMemory.isSheriff) return 1;
  if (state.sheriffEndorsement !== null) return 1.5;
  return 1;
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

/* ═══════════════════════════════════════════════════════════════════
   狼自爆(任何白天阶段都能发生) (P0-#3 修复:杀人时清 isSheriff)
   P2-#D 修复:自爆走 last-words 阶段(对比 VoteResults.proceed 对被投的人加 pendingLastWords)
   之前是直接进 night,狼的"遗言"被吞,用户看不见;现在狼能留遗言(规则上更标准)
   ═══════════════════════════════════════════════════════════════════ */
export function applyWolfSelfDestruct(s: GameState, wolfId: number, _lang: 'zh' | 'en'): GameState {
  if (s.players[wolfId].faction !== 'wolf') return s;
  // 1) 标记狼死(同时清 isSheriff 标记)
  let updated = s.players.map(p => p.id === wolfId
    ? { ...p, alive: false, privateMemory: { ...p.privateMemory, isSheriff: false } }
    : p);
  // 2) 情侣殉情
  const { state: afterLovers, chained } = applyLoversChain({ ...s, players: updated }, [wolfId]);
  updated = afterLovers.players;
  // 3) 检查是否有猎人(包括殉情带走的)
  const newlyDead = [wolfId, ...chained];
  const hunterDead = newlyDead.find(id => s.players[id].role === 'hunter');
  // 注释:狼王自爆**不能**带人(主流规则:自爆的狼王不发动技能)
  // 跟"被投票放逐的狼王"不同 — 后者由 VoteResults.proceed 走 wolfking-pick 阶段
  // 这里 phase 永远不会是 'wolfking-pick',所以 WolfKingPick 组件不会被错误激活
  // lastVotedOut 字段只用作"白天有人死"标记(被 LastWords.next() 读),不会触发 wolfking-pick
  return {
    ...afterLovers,
    players: updated,
    publicLog: [...afterLovers.publicLog, {
      kind: 'system' as const, day: s.round,
      text: `💥 ${s.players[wolfId].name} 狼人自爆!立即进入夜晚`,
    }],
    deadThisDay: wolfId,
    lastVotedOut: wolfId,  // P2-#D:让狼走 last-words 阶段(自爆狼王不带人,见上面注释)
    pendingLastWords: [wolfId, ...(afterLovers.pendingLastWords ?? [])],
    // 有猎人被殉情链带走 → 先开枪;否则走 last-words(让狼留遗言)再进 night
    phase: hunterDead !== undefined ? 'hunter-shoot' : 'last-words',
    round: s.round,
    pkUsed: false, pkPlayers: null,
  };
}

/* ═══════════════════════════════════════════════════════════════════
   骑士决斗 —— 白天发动 (P0-#3 修复:杀人时清 isSheriff)
   ═══════════════════════════════════════════════════════════════════ */
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
    // 目标死(清 isSheriff)
    let updated = s.players.map(p => p.id === targetId
      ? { ...p, alive: false, privateMemory: { ...p.privateMemory, isSheriff: false } }
      : p);
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
    // 骑士死(清 isSheriff)
    let updated = s.players.map(p => p.id === knightId
      ? { ...p, alive: false, privateMemory: { ...p.privateMemory, isSheriff: false } }
      : p);
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

/* ═══════════════════════════════════════════════════════════════════
   狼队投票聚合 (P1-#10 修复:排除自投)
   ── 输入:每只狼的目标 ID 列表(顺序与狼 ID 一一对应)
   ── 规则:
   · 票数最多的玩家被选为击杀目标
   · 平票 → 从平票者中随机选一个
   · 全部为空(狼超时未选) → 返回 null(守卫/女巫等可挡)
   · P1-#10 修复:排除狼投自己(狼自投无效)
   ═══════════════════════════════════════════════════════════════════ */
export function aggregateWolfVotes(state: GameState, wolfIds: number[], votes: number[]): number | null {
  if (wolfIds.length !== votes.length) {
    // 不匹配时降级:只用 votes(旧行为)
    votes = votes.slice(0, wolfIds.length);
    while (votes.length < wolfIds.length) votes.push(0);
  }
  const alive = new Set(state.players.filter(p => p.alive).map(p => p.id));
  // P1-#10: 排除狼投自己
  const validVotes = votes.filter((v, i) => v > 0 && alive.has(v) && v !== wolfIds[i]);
  if (validVotes.length === 0) {
    // 修复(P0):所有狼都投票失败/null,兜底随机选一个非狼存活目标(防止"狼人行动但没杀人"卡死)
    const wolfIdSet = new Set(wolfIds);
    const candidates = state.players.filter(p => p.alive && !wolfIdSet.has(p.id));
    if (candidates.length === 0) return null;
    return candidates[Math.floor(Math.random() * candidates.length)].id;
  }
  // 计票
  const tally: Record<number, number> = {};
  validVotes.forEach(v => { tally[v] = (tally[v] || 0) + 1; });
  const totalValid = validVotes.length;
  const maxVotes = Math.max(...Object.values(tally));
  // 修复(P0 强化):少数服从多数 —— 严格多数(>50%)才算"狼队协商一致",否则在被选过的目标里随机
  //  - 4-0 / 3-1 / 2-0 等:严格多数 → 选 max
  //  - 2-2(4狼):2*2=4 不 > 4,无多数 → 随机
  //  - 2-1-1(4狼):2*2=4 不 > 4,无多数 → 随机
  //  - 1-1-1-1(4狼):无多数 → 随机
  if (maxVotes * 2 > totalValid) {
    return parseInt(Object.entries(tally).find(([_, c]) => c === maxVotes)![0], 10);
  }
  // 无严格多数:在所有被选过的目标里随机选一个击杀
  const allVotedTargets = Object.keys(tally).map(k => parseInt(k, 10));
  return allVotedTargets[Math.floor(Math.random() * allVotedTargets.length)];
}

/* ─────────────────────────────────────────────
   暴露给上层 Game.tsx 的工具
   ───────────────────────────────────────────── */

export { ROLES, BOARDS, BOARD_LIST };
export type { RoleId, Faction, Phase, Personality, BoardId };
