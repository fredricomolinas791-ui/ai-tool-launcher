import { useState } from 'react';
import { Heart, AlertTriangle, Phone, BookOpen, Brain, Sparkles, ChevronRight, Save, History } from 'lucide-react';
import { useI18n } from '../../hooks/useI18n';
import { Button, ConfirmButton } from '../ui/Button';
import { AIOutputModal } from '../ui/AIOutputModal';

/* ═══════════════════ 情绪评估系统 ═══════════════════ */

interface MoodScore {
  anxiety: number;     // 0-10
  depression: number;  // 0-10
  anger: number;       // 0-10
  sadness: number;     // 0-10
  loneliness: number;  // 0-10
  sleep: number;       // 0-10  越低越差
  selfWorth: number;   // 0-10
  crisis: number;      // 0-10
}

const INITIAL_SCORE: MoodScore = {
  anxiety: 3, depression: 3, anger: 2, sadness: 3, loneliness: 3,
  sleep: 6, selfWorth: 5, crisis: 0,
};

const MOOD_LABELS = {
  anxiety: { zh: '焦虑', en: 'Anxiety', color: '#f59e0b' },
  depression: { zh: '低落', en: 'Low mood', color: '#6366f1' },
  anger: { zh: '愤怒', en: 'Anger', color: '#ef4444' },
  sadness: { zh: '悲伤', en: 'Sadness', color: '#8b5cf6' },
  loneliness: { zh: '孤独', en: 'Loneliness', color: '#0ea5e9' },
  sleep: { zh: '睡眠', en: 'Sleep', color: '#10b981' },
  selfWorth: { zh: '自我价值', en: 'Self-worth', color: '#ec4899' },
  crisis: { zh: '危机信号', en: 'Crisis', color: '#dc2626' },
};

/* ═══════════════════ 危机识别关键词(自伤/自杀) ═══════════════════ */
const CRISIS_KEYWORDS = [
  '自杀', '不想活', '结束生命', '死了算了', '伤害自己', '自残',
  'suicide', 'kill myself', 'end it all', 'self harm', 'self-harm', 'cut myself',
  '没意义', '活不下去', '想死', '一了百了', '离开这个世界',
];

/* ═══════════════════ 认知扭曲模式(用于分析) ═══════════════════ */
const COGNITIVE_DISTORTIONS = [
  { key: 'allOrNothing', zh: '全或无', en: 'All-or-nothing', example: '"我这次没成功 = 我是失败者"' },
  { key: 'catastrophizing', zh: '灾难化', en: 'Catastrophizing', example: '"完蛋了,一切都毁了"' },
  { key: 'mindReading', zh: '读心术', en: 'Mind reading', example: '"他一定觉得我是个怪人"' },
  { key: 'shouldStatements', zh: '"应该"句式', en: '"Should" statements', example: '"我不应该犯这种错"' },
  { key: 'personalization', zh: '个人化', en: 'Personalization', example: '"都是我的错"' },
  { key: 'emotionalReasoning', zh: '情绪化推理', en: 'Emotional reasoning', example: '"我感觉很糟 = 事情一定很糟"' },
];

/* ═══════════════════ 多维情绪分析器 ═══════════════════ */

interface Analysis {
  detected: { mood: keyof MoodScore; intensity: number; matched: string[] }[];
  primary: keyof MoodScore;
  severity: 'low' | 'medium' | 'high' | 'crisis';
  distortion?: typeof COGNITIVE_DISTORTIONS[number];
  isCrisis: boolean;
}

