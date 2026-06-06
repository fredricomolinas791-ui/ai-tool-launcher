import { useState, useMemo } from 'react';
import { MapPin, Calendar, Wallet, Plus, Trash2, Check, Plane, Hotel, Utensils, Camera, ShoppingBag } from 'lucide-react';
import { useI18n } from '../../hooks/useI18n';
import { Button, ConfirmButton } from '../ui/Button';

interface Stop {
  id: string;
  name: string;
  date: string;
  activities: { id: string; name: string; cost: number; type: 'transport' | 'hotel' | 'food' | 'activity' | 'shopping' }[];
}

const TRIP_KEY = 'ai-tools-launcher.trips.v1';

function loadTrips(): Stop[][] {
  try { const r = localStorage.getItem(TRIP_KEY); if (r) return JSON.parse(r); } catch {}
  return [];
}
function saveTrips(t: Stop[][]) { try { localStorage.setItem(TRIP_KEY, JSON.stringify(t)); } catch {} }

const TYPE_META: Record<Stop['activities'][0]['type'], { icon: any; label: { zh: string; en: string }; color: string }> = {
  transport: { icon: Plane, label: { zh: '交通', en: 'Transport' }, color: '#0ea5e9' },
  hotel: { icon: Hotel, label: { zh: '住宿', en: 'Hotel' }, color: '#8b5cf6' },
  food: { icon: Utensils, label: { zh: '餐饮', en: 'Food' }, color: '#f43f5e' },
  activity: { icon: Camera, label: { zh: '活动', en: 'Activity' }, color: '#10b981' },
  shopping: { icon: ShoppingBag, label: { zh: '购物', en: 'Shopping' }, color: '#f59e0b' },
};

const PACKING_CATEGORIES: Record<string, { zh: string; en: string; items: string[] }> = {
  documents: {
    zh: '证件', en: 'Documents',
    items: ['身份证', '护照', '签证', '机票/车票', '酒店预订单', '保险单', '紧急联系人卡', '现金 + 信用卡'],
  },
  clothing: {
    zh: '衣物', en: 'Clothing',
    items: ['内衣袜子(足够数量)', '舒适外衣', '应对天气的外套', '睡衣', '舒适鞋子', '拖鞋', '帽子', '墨镜'],
  },
  toiletries: {
    zh: '洗漱', en: 'Toiletries',
    items: ['牙刷牙膏', '洗发水沐浴露', '护肤品', '防晒霜', '剃须刀', '卫生用品', '毛巾', '湿巾'],
  },
  tech: {
    zh: '电子', en: 'Tech',
    items: ['手机 + 充电器', '充电宝', '相机 + 存储卡', '耳机', '转换插头', '笔记本电脑(可选)', '万能充电线', '当地 SIM 卡'],
  },
  misc: {
    zh: '其他', en: 'Misc',
    items: ['常用药', '创可贴', '水杯', '雨具', '背包/行李箱', '记事本 + 笔', '零食', '旅行读物'],
  },
};

