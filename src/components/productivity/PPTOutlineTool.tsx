import { useState, useMemo } from 'react';
import { Presentation, Sparkles, ChevronRight, ChevronDown, Copy, Check, Download, FileText, Clock, Users } from 'lucide-react';
import { useI18n } from '../../hooks/useI18n';
import { Button, ConfirmButton } from '../ui/Button';

type PptStyle = 'business' | 'product' | 'academic' | 'training' | 'pitch' | 'storytelling';

const STYLES: Record<PptStyle, { zh: string; en: string; chapters: number; pacing: string; tone: string }> = {
  business: { zh: '商务汇报', en: 'Business', chapters: 6, pacing: '数据驱动 · 结论先行', tone: '专业严谨' },
  product: { zh: '产品介绍', en: 'Product', chapters: 7, pacing: '问题 → 方案 → 演示', tone: '清晰有力' },
  academic: { zh: '学术答辩', en: 'Academic', chapters: 8, pacing: '背景 → 方法 → 结果 → 讨论', tone: '逻辑严密' },
  training: { zh: '培训课件', en: 'Training', chapters: 6, pacing: '概念 → 示例 → 练习 → 小结', tone: '通俗易懂' },
  pitch: { zh: '融资路演', en: 'Pitch', chapters: 9, pacing: '故事 → 痛点 → 方案 → 市场 → 团队', tone: '激情 + 数据' },
  storytelling: { zh: '故事讲述', en: 'Storytelling', chapters: 5, pacing: '起 → 承 → 转 → 合', tone: '感染力' },
};

interface PptSlide {
  id: string;
  type: 'cover' | 'agenda' | 'section' | 'content' | 'data' | 'quote' | 'summary' | 'thanks';
  title: string;
  bullets?: string[];
  note?: string;
  designHint?: string;
}