const MOOD_KEYWORDS: Record<keyof MoodScore, { zh: string[]; en: string[]; weight: number }[]> = {
  anxiety: [
    { zh: ['焦虑', '紧张', '担忧', '不安', '心慌', '害怕'], en: ['anxious', 'worried', 'nervous', 'panic'], weight: 1 },
    { zh: ['睡不着', '喘不过气', '心跳快'], en: ['cant breathe', 'heart racing'], weight: 1.5 },
  ],
  depression: [
    { zh: ['没意思', '没劲', '提不起', '空虚', '麻木'], en: ['empty', 'numb', 'pointless', 'no energy'], weight: 1.2 },
    { zh: ['抑郁', '绝望', '无望', '看不到未来'], en: ['hopeless', 'depressed', 'no future'], weight: 1.5 },
  ],
  anger: [
    { zh: ['生气', '愤怒', '烦', '讨厌', '受不了'], en: ['angry', 'mad', 'frustrated', 'furious', 'annoyed'], weight: 1 },
    { zh: ['气死了', '恨不得', '凭什么'], en: ['hate this', 'so unfair'], weight: 1.3 },
  ],
  sadness: [
    { zh: ['难过', '伤心', '哭', '心疼', '心酸'], en: ['sad', 'crying', 'heartbroken', 'hurt'], weight: 1 },
    { zh: ['眼泪', '流眼泪', '哭出来'], en: ['tears'], weight: 1.3 },
  ],
  loneliness: [
    { zh: ['孤独', '一个人', '没人理解', '不被理解', '寂寞'], en: ['lonely', 'alone', 'misunderstood', 'isolated'], weight: 1.2 },
  ],
  sleep: [
    { zh: ['失眠', '睡不着', '睡不好', '早醒'], en: ['insomnia', 'cant sleep', 'sleepless'], weight: 1 },
  ],
  selfWorth: [
    { zh: ['我不行', '没用', '废物', '一无是处', '不如别人', '自卑'], en: ['worthless', 'useless', 'not good enough', 'inadequate'], weight: 1.3 },
  ],
  crisis: [
    { zh: ['自杀', '想死', '不想活', '伤害自己', '一了百了', '结束生命'], en: ['suicide', 'kill myself', 'end my life', 'self harm'], weight: 3 },
  ],
};

function analyzeText(text: string): Analysis {
  const lower = text.toLowerCase();
  const detected: Analysis['detected'] = [];
  let totalCrisis = 0;
  let distortion: typeof COGNITIVE_DISTORTIONS[number] | undefined;

  // Crisis first (highest priority)
  CRISIS_KEYWORDS.forEach((kw) => {
    if (lower.includes(kw.toLowerCase())) totalCrisis += 3;
  });

  // Mood detection
  (Object.keys(MOOD_KEYWORDS) as (keyof MoodScore)[]).forEach((mood) => {
    const keywords = MOOD_KEYWORDS[mood];
    const matched: string[] = [];
    let weight = 0;
    keywords.forEach((k) => {
      [...k.zh, ...k.en].forEach((w) => {
        if (w.length < 2) return;
        if (lower.includes(w.toLowerCase())) {
          matched.push(w);
          weight += k.weight;
        }
      });
    });
    if (matched.length > 0) {
      const intensity = Math.min(10, weight * 1.5);
      detected.push({ mood, intensity, matched });
    }
  });

  // Cognitive distortion detection
  if (/总是|永远|从不|没人|所有人都|everyone|never|always|nobody/i.test(text)) {
    distortion = COGNITIVE_DISTORTIONS[0]; // All-or-nothing
  } else if (/完蛋|毁|完了|disaster|ruined|terrible/i.test(text)) {
    distortion = COGNITIVE_DISTORTIONS[1]; // Catastrophizing
  } else if (/一定|肯定|definitely|they must think/i.test(text)) {
    distortion = COGNITIVE_DISTORTIONS[2]; // Mind reading
  } else if (/应该|不该|should|must not/i.test(text)) {
    distortion = COGNITIVE_DISTORTIONS[3]; // Should statements
  } else if (/都怪我|是我的错|my fault/i.test(text)) {
    distortion = COGNITIVE_DISTORTIONS[4]; // Personalization
  } else if (/感觉.*所以|feel so.*it must/i.test(text)) {
    distortion = COGNITIVE_DISTORTIONS[5]; // Emotional reasoning
  }

  // Severity
  let severity: Analysis['severity'] = 'low';
  if (totalCrisis > 0) severity = 'crisis';
  else if (detected.some((d) => d.intensity >= 7)) severity = 'high';
  else if (detected.length >= 2 || detected.some((d) => d.intensity >= 4)) severity = 'medium';

  // Primary mood
  const primary = detected.length === 0 ? 'anxiety' : detected.sort((a, b) => b.intensity - a.intensity)[0].mood;

  return {
    detected,
    primary,
    severity,
    distortion,
    isCrisis: totalCrisis > 0,
  };
}

/* ═══════════════════ 治疗技术 — 真实可执行 ═══════════════════ */

