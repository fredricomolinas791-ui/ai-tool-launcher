import { useState, useEffect, useMemo } from 'react';
import {
  Heart, Sparkles, Check, History, X, Square as StopIcon, Brain, Phone,
  Cat, Dog, Calendar, Share2, Star, RefreshCw, Bookmark, Drama,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useI18n } from '../../hooks/useI18n';
import { Button, ConfirmButton } from '../ui/Button';
import { AIToolPanel } from '../ui/AIToolPanel';
import { useAIStream } from '../../hooks/useAIStream';
import { useFavorites } from '../../hooks/useFavorites';
import { WerewolfGame } from './werewolf/Game';
import { GomokuTool } from './GomokuTool';

/* ═════════════════════════════════════════════════════════════════════
   趣味铺子 —— 重做后定位:「趣味性 + AI 调味」,不跟通用 AI 平台抢饭碗。
   原先的「健康饮食 / 运动计划 / 用药提醒」都已封存(同质化严重、专业 app
   做得更好),让位给纯趣味卡片:猫狗翻译机 / 今日宜忌 / 塔罗一日牌。
   心理 / 起名 / 解梦 暂留旧实现,下一轮重做为「心情树洞 / 取名玄学馆
   / 玄学占卜室」。
   ═════════════════════════════════════════════════════════════════════ */

/* ═════════════════════════════════════════════════════════════════════
   61. 心理顾问 (4 标签: 打卡 / 技巧 / 历史 / 危机)
   ═════════════════════════════════════════════════════════════════════ */

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
      zh: ['记录让你不舒服的情境(在哪里、发生了什么)', '写下当时脑子里闪过的第一句话 — 这是"自动思维"', '问自己:这句话属于哪种认知扭曲?(看上方 6 种)', '列出支持和反对这个想法的证据', '写一个更平衡、更温和的替代想法'],
      en: ['Write down the situation (where, what happened)', 'Note the first thought that flashed through your mind — this is the "automatic thought"', 'Ask: which cognitive distortion is this? (see 6 above)', 'List evidence for and against this thought', 'Write a more balanced, kinder alternative'],
    },
    duration: '10-15 分钟',
  },
  behavioral_activation: {
    title: { zh: '行为激活 — 微行动清单', en: 'Behavioral activation' },
    steps: {
      zh: ['选 1 件你最近一直拖着没做的小事', '把它缩小到 2 分钟内能完成(比如"打开文件"而不是"写完报告")', '做完之后,做一个小小的奖励(喝杯水、听首歌)', '每天增加一点点,让"动起来"成为新的惯性', '用清单打勾的快感,激活大脑的奖赏回路'],
      en: ['Pick 1 small thing you\'ve been avoiding', 'Shrink it to 2 minutes (e.g. "open the file", not "write the report")', 'After finishing, give yourself a tiny reward (water, a song)', 'Add a little each day — make motion the new default', 'Checkboxes activate your brain\'s reward system'],
    },
    duration: '5 分钟 / 次',
  },
  self_compassion: {
    title: { zh: '自我慈悲 — 写给朋友的信', en: 'Self-compassion letter' },
    steps: {
      zh: ['想象你最爱的朋友正经历你现在的事', '你会对他/她说什么?(温柔、不评判、有同理心)', '现在把这段话写给自己 — 把"我"换成"你"', '读出来,允许自己被这段话温暖', '每天写 1 段,坚持 7 天'],
      en: ['Imagine your dearest friend going through exactly what you\'re going through', 'What would you say to them? (kind, non-judgmental, empathetic)', 'Now write that to yourself — change "I" to "you"', 'Read it out loud, let it warm you', 'Write 1 paragraph daily for 7 days'],
    },
    duration: '10 分钟 / 天',
  },
  sleep_hygiene: {
    title: { zh: '睡眠卫生 7 步法', en: 'Sleep hygiene 7-step' },
    steps: {
      zh: ['固定起床时间(周末也别差超过 1 小时)', '睡前 1 小时关掉所有屏幕(蓝光抑制褪黑素)', '卧室只用来睡觉 — 别在床上工作 / 刷手机', '下午 3 点后不喝咖啡(半衰期 5-6 小时)', '睡前做 10 分钟身体扫描冥想', '如果 20 分钟还睡不着,起床去另一个房间做无聊的事', '卧室保持 18-20°C,使用遮光窗帘'],
      en: ['Fixed wake time (even weekends, ±1 hour max)', 'No screens 1 hour before bed (blue light suppresses melatonin)', 'Bed is for sleep only — no work / scrolling', 'No caffeine after 3 PM (half-life 5-6 hours)', '10-minute body scan meditation before bed', 'If awake 20+ min, get up, go to another room, do something boring', 'Bedroom at 18-20°C, blackout curtains'],
    },
    duration: '每晚执行',
  },
  values_sort: {
    title: { zh: '价值观排序练习', en: 'Values clarification' },
    steps: {
      zh: ['从 8 个词中圈出对你最重要的 3 个:家庭/事业/健康/自由/友谊/创造/安全/成长', '问自己:最近一周,我的时间花在了这些价值上吗?', '如果有 1 个不匹配,本周能不能做 1 件小事让它回到正轨?', '写下具体的小行动,设到明天或后天的日历'],
      en: ['Circle your top 3: Family / Career / Health / Freedom / Friendship / Creativity / Safety / Growth', 'Ask: this past week, did my time go to these?', 'If one is mismatched, can you do 1 small thing this week to realign?', 'Write the small action, schedule it tomorrow or the day after'],
    },
    duration: '15 分钟',
  },
};

