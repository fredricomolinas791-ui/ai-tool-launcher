import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { RotateCcw, Undo2, Lightbulb, Trophy, Circle, Brain, Sparkles, Volume2, VolumeX, Cpu } from 'lucide-react';
import { useI18n } from '../../hooks/useI18n';
import { useFavorites } from '../../hooks/useFavorites';
import { Button } from '../ui/Button';

/* ═════════════════════════════════════════════════════════════════════
   69. AI 五子棋 GomokuTool
   ─────────────────────────────────────────────────────────────────────
   15×15 标准棋盘 · 玩家 vs 本地 AI · 4 档难度 · 选黑/选白(先后手)

   AI 引擎(纯本地、无网络,运行在主线程 + setTimeout 节流):
     简单  60% 随机 + 40% 启发
     中级  全局贪心 + 攻防评分
     高级  1-ply 推演(看对手最强应手)
     专家  2-ply alpha-beta,候选集 8,带冲四/活三强剪枝

   状态:棋子 (0=空, 1=黑, 2=白) · 当前行棋方 · 历史栈(支持悔棋) ·
   获胜 5 连坐标 · 上一步坐标。
   玩家默认执黑(先手),符合「黑先白后」的世界通例(Go & Gomoku)。
   ═════════════════════════════════════════════════════════════════════ */

const SIZE = 15;
const EMPTY = 0, BLACK = 1, WHITE = 2;
const OPP: Record<Stone, Stone> = { 0: 0, 1: 2, 2: 1, 3: 3 };

type Stone = 0 | 1 | 2 | 3;
type Board = Stone[][];
type Difficulty = 'easy' | 'medium' | 'hard' | 'expert';
type Cell = [number, number];

const DIRS: Array<[number, number]> = [[1, 0], [0, 1], [1, 1], [1, -1]];

/* ── 星位(天元 + 四角 + 四边),用于棋盘装饰 ── */
const STAR_POINTS: Cell[] = [
  [3, 3], [3, 7], [3, 11],
  [7, 3], [7, 7], [7, 11],
  [11, 3], [11, 7], [11, 11],
];

/* ── 工具函数 ─────────────────────────────────────────────────── */
function inBounds(x: number, y: number) { return x >= 0 && x < SIZE && y >= 0 && y < SIZE; }
function emptyBoard(): Board { return Array.from({ length: SIZE }, () => Array(SIZE).fill(EMPTY) as Stone[]); }
function cloneBoard(b: Board): Board { return b.map((row) => row.slice()); }

/* ── 胜负判定:从 (x, y) 落子后,是否有 5 连(含返回该 5 连) ── */
function winningLineFrom(board: Board, x: number, y: number, player: Stone): Cell[] | null {
  if (player === EMPTY) return null;
  for (const [dx, dy] of DIRS) {
    const line: Cell[] = [[x, y]];
    for (let i = 1; i < 5; i++) {
      const nx = x + i * dx, ny = y + i * dy;
      if (!inBounds(nx, ny) || board[ny][nx] !== player) break;
      line.push([nx, ny]);
    }
    for (let i = 1; i < 5; i++) {
      const nx = x - i * dx, ny = y - i * dy;
      if (!inBounds(nx, ny) || board[ny][nx] !== player) break;
      line.unshift([nx, ny]);
    }
    if (line.length >= 5) return line.slice(0, 5);
  }
  return null;
}

/* ── 单方向评分:假设把 player 落在 (x, y),这个方向贡献多少 ──
   返回:得分 + 开放端数(open count)
   模式分档:
     5 连       100_000
     活四(双开) 10_000
     冲四(单开)  1_000
     活三(双开)  1_000
     眠三(单开)    100
     活二(双开)    100
     眠二(单开)     10
     活一(双开)      1
*/
function scoreDirection(board: Board, x: number, y: number, dx: number, dy: number, player: Stone): number {
  let count = 1;
  let leftOpen = false, rightOpen = false;

  // 向 + 方向延伸
  for (let i = 1; i <= 5; i++) {
    const nx = x + i * dx, ny = y + i * dy;
    if (!inBounds(nx, ny)) break;
    if (board[ny][nx] === player) count++;
    else { rightOpen = board[ny][nx] === EMPTY; break; }
  }
  // 向 - 方向延伸
  for (let i = 1; i <= 5; i++) {
    const nx = x - i * dx, ny = y - i * dy;
    if (!inBounds(nx, ny)) break;
    if (board[ny][nx] === player) count++;
    else { leftOpen = board[ny][nx] === EMPTY; break; }
  }
  if (count >= 5) return 100_000;

  const open = (leftOpen ? 1 : 0) + (rightOpen ? 1 : 0);
  if (count === 4) {
    if (open === 2) return 10_000;
    if (open === 1) return 1_000;
    return 0;
  }
  if (count === 3) {
    if (open === 2) return 1_000; // 活三:下一步可成活四
    if (open === 1) return 100;
    return 0;
  }
  if (count === 2) {
    if (open === 2) return 100;
    if (open === 1) return 10;
    return 0;
  }
  if (count === 1) {
    if (open === 2) return 1;
    return 0;
  }
  return 0;
}