const TECHNIQUES: Record<string, { title: { zh: string; en: string }; steps: { zh: string[]; en: string[] }; duration: string }> = {
  grounding_54321: {
    title: { zh: '5-4-3-2-1 grounding 练习', en: '5-4-3-2-1 Grounding' },
    steps: {
      zh: ['环顾四周,说出你能看到的 5 样东西', '找到 4 个你能触摸到的东西,感受它的质地', '倾听 3 种你能听到的声音', '找到 2 种你能闻到的气味', '找到 1 种你能尝到的味道'],
      en: ['Look around. Name 5 things you can SEE.', 'Find 4 things you can TOUCH. Notice their texture.', 'Listen for 3 sounds you can HEAR.', 'Notice 2 things you can SMELL.', 'Find 1 thing you can TASTE.'],
    },
    duration: '3-5 分钟',
  },
  box_breathing: {
    title: { zh: '4-4-4-4 盒式呼吸法', en: 'Box breathing' },
    steps: {
      zh: ['用鼻子慢慢吸气,数 4 秒', '屏住呼吸,数 4 秒', '用嘴巴慢慢呼气,数 4 秒', '再次屏住呼吸,数 4 秒', '重复 4-6 轮'],
      en: ['Inhale through your nose for 4 counts', 'Hold for 4 counts', 'Exhale through your mouth for 4 counts', 'Hold empty for 4 counts', 'Repeat for 4-6 rounds'],
    },
    duration: '3 分钟',
  },
  thought_record: {
    title: { zh: '认知扭曲识别 — 思维记录表', en: 'Thought record (CBT)' },
    steps: {
      zh: [
        '记录让你不舒服的情境(在哪里、发生了什么)',
        '写下当时脑子里闪过的第一句话 — 这是"自动思维"',
        '问自己:这句话属于哪种认知扭曲?(看上方 6 种)',
        '列出支持和反对这个想法的证据',
        '写一个更平衡、更温和的替代想法',
      ],
      en: [
        'Write down the situation (where, what happened)',
        'Note the first thought that flashed through your mind — this is the "automatic thought"',
        'Ask: which cognitive distortion is this? (see 6 above)',
        'List evidence for and against this thought',
        'Write a more balanced, kinder alternative',
      ],
    },
    duration: '10-15 分钟',
  },
  behavioral_activation: {
    title: { zh: '行为激活 — 微行动清单', en: 'Behavioral activation' },
    steps: {
      zh: [
        '选 1 件你最近一直拖着没做的小事',
        '把它缩小到 2 分钟内能完成(比如"打开文件"而不是"写完报告")',
        '做完之后,做一个小小的奖励(喝杯水、听首歌)',
        '每天增加一点点,让"动起来"成为新的惯性',
        '用清单打勾的快感,激活大脑的奖赏回路',
      ],
      en: [
        'Pick 1 small thing you\'ve been avoiding',
        'Shrink it to 2 minutes (e.g. "open the file", not "write the report")',
        'After finishing, give yourself a tiny reward (water, a song)',
        'Add a little each day — make motion the new default',
        'Checkboxes activate your brain\'s reward system',
      ],
    },
    duration: '5 分钟 / 次',
  },
  self_compassion: {
    title: { zh: '自我慈悲 — 写给朋友的信', en: 'Self-compassion letter' },
    steps: {
      zh: [
        '想象你最爱的朋友正经历你现在的事',
        '你会对他/她说什么?(温柔、不评判、有同理心)',
        '现在把这段话写给自己 — 把"我"换成"你"',
        '读出来,允许自己被这段话温暖',
        '每天写 1 段,坚持 7 天',
      ],
      en: [
        'Imagine your dearest friend going through exactly what you\'re going through',
        'What would you say to them? (kind, non-judgmental, empathetic)',
        'Now write that to yourself — change "I" to "you"',
        'Read it out loud, let it warm you',
        'Write 1 paragraph daily for 7 days',
      ],
    },
    duration: '10 分钟 / 天',
  },
  sleep_hygiene: {
    title: { zh: '睡眠卫生 7 步法', en: 'Sleep hygiene 7-step' },
    steps: {
      zh: [
        '固定起床时间(周末也别差超过 1 小时)',
        '睡前 1 小时关掉所有屏幕(蓝光抑制褪黑素)',
        '卧室只用来睡觉 — 别在床上工作 / 刷手机',
        '下午 3 点后不喝咖啡(半衰期 5-6 小时)',
        '睡前做 10 分钟身体扫描冥想',
        '如果 20 分钟还睡不着,起床去另一个房间做无聊的事',
        '卧室保持 18-20°C,使用遮光窗帘',
      ],
      en: [
        'Fixed wake time (even weekends, ±1 hour max)',
        'No screens 1 hour before bed (blue light suppresses melatonin)',
        'Bed is for sleep only — no work / scrolling',
        'No caffeine after 3 PM (half-life 5-6 hours)',
        '10-minute body scan meditation before bed',
        'If awake 20+ min, get up, go to another room, do something boring',
        'Bedroom at 18-20°C, blackout curtains',
      ],
    },
    duration: '每晚执行',
  },
  values_sort: {
    title: { zh: '价值观排序练习', en: 'Values clarification' },
    steps: {
      zh: [
        '从 8 个词中圈出对你最重要的 3 个:家庭/事业/健康/自由/友谊/创造/安全/成长',
        '问自己:最近一周,我的时间花在了这些价值上吗?',
        '如果有 1 个不匹配,本周能不能做 1 件小事让它回到正轨?',
        '写下具体的小行动,设到明天或后天的日历',
      ],
      en: [
        'Circle your top 3: Family / Career / Health / Freedom / Friendship / Creativity / Safety / Growth',
        'Ask: this past week, did my time go to these?',
        'If one is mismatched, can you do 1 small thing this week to realign?',
        'Write the small action, schedule it tomorrow or the day after',
      ],
    },
    duration: '15 分钟',
  },
};

