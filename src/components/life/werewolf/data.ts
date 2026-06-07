/* ═══════════════════════════════════════════════════════════════════
   AI 狼人杀 —— 数据层
   板子 / 角色 / 性格 / 阶段常量
   ─────────────────────────────────────────────────────────────
   设计原则:数据驱动,加新板子只需要在 BOARDS 里加一项即可,
   无需改 game engine。variant 字段用于标记特殊规则(如「黑死病」)。
   ═══════════════════════════════════════════════════════════════════ */

export type RoleId =
  | 'werewolf'    // 普通狼人
  | 'wolfking'    // 狼王(用户口语:白狼王,统一叫狼王)
  | 'wolfbeauty'  // 狼美人
  | 'villager'    // 村民
  | 'seer'        // 预言家
  | 'witch'       // 女巫
  | 'hunter'      // 猎人
  | 'guard'       // 守卫
  | 'idiot'       // 白痴
  | 'knight'      // 骑士
  | 'gargoyle'    // 石像鬼(独立阵营)
  | 'cupid';      // 丘比特(第三方)

export type Faction = 'wolf' | 'good' | 'third';
export type Phase =
  | 'setup' | 'role-reveal'
  | 'night' | 'night-resolve'
  | 'day-announce' | 'sheriff-election' | 'knight-duel' | 'day-discuss' | 'day-vote'
  | 'pk-speech' | 'pk-vote'
  | 'hunter-shoot' | 'idiot-flip' | 'last-words'
  | 'judge' | 'gameover';
export type Personality =
  | 'strategist' | 'aggressive' | 'mysterious'
  | 'loyal' | 'backstab' | 'cute';

export interface RoleDef {
  id: RoleId;
  name: { zh: string; en: string };
  faction: Faction;
  emoji: string;
  shortDesc: { zh: string; en: string };
  /** 夜间行动顺序 (越小越先) */
  nightOrder: number;
  hasNightAction: boolean;
  /** 这个角色特殊技能的简短说明(给 AI prompt 用) */
  skillHint: { zh: string; en: string };
}