/* 4 个方向求和 */
function scoreCell(board: Board, x: number, y: number, player: Stone): number {
  let total = 0;
  for (const [dx, dy] of DIRS) total += scoreDirection(board, x, y, dx, dy, player);
  return total;
}

/* 候选点:已有棋子 2 格范围内的空格,第一手落天元 */
function generateCandidates(board: Board): Cell[] {
  const set = new Set<string>();
  let hasStone = false;
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      if (board[y][x] !== EMPTY) {
        hasStone = true;
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            const nx = x + dx, ny = y + dy;
            if (inBounds(nx, ny) && board[ny][nx] === EMPTY) set.add(`${nx},${ny}`);
          }
        }
      }
    }
  }
  if (!hasStone) return [[7, 7]];
  const out: Cell[] = [];
  for (const s of set) {
    const [x, y] = s.split(',').map(Number);
    out.push([x, y]);
  }
  return out;
}

/* 全局静态评估:用现有棋子的「成线潜力」累加。
   用来给 alpha-beta 叶子打分。比 4 方向枚举快一截。 */
function evalBoard(board: Board, player: Stone): number {
  let my = 0, ot = 0;
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const s = board[y][x];
      if (s === EMPTY) continue;
      for (const [dx, dy] of DIRS) {
        // 只统计「每条线的起点」(避免重复)
        const px = x - dx, py = y - dy;
        if (inBounds(px, py) && board[py][px] === s) continue;
        // 沿这个方向数到第一颗非 s
        let n = 0, blocked = 0;
        for (let i = 0; i < 6; i++) {
          const nx = x + i * dx, ny = y + i * dy;
          if (!inBounds(nx, ny)) { blocked++; break; }
          if (board[ny][nx] === s) n++;
          else { if (board[ny][nx] !== EMPTY) blocked++; break; }
        }
        // 类似 scoreDirection 的分档,但只看已经落下的子
        let v = 0;
        if (n >= 5) v = 100_000;
        else if (n === 4) v = blocked === 0 ? 10_000 : blocked === 1 ? 1_000 : 0;
        else if (n === 3) v = blocked === 0 ? 1_000 : blocked === 1 ? 100 : 0;
        else if (n === 2) v = blocked === 0 ? 100 : blocked === 1 ? 10 : 0;
        else if (n === 1) v = blocked === 0 ? 1 : 0;
        if (s === player) my += v; else ot += v;
      }
    }
  }
  return my - ot;
}

/* ── 必杀/必挡 快路径 ──
   扫描所有候选:能直接 5 连 → 立即赢;能阻止对手 5 连 → 立即挡。
   还能造「双活三/双冲四」这种制胜形。
   返回 [x, y] 或 null。*/
function tacticMove(board: Board, player: Stone): Cell | null {
  const op = OPP[player];
  const cands = generateCandidates(board);

  // 1) 我能直接赢
  for (const [x, y] of cands) {
    board[y][x] = player;
    const line = winningLineFrom(board, x, y, player);
    board[y][x] = EMPTY;
    if (line) return [x, y];
  }
  // 2) 不挡对手就输
  for (const [x, y] of cands) {
    board[y][x] = op;
    const line = winningLineFrom(board, x, y, op);
    board[y][x] = EMPTY;
    if (line) return [x, y];
  }
  // 3) 造「活四」(对手必须应,等于宣判)
  for (const [x, y] of cands) {
    if (scoreCell(board, x, y, player) >= 10_000) return [x, y];
  }
  // 4) 挡对手的「活四」
  for (const [x, y] of cands) {
    if (scoreCell(board, x, y, op) >= 10_000) return [x, y];
  }
  // 5) 造「活三」(双活三必胜)
  let myThrees = 0, myBestThree: Cell | null = null;
  for (const [x, y] of cands) {
    const s = scoreCell(board, x, y, player);
    if (s >= 1_000) { myThrees++; myBestThree = [x, y]; }
  }
  if (myThrees >= 2 && myBestThree) return myBestThree;

  // 6) 挡对手的「活三」(必须挡一个)
  let opThrees: Cell[] = [];
  for (const [x, y] of cands) {
    if (scoreCell(board, x, y, op) >= 1_000) opThrees.push([x, y]);
  }
  if (opThrees.length > 0) {
    // 优先挡「同时成四」的那一格(对手冲四活三那种致命组合)
    let best: Cell | null = null, bestScore = -1;
    for (const [x, y] of opThrees) {
      const s = scoreCell(board, x, y, op);
      if (s > bestScore) { bestScore = s; best = [x, y]; }
    }
    if (best) return best;
  }
  return null;
}