/* ═══════════════════ 危机热线(中国 + 国际) ═══════════════════ */
const HOTLINES = [
  { name: '北京心理危机研究与干预中心', phone: '010-82951332', desc: '24 小时,免费', lang: 'zh' },
  { name: '全国心理援助热线', phone: '400-161-9995', desc: '24 小时', lang: 'zh' },
  { name: '希望 24 热线', phone: '400-161-9995', desc: '24 小时,自杀干预', lang: 'zh' },
  { name: '中国心理援助热线', phone: '12320-5', desc: '公共卫生公益', lang: 'zh' },
  { name: 'Crisis Text Line (US)', phone: 'Text HOME to 741741', desc: '24/7 text-based', lang: 'en' },
  { name: '988 Suicide & Crisis Lifeline (US)', phone: '988', desc: '24/7, free', lang: 'en' },
];

/* ═══════════════════ 心情历史(localStorage) ═══════════════════ */

const MOOD_HISTORY_KEY = 'ai-tools-launcher.mood-history.v1';

interface MoodEntry { date: string; score: MoodScore; note: string; }

function loadMoodHistory(): MoodEntry[] {
  try {
    const raw = localStorage.getItem(MOOD_HISTORY_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}
function saveMoodHistory(entries: MoodEntry[]) {
  try { localStorage.setItem(MOOD_HISTORY_KEY, JSON.stringify(entries)); } catch {}
}

/* ═══════════════════ 主组件 ═══════════════════ */

type Tab = 'check' | 'techniques' | 'history' | 'crisis';

export function CounselingTool() {
  const i18n = useI18n();
  const lang = i18n.lang as 'zh' | 'en';
  const [tab, setTab] = useState<Tab>('check');
  const [text, setText] = useState('');
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [selectedTech, setSelectedTech] = useState<keyof typeof TECHNIQUES | null>(null);
  const [history, setHistory] = useState<MoodEntry[]>(loadMoodHistory);

  const T = {
    title: lang === 'en' ? 'Mind Companion' : '心理顾问',
    sub: lang === 'en' ? 'CBT · Mindfulness · Crisis support' : '认知行为 · 正念 · 危机干预',
    tabs: {
      check: lang === 'en' ? 'Check in' : '心情打卡',
      techniques: lang === 'en' ? 'Techniques' : '自助技巧',
      history: lang === 'en' ? 'History' : '历史记录',
      crisis: lang === 'en' ? 'Crisis' : '危机援助',
    },
  };

  const handleCheck = () => {
    if (!text.trim()) return;
    const result = analyzeText(text);
    setAnalysis(result);
  };

  const saveToday = (note: string) => {
    const today = new Date().toISOString().slice(0, 10);
    const newEntry: MoodEntry = {
      date: today,
      score: { ...INITIAL_SCORE, ...analysisScoreFromText(text) },
      note,
    };
    const next = [...history.filter((h) => h.date !== today), newEntry];
    setHistory(next);
    saveMoodHistory(next);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Tabs */}
      <div className="px-6 pt-4 shrink-0" style={{ borderBottom: '1px solid var(--color-border)' }}>
        <div className="flex items-center gap-1">
          {(['check', 'techniques', 'history', 'crisis'] as Tab[]).map((tk) => (
            <button
              key={tk}
              onClick={() => setTab(tk)}
              className="h-9 px-4 text-[13px] font-medium relative transition-colors"
              style={{ color: tab === tk ? 'var(--color-text-primary)' : 'var(--color-text-muted)' }}
            >
              {T.tabs[tk]}
              {tk === 'crisis' && (
                <AlertTriangle size={10} className="inline ml-1" style={{ color: 'var(--color-warning)' }} />
              )}
              {tab === tk && (
                <span
                  className="absolute left-2 right-2 bottom-0 h-0.5 rounded-full"
                  style={{ background: tk === 'crisis' ? 'var(--color-warning)' : 'var(--color-accent)' }}
                />
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {tab === 'check' && (
          <CheckInTab
            text={text}
            setText={setText}
            analysis={analysis}
            onCheck={handleCheck}
            onSave={saveToday}
            lang={lang}
          />
        )}
        {tab === 'techniques' && (
          <TechniquesTab selected={selectedTech} setSelected={setSelectedTech} lang={lang} />
        )}
        {tab === 'history' && <HistoryTab history={history} lang={lang} />}
        {tab === 'crisis' && <CrisisTab lang={lang} />}
      </div>
    </div>
  );
}

function analysisScoreFromText(text: string): Partial<MoodScore> {
  const a = analyzeText(text);
  const out: any = {};
  a.detected.forEach((d) => { out[d.mood] = Math.round(d.intensity); });
  return out;
}

/* ─────────── CheckIn Tab ─────────── */

function CheckInTab({ text, setText, analysis, onCheck, onSave, lang }: { text: string; setText: (v: string) => void; analysis: Analysis | null; onCheck: () => void; onSave: (n: string) => void; lang: 'zh' | 'en' }) {
  const placeholder = lang === 'en'
    ? 'Try: "I\'ve been feeling anxious about work all week, can\'t sleep, keep thinking I\'ll fail the project"'
    : '试试:这周工作一直很焦虑,睡不着,脑子里一直觉得自己会搞砸项目...';

  return (
    <div className="p-6 space-y-4">
      {/* Crisis banner */}
      {analysis?.isCrisis && <CrisisBanner lang={lang} />}

      <div className="grid grid-cols-[1fr_360px] gap-4">
        <div className="rounded-xl p-5" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
          <p className="text-[13px] font-medium mb-2" style={{ color: 'var(--color-text-primary)' }}>
            {lang === 'en' ? 'What\'s on your mind?' : '想说什么,尽管写下来'}
          </p>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={placeholder}
            rows={6}
            className="w-full bg-transparent outline-none text-[13px] resize-none leading-relaxed"
            style={{ color: 'var(--color-text-primary)' }}
          />
          <div className="mt-3 flex gap-2">
            <ConfirmButton onClick={onCheck} icon={Brain}>{lang === 'en' ? 'Analyze' : '分析'}</ConfirmButton>
            {analysis && <Button variant="secondary" icon={Save} onClick={() => onSave(text)}>{lang === 'en' ? 'Save today' : '保存今日'}</Button>}
          </div>
          <div className="mt-2">
            <CounselingAI lang={lang} text={text} setText={setText} />
          </div>
        </div>

        {analysis ? <AnalysisResult analysis={analysis} lang={lang} /> : (
          <div className="rounded-xl p-5 flex flex-col items-center justify-center text-center"
            style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
            <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-3" style={{ background: 'var(--color-accent-glow)' }}>
              <Heart size={20} style={{ color: 'var(--color-accent)' }} />
            </div>
            <p className="text-[12px]" style={{ color: 'var(--color-text-muted)' }}>
              {lang === 'en' ? 'Type freely, then click Analyze' : '自由写下感受,点击"分析"'}
            </p>
          </div>
        )}
      </div>

      {analysis && analysis.detected.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-[14px] font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            {lang === 'en' ? 'Recommended techniques for you' : '推荐你尝试这些方法'}
          </h3>
          <div className="grid grid-cols-3 gap-3">
            {pickTechniquesForMood(analysis.primary, analysis.distortion).map((tech) => (
              <button
                key={tech}
                onClick={() => {
                  const el = document.getElementById('tech-' + tech);
                  el?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="rounded-xl p-4 text-left transition-all"
                style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-accent)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-border)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; }}
              >
                <h4 className="text-[13px] font-semibold mb-1" style={{ color: 'var(--color-text-primary)' }}>{TECHNIQUES[tech as keyof typeof TECHNIQUES].title[lang]}</h4>
                <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>{TECHNIQUES[tech as keyof typeof TECHNIQUES].duration}</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function pickTechniquesForMood(mood: keyof MoodScore, distortion: any): (keyof typeof TECHNIQUES)[] {
  if (mood === 'anxiety' || mood === 'crisis') return ['grounding_54321', 'box_breathing', 'thought_record'];
  if (mood === 'depression' || mood === 'selfWorth') return ['behavioral_activation', 'self_compassion', 'values_sort'];
  if (mood === 'anger') return ['box_breathing', 'thought_record', 'values_sort'];
  if (mood === 'sadness' || mood === 'loneliness') return ['self_compassion', 'behavioral_activation', 'values_sort'];
  if (mood === 'sleep') return ['sleep_hygiene', 'grounding_54321', 'box_breathing'];
  if (distortion) return ['thought_record', 'self_compassion', 'box_breathing'];
  return ['grounding_54321', 'self_compassion', 'behavioral_activation'];
}

function AnalysisResult({ analysis, lang }: { analysis: Analysis; lang: 'zh' | 'en' }) {
  return (
    <div className="rounded-xl p-5" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
      <div className="flex items-center gap-2 mb-3">
        <Sparkles size={14} style={{ color: 'var(--color-accent)' }} />
        <h3 className="text-[13px] font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          {lang === 'en' ? 'Analysis result' : '分析结果'}
        </h3>
        <SeverityBadge severity={analysis.severity} lang={lang} />
      </div>

      {analysis.detected.length === 0 ? (
        <p className="text-[12px]" style={{ color: 'var(--color-text-muted)' }}>
          {lang === 'en' ? 'No obvious emotional pattern detected. Try writing more.' : '未检测到明显情绪模式,可以再多写一些。'}
        </p>
      ) : (
        <div className="space-y-2.5">
          {analysis.detected.sort((a, b) => b.intensity - a.intensity).map((d) => {
            const label = MOOD_LABELS[d.mood];
            return (
              <div key={d.mood}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[12px] font-medium" style={{ color: 'var(--color-text-primary)' }}>
                    {lang === 'en' ? label.en : label.zh}
                  </span>
                  <span className="text-[11px] font-semibold" style={{ color: label.color }}>
                    {d.intensity.toFixed(1)}/10
                  </span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--color-border)' }}>
                  <div className="h-full transition-all" style={{ width: `${d.intensity * 10}%`, background: label.color }} />
                </div>
                <p className="text-[10px] mt-1" style={{ color: 'var(--color-text-muted)' }}>
                  {lang === 'en' ? 'Matched: ' : '触发词: '}{d.matched.slice(0, 4).join('、')}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {analysis.distortion && (
        <div className="mt-4 p-3 rounded-lg" style={{ background: 'var(--color-accent-glow)', border: '1px solid var(--color-accent)' }}>
          <p className="text-[11px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--color-accent)' }}>
            {lang === 'en' ? 'Cognitive distortion detected' : '检测到认知扭曲'}
          </p>
          <p className="text-[13px] font-medium mb-0.5" style={{ color: 'var(--color-text-primary)' }}>
            {analysis.distortion[lang]}
          </p>
          <p className="text-[11px] italic" style={{ color: 'var(--color-text-muted)' }}>{analysis.distortion.example}</p>
        </div>
      )}
    </div>
  );
}

function SeverityBadge({ severity, lang }: { severity: 'low' | 'medium' | 'high' | 'crisis'; lang: 'zh' | 'en' }) {
  const map: Record<string, { zh: string; en: string; bg: string; fg: string }> = {
    low: { zh: '轻度', en: 'Mild', bg: 'rgba(52, 211, 153, 0.15)', fg: 'var(--color-success)' },
    medium: { zh: '中度', en: 'Moderate', bg: 'rgba(245, 158, 11, 0.15)', fg: 'var(--color-warning)' },
    high: { zh: '较重', en: 'Significant', bg: 'rgba(239, 68, 68, 0.15)', fg: '#fca5a5' },
    crisis: { zh: '危机', en: 'Crisis', bg: 'rgba(220, 38, 38, 0.2)', fg: '#fca5a5' },
  };
  const m = map[severity];
  return (
    <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ background: m.bg, color: m.fg }}>
      {lang === 'en' ? m.en : m.zh}
    </span>
  );
}

function CrisisBanner({ lang }: { lang: 'zh' | 'en' }) {
  return (
    <div className="rounded-xl p-4 flex items-start gap-3" style={{ background: 'rgba(220, 38, 38, 0.12)', border: '1.5px solid var(--color-warning)' }}>
      <AlertTriangle size={20} style={{ color: 'var(--color-warning)' }} className="shrink-0 mt-0.5" />
      <div className="flex-1">
        <h3 className="text-[14px] font-semibold mb-1" style={{ color: '#fca5a5' }}>
          {lang === 'en' ? 'We noticed you may be in crisis' : '我注意到你可能正在经历困难'}
        </h3>
        <p className="text-[12px] mb-2" style={{ color: 'var(--color-text-secondary)' }}>
          {lang === 'en'
            ? 'What you\'re feeling is real, and you don\'t have to face it alone. Please reach out to a professional or trusted person right now.'
            : '你的感受是真实的,你不必独自面对。请立即联系专业人员或你信任的人。'}
        </p>
        <Button variant="danger" icon={Phone} size="sm">
          {lang === 'en' ? 'View crisis hotlines' : '查看危机热线'}
        </Button>
      </div>
    </div>
  );
}

/* ─────────── Techniques Tab ─────────── */

function TechniquesTab({ selected, setSelected, lang }: { selected: string | null; setSelected: (v: string | null) => void; lang: 'zh' | 'en' }) {
  return (
    <div className="p-6 space-y-3">
      <p className="text-[12px]" style={{ color: 'var(--color-text-muted)' }}>
        {lang === 'en' ? 'Tap a card to expand the full step-by-step guide' : '点击卡片展开完整步骤'}
      </p>
      {Object.entries(TECHNIQUES).map(([key, tech]) => {
        const isOpen = selected === key;
        return (
          <div key={key} id={'tech-' + key} className="rounded-xl overflow-hidden" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
            <button
              onClick={() => setSelected(isOpen ? null : key)}
              className="w-full px-5 py-4 flex items-center gap-3 text-left transition-colors"
              style={{ background: isOpen ? 'var(--color-bg-card-hover)' : 'transparent' }}
            >
              <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'var(--color-accent-glow)' }}>
                <BookOpen size={18} style={{ color: 'var(--color-accent)' }} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-[14px] font-semibold" style={{ color: 'var(--color-text-primary)' }}>{tech.title[lang]}</h3>
                <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{tech.duration}</p>
              </div>
              <ChevronRight size={16} className={`transition-transform ${isOpen ? 'rotate-90' : ''}`} style={{ color: 'var(--color-text-muted)' }} />
            </button>
            {isOpen && (
              <div className="px-5 pb-5">
                <ol className="space-y-2">
                  {tech.steps[lang].map((step: string, i: number) => (
                    <li key={i} className="flex items-start gap-3 text-[13px]">
                      <span
                        className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-semibold shrink-0 mt-0.5"
                        style={{ background: 'var(--color-accent-glow)', color: 'var(--color-accent)' }}
                      >
                        {i + 1}
                      </span>
                      <span style={{ color: 'var(--color-text-secondary)', lineHeight: '1.5' }}>{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ─────────── History Tab ─────────── */

function HistoryTab({ history, lang }: { history: MoodEntry[]; lang: 'zh' | 'en' }) {
  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-12">
        <History size={32} style={{ color: 'var(--color-text-muted)' }} />
        <p className="text-[13px] mt-3" style={{ color: 'var(--color-text-muted)' }}>
          {lang === 'en' ? 'No history yet. Save your first check-in.' : '还没有记录,先去打卡吧。'}
        </p>
      </div>
    );
  }
  // Simple 7-day chart
  const recent = history.slice(-7);
  return (
    <div className="p-6 space-y-4">
      <h3 className="text-[14px] font-semibold" style={{ color: 'var(--color-text-primary)' }}>
        {lang === 'en' ? 'Last 7 days' : '最近 7 天'}
      </h3>
      <div className="grid grid-cols-7 gap-2">
        {recent.map((entry, i) => {
          const avg = (entry.score.anxiety + entry.score.depression + entry.score.sadness + entry.score.loneliness) / 4;
          const color = avg < 3 ? 'var(--color-success)' : avg < 6 ? 'var(--color-warning)' : '#fca5a5';
          return (
            <div key={i} className="rounded-lg p-3 text-center" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
              <div className="text-[10px] mb-1" style={{ color: 'var(--color-text-muted)' }}>{entry.date.slice(5)}</div>
              <div className="text-[18px] font-semibold" style={{ color }}>{avg.toFixed(1)}</div>
              <div className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>{lang === 'en' ? 'load' : '压力'}</div>
            </div>
          );
        })}
      </div>

      <div className="space-y-2">
        <h3 className="text-[14px] font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          {lang === 'en' ? 'All entries' : '全部记录'}
        </h3>
        {[...history].reverse().map((entry, i) => (
          <div key={i} className="rounded-lg p-3" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[12px] font-semibold" style={{ color: 'var(--color-text-primary)' }}>{entry.date}</span>
            </div>
            <p className="text-[12px] leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>{entry.note}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─────────── Crisis Tab ─────────── */

function CrisisTab({ lang }: { lang: 'zh' | 'en' }) {
  return (
    <div className="p-6 space-y-4">
      <div className="rounded-xl p-5" style={{ background: 'rgba(220, 38, 38, 0.08)', border: '1.5px solid var(--color-warning)' }}>
        <div className="flex items-start gap-3">
          <Phone size={20} style={{ color: 'var(--color-warning)' }} className="shrink-0 mt-0.5" />
          <div>
            <h3 className="text-[15px] font-semibold mb-2" style={{ color: '#fca5a5' }}>
              {lang === 'en' ? 'If you\'re in immediate danger' : '如果你正在经历紧急危险'}
            </h3>
            <p className="text-[12px] mb-2" style={{ color: 'var(--color-text-secondary)' }}>
              {lang === 'en'
                ? 'Call your local emergency number (120 in China / 911 in US) or go to the nearest hospital emergency room.'
                : '请立即拨打当地急救电话(中国大陆 120 / 美国 911)或前往最近的医院急诊。'}
            </p>
          </div>
        </div>
      </div>

      <h3 className="text-[14px] font-semibold" style={{ color: 'var(--color-text-primary)' }}>
        {lang === 'en' ? '24/7 Hotlines' : '24 小时心理援助热线'}
      </h3>

      <div className="space-y-2">
        {HOTLINES.map((h, i) => (
          <div key={i} className="rounded-lg p-3" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[13px] font-medium" style={{ color: 'var(--color-text-primary)' }}>{h.name}</span>
              <span className="text-[13px] font-mono font-semibold" style={{ color: 'var(--color-accent)' }}>{h.phone}</span>
            </div>
            <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>{h.desc}</p>
          </div>
        ))}
      </div>

      <div className="rounded-lg p-4" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
        <p className="text-[12px] leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
          {lang === 'en'
            ? '⚠️ I am an AI tool, not a substitute for professional help. If you\'re experiencing persistent distress, please contact a licensed mental health professional.'
            : '⚠️ 我是 AI 工具,不能替代专业帮助。如果你持续感到困扰,请联系有执照的心理健康专业人员。'}
        </p>
      </div>
    </div>
  );
}

function CounselingAI({ lang, text, setText }: { lang: 'zh' | 'en'; text: string; setText: (s: string) => void }) {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState('');
  return (
    <>
      <button
        onClick={() => {
          if (!text.trim()) return;
          setPrompt(`你是一位温暖、专业的心理咨询师,基于认知行为疗法(CBT)和正念原则。请用中文回复用户的倾诉,200-300 字:先共情、再识别可能存在的认知扭曲、最后给出 2-3 条具体可执行的微行动建议。\n\n用户倾诉:\n${text}`);
          setOpen(true);
        }}
        className="w-full h-8 px-3 rounded-lg text-[12px] font-medium flex items-center justify-center gap-1.5"
        style={{ background: 'var(--color-accent-glow)', color: 'var(--color-accent)', border: '1px solid var(--color-accent)' }}
      >
        <Sparkles size={12} />{lang === 'en' ? 'AI deep listen' : 'AI 深度倾听'}
      </button>
      <AIOutputModal
        open={open}
        onClose={() => setOpen(false)}
        title={lang === 'en' ? 'AI Deep Listen' : 'AI 深度倾听'}
        prompt={prompt}
        temperature={0.8}
        onDone={() => {
          // Close modal; user can read in modal
          setOpen(false);
          setText('');
        }}
      />
    </>
  );
}