function genPpt(topic: string, audience: string, style: PptStyle, pages: number): PptSlide[] {
  const slides: PptSlide[] = [];
  const id = () => Math.random().toString(36).slice(2, 9);

  // 1. Cover
  slides.push({
    id: id(),
    type: 'cover',
    title: topic,
    note: `开场 30 秒:用一个与 ${audience} 相关的强有力问题或数据吸引注意力。`,
    designHint: '大标题居中,放公司 logo;副标题用浅色;背景图与主题相关。',
  });

  // 2. Agenda
  slides.push({
    id: id(),
    type: 'agenda',
    title: '议程',
    bullets: ['背景与挑战', '核心解决方案', '实施路径', '成果与价值', '未来规划'],
    note: '议程页要让观众知道接下来要讲什么,以及为什么这样组织。',
    designHint: '用图标 + 简短文字,不要超过 5 项。',
  });

  // 3-N. Content based on style
  const styleTemplates: Record<PptStyle, { titles: string[]; bullets: string[]; notes: string[] }[]> = {
    business: [
      { titles: ['市场背景'], bullets: ['行业当前规模与增长率', '竞争格局与主要玩家', '技术发展趋势', '监管政策影响'], notes: ['用 1-2 个权威数据源,标明出处。'] },
      { titles: ['核心挑战'], bullets: ['业务痛点 1(具体场景)', '痛点导致的损失(量化)', '现有方案的不足', '对客户的影响'], notes: ['痛点要具体,避免空泛。'] },
      { titles: ['解决方案'], bullets: ['整体架构图', '核心技术亮点', '差异化优势', '客户价值主张'], notes: ['强调"对我们客户意味着什么"。'] },
      { titles: ['实施路径'], bullets: ['分阶段计划', '关键里程碑', '资源投入', '风险与应对'], notes: ['展示可执行性,不要只画饼。'] },
      { titles: ['预期成果'], bullets: ['量化目标(收入/成本/效率)', '客户案例(可脱敏)', 'ROI 分析', '长期价值'], notes: ['用前后对比图,数据说话。'] },
      { titles: ['总结与下一步'], bullets: ['核心要点回顾', '下一步建议', '需要的支持', '联系方式'], notes: ['结束页留 1-2 个明确的 CTA。'] },
    ],
    product: [
      { titles: ['用户痛点'], bullets: ['目标用户画像', '当前解决方案的痛点', '痛点的频次与强度', '未被满足的需求'], notes: ['最好有用户访谈或调研数据支撑。'] },
      { titles: ['产品愿景'], bullets: ['我们的使命', '产品定位', '差异化价值', '长期愿景'], notes: ['愿景要宏大但有方向感。'] },
      { titles: ['核心功能'], bullets: ['功能 1:解决的问题', '功能 2:差异化', '功能 3:用户体验亮点', '功能 4:扩展性'], notes: ['每个功能配 1-2 张截图或 demo。'] },
      { titles: ['用户旅程'], bullets: ['首次接触 → 注册', '首次使用 → 激活', '日常使用 → 留存', '进阶使用 → 付费'], notes: ['画一张时间轴图,标注每步关键指标。'] },
      { titles: ['技术架构'], bullets: ['整体架构图', '技术选型理由', '性能指标', '安全与合规'], notes: ['技术深度:让工程师觉得靠谱。'] },
      { titles: ['商业模式'], bullets: ['定价策略', '收入预测', '获客成本', 'LTV / CAC'], notes: ['投资人最关注这页。'] },
      { titles: ['路线图'], bullets: ['当前已实现', '3 个月内', '6-12 个月', '未来 1 年+'], notes: ['给出明确时间表。'] },
    ],
    academic: [
      { titles: ['研究背景'], bullets: ['领域发展现状', '关键科学问题', '已有研究的不足', '本研究的动机'], notes: ['引用近 3 年高被引论文。'] },
      { titles: ['文献综述'], bullets: ['主流方法 A 的优缺点', '主流方法 B 的优缺点', '现有方法的局限性', '本研究切入点'], notes: ['用表格对比各方法。'] },
      { titles: ['研究目标'], bullets: ['总体目标', '具体目标 1', '具体目标 2', '创新点'], notes: ['目标要具体可衡量。'] },
      { titles: ['研究方法'], bullets: ['实验设计', '数据来源', '技术路线', '评价指标'], notes: ['流程图清晰展示。'] },
      { titles: ['实验结果'], bullets: ['结果 1:核心指标', '结果 2:对比基线', '结果 3:消融实验', '结果 4:案例分析'], notes: ['图 > 表 > 文字。'] },
      { titles: ['结果分析'], bullets: ['关键发现的解释', '与现有研究的对比', '可能的局限性', '适用范围'], notes: ['客观分析,不回避问题。'] },
      { titles: ['结论与展望'], bullets: ['主要结论', '理论贡献', '实践意义', '未来研究方向'], notes: ['控制在 5 分钟内。'] },
      { titles: ['参考文献与致谢'], bullets: ['核心参考文献(10-20 篇)', '致谢导师与合作者', '项目资助', 'Q&A'], notes: ['预留 Q&A 时间。'] },
    ],
    training: [
      { titles: ['学习目标'], bullets: ['知识目标:掌握...', '技能目标:能...', '态度目标:理解...', '考核方式'], notes: ['学习目标要可衡量。'] },
      { titles: ['核心概念'], bullets: ['概念 1 的定义', '概念 1 的关键特征', '概念 1 的常见误区', '概念 1 的应用场景'], notes: ['用类比、生活化例子解释抽象概念。'] },
      { titles: ['操作步骤'], bullets: ['步骤 1:准备工作', '步骤 2:执行过程', '步骤 3:检查要点', '步骤 4:常见错误'], notes: ['每步配 1 张示意图。'] },
      { titles: ['实战案例'], bullets: ['案例背景', '操作过程截图', '结果对比', '经验总结'], notes: ['案例要真实,贴近学员工作。'] },
      { titles: ['练习与答疑'], bullets: ['随堂练习题', '小组讨论题', '常见问题预演', '拓展资源推荐'], notes: ['预留 10-15 分钟答疑。'] },
      { titles: ['总结与作业'], bullets: ['核心要点回顾', '课后作业', '推荐阅读', '答疑联系方式'], notes: ['作业要明确截止时间与提交方式。'] },
    ],
    pitch: [
      { titles: ['开场故事'], bullets: ['1 个客户的真实痛点场景', '你如何遇到这个客户', '他们当时的绝望/无奈'], notes: ['讲故事,不要讲道理。'] },
      { titles: ['市场规模'], bullets: ['TAM 总体可达市场', 'SAM 可服务市场', 'SOM 可获得市场', '增速与未来 5 年预测'], notes: ['用图表呈现,数字要权威。'] },
      { titles: ['解决方案'], bullets: ['产品/服务概述', '核心价值主张', '差异化壁垒', '知识产权/技术专利'], notes: ['10 秒讲清楚"做什么"。'] },
      { titles: ['商业模式'], bullets: ['如何赚钱', '单位经济模型', '获客成本与生命周期价值', '规模化路径'], notes: ['投资人最关心。'] },
      { titles: ['增长数据'], bullets: ['用户数增长', '收入增长(柱状图)', '关键指标趋势', '客户案例与口碑'], notes: ['数字要具体,可信。'] },
      { titles: ['竞争分析'], bullets: ['主要竞品', '我们的优势', '护城河', '如何应对竞争'], notes: ['不要贬低对手,讲差异化。'] },
      { titles: ['团队介绍'], bullets: ['创始人背景', '核心成员', '顾问与董事会', '组织能力'], notes: ['为什么是你们能做这件事。'] },
      { titles: ['融资计划'], bullets: ['本轮融资金额', '估值与释放股份', '资金用途', '里程碑'], notes: ['清晰具体,不要模棱两可。'] },
      { titles: ['愿景与邀请'], bullets: ['我们的愿景', '为什么是现在', '为什么是您', '下一步行动'], notes: ['有力的结尾 + 明确 CTA。'] },
    ],
    storytelling: [
      { titles: ['引子:背景'], bullets: ['时间地点', '主角介绍', '世界的初始状态', '观众共鸣点'], notes: ['让观众"看见"这个故事。'] },
      { titles: ['冲突:挑战'], bullets: ['发生了什么变化', '主角遇到的难题', '情感张力', '为何不能放弃'], notes: ['冲突是故事的引擎。'] },
      { titles: ['转折:行动'], bullets: ['主角的决定', '采取的行动', '过程中的牺牲', '关键的领悟'], notes: ['行动要具体、有画面感。'] },
      { titles: ['高潮:结果'], bullets: ['转折点的结果', '情感/数据的胜利', '学到的东西', '新的平衡'], notes: ['这是全场最动人的一页。'] },
      { titles: ['尾声:启示'], bullets: ['对观众的启发', '可以应用的场景', '开放性的结尾', '记忆点'], notes: ['让观众带走的"一句话"。'] },
    ],
  };

  const content = styleTemplates[style];
  const totalContent = Math.min(pages - 2, content.length); // 减去封面+总结
  for (let i = 0; i < totalContent; i++) {
    const t = content[i];
    slides.push({
      id: id(),
      type: i % 3 === 1 ? 'data' : 'content',
      title: t.titles[0],
      bullets: t.bullets,
      note: t.notes[0],
      designHint: '每页 ≤ 5 个要点,字号 ≥ 18pt;多用图表代替文字。',
    });
  }

  // Summary
  slides.push({
    id: id(),
    type: 'summary',
    title: '核心要点回顾',
    bullets: ['核心要点 1', '核心要点 2', '核心要点 3', '下一步行动'],
    note: '结尾页:回顾 + 明确的下一步。',
    designHint: '大字号,可加金句标语。',
  });

  // Thanks
  slides.push({
    id: id(),
    type: 'thanks',
    title: '感谢聆听',
    note: 'Q&A 环节预留 10-15 分钟。',
    designHint: '简洁的"谢谢" + 联系方式。',
  });

  return slides;
}

