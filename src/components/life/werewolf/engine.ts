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
  const pool = ['李建国','王晓东','张丽华','陈思远','刘文博','赵子涵','黄俊豪','周婷婷','吴佳怡','徐志远',
                '孙明哲','林晓雪','何雨桐','马天宇','罗思琪','高博文','梁嘉怡','宋子轩','韩雪儿','冯子墨',
                '邓文君','蔡子昂','蒋梦琪','杜俊熙','叶思雨'];
  const sh = [...pool].sort(() => Math.random() - 0.5).slice(0, count);
  const u = Math.floor(Math.random() * count);
  return sh.map((n, i) => ({ name: i === u ? userName : n, isUser: i === u }));
}

/* ─────────────────────────────────────────────
   AI 配置(localStorage 拿)
   ───────────────────────────────────────────── */

export interface AIConfig {
  apiKey: string;
  baseURL: string;
  model: string;
}

export function loadAIConfig(): AIConfig | null {
  try {
    const raw = localStorage.getItem('ai-tools-launcher.aisettings.v1');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const k = parsed.keys || {};
    // 取第一个有 key 的 provider
    const firstProvider = Object.values(k).find((v: any) => v && v.apiKey) as any;
    if (!firstProvider) return null;
    return {
      apiKey: firstProvider.apiKey,
      baseURL: firstProvider.baseURL,
      model: firstProvider.model,
    };
  } catch { return null; }
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

/* ─────────────────────────────────────────────
   胜负判定
   ───────────────────────────────────────────── */

export function checkWinner(state: GameState): Faction | null {
  const alive = state.players.filter(p => p.alive);
  const wolves = alive.filter(p => p.faction === 'wolf').length;
  const goods = alive.filter(p => p.faction === 'good').length;
  const thirds = alive.filter(p => p.faction === 'third').length;
  if (wolves === 0 && thirds === 0) return 'good';
  if (wolves >= goods + thirds) return 'wolf';
  // 第三方独立胜利:只剩 1 个第三方 + 1 个其他
  if (thirds === 1 && alive.length === 2) {
    const t = alive.find(p => p.faction === 'third')!;
    if (t.role === 'gargoyle' || t.role === 'cupid') return 'third';
  }
  return null;
}

/* ─────────────────────────────────────────────
   暴露给上层 Game.tsx 的工具
   ───────────────────────────────────────────── */

export { ROLES, BOARDS, BOARD_LIST };
export type { RoleId, Faction, Phase, Personality, BoardId };