/* ── AI 主入口 ── */
function aiMove(board: Board, player: Stone, difficulty: Difficulty): Cell {
  const cands = generateCandidates(board);
  if (cands.length === 0) return [7, 7];
  const op = OPP[player];

  // 任何难度都先走战术快路径(确保不漏必杀/必挡)
  const tact = tacticMove(board, player);
  if (tact) return tact;

  if (difficulty === 'easy') {
    // 简单:60% 随机 + 40% 启发
    return pickWeighted(cands, board, player, 0.4, 0.6, 240);
  }
  if (difficulty === 'medium') {
    // 中级:全局贪心 + 攻防综合分(我方 1.0,对方 0.9),轻度随机打破平局
    return pickWeighted(cands, board, player, 1.0, 0.9, 30);
  }
  if (difficulty === 'hard') {
    // 高级:1-ply 推演——我下完之后,对方最强应手能拿多少分;
    //       我方落子的进攻分 - α × 对方最坏情况
    let best: Cell | null = null, bestVal = -Infinity;
    for (const [x, y] of cands) {
      board[y][x] = player;
      const my = scoreCell(board, x, y, player);
      // 对方最坏应手
      const opCands = generateCandidates(board);
      let maxOp = 0;
      for (const [ox, oy] of opCands) {
        if (board[oy][ox] !== EMPTY) continue;
        const s = scoreCell(board, ox, oy, op);
        if (s > maxOp) maxOp = s;
      }
      board[y][x] = EMPTY;
      const v = my * 1.4 - maxOp * 1.0 + Math.random() * 5;
      if (v > bestVal) { bestVal = v; best = [x, y]; }
    }
    return best ?? cands[0];
  }
  // 专家:2-ply alpha-beta,候选集收窄到前 8
  const scored = cands.map(([x, y]) => ({
    x, y,
    s: scoreCell(board, x, y, player) + scoreCell(board, x, y, op) * 0.9,
  })).sort((a, b) => b.s - a.s).slice(0, 8);
  const topCands: Cell[] = scored.map((m) => [m.x, m.y]);

  const NEG = -Infinity, POS = Infinity;
  const search = (depth: number, alpha: number, beta: number, isMax: boolean): number => {
    if (depth === 0) return evalBoard(board, player);
    const cs = isMax ? topCands : generateCandidates(board).slice(0, 8);
    if (cs.length === 0) return 0;
    if (isMax) {
      let v = NEG;
      for (const [x, y] of cs) {
        if (board[y][x] !== EMPTY) continue;
        board[y][x] = player;
        v = Math.max(v, search(depth - 1, alpha, beta, false));
        board[y][x] = EMPTY;
        alpha = Math.max(alpha, v);
        if (alpha >= beta) break;
      }
      return v;
    } else {
      let v = POS;
      for (const [x, y] of cs) {
        if (board[y][x] !== EMPTY) continue;
        board[y][x] = op;
        v = Math.min(v, search(depth - 1, alpha, beta, true));
        board[y][x] = EMPTY;
        beta = Math.min(beta, v);
        if (alpha >= beta) break;
      }
      return v;
    }
  };

  let best: Cell = topCands[0];
  let bestVal = NEG;
  for (const [x, y] of topCands) {
    board[y][x] = player;
    const v = search(3, NEG, POS, false);
    board[y][x] = EMPTY;
    if (v > bestVal) { bestVal = v; best = [x, y]; }
  }
  return best;
}

/* 简单/中级的随机加权选择 */
function pickWeighted(
  cands: Cell[], board: Board, player: Stone,
  weightMy: number, weightOp: number, jitter: number,
): Cell {
  const op = OPP[player];
  const scored = cands.map(([x, y]) => ({
    x, y,
    s: scoreCell(board, x, y, player) * weightMy
       + scoreCell(board, x, y, op) * weightOp
       + Math.random() * jitter,
  }));
  scored.sort((a, b) => b.s - a.s);
  return [scored[0].x, scored[0].y];
}

/* ───────────────────────────────────────────────────────────────
   React 组件
   ─────────────────────────────────────────────────────────────── */

interface GameState {
  board: Board;
  history: Cell[];          // 按落子顺序记录坐标
  winLine: Cell[] | null;   // 胜方 5 连
  winner: Stone;            // 0=未定,1=黑胜,2=白胜,3=平局
}

const DIFFICULTY_META: Record<Difficulty, { zh: string; en: string; hint: { zh: string; en: string } }> = {
  easy:   { zh: '简单', en: 'Easy',     hint: { zh: '偶尔偷袭,落子松散',   en: 'Plays loose, occasional blunders' } },
  medium: { zh: '中级', en: 'Medium',   hint: { zh: '会挡会冲,业余强手',   en: 'Blocks and attacks, solid club player' } },
  hard:   { zh: '高级', en: 'Hard',     hint: { zh: '1 步推演,业余高段',   en: '1-ply lookahead, strong amateur' } },
  expert: { zh: '专家', en: 'Expert',   hint: { zh: 'α-β 搜索,准职业级',   en: 'Alpha-beta search, near-pro level' } },
};