export const ROLES: Record<RoleId, RoleDef> = {
  werewolf: {
    id: 'werewolf', faction: 'wolf', emoji: '🐺',
    name: { zh: '狼人', en: 'Werewolf' },
    shortDesc: { zh: '夜晚杀人,白天隐藏', en: 'Kill at night, hide by day' },
    nightOrder: 20, hasNightAction: true,
    skillHint: { zh: '每晚与狼队友协商杀一人', en: 'Each night coordinate with wolf pack to kill one player' },
  },
  wolfking: {
    id: 'wolfking', faction: 'wolf', emoji: '👑',
    name: { zh: '狼王', en: 'Wolf King' },
    shortDesc: { zh: '狼阵营主脑,被投时可带走一人', en: 'Wolf leader — when voted out, takes one victim with them' },
    nightOrder: 20, hasNightAction: true,
    skillHint: { zh: '夜晚可杀一人;白天被投票放逐时,可发动技能带走另一个人', en: 'Kills at night; when voted out, can take one player with them' },
  },
  wolfbeauty: {
    id: 'wolfbeauty', faction: 'wolf', emoji: '💋',
    name: { zh: '狼美人', en: 'Wolf Beauty' },
    shortDesc: { zh: '被投时带走最后投票的人', en: 'When voted out, takes the last voter with them' },
    nightOrder: 20, hasNightAction: true,
    skillHint: { zh: '夜晚可杀一人;白天被投票放逐时,带走最后一个给自己投票的人', en: 'Kills at night; when voted out, takes the last voter down with them' },
  },
  villager: {
    id: 'villager', faction: 'good', emoji: '👨‍🌾',
    name: { zh: '村民', en: 'Villager' },
    shortDesc: { zh: '平民,纯靠推理', en: 'Plain folk, deduction only' },
    nightOrder: 99, hasNightAction: false,
    skillHint: { zh: '没有任何技能,靠发言和投票推理', en: 'No ability — relies on speech and voting' },
  },
  seer: {
    id: 'seer', faction: 'good', emoji: '🔮',
    name: { zh: '预言家', en: 'Seer' },
    shortDesc: { zh: '每晚验一人身份', en: 'Verify one identity each night' },
    nightOrder: 30, hasNightAction: true,
    skillHint: { zh: '每晚可查验一名玩家是「好人」还是「狼人」', en: 'Each night check whether one player is good or wolf' },
  },
  witch: {
    id: 'witch', faction: 'good', emoji: '💊',
    name: { zh: '女巫', en: 'Witch' },
    shortDesc: { zh: '解药+毒药各一(网杀首夜不能自救)', en: 'One antidote, one poison (online: no self-save night 1)' },
    nightOrder: 40, hasNightAction: true,
    skillHint: { zh: '拥有 1 瓶解药(救当晚被狼杀的人)和 1 瓶毒药(杀 1 人),整局各只能用一次;网杀规则:首夜被狼杀自己时不能自救', en: 'Has 1 antidote (saves wolf victim) and 1 poison (kills someone), each usable once per game. Online rule: cannot save self on night 1' },
  },
  hunter: {
    id: 'hunter', faction: 'good', emoji: '🏹',
    name: { zh: '猎人', en: 'Hunter' },
    shortDesc: { zh: '死亡时可开枪(被女巫毒杀不能)', en: 'Shoots on death (not when witch-poisoned)' },
    nightOrder: 99, hasNightAction: false,
    skillHint: { zh: '被狼杀或被投票放逐时,可以选择开枪带走一名玩家;被女巫毒杀则不能发动', en: 'When killed by wolf or voted out, can shoot one player. Cannot shoot when poisoned by witch' },
  },
  guard: {
    id: 'guard', faction: 'good', emoji: '🛡️',
    name: { zh: '守卫', en: 'Guard' },
    shortDesc: { zh: '每晚守一人(不可连守同一人)', en: 'Guard one player (cannot guard same target two nights in a row)' },
    nightOrder: 10, hasNightAction: true,
    skillHint: { zh: '每晚守护一名玩家,被守护者当晚免疫狼杀;但不能连续两晚守同一个人', en: 'Each night guard one player — they are immune to wolf kill; cannot guard the same person two nights in a row' },
  },
  idiot: {
    id: 'idiot', faction: 'good', emoji: '🤪',
    name: { zh: '白痴', en: 'Idiot' },
    shortDesc: { zh: '被投时翻牌免死(失去投票权)', en: 'When voted out, flip card to survive (loses voting right)' },
    nightOrder: 99, hasNightAction: false,
    skillHint: { zh: '白天被投票放逐时可翻牌免死,继续存活但之后失去投票权', en: 'When voted out during day, can flip card to survive but loses voting right for the rest of the game' },
  },
  knight: {
    id: 'knight', faction: 'good', emoji: '⚔️',
    name: { zh: '骑士', en: 'Knight' },
    shortDesc: { zh: '白天可决斗一人(每局限一次)', en: 'Can duel one player during day (once per game)' },
    nightOrder: 99, hasNightAction: false,
    skillHint: { zh: '白天发言时可发动技能决斗一名玩家:对方是狼则对方死,对方是好人则自己死;整局限用一次', en: 'During day can duel one player: if they are wolf, they die; if good, the knight dies. Once per game' },
  },
  gargoyle: {
    id: 'gargoyle', faction: 'third', emoji: '🗿',
    name: { zh: '石像鬼', en: 'Gargoyle' },
    shortDesc: { zh: '独立阵营,胜利条件特殊', en: 'Independent faction, special win condition' },
    nightOrder: 40, hasNightAction: true,
    skillHint: { zh: '每晚可查验一名玩家是「神职」还是「非神职」;胜利条件:活到最后(只剩石像鬼+1 玩家时石像鬼胜)', en: 'Each night check if a player is a "god role" (seer/witch/hunter/guard/knight) or not. Win: be the last one standing (gargoyle + 1 remaining player)' },
  },
  cupid: {
    id: 'cupid', faction: 'third', emoji: '💘',
    name: { zh: '丘比特', en: 'Cupid' },
    shortDesc: { zh: '首夜连两人做情侣', en: 'First night, link two players as lovers' },
    nightOrder: 1, hasNightAction: true,
    skillHint: { zh: '第一晚选择两名玩家成为情侣(可跨阵营);任一情侣死亡,另一人也殉情。丘比特胜利条件:任意情侣阵营胜利时,丘比特也胜利', en: 'First night choose two players as lovers (any faction). When one dies, the other dies too. Cupid wins if any lover\'s faction wins' },
  },
};

export type BoardId = 'p9-classic' | 'p12-classic' | 'p12-wolfking' | 'p12-wolfbeauty' | 'p12-gargoyle' | 'p12-cupid';
export type Variant = 'standard' | 'plague' | /* future: */ 'assassin' | 'mimic';

export interface BoardDef {
  id: BoardId;
  playerCount: number;
  roles: RoleId[];
  name: { zh: string; en: string };
  desc: { zh: string; en: string };
  /** 特殊变体规则(预留:plague = 黑死病 等) */
  variant: Variant;
  /** 这个板子的核心特色(显示在板子介绍里) */
  feature: { zh: string; en: string };
}

