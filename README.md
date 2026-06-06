# AI Tools Launcher

> 一个聚合 64 个 AI 工具的 Web 启动器。卡片式导航,3 套主题,中英双语,接 OpenAI / Anthropic / 自定义 baseURL,流式响应。

![Tech](https://img.shields.io/badge/React-19-61dafb?logo=react)
![Tech](https://img.shields.io/badge/TypeScript-6-3178c6?logo=typescript)
![Tech](https://img.shields.io/badge/Vite-8-646cff?logo=vite)
![Tech](https://img.shields.io/badge/Tailwind-4-38bdf8?logo=tailwindcss)

## ✨ 主要特性

- **64 个 AI 工具 / 8 个分类** — 热门 / 文本 / 图像 / 音频 / 视频 / 编程 / 办公 / 生活
- **多 Provider LLM** — OpenAI / Anthropic Claude / 自定义 OpenAI-compatible baseURL,支持流式响应、DALL-E 图像、Whisper ASR、OpenAI TTS、浏览器原生 TTS 兜底
- **3 套主题 + 16 色调色板** — 深色香槟金 / 浅色古铜 / 科技蓝,可自定义主色
- **本地 Auth 系统** — admin / user / banned 三种角色,收藏夹,管理员后台
- **i18n** — 简体中文 / English,UI 框架与工具数据双覆盖
- **细节动效** — 卡片 3D tilt、ripple 点击波、card shine 扫光、面板 enter 动画
- **搜索** — 150ms debounce、跨分类搜索、匹配文字高亮
- **收藏** — 卡片右上角 ♡,设置里切到"仅收藏"模式只看常用
- **键盘可达** — `⌘K` 聚焦搜索、`⌘Shift+T` 循环主题、侧边栏 `↑↓/Home/End/Enter` 导航
- **代码分块** — 生产构建按分类懒加载,首屏 bundle 仅 ~77KB(gzip 21KB)

## 🚀 快速开始

```bash
npm install
npm run dev        # 启动开发服务器 (默认 http://127.0.0.1:5173)
npm run build      # 生产构建 (输出到 dist/)
npm run preview    # 预览生产构建
npm run lint       # ESLint
```

环境要求:Node.js ≥ 18。

## 📁 目录结构

```
src/
├── App.tsx                    顶层 shell,串起 Sidebar / Header / MainContent
├── main.tsx                   入口
├── index.css                  Tailwind v4 + 3 套主题 CSS 变量 + 全局 keyframes
├── data/
│   └── tools.ts               64 个工具 + 8 个分类的元数据(中英双语)
├── hooks/
│   ├── useSettings.ts         主题/密度/语言/主色设置(模块级 store + listener)
│   ├── useAuth.tsx            本地账号系统(角色/收藏/会话恢复)
│   ├── useAI.ts / useAIStream.ts  AI 客户端封装(流式)
│   ├── useDebounce.ts         通用 debounce
│   ├── useI18n.ts             国际化 hook
│   └── usePomodoro.ts         番茄钟工具的状态
├── lib/
│   └── ai.ts                  OpenAI / Anthropic / TTS / ASR / 图像生成
├── i18n/
│   └── strings.ts             UI 框架的 i18n 字符串
└── components/
    ├── Sidebar.tsx            左侧分类导航(键盘可达)
    ├── Header.tsx             顶部搜索 + 主题切换 + AI 设置入口
    ├── MainContent.tsx        工具卡片网格 + 面板调度
    ├── ToolCard.tsx           单个工具卡片(3D tilt + ripple + 收藏)
    ├── ToolPanel.tsx          工具运行的弹窗容器
    ├── AuthPanel.tsx          登录 / 注册
    ├── AdminPanel.tsx         管理员后台
    ├── Highlight.tsx          搜索匹配文字高亮
    ├── ui/
    │   ├── Button.tsx         按钮系统(5 变体 × 3 尺寸 + 语义化包装)
    │   └── AIOutputModal.tsx  AI 输出的标准弹窗
    ├── Settings/
    │   ├── SettingsPanel.tsx  设置弹窗(通用/外观/通知/关于)
    │   └── ApiKeyPanel.tsx    AI Provider / Key 配置
    ├── life/                  生活类工具(饮食/运动/心理/用药/起名/解梦)
    ├── text/                  文本 + 编程类工具
    ├── media/                 图像/音频/视频类工具
    └── productivity/          办公类工具(番茄钟/Excel/PPT/导图/...)
```

## 🔑 AI Key 配置

首次使用 AI 类工具时,点击右上角 **AI 按钮**(脉冲提示)→ 配置:

- **Provider**:`openai` / `anthropic` / `custom`(自填 baseURL)
- **API Key**:本地 XOR 混淆存储(注意:不是真正的加密,任何同源脚本可见,仅防偶然窥探)
- **Model**:可指定,留空使用 provider 默认

支持在多 provider 间切换,设置里也能直接测试连接。

## 🌐 生产环境 CORS / 流式代理

绝大多数 AI provider(MiniMax、DeepSeek、Moonshot、火山方舟…)都不允许浏览器直接跨域调用。开发环境用 Vite dev server 自带的 `/proxy/*` 路径绕开;**生产环境**需要部署一个 Cloudflare Worker(或 nginx / 同类反代)替换这条路径。

### 一键部署 Cloudflare Worker

```bash
npm i -g wrangler          # 或直接 npx
npx wrangler login         # 一次性登录
npm run deploy:proxy       # 部署 proxy/worker.js
```

部署成功后会拿到一个 URL:`https://ai-tools-proxy.<你的子域>.workers.dev`。

### 在 App 里配 BASE URL

把这个 URL 拼到 `/proxy/<provider>/...` 前面:

| 厂商 | 完整 BASE URL 示例 |
|---|---|
| MiniMax(Anthropic 兼容) | `https://ai-tools-proxy.<sub>.workers.dev/proxy/minimaxi/anthropic/v1` |
| DeepSeek | `https://ai-tools-proxy.<sub>.workers.dev/proxy/deepseek/v1` |
| OpenAI | `https://ai-tools-proxy.<sub>.workers.dev/proxy/openai/v1` |
| Anthropic | `https://ai-tools-proxy.<sub>.workers.dev/proxy/anthropic/v1` |

开发环境用 `npm run dev` 起来时,Vite 自带的 `/proxy/*` 转发,直接填 `/proxy/minimaxi/anthropic/v1` 就够了(相对路径,无需起 Worker)。**两套相对/绝对 URL 自动适配,代码无需切换**。

### 路由表(改 `proxy/worker.js` 里的 `ROUTES` 数组即加新厂商)

| Worker 路径前缀 | 转发到 |
|---|---|
| `/proxy/minimaxi/*` | `https://api.minimaxi.com/*` |
| `/proxy/deepseek/*` | `https://api.deepseek.com/*` |
| `/proxy/openai/*` | `https://api.openai.com/*` |
| `/proxy/anthropic/*` | `https://api.anthropic.com/*` |

免费额度:每天 10 万次请求,流式响应完整支持(SSE `event`/`data` 头经 `Access-Control-Expose-Headers: *` 透传)。


## 🎨 主题

设置 → 外观:

| 主题 | 主色 | 背景 |
|---|---|---|
| Dark(深色) | 香槟金 `#c9a961` | `#0a0a0c` |
| Light(浅色) | 古铜 `#8a6d2c` | `#f7f7f8` |
| Cyber(科技蓝) | 电光蓝 `#00d4ff` | `#050810` + 扫描线 |

主色调色板 16 色 + 自定义取色器。

## 🤝 贡献

欢迎提 PR。新增工具的标准流程:

1. 在 `data/tools.ts` 加条目(中英双语 name / desc / tags)
2. 在对应的 `components/{category}/*Tools.tsx` 实现 React 组件
3. 在文件末尾的 `*_TOOLS` 注册表里挂上 `{ Component, icon }`
4. `tsc -b` 和 `vite build` 都应通过

## 📄 License

MIT
