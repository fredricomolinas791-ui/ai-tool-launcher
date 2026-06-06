import { useState } from 'react';
import { Code, FileSearch, Bug, Database, Terminal, FlaskConical, Sparkles, Square as StopIcon } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useI18n } from '../../hooks/useI18n';
import { ConfirmButton } from '../ui/Button';
import { AIToolPanel } from '../ui/AIToolPanel';
import { useAIStream } from '../../hooks/useAIStream';

const LANGS = ['JavaScript', 'TypeScript', 'Python', 'Java', 'Go', 'Rust', 'C++', 'C#', 'PHP', 'Ruby', 'Swift', 'Kotlin', 'SQL', 'Shell', 'HTML', 'CSS'];

interface CodeToolProps { }

/* ═════════════════════════════════════════════════════════════════════
   43. 代码补全
   ═════════════════════════════════════════════════════════════════════ */

export function CodeCompletionTool(_props: CodeToolProps) {
  const { lang } = useI18n();
  const [code, setCode] = useState('function calculateTotal(items) {\n  ');
  const [language, setLanguage] = useState('JavaScript');
  const stream = useAIStream();
  const hasOutput = stream.text.length > 0 || stream.thinking.length > 0;

  const T = {
    title: lang === 'en' ? 'Code Completion' : '代码补全',
    sub: lang === 'en' ? 'AI completes your partial code' : 'AI 补全你的部分代码',
    language: lang === 'en' ? 'Language' : '语言',
    input: lang === 'en' ? 'Partial code' : '部分代码',
    go: lang === 'en' ? 'Complete' : '补全',
    stop: lang === 'en' ? 'Stop' : '停止',
    empty: lang === 'en' ? 'Paste partial code' : '粘贴部分代码',
    copy: lang === 'en' ? 'Copy' : '复制',
  };

  const generate = () => {
    if (!code.trim()) return;
    const sys = `你是 ${language} 专家。补全下面的代码。只输出补全后的完整代码(包含已有部分),不要解释,不要 markdown 围栏。`;
    stream.run({ systemPrompt: sys, userPrompt: code, temperature: 0.2 });
  };

  return (
    <div className="grid grid-cols-2 h-full">
      <div className="p-6 space-y-3 overflow-y-auto" style={{ borderRight: '1px solid var(--color-border)' }}>
        <Field label={T.language}>
          <Select value={language} onChange={setLanguage} options={LANGS.map((l) => ({ value: l, label: l }))} />
        </Field>
        <Field label={T.input}>
          <CodeArea value={code} onChange={setCode} rows={14} />
        </Field>
        <ConfirmButton onClick={stream.streaming ? stream.stop : generate} icon={stream.streaming ? StopIcon : Sparkles} fullWidth>
          {stream.streaming ? T.stop : T.go}
        </ConfirmButton>
      </div>
      <div className="p-6 overflow-y-auto">
        {!hasOutput && !stream.streaming ? <EmptyState icon={Code} text={T.empty} /> : (
          <AIToolPanel stream={stream} toolId={43} toolName={T.title} prompt={code.slice(0, 200)} />
        )}
      </div>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════════════
   44. 代码解释
   ═════════════════════════════════════════════════════════════════════ */

export function CodeExplainerTool(_props: CodeToolProps) {
  const { lang } = useI18n();
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState('JavaScript');
  const stream = useAIStream();
  const hasOutput = stream.text.length > 0 || stream.thinking.length > 0;

  const T = {
    title: lang === 'en' ? 'Code Explainer' : '代码解释',
    sub: lang === 'en' ? 'AI explains what the code does' : 'AI 解释代码做了什么',
    language: lang === 'en' ? 'Language' : '语言',
    input: lang === 'en' ? 'Code to explain' : '要解释的代码',
    go: lang === 'en' ? 'Explain' : '解释',
    stop: lang === 'en' ? 'Stop' : '停止',
    empty: lang === 'en' ? 'Paste code' : '粘贴代码',
    copy: lang === 'en' ? 'Copy' : '复制',
  };

  const generate = () => {
    if (!code.trim()) return;
    const sys = `你是 ${language} 老师。用通俗易懂的中文解释代码:\n## 整体功能(1-2 句话)\n## 关键逻辑(逐段)\n## 关键概念/算法/设计模式\n## 潜在问题或改进建议\n用 markdown 格式`;
    stream.run({ systemPrompt: sys, userPrompt: `代码:\n\`\`\`${language.toLowerCase()}\n${code}\n\`\`\``, temperature: 0.3 });
  };

  return (
    <div className="grid grid-cols-2 h-full">
      <div className="p-6 space-y-3 overflow-y-auto" style={{ borderRight: '1px solid var(--color-border)' }}>
        <Field label={T.language}>
          <Select value={language} onChange={setLanguage} options={LANGS.map((l) => ({ value: l, label: l }))} />
        </Field>
        <Field label={T.input}>
          <CodeArea value={code} onChange={setCode} rows={14} placeholder="粘贴要解释的代码..." />
        </Field>
        <ConfirmButton onClick={stream.streaming ? stream.stop : generate} icon={stream.streaming ? StopIcon : Sparkles} fullWidth>
          {stream.streaming ? T.stop : T.go}
        </ConfirmButton>
      </div>
      <div className="p-6 overflow-y-auto">
        {!hasOutput && !stream.streaming ? <EmptyState icon={FileSearch} text={T.empty} /> : (
          <AIToolPanel stream={stream} toolId={44} toolName={T.title} prompt={code.slice(0, 200)} />
        )}
      </div>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════════════
   45. Bug 修复
   ═════════════════════════════════════════════════════════════════════ */

export function BugFixTool(_props: CodeToolProps) {
  const { lang } = useI18n();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const stream = useAIStream();
  const hasOutput = stream.text.length > 0 || stream.thinking.length > 0;

  const T = {
    title: lang === 'en' ? 'Bug Fix' : 'Bug 修复',
    sub: lang === 'en' ? 'AI diagnoses and fixes your code' : 'AI 诊断并修复代码',
    input: lang === 'en' ? 'Buggy code' : '有问题的代码',
    err: lang === 'en' ? 'Error message (optional)' : '错误信息(可选)',
    go: lang === 'en' ? 'Fix' : '修复',
    stop: lang === 'en' ? 'Stop' : '停止',
    empty: lang === 'en' ? 'Paste buggy code' : '粘贴有 bug 的代码',
    copy: lang === 'en' ? 'Copy' : '复制',
  };

  const generate = () => {
    if (!code.trim()) return;
    const sys = `你是经验丰富的程序员。请帮我修复下面的代码 bug。\n格式:\n## 原因分析(2-3 句话)\n## 修复后的代码(带 markdown 围栏)\n## 避免建议(1-2 条)\n用中文`;
    stream.run({ systemPrompt: sys, userPrompt: `代码:\n\`\`\`\n${code}\n\`\`\`\n\n错误信息:\n${error || '(无)'}`, temperature: 0.2 });
  };

  return (
    <div className="grid grid-cols-2 h-full">
      <div className="p-6 space-y-3 overflow-y-auto" style={{ borderRight: '1px solid var(--color-border)' }}>
        <Field label={T.input}>
          <CodeArea value={code} onChange={setCode} rows={8} />
        </Field>
        <Field label={T.err}>
          <CodeArea value={error} onChange={setError} rows={5} placeholder="TypeError: ..." />
        </Field>
        <ConfirmButton onClick={stream.streaming ? stream.stop : generate} icon={stream.streaming ? StopIcon : Sparkles} fullWidth>
          {stream.streaming ? T.stop : T.go}
        </ConfirmButton>
      </div>
      <div className="p-6 overflow-y-auto">
        {!hasOutput && !stream.streaming ? <EmptyState icon={Bug} text={T.empty} /> : (
          <AIToolPanel stream={stream} toolId={45} toolName={T.title} prompt={code.slice(0, 200)} />
        )}
      </div>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════════════
   46. SQL 生成
   ═════════════════════════════════════════════════════════════════════ */

export function SQLGeneratorTool(_props: CodeToolProps) {
  const { lang } = useI18n();
  const [desc, setDesc] = useState('查询所有用户最近 30 天的订单,按金额降序');
  const [dialect, setDialect] = useState('MySQL');
  const stream = useAIStream();
  const hasOutput = stream.text.length > 0 || stream.thinking.length > 0;

  const T = {
    title: lang === 'en' ? 'SQL Generator' : 'SQL 生成',
    sub: lang === 'en' ? 'AI turns natural language into SQL' : 'AI 自然语言转 SQL',
    input: lang === 'en' ? 'Describe what you need' : '描述你的需求',
    dialect: lang === 'en' ? 'SQL dialect' : 'SQL 方言',
    go: lang === 'en' ? 'Generate' : '生成',
    stop: lang === 'en' ? 'Stop' : '停止',
    empty: lang === 'en' ? 'Describe the query you need' : '描述你要查询的内容',
    copy: lang === 'en' ? 'Copy' : '复制',
  };

  const generate = () => {
    if (!desc.trim()) return;
    const sys = `你是 ${dialect} 专家。请根据用户需求生成 SQL。\n格式:\n## SQL(完整可执行,带 markdown 围栏)\n## 解释(逐行注释)\n## 性能建议(索引/优化)`;
    stream.run({ systemPrompt: sys, userPrompt: desc, temperature: 0.2 });
  };

  return (
    <div className="grid grid-cols-2 h-full">
      <div className="p-6 space-y-3 overflow-y-auto" style={{ borderRight: '1px solid var(--color-border)' }}>
        <Field label={T.dialect}>
          <Select value={dialect} onChange={setDialect} options={['MySQL', 'PostgreSQL', 'SQLite', 'SQL Server', 'Oracle', 'BigQuery'].map((l) => ({ value: l, label: l }))} />
        </Field>
        <Field label={T.input}>
          <TextArea value={desc} onChange={setDesc} rows={10} />
        </Field>
        <ConfirmButton onClick={stream.streaming ? stream.stop : generate} icon={stream.streaming ? StopIcon : Sparkles} fullWidth>
          {stream.streaming ? T.stop : T.go}
        </ConfirmButton>
      </div>
      <div className="p-6 overflow-y-auto">
        {!hasOutput && !stream.streaming ? <EmptyState icon={Database} text={T.empty} /> : (
          <AIToolPanel stream={stream} toolId={46} toolName={T.title} prompt={desc.slice(0, 200)} />
        )}
      </div>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════════════
   47. Shell 命令
   ═════════════════════════════════════════════════════════════════════ */

export function ShellGenTool(_props: CodeToolProps) {
  const { lang } = useI18n();
  const [desc, setDesc] = useState('查找 /var/log 下所有 .log 文件,统计每个文件行数,按行数降序');
  const [shell, setShell] = useState('bash');
  const stream = useAIStream();
  const hasOutput = stream.text.length > 0 || stream.thinking.length > 0;

  const T = {
    title: lang === 'en' ? 'Shell Generator' : 'Shell 生成',
    sub: lang === 'en' ? 'AI turns descriptions into shell commands' : 'AI 自然语言转 shell 命令',
    input: lang === 'en' ? 'Describe the task' : '描述想做什么',
    type: lang === 'en' ? 'Shell type' : 'Shell 类型',
    go: lang === 'en' ? 'Generate' : '生成',
    stop: lang === 'en' ? 'Stop' : '停止',
    empty: lang === 'en' ? 'Describe what you want to do' : '描述想做什么',
    copy: lang === 'en' ? 'Copy' : '复制',
  };

  const generate = () => {
    if (!desc.trim()) return;
    const sys = `你是 ${shell} 专家。把用户需求翻译成 ${shell} 命令,优先简洁。\n格式:\n## 命令(带 markdown 围栏)\n## 说明(逐行解释参数)\n## 风险提示(是否修改/删除数据)`;
    stream.run({ systemPrompt: sys, userPrompt: desc, temperature: 0.2 });
  };

  return (
    <div className="grid grid-cols-2 h-full">
      <div className="p-6 space-y-3 overflow-y-auto" style={{ borderRight: '1px solid var(--color-border)' }}>
        <Field label={T.type}>
          <Select value={shell} onChange={setShell} options={['bash', 'zsh', 'fish', 'powershell', 'cmd'].map((l) => ({ value: l, label: l }))} />
        </Field>
        <Field label={T.input}>
          <TextArea value={desc} onChange={setDesc} rows={10} />
        </Field>
        <ConfirmButton onClick={stream.streaming ? stream.stop : generate} icon={stream.streaming ? StopIcon : Sparkles} fullWidth>
          {stream.streaming ? T.stop : T.go}
        </ConfirmButton>
      </div>
      <div className="p-6 overflow-y-auto">
        {!hasOutput && !stream.streaming ? <EmptyState icon={Terminal} text={T.empty} /> : (
          <AIToolPanel stream={stream} toolId={47} toolName={T.title} prompt={desc.slice(0, 200)} />
        )}
      </div>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════════════
   50. 单元测试
   ═════════════════════════════════════════════════════════════════════ */

export function UnitTestTool(_props: CodeToolProps) {
  const { lang } = useI18n();
  const [code, setCode] = useState('function add(a, b) { return a + b; }\nfunction multiply(a, b) { return a * b; }');
  const [language, setLanguage] = useState('JavaScript');
  const [framework, setFramework] = useState('Jest');
  const stream = useAIStream();
  const hasOutput = stream.text.length > 0 || stream.thinking.length > 0;

  const T = {
    title: lang === 'en' ? 'Unit Test' : '单元测试',
    sub: lang === 'en' ? 'AI generates unit tests for your code' : 'AI 生成单元测试',
    input: lang === 'en' ? 'Code to test' : '要测试的代码',
    go: lang === 'en' ? 'Generate' : '生成测试',
    stop: lang === 'en' ? 'Stop' : '停止',
    empty: lang === 'en' ? 'Paste code to test' : '粘贴要测试的代码',
    copy: lang === 'en' ? 'Copy' : '复制',
  };

  const generate = () => {
    if (!code.trim()) return;
    const sys = `你是测试专家。请为下面的 ${language} 函数生成 ${framework} 单元测试:\n- 覆盖正常/边界/异常用例\n- 用 markdown 围栏输出\n- 只输出测试代码,不要解释`;
    stream.run({ systemPrompt: sys, userPrompt: code, temperature: 0.2 });
  };

  return (
    <div className="grid grid-cols-2 h-full">
      <div className="p-6 space-y-3 overflow-y-auto" style={{ borderRight: '1px solid var(--color-border)' }}>
        <div className="grid grid-cols-2 gap-2">
          <Field label={lang === 'en' ? 'Lang' : '语言'}>
            <Select value={language} onChange={setLanguage} options={LANGS.map((l) => ({ value: l, label: l }))} />
          </Field>
          <Field label={lang === 'en' ? 'Framework' : '框架'}>
            <Select value={framework} onChange={setFramework} options={['Jest', 'Vitest', 'Mocha', 'pytest', 'JUnit', 'Go testing', 'Rust test'].map((l) => ({ value: l, label: l }))} />
          </Field>
        </div>
        <Field label={T.input}>
          <CodeArea value={code} onChange={setCode} rows={10} />
        </Field>
        <ConfirmButton onClick={stream.streaming ? stream.stop : generate} icon={stream.streaming ? StopIcon : Sparkles} fullWidth>
          {stream.streaming ? T.stop : T.go}
        </ConfirmButton>
      </div>
      <div className="p-6 overflow-y-auto">
        {!hasOutput && !stream.streaming ? <EmptyState icon={FlaskConical} text={T.empty} /> : (
          <AIToolPanel stream={stream} toolId={50} toolName={T.title} prompt={code.slice(0, 200)} />
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

function TextArea({ value, onChange, placeholder, rows = 4 }: any) {
  return (
    <textarea
      value={value} placeholder={placeholder} rows={rows}
      onChange={(e: any) => onChange(e.target.value)}
      className="w-full px-3 py-2.5 rounded-lg text-[12px] outline-none resize-none"
      style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)', lineHeight: 1.5, fontFamily: 'inherit' }}
      onFocus={(e: any) => { e.currentTarget.style.borderColor = 'var(--color-accent)'; e.currentTarget.style.boxShadow = '0 0 0 3px var(--color-accent-glow)'; }}
      onBlur={(e: any) => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.boxShadow = 'none'; }}
    />
  );
}

function CodeArea({ value, onChange, rows = 4, placeholder }: any) {
  return (
    <textarea
      value={value} placeholder={placeholder} rows={rows}
      onChange={(e: any) => onChange(e.target.value)}
      className="w-full px-3 py-2.5 rounded-lg text-[12px] font-mono outline-none resize-none"
      style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)', lineHeight: 1.5 }}
      onFocus={(e: any) => { e.currentTarget.style.borderColor = 'var(--color-accent)'; e.currentTarget.style.boxShadow = '0 0 0 3px var(--color-accent-glow)'; }}
      onBlur={(e: any) => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.boxShadow = 'none'; }}
    />
  );
}

function Select({ value, onChange, options }: any) {
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
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
        <Icon size={26} strokeWidth={1.5} style={{ color: 'var(--color-text-muted)' }} />
      </div>
      <p className="text-[13px]" style={{ color: 'var(--color-text-muted)' }}>{text}</p>
    </div>
  );
}

/* ─────────── Tool registry ─────────── */
export const CODE_TOOLS: Record<number, { Component: any; icon: LucideIcon }> = {
  43: { Component: CodeCompletionTool, icon: Code },
  44: { Component: CodeExplainerTool, icon: FileSearch },
  45: { Component: BugFixTool, icon: Bug },
  46: { Component: SQLGeneratorTool, icon: Database },
  47: { Component: ShellGenTool, icon: Terminal },
  50: { Component: UnitTestTool, icon: FlaskConical },
};