/* ─────────────────────────────────────────────
   5 个经典板子
   ───────────────────────────────────────────── */

/** 9 人标准局 · 预女猎(无白痴,极简入门) */
const BOARD_9_CLASSIC: BoardDef = {
  id: 'p9-classic', playerCount: 9, variant: 'standard',
  name: { zh: '9 人 · 预女猎', en: '9-Player Classic' },
  desc: { zh: '狼3 + 村3 + 预言家 + 女巫 + 猎人', en: '3 wolves · 3 villagers · seer · witch · hunter' },
  feature: { zh: '极简入门板,无白痴无守卫,节奏快', en: 'Minimal starter — no idiot/guard, fast pace' },
  roles: ['werewolf', 'werewolf', 'werewolf',
          'villager', 'villager', 'villager',
          'seer', 'witch', 'hunter'],
};

/** 12 人标准局 · 预女猎白(经典预女猎白) */
const BOARD_12_CLASSIC: BoardDef = {
  id: 'p12-classic', playerCount: 12, variant: 'standard',
  name: { zh: '12 人 · 预女猎白', en: '12-Player Classic' },
  desc: { zh: '狼4 + 村4 + 预言家 + 女巫 + 猎人 + 白痴', en: '4 wolves · 4 villagers · seer · witch · hunter · idiot' },
  feature: { zh: '经典预女猎白,神职齐全,平衡度高', en: 'Classic seer+witch+hunter+idiot — balanced god roles' },
  roles: ['werewolf', 'werewolf', 'werewolf', 'werewolf',
          'villager', 'villager', 'villager', 'villager',
          'seer', 'witch', 'hunter', 'idiot'],
};

/** 12 人 · 狼王守卫局 */
const BOARD_12_WOLFKING: BoardDef = {
  id: 'p12-wolfking', playerCount: 12, variant: 'standard',
  name: { zh: '12 人 · 狼王守卫', en: '12-Player Wolf King Guard' },
  desc: { zh: '狼王 + 狼2 + 村3 + 预言家 + 女巫 + 猎人 + 守卫 + 白痴 + 村1', en: 'Wolf King · 2 wolves · 3 villagers · seer · witch · hunter · guard · idiot · villager' },
  feature: { zh: '狼阵营有「狼王」可带人,守卫能保人,逻辑链最长', en: 'Wolf King can take victims; guard protects — longest logic chain' },
  roles: ['wolfking', 'werewolf', 'werewolf',
          'villager', 'villager', 'villager',
          'seer', 'witch', 'hunter', 'guard', 'idiot', 'villager'],
};

/** 12 人 · 狼美骑士局 */
const BOARD_12_WOLFBEAUTY: BoardDef = {
  id: 'p12-wolfbeauty', playerCount: 12, variant: 'standard',
  name: { zh: '12 人 · 狼美骑士', en: '12-Player Wolf Beauty Knight' },
  desc: { zh: '狼美人 + 狼2 + 村3 + 预言家 + 女巫 + 猎人 + 骑士 + 守卫 + 白痴', en: 'Wolf Beauty · 2 wolves · 3 villagers · seer · witch · hunter · knight · guard · idiot' },
  feature: { zh: '狼美人可「殉情」,骑士可「决斗」,白天反杀机会多', en: 'Wolf Beauty can drag voter down; knight can duel — day has more counter-play' },
  roles: ['wolfbeauty', 'werewolf', 'werewolf',
          'villager', 'villager', 'villager',
          'seer', 'witch', 'hunter', 'knight', 'guard', 'idiot'],
};

/** 12 人 · 石像鬼迷雾局 */
const BOARD_12_GARGOYLE: BoardDef = {
  id: 'p12-gargoyle', playerCount: 12, variant: 'standard',
  name: { zh: '12 人 · 石像鬼迷雾', en: '12-Player Gargoyle Fog' },
  desc: { zh: '石像鬼 + 狼2 + 村3 + 预言家 + 女巫 + 猎人 + 守卫 + 白痴 + 长老', en: 'Gargoyle · 2 wolves · 3 villagers · seer · witch · hunter · guard · idiot · elder' },
  feature: { zh: '第三方「石像鬼」隐匿到终盘,场上永远充满迷雾', en: 'Third-party Gargoyle hides to endgame — fog of war throughout' },
  roles: ['gargoyle', 'werewolf', 'werewolf',
          'villager', 'villager', 'villager',
          'seer', 'witch', 'hunter', 'guard', 'idiot', 'villager'],
};