export function GomokuTool() {
  const { lang } = useI18n();

  /* 玩家执子:1=黑(先手) / 2=白(后手) */
  const [playerColor, setPlayerColor] = useState<Stone>(BLACK);
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [game, setGame] = useState<GameState>(() => ({
    board: emptyBoard(),
    history: [],
    winLine: null,
    winner: 0,
  }));
  const [thinking, setThinking] = useState(false);
  const [soundOn, setSoundOn] = useState(false);
  const [hintCell, setHintCell] = useState<Cell | null>(null);
  const [score, setScore] = useState(() => loadScore());
  const aiTimerRef = useRef<number | null>(null);
  const favorites = useFavorites();

  /* 持久化战绩 */
  useEffect(() => { saveScore(score); }, [score]);
  /* 卸载时清掉计时器 */
  useEffect(() => () => { if (aiTimerRef.current) clearTimeout(aiTimerRef.current); }, []);

  const aiColor: Stone = OPP[playerColor];
  const currentTurn: Stone = (game.history.length % 2 === 0) ? BLACK : WHITE;
  const lastMove: Cell | null = game.history.length > 0 ? game.history[game.history.length - 1] : null;

  const isPlayerTurn = currentTurn === playerColor && game.winner === 0;

  /* 玩家落子 */
  const place = useCallback((x: number, y: number) => {
    if (!isPlayerTurn) return;
    if (game.board[y][x] !== EMPTY) return;
    if (game.winner !== 0) return;
    setHintCell(null);
    const b = cloneBoard(game.board);
    b[y][x] = currentTurn;
    const line = winningLineFrom(b, x, y, currentTurn);
    const newHist = [...game.history, [x, y] as Cell];
    if (line) {
      setGame({ board: b, history: newHist, winLine: line, winner: currentTurn });
      setScore((s) => bumpScore(s, currentTurn, playerColor));
      playSound(line ? 'win' : 'place');
      return;
    }
    // 平局(下满)
    if (newHist.length === SIZE * SIZE) {
      setGame({ board: b, history: newHist, winLine: null, winner: 3 });
      return;
    }
    setGame({ board: b, history: newHist, winLine: null, winner: 0 });
    playSound('place');
  }, [game, isPlayerTurn, currentTurn, playerColor]);

  /* AI 落子:每次轮到 AI 时触发 */
  useEffect(() => {
    if (game.winner !== 0) return;
    if (currentTurn !== aiColor) return;
    setThinking(true);
    aiTimerRef.current = window.setTimeout(() => {
      // 在闭包里用最新 board
      setGame((prev) => {
        if (prev.winner !== 0) return prev;
        const [x, y] = aiMove(prev.board, aiColor, difficulty);
        const b = cloneBoard(prev.board);
        b[y][x] = aiColor;
        const line = winningLineFrom(b, x, y, aiColor);
        const newHist = [...prev.history, [x, y] as Cell];
        if (line) {
          setScore((s) => bumpScore(s, aiColor, playerColor));
          playSound('lose');
          return { board: b, history: newHist, winLine: line, winner: aiColor };
        }
        if (newHist.length === SIZE * SIZE) {
          return { board: b, history: newHist, winLine: null, winner: 3 };
        }
        playSound('place');
        return { board: b, history: newHist, winLine: null, winner: 0 };
      });
      setThinking(false);
    }, difficulty === 'expert' ? 350 : difficulty === 'hard' ? 200 : 120);
    return () => { if (aiTimerRef.current) clearTimeout(aiTimerRef.current); };
  }, [currentTurn, aiColor, game.winner, difficulty, playerColor]);

  /* 新一局 */
  const newGame = useCallback((resetScore = false) => {
    setGame({ board: emptyBoard(), history: [], winLine: null, winner: 0 });
    setHintCell(null);
    if (resetScore) setScore({ player: 0, ai: 0, draw: 0 });
  }, []);

  /* 悔棋:玩家自己的上一步 + AI 的应手,共退 2 步
     如果 AI 刚下完且已分胜负,只退到 AI 落子前 */
  const undo = useCallback(() => {
    if (thinking) return;
    if (game.history.length === 0) return;
    if (game.winner !== 0) {
      // 终局悔棋:整局重来
      newGame();
      return;
    }
    // 退 2 步(玩家 + AI),如果只下了一步(玩家先手的第一步),只退 1 步
    const stepsToUndo = game.history.length >= 2 ? 2 : 1;
    const newHist = game.history.slice(0, game.history.length - stepsToUndo);
    const b = emptyBoard();
    let turn: Stone = BLACK;
    for (const [x, y] of newHist) {
      b[y][x] = turn;
      turn = OPP[turn];
    }
    setGame({ board: b, history: newHist, winLine: null, winner: 0 });
    setHintCell(null);
  }, [game, thinking, newGame]);

  /* 提示:让 AI 给玩家推荐一手 */
  const showHint = useCallback(() => {
    if (game.winner !== 0) return;
    if (!isPlayerTurn) return;
    const hint = aiMove(cloneBoard(game.board), playerColor, 'hard');
    setHintCell(hint);
  }, [game, isPlayerTurn, playerColor]);

  /* 切换先后手 = 立刻开新局(中途切换会很乱) */
  const switchColor = (c: Stone) => {
    if (c === playerColor) return;
    setPlayerColor(c);
    newGame();
  };

  /* 收藏当前对局(终局后可收藏) */
  const gameKey = `gomoku::${game.history.map(([x, y]) => `${x},${y}`).join('-')}`;
  const isGameFav = game.history.length > 0 ? favorites.isFav(69, gameKey) : false;
  const toggleFav = () => {
    if (game.history.length === 0) return;
    const result = game.winner === 0
      ? (lang === 'en' ? 'In progress' : '进行中')
      : game.winner === 3
        ? (lang === 'en' ? 'Draw' : '平局')
        : game.winner === playerColor
          ? (lang === 'en' ? 'You won' : '玩家胜')
          : (lang === 'en' ? 'AI won' : 'AI 胜');
    favorites.toggle({
      toolId: 69, toolName: 'AI 五子棋', kind: 'game',
      title: `${DIFFICULTY_META[difficulty][lang]} · ${result} · ${game.history.length}${lang === 'en' ? ' moves' : ' 手'}`,
      preview: `${lang === 'en' ? 'Color' : '执子'}: ${playerColor === BLACK ? (lang === 'en' ? 'Black (1st)' : '黑(先)') : (lang === 'en' ? 'White (2nd)' : '白(后)')} · ${DIFFICULTY_META[difficulty][lang]}`,
      content: `【五子棋对局】\n难度:${DIFFICULTY_META[difficulty].zh}\n玩家执子:${playerColor === BLACK ? '黑(先手)' : '白(后手)'}\n总手数:${game.history.length}\n结果:${result}\n\n落子序列(黑=1,白=2):\n${game.history.map(([x, y], i) => `${i + 1}. ${(i % 2 === 0 ? '黑' : '白')} → (${x},${y})`).join('\n')}`,
      dedupeKey: gameKey,
    });
  };

  /* ── 文案 ── */
  const T = {
    title:        lang === 'en' ? 'AI Gomoku' : 'AI 五子棋',
    sub:          lang === 'en' ? 'You vs local AI · 4 levels' : '玩家 vs 本地 AI · 4 档难度',
    newGame:      lang === 'en' ? 'New game' : '新对局',
    undo:         lang === 'en' ? 'Undo' : '悔棋',
    hint:         lang === 'en' ? 'Hint' : '提示',
    thinkLabel:   lang === 'en' ? 'AI thinking…' : 'AI 思考中…',
    yourTurn:     lang === 'en' ? 'Your move' : '该你下了',
    aiTurn:       lang === 'en' ? 'AI move' : 'AI 行棋',
    youPlay:      lang === 'en' ? 'You play' : '玩家执',
    first:        lang === 'en' ? '1st (Black)' : '先手(黑)',
    second:       lang === 'en' ? '2nd (White)' : '后手(白)',
    blackFirst:   lang === 'en' ? 'Black plays first — universal Go/Gomoku rule' : '黑先白后 —— Go & 五子棋世界通例',
    moves:        lang === 'en' ? 'Moves' : '手数',
    level:        lang === 'en' ? 'Difficulty' : '难度',
    color:        lang === 'en' ? 'Your color' : '执子',
    scoreLine:    lang === 'en' ? `You ${score.player} · AI ${score.ai} · Draw ${score.draw}`
                                  : `玩家 ${score.player} · AI ${score.ai} · 平 ${score.draw}`,
    resetScore:   lang === 'en' ? 'Reset' : '清零',
    youWin:       lang === 'en' ? 'You win! 🎉' : '你赢了!🎉',
    aiWin:        lang === 'en' ? 'AI wins' : 'AI 获胜',
    draw:         lang === 'en' ? 'Draw' : '和棋',
    save:         lang === 'en' ? 'Save this game' : '收藏本局',
    remove:       lang === 'en' ? 'Remove from favorites' : '从收藏移除',
    soundOn:      lang === 'en' ? 'Sound on'  : '开启音效',
    soundOff:     lang === 'en' ? 'Sound off' : '关闭音效',
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 pt-4 shrink-0 flex items-center justify-between" style={{ borderBottom: '1px solid var(--color-border)' }}>
        <div className="flex items-center gap-2">
          <h2 className="text-[15px] font-semibold" style={{ color: 'var(--color-text-primary)' }}>{T.title}</h2>
          <span className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>· {T.sub}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setSoundOn((s) => !s)}
            title={soundOn ? T.soundOff ?? 'Sound on' : T.soundOn ?? 'Sound off'}
            className="w-7 h-7 rounded-md flex items-center justify-center"
            style={{ color: 'var(--color-text-muted)', background: soundOn ? 'var(--color-accent-glow)' : 'transparent' }}
          >
            {soundOn ? <Volume2 size={13} /> : <VolumeX size={13} />}
          </button>
          {game.history.length > 0 && (
            <button
              onClick={toggleFav}
              title={isGameFav ? T.remove : T.save}
              className="w-7 h-7 rounded-md flex items-center justify-center"
              style={{ color: isGameFav ? 'var(--color-accent)' : 'var(--color-text-muted)', background: isGameFav ? 'var(--color-accent-glow)' : 'transparent' }}
            >
              <Sparkles size={13} fill={isGameFav ? 'currentColor' : 'none'} />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4 p-4 lg:p-6 max-w-5xl mx-auto w-full">
          {/* ── 左侧:设置 + 状态 ── */}
          <div className="space-y-3 lg:order-1 order-2">
            {/* 难度 */}
            <div className="rounded-xl p-3" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
              <p className="text-[10px] font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5" style={{ color: 'var(--color-text-muted)' }}>
                <Brain size={11} /> {T.level}
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {(['easy', 'medium', 'hard', 'expert'] as Difficulty[]).map((d) => {
                  const active = d === difficulty;
                  return (
                    <button
                      key={d}
                      onClick={() => setDifficulty(d)}
                      className="h-9 rounded-lg text-[12px] font-medium flex items-center justify-center gap-1"
                      style={{
                        background: active ? 'var(--color-accent-glow)' : 'var(--color-bg-main)',
                        color: active ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                        border: `1px solid ${active ? 'var(--color-accent)' : 'var(--color-border)'}`,
                      }}
                    >
                      {DIFFICULTY_META[d][lang]}
                    </button>
                  );
                })}
              </div>
              <p className="text-[10px] mt-2 leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
                {DIFFICULTY_META[difficulty].hint[lang]}
              </p>
            </div>

            {/* 执子 */}
            <div className="rounded-xl p-3" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
              <p className="text-[10px] font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5" style={{ color: 'var(--color-text-muted)' }}>
                <Circle size={11} /> {T.color}
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {([
                  { v: BLACK, label: T.first, swatch: '#0a0a0c' },
                  { v: WHITE, label: T.second, swatch: '#f5f5f7', border: true },
                ] as { v: Stone; label: string; swatch: string; border?: boolean }[]).map((opt) => {
                  const active = opt.v === playerColor;
                  return (
                    <button
                      key={opt.v}
                      onClick={() => switchColor(opt.v)}
                      className="h-9 rounded-lg text-[12px] font-medium flex items-center justify-center gap-1.5"
                      style={{
                        background: active ? 'var(--color-accent-glow)' : 'var(--color-bg-main)',
                        color: active ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                        border: `1px solid ${active ? 'var(--color-accent)' : 'var(--color-border)'}`,
                      }}
                    >
                      <span
                        className="w-3 h-3 rounded-full inline-block"
                        style={{
                          background: opt.swatch,
                          boxShadow: opt.border ? 'inset 0 0 0 1px var(--color-border)' : undefined,
                        }}
                      />
                      {opt.label}
                    </button>
                  );
                })}
              </div>
              <p className="text-[10px] mt-2 leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
                {T.blackFirst}
              </p>
            </div>

            {/* 状态 */}
            <div
              className="rounded-xl p-3"
              style={{
                background: game.winner !== 0
                  ? (game.winner === playerColor
                      ? 'linear-gradient(135deg, rgba(52,211,153,0.12), var(--color-bg-card))'
                      : game.winner === 3
                        ? 'var(--color-bg-card)'
                        : 'linear-gradient(135deg, rgba(239,68,68,0.10), var(--color-bg-card))')
                  : thinking
                    ? 'var(--color-accent-glow)'
                    : 'var(--color-bg-card)',
                border: `1px solid ${game.winner === playerColor ? 'var(--color-success)' : game.winner === aiColor || game.winner === 3 ? 'var(--color-border)' : 'var(--color-accent)'}`,
              }}
            >
              <p className="text-[10px] font-semibold uppercase tracking-wider mb-1.5 flex items-center gap-1.5" style={{ color: 'var(--color-text-muted)' }}>
                {game.winner !== 0 ? <Trophy size={11} /> : thinking ? <Cpu size={11} /> : <Circle size={11} />}
                {game.winner !== 0
                  ? (game.winner === 3 ? T.draw : game.winner === playerColor ? T.youWin : T.aiWin)
                  : thinking ? T.thinkLabel : isPlayerTurn ? T.yourTurn : T.aiTurn}
              </p>
              <div className="flex items-center gap-2 text-[12px]" style={{ color: 'var(--color-text-secondary)' }}>
                <span>{T.moves}: <strong style={{ color: 'var(--color-text-primary)' }}>{game.history.length}</strong></span>
                <span style={{ color: 'var(--color-text-muted)' }}>·</span>
                <span>{T.scoreLine}</span>
              </div>
            </div>

            {/* 操作 */}
            <div className="flex gap-1.5">
              <Button variant="secondary" size="sm" onClick={() => newGame()} className="flex-1">
                <RotateCcw size={12} /> {T.newGame}
              </Button>
              <Button variant="ghost" size="sm" onClick={undo} disabled={game.history.length === 0}>
                <Undo2 size={12} /> {T.undo}
              </Button>
              <Button variant="ghost" size="sm" onClick={showHint} disabled={!isPlayerTurn || game.winner !== 0}>
                <Lightbulb size={12} /> {T.hint}
              </Button>
            </div>
            <button
              onClick={() => setScore({ player: 0, ai: 0, draw: 0 })}
              className="w-full text-[10px] py-1 rounded-md"
              style={{ color: 'var(--color-text-muted)' }}
            >
              {T.resetScore}
            </button>
          </div>

          {/* ── 右侧:棋盘 ── */}
          <div className="lg:order-2 order-1 flex flex-col items-center">
            <BoardView
              board={game.board}
              winLine={game.winLine}
              lastMove={lastMove}
              hintCell={hintCell}
              disabled={!isPlayerTurn || game.winner !== 0}
              onPlace={place}
            />
            {game.winner === 0 && !thinking && game.history.length === 0 && (
              <p className="text-[11px] mt-3 text-center" style={{ color: 'var(--color-text-muted)' }}>
                {playerColor === BLACK
                  ? (lang === 'en' ? 'Black (you) to move first — click any intersection' : '黑方(你)先手 —— 点击任意交叉点落子')
                  : (lang === 'en' ? 'White (you) plays second — AI (Black) opens at the center' : '白方(你)后手 —— AI(黑)将先落天元')}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────────────────────────────────────────────
   棋盘视图
   ─────────────────────────────────────────────────────────────── */

function BoardView({
  board, winLine, lastMove, hintCell, disabled, onPlace,
}: {
  board: Board;
  winLine: Cell[] | null;
  lastMove: Cell | null;
  hintCell: Cell | null;
  disabled: boolean;
  onPlace: (x: number, y: number) => void;
}) {
  /* 把棋盘坐标换算成 SVG 视图坐标(0..100) */
  const toView = (idx: number) => (idx / (SIZE - 1)) * 100;

  const winSet = useMemo(() => {
    if (!winLine) return new Set<string>();
    return new Set(winLine.map(([x, y]) => `${x},${y}`));
  }, [winLine]);

  return (
    <div
      className="relative rounded-2xl shadow-2xl"
      style={{
        width: 'min(560px, calc(100vw - 32px))',
        aspectRatio: '1 / 1',
        padding: '5%',
        background: 'linear-gradient(135deg, #e6b97a 0%, #d49b5a 60%, #c08545 100%)',
        boxShadow: '0 12px 48px rgba(0,0,0,0.45), inset 0 0 0 1px rgba(255,255,255,0.10)',
      }}
    >
      <div className="relative w-full h-full">
        {/* 棋盘网格 + 星位 */}
        <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
          {Array.from({ length: SIZE }).map((_, i) => {
            const v = toView(i);
            return (
              <g key={i} stroke="rgba(40, 25, 10, 0.78)" strokeWidth={i === 0 || i === SIZE - 1 ? 0.7 : 0.45}>
                <line x1={toView(0)} y1={v} x2={toView(SIZE - 1)} y2={v} />
                <line x1={v} y1={toView(0)} x2={v} y2={toView(SIZE - 1)} />
              </g>
            );
          })}
          {STAR_POINTS.map(([x, y], i) => (
            <circle key={i} cx={toView(x)} cy={toView(y)} r={0.9} fill="rgba(40, 25, 10, 0.78)" />
          ))}
        </svg>

        {/* 棋子 */}
        {board.map((row, y) =>
          row.map((s, x) => {
            if (s === EMPTY) return null;
            const isLast = lastMove && lastMove[0] === x && lastMove[1] === y;
            const isWin = winSet.has(`${x},${y}`);
            return (
              <div
                key={`${x},${y}`}
                className="absolute"
                style={{
                  left: `${toView(x)}%`,
                  top: `${toView(y)}%`,
                  width: `${100 / (SIZE - 1)}%`,
                  height: `${100 / (SIZE - 1)}%`,
                  transform: 'translate(-50%, -50%)',
                  pointerEvents: 'none',
                }}
              >
                <div
                  className="w-full h-full rounded-full"
                  style={{
                    background: s === BLACK
                      ? 'radial-gradient(circle at 35% 30%, #555 0%, #1a1a1c 60%, #000 100%)'
                      : 'radial-gradient(circle at 35% 30%, #ffffff 0%, #ececf0 60%, #c9c9d1 100%)',
                    boxShadow: s === BLACK
                      ? '0 2px 4px rgba(0,0,0,0.5), inset 0 1px 2px rgba(255,255,255,0.15)'
                      : '0 2px 4px rgba(0,0,0,0.35), inset 0 1px 2px rgba(255,255,255,0.6)',
                    border: isWin ? '2px solid var(--color-success)' : 'none',
                    animation: 'gomoku-place 220ms cubic-bezier(0.16, 1, 0.3, 1)',
                  }}
                />
                {isLast && !isWin && (
                  <span
                    className="absolute"
                    style={{
                      left: '50%', top: '50%',
                      width: '26%', height: '26%',
                      transform: 'translate(-50%, -50%)',
                      border: '1.5px solid #ef4444',
                      borderRadius: '50%',
                      boxShadow: '0 0 4px rgba(239, 68, 68, 0.6)',
                    }}
                  />
                )}
              </div>
            );
          })
        )}

        {/* 提示点(蓝圈,半透明) */}
        {hintCell && (() => {
          const [x, y] = hintCell;
          if (board[y][x] !== EMPTY) return null;
          return (
            <div
              key={`hint-${x},${y}`}
              className="absolute pointer-events-none"
              style={{
                left: `${toView(x)}%`,
                top: `${toView(y)}%`,
                width: `${100 / (SIZE - 1)}%`,
                height: `${100 / (SIZE - 1)}%`,
                transform: 'translate(-50%, -50%)',
              }}
            >
              <div
                className="w-full h-full rounded-full animate-pulse"
                style={{
                  background: 'rgba(59, 130, 246, 0.18)',
                  border: '1.5px solid rgba(59, 130, 246, 0.6)',
                }}
              />
            </div>
          );
        })()}

        {/* 鼠标悬停预览(只有自己回合 + 空格 + 未终局) */}
        {!disabled && Array.from({ length: SIZE }).map((_, y) =>
          Array.from({ length: SIZE }).map((_, x) => {
            if (board[y][x] !== EMPTY) return null;
            return (
              <button
                key={`cell-${x},${y}`}
                onClick={() => onPlace(x, y)}
                className="absolute group"
                style={{
                  left: `${toView(x)}%`,
                  top: `${toView(y)}%`,
                  width: `${100 / (SIZE - 1)}%`,
                  height: `${100 / (SIZE - 1)}%`,
                  transform: 'translate(-50%, -50%)',
                  background: 'transparent',
                  cursor: 'pointer',
                }}
                aria-label={`row ${y + 1} col ${x + 1}`}
              >
                <span
                  className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                  style={{
                    width: '50%', height: '50%',
                    background: 'rgba(40, 25, 10, 0.22)',
                  }}
                />
              </button>
            );
          })
        )}
      </div>

      <style>{`
        @keyframes gomoku-place {
          0%   { transform: scale(0.3); opacity: 0; }
          60%  { transform: scale(1.12); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

/* ───────────────────────────────────────────────────────────────
   战绩持久化 + 音效(可关)
   ─────────────────────────────────────────────────────────────── */

interface ScoreState { player: number; ai: number; draw: number; }
const SCORE_KEY = 'ai-tools-launcher.gomoku-score.v1';
function loadScore(): ScoreState { return loadLS(SCORE_KEY, { player: 0, ai: 0, draw: 0 }); }
function saveScore(s: ScoreState) { saveLS(SCORE_KEY, s); }
function bumpScore(s: ScoreState, winner: Stone, player: Stone): ScoreState {
  if (winner === 0) return s;
  if (winner === 3) return { ...s, draw: s.draw + 1 };
  return winner === player
    ? { ...s, player: s.player + 1 }
    : { ...s, ai: s.ai + 1 };
}

function loadLS<T>(key: string, fallback: T): T {
  try { const r = localStorage.getItem(key); if (r) return JSON.parse(r) as T; } catch {}
  return fallback;
}
function saveLS(key: string, val: unknown) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}

/* WebAudio 短促反馈(不依赖外部资源);若 soundOn=false 直接 noop */
function playSound(kind: 'place' | 'win' | 'lose') {
  try {
    const root = (window as any).__gomokuAudio;
    if (!root) return; // soundOn 关 → 根本没初始化
    const ctx: AudioContext = root.ctx;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    const t = ctx.currentTime;
    if (kind === 'place') { o.frequency.value = 540; g.gain.setValueAtTime(0.06, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08); }
    else if (kind === 'win') { o.frequency.value = 660; g.gain.setValueAtTime(0.08, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18); }
    else { o.frequency.value = 220; g.gain.setValueAtTime(0.10, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.30); }
    o.start(t); o.stop(t + 0.4);
  } catch {}
}
/* 用户切到 soundOn=true 时再懒初始化 AudioContext(浏览器策略) */
export function ensureGomokuAudio(soundOn: boolean) {
  if (!soundOn) return;
  try {
    const w = window as any;
    if (!w.__gomokuAudio) {
      const Ctx = (window.AudioContext || (window as any).webkitAudioContext);
      w.__gomokuAudio = { ctx: new Ctx() };
    }
  } catch {}
}
