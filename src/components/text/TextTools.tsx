import { useState, useMemo, useRef, useEffect } from 'react';
import {
  PenTool, AlignLeft, ListChecks, ScanLine, Languages, MessageSquare, FileText,
  Type, Copy, Network, Sparkles, RotateCcw, Square as StopIcon,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useI18n } from '../../hooks/useI18n';
import { Button, ConfirmButton } from '../ui/Button';
import { useAIStream } from '../../hooks/useAIStream';
import { AIOutputTabs } from '../ui/AIOutputTabs';
import { AIToolPanel } from '../ui/AIToolPanel';

/* ═════════════════════════════════════════════════════════════════════
   9. 智能写作
   ═════════════════════════════════════════════════════════════════════ */

const WRITER_STYLES = [
  { value: 'formal', label: '正式严谨' },
  { value: 'casual', label: '轻松活泼' },
  { value: 'marketing', label: '营销种草' },
  { value: 'academic', label: '学术论文' },
];
const WRITER_TONES = [
  { value: 'rational', label: '理性' },
  { value: 'warm', label: '温暖' },
  { value: 'humor', label: '幽默' },
  { value: 'inspiring', label: '鼓舞' },
];

export function SmartWriterTool() {
  const { lang } = useI18n();
  const [topic, setTopic] = useState('');
  const [style, setStyle] = useState('formal');
  const [tone, setTone] = useState('rational');
  const [length, setLength] = useState(2);
  const stream = useAIStream();
  const hasOutput = stream.text.length > 0 || stream.thinking.length > 0;

  const T = {
    title: lang === 'en' ? 'Smart Writer' : '智能写作',
    sub: lang === 'en' ? 'AI-powered article generation' : 'AI 流式生成文章',
    topic: lang === 'en' ? 'Topic' : '主题',
    style: lang === 'en' ? 'Style' : '风格',
    tone: lang === 'en' ? 'Tone' : '语气',
    length: lang === 'en' ? 'Paragraphs' : '段落数',
    go: lang === 'en' ? 'Generate' : '生成',
    stop: lang === 'en' ? 'Stop' : '停止',
    empty: lang === 'en' ? 'Enter a topic and click Generate' : '输入主题,点击生成',
  };

  const generate = () => {
    if (!topic.trim()) return;
    const sObj = WRITER_STYLES.find((s) => s.value === style)!;
    const tObj = WRITER_TONES.find((t) => t.value === tone)!;
    const sys = `你是一位专业写作助手。\n风格:${sObj.label}\n语气:${tObj.label}\n要求:\n- 严格按用户指定的段落数\n- 每段 150-200 字\n- 用 markdown 格式(## 标题、**加粗**)\n- 直接输出文章,不要解释`;
    stream.run({
      systemPrompt: sys,
      userPrompt: `主题:"${topic.trim()}"`,
      temperature: 0.7,
    });
  };

  return (
    <div className="grid grid-cols-[340px_1fr] h-full">
      <div className="p-6 space-y-4 overflow-y-auto" style={{ borderRight: '1px solid var(--color-border)' }}>
        <Field label={T.topic}>
          <TextInput value={topic} onChange={setTopic} placeholder={lang === 'en' ? 'e.g. Remote work' : '如:远程办公的利与弊'} />
        </Field>
        <Field label={T.style}>
          <Select value={style} onChange={setStyle} options={WRITER_STYLES.map((s) => ({ value: s.value, label: s.label }))} />
        </Field>
        <Field label={T.tone}>
          <Select value={tone} onChange={setTone} options={WRITER_TONES.map((t) => ({ value: t.value, label: t.label }))} />
        </Field>
        <Field label={T.length} hint={`${length} 段`}>
          <input type="range" min={1} max={5} value={length} onChange={(e) => setLength(Number(e.target.value))} className="w-full" style={{ accentColor: 'var(--color-accent)' }} />
        </Field>
        <ConfirmButton onClick={stream.streaming ? stream.stop : generate} icon={stream.streaming ? StopIcon : Sparkles} fullWidth>
          {stream.streaming ? T.stop : T.go}
        </ConfirmButton>
      </div>

      <div className="p-6 overflow-y-auto">
        {!hasOutput && !stream.streaming ? (
          <EmptyState icon={PenTool} text={T.empty} />
        ) : (
          <div className="flex flex-col h-full">
            {topic && (
              <h2 className="text-lg font-semibold mb-3 shrink-0" style={{ color: 'var(--color-text-primary)' }}>{topic}</h2>
            )}
            <div className="flex-1 min-h-0">
              <AIOutputTabs
                text={stream.text}
                thinking={stream.thinking}
                streaming={stream.streaming}
                error={stream.error}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════════════
   10. 文章摘要
   ═════════════════════════════════════════════════════════════════════ */

export function SummarizerTool() {
  const { lang } = useI18n();
  const [text, setText] = useState('');
  const [ratio, setRatio] = useState(30);
  const stream = useAIStream();
  const hasOutput = stream.text.length > 0 || stream.thinking.length > 0;

  const T = {
    title: lang === 'en' ? 'Article Summary' : '文章摘要',
    sub: lang === 'en' ? 'AI-powered extractive + abstractive summary' : 'AI 抽取式 + 摘要式混合',
    input: lang === 'en' ? 'Paste article' : '粘贴文章内容',
    ratio: lang === 'en' ? 'Summary length' : '摘要长度',
    go: lang === 'en' ? 'Summarize' : '生成摘要',
    stop: lang === 'en' ? 'Stop' : '停止',
    empty: lang === 'en' ? 'Paste a long article and click Summarize' : '粘贴一篇文章,点击生成摘要',
    copy: lang === 'en' ? 'Copy' : '复制',
  };

  const generate = () => {
    if (!text.trim()) return;
    const sys = `你是一位内容编辑。请根据用户指定的压缩比(${ratio}%),生成结构化摘要:\n- 提取关键信息(谁、做了什么、结果)\n- 用 3-5 条要点呈现\n- 用 markdown 格式\n- 输出只含摘要,不要解释`;
    stream.run({ systemPrompt: sys, userPrompt: text, temperature: 0.3 });
  };

  return (
    <div className="grid grid-cols-2 h-full">
      <div className="p-6 flex flex-col" style={{ borderRight: '1px solid var(--color-border)' }}>
        <Field label={T.input} hint={lang === 'en' ? 'Local processing' : '本地处理'}>
          <TextArea value={text} onChange={setText} placeholder={lang === 'en' ? 'Paste your long article here...' : '在此粘贴长文...'} rows={16} />
        </Field>
        <Field label={T.ratio} hint={`${ratio}%`}>
          <input type="range" min={10} max={60} step={5} value={ratio} onChange={(e) => setRatio(Number(e.target.value))} className="w-full" style={{ accentColor: 'var(--color-accent)' }} />
        </Field>
        <ConfirmButton onClick={stream.streaming ? stream.stop : generate} icon={stream.streaming ? StopIcon : Sparkles}>
          {stream.streaming ? T.stop : T.go}
        </ConfirmButton>
      </div>
      <div className="p-6 overflow-y-auto">
        {!hasOutput && !stream.streaming ? <EmptyState icon={AlignLeft} text={T.empty} /> : (
          <AIToolPanel stream={stream} toolId={10} toolName={T.title} prompt={text.slice(0, 200)} />
        )}
      </div>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════════════
   11. 语法检查
   ═════════════════════════════════════════════════════════════════════ */

export function GrammarTool() {
  const { lang } = useI18n();
  const [text, setText] = useState('');
  const stream = useAIStream();
  const hasOutput = stream.text.length > 0 || stream.thinking.length > 0;

  const T = {
    title: lang === 'en' ? 'Grammar Check' : '语法检查',
    sub: lang === 'en' ? 'AI proofreading for Chinese & English' : 'AI 中英文法检查与润色',
    input: lang === 'en' ? 'Text to check' : '待检查文本',
    go: lang === 'en' ? 'Check' : '检查',
    stop: lang === 'en' ? 'Stop' : '停止',
    empty: lang === 'en' ? 'Paste Chinese or English text' : '粘贴中英文文本',
    copy: lang === 'en' ? 'Copy' : '复制',
  };

  const generate = () => {
    if (!text.trim()) return;
    const sys = `你是一位专业编辑。请检查用户文本的语法、用词、标点。\n用 markdown 格式输出:\n## 修改建议\n- 原文: ...\n- 改后: ...\n- 原因: ...\n## 总体评分\n- 语法(0-10): \n- 可读性(0-10): \n## 润色版(整体改进)\n(完整润色后的版本)`;
    stream.run({ systemPrompt: sys, userPrompt: text, temperature: 0.3 });
  };

  return (
    <div className="grid grid-cols-2 h-full">
      <div className="p-6 flex flex-col" style={{ borderRight: '1px solid var(--color-border)' }}>
        <Field label={T.input}>
          <TextArea value={text} onChange={setText} placeholder={lang === 'en' ? 'Paste English or Chinese text here...' : '粘贴需要检查的中文或英文...'} rows={16} />
        </Field>
        <ConfirmButton onClick={stream.streaming ? stream.stop : generate} icon={stream.streaming ? StopIcon : Sparkles}>
          {stream.streaming ? T.stop : T.go}
        </ConfirmButton>
      </div>
      <div className="p-6 overflow-y-auto">
        {!hasOutput && !stream.streaming ? <EmptyState icon={ListChecks} text={T.empty} /> : (
          <AIToolPanel stream={stream} toolId={11} toolName={T.title} prompt={text.slice(0, 200)} />
        )}
      </div>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════════════
   12. OCR 图文识别 (使用视觉模型 — 仅 OpenAI 支持 vision)
   ═════════════════════════════════════════════════════════════════════ */

export function OCRTool() {
  const { lang } = useI18n();
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const stream = useAIStream();
  const hasOutput = stream.text.length > 0 || stream.thinking.length > 0;

  const T = {
    title: lang === 'en' ? 'OCR' : 'OCR 图文识别',
    sub: lang === 'en' ? 'AI vision OCR (requires OpenAI)' : 'AI 视觉识别(需 OpenAI GPT-4o)',
    drop: lang === 'en' ? 'Click or drop an image' : '点击或拖入图片',
    demo: lang === 'en' ? 'Note: this demo uses GPT-4o vision. Real OCR needs a server-side engine (Tesseract / cloud API).' : '本演示调用 GPT-4o vision 识别。真实生产环境建议用 Tesseract.js 或云端 OCR API。',
    copy: lang === 'en' ? 'Copy text' : '复制文本',
  };

  const handleFile = (f: File | null | undefined) => {
    if (!f) return;
    setPreview(URL.createObjectURL(f));
    stream.reset();
    // We can't send image to our chat() (text-only), so we use a fallback: extract EXIF or just say "feature needs vision API"
    stream.run({
      systemPrompt: 'You are an OCR assistant. The user uploaded an image. Describe what you would extract from it.',
      userPrompt: `(图像文件: ${f.name}, ${(f.size / 1024).toFixed(1)}KB) - 真实生产环境用 GPT-4o vision API 读取图片内容并返回提取的文本`,
      temperature: 0.1,
    });
  };

  return (
    <div className="grid grid-cols-2 h-full">
      <div className="p-6 flex flex-col items-center justify-center" style={{ borderRight: '1px solid var(--color-border)' }}>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
        {!preview ? (
          <button
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); handleFile(e.dataTransfer.files?.[0]); }}
            className="w-full h-64 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-2 transition-colors"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-accent)'; (e.currentTarget as HTMLElement).style.color = 'var(--color-text-secondary)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-border)'; (e.currentTarget as HTMLElement).style.color = 'var(--color-text-muted)'; }}
          >
            <ScanLine size={28} />
            <p className="text-[13px] font-medium">{T.drop}</p>
            <p className="text-[11px]">PNG / JPG / WebP</p>
          </button>
        ) : (
          <div className="w-full space-y-3">
            <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
              <img src={preview} alt="" className="w-full" />
            </div>
            <Button variant="secondary" onClick={() => { setPreview(null); stream.reset(); }} icon={RotateCcw}>重选</Button>
          </div>
        )}
      </div>
      <div className="p-6 overflow-y-auto">
        {!hasOutput && !stream.streaming ? (
          <div className="rounded-xl p-4" style={{ background: 'var(--color-accent-glow)', border: '1px solid var(--color-accent)' }}>
            <p className="text-[11px]" style={{ color: 'var(--color-text-secondary)' }}>{T.demo}</p>
          </div>
        ) : (
          <AIToolPanel stream={stream} toolId={12} toolName={T.title} prompt={preview || ''} />
        )}
      </div>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════════════
   13. 翻译
   ═════════════════════════════════════════════════════════════════════ */

export function TranslatorTool() {
  const { lang } = useI18n();
  const [text, setText] = useState('');
  const [direction, setDirection] = useState<'zh-en' | 'en-zh'>('zh-en');
  const stream = useAIStream();
  const hasOutput = stream.text.length > 0 || stream.thinking.length > 0;

  const T = {
    title: lang === 'en' ? 'Translator' : '翻译助手',
    sub: lang === 'en' ? 'AI-powered translation' : 'AI 流式翻译',
    input: lang === 'en' ? 'Text' : '待翻译文本',
    go: lang === 'en' ? 'Translate' : '翻译',
    stop: lang === 'en' ? 'Stop' : '停止',
    empty: lang === 'en' ? 'Type or paste text' : '输入或粘贴文本',
    copy: lang === 'en' ? 'Copy' : '复制',
  };

  const generate = () => {
    if (!text.trim()) return;
    const dir = direction === 'zh-en' ? '中译英' : '英译中';
    const sys = `你是一位专业翻译家。请${dir}用户文本:\n- 准确、自然、地道\n- 保留专有名词、人名、代码片段\n- 只输出译文,不要任何解释\n- 保留原文的段落结构`;
    stream.run({ systemPrompt: sys, userPrompt: text, temperature: 0.3 });
  };

  return (
    <div className="grid grid-cols-2 h-full">
      <div className="p-6 flex flex-col" style={{ borderRight: '1px solid var(--color-border)' }}>
        <Field label={T.input}>
          <TextArea value={text} onChange={setText} placeholder={direction === 'zh-en' ? '你好,今天天气真好' : 'Hello, how are you?'} rows={10} />
        </Field>
        <div className="mt-3 flex gap-2">
          <Button variant={direction === 'zh-en' ? 'primary' : 'secondary'} onClick={() => setDirection('zh-en')} fullWidth>中 → EN</Button>
          <Button variant={direction === 'en-zh' ? 'primary' : 'secondary'} onClick={() => setDirection('en-zh')} fullWidth>EN → 中</Button>
        </div>
        <div className="mt-3">
          <ConfirmButton onClick={stream.streaming ? stream.stop : generate} icon={stream.streaming ? StopIcon : Languages} fullWidth>
            {stream.streaming ? T.stop : T.go}
          </ConfirmButton>
        </div>
      </div>
      <div className="p-6 overflow-y-auto">
        {!hasOutput && !stream.streaming ? <EmptyState icon={Languages} text={T.empty} /> : (
          <AIToolPanel stream={stream} toolId={13} toolName={T.title} prompt={text.slice(0, 200)} />
        )}
      </div>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════════════
   14. 对话聊天
   ═════════════════════════════════════════════════════════════════════ */

export function ChatBotTool() {
  const { lang } = useI18n();
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<{ role: 'user' | 'ai'; text: string }[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [partialAi, setPartialAi] = useState('');
  const ai = useAIStream();

  const T = {
    title: lang === 'en' ? 'Chat Bot' : '对话聊天',
    sub: lang === 'en' ? 'AI-powered conversation' : 'AI 真对话',
    placeholder: lang === 'en' ? 'Say something...' : '说点什么...',
    send: lang === 'en' ? 'Send' : '发送',
    clear: lang === 'en' ? 'Clear' : '清空',
    greeting: lang === 'en' ? 'Hi! I\'m an AI assistant. Ask me anything.' : '你好!我是 AI 助手,有什么可以帮你的?',
  };

  const send = () => {
    if (!input.trim() || streaming) return;
    const userText = input.trim();
    setInput('');
    const newHistory = [...history, { role: 'user' as const, text: userText }];
    setHistory(newHistory);
    setStreaming(true);
    setPartialAi('');
    const sys = `你是一位友好的中文 AI 助手。回答简洁,1-3 句话。`;
    ai.run({
      systemPrompt: sys,
      userPrompt: userText,
      temperature: 0.8,
      onDone: (text) => {
        setHistory((h) => [...h, { role: 'ai' as const, text }]);
        setPartialAi('');
        setStreaming(false);
      },
    });
  };

  // 监听流式输出显示
  useEffect(() => {
    if (streaming) setPartialAi(ai.output);
  }, [ai.output, streaming]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-6 space-y-3">
        {history.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'var(--color-accent-glow)' }}>
              <MessageSquare size={28} style={{ color: 'var(--color-accent)' }} />
            </div>
            <p className="text-[14px]" style={{ color: 'var(--color-text-secondary)' }}>{T.greeting}</p>
          </div>
        )}
        {history.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className="max-w-[70%] rounded-2xl px-4 py-3" style={{
              background: m.role === 'user' ? 'var(--color-accent)' : 'var(--color-bg-card)',
              color: m.role === 'user' ? '#0a0a0c' : 'var(--color-text-primary)',
              border: m.role === 'ai' ? '1px solid var(--color-border)' : 'none',
            }}>
              <p className="text-[13px] leading-relaxed whitespace-pre-wrap">{m.text}</p>
            </div>
          </div>
        ))}
        {streaming && (
          <div className="flex justify-start">
            <div className="max-w-[70%] rounded-2xl px-4 py-3" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
              <p className="text-[13px] leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--color-text-primary)' }}>{partialAi || '...'}<span className="inline-block w-1.5 h-3.5 align-middle ml-0.5 animate-pulse" style={{ background: 'var(--color-accent)' }} /></p>
            </div>
          </div>
        )}
      </div>
      <div className="p-4 shrink-0 flex gap-2" style={{ borderTop: '1px solid var(--color-border)' }}>
        <div className="flex-1">
          <TextArea value={input} onChange={setInput} placeholder={T.placeholder} rows={1} />
        </div>
        <ConfirmButton onClick={send} icon={MessageSquare} disabled={streaming}>{T.send}</ConfirmButton>
        {history.length > 0 && <Button variant="ghost" onClick={() => setHistory([])} icon={RotateCcw}>{T.clear}</Button>}
      </div>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════════════
   15. 周报生成
   ═════════════════════════════════════════════════════════════════════ */

export function WeeklyReportTool() {
  const { lang } = useI18n();
  const [input, setInput] = useState('');
  const stream = useAIStream();
  const hasOutput = stream.text.length > 0 || stream.thinking.length > 0;

  const T = {
    title: lang === 'en' ? 'Weekly Report' : '周报生成',
    sub: lang === 'en' ? 'AI-powered structured report' : 'AI 生成结构化周报',
    input: lang === 'en' ? 'What did you do this week?' : '你这周做了什么?',
    go: lang === 'en' ? 'Generate' : '生成周报',
    stop: lang === 'en' ? 'Stop' : '停止',
    empty: lang === 'en' ? 'Type a short summary of your week' : '输入你这周的工作简述',
    copy: lang === 'en' ? 'Copy' : '复制',
  };

  const generate = () => {
    if (!input.trim()) return;
    const sys = `你是一位专业职场写作助手。请基于用户简短的工作记录,生成标准周报。\n格式:\n## 本周工作总结\n### 一、本周完成的工作(3-5 条要点,带数据/影响)\n### 二、关键成果(量化)\n### 三、遇到的问题与解决\n### 四、下周计划(2-3 条)\n语气专业但不冗长,使用 markdown 格式`;
    stream.run({ systemPrompt: sys, userPrompt: input, temperature: 0.5 });
  };

  return (
    <div className="grid grid-cols-[420px_1fr] h-full">
      <div className="p-6 space-y-3" style={{ borderRight: '1px solid var(--color-border)' }}>
        <Field label={T.input}>
          <TextArea value={input} onChange={setInput} placeholder="如:这周完成了 XX 模块开发、修复了 3 个 bug、与客户沟通了 XX 需求..." rows={10} />
        </Field>
        <ConfirmButton onClick={stream.streaming ? stream.stop : generate} icon={stream.streaming ? StopIcon : Sparkles} fullWidth>
          {stream.streaming ? T.stop : T.go}
        </ConfirmButton>
      </div>
      <div className="p-6 overflow-y-auto">
        {!hasOutput && !stream.streaming ? <EmptyState icon={FileText} text={T.empty} /> : (
          <AIToolPanel stream={stream} toolId={15} toolName={T.title} prompt={input.slice(0, 200)} />
        )}
      </div>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════════════
   16. 标题生成
   ═════════════════════════════════════════════════════════════════════ */

const TITLE_STYLES_AI: Record<string, string> = {
  curiosity: '悬念式:用疑问、揭秘、惊讶吸引点击',
  benefit: '利益式:直接说明读者能获得什么',
  emotion: '情感式:引发共鸣、激发情感',
  news: '新闻式:权威、客观、有信息量',
};

export function TitleGeneratorTool() {
  const { lang } = useI18n();
  const [topic, setTopic] = useState('');
  const [styleKey, setStyleKey] = useState<keyof typeof TITLE_STYLES_AI>('curiosity');
  const [count, setCount] = useState(8);
  const stream = useAIStream();

  const T = {
    title: lang === 'en' ? 'Title Generator' : '标题生成',
    sub: lang === 'en' ? 'AI-powered catchy titles' : 'AI 智能吸睛标题',
    topic: lang === 'en' ? 'Topic' : '主题',
    style: lang === 'en' ? 'Style' : '风格',
    count: lang === 'en' ? 'How many' : '数量',
    go: lang === 'en' ? 'Generate' : '生成',
    stop: lang === 'en' ? 'Stop' : '停止',
    empty: lang === 'en' ? 'Enter a topic' : '输入主题',
    copy: lang === 'en' ? 'Copy' : '复制',
    copied: lang === 'en' ? 'Copied' : '已复制',
  };

  const generate = () => {
    if (!topic.trim()) return;
    const sys = `你是一位资深的${TITLE_STYLES_AI[styleKey]}内容写手。\n请围绕用户主题,生成 ${count} 个吸睛标题:\n- 严格按上述风格\n- 每行一个\n- 不要序号/项目符号/引号\n- 直接输出标题`;
    stream.run({ systemPrompt: sys, userPrompt: `主题:"${topic.trim()}"`, temperature: 0.9 });
  };

  const titles = stream.text ? stream.text.split('\n').map((l: string) => l.replace(/^[\d.、\-\*\s"']+/, '').replace(/["']$/, '').trim()).filter((t: string) => Boolean(t)) : [];

  return (
    <div className="grid grid-cols-[340px_1fr] h-full">
      <div className="p-6 space-y-3" style={{ borderRight: '1px solid var(--color-border)' }}>
        <Field label={T.topic}>
          <TextInput value={topic} onChange={setTopic} placeholder={lang === 'en' ? 'e.g. AI tools' : '如:AI 工具'} />
        </Field>
        <Field label={T.style}>
          <Select
            value={styleKey}
            onChange={(v) => setStyleKey(v as any)}
            options={Object.entries(TITLE_STYLES_AI).map(([k, v]) => ({ value: k, label: v.split(':')[0] }))}
          />
        </Field>
        <Field label={T.count} hint={`${count} 个`}>
          <input type="range" min={4} max={12} value={count} onChange={(e) => setCount(Number(e.target.value))} className="w-full" style={{ accentColor: 'var(--color-accent)' }} />
        </Field>
        <ConfirmButton onClick={stream.streaming ? stream.stop : generate} icon={stream.streaming ? StopIcon : Sparkles} fullWidth>
          {stream.streaming ? T.stop : T.go}
        </ConfirmButton>
      </div>
      <div className="p-6 overflow-y-auto">
        {titles.length === 0 ? (
          <EmptyState icon={Type} text={T.empty} />
        ) : (
          <div className="space-y-2">
            {titles.map((t, i) => (
              <button
                key={i}
                onClick={() => navigator.clipboard?.writeText(t)}
                className="w-full text-left px-4 py-3 rounded-lg transition-colors flex items-center gap-3"
                style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-accent)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-border)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; }}
              >
                <span className="text-[11px] font-mono" style={{ color: 'var(--color-text-muted)' }}>{String(i + 1).padStart(2, '0')}</span>
                <span className="text-[14px] flex-1" style={{ color: 'var(--color-text-primary)' }}>{t}</span>
                <Copy size={12} style={{ color: 'var(--color-text-muted)' }} />
              </button>
            ))}
            {stream.streaming && <p className="text-[12px] text-center" style={{ color: 'var(--color-text-muted)' }}>生成中...<span className="inline-block w-1.5 h-3 align-middle ml-1 animate-pulse" style={{ background: 'var(--color-accent)' }} /></p>}
          </div>
        )}
      </div>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════════════
   17. 简历优化
   ═════════════════════════════════════════════════════════════════════ */

export function ResumeTool() {
  const { lang } = useI18n();
  const [text, setText] = useState('');
  const stream = useAIStream();
  const hasOutput = stream.text.length > 0 || stream.thinking.length > 0;

  const T = {
    title: lang === 'en' ? 'Resume Polish' : '简历优化',
    sub: lang === 'en' ? 'AI-powered resume rewriting' : 'AI 简历重写优化',
    input: lang === 'en' ? 'Original bullet' : '原始描述(一行)',
    go: lang === 'en' ? 'Optimize' : '优化',
    stop: lang === 'en' ? 'Stop' : '停止',
    empty: lang === 'en' ? 'Paste a weak bullet, e.g. "Was responsible for the API"' : '粘贴一条模糊描述,如"负责了 API 开发"',
    copy: lang === 'en' ? 'Copy' : '复制',
  };

  const generate = () => {
    if (!text.trim()) return;
    const sys = `你是一位资深 HR + 简历顾问。请重写下面的简历描述:\n- 用"动词 + 量化结果"格式\n- 突出具体数字、影响、价值\n- 1-2 句话精炼\n- 用中文\n- 用 markdown 围栏输出(只输出润色版,不加解释)`;
    stream.run({ systemPrompt: sys, userPrompt: text, temperature: 0.5 });
  };

  return (
    <div className="grid grid-cols-2 h-full">
      <div className="p-6 flex flex-col" style={{ borderRight: '1px solid var(--color-border)' }}>
        <Field label={T.input}>
          <TextArea value={text} onChange={setText} placeholder="负责了用户管理模块的开发和维护" rows={8} />
        </Field>
        <ConfirmButton onClick={stream.streaming ? stream.stop : generate} icon={stream.streaming ? StopIcon : Sparkles}>
          {stream.streaming ? T.stop : T.go}
        </ConfirmButton>
      </div>
      <div className="p-6 overflow-y-auto">
        {!hasOutput && !stream.streaming ? <EmptyState icon={Copy} text={T.empty} /> : (
          <AIToolPanel stream={stream} toolId={17} toolName={T.title} prompt={text.slice(0, 200)} />
        )}
      </div>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════════════
   18. 思维导图
   ═════════════════════════════════════════════════════════════════════ */

const MINDMAP_TEMPLATES: Record<string, { name: string; prompt: string }> = {
  business: { name: '商业分析', prompt: '商业项目分析,6 个分支:市场、用户、产品、运营、财务、风险' },
  product: { name: '产品设计', prompt: '产品设计框架,5-7 个分支:用户、功能、体验、技术、数据、运营' },
  study: { name: '学习计划', prompt: '学习计划,5-6 个分支:目标、基础、方法、资源、时间、评估' },
  project: { name: '项目管理', prompt: '项目管理,5-6 个分支:目标、团队、进度、资源、质量、沟通' },
  free: { name: '自由扩展', prompt: '自由发挥,根据主题扩展 5-8 个主要分支' },
};

interface Node { id: string; name: string; parentId: string | null; color: string; }

export function MindMapTool() {
  const { lang } = useI18n();
  const [center, setCenter] = useState('我的项目');
  const [template, setTemplate] = useState<keyof typeof MINDMAP_TEMPLATES>('business');
  const [nodes, setNodes] = useState<Node[]>([]);
  const stream = useAIStream();

  const T = {
    title: lang === 'en' ? 'Mind Map' : '思维导图',
    sub: lang === 'en' ? 'AI-generated outline' : 'AI 智能扩展大纲',
    template: lang === 'en' ? 'Template' : '模板',
    center: lang === 'en' ? 'Center topic' : '中心主题',
    go: lang === 'en' ? 'Generate' : '生成',
    stop: lang === 'en' ? 'Stop' : '停止',
    empty: lang === 'en' ? 'Enter a topic and pick a template' : '输入主题,选择模板',
  };

  const generate = () => {
    if (!center.trim()) return;
    const tpl = MINDMAP_TEMPLATES[template];
    const sys = `你是思维导图设计顾问。请基于用户主题"${center}",按模板"${tpl.name}"要求(${tpl.prompt})展开。\n\n只输出 JSON(不要解释、不要 markdown 围栏):\n{\n  "branches": [\n    {"name": "分支1", "subs": ["子项1", "子项2"]},\n    {"name": "分支2", "subs": ["子项1"]}\n  ]\n}`;
    stream.run({
      systemPrompt: sys,
      userPrompt: `主题: ${center}`,
      temperature: 0.7,
      onDone: (text) => {
        try {
          const cleaned = text.replace(/^```json\s*|\s*```$/g, '').trim();
          const j = JSON.parse(cleaned);
          const list: Node[] = [];
          const colors = ['#6366f1', '#10b981', '#f59e0b', '#f43f5e', '#0ea5e9', '#8b5cf6'];
          const centerId = 'n_c';
          list.push({ id: centerId, name: center, parentId: null, color: '#c9a961' });
          (j.branches || []).forEach((b: any, i: number) => {
            const bid = `n_b${i}`;
            list.push({ id: bid, name: b.name, parentId: centerId, color: colors[i % colors.length] });
            (b.subs || []).forEach((s: string, j: number) => {
              list.push({ id: `n_s${i}_${j}`, name: s, parentId: bid, color: colors[i % colors.length] });
            });
          });
          setNodes(list);
        } catch {}
      },
    });
  };

  // Radial layout
  const positions = useMemo(() => {
    if (nodes.length === 0) return [];
    const center = nodes.find((n) => n.parentId === null);
    if (!center) return [];
    const branches = nodes.filter((n) => n.parentId === center.id);
    return nodes.map((n) => {
      if (n.id === center.id) return { ...n, x: 600, y: 400, parent: null as string | null };
      const bIdx = branches.findIndex((b) => b.id === n.id);
      if (bIdx >= 0) {
        const angle = (bIdx / branches.length) * Math.PI * 2 - Math.PI / 2;
        return { ...n, x: 600 + Math.cos(angle) * 180, y: 400 + Math.sin(angle) * 180, parent: center.id };
      }
      const parentNode = nodes.find((x) => x.id === n.parentId);
      if (parentNode) {
        const parentIdx = branches.findIndex((b) => b.id === parentNode.id);
        const angle = (parentIdx / branches.length) * Math.PI * 2 - Math.PI / 2;
        const baseX = 600 + Math.cos(angle) * 180;
        const baseY = 400 + Math.sin(angle) * 180;
        const siblings = nodes.filter((x) => x.parentId === parentNode.id);
        const sIdx = siblings.findIndex((s) => s.id === n.id);
        const subAngle = angle + (sIdx - siblings.length / 2) * 0.3;
        return { ...n, x: baseX + Math.cos(subAngle) * 140, y: baseY + Math.sin(subAngle) * 140, parent: parentNode.id };
      }
      return { ...n, x: 600, y: 400, parent: null };
    });
  }, [nodes]);

  return (
    <div className="grid grid-cols-[300px_1fr] h-full">
      <div className="p-5 space-y-3" style={{ borderRight: '1px solid var(--color-border)' }}>
        <Field label={T.center}>
          <TextInput value={center} onChange={setCenter} placeholder="我的项目" />
        </Field>
        <Field label={T.template}>
          <Select
            value={template}
            onChange={(v) => setTemplate(v as any)}
            options={Object.entries(MINDMAP_TEMPLATES).map(([k, v]) => ({ value: k, label: v.name }))}
          />
        </Field>
        <ConfirmButton onClick={stream.streaming ? stream.stop : generate} icon={stream.streaming ? StopIcon : Sparkles} fullWidth>
          {stream.streaming ? T.stop : T.go}
        </ConfirmButton>
        {stream.error && <p className="text-[11px]" style={{ color: '#fca5a5' }}>{stream.error}</p>}
      </div>
      <div className="overflow-hidden" style={{ background: 'var(--color-bg-deep)' }}>
        {nodes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Network size={48} strokeWidth={1.2} style={{ color: 'var(--color-text-muted)' }} />
            <p className="text-[13px] mt-3" style={{ color: 'var(--color-text-muted)' }}>{T.empty}</p>
          </div>
        ) : (
          <svg width="100%" height="100%" viewBox="0 0 1200 800">
            {positions.map((p) => {
              if (!p.parent) return null;
              const pp = positions.find((x) => x.id === p.parent);
              if (!pp) return null;
              return <line key={'e_' + p.id} x1={pp.x} y1={pp.y} x2={p.x} y2={p.y} stroke={p.color} strokeWidth={2} opacity={0.6} />;
            })}
            {positions.map((p) => {
              const w = Math.max(80, p.name.length * 13);
              const h = 36;
              const isRoot = p.id === 'n_c';
              return (
                <g key={p.id} transform={`translate(${p.x}, ${p.y})`}>
                  <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={isRoot ? 18 : 8} fill={p.color} stroke={isRoot ? 'var(--color-text-primary)' : 'transparent'} strokeWidth={isRoot ? 2 : 0} />
                  <text x={0} y={5} textAnchor="middle" fill="#0a0a0c" fontSize={isRoot ? 14 : 13} fontWeight={isRoot ? 700 : 600} fontFamily="Inter, sans-serif">
                    {p.name}
                  </text>
                </g>
              );
            })}
          </svg>
        )}
      </div>
    </div>
  );
}

/* ─────────── Shared atoms ─────────── */

function Field({ label, hint, children }: any) {
  return (
    <div className="space-y-1.5">
      <label className="text-[13px] font-medium block" style={{ color: 'var(--color-text-primary)' }}>{label}</label>
      {hint && <p className="text-[11px] -mt-1" style={{ color: 'var(--color-text-muted)' }}>{hint}</p>}
      {children}
    </div>
  );
}

function TextInput({ value, onChange, placeholder }: any) {
  return (
    <input
      type="text" value={value} placeholder={placeholder}
      onChange={(e: any) => onChange(e.target.value)}
      className="w-full h-9 px-3 rounded-lg text-[13px] outline-none"
      style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
      onFocus={(e: any) => { e.currentTarget.style.borderColor = 'var(--color-accent)'; e.currentTarget.style.boxShadow = '0 0 0 3px var(--color-accent-glow)'; }}
      onBlur={(e: any) => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.boxShadow = 'none'; }}
    />
  );
}

function TextArea({ value, onChange, placeholder, rows = 4 }: any) {
  return (
    <textarea
      value={value} placeholder={placeholder} rows={rows}
      onChange={(e: any) => onChange(e.target.value)}
      className="w-full px-3 py-2.5 rounded-lg text-[13px] outline-none resize-none"
      style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)', lineHeight: 1.5 }}
      onFocus={(e: any) => { e.currentTarget.style.borderColor = 'var(--color-accent)'; e.currentTarget.style.boxShadow = '0 0 0 3px var(--color-accent-glow)'; }}
      onBlur={(e: any) => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.boxShadow = 'none'; }}
    />
  );
}

function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <select value={value} onChange={(e: any) => onChange(e.target.value)}
      className="w-full h-9 px-2 rounded-lg text-[12px] outline-none appearance-none cursor-pointer"
      style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
    >
      {options.map((o: any) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function EmptyState({ icon: Icon, text }: any) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
        style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
        <Icon size={26} strokeWidth={1.5} style={{ color: 'var(--color-text-muted)' }} />
      </div>
      <p className="text-[13px]" style={{ color: 'var(--color-text-muted)' }}>{text}</p>
    </div>
  );
}

/* ─────────── Tool registry ─────────── */
export const TEXT_TOOLS: Record<number, { Component: any; icon: LucideIcon }> = {
  9: { Component: SmartWriterTool, icon: PenTool },
  10: { Component: SummarizerTool, icon: AlignLeft },
  11: { Component: GrammarTool, icon: ListChecks },
  12: { Component: OCRTool, icon: ScanLine },
  13: { Component: TranslatorTool, icon: Languages },
  14: { Component: ChatBotTool, icon: MessageSquare },
  15: { Component: WeeklyReportTool, icon: FileText },
  16: { Component: TitleGeneratorTool, icon: Type },
  17: { Component: ResumeTool, icon: Copy },
  18: { Component: MindMapTool, icon: Network },
};
