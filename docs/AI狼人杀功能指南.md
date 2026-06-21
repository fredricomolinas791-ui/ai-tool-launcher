# AI 狼人杀 · 功能指南

> 12 人经典局"预女猎白"完整规则说明 + UX 设计 + 玩家操作手册
>
> 最后更新:2026-06-21(累计 16 个 Phase 修复 + Phase 12 UI 优化)

---

## 目录

1. [快速开始](#快速开始)
2. [角色与板子](#角色与板子)
3. [游戏模式](#游戏模式-p16)
4. [游戏流程](#游戏流程)
5. [AI 玩家行为规则](#ai-玩家行为规则)
6. [神职技能详解](#神职技能详解)
7. [警徽机制](#警徽机制)
8. [起跳与悍跳机制](#起跳与悍跳机制)
9. [死亡时机与延后结算](#死亡时机与延后结算-p13)
10. [右侧栏 UI 说明](#右侧栏-ui-说明-phase-12a)
11. [顶部状态条](#顶部状态条-phase-12c)
12. [结束界面](#结束界面-phase-12d)
13. [所有 Phase 修复总览](#所有-phase-修复总览)
14. [开发指南](#开发指南)
15. [玩家操作手册](#玩家操作手册)
16. [已知遗留问题](#已知遗留问题)

---

## 快速开始

1. 打开 AI 工具启动器(本地 `npm run dev`)
2. 在左侧"生活"分类里点击 **AI 狼人杀** 卡片
3. **第一次使用**会提示需要 API Key → 右上角"AI 设置"配置至少一个 provider
4. 选择板子 **12 人 · 预女猎白**
5. **选择模式**(Phase 16):
   - **加入游戏**:你扮演其中一个角色
   - **观看 AI 对局**:全 12 个 AI 互相博弈,你不参与
6. 点击进入 → 身份公布(观看模式:显示 AI 之间的角色分配)
7. 游戏开始:夜晚闭眼行动 → 白天发言投票 → 循环到游戏结束

---

## 角色与板子

### 角色分布(12 人预女猎白)

| 阵营 | 角色 | 数量 | 技能 |
|---|---|---|---|
| 🐺 狼人 | 普通狼人 | 3 | 每晚协同杀 1 人 |
| 🛡️ 好人 | 预言家 | 1 | 每晚验 1 人身份 |
| 🛡️ 好人 | 女巫 | 1 | 1 解药 + 1 毒药(各只能用 1 次) |
| 🛡️ 好人 | 猎人 | 1 | 死亡时可开枪带走 1 人(被毒不能开) |
| 🛡️ 好人 | 白痴 | 1 | 被投时翻牌免死(失去投票权) |
| 🛡️ 好人 | 村民 | 4 | 无技能 |

### 其他板子(当前为 coming-soon)

- 12 人 · 狼王守卫
- 12 人 · 狼美骑士
- 12 人 · 石像鬼迷雾
- 12 人 · 丘比特之恋

### 性格系统

每个 AI 玩家有 6 种性格之一,影响发言风格:

- 🧠 老谋深算(Strategist) — 逻辑严谨,关键时出手
- 🔥 激进(Aggressive) — 主动带节奏,频繁指控
- 🌫️ 神秘(Mysterious) — 说话少但有深意
- 🤝 死忠(Loyalist) — 一旦站队不松口
- 🗡️ 反水(Backstabber) — 表面支持实则捅刀
- 🐣 萌新(Newbie) — 装傻但偶尔直觉准

---

## 游戏模式(Phase 16)

### 加入游戏(默认)

- 你是 12 人中随机一个
- 夜晚你会收到行动 UI(预言家选人、女巫用药、狼选杀目标)
- 白天你可以发言、投票、跳预言家
- 死后 → DeadSpectator 面板

### 观看 AI 对局(新)

- `spectatorMode: true` → `userId = -1`,所有玩家都是 AI
- 进入游戏时**显示所有 AI 的角色分配**(你可以知道谁是预言家/狼)
- 没有任何用户行动 UI(跳过所有夜/昼交互)
- 直接进入下一阶段(由系统驱动)
- 死后不触发 DeadSpectator(没人"死了")
- 适合研究 AI 策略 / 看 LLM 怎么博弈

---

## 游戏流程

### 一轮完整流程

```
night(夜间行动)
  └─ wolf: 选杀目标
  └─ seer: 验 1 人
  └─ witch: 用解药/毒药
  └─ guard/cupid/gargoyle: 各自动作

resolveNight(结算)
  └─ 同守同救抵消、情侣殉情
  └─ P13:若 day1 + needSheriff → 死亡存 deferredDeaths 跳 sheriff-election
  └─ 否则立即写 publicLog + 死亡日志

day-announce(天亮)
  └─ 显示昨夜死亡(若有 deferredDeaths,这里会留空)
  └─ 若 12 人场 + 无警长 → 进 sheriff-election
  └─ 否则直接进 day-discuss

sheriff-election(警长竞选,首轮)
  └─ register(报名) → speech(每位候选人发言) → withdraw → vote
  └─ 落地后若有 deferredDeaths → applyDeferredDeaths

day-discuss(白天讨论)
  └─ 每人按座位发言 1 次
  └─ AI 必须引用具体玩家/观点(Phase 4A/B)
  └─ 期间可能跳预言家/女巫/守卫(最多 3 人全局跳预言家,Phase 10)

day-vote(投票)
  └─ 用户和 AI 同时投票
  └─ 警长 1.5 票权重
  └─ 平票 → PK 发言 + 投票
  └─ 出局者 → last-words(遗言)

death triggers:
  └─ 猎人死 → hunter-shoot
  └─ 白痴被投 → idiot-flip
  └─ 狼王被投 → wolfking-pick
  └─ 警长死 → sheriff-succession(警徽传承)

checkWinner(胜负判定)
  └─ 狼全灭 → good 胜
  └─ 神/民任一全灭 → wolf 胜
  └─ 石像鬼只剩自己+1 → third 胜
  └─ 丘比特情侣任一阵营胜 → third 胜

gameover(显示胜方 + 复制对话日志)
```

### P13 关键状态机变化(第一天死亡延后)

```
night 1 (玩家死亡)
  └─ resolveNight → 写 deferredDeaths,跳 sheriff-election(跳过 day-announce)
day 1 sheriff-election 落地
  └─ applyDeferredDeaths → 写 publicLog 死亡 → 进 day-announce
day 1 day-announce 显示死亡
  └─ day-discuss → day-vote ...
```

**目的**:让第一天死掉的玩家(包括真预言家、女巫、狼)还能参加警徽竞选。

---

## AI 玩家行为规则

### 警长竞选(Phase 6D / 11B / 远端 AI 30s 超时)

- **报名阶段**:每个 AI 独立决定是否报名
  - 预言家:100% 报名
  - 其他神职(女巫/猎人/守卫/骑士):60%
  - 狼人:40%(想抢警徽)
  - 普通村民:15%
- **发言阶段**:每位候选人必须发言(30s 超时兑底)
- **退水阶段**:**只有发言时跳过预言家的候选人才有资格留**;其他都强制退水
- **投票阶段**:警长投的票算 1.5 票

### 女巫规则(Phase 6C / 8C / 9 — 但 P9 在最新版本被"完全私密"取代)

- **必须用药**(女巫 = 神职 = 应该把两个药都用掉)
  - AI 超时未返回决策 → 强制使用解药 + 毒药(随机活人)
  - AI 返回 `useAntidote: false, poisonTarget: null` 但有可用道具 → 强制覆盖
- **用药信息完全私密**(远端最新改动)
  - 之前:publicLog 写 "💊 女巫 X 解药救了 Y"
  - 现在:**女巫的解药/毒药操作只更新 privateMemory,完全不写 publicLog**
  - 好处:平民/狼都看不到女巫用了什么,女巫也不在白天发言里被强制公开
  - **这与之前的 Phase 9 相反**——最新版本选择隐私优先
- **自救规则**(板子相关)
  - 9 人场:仅首夜可自救(round>1 禁止)
  - 12 人场:首夜**不能**自救,其他夜可以

### 预言家规则(Phase 8A / 10 / 远端改进)

- **真预言家的 claim 必须准确**(防止 LLM 幻觉)
  - 真预言家识别**不依赖发言首句正则**(远端改进)—— 通过 seerChecks 数组判断
  - AI 发言后自动对比 `state.privateMemory.seerChecks`,覆盖错报
  - 悍跳狼的 claim 不校准(假情报照常记录)
- **全局最多 3 人起跳预言家**(跨所有轮次累积)
  - 第 4 个人起跳 → 静默忽略(不写入 seerClaims)
  - 已起跳的人更新 claim(可补充新查验)仍允许

### 狼人规则(Phase 1C / 2A / 2B)

- **每晚必杀**(单狼场景兑底)
  - 单狼 AI 返回 null target → 随机选非狼活人
- **最后 1 狼不能自爆**(自爆即输)
  - AI 不触发自爆 + 用户按钮 disabled
- **狼优势时不能无故自爆**
  - `aliveWolves > aliveGood / 2` → AI 不自爆 + 用户按钮 disabled
  - 劣势时:15% 概率
  - 持平:5% 概率

### 猎人规则(Phase 6B)

- **必须选目标**(不能不开枪)
  - UI 按钮"不开枪"是备选,但默认引导用户选一个
  - AI 必须选一个活人
- **被毒不能开**
  - `witchPoisonedId === hunterId` → 不触发 hunter-shoot

### 守卫规则

- **不能连守同一人**(P0-#5 修复)
  - 上一夜空守 → 本夜必须守一个非自己
- **同守同救抵消**(守卫 + 女巫同时保同一人 → 仍死)

### 骑士规则(Phase 6A / 狼队隐藏)

- **每天 25% 概率主动决斗**(讨论阶段)
- **结果**:
  - 对方是狼 → 对方死
  - 对方是好人 → 骑士自己死

### 狼王规则(Phase 2D / WolfKingPick)

- **被投后必选 victim**
  - 用户:UI 选一个活人
  - AI:prompt 建议"预言家嫌疑 > 女巫 > 不选狼队友"
- **死亡链**:狼王 → victim → 殉情 → 检查胜负

---

## 神职技能详解

### 预言家 🔮

- 每晚可查验一名玩家 → "好人"或"狼人"
- 公开报查验结果时**第一句**必须是"我是预言家"
- 真预言家的信息经 Phase 8A 自动校准,以系统记录为准

### 女巫 💊

- 1 瓶解药(救人) + 1 瓶毒药(杀人),整局各只能用 1 次
- 用药信息**完全私密**(最新版),其他玩家看不到
- 自救规则见上

### 猎人 🏹

- 被狼杀/被投/殉情死亡时 → 可开枪带走 1 人
- 被女巫毒杀 → 不能开枪

### 白痴 🤪

- 被投票放逐时 → 可翻牌免死(继续存活)
- 翻牌后失去投票权(但保留发言权)

### 骑士 ⚔️

- 白天发言时可发动 → 选 1 个玩家决斗
- 对方是狼 → 对方死
- 对方是好人 → 骑士自己死
- 整局只能用 1 次

---

## 警徽机制

### 产生(首轮)

- **第 1 天**白天,若 12 人场 + 没人是警长 → 触发 sheriff-election
- 6 步流程:register → speech → withdraw → vote →(可选)PK → 确认
- **非预言家不能刚警徽**(Phase 6D + Phase 10)
  - 首轮 + 候选人没在发言里跳预言家 → 强制退水
  - 已被全局 3 个起跳预言家占满 → 想跳也没位置
- **AI 30s 超时兑底**(远端):警长发言卡住时强制跳过

### 警长特权

- 投票权重 = **1.5 票**(警长 badge 自动加 0.5)
- 右侧栏投票详情显示 `⭐` 标记 + `(1.5票)`

### 警徽传承(Phase 6F)

当警长死亡时,进入 **sheriff-succession** 阶段:

| 警长阵营 | 选项 | 效果 |
|---|---|---|
| 好人 | **必须传给**(不能撕) | 选一个活人继承 |
| 狼人 | **撕**(流失) 或 **传** | AI:80% 概率传给狼队友,20% 撕 |

- 若警长选了"撕":
  - 警徽流失 → 下一轮重新警长竞选(若 12 人场)
  - 进入 night(若白天投票死)
- 若警长选了"传":
  - 继承人 isSheriff = true
  - 其他所有人 isSheriff = false
  - 进入 night

---

## 起跳与悍跳机制

### 起跳(Claim)

任意玩家发言时,系统检测以下关键字:

| 角色 | 触发模式 |
|---|---|
| 预言家 | 通过 seerChecks 数组自动判断(远端改进) |
| 女巫 | 通过 witchSavedId/witchPoisonedId 字段判断 |
| 守卫 | "守卫" / "我守了..." |

### 限制

- **预言家**:全局最多 3 人起跳(跨所有轮次,Phase 10)
- 起跳超过 3 人 → 静默忽略,不写入 seerClaims
- 已起跳的人更新 claim(可补充新查验)仍允许

### 悍跳(Counter-claim)

狼可伪装成预言家起跳。系统**不验证**起跳者是否真是预言家。

- 狼悍跳:报"X 号是好人"(保护狼队友)或"Y 号是狼"(拉好人票)
- 真预言家 vs 悍跳狼的区分:看查验历史 + 站边逻辑 + 发言一致性

---

## 死亡时机与延后结算(P13)

### 正常死亡(非第一天)

```
night → resolveNight → 写 publicLog → day-announce(显示昨夜死亡)
```

### 第一天延后(P13)

```
night 1(玩家死亡)
  └─ resolveNight 检测:day === 1 && needSheriff
  └─ 死亡存到 state.deferredDeaths(不写 publicLog)
  └─ phase 直接跳 'sheriff-election'

sheriff-election 结束(警徽落地)
  └─ applyDeferredDeaths 触发
  └─ 写 publicLog 死亡日志
  └─ phase 跳 'day-announce'

day-announce 显示死亡
  └─ day-discuss → day-vote → ...
```

**目的**:
- 让第一天夜死的真预言家、女巫、狼等还能**正常参加警徽竞选**
- 否则会出现"预言家首夜被刀 → 第二天警徽落地 → 预言家不在"的尴尬
- 这是标准狼人杀规则里的"延后揭晓"机制

---

## 右侧栏 UI 说明(Phase 12A)

InfoStream 自上而下 7 个**可折叠分区**(▶ 开关 + badge 计数):

1. **🗣️ 发言流** — 默认展开,**最近 20 条发言**,每个气泡带 phase 标签
   - 当前发言气泡黄色脉冲边框 + 自动滚到中央
   - **长发言(>80字)自动折叠** + "展开全部 (X字)" 按钮
   - phase 标签区分:白天 / 🕯️遗言 / ⚔️PK / ⭐竞选
   - 你的发言:紫色高亮

2. **⚖️ 法官信息** — 默认展开,系统事件(警长竞选、用药、撕警徽等)

3. **💀 死亡记录** — 默认折叠,所有公开死亡(最近 10 条)

4. **🗳️ 投票放逐** — 默认折叠,被投出的玩家列表

5. **📜 今日身份声明** — 默认折叠,谁跳了预言家/女巫/守卫

6. **📊 最近一次投票** — 默认展开,谁投了谁 + 票数 + 警长 ⭐(1.5票)

7. **📈 投票历史** — 默认折叠,跨所有轮次按目标分组 → 识别嫌疑阵营

**默认状态**:
- 发言流 / 法官信息 / 最近投票 展开
- 死亡记录 / 投票放逐 / 今日声明 / 投票历史 折叠

**好处**:不再需要滚动整个右侧栏就能看到关键信息;历史信息按需展开。

---

## 顶部状态条(Phase 12C)

更醒目、信息密度更大的状态条:

```
┌────────────────────────────────────────────────────────────┐
│  🎭  12人·预女猎白  [第3轮]               [X 退出]          │
│       👥 存活 9/12 · 🛡️ 预言家 · 你                         │
└────────────────────────────────────────────────────────────┘
```

- 渐变背景 + 紫色边框 + 阴影
- 板子名 + 轮数 badge(紫色填充)
- 一行信息:存活人数 chip + 角色 emoji + 角色名 + 玩家名
- 退出按钮加大

---

## 结束界面(Phase 12D)

游戏结束显示胜利面板:

- **大号胜利 emoji**(🌟/🐺/🎭) + 弹跳动画
- **胜利标题**(大字) + 胜利原因(pill chip)
- **角色分配网格** (3-4 列):
  - 每个玩家一张卡片:存活/死亡 + 玩家名 + 角色 + 阵营徽章(狼红/好人绿/第三方紫)
  - 你(用户)有 ⭐ 标记
- **按钮一字排开**:
  - `📋 复制对话日志`(发回给 Claude 调试)
  - `🔁 重玩此板子`
  - `🔄 换板子`

---

## 所有 Phase 修复总览

### Phase 1 — 关键 Bug(规则正确性)

| # | 主题 | 修复位置 |
|---|---|---|
| 1A | 预言家查验结果 outro 显示 | Game.tsx NightSceneDisplay |
| 1B | 死人不能投票 | Game.tsx DayVote |
| 1C | 单狼 AI null 兜底 | Game.tsx runAIAction |
| 1D | NightPanel 无夜行角色不卡死 | Game.tsx NightPanel useEffect |

### Phase 2 — 自爆规则 + UX

| # | 主题 |
|---|---|
| 2A | 最后 1 狼不能自爆 |
| 2B | 狼优势不能无故自爆 |
| 2C | 自爆高亮 banner(💥🌙)4s |
| 2D | 自爆走遗言阶段 |

### Phase 3 — 右侧栏 UX

| # | 主题 |
|---|---|
| 3A | 当前发言气泡脉冲高亮 + scrollIntoView |
| 3B | 最近投票详情面板 |
| 3C | 遗言/PK/警长 phase 标签分组 |

### Phase 4 — AI 发言质量

| # | 主题 |
|---|---|
| 4A | 近期发言从 6→10 条,带 ID 前缀 |
| 4B | 全局 commonRules 硬约束(首句引用具体编号) |

### Phase 5 — 死人观战统一组件

`DeadSpectator` 在所有 phase 都显示当前 phase + 进展 + 进度条 + 退出按钮

### Phase 6 — 7 项规则修复

| # | 主题 |
|---|---|
| 6A | 狼队目标夜间隐藏(publicLog 只显示"狼队已经行动") |
| 6B | 猎人射击 UI 反馈 + system 日志 |
| 6C | 女巫必须用药(AI 超时/不决策时强制使用) |
| 6D | 警长非预言家强制退水(首轮) |
| 6E | 每轮投票历史 + 嫌疑阵营分组 |
| 6F | 警徽传承(狼撕/传,好人传) |

### Phase 7 — 解决卡顿 + 进度条

| # | 主题 |
|---|---|
| 7A | DayDiscuss AI 45s 超时兜底(不再卡死) |
| 7B | DeadSpectator 加进度条 + 自动 busyHint |

### Phase 8 — 校准 + 强制

| # | 主题 |
|---|---|
| 8A | 真预言家 claim 自动用 seerChecks 覆盖(防 LLM 幻觉) |
| 8C | 女巫"假用"也强制覆盖(返回 false/null → 强制用) |

### Phase 9 — 女巫公开(后来被远端覆盖)

女巫用药后必须公开身份 + 操作(localLog 写 + 白天发言强制报)
**已被远端覆盖**:Phase 9 的"用药写 publicLog" 改成"完全私密",女巫不再被强制公开。

### Phase 10 — 全局起跳上限

12 人场全局最多 3 人起跳预言家(跨所有轮次累积)

### Phase 11 — 死者退出 + 警长防御

| # | 主题 |
|---|---|
| 11A | DeadSpectator 加 `🚪 退出本局` 按钮(window.confirm 确认) |
| 11B | 警长退水前必须确认所有候选人都发过言,否则按钮 disabled + 红色警告 |

### Phase 12 — UI 优化(美观 + 无滚动)

| # | 主题 |
|---|---|
| 12A | InfoStream 7 个分区全部可折叠(▶ 开关 + badge 计数),发言流默认展开 |
| 12B | SpeechBubble 紧凑化(头像 28px、padding 减小)+ 长发言(>80字)自动折叠 |
| 12C | 顶部状态条加大 + 渐变 + 信息密度增加(存活数 + 角色 + 玩家名) |
| 12D | GameOver 卡片化(网格展示角色分配,带阵营徽章)+ DeadSpectator 视觉升级 |

### Phase 13 — 第一天死亡延后结算(远端新增)

- resolveNight 检测 `day === 1 && needSheriff` → 死亡存 `deferredDeaths`,跳 sheriff-election
- 警徽落地后 `applyDeferredDeaths` → 写 publicLog → 进 day-announce
- 目的:让首夜死的玩家(包括真预言家/女巫/狼)还能参加警徽竞选

### Phase 16 — 全 AI 观看模式(远端新增)

- BoardSelect 加"观看 AI 对局" 选项
- `spectatorMode: true` → `userId = -1`,所有玩家都是 AI
- 进入时显示所有 AI 角色分配(可看到谁是预言家)
- 跳过所有用户行动 UI
- 死后不触发 DeadSpectator
- 适合研究 AI 博弈 / 看 LLM 怎么玩

### 远端其他修复

| 主题 | 说明 |
|---|---|
| 真预言家识别不依赖发言首句正则 | 改为通过 seerChecks 数组判断,更准确 |
| 警长 AI 发言 30s 超时兜底 | 警长竞选阶段 AI 卡住时强制跳过 |
| 女巫用药信息完全私密 | 之前 P9 写 publicLog + 强制公开 → 现在完全不写,女巫也不公开 |

---

## 开发指南

### 文件结构

```
src/components/life/werewolf/
├── Game.tsx       # 主 UI + ~4500 行所有 phase 组件
├── engine.ts      # 状态机 + AI 调用封装(770+ 行)
├── data.ts        # 角色/板子/性格/状态常量(342 行)
└── Personalities.tsx  # 性格小标签组件(26 行)
```

### 关键函数(`engine.ts`)

| 函数 | 作用 |
|---|---|
| `initGame(boardId, userName, lang, spectatorMode)` | 初始化 GameState(spectatorMode 默认 false) |
| `loadAIConfig()` | 从 aiStore 读 API key/baseURL/model |
| `callAIStream(cfg, sys, usr, onToken)` | 流式调用 LLM |
| `applyWitchAction(s, witchId, useAntidote, poisonTarget, lang)` | 应用女巫行动(最新版完全私密,不写 publicLog) |
| `applyKnightDuel(s, knightId, targetId, lang)` | 骑士决斗 |
| `applyWolfSelfDestruct(s, wolfId, lang)` | 狼自爆 → 走 last-words(Phase 2D) |
| `checkWinner(state)` | 判定胜负 |
| `killPlayers(state, ids, reason, killer)` | 统一死亡处理(清 isSheriff + 触发殉情 + 写 lastVotedOut) |
| `killPlayers` 同时检测**警长死亡** → 设置 `pendingSheriffSuccession`(Phase 6F) |
| `applyLoversChain(state, newlyDead)` | 情侣殉情 |
| `aggregateWolfVotes(state, wolfIds, votes)` | 狼队投票聚合(严格多数 >50%) |
| `sheriffVoteWeight(state, voterId)` | 警长 1.5 票权重 |
| `canWitchSelfSave(boardCount, round, isSelf)` | 女巫自救规则 |
| `canVote(player)` | 是否能投票(alive + !idiotFlipped) |
| `applyDeferredDeaths(state, lang)` | P13:警长落地后应用延后的死亡 |

### GameState 关键字段

```ts
interface GameState {
  // 基础
  boardId: BoardId;
  round: number;
  phase: Phase;
  players: Player[];
  userId: number;        // 观看模式时为 -1
  lang: 'zh' | 'en';

  // 当晚/当日死亡
  deadThisNight: number[];
  deadThisDay: number | null;
  lastVotedOut: number | null;

  // 投票
  pkPlayers: number[] | null;
  pkUsed: boolean;
  lastVoteData: { allVotes, tally, exiled, tied? } | null;
  voteHistory: Array<{round, allVotes, tally, exiled}>;  // P6E

  // 胜负
  winner: Faction | null;

  // 日志
  publicLog: { kind: 'speech'|'death'|'system', text, day, playerId? }[];
  speeches: SpeechRecord[];

  // 警长
  sheriffElection?: { registeredIds, withdrawnIds, pkRound, speechIdx };
  sheriffSpeechOrder?: { direction, startFromDeathId };
  sheriffEndorsement: number | null;
  pendingSheriffSuccession: number | null;  // P6F

  // 女巫
  lastWitchAction: {savedId, poisonedId, byPlayerId, announced} | null;  // P9

  // 狼王
  wolfkingVictim: number | null;

  // 狼投票
  wolfVotes: number[];

  // 起跳/悍跳
  claims: ClaimsByDay;

  // 用户标记
  userMarks: Record<number, string>;

  // 待发言遗言
  pendingLastWords: number[];

  // P13:延后结算的死亡(第一天夜死但警徽未落地)
  deferredDeaths: number[];

  // P16:全 AI 观看模式
  spectatorMode: boolean;
}
```

### Phase 字符串枚举(`data.ts`)

```ts
type Phase =
  | 'setup' | 'role-reveal'
  | 'night' | 'night-resolve'
  | 'day-announce' | 'sheriff-election' | 'sheriff-pick-order'
  | 'knight-duel' | 'day-discuss' | 'day-vote'
  | 'vote-results' | 'pk-speech' | 'pk-vote'
  | 'hunter-shoot' | 'idiot-flip' | 'last-words' | 'wolfking-pick'
  | 'sheriff-succession'  // P6F
  | 'judge' | 'gameover';
```

### 调试技巧

1. **查看 AI 选择的查验**:打开 DevTools Console,输入
   ```js
   JSON.parse(sessionStorage.getItem('ai-tools-launcher.werewolf.state.v1')).players
     .find(p => p.role === 'seer').privateMemory.seerChecks
   ```
2. **清空游戏状态**:`sessionStorage.removeItem('ai-tools-launcher.werewolf.state.v1')`
3. **强制进入特定阶段**:在 GameRunner 临时改 `state.phase`,不推荐(可能破坏不变量)
4. **切换观看模式**:BoardSelect 选 "👁️ 观看 AI 对局" 按钮

---

## 玩家操作手册

### 你是预言家

1. 夜晚看到 "🔮 预言家请睁眼" → 选 1 个活人查验
2. 第二天白天**第一句**说"我是预言家,昨晚我验了 X 号,他是 [狼/好人]"
3. 后续白天发言基于你的查验推理

### 你是女巫

1. 夜晚看到"💊 女巫"界面
2. 解药 checkbox(救人) + 毒药按钮(选人杀)
3. 用药**完全私密** — 其他玩家不知道你用了什么
4. 自救:12 人场首夜不能救自己

### 你是猎人

- 死亡时(被狼杀/被投)会自动进入 🏹 选目标界面
- 选 1 个活人开枪 → 对方和你一起死(连续)
- 被毒杀 → 不能开枪

### 你是狼

1. 夜晚选 1 个非狼活人杀(自爆按钮在白天,规则见上)
2. 白天可以悍跳预言家/女巫/守卫(制造混乱)
3. 警长竞选 40% 概率报名抢警徽
4. 投票跟狼队友(投票详情可看出)

### 你是好人村民/神职

- 听预言家/女巫发言,站边
- 投票跟逻辑走,不要被狼带节奏
- 死前留遗言

### 你是观众(观看模式)

- 享受 12 个 AI 互相博弈
- 一开始就知道所有角色(包括真预言家是哪个)
- 看 AI 怎么悍跳、怎么投票、怎么撕警徽

### 通用提示

- 右侧栏发言气泡**当前发言黄色脉冲** + 自动滚到中央
- 投票详情可看"投同一目标的人" → 嫌疑阵营
- 死了有 🚪 退出本局 按钮(不用强行看完)
- 长发言气泡有"展开全部"按钮

---

## 已知遗留问题(暂未修)

| 问题 | 状态 | 备注 |
|---|---|---|
| `sheriffSpeechOrder` 字段死代码 | 未用 | 可在 Phase 6F 警长传承后实现"警长选发言顺序" |
| `aggregateWolfVotesLegacy` 死函数 | 未用 | 旧签名兼容,保留 |
| `orderedSpeakers` 死函数 | 未用 | 同上 |
| 4 个 coming-soon 板子暂未实现 | 占位 | 需要 data.ts + 引擎扩展 |
| Game.tsx ~4500 行超大文件 | 未拆 | 可按 phase 拆到子目录 |
| 单元测试 | 无 | 项目无测试基建 |

---

## 版本

- 当前版本:v1.2(累计 16 个 Phase 修复 + Phase 12 UI 优化)
- v1.1:11 个 Phase 修复
- v1.0:初始 64 工具 + 狼人杀模块
- 维护者:AI Tools Launcher Team