export function TripPlannerTool() {
  const { lang } = useI18n();
  const T = {
    title: lang === 'en' ? 'Trip Planner' : '旅行规划',
    sub: lang === 'en' ? 'Itinerary, budget, packing list' : '行程 / 预算 / 打包清单',
    itinerary: lang === 'en' ? 'Itinerary' : '行程',
    budget: lang === 'en' ? 'Budget' : '预算',
    packing: lang === 'en' ? 'Packing' : '打包',
    new: lang === 'en' ? 'New trip' : '新建旅行',
    empty: lang === 'en' ? 'Create a trip to start' : '新建一个旅行开始',
    dest: lang === 'en' ? 'Destination' : '目的地',
    days: lang === 'en' ? 'days' : '天',
    addStop: lang === 'en' ? 'Add stop' : '添加站点',
    addAct: lang === 'en' ? 'Add activity' : '添加活动',
    cost: lang === 'en' ? 'Cost' : '费用',
    total: lang === 'en' ? 'Total' : '合计',
    perDay: lang === 'en' ? 'per day' : '/天',
    checked: lang === 'en' ? 'checked' : '已勾选',
    of: lang === 'en' ? 'of' : '/',
    name: lang === 'en' ? 'Trip name' : '旅行名',
    dates: lang === 'en' ? 'Dates' : '日期',
    start: lang === 'en' ? 'Start' : '开始',
    end: lang === 'en' ? 'End' : '结束',
  };

  const [trips, setTrips] = useState<Stop[][]>(loadTrips);
  const [activeIdx, setActiveIdx] = useState(0);
  const [tab, setTab] = useState<'itinerary' | 'budget' | 'packing'>('itinerary');
  const [creating, setCreating] = useState(false);

  useMemo(() => saveTrips(trips), [trips]);

  const activeTrip = trips[activeIdx] || [];
  const totalCost = useMemo(() => activeTrip.reduce((sum, stop) => sum + stop.activities.reduce((s, a) => s + a.cost, 0), 0), [activeTrip]);
  const dayCount = useMemo(() => {
    if (activeTrip.length < 2) return activeTrip.length || 1;
    const dates = activeTrip.map((s) => s.date).sort();
    const first = new Date(dates[0]);
    const last = new Date(dates[dates.length - 1]);
    return Math.max(1, Math.ceil((last.getTime() - first.getTime()) / 86400000) + 1);
  }, [activeTrip]);

  const costByType = useMemo(() => {
    const map = new Map<string, number>();
    activeTrip.forEach((s) => s.activities.forEach((a) => {
      map.set(a.type, (map.get(a.type) || 0) + a.cost);
    }));
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [activeTrip]);
  const maxCost = Math.max(1, ...costByType.map(([, v]) => v));

  const createTrip = (name: string) => {
    if (!name.trim()) return;
    const newTrip: Stop[] = [{
      id: 's_' + Date.now().toString(36),
      name: name.trim(),
      date: new Date().toISOString().slice(0, 10),
      activities: [],
    }];
    setTrips([...trips, newTrip]);
    setActiveIdx(trips.length);
    setCreating(false);
  };

  const deleteTrip = (idx: number) => {
    setTrips(trips.filter((_, i) => i !== idx));
    if (activeIdx >= trips.length - 1) setActiveIdx(Math.max(0, trips.length - 2));
  };

  const addStop = (tripIdx: number) => {
    const name = prompt(lang === 'en' ? 'City / place:' : '城市/景点:') || '';
    if (!name.trim()) return;
    const trip = trips[tripIdx];
    const newStop: Stop = {
      id: 's_' + Date.now().toString(36),
      name: name.trim(),
      date: trip.length > 0 ? addDays(trip[trip.length - 1].date, 1) : new Date().toISOString().slice(0, 10),
      activities: [],
    };
    const updated = [...trip, newStop];
    setTrips(trips.map((t, i) => i === tripIdx ? updated : t));
  };

  const removeStop = (tripIdx: number, stopId: string) => {
    const updated = trips[tripIdx].filter((s) => s.id !== stopId);
    setTrips(trips.map((t, i) => i === tripIdx ? updated : t));
  };

  const addActivity = (tripIdx: number, stopId: string) => {
    const name = prompt(lang === 'en' ? 'Activity:' : '活动名:') || '';
    if (!name.trim()) return;
    const costStr = prompt(lang === 'en' ? 'Cost (¥):' : '费用(¥):') || '0';
    const cost = Number(costStr) || 0;
    const typeStr = prompt(lang === 'en' ? 'Type: transport/hotel/food/activity/shopping' : '类型:transport/hotel/food/activity/shopping') || 'activity';
    const type = (['transport', 'hotel', 'food', 'activity', 'shopping'].includes(typeStr) ? typeStr : 'activity') as any;
    const updated = trips[tripIdx].map((s) => s.id === stopId
      ? { ...s, activities: [...s.activities, { id: 'a_' + Date.now().toString(36), name: name.trim(), cost, type }] }
      : s
    );
    setTrips(trips.map((t, i) => i === tripIdx ? updated : t));
  };

  const removeActivity = (tripIdx: number, stopId: string, actId: string) => {
    const updated = trips[tripIdx].map((s) => s.id === stopId
      ? { ...s, activities: s.activities.filter((a) => a.id !== actId) }
      : s
    );
    setTrips(trips.map((t, i) => i === tripIdx ? updated : t));
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 pt-4 pb-3 flex items-center gap-2 flex-wrap" style={{ borderBottom: '1px solid var(--color-border)' }}>
        {trips.length === 0 ? (
          <p className="text-[12px]" style={{ color: 'var(--color-text-muted)' }}>{T.empty}</p>
        ) : trips.map((trip, i) => (
          <button
            key={i}
            onClick={() => setActiveIdx(i)}
            className="h-8 px-3.5 rounded-lg text-[12px] font-medium flex items-center gap-1.5"
            style={{
              background: i === activeIdx ? 'var(--color-accent)' : 'var(--color-bg-card)',
              color: i === activeIdx ? '#0a0a0c' : 'var(--color-text-secondary)',
              border: `1px solid ${i === activeIdx ? 'var(--color-accent)' : 'var(--color-border)'}`,
            }}
          >
            <MapPin size={11} />
            {trip[0]?.name || T.new} <span className="opacity-60 text-[10px]">({trip.length} {T.days})</span>
            {trips.length > 1 && (
              <span
                onClick={(e) => { e.stopPropagation(); if (confirm('Delete trip?')) deleteTrip(i); }}
                className="ml-1 opacity-60 hover:opacity-100"
              >
                <Trash2 size={10} />
              </span>
            )}
          </button>
        ))}
        <Button variant="secondary" size="sm" onClick={() => setCreating(true)} icon={Plus}>{T.new}</Button>

        {trips[activeIdx] && (
          <div className="ml-auto flex items-center gap-1">
            {(['itinerary', 'budget', 'packing'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className="h-7 px-3 rounded-md text-[11px] font-medium transition-colors"
                style={{
                  background: tab === t ? 'var(--color-bg-card-hover)' : 'transparent',
                  color: tab === t ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                }}
              >
                {t === 'itinerary' && T.itinerary}
                {t === 'budget' && T.budget}
                {t === 'packing' && T.packing}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {creating && <NewTripForm onCreate={createTrip} onClose={() => setCreating(false)} lang={lang} />}

        {!trips[activeIdx] && !creating && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Plane size={48} strokeWidth={1.2} style={{ color: 'var(--color-text-muted)' }} />
            <p className="text-[13px] mt-3" style={{ color: 'var(--color-text-muted)' }}>{T.empty}</p>
            <ConfirmButton onClick={() => setCreating(true)} icon={Plus} className="mt-4">{T.new}</ConfirmButton>
          </div>
        )}

        {trips[activeIdx] && tab === 'itinerary' && (
          <div className="max-w-4xl mx-auto">
            <div className="rounded-xl p-5 mb-4" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>{trips[activeIdx][0]?.name}</h2>
                <div className="flex items-center gap-3 text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                  <span className="flex items-center gap-1"><Calendar size={10} />{dayCount} {T.days}</span>
                  <span className="flex items-center gap-1"><Wallet size={10} />¥{totalCost.toFixed(0)}</span>
                </div>
              </div>
              <ConfirmButton onClick={() => addStop(activeIdx)} icon={Plus} size="sm">{T.addStop}</ConfirmButton>
            </div>

            <div className="space-y-3">
              {activeTrip.map((stop, idx) => (
                <div key={stop.id} className="rounded-xl p-4" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[12px] font-semibold" style={{ background: 'var(--color-accent)', color: '#0a0a0c' }}>
                      {idx + 1}
                    </div>
                    <div className="flex-1">
                      <h3 className="text-[15px] font-semibold" style={{ color: 'var(--color-text-primary)' }}>{stop.name}</h3>
                      <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>{stop.date}</p>
                    </div>
                    <button onClick={() => removeStop(activeIdx, stop.id)} className="w-8 h-8 rounded flex items-center justify-center" style={{ color: 'var(--color-warning)' }}><Trash2 size={13} /></button>
                  </div>
                  {stop.activities.length > 0 ? (
                    <div className="space-y-1.5">
                      {stop.activities.map((act) => {
                        const meta = TYPE_META[act.type];
                        const Icon = meta.icon;
                        return (
                          <div key={act.id} className="flex items-center gap-2 px-3 py-2 rounded-md" style={{ background: 'var(--color-bg-main)' }}>
                            <div className="w-6 h-6 rounded flex items-center justify-center" style={{ background: meta.color }}>
                              <Icon size={12} style={{ color: '#0a0a0c' }} />
                            </div>
                            <span className="text-[12px] flex-1" style={{ color: 'var(--color-text-primary)' }}>{act.name}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--color-bg-card)', color: 'var(--color-text-muted)' }}>{meta.label[lang]}</span>
                            <span className="text-[12px] font-mono tabular-nums" style={{ color: 'var(--color-text-primary)' }}>¥{act.cost}</span>
                            <button onClick={() => removeActivity(activeIdx, stop.id, act.id)} className="w-6 h-6 rounded flex items-center justify-center" style={{ color: 'var(--color-text-muted)' }}><Trash2 size={11} /></button>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-[11px] text-center py-2" style={{ color: 'var(--color-text-muted)' }}>{lang === 'en' ? 'No activities yet' : '暂无活动'}</p>
                  )}
                  <button onClick={() => addActivity(activeIdx, stop.id)} className="w-full mt-2 h-7 rounded-md text-[11px] flex items-center justify-center gap-1" style={{ background: 'var(--color-bg-main)', color: 'var(--color-text-muted)', border: '1px dashed var(--color-border)' }}>
                    <Plus size={10} />{T.addAct}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {trips[activeIdx] && tab === 'budget' && (
          <div className="max-w-3xl mx-auto space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl p-4" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
                <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--color-text-muted)' }}>{T.total}</p>
                <p className="text-2xl font-semibold tabular-nums" style={{ color: 'var(--color-text-primary)' }}>¥{totalCost.toFixed(0)}</p>
              </div>
              <div className="rounded-xl p-4" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
                <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--color-text-muted)' }}>{T.perDay}</p>
                <p className="text-2xl font-semibold tabular-nums" style={{ color: 'var(--color-text-primary)' }}>¥{(totalCost / Math.max(1, dayCount)).toFixed(0)}</p>
              </div>
              <div className="rounded-xl p-4" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
                <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--color-text-muted)' }}>{T.days}</p>
                <p className="text-2xl font-semibold tabular-nums" style={{ color: 'var(--color-text-primary)' }}>{dayCount}</p>
              </div>
            </div>

            <div className="rounded-xl p-5" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
              <h3 className="text-[14px] font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>{T.budget}</h3>
              {costByType.length === 0 ? (
                <p className="text-[12px] text-center py-8" style={{ color: 'var(--color-text-muted)' }}>—</p>
              ) : (
                <div className="space-y-2.5">
                  {costByType.map(([type, amt]) => {
                    const meta = TYPE_META[type as keyof typeof TYPE_META];
                    const Icon = meta.icon;
                    return (
                      <div key={type}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[12px] flex items-center gap-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                            <Icon size={11} style={{ color: meta.color }} />{meta.label[lang]}
                          </span>
                          <span className="text-[12px] font-mono" style={{ color: 'var(--color-text-primary)' }}>¥{amt.toFixed(0)}</span>
                        </div>
                        <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--color-bg-main)' }}>
                          <div className="h-full" style={{ width: `${(amt / maxCost) * 100}%`, background: meta.color }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {trips[activeIdx] && tab === 'packing' && <PackingList lang={lang} />}
      </div>
    </div>
  );
}

function NewTripForm({ onCreate, onClose, lang }: any) {
  const [name, setName] = useState('');
  return (
    <div className="max-w-md mx-auto">
      <div className="rounded-xl p-5" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
        <h3 className="text-[14px] font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>
          {lang === 'en' ? 'New trip' : '新建旅行'}
        </h3>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={lang === 'en' ? 'e.g. Japan Spring 2026' : '如:2026 春节日本'}
          className="w-full h-9 px-3 rounded-lg text-[13px] outline-none mb-3"
          style={{ background: 'var(--color-bg-main)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
          onKeyDown={(e) => e.key === 'Enter' && name.trim() && onCreate(name)}
          autoFocus
        />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>{lang === 'en' ? 'Cancel' : '取消'}</Button>
          <ConfirmButton onClick={() => name.trim() && onCreate(name)}>{lang === 'en' ? 'Create' : '创建'}</ConfirmButton>
        </div>
      </div>
    </div>
  );
}

function PackingList({ lang }: { lang: 'zh' | 'en' }) {
  const KEY = 'ai-tools-launcher.packing.v1';
  const [checked, setChecked] = useState<Set<string>>(() => {
    try { const r = localStorage.getItem(KEY); if (r) return new Set(JSON.parse(r)); } catch {}
    return new Set();
  });

  const toggle = (item: string) => {
    const next = new Set(checked);
    if (next.has(item)) next.delete(item); else next.add(item);
    setChecked(next);
    try { localStorage.setItem(KEY, JSON.stringify(Array.from(next))); } catch {}
  };

  const total = Object.values(PACKING_CATEGORIES).reduce((s, c) => s + c.items.length, 0);
  const done = checked.size;

  return (
    <div className="max-w-4xl mx-auto space-y-3">
      <div className="rounded-xl p-4 flex items-center justify-between" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>{lang === 'en' ? 'Packing progress' : '打包进度'}</p>
          <p className="text-2xl font-semibold tabular-nums" style={{ color: 'var(--color-text-primary)' }}>{done} <span className="text-[14px] opacity-50">/ {total}</span></p>
        </div>
        <div className="w-32 h-2 rounded-full overflow-hidden" style={{ background: 'var(--color-border)' }}>
          <div className="h-full transition-all" style={{ width: `${(done / total) * 100}%`, background: 'var(--color-accent)' }} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {Object.entries(PACKING_CATEGORIES).map(([key, cat]) => (
          <div key={key} className="rounded-xl p-4" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
            <h3 className="text-[13px] font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>{cat[lang]}</h3>
            <div className="space-y-1">
              {cat.items.map((item) => {
                const isChecked = checked.has(item);
                return (
                  <button
                    key={item}
                    onClick={() => toggle(item)}
                    className="w-full text-left flex items-center gap-2 py-1.5 transition-colors"
                  >
                    <div
                      className="w-4 h-4 rounded flex items-center justify-center shrink-0"
                      style={{
                        background: isChecked ? 'var(--color-accent)' : 'transparent',
                        border: `1.5px solid ${isChecked ? 'var(--color-accent)' : 'var(--color-border-light)'}`,
                      }}
                    >
                      {isChecked && <Check size={10} strokeWidth={3} style={{ color: '#0a0a0c' }} />}
                    </div>
                    <span className="text-[12px]" style={{ color: isChecked ? 'var(--color-text-muted)' : 'var(--color-text-primary)', textDecoration: isChecked ? 'line-through' : 'none' }}>{item}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function addDays(date: string, n: number): string {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