/** 12 人 · 丘比特之恋 */
const BOARD_12_CUPID: BoardDef = {
  id: 'p12-cupid', playerCount: 12, variant: 'standard',
  name: { zh: '12 人 · 丘比特之恋', en: '12-Player Cupid\'s Love' },
  desc: { zh: '丘比特 + 狼3 + 村2 + 预言家 + 女巫 + 猎人 + 守卫 + 白痴 + 村1', en: 'Cupid · 3 wolves · 2 villagers · seer · witch · hunter · guard · idiot · villager' },
  feature: { zh: '首夜丘比特连「情侣」,殉情机制让局势瞬变', en: 'Cupid links lovers on night 1 — chain deaths reshape the game' },
  roles: ['cupid', 'werewolf', 'werewolf', 'werewolf',
          'villager', 'villager',
          'seer', 'witch', 'hunter', 'guard', 'idiot', 'villager'],
};

export const BOARDS: Record<BoardId, BoardDef> = {
  'p9-classic':     BOARD_9_CLASSIC,
  'p12-classic':    BOARD_12_CLASSIC,
  'p12-wolfking':   BOARD_12_WOLFKING,
  'p12-wolfbeauty': BOARD_12_WOLFBEAUTY,
  'p12-gargoyle':   BOARD_12_GARGOYLE,
  'p12-cupid':      BOARD_12_CUPID,
};

export const BOARD_LIST: BoardDef[] = Object.values(BOARDS);

/* ─────────────────────────────────────────────
   性格库 —— 困难 AI 用的差异化人格
   ───────────────────────────────────────────── */
export const PERSONALITIES: { id: Personality; name: { zh: string; en: string }; desc: { zh: string; en: string } }[] = [
  { id: 'strategist',  name: { zh: '老谋深算', en: 'Strategist' },    desc: { zh: '逻辑严谨,引而不发,只在关键时出手', en: 'Rigorous, holds back, strikes at key moments' } },
  { id: 'aggressive',  name: { zh: '激进攻击', en: 'Aggressive' },    desc: { zh: '发言强势,主动带节奏,频繁指控他人', en: 'Forceful, drives discussion, accuses often' } },
  { id: 'mysterious',  name: { zh: '神秘莫测', en: 'Mysterious' },    desc: { zh: '说话少但每句都像有深意', en: 'Speaks little but every word hints at depth' } },
  { id: 'loyal',       name: { zh: '死忠帮派', en: 'Loyalist' },     desc: { zh: '一旦站队就咬死不放', en: 'Once aligned, never lets go' } },
  { id: 'backstab',    name: { zh: '反水型', en: 'Backstabber' },     desc: { zh: '看似支持某人,实则暗中捅刀', en: 'Seems to support, but actually sabotages' } },
  { id: 'cute',        name: { zh: '萌新', en: 'Newbie' },            desc: { zh: '人设上是新手,偶尔犯傻但直觉偶尔很准', en: 'Plays the newbie, slips up but intuition sometimes hits' } },
];

export function pickPersonality(): Personality {
  return PERSONALITIES[Math.floor(Math.random() * PERSONALITIES.length)].id;
}

/* ─────────────────────────────────────────────
   玩家名字 —— 全部用「X号玩家」,不用真名(避免 AI 起假名露馅)
   ───────────────────────────────────────────── */
export function generatePlayerNames(count: number, userName = '你'): { name: string; isUser: boolean }[] {
  const userPos = Math.floor(Math.random() * count);
  return Array.from({ length: count }, (_, i) => ({
    name: i === userPos ? userName : `${i + 1}号玩家`,
    isUser: i === userPos,
  }));
}

export function factionDesc(f: Faction): { zh: string; en: string } {
  if (f === 'wolf')  return { zh: '狼人阵营', en: 'Werewolf faction' };
  if (f === 'good')  return { zh: '好人阵营', en: 'Good faction' };
  return { zh: '第三方阵营', en: 'Third-party faction' };
}

export function victoryCondition(f: Faction): { zh: string; en: string } {
  if (f === 'wolf')  return { zh: '杀掉所有好人,或让狼人数量 ≥ 好人数量时胜利', en: 'Kill all good players, or wolf count >= good count' };
  if (f === 'good')  return { zh: '投票放逐所有狼人后胜利', en: 'Vote out all wolves' };
  return { zh: '达成第三方胜利条件(情侣任一阵营胜 / 活到最后)', en: 'Achieve third-party win (lover\'s faction wins / be the last one standing)' };
}
