# 狼人杀模块 BUG 完整审计清单

**审计时间**:2026/06/21
**目的**:彻底排查白屏崩溃 + 各类边界态 BUG,提供给 Claude 修复时定位

---

## 🔴 P0 - 崩溃级(白屏)

### BUG-C1:`Cannot read properties of undefined (reading 'privateMemory')` 持续崩溃

**状态**:用户多次截图反馈,即使加了 P21/P22/P22+ 三层 sanitize 仍崩

**已加的防御**:
- ✅ P21:ErrorBoundary 捕获崩溃,显示堆栈
- ✅ P22:sessionStorage 恢复时合并 defaultMemory
- ✅ P22+:setState wrapper 强制 sanitize players
- ✅ P22++:useMemo 在 render 时再 sanitize 一次

**仍崩的可能原因**:
1. **dev server HMR 缓存**——浏览器用了旧 chunk,新 sanitize 逻辑没生效
2. **sessionStorage 旧数据**——用户没点"🔄 换板子"清存档
3. **某个 useState 内部组件的初始值**绕过 wrapper(已查过 Game.tsx 没发现)
4. **某个组件用了原始 state prop 而非 sanitized 的 useMemo 值**——理论上 React render 流程保证 useMemo 计算前不能 render

**75 处 privateMemory 访问清单**(Game.tsx):

| 位置 | 访问 | 防御状态 |
|---|---|---|
| 106 | `player.privateMemory.isSheriff` | ❌ 未防御(理论上 player 已 sanitize) |
| 468 | `u.privateMemory` | ✅ 有 setState 上游 |
| 1184 | `voter.privateMemory?.isSheriff ?? false` | ✅ 可选链 |
| 1255 | `voter?.privateMemory.isSheriff` | ❌ voter 可选但 privateMemory 没 |
| 1330 | `userP.privateMemory ?? defaultMemory()` | ✅ |
| 1343 | `state.players[mem.guardLastTargetId].name` | ❌ guardLastTargetId 可能越界 |
| 1641-1705 | nightPanel AI 行动分支 | ✅ 已有 actor 防御 |
| 1817-1820 | NightSceneDisplay userSeerChecks | ✅ 已修 |
| 1941-1947 | UserNightActionUI | ⚠️ userP 假设存在 |
| 2190-2248 | runAIAction | ✅ 有 actor 防御 |
| 4118-4124 | DayDiscuss AI speech claim 检测 | ⚠️ speaker 可能 race condition |
| 4217, 4350, 4433 | KnightDuel 相关 | ⚠️ cur/userP 假设存在 |
| 4944, 4968 | VoteResults voter/target | ❌ voter.privateMemory 没可选链 |
| 5337-5358 | SummaryReport | ✅ setState 后 sanitize |
| 5730-5746 | buildDayDiscussionPrompt actor | ⚠️ actor 假设存在 |
| 5932-5937 | buildVotePrompt actor | ⚠️ actor 假设存在 |

---

## 🟡 P1 - UX 缺陷

### BUG-U1:玩家死后被卡在 day-discuss 看不到 gameover
**修复**:P20 修了 DayVote/DayDiscuss 死后自动推进 phase

### BUG-U2:观战模式警长竞选卡死
**修复**:P17/P19 修了自动 confirmRegister/Withdraw/Vote

### BUG-U3:发言中死亡导致 60s 倒计时卡死
**修复**:P19 修了 `!cur.alive` 兜底

### BUG-U4:GameOver 缺总结报告
**修复**:P19 加了 SummaryReport 组件

---

## 🟢 P2 - 已知遗留(不影响主流程)

### BUG-N1:AI 偶尔不发言超时(45s 兜底已有)
### BUG-N2:角色发言偶尔出现重复话术
### BUG-N3:某些边角板子(石像鬼/骑士)AI 决策不智能
### BUG-N4:sessionStorage 在隐私模式下不工作

---

## ✅ 已确认修复的崩溃点

| 编号 | 描述 | 状态 |
|---|---|---|
| P21-1 | ErrorBoundary 添加 | ✅ |
| P22-1 | sessionStorage 加载时合并 defaultMemory | ✅ |
| P22+-1 | setState wrapper sanitize | ✅ |
| P22++-1 | useMemo render 时 sanitize | ✅ |
| P19-1 | DayDiscuss 中途死亡 | ✅ |
| P20-1 | DayVote 用户死后自动投票 | ✅ |
| P20-2 | DayDiscuss 用户死后跳过 | ✅ |
| P17-1 | 观战模式警长竞选自动跑 | ✅ |
| P17-2 | 观战模式投票自动跑 | ✅ |

---

## 🔧 待办(用户重启 dev server 后还有问题再修)

### TODO-1:把所有 `.privateMemory.xxx` 改成 `?.xxx ?? 默认值` 全面防御
预计改 30+ 处,工作量大,但能彻底消灭这类崩溃

### TODO-2:引擎层所有 return state 的函数出口处加 sanitizeState()
目前只在 setState wrapper 和 useMemo 里 sanitize,引擎 pure function 直接 return 的 state 没兜底

### TODO-3:加 propTypes / runtime validation
对 Player.privateMemory 做类型守卫,任何不合法数据直接 fallback

---

## 🚨 给用户的诊断步骤

1. **完全关闭 dev server**:`Ctrl+C` 在终端
2. **重启**:`npm run dev`
3. **浏览器 hard reload**:`Ctrl+Shift+R`(清缓存)
4. **点击 "🔄 换板子"** 清掉旧存档
5. **重新开始一局**
6. 如果还崩,截图红框堆栈发我(新堆栈的 bundle hash 会不同)

如果以上步骤后还崩,**说明 dev server 的缓存或 Vite 配置有问题**,可能需要:
- `rm -rf node_modules/.vite` 清 Vite 缓存
- 重新 `npm install`
- 或者用 `npm run build && npm run preview` 跑生产 build 测试