export function CounselingTool() {
  const { lang } = useI18n();
  const [tab, setTab] = useState<'check' | 'techniques' | 'history' | 'crisis'>('check');
  const [text, setText] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [partialAi, setPartialAi] = useState('');
  const [lastReply, setLastReply] = useState('');
  const [lastPrompt, setLastPrompt] = useState('');
  const [history, setHistory] = useState<{ text: string; mood: 'good' | 'ok' | 'bad'; date: string }[]>(() => {
    try {
      const r = localStorage.getItem('ai-tools-launcher.mood-history.v1');
      if (r) return JSON.parse(r);
    } catch {}
    return [];
  });
  const aiStream = useAIStream();
  const favorites = useFavorites();

  useEffect(() => {
    try { localStorage.setItem('ai-tools-launcher.mood-history.v1', JSON.stringify(history)); } catch {}
  }, [history]);

  useEffect(() => {
    if (streaming) setPartialAi(aiStream.output);
  }, [aiStream.output, streaming]);

  const handleCheck = () => {
    if (!text.trim()) return;
    setStreaming(true);
    setPartialAi('');
    setLastReply('');
    const userText = text;
    setLastPrompt(userText);
    const sys = `你是温暖、专业的心理咨询师,基于认知行为疗法(CBT)和正念原则。\n请用中文回复用户的倾诉:\n- 200-300 字\n- 先共情 → 再识别可能存在的认知扭曲 → 最后给 2-3 条具体可执行的微行动建议\n- 用 markdown 格式(## 共情 / ## 认知分析 / ## 微行动)\n- 不需要问我更多,直接给出回应`;
    aiStream.run({
      systemPrompt: sys,
      userPrompt: userText,
      temperature: 0.8,
      onDone: (result) => {
        setStreaming(false);
        setText('');
        setLastReply(result);
        // 全局收藏:让这次 AI 回信直接进收藏夹(用户也可以手动在面板再点取消)
        favorites.add({
          toolId: 61, toolName: '心情树洞',
          kind: 'deep-listen',
          title: userText.length > 30 ? userText.slice(0, 30) + '…' : userText,
          preview: result.length > 100 ? result.slice(0, 100) + '…' : result,
          content: `【倾诉】\n${userText}\n\n【AI 回信】\n${result}`,
          dedupeKey: userText, // 同一段倾诉不重复收藏
        });
      },
    });
  };

  const saveMood = (mood: 'good' | 'ok' | 'bad') => {
    const entryText = lastReply || partialAi;
    setHistory((h) => [{ text: text || entryText, mood, date: new Date().toISOString().slice(0, 10) }, ...h].slice(0, 30));
  };

  // 收藏当前 AI 回信 —— 同倾诉内容会去重(再次点击等于取消)
  const isReplyFav = lastPrompt ? favorites.isFav(61, lastPrompt) : false;
  const toggleReplyFav = () => {
    if (!lastReply) return;
    favorites.toggle({
      toolId: 61, toolName: '心情树洞', kind: 'deep-listen',
      title: lastPrompt.length > 30 ? lastPrompt.slice(0, 30) + '…' : lastPrompt,
      preview: lastReply.length > 100 ? lastReply.slice(0, 100) + '…' : lastReply,
      content: `【倾诉】\n${lastPrompt}\n\n【AI 回信】\n${lastReply}`,
      dedupeKey: lastPrompt,
    });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 pt-4 shrink-0" style={{ borderBottom: '1px solid var(--color-border)' }}>
        <div className="flex items-center gap-1">
          {([
            { k: 'check' as const, l: lang === 'en' ? 'Check in' : '打卡' },
            { k: 'techniques' as const, l: lang === 'en' ? 'Techniques' : '技巧' },
            { k: 'history' as const, l: lang === 'en' ? 'History' : '历史' },
            { k: 'crisis' as const, l: lang === 'en' ? 'Crisis' : '危机援助' },
          ]).map((t) => (
            <button key={t.k} onClick={() => setTab(t.k)} className="h-9 px-4 text-[13px] font-medium relative" style={{ color: tab === t.k ? 'var(--color-text-primary)' : 'var(--color-text-muted)' }}>
              {t.l}
              {tab === t.k && <span className="absolute left-2 right-2 bottom-0 h-0.5 rounded-full" style={{ background: 'var(--color-accent)' }} />}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {tab === 'check' && (
          <div className="max-w-3xl mx-auto">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={lang === 'en' ? 'Try: "I\'ve been feeling anxious about work all week, can\'t sleep..."' : '试试:这周工作一直很焦虑,睡不着,脑子里一直觉得自己会搞砸项目...'}
              rows={6}
              className="w-full p-3 rounded-lg text-[13px] outline-none resize-none leading-relaxed mb-3"
              style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
            />
            <div className="flex gap-2 mb-4">
              <ConfirmButton onClick={streaming ? aiStream.stop : handleCheck} icon={streaming ? StopIcon : Heart}>
                {streaming ? T_STOP(lang) : (lang === 'en' ? 'AI deep listen' : 'AI 深度倾听')}
              </ConfirmButton>
            </div>
            {(partialAi || aiStream.output) && (
              <div className="rounded-xl p-4 mb-3 relative" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
                <pre className="text-[13px] leading-relaxed whitespace-pre-wrap font-sans pr-7" style={{ color: 'var(--color-text-primary)' }}>{partialAi || aiStream.output}{streaming && <span className="inline-block w-1.5 h-3 align-middle ml-0.5 animate-pulse" style={{ background: 'var(--color-accent)' }} />}</pre>
                {/* 收藏按钮 —— 仅在流结束后显示 */}
                {!streaming && lastReply && (
                  <button
                    onClick={toggleReplyFav}
                    title={isReplyFav ? (lang === 'en' ? 'Remove from favorites' : '从收藏中移除') : (lang === 'en' ? 'Save to favorites' : '收藏这封回信')}
                    className="absolute top-2.5 right-2.5 w-7 h-7 rounded-md flex items-center justify-center transition-all"
                    style={{ color: isReplyFav ? 'var(--color-accent)' : 'var(--color-text-muted)', background: isReplyFav ? 'var(--color-accent-glow)' : 'transparent' }}
                  >
                    <Bookmark size={13} fill={isReplyFav ? 'currentColor' : 'none'} />
                  </button>
                )}
                {aiStream.error && <p className="text-[11px] mt-2" style={{ color: '#fca5a5' }}>{aiStream.error}</p>}
              </div>
            )}
            {partialAi && !streaming && (
              <div className="flex gap-2 mb-3">
                <Button variant="secondary" size="sm" onClick={() => saveMood('good')}>今天感觉不错</Button>
                <Button variant="secondary" size="sm" onClick={() => saveMood('ok')}>一般</Button>
                <Button variant="secondary" size="sm" onClick={() => saveMood('bad')}>不好</Button>
              </div>
            )}
            {history.length > 0 && (
              <div className="mt-4">
                <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--color-text-muted)' }}>{lang === 'en' ? 'Recent entries' : '最近打卡'}</p>
                {history.slice(0, 5).map((h, i) => (
                  <div key={i} className="rounded-lg p-2 mb-1.5" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: h.mood === 'good' ? 'rgba(52,211,153,0.15)' : h.mood === 'ok' ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)', color: h.mood === 'good' ? 'var(--color-success)' : h.mood === 'ok' ? 'var(--color-warning)' : '#fca5a5' }}>
                        {h.mood === 'good' ? '好' : h.mood === 'ok' ? '一般' : '不好'}
                      </span>
                      <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>{h.date}</span>
                    </div>
                    <p className="text-[11px] truncate" style={{ color: 'var(--color-text-secondary)' }}>{h.text}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'techniques' && (
          <div className="max-w-3xl mx-auto space-y-3">
            {Object.entries(TECHNIQUES).map(([key, tech]) => {
              const t = lang === 'en' ? tech.steps.en : tech.steps.zh;
              return (
                <div key={key} className="rounded-xl p-4" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
                  <div className="flex items-center gap-2 mb-2">
                    <Brain size={14} style={{ color: 'var(--color-accent)' }} />
                    <h3 className="text-[14px] font-semibold" style={{ color: 'var(--color-text-primary)' }}>{lang === 'en' ? tech.title.en : tech.title.zh}</h3>
                    <span className="text-[10px] ml-auto px-1.5 py-0.5 rounded" style={{ background: 'var(--color-bg-main)', color: 'var(--color-text-muted)' }}>{tech.duration}</span>
                  </div>
                  <ol className="space-y-1.5">
                    {t.map((s, i) => (
                      <li key={i} className="text-[12px] flex gap-2" style={{ color: 'var(--color-text-secondary)' }}>
                        <span className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-semibold shrink-0" style={{ background: 'var(--color-accent-glow)', color: 'var(--color-accent)' }}>{i + 1}</span>
                        {s}
                      </li>
                    ))}
                  </ol>
                </div>
              );
            })}
          </div>
        )}

        {tab === 'history' && (
          <div className="max-w-3xl mx-auto space-y-2">
            {history.length === 0 ? (
              <EmptyState icon={History} text={lang === 'en' ? 'No check-ins yet' : '还没有打卡记录'} />
            ) : (
              <>
                <div className="rounded-xl p-4 mb-3" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
                  <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--color-text-muted)' }}>{lang === 'en' ? 'Last 7 days' : '最近 7 天'}</p>
                  <div className="flex items-end gap-1 h-12">
                    {Array.from({ length: 7 }).map((_, i) => {
                      const d = new Date(); d.setDate(d.getDate() - (6 - i));
                      const ds = d.toISOString().slice(0, 10);
                      const count = history.filter((h) => h.date === ds).length;
                      return (
                        <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                          <div className="w-full rounded-t transition-all" style={{ height: `${Math.min(100, count * 30 + 4)}%`, minHeight: 4, background: count > 0 ? 'var(--color-accent)' : 'var(--color-border)' }} />
                          <span className="text-[9px]" style={{ color: 'var(--color-text-muted)' }}>{['日','一','二','三','四','五','六'][d.getDay()]}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                {history.map((h, i) => (
                  <div key={i} className="rounded-lg p-3" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: h.mood === 'good' ? 'rgba(52,211,153,0.15)' : h.mood === 'ok' ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)', color: h.mood === 'good' ? 'var(--color-success)' : h.mood === 'ok' ? 'var(--color-warning)' : '#fca5a5' }}>
                        {h.mood === 'good' ? '好' : h.mood === 'ok' ? '一般' : '不好'}
                      </span>
                      <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>{h.date}</span>
                    </div>
                    <p className="text-[12px] leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>{h.text}</p>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {tab === 'crisis' && (
          <div className="max-w-3xl mx-auto space-y-3">
            <div className="rounded-xl p-5 flex items-start gap-3" style={{ background: 'rgba(220, 38, 38, 0.12)', border: '1.5px solid var(--color-warning)' }}>
              <Phone size={20} style={{ color: 'var(--color-warning)' }} className="shrink-0 mt-0.5" />
              <div>
                <h3 className="text-[15px] font-semibold mb-2" style={{ color: '#fca5a5' }}>{lang === 'en' ? 'If you are in immediate danger' : '如果你正在经历紧急危险'}</h3>
                <p className="text-[12px]" style={{ color: 'var(--color-text-secondary)' }}>
                  {lang === 'en' ? 'Call your local emergency number (120 in China / 911 in US) or go to the nearest hospital emergency room.' : '请立即拨打当地急救电话(中国大陆 120 / 美国 911)或前往最近的医院急诊。'}
                </p>
              </div>
            </div>
            <h3 className="text-[14px] font-semibold" style={{ color: 'var(--color-text-primary)' }}>{lang === 'en' ? '24/7 Hotlines' : '24 小时心理援助热线'}</h3>
            {[
              { name: '北京心理危机研究与干预中心', phone: '010-82951332', desc: '24 小时,免费', lang: 'zh' },
              { name: '全国心理援助热线', phone: '400-161-9995', desc: '24 小时', lang: 'zh' },
              { name: '希望 24 热线', phone: '400-161-9995', desc: '24 小时,自杀干预', lang: 'zh' },
              { name: '中国心理援助热线', phone: '12320-5', desc: '公共卫生公益', lang: 'zh' },
              { name: 'Crisis Text Line (US)', phone: 'Text HOME to 741741', desc: '24/7 text-based', lang: 'en' },
              { name: '988 Suicide & Crisis Lifeline (US)', phone: '988', desc: '24/7, free', lang: 'en' },
            ].map((h, i) => (
              <div key={i} className="rounded-lg p-3 flex items-center justify-between" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
                <div>
                  <p className="text-[13px] font-medium" style={{ color: 'var(--color-text-primary)' }}>{h.name}</p>
                  <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>{h.desc}</p>
                </div>
                <span className="text-[13px] font-mono font-semibold" style={{ color: 'var(--color-accent)' }}>{h.phone}</span>
              </div>
            ))}
            <div className="rounded-lg p-4" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
              <p className="text-[12px] leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                ⚠️ {lang === 'en' ? 'I am an AI tool, not a substitute for professional help. If you\'re experiencing persistent distress, please contact a licensed mental health professional.' : '我是 AI 工具,不能替代专业帮助。如果你持续感到困扰,请联系有执照的心理健康专业人员。'}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function T_STOP(lang: 'zh' | 'en') { return lang === 'en' ? 'Stop' : '停止'; }

/* ═════════════════════════════════════════════════════════════════════
   63. 取名玄学馆 NamingTool
   ─────────────────────────────────────────────────────────────────────
   4 个标签页:
     ① 起名     输入姓 + 性别 + 期许关键词 → AI 出 6 个候选 + 五行/寓意/拆字
     ② 测名     输入完整姓名 → AI 给综合评分 + 音/形/义/数理 4 维 + 优缺点
     ③ 英文意境 输入英文词或意境 → AI 给 4 个对应的中文名 + 解读
     ④ 情侣合婚 输入两人姓名 → AI 给合婚指数 + 五行匹配 + 趣味分析
   共享:右上「我的收藏」按钮(localStorage)
   解决之前 NameTool 的两大问题:
   - 流式过程不再暴露原始 JSON(用「测算中…」骨架屏替代)
   - 渲染时严格走结构化数据,解析失败有 fallback
   ═════════════════════════════════════════════════════════════════════ */

const ELEMENT_META: Record<string, { color: string; icon: string }> = {
  金: { color: '#facc15', icon: '⛁' },
  木: { color: '#4ade80', icon: '⚘' },
  水: { color: '#60a5fa', icon: '☵' },
  火: { color: '#f87171', icon: '☲' },
  土: { color: '#d6a96b', icon: '◬' },
};
const NAMING_FAVS_KEY = 'ai-tools-launcher.naming-favs.v1';

type NameCard = { name: string; meaning: string; element: string; characters?: string; pinyin?: string };
type ScoreCard = { overall: number; tone: number; form: number; meaning: number; numerology: number; summary: string; pros: string[]; cons: string[]; characters: { ch: string; meaning: string }[] };
type EnNameCard = { name: string; pinyin: string; meaning: string; resonance: string };
type CoupleCard = {
  score: number;
  verdict: string;
  /** 名字 / 五行匹配(从姓名学角度) */
  nameHarmony: string;
  /** 西方星座匹配 */
  zodiacHarmony?: string;
  /** 十二生肖相合相冲 */
  chineseZodiacHarmony?: string;
  /** 八字 / 五行从生辰推 */
  baziHarmony?: string;
  strengths: string;
  cautions: string;
  suggestion: string;
};

/* 星座 / 生肖 数据(带 emoji,选择器更直观) */
const STAR_SIGNS = [
  { v: 'aries',       en: 'Aries',       zh: '白羊', emoji: '♈' },
  { v: 'taurus',      en: 'Taurus',      zh: '金牛', emoji: '♉' },
  { v: 'gemini',      en: 'Gemini',      zh: '双子', emoji: '♊' },
  { v: 'cancer',      en: 'Cancer',      zh: '巨蟹', emoji: '♋' },
  { v: 'leo',         en: 'Leo',         zh: '狮子', emoji: '♌' },
  { v: 'virgo',       en: 'Virgo',       zh: '处女', emoji: '♍' },
  { v: 'libra',       en: 'Libra',       zh: '天秤', emoji: '♎' },
  { v: 'scorpio',     en: 'Scorpio',     zh: '天蝎', emoji: '♏' },
  { v: 'sagittarius', en: 'Sagittarius', zh: '射手', emoji: '♐' },
  { v: 'capricorn',   en: 'Capricorn',   zh: '摩羯', emoji: '♑' },
  { v: 'aquarius',    en: 'Aquarius',    zh: '水瓶', emoji: '♒' },
  { v: 'pisces',      en: 'Pisces',      zh: '双鱼', emoji: '♓' },
] as const;
const CHINESE_ZODIAC = [
  { v: 'rat',     zh: '鼠', en: 'Rat',     emoji: '🐀' },
  { v: 'ox',      zh: '牛', en: 'Ox',      emoji: '🐂' },
  { v: 'tiger',   zh: '虎', en: 'Tiger',   emoji: '🐅' },
  { v: 'rabbit',  zh: '兔', en: 'Rabbit',  emoji: '🐇' },
  { v: 'dragon',  zh: '龙', en: 'Dragon',  emoji: '🐉' },
  { v: 'snake',   zh: '蛇', en: 'Snake',   emoji: '🐍' },
  { v: 'horse',   zh: '马', en: 'Horse',   emoji: '🐎' },
  { v: 'goat',    zh: '羊', en: 'Goat',    emoji: '🐐' },
  { v: 'monkey',  zh: '猴', en: 'Monkey',  emoji: '🐒' },
  { v: 'rooster', zh: '鸡', en: 'Rooster', emoji: '🐓' },
  { v: 'dog',     zh: '狗', en: 'Dog',     emoji: '🐕' },
  { v: 'pig',     zh: '猪', en: 'Pig',     emoji: '🐖' },
] as const;

export function NamingTool() {
  const { lang } = useI18n();
  const [tab, setTab] = useState<'gen' | 'score' | 'en' | 'couple'>('gen');
  const [favs, setFavs] = useState<NameCard[]>(() => loadLS(NAMING_FAVS_KEY, []));
  const [favsOpen, setFavsOpen] = useState(false);
  useEffect(() => { saveLS(NAMING_FAVS_KEY, favs); }, [favs]);
  const globalFavs = useFavorites();

  const toggleFav = (c: NameCard) => {
    setFavs((f) => f.some((x) => x.name === c.name) ? f.filter((x) => x.name !== c.name) : [c, ...f].slice(0, 50));
    // 双写:同步到全局收藏(去重基于 name + 五行)。本地和全局可以独立
    // 切换,但同一名字不会被全局重复加(因为 useFavorites.isFav 会去重)。
    globalFavs.toggle({
      toolId: 63, toolName: '取名玄学馆', kind: 'name',
      title: c.name + (c.pinyin ? ` (${c.pinyin})` : ''),
      preview: c.meaning,
      content: `【名字】\n${c.name}${c.pinyin ? ` (${c.pinyin})` : ''}\n【五行】\n${c.element}\n【寓意】\n${c.meaning}${c.characters ? `\n【拆字】\n${c.characters}` : ''}`,
      dedupeKey: c.name,
    });
  };

  const T = {
    title: lang === 'en' ? 'Name Master' : '取名玄学馆',
    tabs: {
      gen:    lang === 'en' ? 'Generate'  : '起名',
      score:  lang === 'en' ? 'Score'     : '测名',
      en:     lang === 'en' ? 'EN → CN'   : '英文意境',
      couple: lang === 'en' ? 'Couple'    : '情侣合婚',
    },
    favs: lang === 'en' ? `Favs (${favs.length})` : `收藏 (${favs.length})`,
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 pt-4 shrink-0 flex items-center justify-between" style={{ borderBottom: '1px solid var(--color-border)' }}>
        <div className="flex items-center gap-1">
          {(['gen','score','en','couple'] as const).map((k) => (
            <button key={k} onClick={() => setTab(k)} className="h-9 px-4 text-[13px] font-medium relative" style={{ color: tab === k ? 'var(--color-text-primary)' : 'var(--color-text-muted)' }}>
              {T.tabs[k]}
              {tab === k && <span className="absolute left-2 right-2 bottom-0 h-0.5 rounded-full" style={{ background: 'var(--color-accent)' }} />}
            </button>
          ))}
        </div>
        <button
          onClick={() => setFavsOpen(true)}
          className="h-7 px-2.5 rounded text-[11px] font-medium flex items-center gap-1.5"
          style={{ background: 'var(--color-bg-card)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)' }}
        >
          <Bookmark size={11} /> {T.favs}
        </button>
      </div>

      <div className="flex-1 overflow-hidden">
        {tab === 'gen'    && <NamingGenerate favs={favs} onToggleFav={toggleFav} />}
        {tab === 'score'  && <NamingScore />}
        {tab === 'en'     && <NamingEnglish />}
        {tab === 'couple' && <NamingCouple />}
      </div>

      {favsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }} onClick={() => setFavsOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} className="w-[520px] max-w-[92vw] max-h-[80vh] rounded-2xl overflow-hidden flex flex-col" style={{ background: 'var(--color-bg-main)', border: '1px solid var(--color-border)' }}>
            <div className="h-12 px-5 flex items-center justify-between shrink-0" style={{ borderBottom: '1px solid var(--color-border)' }}>
              <span className="text-[14px] font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                {lang === 'en' ? `My Favorite Names (${favs.length})` : `我收藏的名字 (${favs.length})`}
              </span>
              <button onClick={() => setFavsOpen(false)}><X size={16} style={{ color: 'var(--color-text-muted)' }} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {favs.length === 0 ? <EmptyState icon={Bookmark} text={lang === 'en' ? 'No favorites yet' : '还没收藏'} /> : (
                <div className="grid grid-cols-2 gap-2.5">
                  {favs.map((f, i) => <NameMiniCard key={i} card={f} onRemove={() => toggleFav(f)} />)}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── ① 起名 ──────────────────────────────────────────────────────── */
function NamingGenerate({ favs, onToggleFav }: { favs: NameCard[]; onToggleFav: (c: NameCard) => void }) {
  const { lang } = useI18n();
  const [surname, setSurname] = useState('李');
  const [gender, setGender] = useState<'male' | 'female' | 'any'>('any');
  const [vibe, setVibe] = useState('');
  const [chars, setChars] = useState<1 | 2>(2);
  const [results, setResults] = useState<NameCard[]>([]);
  const stream = useAIStream();

  const generate = () => {
    if (!surname.trim()) return;
    setResults([]);
    const genderText = gender === 'male' ? '男孩' : gender === 'female' ? '女孩' : '不限';
    const sys = `你是起名玄学专家,精通汉字五行、音韵学、传统文化典故。\n姓:"${surname.trim()}"  性别:${genderText}  名字字数:${chars} 字\n${vibe.trim() ? `期许关键词:${vibe.trim()}` : ''}\n请推荐 6 个候选名字。每个名字要求:\n- name: 仅名字,不含姓,${chars} 字\n- pinyin: 名字的拼音(带声调,如 zǐ xuān)\n- meaning: 一句寓意解读(20-35 字)\n- element: 主要五行属性(金/木/水/火/土)\n- characters: 每个字的解析(用「字:含义」格式,字之间用 / 分隔)\n**只输出 JSON 数组**(不要 markdown 围栏,不要解释):\n[{"name":"","pinyin":"","meaning":"","element":"","characters":""}]`;
    stream.run({
      systemPrompt: sys, userPrompt: '请起名', temperature: 0.95,
      onDone: (text) => {
        try {
          const j = JSON.parse(text.replace(/^```json\s*|\s*```$/g, '').trim());
          setResults((Array.isArray(j) ? j : []).map((r: any) => ({
            name: r.name ? `${surname.trim()}${r.name}` : '',
            pinyin: r.pinyin || '',
            meaning: r.meaning || '',
            element: r.element || '—',
            characters: r.characters || '',
          })).filter((x) => x.name));
        } catch {}
      },
    });
  };

  return (
    <div className="grid grid-cols-[340px_1fr] h-full">
      <div className="p-6 space-y-4 overflow-y-auto" style={{ borderRight: '1px solid var(--color-border)' }}>
        <Field label={lang === 'en' ? 'Surname' : '姓氏'}><TextInput value={surname} onChange={setSurname} placeholder="李 / 欧阳 / Wang" /></Field>
        <Field label={lang === 'en' ? 'Gender' : '性别'}>
          <Select value={gender} onChange={(v) => setGender(v as any)} options={[
            { value: 'any', label: lang === 'en' ? 'Any' : '不限' },
            { value: 'male', label: lang === 'en' ? 'Boy' : '男孩' },
            { value: 'female', label: lang === 'en' ? 'Girl' : '女孩' },
          ]} />
        </Field>
        <Field label={lang === 'en' ? 'Length' : '名字字数'}>
          <div className="flex gap-1.5">
            {([1, 2] as const).map((n) => (
              <button key={n} onClick={() => setChars(n)} className="flex-1 h-9 rounded-lg text-[12px] font-medium" style={{ background: chars === n ? 'var(--color-accent-glow)' : 'var(--color-bg-card)', color: chars === n ? 'var(--color-accent)' : 'var(--color-text-secondary)', border: `1px solid ${chars === n ? 'var(--color-accent)' : 'var(--color-border)'}` }}>
                {n} {lang === 'en' ? 'char' : '字'}
              </button>
            ))}
          </div>
        </Field>
        <Field label={lang === 'en' ? 'Vibe / hopes (optional)' : '期许 / 意象(可选)'} hint={lang === 'en' ? 'e.g. literary, strong, ocean' : '如:文气、英气、山海、典故出处'}>
          <TextInput value={vibe} onChange={setVibe} placeholder={lang === 'en' ? 'literary · ocean · poem' : '文气、山海、诗词'} />
        </Field>
        <ConfirmButton onClick={stream.streaming ? stream.stop : generate} icon={stream.streaming ? StopIcon : Sparkles} fullWidth>
          {stream.streaming ? (lang === 'en' ? 'Stop' : '停止') : (lang === 'en' ? 'Generate names' : '起名')}
        </ConfirmButton>
        {stream.error && <p className="text-[11px]" style={{ color: '#fca5a5' }}>{stream.error}</p>}
      </div>
      <div className="p-6 overflow-y-auto">
        {results.length === 0 ? (
          stream.streaming ? <NamingSkeleton count={6} cols={2} />
          : <EmptyState icon={Sparkles} text={lang === 'en' ? 'Surname + gender, then go' : '填好姓氏、点击起名,AI 为你献上 6 个候选'} />
        ) : (
          <div className="grid grid-cols-2 gap-3 max-w-3xl mx-auto">
            {results.map((r, i) => (
              <NameCardView key={i} card={r} isFav={favs.some((f) => f.name === r.name)} onToggleFav={() => onToggleFav(r)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── ② 测名 ──────────────────────────────────────────────────────── */
function NamingScore() {
  const { lang } = useI18n();
  const [name, setName] = useState('');
  const [result, setResult] = useState<ScoreCard | null>(null);
  const stream = useAIStream();
  const favorites = useFavorites();

  const score = () => {
    if (!name.trim()) return;
    setResult(null);
    const sys = `你是姓名学专家,会综合「音、形、义、数理」4 个维度评分一个中文姓名。\n姓名:"${name.trim()}"\n要求:\n- overall: 综合分 0-100(不要总给高分,要有梯度)\n- tone: 音律分 0-100(读起来顺不顺、有没有谐音歧义)\n- form: 字形分 0-100(笔画是否均衡、好不好写)\n- meaning: 寓意分 0-100(用字寓意、典故出处)\n- numerology: 数理分 0-100(传统姓名学的五格)\n- summary: 综合点评,1 句话 30 字内\n- pros: 2-3 条优点,每条 15 字内\n- cons: 1-2 条建议或瑕疵,每条 15 字内\n- characters: 每个字的解析(包括姓),[{"ch":"李","meaning":"..."}]\n**只输出 JSON**(不要 markdown 围栏,不要解释):\n{"overall":78,"tone":80,"form":75,"meaning":85,"numerology":70,"summary":"...","pros":["..."],"cons":["..."],"characters":[]}`;
    stream.run({
      systemPrompt: sys, userPrompt: '请测名', temperature: 0.6,
      onDone: (text) => {
        try {
          const j = JSON.parse(text.replace(/^```json\s*|\s*```$/g, '').trim());
          const r: ScoreCard = {
            overall: clamp(j.overall, 0, 100),
            tone: clamp(j.tone, 0, 100),
            form: clamp(j.form, 0, 100),
            meaning: clamp(j.meaning, 0, 100),
            numerology: clamp(j.numerology, 0, 100),
            summary: String(j.summary || ''),
            pros: Array.isArray(j.pros) ? j.pros.slice(0, 3).map(String) : [],
            cons: Array.isArray(j.cons) ? j.cons.slice(0, 2).map(String) : [],
            characters: Array.isArray(j.characters) ? j.characters.map((c: any) => ({ ch: String(c.ch || ''), meaning: String(c.meaning || '') })) : [],
          };
          setResult(r);
          // 全局收藏:把整份测名报告(总分+4维+优缺点+拆字)作为一条收藏
          const fullName = name.trim();
          const breakdown = r.characters.length > 0 ? r.characters.map((c) => `· ${c.ch} — ${c.meaning}`).join('\n') : '';
          favorites.add({
            toolId: 63, toolName: '取名玄学馆', kind: 'score',
            title: `${fullName} · ${r.overall}分`,
            preview: r.summary || `总分 ${r.overall}/100 · 音 ${r.tone} · 形 ${r.form} · 义 ${r.meaning} · 数 ${r.numerology}`,
            content: `【姓名】\n${fullName}\n\n【综合分】\n${r.overall}/100\n\n【综合点评】\n${r.summary}\n\n【4 维评分】\n· 音律: ${r.tone}\n· 字形: ${r.form}\n· 寓意: ${r.meaning}\n· 数理: ${r.numerology}\n\n【优点】\n${r.pros.map((p) => '· ' + p).join('\n') || '—'}\n\n【注意 / 建议】\n${r.cons.map((c) => '· ' + c).join('\n') || '—'}\n\n【逐字拆解】\n${breakdown || '—'}`,
            dedupeKey: fullName,  // 同一姓名测过只存一条(用户再点就是取消)
          });
        } catch {}
      },
    });
  };

  // 收藏按钮状态
  const fullName = name.trim();
  const isScoreFav = fullName ? favorites.isFav(63, fullName) : false;
  const toggleScoreFav = () => {
    if (!result) return;
    const breakdown = result.characters.length > 0 ? result.characters.map((c) => `· ${c.ch} — ${c.meaning}`).join('\n') : '';
    favorites.toggle({
      toolId: 63, toolName: '取名玄学馆', kind: 'score',
      title: `${fullName} · ${result.overall}分`,
      preview: result.summary || `总分 ${result.overall}/100 · 音 ${result.tone} · 形 ${result.form} · 义 ${result.meaning} · 数 ${result.numerology}`,
      content: `【姓名】\n${fullName}\n\n【综合分】\n${result.overall}/100\n\n【综合点评】\n${result.summary}\n\n【4 维评分】\n· 音律: ${result.tone}\n· 字形: ${result.form}\n· 寓意: ${result.meaning}\n· 数理: ${result.numerology}\n\n【优点】\n${result.pros.map((p) => '· ' + p).join('\n') || '—'}\n\n【注意 / 建议】\n${result.cons.map((c) => '· ' + c).join('\n') || '—'}\n\n【逐字拆解】\n${breakdown || '—'}`,
      dedupeKey: fullName,
    });
  };

  return (
    <div className="grid grid-cols-[340px_1fr] h-full">
      <div className="p-6 space-y-4 overflow-y-auto" style={{ borderRight: '1px solid var(--color-border)' }}>
        <Field label={lang === 'en' ? 'Full name (Chinese)' : '完整姓名'}>
          <TextInput value={name} onChange={setName} placeholder="如:李明哲" />
        </Field>
        <ConfirmButton onClick={stream.streaming ? stream.stop : score} icon={stream.streaming ? StopIcon : Sparkles} fullWidth>
          {stream.streaming ? (lang === 'en' ? 'Stop' : '停止') : (lang === 'en' ? 'Score this name' : '测一测')}
        </ConfirmButton>
        {stream.error && <p className="text-[11px]" style={{ color: '#fca5a5' }}>{stream.error}</p>}
      </div>
      <div className="p-6 overflow-y-auto">
        {!result ? (
          stream.streaming ? <NamingSkeleton count={1} cols={1} tall /> :
          <EmptyState icon={Star} text={lang === 'en' ? 'Type a full name and tap score' : '输入完整姓名,AI 从音/形/义/数理 4 维点评'} />
        ) : (
          <div className="max-w-2xl mx-auto space-y-4">
            {/* 总分大卡 */}
            <div className="rounded-2xl p-6 flex items-center gap-6 relative" style={{ background: 'var(--color-bg-card)', border: '1.5px solid var(--color-border)' }}>
              {/* 收藏按钮 —— 整份测名报告可一键收藏 */}
              <button
                onClick={toggleScoreFav}
                title={isScoreFav ? (lang === 'en' ? 'Remove from favorites' : '从收藏移除') : (lang === 'en' ? 'Save this name report' : '收藏这份测名报告')}
                className="absolute top-3 right-3 w-7 h-7 rounded-md flex items-center justify-center transition-all"
                style={{ color: isScoreFav ? 'var(--color-accent)' : 'var(--color-text-muted)', background: isScoreFav ? 'var(--color-accent-glow)' : 'transparent' }}
              >
                <Bookmark size={13} fill={isScoreFav ? 'currentColor' : 'none'} />
              </button>
              <div className="w-28 h-28 rounded-full flex flex-col items-center justify-center shrink-0" style={{ background: `conic-gradient(${scoreColor(result.overall)} ${result.overall * 3.6}deg, var(--color-bg-main) 0deg)` }}>
                <div className="rounded-full flex flex-col items-center justify-center" style={{ width: 92, height: 92, background: 'var(--color-bg-card)' }}>
                  <div className="text-3xl font-bold leading-none" style={{ color: scoreColor(result.overall) }}>{result.overall}</div>
                  <div className="text-[10px] mt-1" style={{ color: 'var(--color-text-muted)' }}>{scoreTier(result.overall, lang)}</div>
                </div>
              </div>
              <div className="flex-1 min-w-0 pr-8">
                <h2 className="text-[22px] font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>{name}</h2>
                <p className="text-[13px] leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>{result.summary}</p>
              </div>
            </div>

            {/* 4 维度评分 */}
            <div className="grid grid-cols-2 gap-2.5">
              {([
                { label: lang === 'en' ? 'Tone'       : '音律', v: result.tone },
                { label: lang === 'en' ? 'Form'       : '字形', v: result.form },
                { label: lang === 'en' ? 'Meaning'    : '寓意', v: result.meaning },
                { label: lang === 'en' ? 'Numerology' : '数理', v: result.numerology },
              ]).map((d, i) => (
                <div key={i} className="rounded-xl p-3" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-semibold" style={{ color: 'var(--color-text-secondary)' }}>{d.label}</span>
                    <span className="text-[14px] font-bold" style={{ color: scoreColor(d.v) }}>{d.v}</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--color-bg-main)' }}>
                    <div style={{ width: `${d.v}%`, height: '100%', background: scoreColor(d.v), transition: 'width 0.5s' }} />
                  </div>
                </div>
              ))}
            </div>

            {/* 优缺点 + 拆字 */}
            <div className="grid grid-cols-2 gap-2.5">
              {result.pros.length > 0 && (
                <div className="rounded-xl p-3.5" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
                  <div className="text-[11px] font-semibold mb-2 flex items-center gap-1.5" style={{ color: 'var(--color-success)' }}><Check size={11} />{lang === 'en' ? 'Pros' : '优点'}</div>
                  <ul className="space-y-1">{result.pros.map((p, i) => <li key={i} className="text-[12px] leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>· {p}</li>)}</ul>
                </div>
              )}
              {result.cons.length > 0 && (
                <div className="rounded-xl p-3.5" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
                  <div className="text-[11px] font-semibold mb-2 flex items-center gap-1.5" style={{ color: '#fca5a5' }}>!{lang === 'en' ? ' Cons / Notes' : ' 注意 / 建议'}</div>
                  <ul className="space-y-1">{result.cons.map((p, i) => <li key={i} className="text-[12px] leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>· {p}</li>)}</ul>
                </div>
              )}
            </div>

            {result.characters.length > 0 && (
              <div className="rounded-xl p-4" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
                <div className="text-[10px] font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--color-text-muted)' }}>{lang === 'en' ? 'Character breakdown' : '逐字拆解'}</div>
                <div className="flex flex-wrap gap-3">
                  {result.characters.map((c, i) => (
                    <div key={i} className="flex-1 min-w-[120px] rounded-lg p-3 text-center" style={{ background: 'var(--color-bg-main)' }}>
                      <div className="text-4xl font-serif mb-2" style={{ color: 'var(--color-accent)' }}>{c.ch}</div>
                      <p className="text-[11px] leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>{c.meaning}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── ③ 英文意境 ─────────────────────────────────────────────────── */
function NamingEnglish() {
  const { lang } = useI18n();
  const [en, setEn] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | 'any'>('any');
  const [results, setResults] = useState<EnNameCard[]>([]);
  const stream = useAIStream();
  const favorites = useFavorites();

  const go = () => {
    if (!en.trim()) return;
    setResults([]);
    const enWord = en.trim();
    const sys = `用户想从英文词/意境出发,为自己取一个中文名。\n输入:"${enWord}"\n性别倾向:${gender === 'male' ? '男' : gender === 'female' ? '女' : '不限'}\n请给出 4 个对应的中文名(2-3 字),要求:\n- name: 中文名(不含姓,2-3 字)\n- pinyin: 带声调拼音\n- meaning: 中文寓意(20-35 字)\n- resonance: 这个名字与英文输入在意象/音韵上的呼应关系(25-40 字)\n**只输出 JSON 数组**:\n[{"name":"","pinyin":"","meaning":"","resonance":""}]`;
    stream.run({
      systemPrompt: sys, userPrompt: enWord, temperature: 0.95,
      onDone: (text) => {
        try {
          const j = JSON.parse(text.replace(/^```json\s*|\s*```$/g, '').trim());
          const arr = (Array.isArray(j) ? j : []).map((r: any) => ({
            name: String(r.name || ''), pinyin: String(r.pinyin || ''),
            meaning: String(r.meaning || ''), resonance: String(r.resonance || ''),
          })).filter((x) => x.name);
          setResults(arr);
          // 全局收藏:每个候选中文名作为一条独立收藏(用户想收藏哪条都行)
          for (const r of arr) {
            favorites.add({
              toolId: 63, toolName: '取名玄学馆', kind: 'en-resonance',
              title: `${enWord} → ${r.name}`,
              preview: r.meaning,
              content: `【英文意境】\n${enWord}\n\n【对应中文名】\n${r.name}${r.pinyin ? ` (${r.pinyin})` : ''}\n\n【寓意】\n${r.meaning}\n\n【意境呼应】\n${r.resonance}`,
              dedupeKey: `en::${enWord}::${r.name}`,  // 同一英文+同一中文名只存一次
            });
          }
        } catch {}
      },
    });
  };

  // 收藏按钮状态:每张候选卡各自判断
  const isEnNameFav = (r: EnNameCard) => en && r.name ? favorites.isFav(63, `en::${en.trim()}::${r.name}`) : false;
  const toggleEnNameFav = (r: EnNameCard) => {
    if (!en.trim()) return;
    favorites.toggle({
      toolId: 63, toolName: '取名玄学馆', kind: 'en-resonance',
      title: `${en.trim()} → ${r.name}`,
      preview: r.meaning,
      content: `【英文意境】\n${en}\n\n【对应中文名】\n${r.name}${r.pinyin ? ` (${r.pinyin})` : ''}\n\n【寓意】\n${r.meaning}\n\n【意境呼应】\n${r.resonance}`,
      dedupeKey: `en::${en}::${r.name}`,
    });
  };

  return (
    <div className="grid grid-cols-[340px_1fr] h-full">
      <div className="p-6 space-y-4 overflow-y-auto" style={{ borderRight: '1px solid var(--color-border)' }}>
        <Field label={lang === 'en' ? 'English word / vibe' : '英文词 / 意境'} hint={lang === 'en' ? 'e.g. Aurora, Wanderer, "calm ocean"' : '如:Aurora、Wanderer、calm ocean'}>
          <TextInput value={en} onChange={setEn} placeholder="Aurora" />
        </Field>
        <Field label={lang === 'en' ? 'Gender' : '性别倾向'}>
          <Select value={gender} onChange={(v) => setGender(v as any)} options={[
            { value: 'any', label: lang === 'en' ? 'Any' : '不限' },
            { value: 'male', label: lang === 'en' ? 'Boy' : '男' },
            { value: 'female', label: lang === 'en' ? 'Girl' : '女' },
          ]} />
        </Field>
        <ConfirmButton onClick={stream.streaming ? stream.stop : go} icon={stream.streaming ? StopIcon : Sparkles} fullWidth>
          {stream.streaming ? (lang === 'en' ? 'Stop' : '停止') : (lang === 'en' ? 'Find Chinese names' : '寻找对应中文名')}
        </ConfirmButton>
        {stream.error && <p className="text-[11px]" style={{ color: '#fca5a5' }}>{stream.error}</p>}
      </div>
      <div className="p-6 overflow-y-auto">
        {results.length === 0 ? (
          stream.streaming ? <NamingSkeleton count={4} cols={2} />
          : <EmptyState icon={Sparkles} text={lang === 'en' ? 'Type an English word, see its Chinese resonance' : '输入英文意境,AI 帮你寻 4 个意境呼应的中文名'} />
        ) : (
          <div className="grid grid-cols-2 gap-3 max-w-3xl mx-auto">
            {results.map((r, i) => (
              <div key={i} className="rounded-xl p-4 relative" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
                <button
                  onClick={() => toggleEnNameFav(r)}
                  title={isEnNameFav(r) ? (lang === 'en' ? 'Remove from favorites' : '从收藏移除') : (lang === 'en' ? 'Save this name' : '收藏这个中文名')}
                  className="absolute top-2.5 right-2.5 w-7 h-7 rounded-md flex items-center justify-center transition-all"
                  style={{ color: isEnNameFav(r) ? 'var(--color-accent)' : 'var(--color-text-muted)', background: isEnNameFav(r) ? 'var(--color-accent-glow)' : 'transparent' }}
                >
                  <Bookmark size={13} fill={isEnNameFav(r) ? 'currentColor' : 'none'} />
                </button>
                <div className="flex items-baseline gap-2 mb-2 pr-8">
                  <h3 className="text-2xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>{r.name}</h3>
                  <span className="text-[11px] font-mono" style={{ color: 'var(--color-text-muted)' }}>{r.pinyin}</span>
                </div>
                <p className="text-[12px] mb-2.5 leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>{r.meaning}</p>
                <div className="rounded-lg p-2.5 text-[11px] leading-relaxed" style={{ background: 'var(--color-bg-main)', color: 'var(--color-text-muted)', borderLeft: '2px solid var(--color-accent)' }}>
                  <strong style={{ color: 'var(--color-accent)' }}>{en} → </strong>{r.resonance}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── ④ 情侣合婚 ─────────────────────────────────────────────────── */
interface PartnerInput {
  name: string;
  starSign: string;       // '' 表示未选
  chineseZodiac: string;  // ''
  birthDate: string;      // 'YYYY-MM-DD' (可选,给 AI 推八字用)
  birthHour: string;      // '0'..'23' (可选,影响时辰八字)
}
function emptyPartner(): PartnerInput { return { name: '', starSign: '', chineseZodiac: '', birthDate: '', birthHour: '' }; }

function NamingCouple() {
  const { lang } = useI18n();
  const [a, setA] = useState<PartnerInput>(emptyPartner);
  const [b, setB] = useState<PartnerInput>(emptyPartner);
  const [result, setResult] = useState<CoupleCard | null>(null);
  const stream = useAIStream();
  const favorites = useFavorites();

  const describePartner = (p: PartnerInput, label: string): string => {
    const lines = [`${label} 姓名:${p.name.trim() || '(未填)'}`];
    if (p.starSign) {
      const s = STAR_SIGNS.find((x) => x.v === p.starSign);
      if (s) lines.push(`${label} 星座:${s.zh}座 ${s.emoji}`);
    }
    if (p.chineseZodiac) {
      const z = CHINESE_ZODIAC.find((x) => x.v === p.chineseZodiac);
      if (z) lines.push(`${label} 属相:${z.zh} ${z.emoji}`);
    }
    if (p.birthDate) {
      lines.push(`${label} 出生日期:${p.birthDate}${p.birthHour ? ` ${String(p.birthHour).padStart(2, '0')}:00 时辰` : ''}`);
    }
    return lines.join('\n');
  };

  // 选了多少个可选维度,决定 AI 输出要不要带相应解读字段
  const hasStarSign = !!(a.starSign || b.starSign);
  const hasZodiac   = !!(a.chineseZodiac || b.chineseZodiac);
  const hasBazi     = !!(a.birthDate || b.birthDate);

  const go = () => {
    if (!a.name.trim() || !b.name.trim()) return;
    setResult(null);

    /* 动态构建 prompt —— 用户填了几个维度,AI 才输出几个维度的解读,
       避免 AI 凭空编造没给的信息 */
    const fields: string[] = [
      '- score: 合拍指数 0-100(梯度均匀,不要总给高分)',
      '- verdict: 一句话总结(15 字内,可以俏皮)',
      '- nameHarmony: 从姓名学角度的匹配(五行 + 音韵 + 寓意,40 字内)',
    ];
    if (hasStarSign) fields.push('- zodiacHarmony: 两人星座相处的优势与火花(40 字内)');
    if (hasZodiac)   fields.push('- chineseZodiacHarmony: 两人属相相合 / 相冲关系(40 字内)');
    if (hasBazi)     fields.push('- baziHarmony: 从生辰八字推两人五行,给出生克关系(40 字内)');
    fields.push('- strengths: 在一起的优势(40 字内)');
    fields.push('- cautions: 相处时要注意的(30 字内,温柔的提醒)');
    fields.push('- suggestion: 一句给两人的小建议(25 字内)');

    const sys = `你是趣味合婚分析师,综合「姓名、星座、生肖、八字」给两人写一份合婚报告。\n${describePartner(a, '【A】')}\n${describePartner(b, '【B】')}\n\n要求:\n- 语气**轻松温暖、有梗**,**不要算命腔、不要迷信**\n- 只针对用户**实际填写**的维度写,没填的维度不要凭空编\n- 评分要诚实,如果不太合也要说出来(给出温柔的建议)\n\n输出字段(只输出 JSON,不要 markdown 围栏):\n{\n${fields.join('\n')}\n}`;
    stream.run({
      systemPrompt: sys,
      userPrompt: `${a.name} × ${b.name}`,
      temperature: 0.9,
      onDone: (text) => {
        try {
          const j = JSON.parse(text.replace(/^```json\s*|\s*```$/g, '').trim());
          const r: CoupleCard = {
            score: clamp(j.score, 0, 100),
            verdict: String(j.verdict || ''),
            nameHarmony: String(j.nameHarmony || ''),
            zodiacHarmony: j.zodiacHarmony ? String(j.zodiacHarmony) : undefined,
            chineseZodiacHarmony: j.chineseZodiacHarmony ? String(j.chineseZodiacHarmony) : undefined,
            baziHarmony: j.baziHarmony ? String(j.baziHarmony) : undefined,
            strengths: String(j.strengths || ''),
            cautions: String(j.cautions || ''),
            suggestion: String(j.suggestion || ''),
          };
          setResult(r);
          // 全局收藏:整份合婚报告作为一条收藏
          const buildReport = (rr: CoupleCard) => {
            const A_TAG = STAR_SIGNS.find((s) => s.v === a.starSign);
            const B_TAG = STAR_SIGNS.find((s) => s.v === b.starSign);
            const AZ_TAG = CHINESE_ZODIAC.find((z) => z.v === a.chineseZodiac);
            const BZ_TAG = CHINESE_ZODIAC.find((z) => z.v === b.chineseZodiac);
            const aMeta = `${a.name.trim()}${A_TAG ? ` ${A_TAG.emoji}` : ''}${AZ_TAG ? ` ${AZ_TAG.emoji}` : ''}`;
            const bMeta = `${b.name.trim()}${B_TAG ? ` ${B_TAG.emoji}` : ''}${BZ_TAG ? ` ${BZ_TAG.emoji}` : ''}`;
            const sections: string[] = [
              `【当事人】\nA: ${aMeta}\nB: ${bMeta}`,
              `【合拍指数】\n${rr.score}/100\n${rr.verdict}`,
              `【姓名 / 五行】\n${rr.nameHarmony}`,
            ];
            if (rr.zodiacHarmony)         sections.push(`【星座】\n${rr.zodiacHarmony}`);
            if (rr.chineseZodiacHarmony)  sections.push(`【属相】\n${rr.chineseZodiacHarmony}`);
            if (rr.baziHarmony)           sections.push(`【八字 / 五行】\n${rr.baziHarmony}`);
            sections.push(`【在一起的优势】\n${rr.strengths}`);
            sections.push(`【要注意】\n${rr.cautions}`);
            sections.push(`【小建议】\n${rr.suggestion}`);
            return sections.join('\n\n');
          };
          favorites.add({
            toolId: 63, toolName: '取名玄学馆', kind: 'couple',
            title: `${a.name.trim()} × ${b.name.trim()} · ${r.score}分`,
            preview: r.verdict,
            content: buildReport(r),
            // 两人姓名 + 各自星座/属相一起作为 dedupe key(填得越多越精准去重)
            dedupeKey: `couple::${a.name}::${a.starSign}::${a.chineseZodiac}::${a.birthDate}::${b.name}::${b.starSign}::${b.chineseZodiac}::${b.birthDate}`,
          });
        } catch {}
      },
    });
  };

  const A = STAR_SIGNS.find((s) => s.v === a.starSign);
  const B = STAR_SIGNS.find((s) => s.v === b.starSign);
  const AZ = CHINESE_ZODIAC.find((z) => z.v === a.chineseZodiac);
  const BZ = CHINESE_ZODIAC.find((z) => z.v === b.chineseZodiac);

  // 收藏按钮状态
  const coupleKey = a.name && b.name
    ? `couple::${a.name}::${a.starSign}::${a.chineseZodiac}::${a.birthDate}::${b.name}::${b.starSign}::${b.chineseZodiac}::${b.birthDate}`
    : '';
  const isCoupleFav = coupleKey ? favorites.isFav(63, coupleKey) : false;
  const toggleCoupleFav = () => {
    if (!result) return;
    const A_TAG = STAR_SIGNS.find((s) => s.v === a.starSign);
    const B_TAG = STAR_SIGNS.find((s) => s.v === b.starSign);
    const AZ_TAG = CHINESE_ZODIAC.find((z) => z.v === a.chineseZodiac);
    const BZ_TAG = CHINESE_ZODIAC.find((z) => z.v === b.chineseZodiac);
    const aMeta = `${a.name.trim()}${A_TAG ? ` ${A_TAG.emoji}` : ''}${AZ_TAG ? ` ${AZ_TAG.emoji}` : ''}`;
    const bMeta = `${b.name.trim()}${B_TAG ? ` ${B_TAG.emoji}` : ''}${BZ_TAG ? ` ${BZ_TAG.emoji}` : ''}`;
    const sections: string[] = [
      `【当事人】\nA: ${aMeta}\nB: ${bMeta}`,
      `【合拍指数】\n${result.score}/100\n${result.verdict}`,
      `【姓名 / 五行】\n${result.nameHarmony}`,
    ];
    if (result.zodiacHarmony)         sections.push(`【星座】\n${result.zodiacHarmony}`);
    if (result.chineseZodiacHarmony)  sections.push(`【属相】\n${result.chineseZodiacHarmony}`);
    if (result.baziHarmony)           sections.push(`【八字 / 五行】\n${result.baziHarmony}`);
    sections.push(`【在一起的优势】\n${result.strengths}`);
    sections.push(`【要注意】\n${result.cautions}`);
    sections.push(`【小建议】\n${result.suggestion}`);
    favorites.toggle({
      toolId: 63, toolName: '取名玄学馆', kind: 'couple',
      title: `${a.name.trim()} × ${b.name.trim()} · ${result.score}分`,
      preview: result.verdict,
      content: sections.join('\n\n'),
      dedupeKey: coupleKey,
    });
  };

  return (
    <div className="grid grid-cols-[420px_1fr] h-full">
      {/* 左侧 — 两栏并排的「人」 */}
      <div className="p-5 overflow-y-auto" style={{ borderRight: '1px solid var(--color-border)' }}>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <PartnerInputCard label="A" value={a} onChange={setA} lang={lang} accent="var(--color-accent)" />
          <PartnerInputCard label="B" value={b} onChange={setB} lang={lang} accent="#f87171" />
        </div>
        <ConfirmButton onClick={stream.streaming ? stream.stop : go} icon={stream.streaming ? StopIcon : Heart} fullWidth>
          {stream.streaming ? (lang === 'en' ? 'Stop' : '停止') : (lang === 'en' ? 'Match' : '测合拍指数')}
        </ConfirmButton>
        <p className="text-[10px] mt-3 leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
          {lang === 'en'
            ? '★ Name is required. Star sign / Chinese zodiac / birth date are optional — fill more for richer analysis.'
            : '★ 姓名必填。星座 / 属相 / 生辰为选填,填得越多 AI 解读越细。'}
        </p>
        {stream.error && <p className="text-[11px] mt-2" style={{ color: '#fca5a5' }}>{stream.error}</p>}
      </div>

      {/* 右侧 — 报告 */}
      <div className="p-6 overflow-y-auto">
        {!result ? (
          stream.streaming ? <NamingSkeleton count={1} cols={1} tall /> :
          <EmptyState icon={Heart} text={lang === 'en' ? 'Fill in two partners, see your match' : '填两个人,看一份玄学合婚小报告 —— 趣味,不算命'} />
        ) : (
          <div className="max-w-2xl mx-auto space-y-3">
            {/* 顶部合拍指数大卡 */}
            <div className="rounded-2xl p-5 relative" style={{ background: 'linear-gradient(135deg, var(--color-accent-glow) 0%, var(--color-bg-card) 100%)', border: '1.5px solid var(--color-accent)' }}>
              <button
                onClick={toggleCoupleFav}
                title={isCoupleFav ? (lang === 'en' ? 'Remove from favorites' : '从收藏移除') : (lang === 'en' ? 'Save this match report' : '收藏这份合婚报告')}
                className="absolute top-3 right-3 w-7 h-7 rounded-md flex items-center justify-center transition-all"
                style={{ color: isCoupleFav ? 'var(--color-accent)' : 'var(--color-text-secondary)', background: 'rgba(10,10,12,0.3)' }}
              >
                <Bookmark size={13} fill={isCoupleFav ? 'currentColor' : 'none'} />
              </button>
              <div className="flex items-center justify-center gap-3 mb-3 flex-wrap">
                <PartnerBadge name={a.name} star={A?.emoji} zodiac={AZ?.emoji} />
                <Heart size={20} style={{ color: 'var(--color-accent)' }} fill="currentColor" />
                <PartnerBadge name={b.name} star={B?.emoji} zodiac={BZ?.emoji} />
              </div>
              <div className="text-center mb-1">
                <span className="text-6xl font-bold" style={{ color: scoreColor(result.score) }}>{result.score}</span>
                <span className="text-[18px] ml-1" style={{ color: 'var(--color-text-muted)' }}>/100</span>
              </div>
              <p className="text-center text-[14px] font-medium" style={{ color: 'var(--color-text-primary)' }}>{result.verdict}</p>
            </div>

            {/* 维度卡 —— 只渲染实际有数据的 */}
            <CoupleRow icon="✎" label={lang === 'en' ? 'Name harmony' : '姓名 · 五行'} text={result.nameHarmony} />
            {result.zodiacHarmony && (
              <CoupleRow icon={`${A?.emoji ?? '★'} ${B?.emoji ?? '★'}`} label={lang === 'en' ? 'Star sign harmony' : '星座 · 默契'} text={result.zodiacHarmony} accent />
            )}
            {result.chineseZodiacHarmony && (
              <CoupleRow icon={`${AZ?.emoji ?? '🐾'} ${BZ?.emoji ?? '🐾'}`} label={lang === 'en' ? 'Chinese zodiac' : '属相 · 相合相冲'} text={result.chineseZodiacHarmony} />
            )}
            {result.baziHarmony && (
              <CoupleRow icon="☯" label={lang === 'en' ? 'Bazi / Five elements' : '八字 · 五行生克'} text={result.baziHarmony} accent />
            )}
            <CoupleRow icon="✦" label={lang === 'en' ? 'Strengths together' : '在一起的优势'} text={result.strengths} accent />
            <CoupleRow icon="!" label={lang === 'en' ? 'Mind these' : '要注意'} text={result.cautions} />
            <CoupleRow icon="✿" label={lang === 'en' ? 'Tip' : '小建议'} text={result.suggestion} accent />
          </div>
        )}
      </div>
    </div>
  );
}

/* 一个「人」的输入卡 —— 姓名(必填) + 星座 / 属相 / 生辰(可选) */
function PartnerInputCard({
  label, value, onChange, lang, accent,
}: {
  label: string;
  value: PartnerInput;
  onChange: (v: PartnerInput) => void;
  lang: 'zh' | 'en';
  accent: string;
}) {
  const patch = (p: Partial<PartnerInput>) => onChange({ ...value, ...p });
  return (
    <div className="rounded-xl p-3 space-y-2.5" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
      <div className="flex items-center justify-between">
        <span className="w-6 h-6 rounded-md flex items-center justify-center text-[11px] font-bold" style={{ background: `${accent}33`, color: accent }}>
          {label}
        </span>
        <span className="text-[9px] uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
          {lang === 'en' ? 'Partner' : '当事人'}
        </span>
      </div>

      {/* 姓名(必填) */}
      <input
        value={value.name}
        onChange={(e) => patch({ name: e.target.value })}
        placeholder={lang === 'en' ? 'Name *' : '姓名 *'}
        className="w-full px-2 py-1.5 rounded-md text-[13px] font-medium outline-none"
        style={{ background: 'var(--color-bg-main)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
      />

      {/* 星座(可选)*/}
      <EmojiSelect
        value={value.starSign}
        onChange={(v) => patch({ starSign: v })}
        placeholder={lang === 'en' ? 'Star sign (optional)' : '星座 (选填)'}
        options={STAR_SIGNS.map((s) => ({ v: s.v, label: `${s.emoji} ${lang === 'en' ? s.en : s.zh + '座'}` }))}
      />

      {/* 属相(可选)*/}
      <EmojiSelect
        value={value.chineseZodiac}
        onChange={(v) => patch({ chineseZodiac: v })}
        placeholder={lang === 'en' ? 'Chinese zodiac (optional)' : '属相 (选填)'}
        options={CHINESE_ZODIAC.map((z) => ({ v: z.v, label: `${z.emoji} ${lang === 'en' ? z.en : z.zh}` }))}
      />

      {/* 生辰(可选)*/}
      <div className="flex gap-1.5">
        <input
          type="date"
          value={value.birthDate}
          onChange={(e) => patch({ birthDate: e.target.value })}
          className="flex-1 min-w-0 px-2 py-1.5 rounded-md text-[11px] outline-none"
          style={{ background: 'var(--color-bg-main)', border: '1px solid var(--color-border)', color: value.birthDate ? 'var(--color-text-primary)' : 'var(--color-text-muted)', colorScheme: 'dark' }}
          title={lang === 'en' ? 'Birth date (optional, for Bazi)' : '出生日期(选填,用于八字)'}
        />
        <select
          value={value.birthHour}
          onChange={(e) => patch({ birthHour: e.target.value })}
          className="w-[78px] shrink-0 px-1.5 py-1.5 rounded-md text-[11px] outline-none appearance-none"
          style={{ background: 'var(--color-bg-main)', border: '1px solid var(--color-border)', color: value.birthHour ? 'var(--color-text-primary)' : 'var(--color-text-muted)' }}
          title={lang === 'en' ? 'Birth hour (optional)' : '出生时辰(选填)'}
        >
          <option value="">{lang === 'en' ? '— Hr' : '时辰'}</option>
          {Array.from({ length: 24 }).map((_, h) => (
            <option key={h} value={String(h)}>{String(h).padStart(2, '0')}:00</option>
          ))}
        </select>
      </div>
    </div>
  );
}

/* Emoji + label 下拉。原来的 Select 不支持空值占位,这里独立一个版本 */
function EmojiSelect({ value, onChange, placeholder, options }: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  options: { v: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-2 py-1.5 rounded-md text-[12px] outline-none appearance-none cursor-pointer"
      style={{
        background: 'var(--color-bg-main)',
        border: '1px solid var(--color-border)',
        color: value ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
      }}
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o.v} value={o.v} style={{ color: 'var(--color-text-primary)', background: 'var(--color-bg-card)' }}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

/* 顶部合拍卡里展示「姓名 + 小星座 + 小属相」 */
function PartnerBadge({ name, star, zodiac }: { name: string; star?: string; zodiac?: string }) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-[20px] font-semibold" style={{ color: 'var(--color-text-primary)' }}>{name}</span>
      {(star || zodiac) && (
        <span className="text-[14px] ml-1 leading-none">{star}{zodiac}</span>
      )}
    </div>
  );
}

/* ─── 共用子组件 ──────────────────────────────────────────────────── */

function NameCardView({ card, isFav, onToggleFav }: { card: NameCard; isFav: boolean; onToggleFav: () => void }) {
  const elemMeta = ELEMENT_META[card.element];
  return (
    <div className="rounded-xl p-4 relative group transition-all" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
      <button onClick={onToggleFav} className="absolute top-2.5 right-2.5 w-7 h-7 rounded-md flex items-center justify-center transition-all" style={{ color: isFav ? 'var(--color-accent)' : 'var(--color-text-muted)', background: isFav ? 'var(--color-accent-glow)' : 'transparent', opacity: isFav ? 1 : 0.55 }} title={isFav ? '取消收藏' : '收藏'}>
        <Bookmark size={13} fill={isFav ? 'currentColor' : 'none'} />
      </button>
      <div className="flex items-baseline gap-2 mb-1">
        <h3 className="text-2xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>{card.name}</h3>
      </div>
      {card.pinyin && <p className="text-[11px] font-mono mb-2" style={{ color: 'var(--color-text-muted)' }}>{card.pinyin}</p>}
      <p className="text-[12px] mb-3 leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>{card.meaning}</p>
      <div className="flex items-center gap-1.5 flex-wrap">
        {elemMeta && (
          <span className="text-[10px] px-2 py-0.5 rounded-full font-medium flex items-center gap-1" style={{ background: 'var(--color-bg-main)', color: elemMeta.color, border: `1px solid ${elemMeta.color}40` }}>
            <span>{elemMeta.icon}</span> {card.element}
          </span>
        )}
        {card.characters && (
          <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'var(--color-bg-main)', color: 'var(--color-text-muted)' }}>
            {card.characters}
          </span>
        )}
      </div>
      <button
        onClick={() => navigator.clipboard?.writeText(card.name)}
        className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 text-[10px] px-1.5 py-0.5 rounded"
        style={{ background: 'var(--color-bg-main)', color: 'var(--color-text-muted)' }}
      >
        {'复制'}
      </button>
    </div>
  );
}

function NameMiniCard({ card, onRemove }: { card: NameCard; onRemove: () => void }) {
  const elemMeta = ELEMENT_META[card.element];
  return (
    <div className="rounded-lg p-3" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
      <div className="flex items-start justify-between mb-1">
        <h4 className="text-[16px] font-semibold" style={{ color: 'var(--color-text-primary)' }}>{card.name}</h4>
        <button onClick={onRemove}><X size={12} style={{ color: 'var(--color-text-muted)' }} /></button>
      </div>
      {card.pinyin && <p className="text-[10px] font-mono mb-1" style={{ color: 'var(--color-text-muted)' }}>{card.pinyin}</p>}
      <p className="text-[11px] leading-snug line-clamp-2" style={{ color: 'var(--color-text-secondary)' }}>{card.meaning}</p>
      {elemMeta && (
        <span className="inline-block mt-1.5 text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: 'var(--color-bg-main)', color: elemMeta.color }}>{elemMeta.icon} {card.element}</span>
      )}
    </div>
  );
}

function CoupleRow({ icon, label, text, accent }: { icon: string; label: string; text: string; accent?: boolean }) {
  return (
    <div className="rounded-xl p-4 flex items-start gap-3" style={{ background: accent ? 'var(--color-accent-glow)' : 'var(--color-bg-card)', border: `1px solid ${accent ? 'var(--color-accent)' : 'var(--color-border)'}` }}>
      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-[16px]" style={{ background: 'var(--color-bg-main)', color: 'var(--color-accent)' }}>{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--color-text-muted)' }}>{label}</div>
        <p className="text-[13px] leading-relaxed" style={{ color: 'var(--color-text-primary)' }}>{text}</p>
      </div>
    </div>
  );
}

/** 流式加载时显示的骨架屏(替代原本暴露 JSON 流原文的展示)*/
function NamingSkeleton({ count, cols, tall }: { count: number; cols: number; tall?: boolean }) {
  return (
    <div className={`grid gap-3 max-w-3xl mx-auto`} style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl p-4" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', minHeight: tall ? 280 : 140 }}>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-3 h-3 rounded-full animate-pulse" style={{ background: 'var(--color-accent)' }} />
            <span className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>AI 测算中…</span>
          </div>
          <div className="space-y-2">
            <div className="h-6 w-2/3 rounded animate-pulse" style={{ background: 'var(--color-bg-main)' }} />
            <div className="h-3 w-full rounded animate-pulse" style={{ background: 'var(--color-bg-main)', opacity: 0.7 }} />
            <div className="h-3 w-5/6 rounded animate-pulse" style={{ background: 'var(--color-bg-main)', opacity: 0.5 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function clamp(v: any, lo: number, hi: number): number {
  const n = Number(v);
  if (Number.isNaN(n)) return Math.round((lo + hi) / 2);
  return Math.max(lo, Math.min(hi, Math.round(n)));
}
function scoreColor(s: number): string {
  if (s >= 85) return 'var(--color-success)';
  if (s >= 70) return 'var(--color-accent)';
  if (s >= 55) return 'var(--color-warning)';
  return '#fca5a5';
}
function scoreTier(s: number, lang: 'zh' | 'en'): string {
  if (lang === 'en') return s >= 85 ? 'Excellent' : s >= 70 ? 'Good' : s >= 55 ? 'Fair' : 'Needs work';
  return s >= 85 ? '极佳' : s >= 70 ? '良好' : s >= 55 ? '中等' : '尚可改进';
}

/* ═════════════════════════════════════════════════════════════════════
   64. 解梦占卜
   ═════════════════════════════════════════════════════════════════════ */


export function DreamTool() {
  const { lang } = useI18n();
  const [keyword, setKeyword] = useState('');
  const [picked, setPicked] = useState<{ name: string; reply: string; lucky: string; tip: string } | null>(null);
  const stream = useAIStream();
  const favorites = useFavorites();
  const hasOutput = stream.text.length > 0 || stream.thinking.length > 0;

  const T = {
    title: lang === 'en' ? 'Dream Oracle' : '解梦占卜',
    sub: lang === 'en' ? 'AI interprets dream symbols' : 'AI 解读梦境象征',
    keyword: lang === 'en' ? 'Dream keyword' : '梦境关键词',
    go: lang === 'en' ? 'Interpret' : '解读',
    stop: lang === 'en' ? 'Stop' : '停止',
    empty: lang === 'en' ? 'Enter a keyword' : '输入关键词',
    lucky: lang === 'en' ? 'Lucky' : '今日运势',
    tip: lang === 'en' ? 'Tip' : '建议',
    copy: lang === 'en' ? 'Copy' : '复制',
  };

  const interpret = () => {
    if (!keyword.trim()) return;
    setPicked(null);
    const k = keyword.trim();
    const sys = `你是资深解梦师。请用中文解读用户梦境:\n- 用 ## 解读(2-3 段) + ## 今日运势(数字/颜色) + ## 建议(1-2 条) 格式\n- 心理隐喻为主,不搞迷信\n- 语气温和专业`;
    stream.run({ systemPrompt: sys, userPrompt: `梦境关键词:"${k}"`, temperature: 0.8, onDone: (text) => {
      const lucky = text.match(/今日运势[::]\s*([^\n]+)/)?.[1]?.trim() || (lang === 'en' ? 'Number 6 · Color blue' : '数字 6 · 颜色 蓝色');
      const tip = text.match(/建议[::]\s*([^\n]+(?:\n(?!##)[^\n]+)*)/)?.[1]?.trim() || (lang === 'en' ? 'Trust your inner voice' : '今天多听自己内心的声音');
      setPicked({ name: k, reply: text, lucky, tip });
      // 全局收藏:每次解读都进收藏(用户可到收藏面板移除)
      favorites.add({
        toolId: 64, toolName: '解梦占卜', kind: 'dream',
        title: `梦: ${k.length > 24 ? k.slice(0, 24) + '…' : k}`,
        preview: text.length > 100 ? text.slice(0, 100) + '…' : text,
        content: `【梦境关键词】\n${k}\n\n【解梦解读】\n${text}\n\n【今日运势】\n${lucky}\n\n【建议】\n${tip}`,
        dedupeKey: k,
      });
    } });
  };

  // 书签按钮状态 —— 同关键词去重
  const dreamKey = picked?.name || '';
  const isDreamFav = dreamKey ? favorites.isFav(64, dreamKey) : false;
  const toggleDreamFav = () => {
    if (!picked) return;
    favorites.toggle({
      toolId: 64, toolName: '解梦占卜', kind: 'dream',
      title: `梦: ${dreamKey.length > 24 ? dreamKey.slice(0, 24) + '…' : dreamKey}`,
      preview: picked.reply.length > 100 ? picked.reply.slice(0, 100) + '…' : picked.reply,
      content: `【梦境关键词】\n${dreamKey}\n\n【解梦解读】\n${picked.reply}\n\n【今日运势】\n${picked.lucky}\n\n【建议】\n${picked.tip}`,
      dedupeKey: dreamKey,
    });
  };

  return (
    <div className="grid grid-cols-[340px_1fr] h-full">
      <div className="p-6 space-y-4" style={{ borderRight: '1px solid var(--color-border)' }}>
        <Field label={T.keyword}>
          <TextInput value={keyword} onChange={setKeyword} placeholder={lang === 'en' ? 'e.g. snake, water, flying' : '如:蛇、水、飞翔、坠落'} />
        </Field>
        <ConfirmButton onClick={stream.streaming ? stream.stop : interpret} icon={stream.streaming ? StopIcon : Sparkles} fullWidth>
          {stream.streaming ? T.stop : T.go}
        </ConfirmButton>
        <p className="text-[10px] text-center" style={{ color: 'var(--color-text-muted)' }}>常见:蛇 水 飞翔 坠落 牙 死人 火 考试 迷路 钱</p>
      </div>
      <div className="p-6 overflow-y-auto">
        {!picked && !hasOutput && !stream.streaming ? <EmptyState icon={Brain} text={T.empty} /> : (
          <div className="space-y-3">
            {picked ? (
              <>
                <div className="rounded-xl p-6 relative pr-12" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
                  <pre className="text-[13px] leading-relaxed whitespace-pre-wrap font-sans" style={{ color: 'var(--color-text-primary)' }}>{picked.reply}</pre>
                  <button
                    onClick={toggleDreamFav}
                    title={isDreamFav ? (lang === 'en' ? 'Remove from favorites' : '从收藏中移除') : (lang === 'en' ? 'Save to favorites' : '收藏这次解梦')}
                    className="absolute top-3 right-3 w-7 h-7 rounded-md flex items-center justify-center transition-all"
                    style={{ color: isDreamFav ? 'var(--color-accent)' : 'var(--color-text-muted)', background: isDreamFav ? 'var(--color-accent-glow)' : 'transparent' }}
                  >
                    <Bookmark size={13} fill={isDreamFav ? 'currentColor' : 'none'} />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl p-4" style={{ background: 'var(--color-accent-glow)', border: '1px solid var(--color-accent)' }}>
                    <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--color-accent)' }}>{T.lucky}</p>
                    <p className="text-[13px] font-medium" style={{ color: 'var(--color-text-primary)' }}>{picked.lucky}</p>
                  </div>
                  <div className="rounded-xl p-4" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
                    <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--color-text-muted)' }}>{T.tip}</p>
                    <p className="text-[13px] font-medium" style={{ color: 'var(--color-text-primary)' }}>{picked.tip}</p>
                  </div>
                </div>
              </>
            ) : (
              <AIToolPanel stream={stream} toolId={64} toolName={T.title} prompt={keyword} />
            )}
            {stream.error && <p className="text-[11px]" style={{ color: '#fca5a5' }}>{stream.error}</p>}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────── Shared form atoms ─────────── */

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[13px] font-medium block" style={{ color: 'var(--color-text-primary)' }}>{label}</label>
      {hint && <p className="text-[11px] -mt-1" style={{ color: 'var(--color-text-muted)' }}>{hint}</p>}
      {children}
    </div>
  );
}

function TextInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      type="text" value={value} placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="w-full h-9 px-3 rounded-lg text-[13px] outline-none"
      style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
      onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--color-accent)'; e.currentTarget.style.boxShadow = '0 0 0 3px var(--color-accent-glow)'; }}
      onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.boxShadow = 'none'; }}
    />
  );
}

function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}
      className="w-full h-9 px-2 rounded-lg text-[12px] outline-none appearance-none cursor-pointer"
      style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
    >
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function EmptyState({ icon: Icon, text }: { icon: any; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
        <Icon size={26} strokeWidth={1.5} style={{ color: 'var(--color-text-muted)' }} />
      </div>
      <p className="text-[13px]" style={{ color: 'var(--color-text-muted)' }}>{text}</p>
    </div>
  );
}

/* localStorage 助手 —— 后面 3 个新工具公用 */
function loadLS<T>(key: string, fallback: T): T {
  try { const r = localStorage.getItem(key); if (r) return JSON.parse(r) as T; } catch {}
  return fallback;
}
function saveLS(key: string, val: unknown) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}
/** YYYY-MM-DD,用作每日缓存的 key,避免一天内反复消耗 AI */
function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
/** 把任意字符串散列成 [0, max) 内的稳定整数,塔罗按日期抽牌用 */
function hash32(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/* ═════════════════════════════════════════════════════════════════════
   65. 猫狗翻译机 PetTranslatorTool
   ─────────────────────────────────────────────────────────────────────
   用户描述毛孩子的动作 + 调心情滑块 → AI 用第一人称(猫/狗视角)
   「翻译」一段内心独白,再附科普性「行为解读」和心情 emoji。
   故意一本正经又一本胡说,趣味为主,科普点缀。
   ═════════════════════════════════════════════════════════════════════ */

const PET_EXAMPLES = {
  cat: [
    '蹲在我电脑键盘上歪头看我',
    '把我刚倒的水推到地上',
    '半夜跑酷,撞翻台灯',
    '一直对着墙角喵喵叫,但那里什么都没有',
    '在我穿西装出门前躺在我衣服上滚来滚去',
  ],
  dog: [
    '把我刚买的鞋叼到沙发底下',
    '看到外卖小哥就疯狂摇尾巴',
    '把头埋进我胳膊里发出哼哼声',
    '盯着空盘子,然后转头盯着我',
    '把球叼来又不让我拿,反复拉锯',
  ],
};

interface PetTranslation { speech: string; analysis: string; emoji: string; moodLabel: string; }
const PET_KEY = 'ai-tools-launcher.pet-history.v1';

export function PetTranslatorTool() {
  const { lang } = useI18n();
  const [pet, setPet] = useState<'cat' | 'dog'>('cat');
  const [action, setAction] = useState('');
  const [mood, setMood] = useState(50); // 0=委屈 50=平静 100=暴躁
  const [result, setResult] = useState<PetTranslation | null>(null);
  const [history, setHistory] = useState<Array<PetTranslation & { pet: 'cat'|'dog'; action: string; at: string }>>(() => loadLS(PET_KEY, []));
  const stream = useAIStream();
  const favorites = useFavorites();

  useEffect(() => { saveLS(PET_KEY, history); }, [history]);

  const moodLabel = mood < 25 ? (lang === 'en' ? 'sulky' : '委屈')
                  : mood < 50 ? (lang === 'en' ? 'calm'  : '平静')
                  : mood < 75 ? (lang === 'en' ? 'eager' : '撒娇')
                  :              (lang === 'en' ? 'feisty': '暴躁');

  const translate = () => {
    if (!action.trim()) return;
    setResult(null);
    const petText = pet === 'cat' ? '猫' : '狗';
    const actText = action.trim();
    // 注:让模型必须返回严格 JSON,这样我们可以稳定渲染卡片。
    const sys = `你是一只${petText},现在要把主人描述的动作翻译成你的内心独白。\n要求:\n- speech: 用第一人称"我"(${petText}视角),1-2 句口语化、可爱、有点傲娇/憨憨,**60 字以内**\n- analysis: 用旁观者口吻科普这个动作通常意味着什么,1 句,**40 字以内**,要靠谱(不要瞎说)\n- emoji: 1 个最贴合心情的 emoji\n- moodLabel: 4 字以内的中文心情标签\n主人心情提示:${moodLabel}(0=委屈 100=暴躁)\n**只输出 JSON**(不要解释,不要 markdown 围栏):\n{"speech":"...","analysis":"...","emoji":"😺","moodLabel":"..."}`;
    stream.run({
      systemPrompt: sys,
      userPrompt: `我的${petText}刚刚${actText}。`,
      temperature: 1.0, // 高温度,鼓励发散的可爱口吻
      onDone: (text) => {
        try {
          const j = JSON.parse(text.replace(/^```json\s*|\s*```$/g, '').trim());
          const r: PetTranslation = { speech: j.speech || '', analysis: j.analysis || '', emoji: j.emoji || '🐾', moodLabel: j.moodLabel || moodLabel };
          setResult(r);
          setHistory((h) => [{ ...r, pet, action: actText, at: new Date().toISOString() }, ...h].slice(0, 20));
          // 全局收藏:每次翻译都进收藏
          favorites.add({
            toolId: 65, toolName: '猫狗翻译机', kind: 'translation',
            title: `${pet === 'cat' ? '🐱' : '🐶'} ${actText.length > 30 ? actText.slice(0, 30) + '…' : actText}`,
            preview: `${r.emoji} 「${r.speech}」`,
            content: `【${petText}的动作】\n${actText}\n\n【主${petText}心声】\n${r.emoji} ${r.speech}\n\n【行为解读】\n${r.analysis}`,
            dedupeKey: `${pet}::${actText}::${r.speech}`,  // 同 (宠物+动作+翻译) 不重复
          });
        } catch {
          setResult({ speech: text, analysis: '', emoji: '🐾', moodLabel });
        }
      },
    });
  };

  // 书签按钮状态
  const isPetFav = result ? favorites.isFav(65, `${pet}::${action.trim()}::${result.speech}`) : false;
  const togglePetFav = () => {
    if (!result) return;
    const petText = pet === 'cat' ? '猫' : '狗';
    favorites.toggle({
      toolId: 65, toolName: '猫狗翻译机', kind: 'translation',
      title: `${pet === 'cat' ? '🐱' : '🐶'} ${action.length > 30 ? action.slice(0, 30) + '…' : action}`,
      preview: `${result.emoji} 「${result.speech}」`,
      content: `【${petText}的动作】\n${action}\n\n【主${petText}心声】\n${result.emoji} ${result.speech}\n\n【行为解读】\n${result.analysis}`,
      dedupeKey: `${pet}::${action}::${result.speech}`,
    });
  };

  const T = {
    title: lang === 'en' ? 'Pet Translator' : '猫狗翻译机',
    actionLabel: lang === 'en' ? 'What did your pet just do?' : '你家宝贝刚刚做了什么?',
    moodLabel: lang === 'en' ? `Your mood: ${moodLabel}` : `你现在的心情:${moodLabel}`,
    go: lang === 'en' ? 'Translate' : '翻译它的心声',
    stop: lang === 'en' ? 'Stop' : '停止',
    again: lang === 'en' ? 'Translate again' : '再翻一次',
    examples: lang === 'en' ? 'Examples (click to use)' : '示例(点击套用)',
    historyLabel: lang === 'en' ? 'Recent translations' : '最近翻译',
    empty: lang === 'en' ? 'Pick cat or dog, describe what they did' : '选猫或狗,描述一下它的行为',
  };

  return (
    <div className="grid grid-cols-[380px_1fr] h-full">
      {/* 左侧 — 输入区 */}
      <div className="p-6 space-y-4 overflow-y-auto" style={{ borderRight: '1px solid var(--color-border)' }}>
        {/* 猫/狗 切换 */}
        <div className="flex gap-2">
          {([
            { v: 'cat' as const, icon: Cat, l: lang === 'en' ? 'Cat' : '猫' },
            { v: 'dog' as const, icon: Dog, l: lang === 'en' ? 'Dog' : '狗' },
          ]).map((opt) => {
            const active = pet === opt.v;
            const Icon = opt.icon;
            return (
              <button
                key={opt.v}
                onClick={() => setPet(opt.v)}
                className="flex-1 h-14 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all"
                style={{
                  background: active ? 'var(--color-accent-glow)' : 'var(--color-bg-card)',
                  border: `1.5px solid ${active ? 'var(--color-accent)' : 'var(--color-border)'}`,
                  color: active ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                }}
              >
                <Icon size={20} strokeWidth={active ? 2 : 1.5} />
                <span className="text-[12px] font-medium">{opt.l}</span>
              </button>
            );
          })}
        </div>

        <Field label={T.actionLabel}>
          <textarea
            value={action}
            onChange={(e) => setAction(e.target.value)}
            placeholder={pet === 'cat' ? PET_EXAMPLES.cat[0] : PET_EXAMPLES.dog[0]}
            rows={4}
            className="w-full p-3 rounded-lg text-[13px] outline-none resize-none leading-relaxed"
            style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
          />
        </Field>

        <Field label={T.moodLabel} hint={`${mood}`}>
          <input
            type="range" min={0} max={100} step={5}
            value={mood}
            onChange={(e) => setMood(Number(e.target.value))}
            className="w-full"
            style={{ accentColor: 'var(--color-accent)' }}
          />
        </Field>

        <ConfirmButton onClick={stream.streaming ? stream.stop : translate} icon={stream.streaming ? StopIcon : Sparkles} fullWidth>
          {stream.streaming ? T.stop : (result ? T.again : T.go)}
        </ConfirmButton>

        {/* 示例 chips */}
        <div className="pt-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--color-text-muted)' }}>{T.examples}</p>
          <div className="flex flex-wrap gap-1.5">
            {PET_EXAMPLES[pet].map((ex, i) => (
              <button
                key={i}
                onClick={() => setAction(ex)}
                className="text-[11px] px-2 py-1 rounded-md transition-colors"
                style={{ background: 'var(--color-bg-card)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)' }}
              >
                {ex.length > 16 ? ex.slice(0, 16) + '…' : ex}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 右侧 — 输出区 */}
      <div className="p-6 overflow-y-auto">
        {!result && !stream.streaming ? (
          history.length > 0 ? (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--color-text-muted)' }}>{T.historyLabel}</p>
              <div className="space-y-2.5">
                {history.slice(0, 8).map((h, i) => (
                  <div key={i} className="rounded-xl p-3.5" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-2xl leading-none">{h.emoji}</span>
                      <span className="text-[11px] px-1.5 py-0.5 rounded" style={{ background: 'var(--color-accent-glow)', color: 'var(--color-accent)' }}>
                        {h.pet === 'cat' ? '🐱' : '🐶'} · {h.moodLabel}
                      </span>
                      <span className="text-[10px] ml-auto" style={{ color: 'var(--color-text-muted)' }}>{new Date(h.at).toLocaleString().slice(0, -3)}</span>
                    </div>
                    <p className="text-[11px] mb-1" style={{ color: 'var(--color-text-muted)' }}>{h.action}</p>
                    <p className="text-[13px] italic" style={{ color: 'var(--color-text-primary)' }}>「{h.speech}」</p>
                  </div>
                ))}
              </div>
            </div>
          ) : <EmptyState icon={pet === 'cat' ? Cat : Dog} text={T.empty} />
        ) : result ? (
          <div className="space-y-3 max-w-2xl mx-auto">
            {/* 主翻译卡 */}
            <div
              className="rounded-2xl p-6 relative overflow-hidden"
              style={{
                background: 'linear-gradient(135deg, var(--color-accent-glow) 0%, var(--color-bg-card) 100%)',
                border: '1.5px solid var(--color-accent)',
              }}
            >
              <div className="absolute top-3 right-3 flex items-center gap-1.5">
                <button
                  onClick={togglePetFav}
                  title={isPetFav ? (lang === 'en' ? 'Remove from favorites' : '从收藏移除') : (lang === 'en' ? 'Save to favorites' : '收藏这次翻译')}
                  className="w-7 h-7 rounded-full flex items-center justify-center transition-all"
                  style={{ color: isPetFav ? 'var(--color-accent)' : 'var(--color-text-secondary)', background: isPetFav ? 'rgba(10,10,12,0.5)' : 'rgba(10,10,12,0.3)' }}
                >
                  <Bookmark size={13} fill={isPetFav ? 'currentColor' : 'none'} />
                </button>
                <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'var(--color-bg-main)', color: 'var(--color-text-secondary)' }}>
                  {pet === 'cat' ? '🐱 猫语' : '🐶 狗语'}
                </span>
              </div>
              <div className="text-5xl mb-3 leading-none">{result.emoji}</div>
              <p className="text-[18px] leading-relaxed font-medium italic mb-3" style={{ color: 'var(--color-text-primary)' }}>
                「{result.speech}」
              </p>
              <div className="inline-block text-[11px] px-2 py-0.5 rounded-full" style={{ background: 'var(--color-accent)', color: '#0a0a0c', fontWeight: 600 }}>
                {result.moodLabel}
              </div>
            </div>

            {/* 行为解读 */}
            {result.analysis && (
              <div className="rounded-xl p-4" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
                <div className="flex items-center gap-2 mb-2">
                  <Brain size={13} style={{ color: 'var(--color-accent)' }} />
                  <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                    {lang === 'en' ? 'What this usually means' : '通常这意味着'}
                  </span>
                </div>
                <p className="text-[13px] leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>{result.analysis}</p>
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={translate}>
                <RefreshCw size={12} /> {T.again}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => navigator.clipboard?.writeText(`${result.emoji} ${result.speech}`)}>
                <Share2 size={12} /> {lang === 'en' ? 'Copy' : '复制'}
              </Button>
            </div>
          </div>
        ) : (
          <AIToolPanel stream={stream} toolId={65} toolName={T.title} prompt={`${pet}/${action}`} />
        )}
        {stream.error && <p className="text-[11px] mt-2" style={{ color: '#fca5a5' }}>{stream.error}</p>}
      </div>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════════════
   66. 今日宜忌 DailyVibesTool
   ─────────────────────────────────────────────────────────────────────
   现代版老黄历:每日 AI 生成 6 条「宜」+ 6 条「忌」+ 运势指数 + 主推一句。
   关键:**按日期缓存**,一天只调一次 AI,刷新页面不会重新生成,
   保持「这就是今天的运势」的仪式感。「换一批」按钮可强制再生成
   (会覆盖当天缓存)。
   ═════════════════════════════════════════════════════════════════════ */

interface DailyVibes {
  date: string;
  fortune: number;       // 0-100
  topPick: string;       // 主推一句
  doList: string[];      // 宜
  dontList: string[];    // 忌
  luckyColor: string;    // 幸运色
  luckyNumber: number;   // 幸运数字
}
const DV_KEY  = 'ai-tools-launcher.daily-vibes.v1';      // 当日完整对象
const DV_FAVS = 'ai-tools-launcher.daily-vibes-favs.v1'; // 收藏的句子

export function DailyVibesTool() {
  const { lang } = useI18n();
  const [vibes, setVibes] = useState<DailyVibes | null>(() => {
    const cached = loadLS<DailyVibes | null>(DV_KEY, null);
    return cached && cached.date === todayKey() ? cached : null;
  });
  const [favs, setFavs] = useState<string[]>(() => loadLS(DV_FAVS, []));
  const [tab, setTab] = useState<'today' | 'favs'>('today');
  const stream = useAIStream();
  const globalFavs = useFavorites();

  useEffect(() => { saveLS(DV_FAVS, favs); }, [favs]);

  const generate = (force = false) => {
    if (vibes && !force) return;
    const sys = `你是「现代老黄历」生成器。今天是 ${todayKey()},为当代年轻人(20-35 岁,熬夜、996、点外卖、刷短视频)生成今日运势。\n要求:\n- fortune: 0-100 整数,运势指数(每天波动,不要总给高分)\n- topPick: 今日主推一句话(<= 15 字),Z 世代口吻\n- doList: 6 条「宜」,每条 <= 10 字,现代生活场景(如:撸猫、吃辣、点新店、删聊天记录、提前下班),不要老黄历那种「祭祀沐浴」\n- dontList: 6 条「忌」,每条 <= 10 字(如:看体重秤、回工作群消息、网购、回前任消息)\n- luckyColor: 一种颜色名(2-4 字)\n- luckyNumber: 1-9 整数\n语气要俏皮、贴近生活,允许小幽默和小自嘲。\n**只输出 JSON**(不要解释,不要 markdown 围栏):\n{"fortune":75,"topPick":"...","doList":["...",...],"dontList":["...",...],"luckyColor":"...","luckyNumber":7}`;
    stream.run({
      systemPrompt: sys,
      userPrompt: '请生成今日宜忌',
      temperature: 1.0,
      onDone: (text) => {
        try {
          const j = JSON.parse(text.replace(/^```json\s*|\s*```$/g, '').trim());
          const v: DailyVibes = {
            date: todayKey(),
            fortune: Math.max(0, Math.min(100, Number(j.fortune) || 70)),
            topPick: String(j.topPick || ''),
            doList: Array.isArray(j.doList) ? j.doList.slice(0, 6).map(String) : [],
            dontList: Array.isArray(j.dontList) ? j.dontList.slice(0, 6).map(String) : [],
            luckyColor: String(j.luckyColor || '蓝'),
            luckyNumber: Math.max(1, Math.min(9, Number(j.luckyNumber) || 6)),
          };
          setVibes(v);
          saveLS(DV_KEY, v);
        } catch {}
      },
    });
  };

  const toggleFav = (line: string) => {
    setFavs((f) => f.includes(line) ? f.filter((x) => x !== line) : [line, ...f].slice(0, 100));
    // 双写:同步到全局收藏。datasubline 作为 kind("宜"/"忌"),
    // 内容里带今日日期方便收藏面板展示上下文。
    globalFavs.toggle({
      toolId: 66, toolName: '今日宜忌', kind: 'vibes-line',
      title: line,
      preview: `${todayKey()} · 来自「今日宜忌」`,
      content: `【${todayKey()}】\n${line}`,
      dedupeKey: `vibes::${line}`,  // 跨天不变,同一句话只存一份
    });
  };

  const fortuneTier = vibes ? (vibes.fortune >= 80 ? 'great' : vibes.fortune >= 60 ? 'good' : vibes.fortune >= 40 ? 'meh' : 'rough') : 'meh';
  const fortuneColor = fortuneTier === 'great' ? 'var(--color-success)'
                     : fortuneTier === 'good'  ? 'var(--color-accent)'
                     : fortuneTier === 'meh'   ? 'var(--color-warning)'
                     :                            '#fca5a5';
  const fortuneLabel = lang === 'en'
    ? ({ great: 'Stellar', good: 'Smooth', meh: 'Mixed', rough: 'Tough' } as const)[fortuneTier]
    : ({ great: '气运爆棚', good: '顺风顺水', meh: '一般般', rough: '今天躺平' } as const)[fortuneTier];

  return (
    <div className="flex flex-col h-full">
      {/* 顶部标签 */}
      <div className="px-6 pt-4 shrink-0" style={{ borderBottom: '1px solid var(--color-border)' }}>
        <div className="flex items-center gap-1">
          {([
            { k: 'today' as const, l: lang === 'en' ? 'Today' : '今日', icon: Calendar },
            { k: 'favs' as const,  l: lang === 'en' ? `Favs (${favs.length})` : `收藏 (${favs.length})`, icon: Bookmark },
          ]).map((t) => {
            const Icon = t.icon;
            const active = tab === t.k;
            return (
              <button key={t.k} onClick={() => setTab(t.k)} className="h-9 px-4 text-[13px] font-medium relative flex items-center gap-1.5" style={{ color: active ? 'var(--color-text-primary)' : 'var(--color-text-muted)' }}>
                <Icon size={13} />
                {t.l}
                {active && <span className="absolute left-2 right-2 bottom-0 h-0.5 rounded-full" style={{ background: 'var(--color-accent)' }} />}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {tab === 'today' && (
          !vibes ? (
            <div className="max-w-md mx-auto flex flex-col items-center text-center pt-12">
              <div className="text-6xl mb-4">🌅</div>
              <h2 className="text-[20px] font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>{lang === 'en' ? `Today is ${todayKey()}` : `今天是 ${todayKey()}`}</h2>
              <p className="text-[13px] mb-6" style={{ color: 'var(--color-text-muted)' }}>
                {lang === 'en' ? 'AI rolls today\'s do\'s & don\'ts — once a day, on demand.' : 'AI 为你今日掷一次签,每天只生成一次'}
              </p>
              <ConfirmButton onClick={stream.streaming ? stream.stop : () => generate(true)} icon={stream.streaming ? StopIcon : Sparkles}>
                {stream.streaming ? (lang === 'en' ? 'Stop' : '停止') : (lang === 'en' ? 'Reveal today' : '掷今日签')}
              </ConfirmButton>
              {stream.error && <p className="text-[11px] mt-3" style={{ color: '#fca5a5' }}>{stream.error}</p>}
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-4">
              {/* 顶部今日运势卡 */}
              <div className="rounded-2xl p-6 flex items-center gap-6" style={{ background: 'var(--color-bg-card)', border: '1.5px solid var(--color-border)' }}>
                {/* 运势指数大圆 */}
                <div
                  className="w-28 h-28 rounded-full flex flex-col items-center justify-center shrink-0"
                  style={{
                    background: `conic-gradient(${fortuneColor} ${vibes.fortune * 3.6}deg, var(--color-bg-main) 0deg)`,
                  }}
                >
                  <div className="w-22 h-22 rounded-full flex flex-col items-center justify-center" style={{ width: 92, height: 92, background: 'var(--color-bg-card)' }}>
                    <div className="text-3xl font-bold leading-none" style={{ color: fortuneColor }}>{vibes.fortune}</div>
                    <div className="text-[10px] mt-1" style={{ color: 'var(--color-text-muted)' }}>{fortuneLabel}</div>
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] mb-1" style={{ color: 'var(--color-text-muted)' }}>{todayKey()}</div>
                  <h2 className="text-[22px] font-semibold leading-tight mb-3" style={{ color: 'var(--color-text-primary)' }}>{vibes.topPick}</h2>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: 'var(--color-bg-main)', color: 'var(--color-text-secondary)' }}>
                      {lang === 'en' ? `Lucky color: ${vibes.luckyColor}` : `幸运色 · ${vibes.luckyColor}`}
                    </span>
                    <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: 'var(--color-bg-main)', color: 'var(--color-text-secondary)' }}>
                      {lang === 'en' ? `Lucky #: ${vibes.luckyNumber}` : `幸运数字 · ${vibes.luckyNumber}`}
                    </span>
                    <button
                      onClick={() => generate(true)}
                      disabled={stream.streaming}
                      className="text-[11px] px-2 py-0.5 rounded-full flex items-center gap-1 ml-auto"
                      style={{ background: 'var(--color-bg-main)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }}
                    >
                      <RefreshCw size={10} />
                      {lang === 'en' ? 'Re-roll' : '换一批'}
                    </button>
                  </div>
                </div>
              </div>

              {/* 宜 / 忌 两列 */}
              <div className="grid grid-cols-2 gap-3">
                <VibesList label={lang === 'en' ? 'Do' : '宜'} kind="do"   lines={vibes.doList}   favs={favs} onToggleFav={toggleFav} />
                <VibesList label={lang === 'en' ? 'Don\'t' : '忌'} kind="dont" lines={vibes.dontList} favs={favs} onToggleFav={toggleFav} />
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigator.clipboard?.writeText(`📅 ${todayKey()}\n运势 ${vibes.fortune}/100 · ${fortuneLabel}\n${vibes.topPick}\n\n宜:${vibes.doList.join('、')}\n忌:${vibes.dontList.join('、')}\n\n幸运色 ${vibes.luckyColor} · 幸运数字 ${vibes.luckyNumber}`)}
              >
                <Share2 size={12} /> {lang === 'en' ? 'Copy today\'s vibes' : '复制今日运势'}
              </Button>
            </div>
          )
        )}

        {tab === 'favs' && (
          favs.length === 0 ? <EmptyState icon={Bookmark} text={lang === 'en' ? 'Tap the bookmark on any line to save it here' : '在任何一条上点收藏按钮就会出现在这里'} />
          : (
            <div className="max-w-2xl mx-auto space-y-1.5">
              {favs.map((f, i) => (
                <div key={i} className="rounded-lg p-3 flex items-center gap-3" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
                  <span className="text-[14px] flex-1" style={{ color: 'var(--color-text-primary)' }}>{f}</span>
                  <button onClick={() => toggleFav(f)} className="opacity-50 hover:opacity-100" style={{ color: 'var(--color-text-muted)' }}>
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}

function VibesList({ label, kind, lines, favs, onToggleFav }: { label: string; kind: 'do' | 'dont'; lines: string[]; favs: string[]; onToggleFav: (s: string) => void }) {
  const accent = kind === 'do' ? 'var(--color-success)' : '#fca5a5';
  const bgTint = kind === 'do' ? 'rgba(52, 211, 153, 0.08)' : 'rgba(239, 68, 68, 0.08)';
  return (
    <div className="rounded-xl p-4" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-full flex items-center justify-center text-[14px] font-bold" style={{ background: bgTint, color: accent }}>
          {kind === 'do' ? '宜' : '忌'}
        </div>
        <span className="text-[12px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>{label}</span>
      </div>
      <ul className="space-y-1.5">
        {lines.map((line, i) => {
          const isFav = favs.includes(line);
          return (
            <li key={i} className="group flex items-center gap-2">
              <span className="w-1 h-1 rounded-full shrink-0" style={{ background: accent }} />
              <span className="text-[13px] flex-1" style={{ color: 'var(--color-text-primary)' }}>{line}</span>
              <button
                onClick={() => onToggleFav(line)}
                className="opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ color: isFav ? accent : 'var(--color-text-muted)', opacity: isFav ? 1 : undefined }}
                title={isFav ? '取消收藏' : '收藏'}
              >
                <Star size={12} fill={isFav ? 'currentColor' : 'none'} />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════════════
   67. 塔罗一日牌 TarotTool
   ─────────────────────────────────────────────────────────────────────
   22 张大阿卡纳。「今日牌」按 (date + 用户匿名 seed) 哈希决定,
   一天内是稳定的(同一个用户当天看到的是同一张);用户也可以「再抽一次」
   或带着问题问牌(随机抽,不影响今日牌)。
   牌面是 SVG 卡片,带正/逆位翻转动画。AI 用心理隐喻风格解读,不搞迷信。
   ═════════════════════════════════════════════════════════════════════ */

interface TarotCardData { id: number; name: { zh: string; en: string }; symbol: string; kw: { zh: string; en: string } }
const TAROT_DECK: TarotCardData[] = [
  { id: 0,  name: { zh: '愚者',    en: 'The Fool' },          symbol: '✦', kw: { zh: '初心 · 冒险 · 未知', en: 'beginnings · leap · innocence' } },
  { id: 1,  name: { zh: '魔术师',  en: 'The Magician' },      symbol: '∞', kw: { zh: '行动 · 意志 · 显化', en: 'manifest · skill · will' } },
  { id: 2,  name: { zh: '女祭司',  en: 'The High Priestess' },symbol: '☽', kw: { zh: '直觉 · 内省 · 秘密', en: 'intuition · mystery · within' } },
  { id: 3,  name: { zh: '皇后',    en: 'The Empress' },       symbol: '♀', kw: { zh: '丰盛 · 滋养 · 创造', en: 'abundance · nurture · create' } },
  { id: 4,  name: { zh: '皇帝',    en: 'The Emperor' },       symbol: '♂', kw: { zh: '秩序 · 权威 · 结构', en: 'order · authority · frame' } },
  { id: 5,  name: { zh: '教皇',    en: 'The Hierophant' },    symbol: '☩', kw: { zh: '传统 · 学习 · 信念', en: 'tradition · teaching · faith' } },
  { id: 6,  name: { zh: '恋人',    en: 'The Lovers' },        symbol: '♥', kw: { zh: '选择 · 联结 · 价值', en: 'choice · bond · values' } },
  { id: 7,  name: { zh: '战车',    en: 'The Chariot' },       symbol: '➤', kw: { zh: '专注 · 推进 · 控制', en: 'drive · focus · control' } },
  { id: 8,  name: { zh: '力量',    en: 'Strength' },          symbol: '∞', kw: { zh: '勇气 · 温柔 · 自律', en: 'courage · gentle · master' } },
  { id: 9,  name: { zh: '隐者',    en: 'The Hermit' },        symbol: '✺', kw: { zh: '独处 · 寻路 · 内观', en: 'solitude · search · light' } },
  { id: 10, name: { zh: '命运之轮',en: 'Wheel of Fortune' },  symbol: '⊕', kw: { zh: '循环 · 转机 · 周期', en: 'cycle · turn · fate' } },
  { id: 11, name: { zh: '正义',    en: 'Justice' },           symbol: '⚖', kw: { zh: '公平 · 因果 · 抉择', en: 'fair · cause · truth' } },
  { id: 12, name: { zh: '倒吊人',  en: 'The Hanged Man' },    symbol: '✚', kw: { zh: '暂停 · 视角 · 牺牲', en: 'pause · perspective · let go' } },
  { id: 13, name: { zh: '死神',    en: 'Death' },             symbol: '☠', kw: { zh: '结束 · 转化 · 重生', en: 'end · transform · reborn' } },
  { id: 14, name: { zh: '节制',    en: 'Temperance' },        symbol: '⚗', kw: { zh: '平衡 · 融合 · 耐心', en: 'balance · blend · patience' } },
  { id: 15, name: { zh: '恶魔',    en: 'The Devil' },         symbol: '♅', kw: { zh: '执念 · 诱惑 · 阴影', en: 'attach · shadow · bondage' } },
  { id: 16, name: { zh: '塔',      en: 'The Tower' },         symbol: '▲', kw: { zh: '崩塌 · 觉醒 · 破除', en: 'shake · wake · break' } },
  { id: 17, name: { zh: '星星',    en: 'The Star' },          symbol: '★', kw: { zh: '希望 · 治愈 · 灵感', en: 'hope · heal · inspire' } },
  { id: 18, name: { zh: '月亮',    en: 'The Moon' },          symbol: '☾', kw: { zh: '幻象 · 焦虑 · 潜意识', en: 'illusion · fear · dream' } },
  { id: 19, name: { zh: '太阳',    en: 'The Sun' },           symbol: '☀', kw: { zh: '喜悦 · 活力 · 真实', en: 'joy · vital · true' } },
  { id: 20, name: { zh: '审判',    en: 'Judgement' },         symbol: '☄', kw: { zh: '召唤 · 觉醒 · 整合', en: 'call · awaken · integrate' } },
  { id: 21, name: { zh: '世界',    en: 'The World' },         symbol: '◯', kw: { zh: '圆满 · 完成 · 整全', en: 'whole · complete · arrive' } },
];

interface TarotDraw { date: string; cardId: number; reversed: boolean; reading?: string; question?: string }
const TAROT_KEY = 'ai-tools-launcher.tarot-history.v1';
const TAROT_TODAY = 'ai-tools-launcher.tarot-today.v1'; // 当日固定牌缓存
const TAROT_SEED = 'ai-tools-launcher.tarot-seed.v1';   // 用户匿名 seed,稳定生成今日牌

function getOrCreateSeed(): string {
  let s = loadLS<string>(TAROT_SEED, '');
  if (!s) {
    s = Math.random().toString(36).slice(2) + Date.now().toString(36);
    saveLS(TAROT_SEED, s);
  }
  return s;
}
function todayDraw(): TarotDraw {
  const seed = getOrCreateSeed();
  const h = hash32(`${todayKey()}::${seed}`);
  return { date: todayKey(), cardId: h % TAROT_DECK.length, reversed: ((h >> 8) & 1) === 1 };
}

export function TarotTool() {
  const { lang } = useI18n();
  const [draw, setDraw] = useState<TarotDraw | null>(() => {
    const cached = loadLS<TarotDraw | null>(TAROT_TODAY, null);
    if (cached && cached.date === todayKey()) return cached;
    return null;
  });
  const [history, setHistory] = useState<TarotDraw[]>(() => loadLS(TAROT_KEY, []));
  const [question, setQuestion] = useState('');
  const [tab, setTab] = useState<'today' | 'history'>('today');
  const [flipped, setFlipped] = useState(false);
  const stream = useAIStream();
  const favorites = useFavorites();

  useEffect(() => { saveLS(TAROT_KEY, history); }, [history]);

  const card = draw ? TAROT_DECK[draw.cardId] : null;

  const drawToday = () => {
    const d = todayDraw();
    setDraw(d);
    saveLS(TAROT_TODAY, d);
    setFlipped(false);
    setTimeout(() => setFlipped(true), 80);
    interpret(d);
  };

  const drawRandom = (q?: string) => {
    const h = hash32(`${Date.now()}::${Math.random()}::${q || ''}`);
    const d: TarotDraw = { date: todayKey(), cardId: h % TAROT_DECK.length, reversed: ((h >> 8) & 1) === 1, question: q };
    setDraw(d);
    setFlipped(false);
    setTimeout(() => setFlipped(true), 80);
    interpret(d);
  };

  const interpret = (d: TarotDraw) => {
    const c = TAROT_DECK[d.cardId];
    const orient = d.reversed ? '逆位' : '正位';
    const sys = `你是塔罗解读师,但**用心理隐喻**风格,不搞迷信。\n抽到的牌:${c.name.zh} (${c.name.en}) — ${orient}\n关键词:${c.kw.zh}\n${d.question ? `用户问题:"${d.question}"` : '今日抽牌,无具体问题。'}\n请用 150-250 字解读:\n- 先描述这张牌的核心意象(1-2 句)\n- 再结合 ${orient} 给出当前处境的提示\n- 最后一句温和的建议(行动 / 视角 / 心态)\n直接输出散文,**不要 markdown 标题、不要 JSON**。`;
    stream.run({
      systemPrompt: sys,
      userPrompt: d.question || '解读今日抽到的牌',
      temperature: 0.85,
      onDone: (text) => {
        const final: TarotDraw = { ...d, reading: text };
        if (!d.question) saveLS(TAROT_TODAY, final);
        setDraw(final);
        setHistory((h) => [final, ...h].slice(0, 30));
        // 全局收藏:每次抽到牌都进收藏
        favorites.add({
          toolId: 67, toolName: '塔罗一日牌', kind: d.question ? 'with-question' : 'daily',
          title: `${c.name.zh} · ${orient}${d.question ? ` · ${d.question.slice(0, 16)}${d.question.length > 16 ? '…' : ''}` : ''}`,
          preview: text.length > 100 ? text.slice(0, 100) + '…' : text,
          content: `【抽到】\n${c.name.zh} (${c.name.en}) — ${orient}\n关键词:${c.kw.zh}\n${d.question ? `\n【问题】\n${d.question}\n` : ''}\n【解读】\n${text}`,
          dedupeKey: `${d.date}::${d.cardId}::${d.reversed}::${d.question || ''}`,
        });
      },
    });
  };

  // 书签按钮状态 —— 同 (日期+牌+正逆+问题) 去重
  const tarotKey = draw ? `${draw.date}::${draw.cardId}::${draw.reversed}::${draw.question || ''}` : '';
  const isTarotFav = tarotKey ? favorites.isFav(67, tarotKey) : false;
  const toggleTarotFav = () => {
    if (!draw || !card) return;
    const orient = draw.reversed ? '逆位' : '正位';
    favorites.toggle({
      toolId: 67, toolName: '塔罗一日牌', kind: draw.question ? 'with-question' : 'daily',
      title: `${card.name.zh} · ${orient}${draw.question ? ` · ${draw.question.slice(0, 16)}${draw.question.length > 16 ? '…' : ''}` : ''}`,
      preview: (draw.reading || '').length > 100 ? (draw.reading || '').slice(0, 100) + '…' : (draw.reading || ''),
      content: `【抽到】\n${card.name.zh} (${card.name.en}) — ${orient}\n关键词:${card.kw.zh}\n${draw.question ? `\n【问题】\n${draw.question}\n` : ''}\n【解读】\n${draw.reading || ''}`,
      dedupeKey: tarotKey,
    });
  };

  const T = {
    title: lang === 'en' ? 'Tarot of the Day' : '塔罗一日牌',
    today: lang === 'en' ? 'Today' : '今日',
    historyTab: lang === 'en' ? 'History' : '历史',
    drawBtn: lang === 'en' ? 'Draw today\'s card' : '抽今日牌',
    againBtn: lang === 'en' ? 'Ask with a question' : '带问题再抽一张',
    question: lang === 'en' ? 'Optional: what\'s on your mind?' : '想问的小问题(可留空)',
    upright: lang === 'en' ? 'Upright' : '正位',
    reversed: lang === 'en' ? 'Reversed' : '逆位',
    empty: lang === 'en' ? 'Tap to draw your card for today' : '点击抽今日牌,每天一张',
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 pt-4 shrink-0" style={{ borderBottom: '1px solid var(--color-border)' }}>
        <div className="flex items-center gap-1">
          {([
            { k: 'today' as const, l: T.today },
            { k: 'history' as const, l: `${T.historyTab} (${history.length})` },
          ]).map((tt) => (
            <button key={tt.k} onClick={() => setTab(tt.k)} className="h-9 px-4 text-[13px] font-medium relative" style={{ color: tab === tt.k ? 'var(--color-text-primary)' : 'var(--color-text-muted)' }}>
              {tt.l}
              {tab === tt.k && <span className="absolute left-2 right-2 bottom-0 h-0.5 rounded-full" style={{ background: 'var(--color-accent)' }} />}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {tab === 'today' && (
          <div className="max-w-3xl mx-auto">
            {!draw ? (
              <div className="flex flex-col items-center text-center pt-8">
                <TarotCardSVG cardId={-1} reversed={false} flipped={false} />
                <h2 className="text-[20px] font-semibold mt-6 mb-2" style={{ color: 'var(--color-text-primary)' }}>{lang === 'en' ? 'Your card for today' : '今日的塔罗牌'}</h2>
                <p className="text-[12px] mb-5" style={{ color: 'var(--color-text-muted)' }}>{T.empty}</p>
                <ConfirmButton onClick={drawToday} icon={Sparkles}>{T.drawBtn}</ConfirmButton>
              </div>
            ) : card && (
              <div className="grid grid-cols-[200px_1fr] gap-6 items-start">
                {/* 牌面 */}
                <div className="flex flex-col items-center sticky top-0">
                  <TarotCardSVG cardId={draw.cardId} reversed={draw.reversed} flipped={flipped} />
                  <div className="mt-4 text-center">
                    <div className="text-[15px] font-semibold" style={{ color: 'var(--color-text-primary)' }}>{card.name[lang]}</div>
                    <div className="text-[11px] mt-0.5" style={{ color: draw.reversed ? '#fca5a5' : 'var(--color-accent)' }}>
                      {draw.reversed ? T.reversed : T.upright}
                    </div>
                    <div className="text-[10px] mt-2 leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>{card.kw[lang]}</div>
                  </div>
                </div>

                {/* 解读 */}
                <div className="space-y-4">
                  {draw.question && (
                    <div className="rounded-lg p-3 text-[12px] italic" style={{ background: 'var(--color-bg-card)', borderLeft: '3px solid var(--color-accent)', color: 'var(--color-text-secondary)' }}>
                      {lang === 'en' ? `Q: ${draw.question}` : `你问:${draw.question}`}
                    </div>
                  )}
                  <div className="rounded-xl p-5 relative" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', minHeight: 160 }}>
                    {stream.streaming || stream.text ? (
                      <pre className="text-[14px] leading-relaxed whitespace-pre-wrap font-sans pr-8" style={{ color: 'var(--color-text-primary)' }}>
                        {stream.text || draw.reading || ''}
                        {stream.streaming && <span className="inline-block w-1.5 h-3 align-middle ml-0.5 animate-pulse" style={{ background: 'var(--color-accent)' }} />}
                      </pre>
                    ) : draw.reading ? (
                      <pre className="text-[14px] leading-relaxed whitespace-pre-wrap font-sans pr-8" style={{ color: 'var(--color-text-primary)' }}>{draw.reading}</pre>
                    ) : null}
                    {/* 收藏按钮 —— 仅在解读完成后显示 */}
                    {!stream.streaming && draw.reading && (
                      <button
                        onClick={toggleTarotFav}
                        title={isTarotFav ? (lang === 'en' ? 'Remove from favorites' : '从收藏移除') : (lang === 'en' ? 'Save to favorites' : '收藏这张解读')}
                        className="absolute top-3 right-3 w-7 h-7 rounded-md flex items-center justify-center transition-all"
                        style={{ color: isTarotFav ? 'var(--color-accent)' : 'var(--color-text-muted)', background: isTarotFav ? 'var(--color-accent-glow)' : 'transparent' }}
                      >
                        <Bookmark size={13} fill={isTarotFav ? 'currentColor' : 'none'} />
                      </button>
                    )}
                  </div>

                  {/* 问问题区 */}
                  <div className="rounded-xl p-4" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
                    <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--color-text-muted)' }}>{T.againBtn}</p>
                    <div className="flex gap-2">
                      <input
                        value={question}
                        onChange={(e) => setQuestion(e.target.value)}
                        placeholder={T.question}
                        className="flex-1 p-2 rounded-lg text-[12px] outline-none"
                        style={{ background: 'var(--color-bg-main)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
                        onKeyDown={(e) => { if (e.key === 'Enter') { drawRandom(question.trim() || undefined); setQuestion(''); } }}
                      />
                      <Button variant="secondary" size="sm" onClick={() => { drawRandom(question.trim() || undefined); setQuestion(''); }}>
                        <RefreshCw size={12} /> {lang === 'en' ? 'Draw' : '抽'}
                      </Button>
                    </div>
                  </div>
                  {stream.error && <p className="text-[11px]" style={{ color: '#fca5a5' }}>{stream.error}</p>}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'history' && (
          history.length === 0 ? <EmptyState icon={History} text={lang === 'en' ? 'No draws yet' : '还没有抽过牌'} />
          : (
            <div className="max-w-2xl mx-auto space-y-2.5">
              {history.map((d, i) => {
                const c = TAROT_DECK[d.cardId];
                const hKey = `${d.date}::${d.cardId}::${d.reversed}::${d.question || ''}`;
                const isHFav = favorites.isFav(67, hKey);
                const toggleHFav = () => {
                  const orient = d.reversed ? '逆位' : '正位';
                  favorites.toggle({
                    toolId: 67, toolName: '塔罗一日牌', kind: d.question ? 'with-question' : 'daily',
                    title: `${c.name.zh} · ${orient}${d.question ? ` · ${d.question.slice(0, 16)}${d.question.length > 16 ? '…' : ''}` : ''}`,
                    preview: (d.reading || '').length > 100 ? (d.reading || '').slice(0, 100) + '…' : (d.reading || ''),
                    content: `【抽到】\n${c.name.zh} (${c.name.en}) — ${orient}\n关键词:${c.kw.zh}\n${d.question ? `\n【问题】\n${d.question}\n` : ''}\n【解读】\n${d.reading || ''}`,
                    dedupeKey: hKey,
                  });
                };
                return (
                  <div key={i} className="rounded-xl p-3.5 flex items-start gap-3 relative" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
                    <button
                      onClick={toggleHFav}
                      title={isHFav ? (lang === 'en' ? 'Remove from favorites' : '从收藏移除') : (lang === 'en' ? 'Save this draw' : '收藏这次抽牌')}
                      className="absolute top-2.5 right-2.5 w-7 h-7 rounded-md flex items-center justify-center transition-all"
                      style={{ color: isHFav ? 'var(--color-accent)' : 'var(--color-text-muted)', background: isHFav ? 'var(--color-accent-glow)' : 'transparent' }}
                    >
                      <Bookmark size={13} fill={isHFav ? 'currentColor' : 'none'} />
                    </button>
                    <div className="w-12 h-16 rounded flex items-center justify-center text-[20px] shrink-0" style={{
                      background: 'linear-gradient(135deg, var(--color-accent-glow) 0%, var(--color-bg-main) 100%)',
                      border: '1px solid var(--color-accent)',
                      transform: d.reversed ? 'rotate(180deg)' : undefined,
                      color: 'var(--color-accent)',
                    }}>
                      {c.symbol}
                    </div>
                    <div className="flex-1 min-w-0 pr-8">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[13px] font-semibold" style={{ color: 'var(--color-text-primary)' }}>{c.name[lang]}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--color-bg-main)', color: d.reversed ? '#fca5a5' : 'var(--color-accent)' }}>
                          {d.reversed ? T.reversed : T.upright}
                        </span>
                        <span className="text-[10px] ml-auto" style={{ color: 'var(--color-text-muted)' }}>{d.date}</span>
                      </div>
                      {d.question && <p className="text-[11px] italic mb-1" style={{ color: 'var(--color-text-muted)' }}>问:{d.question}</p>}
                      {d.reading && <p className="text-[12px] line-clamp-3 leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>{d.reading}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}
      </div>
    </div>
  );
}

/** 塔罗牌面 SVG —— 一个统一的复古牌面框架,中间放该牌专属符号 + 编号。
 *  cardId = -1 表示牌背(还没抽时显示)。
 *  flipped 控制翻牌动画(CSS transform);reversed = true 时把卡片旋转 180°。 */
function TarotCardSVG({ cardId, reversed, flipped }: { cardId: number; reversed: boolean; flipped: boolean }) {
  const card = cardId >= 0 ? TAROT_DECK[cardId] : null;
  const roman = useMemo(() => {
    if (!card) return '';
    // 0..21 罗马数字
    const RN = ['0','I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII','XIII','XIV','XV','XVI','XVII','XVIII','XIX','XX','XXI'];
    return RN[card.id];
  }, [card]);

  return (
    <div
      className="relative w-[160px] h-[240px] rounded-xl overflow-hidden"
      style={{
        transformStyle: 'preserve-3d',
        transition: 'transform 0.7s cubic-bezier(0.16, 1, 0.3, 1)',
        transform: `${flipped ? 'rotateY(0deg)' : 'rotateY(180deg)'} ${reversed && flipped ? 'rotate(180deg)' : ''}`,
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), 0 0 0 1px var(--color-accent-glow)',
      }}
    >
      {/* 正面 */}
      <div
        className="absolute inset-0 flex flex-col items-center justify-between p-4"
        style={{
          background: 'linear-gradient(160deg, var(--color-bg-card) 0%, var(--color-bg-main) 100%)',
          border: '1.5px solid var(--color-accent)',
          backfaceVisibility: 'hidden',
        }}
      >
        <div className="text-[12px] font-serif" style={{ color: 'var(--color-accent)' }}>{roman}</div>
        <div className="text-7xl leading-none" style={{ color: 'var(--color-accent)', textShadow: '0 0 24px var(--color-accent-glow)' }}>
          {card?.symbol ?? '?'}
        </div>
        <div className="text-[11px] tracking-widest font-medium uppercase" style={{ color: 'var(--color-text-secondary)' }}>
          {card?.name.en ?? ''}
        </div>
      </div>

      {/* 背面(翻牌前看到的) */}
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{
          background: 'repeating-linear-gradient(45deg, var(--color-bg-card) 0px, var(--color-bg-card) 8px, var(--color-bg-main) 8px, var(--color-bg-main) 16px)',
          border: '1.5px solid var(--color-accent)',
          backfaceVisibility: 'hidden',
          transform: 'rotateY(180deg)',
        }}
      >
        <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: 'var(--color-bg-main)', border: '1.5px solid var(--color-accent)' }}>
          <Sparkles size={26} style={{ color: 'var(--color-accent)' }} />
        </div>
      </div>
    </div>
  );
}

/* ─────────── Tool registry ─────────── */
export const LIFE_TOOLS: Record<number, { Component: any; icon: LucideIcon }> = {
  // 已封存:59 健康饮食 / 60 运动计划 / 62 用药提醒 —— 跟 ChatGPT 同质化、
  // 不是「趣味性 + AI 调味」定位的卡片。让位给下面的趣味卡 + 强对抗卡。
  68: { Component: WerewolfGame,      icon: Drama },     // 新增:AI 狼人杀(5 板子,Phase1 跑通 9 人经典)
  69: { Component: GomokuTool,        icon: Sparkles },  // 新增:AI 五子棋(4 档本地 AI · 选黑/选白)
  63: { Component: NamingTool,        icon: Sparkles },  // 取名玄学馆(4 tab:起名/测名/英文意境/情侣合婚)
  64: { Component: DreamTool,         icon: Brain },     // 解梦(下轮重做为「玄学占卜室」)
  65: { Component: PetTranslatorTool, icon: Cat },       // 新增:猫狗翻译机
  66: { Component: DailyVibesTool,    icon: Calendar },  // 新增:今日宜忌
  67: { Component: TarotTool,         icon: Sparkles },  // 新增:塔罗一日牌
  61: { Component: CounselingTool,    icon: Heart },     // 心情树洞(挪到最后,本轮重做)
};
