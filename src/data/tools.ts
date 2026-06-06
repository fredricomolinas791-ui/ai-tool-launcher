import {
  Flame,
  FileText,
  Image,
  Music,
  Video,
  Code,
  Wand2,
  Mic,
  Languages,
  Film,
  Sparkles,
  PenTool,
  ScanLine,
  Database,
  Terminal,
  LayoutGrid,
  Volume2,
  Bug,
  Globe,
  MessageSquare,
  Type,
  Copy,
  AlignLeft,
  ListChecks,
  Presentation,
  QrCode,
  BarChart3,
  Calendar,
  Clock,
  MapPin,
  Calculator,
  Wallet,
  TrendingUp,
  Target,
  Dumbbell,
  Heart,
  Brain,
  Bot,
  Network,
  Briefcase,
  Box
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface Category {
  id: string;
  name: { zh: string; en: string };
  icon: LucideIcon;
  desc: { zh: string; en: string };
}

export interface Tool {
  id: number;
  name: { zh: string; en: string };
  desc: { zh: string; en: string };
  icon: LucideIcon;
  tags: { zh: string; en: string }[];
  hot?: boolean;
  trending?: boolean;
}

export const categories: Category[] = [
  { id: 'hot', name: { zh: '热门工具', en: 'Hot Tools' }, icon: Flame, desc: { zh: '最受欢迎的AI工具', en: 'Most popular AI tools' } },
  { id: 'text', name: { zh: '文本工具', en: 'Text Tools' }, icon: FileText, desc: { zh: '文字处理与生成', en: 'Writing and generation' } },
  { id: 'image', name: { zh: '图像工具', en: 'Image Tools' }, icon: Image, desc: { zh: '图片创作与编辑', en: 'Image creation & editing' } },
  { id: 'audio', name: { zh: '音频工具', en: 'Audio Tools' }, icon: Music, desc: { zh: '语音与音乐处理', en: 'Voice & music' } },
  { id: 'video', name: { zh: '视频工具', en: 'Video Tools' }, icon: Video, desc: { zh: '视频创作与编辑', en: 'Video creation & editing' } },
  { id: 'code', name: { zh: '编程工具', en: 'Code Tools' }, icon: Code, desc: { zh: '开发者效率工具', en: 'Developer productivity' } },
  { id: 'productivity', name: { zh: '办公效率', en: 'Productivity' }, icon: Briefcase, desc: { zh: '日常办公辅助', en: 'Office helpers' } },
  { id: 'life', name: { zh: '趣味铺子', en: 'The Quirky Curio Shop' }, icon: Sparkles, desc: { zh: '趣味杂货,玄思妙想', en: 'Curio of wonders, from names to tarot' } },
];

export const toolsByCategory: Record<string, Tool[]> = {
  hot: [
    { id: 1, name: { zh: 'GPT-4o 超级对话', en: 'GPT-4o Chat' }, desc: { zh: 'OpenAI最新旗舰模型，支持多模态推理，理解能力超强，适用于复杂对话、代码编写、创意生成等场景', en: 'OpenAI\'s flagship multimodal model with strong reasoning for complex chat, code, and creative tasks' }, icon: Bot, tags: [{ zh: '官方推荐', en: 'Official pick' }, { zh: '最强性能', en: 'Top performance' }], hot: true, trending: true },
    { id: 2, name: { zh: 'Midjourney 出图', en: 'Midjourney' }, desc: { zh: 'AI图像生成领域的标杆，擅长风格化艺术创作，支持--v参数切换版本', en: 'A benchmark in AI image generation, excels at stylized art with --v version parameters' }, icon: Image, tags: [{ zh: '图像生成', en: 'Image gen' }, { zh: '艺术创作', en: 'Art' }], hot: true, trending: true },
    { id: 3, name: { zh: 'DeepSeek 对话', en: 'DeepSeek Chat' }, desc: { zh: '国产大模型性价比之王，数学推理和代码能力出色，开源可商用', en: 'Top value open-source model, strong math and code, free for commercial use' }, icon: Brain, tags: [{ zh: '国产之光', en: 'Open source' }, { zh: '开源免费', en: 'Free' }], hot: true, trending: true },
    { id: 4, name: { zh: 'ElevenLabs 语音', en: 'ElevenLabs Voice' }, desc: { zh: '业界最佳的语音合成，支持28种语言，情感表达自然，可克隆声音', en: 'Best-in-class TTS supporting 28 languages with natural emotion and voice cloning' }, icon: Volume2, tags: [{ zh: '语音合成', en: 'TTS' }, { zh: '高端品质', en: 'Premium' }], hot: true },
    { id: 5, name: { zh: 'Cursor AI 编程', en: 'Cursor AI' }, desc: { zh: 'AI增强版VS Code，代码补全、解释、重构一把手，适合全栈开发', en: 'AI-enhanced VS Code for completion, explanation and refactoring — great for full-stack' }, icon: Code, tags: [{ zh: '编程神器', en: 'Coding' }, { zh: '效率提升', en: 'Productivity' }], hot: true },
    { id: 6, name: { zh: 'Claude 3.5 写作', en: 'Claude 3.5' }, desc: { zh: 'Anthropic出品，长文本处理和写作质量一流，适合论文、文章创作', en: 'From Anthropic, top-tier long-form writing quality, ideal for essays and articles' }, icon: PenTool, tags: [{ zh: '写作神器', en: 'Writing' }, { zh: '深度思考', en: 'Reasoning' }], hot: true },
    { id: 7, name: { zh: 'Suno 音乐生成', en: 'Suno Music' }, desc: { zh: 'AI音乐创作神器，输入歌词即可生成完整歌曲，支持多种风格', en: 'Generate full songs from lyrics across many styles' }, icon: Music, tags: [{ zh: '音乐创作', en: 'Music' }, { zh: '创新体验', en: 'Creative' }], trending: true },
    { id: 8, name: { zh: 'Pika 视频生成', en: 'Pika Video' }, desc: { zh: '文字生成视频工具，支持多种比例，简单易用', en: 'Text-to-video tool with multiple aspect ratios, easy to use' }, icon: Film, tags: [{ zh: '视频生成', en: 'Video gen' }, { zh: '创意神器', en: 'Creative' }] },
  ],
  text: [
    { id: 9, name: { zh: '智能写作', en: 'Smart Writer' }, desc: { zh: '根据需求生成各类文案，支持文章、脚本、邮件等多种文体，风格可调', en: 'Generate articles, scripts, emails and more with adjustable style' }, icon: PenTool, tags: [{ zh: '写作', en: 'Writing' }, { zh: '文案', en: 'Copy' }] },
    { id: 10, name: { zh: '文章摘要', en: 'Article Summary' }, desc: { zh: '长文本一键提取关键信息，生成精炼摘要，支持多种格式输出', en: 'Extract key points and produce concise summaries in multiple formats' }, icon: AlignLeft, tags: [{ zh: '摘要', en: 'Summary' }, { zh: '阅读辅助', en: 'Reading' }] },
    { id: 11, name: { zh: '语法检查', en: 'Grammar Check' }, desc: { zh: '智能纠错润色，提升文章质量，支持英文及其他语言', en: 'Smart proofreading and polishing, supports English and more' }, icon: ListChecks, tags: [{ zh: '纠错', en: 'Proofread' }, { zh: '润色', en: 'Polish' }] },
    { id: 12, name: { zh: 'OCR图文识别', en: 'OCR' }, desc: { zh: '印刷体、手写体均可识别，支持表格公式，免费使用', en: 'Recognize printed and handwritten text, tables and formulas, free to use' }, icon: ScanLine, tags: [{ zh: '识别', en: 'OCR' }, { zh: '提取', en: 'Extract' }] },
    { id: 13, name: { zh: '翻译助手', en: 'Translator' }, desc: { zh: '支持100+语言互译，保留原文风格语境，专业术语准确', en: 'Translate 100+ languages while preserving style and terminology' }, icon: Languages, tags: [{ zh: '翻译', en: 'Translate' }, { zh: '多语言', en: 'Multilingual' }] },
    { id: 14, name: { zh: '对话聊天', en: 'Chat Bot' }, desc: { zh: '智能对话系统，回答各类问题，可定制角色和风格', en: 'Conversational AI that answers questions with custom roles and styles' }, icon: MessageSquare, tags: [{ zh: '对话', en: 'Chat' }, { zh: '问答', en: 'Q&A' }] },
    { id: 15, name: { zh: '周报生成', en: 'Weekly Report' }, desc: { zh: '用一句话描述工作内容，自动生成专业周报，省时省力', en: 'Turn a one-line update into a polished weekly report' }, icon: FileText, tags: [{ zh: '办公', en: 'Work' }, { zh: '效率', en: 'Efficiency' }] },
    { id: 16, name: { zh: '标题生成', en: 'Title Generator' }, desc: { zh: '根据内容自动生成吸引眼球的标题，多种风格可选', en: 'Auto-generate eye-catching titles in multiple styles' }, icon: Type, tags: [{ zh: '标题', en: 'Title' }, { zh: '吸睛', en: 'Catchy' }] },
    { id: 17, name: { zh: '简历优化', en: 'Resume Polish' }, desc: { zh: '分析简历内容，提供改进建议，提升面试机会', en: 'Analyze your resume and suggest improvements to land more interviews' }, icon: Copy, tags: [{ zh: '求职', en: 'Job' }, { zh: '职场', en: 'Career' }] },
    { id: 18, name: { zh: '思维导图', en: 'Mind Map' }, desc: { zh: '输入主题自动生成思维导图结构，方便梳理思路', en: 'Generate a mind map from any topic to organize your thoughts' }, icon: Network, tags: [{ zh: '导图', en: 'Map' }, { zh: '梳理', en: 'Outline' }] },
  ],
  image: [
    { id: 19, name: { zh: 'AI绘画', en: 'AI Painter' }, desc: { zh: '文生图创作，支持多种风格，细节丰富意境到位', en: 'Text-to-image creation with rich styles and fine details' }, icon: Wand2, tags: [{ zh: '绘画', en: 'Paint' }, { zh: '创作', en: 'Create' }] },
    { id: 20, name: { zh: '图片修复', en: 'Photo Restore' }, desc: { zh: '老照片修复上色，去除噪点和划痕，还原珍贵回忆', en: 'Restore and colorize old photos, remove noise and scratches' }, icon: Sparkles, tags: [{ zh: '修复', en: 'Restore' }, { zh: '老照片', en: 'Vintage' }] },
    { id: 21, name: { zh: '背景去除', en: 'Background Remover' }, desc: { zh: '一键智能抠图，边缘精细，支持批量处理', en: 'One-click smart cutout with fine edges, batch supported' }, icon: ScanLine, tags: [{ zh: '抠图', en: 'Cutout' }, { zh: '电商', en: 'E-com' }] },
    { id: 22, name: { zh: '风格迁移', en: 'Style Transfer' }, desc: { zh: '图生图风格转换，毕加索梵高任意切换', en: 'Image-to-image style transfer, Picasso to Van Gogh' }, icon: LayoutGrid, tags: [{ zh: '风格', en: 'Style' }, { zh: '艺术', en: 'Art' }] },
    { id: 23, name: { zh: '画质增强', en: 'Image Upscale' }, desc: { zh: '分辨率提升，模糊变清晰，老图重获新生', en: 'Boost resolution and clarity, give old images a new life' }, icon: TrendingUp, tags: [{ zh: '增强', en: 'Upscale' }, { zh: '超分', en: 'HD' }] },
    { id: 24, name: { zh: '商品海报', en: 'Product Poster' }, desc: { zh: '输入产品信息，自动生成吸睛海报', en: 'Generate eye-catching posters from product info' }, icon: Presentation, tags: [{ zh: '电商', en: 'E-com' }, { zh: '营销', en: 'Marketing' }] },
    { id: 25, name: { zh: '二维码美化', en: 'QR Art' }, desc: { zh: '普通二维码秒变艺术作品，支持logo嵌入', en: 'Turn plain QR codes into art with logo embedding' }, icon: QrCode, tags: [{ zh: '创意', en: 'Creative' }, { zh: '美化', en: 'Stylish' }] },
    { id: 26, name: { zh: '模特试穿', en: 'Model Try-On' }, desc: { zh: '上传衣服照片，AI生成上身效果图', en: 'Upload clothing photos, AI generates model try-on results' }, icon: Dumbbell, tags: [{ zh: '电商', en: 'E-com' }, { zh: '试穿', en: 'Try-on' }] },
  ],
  audio: [
    { id: 27, name: { zh: '文字转语音', en: 'Text to Speech' }, desc: { zh: '多音色选择，支持情绪调节，听感自然流畅', en: 'Multiple voices with emotion control and natural delivery' }, icon: Volume2, tags: [{ zh: 'TTS', en: 'TTS' }, { zh: '配音', en: 'Voiceover' }] },
    { id: 28, name: { zh: '语音转文字', en: 'Speech to Text' }, desc: { zh: '会议录音秒出文字，准确率高，支持方言', en: 'Convert meeting audio to accurate text with dialect support' }, icon: Mic, tags: [{ zh: 'STT', en: 'STT' }, { zh: '转录', en: 'Transcribe' }] },
    { id: 29, name: { zh: 'AI歌曲创作', en: 'AI Song Maker' }, desc: { zh: '输入歌词选择风格，生成完整歌曲和伴奏', en: 'Generate full songs with accompaniment from lyrics' }, icon: Music, tags: [{ zh: '音乐', en: 'Music' }, { zh: '创作', en: 'Create' }] },
    { id: 30, name: { zh: '音色克隆', en: 'Voice Cloning' }, desc: { zh: '少量样本即可克隆声音，用于合成新内容', en: 'Clone a voice from a small sample for new content' }, icon: Bot, tags: [{ zh: '克隆', en: 'Clone' }, { zh: '黑科技', en: 'Cutting edge' }] },
    { id: 31, name: { zh: '背景降噪', en: 'Noise Reduction' }, desc: { zh: '音频降噪处理，人声保真，还原清晰声音', en: 'Denoise audio while preserving vocals for clean output' }, icon: Volume2, tags: [{ zh: '降噪', en: 'Denoise' }, { zh: '清晰', en: 'Clear' }] },
    { id: 32, name: { zh: '音效制作', en: 'SFX Maker' }, desc: { zh: '文字描述生成各种音效，应用广泛', en: 'Generate sound effects from text descriptions' }, icon: Volume2, tags: [{ zh: '音效', en: 'SFX' }, { zh: '拟音', en: 'Foley' }] },
    { id: 33, name: { zh: '有声书合成', en: 'Audiobook' }, desc: { zh: '小说文章转有声书，多角色多情感', en: 'Convert articles to audiobooks with multiple characters and emotions' }, icon: Music, tags: [{ zh: '有声书', en: 'Audiobook' }, { zh: '故事', en: 'Story' }] },
    { id: 34, name: { zh: '语音翻译', en: 'Voice Translate' }, desc: { zh: '保留原音色翻译其他语言，跨语言沟通', en: 'Translate speech while preserving the original voice' }, icon: Globe, tags: [{ zh: '翻译', en: 'Translate' }, { zh: '跨语言', en: 'Cross-lang' }] },
  ],
  video: [
    { id: 35, name: { zh: '文字生成视频', en: 'Text to Video' }, desc: { zh: '输入脚本自动生成视频，适合短视频创作者', en: 'Turn scripts into videos, perfect for short-form creators' }, icon: Film, tags: [{ zh: '视频', en: 'Video' }, { zh: '创作', en: 'Create' }] },
    { id: 36, name: { zh: '智能剪辑', en: 'Smart Editor' }, desc: { zh: '自动识别精彩片段，一键成片效率高', en: 'Auto-detect highlights and assemble videos in one click' }, icon: Film, tags: [{ zh: '剪辑', en: 'Edit' }, { zh: '效率', en: 'Efficiency' }] },
    { id: 37, name: { zh: '字幕生成', en: 'Subtitles' }, desc: { zh: '视频自动加字幕，支持翻译，准确率高', en: 'Auto-add subtitles to videos with translation support' }, icon: Languages, tags: [{ zh: '字幕', en: 'Subs' }, { zh: '翻译', en: 'Translate' }] },
    { id: 38, name: { zh: '数字人主播', en: 'AI Anchor' }, desc: { zh: '输入文案生成真人形象视频，24小时待命', en: 'Turn scripts into realistic avatar videos, 24/7' }, icon: Bot, tags: [{ zh: '数字人', en: 'Avatar' }, { zh: '直播', en: 'Live' }] },
    { id: 39, name: { zh: '视频翻译', en: 'Video Translate' }, desc: { zh: '换衣翻译视频，保留原声和动作', en: 'Translate videos while preserving voice and motion' }, icon: Languages, tags: [{ zh: '翻译', en: 'Translate' }, { zh: '本地化', en: 'Localize' }] },
    { id: 40, name: { zh: '视频配乐', en: 'Video BGM' }, desc: { zh: '根据画面内容，推荐匹配背景音乐', en: 'Recommend background music that matches the visuals' }, icon: Music, tags: [{ zh: '配乐', en: 'BGM' }, { zh: 'BGM', en: 'Music' }] },
    { id: 41, name: { zh: '特效包装', en: 'VFX Pack' }, desc: { zh: '添加酷炫特效和转场，提升观感', en: 'Add cool effects and transitions to elevate the visuals' }, icon: Sparkles, tags: [{ zh: '特效', en: 'VFX' }, { zh: '包装', en: 'Polish' }] },
    { id: 42, name: { zh: 'VLOG剪辑', en: 'VLOG Editor' }, desc: { zh: '旅行vlog智能剪辑，自动配乐加字幕', en: 'Smart travel vlog editing with auto BGM and subtitles' }, icon: Video, tags: [{ zh: 'VLOG', en: 'VLOG' }, { zh: '旅行', en: 'Travel' }] },
  ],
  code: [
    { id: 43, name: { zh: '代码补全', en: 'Code Completion' }, desc: { zh: '智能补全代码块，减少重复劳动', en: 'Smart code completion to cut repetitive work' }, icon: Code, tags: [{ zh: '补全', en: 'Complete' }, { zh: '效率', en: 'Speed' }] },
    { id: 44, name: { zh: '代码解释', en: 'Code Explainer' }, desc: { zh: '逐行解释代码作用，新手友好', en: 'Line-by-line explanations, beginner friendly' }, icon: FileText, tags: [{ zh: '解释', en: 'Explain' }, { zh: '学习', en: 'Learn' }] },
    { id: 45, name: { zh: 'Bug修复', en: 'Bug Fix' }, desc: { zh: '定位问题，提供修复方案，附带讲解', en: 'Locate issues and provide fixes with explanations' }, icon: Bug, tags: [{ zh: 'Debug', en: 'Debug' }, { zh: '修Bug', en: 'Fix' }] },
    { id: 46, name: { zh: 'API文档', en: 'API Docs' }, desc: { zh: '输入函数名自动生成文档，规范完整', en: 'Generate clean, complete API docs from function names' }, icon: FileText, tags: [{ zh: '文档', en: 'Docs' }, { zh: '规范', en: 'Spec' }] },
    { id: 47, name: { zh: 'SQL生成', en: 'SQL Generator' }, desc: { zh: '描述需求生成SQL语句，支持优化', en: 'Generate and optimize SQL from natural language' }, icon: Database, tags: [{ zh: 'SQL', en: 'SQL' }, { zh: '查询', en: 'Query' }] },
    { id: 48, name: { zh: 'Shell命令', en: 'Shell Commands' }, desc: { zh: '描述操作需求，生成Linux/Windows命令', en: 'Describe the task, get Linux/Windows shell commands' }, icon: Terminal, tags: [{ zh: '命令', en: 'Shell' }, { zh: '运维', en: 'Ops' }] },
    { id: 49, name: { zh: '架构设计', en: 'Architecture' }, desc: { zh: '描述业务需求，推荐技术栈和架构', en: 'Recommend tech stack and architecture for your business needs' }, icon: Box, tags: [{ zh: '架构', en: 'Arch' }, { zh: '设计', en: 'Design' }] },
    { id: 50, name: { zh: '单元测试', en: 'Unit Tests' }, desc: { zh: '生成测试用例，覆盖率有保障', en: 'Generate test cases with solid coverage' }, icon: Target, tags: [{ zh: '测试', en: 'Test' }, { zh: '质量', en: 'Quality' }] },
  ],
  productivity: [
    { id: 51, name: { zh: 'Excel公式', en: 'Excel Formulas' }, desc: { zh: '描述需求生成Excel公式，支持复杂嵌套', en: 'Generate Excel formulas from descriptions, supports nesting' }, icon: Calculator, tags: [{ zh: 'Excel', en: 'Excel' }, { zh: '公式', en: 'Formulas' }] },
    { id: 52, name: { zh: 'PPT生成', en: 'PPT Generator' }, desc: { zh: '输入主题和大纲，自动生成演示文稿', en: 'Generate slide decks from topics and outlines' }, icon: Presentation, tags: [{ zh: 'PPT', en: 'PPT' }, { zh: '演示', en: 'Slides' }] },
    { id: 53, name: { zh: '思维导图', en: 'Mind Map' }, desc: { zh: '输入主题自动生成思维导图，支持编辑', en: 'Generate editable mind maps from any topic' }, icon: Network, tags: [{ zh: '导图', en: 'Map' }, { zh: '梳理', en: 'Outline' }] },
    { id: 54, name: { zh: '日历管理', en: 'Calendar' }, desc: { zh: '自然语言创建日程，智能提醒', en: 'Create schedules in natural language with smart reminders' }, icon: Calendar, tags: [{ zh: '日程', en: 'Schedule' }, { zh: '提醒', en: 'Remind' }] },
    { id: 55, name: { zh: '番茄钟', en: 'Pomodoro' }, desc: { zh: '专注计时器，统计工作效率', en: 'Focus timer with work-efficiency stats' }, icon: Clock, tags: [{ zh: '专注', en: 'Focus' }, { zh: '效率', en: 'Efficiency' }] },
    { id: 56, name: { zh: '记账助手', en: 'Budget' }, desc: { zh: '语音拍照记账，分析消费趋势', en: 'Track expenses via voice or photo, see spending trends' }, icon: Wallet, tags: [{ zh: '理财', en: 'Finance' }, { zh: '记账', en: 'Track' }] },
    { id: 57, name: { zh: '旅行规划', en: 'Trip Planner' }, desc: { zh: '输入目的地和时间，生成详细行程', en: 'Generate detailed itineraries from destination and dates' }, icon: MapPin, tags: [{ zh: '旅行', en: 'Travel' }, { zh: '规划', en: 'Plan' }] },
    { id: 58, name: { zh: '数据分析', en: 'Data Analysis' }, desc: { zh: '上传数据，生成可视化图表和分析报告', en: 'Upload data to produce charts and analysis reports' }, icon: BarChart3, tags: [{ zh: '分析', en: 'Analyze' }, { zh: '图表', en: 'Charts' }] },
  ],
  life: [
    // 注:饮食(59)、运动(60)、用药(62)已封存 —— 跟 AI 平台同质化、
    // 不符合「趣味性 + AI 调味」定位,留给真专业 app(MyFitnessPal/Keep/
    // 小米健康)。重做后的 6 张全是「趣味 + AI 不可替代」。
    { id: 61, name: { zh: '心情树洞', en: 'Mood Tree' },      desc: { zh: '匿名树洞 + 一键平静练习,AI 暖心回信不评判',                       en: 'Anonymous vent + one-tap calming practice, AI replies without judgment' },        icon: Heart,         tags: [{ zh: '心理', en: 'Mind' },  { zh: '陪伴', en: 'Care' }] },
    { id: 63, name: { zh: '取名玄学馆', en: 'Name Master' },   desc: { zh: '起名 / 测名 / 英文意境 / 情侣合婚,AI 拆字解寓意',                  en: 'Generate / score / translate / match Chinese names with AI insight' },             icon: Sparkles,      tags: [{ zh: '起名', en: 'Naming' }, { zh: '玄学', en: 'Mystic' }] },
    { id: 64, name: { zh: '玄学占卜室', en: 'Oracle Room' },   desc: { zh: '解梦 / 每日运势 / 小问题占卜,AI 心理隐喻不搞迷信',                  en: 'Dream / daily fortune / yes-or-no oracle, AI with psychological flavor' },         icon: Brain,         tags: [{ zh: '占卜', en: 'Oracle' }, { zh: '玄学', en: 'Mystic' }] },
    { id: 65, name: { zh: '猫狗翻译机', en: 'Pet Translator' },desc: { zh: '描述毛孩子动作,AI 一本正经「翻译」成猫语狗语 + 心情',              en: 'Describe what your pet did, AI translates it into pet-speak with mood' },         icon: Heart,         tags: [{ zh: '趣味', en: 'Fun' },   { zh: '宠物', en: 'Pet' }] },
    { id: 66, name: { zh: '今日宜忌', en: 'Daily Vibes' },     desc: { zh: '现代版老黄历,AI 每日生成宜忌句子,可收藏可分享',                    en: 'Modern almanac — AI generates today’s do’s & don’ts, save & share' }, icon: Calendar,      tags: [{ zh: '每日', en: 'Daily' }, { zh: '趣味', en: 'Fun' }] },
    { id: 67, name: { zh: '塔罗一日牌', en: 'Tarot of the Day' }, desc: { zh: '每日洗牌抽一张大阿卡纳,AI 心理隐喻解读,带牌面视觉',              en: 'Shuffle and draw a daily tarot, AI reads its meaning, with card art' },           icon: Sparkles,      tags: [{ zh: '塔罗', en: 'Tarot' }, { zh: '玄学', en: 'Mystic' }] },
  ],
};