const TYPE_LABEL: Record<PptSlide['type'], { zh: string; en: string; color: string }> = {
  cover: { zh: '封面', en: 'Cover', color: 'var(--color-accent)' },
  agenda: { zh: '目录', en: 'TOC', color: '#10b981' },
  section: { zh: '章节', en: 'Section', color: '#10b981' },
  content: { zh: '内容', en: 'Content', color: 'var(--color-text-secondary)' },
  data: { zh: '数据', en: 'Data', color: '#0ea5e9' },
  quote: { zh: '金句', en: 'Quote', color: '#f59e0b' },
  summary: { zh: '总结', en: 'Summary', color: '#ec4899' },
  thanks: { zh: '致谢', en: 'Thanks', color: '#8b5cf6' },
};

export function PPTOutlineTool() {
  const { lang } = useI18n();
  const T = {
    title: lang === 'en' ? 'PPT Outline' : 'PPT 大纲',
    sub: lang === 'en' ? 'AI-generated slide structure' : 'AI 生成的完整 PPT 大纲',
    topic: lang === 'en' ? 'Topic' : '主题',
    audience: lang === 'en' ? 'Audience' : '受众',
    style: lang === 'en' ? 'Style' : '风格',
    pages: lang === 'en' ? 'Slide count' : '页数',
    go: lang === 'en' ? 'Generate' : '生成大纲',
    again: lang === 'en' ? 'Regenerate' : '换一组',
    copyAll: lang === 'en' ? 'Copy all' : '复制全部',
    copied: lang === 'en' ? 'Copied' : '已复制',
    download: lang === 'en' ? 'Download .md' : '下载 Markdown',
    empty: lang === 'en' ? 'Fill the form to generate' : '填写左侧表单,生成 PPT 大纲',
    note: lang === 'en' ? 'Speaker note' : '演讲提示',
    design: lang === 'en' ? 'Design tip' : '设计建议',
    slides: lang === 'en' ? 'slides' : '页',
  };

  const [topic, setTopic] = useState('');
  const [audience, setAudience] = useState('');
  const [style, setStyle] = useState<PptStyle>('business');
  const [pages, setPages] = useState(10);
  const [slides, setSlides] = useState<PptSlide[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);

  const stats = useMemo(() => ({
    total: slides.length,
    minutes: Math.ceil(slides.length * 1.5),
  }), [slides]);

  const generate = () => {
    if (!topic.trim()) return;
    const list = genPpt(topic.trim(), audience.trim() || (lang === 'en' ? 'audience' : '观众'), style, pages);
    setSlides(list);
    setExpanded(new Set(list.slice(0, 3).map((s) => s.id))); // 默认展开前 3 页
  };

  const toggle = (id: string) => {
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id); else next.add(id);
    setExpanded(next);
  };

  const exportMd = () => {
    let md = `# ${topic}\n\n`;
    if (audience) md += `> 受众:${audience} · 风格:${STYLES[style][lang]}\n\n---\n\n`;
    slides.forEach((s, i) => {
      md += `## 第 ${i + 1} 页: ${s.title}\n\n`;
      md += `**类型**:${TYPE_LABEL[s.type][lang]}\n\n`;
      if (s.bullets && s.bullets.length) {
        md += `**要点**:\n`;
        s.bullets.forEach((b) => { md += `- ${b}\n`; });
        md += '\n';
      }
      if (s.note) md += `> 🎤 **演讲提示**:${s.note}\n\n`;
      if (s.designHint) md += `> 🎨 **设计建议**:${s.designHint}\n\n`;
      md += '---\n\n';
    });
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${topic}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyAll = () => {
    const md = slides.map((s, i) => {
      let t = `## ${i + 1}. ${s.title}\n`;
      if (s.bullets) t += s.bullets.map((b) => `  - ${b}`).join('\n') + '\n';
      if (s.note) t += `  [演讲] ${s.note}\n`;
      return t;
    }).join('\n');
    navigator.clipboard?.writeText(`# ${topic}\n\n${md}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="grid grid-cols-[340px_1fr] h-full">
      {/* Left: form */}
      <div className="p-6 space-y-4 overflow-y-auto" style={{ borderRight: '1px solid var(--color-border)' }}>
        <Field label={T.topic} hint={lang === 'en' ? 'What\'s your PPT about?' : '你这次 PPT 讲什么?'}>
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder={lang === 'en' ? 'e.g. Q4 2026 Strategy Review' : '如:2026 Q4 战略复盘'}
            className="w-full h-9 px-3 rounded-lg text-[13px] outline-none"
            style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
            onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--color-accent)'; e.currentTarget.style.boxShadow = '0 0 0 3px var(--color-accent-glow)'; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.boxShadow = 'none'; }}
          />
        </Field>

        <Field label={T.audience} hint={lang === 'en' ? 'Who will listen?' : '谁会听?'}>
          <input
            type="text"
            value={audience}
            onChange={(e) => setAudience(e.target.value)}
            placeholder={lang === 'en' ? 'e.g. Board of directors' : '如:董事会成员'}
            className="w-full h-9 px-3 rounded-lg text-[13px] outline-none"
            style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
            onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--color-accent)'; e.currentTarget.style.boxShadow = '0 0 0 3px var(--color-accent-glow)'; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.boxShadow = 'none'; }}
          />
        </Field>

        <Field label={T.style}>
          <select
            value={style}
            onChange={(e) => setStyle(e.target.value as PptStyle)}
            className="w-full h-9 px-3 rounded-lg text-[13px] outline-none appearance-none cursor-pointer"
            style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)', backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%235a5a66' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E\")", backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', paddingRight: '32px' }}
          >
            {(Object.keys(STYLES) as PptStyle[]).map((k) => (
              <option key={k} value={k}>{STYLES[k][lang]}</option>
            ))}
          </select>
        </Field>

        <div className="rounded-lg p-3" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
          <p className="text-[11px] font-medium mb-1" style={{ color: 'var(--color-text-primary)' }}>{STYLES[style][lang]}</p>
          <p className="text-[10px] mb-0.5" style={{ color: 'var(--color-text-muted)' }}>📐 {STYLES[style].pacing}</p>
          <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>🎭 {STYLES[style].tone}</p>
        </div>

        <Field label={T.pages} hint={`${pages} ${T.slides} · ~${Math.ceil(pages * 1.5)} ${lang === 'en' ? 'min' : '分钟'}`}>
          <input type="range" min={5} max={20} value={pages} onChange={(e) => setPages(Number(e.target.value))} className="w-full" style={{ accentColor: 'var(--color-accent)' }} />
        </Field>

        <ConfirmButton onClick={generate} icon={Sparkles} fullWidth>{slides.length ? T.again : T.go}</ConfirmButton>
      </div>

      {/* Right: slides list */}
      <div className="overflow-y-auto">
        {slides.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Presentation size={48} strokeWidth={1.2} style={{ color: 'var(--color-text-muted)' }} />
            <p className="text-[13px] mt-3" style={{ color: 'var(--color-text-muted)' }}>{T.empty}</p>
          </div>
        ) : (
          <div className="p-6 space-y-4 max-w-3xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>{topic}</h2>
                <div className="flex items-center gap-3 text-[11px] mt-1" style={{ color: 'var(--color-text-muted)' }}>
                  <span className="flex items-center gap-1"><FileText size={10} />{stats.total} {T.slides}</span>
                  <span className="flex items-center gap-1"><Clock size={10} />~{stats.minutes} {lang === 'en' ? 'min' : '分钟'}</span>
                  {audience && <span className="flex items-center gap-1"><Users size={10} />{audience}</span>}
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={copyAll} icon={copied ? Check : Copy}>{copied ? T.copied : T.copyAll}</Button>
                <Button variant="primary" size="sm" onClick={exportMd} icon={Download}>{T.download}</Button>
              </div>
            </div>

            {/* Slide cards */}
            <div className="space-y-2">
              {slides.map((s, i) => {
                const isOpen = expanded.has(s.id);
                const type = TYPE_LABEL[s.type];
                return (
                  <div key={s.id} className="rounded-xl overflow-hidden" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
                    <button
                      onClick={() => toggle(s.id)}
                      className="w-full px-4 py-3 flex items-center gap-3 text-left"
                    >
                      <span
                        className="w-7 h-7 rounded-md flex items-center justify-center text-[11px] font-semibold shrink-0"
                        style={{ background: type.color, color: '#0a0a0c' }}
                      >
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[14px] font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>{s.title}</span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: 'var(--color-bg-main)', color: type.color }}>
                            {type[lang]}
                          </span>
                        </div>
                        {s.bullets && (
                          <p className="text-[11px] mt-0.5 truncate" style={{ color: 'var(--color-text-muted)' }}>{s.bullets[0]}</p>
                        )}
                      </div>
                      {isOpen ? <ChevronDown size={16} style={{ color: 'var(--color-text-muted)' }} /> : <ChevronRight size={16} style={{ color: 'var(--color-text-muted)' }} />}
                    </button>
                    {isOpen && (
                      <div className="px-4 pb-4 space-y-3" style={{ borderTop: '1px solid var(--color-border)' }}>
                        {s.bullets && (
                          <div className="pt-3">
                            <ul className="space-y-1.5">
                              {s.bullets.map((b, j) => (
                                <li key={j} className="text-[13px] flex gap-2" style={{ color: 'var(--color-text-secondary)' }}>
                                  <span style={{ color: 'var(--color-accent)' }}>·</span>{b}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {s.note && (
                          <div className="rounded-lg p-2.5" style={{ background: 'var(--color-accent-glow)', border: '1px solid var(--color-accent-glow)' }}>
                            <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--color-accent)' }}>🎤 {T.note}</p>
                            <p className="text-[12px] leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>{s.note}</p>
                          </div>
                        )}
                        {s.designHint && (
                          <div className="rounded-lg p-2.5" style={{ background: 'var(--color-bg-main)' }}>
                            <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--color-text-muted)' }}>🎨 {T.design}</p>
                            <p className="text-[12px] leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>{s.designHint}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, hint, children }: any) {
  return (
    <div className="space-y-1.5">
      <label className="text-[13px] font-medium block" style={{ color: 'var(--color-text-primary)' }}>{label}</label>
      {hint && <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>{hint}</p>}
      {children}
    </div>
  );
}
