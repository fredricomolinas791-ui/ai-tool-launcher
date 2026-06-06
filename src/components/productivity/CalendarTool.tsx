import { useState, useMemo, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Plus, Calendar as CalIcon, Clock, Bell, Trash2, Repeat } from 'lucide-react';
import { useI18n } from '../../hooks/useI18n';
import { Button, ConfirmButton, DeleteButton } from '../ui/Button';

type Repeat = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';

interface Event {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string;
  notes?: string;
  repeat: Repeat;
  reminder: number; // minutes before
  color: string;
}

const CAL_KEY = 'ai-tools-launcher.calendar.v1';
const COLORS = ['#c9a961', '#0ea5e9', '#10b981', '#f43f5e', '#8b5cf6', '#f59e0b'];

function load(): Event[] {
  try { const r = localStorage.getItem(CAL_KEY); if (r) return JSON.parse(r); } catch {}
  return seed();
}
function save(items: Event[]) { try { localStorage.setItem(CAL_KEY, JSON.stringify(items)); } catch {} }

function seed(): Event[] {
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  return [
    { id: 's1', title: '团队周会', date: todayStr, startTime: '10:00', endTime: '11:00', repeat: 'weekly', reminder: 15, color: '#0ea5e9' },
    { id: 's2', title: '项目截止', date: addDays(todayStr, 3), startTime: '18:00', endTime: '18:30', repeat: 'none', reminder: 60, color: '#f43f5e' },
  ];
}

function addDays(date: string, n: number): string {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

const REPEAT_LABEL: Record<Repeat, { zh: string; en: string }> = {
  none: { zh: '不重复', en: 'None' },
  daily: { zh: '每天', en: 'Daily' },
  weekly: { zh: '每周', en: 'Weekly' },
  monthly: { zh: '每月', en: 'Monthly' },
  yearly: { zh: '每年', en: 'Yearly' },
};

export function CalendarTool() {
  const { lang } = useI18n();
  const T = {
    title: lang === 'en' ? 'Calendar' : '日历',
    sub: lang === 'en' ? 'Schedule and reminders' : '日程与提醒',
    today: lang === 'en' ? 'Today' : '今天',
    new: lang === 'en' ? 'New event' : '新建事件',
    noEvents: lang === 'en' ? 'No events today' : '今天没有事件',
    add: lang === 'en' ? 'Add' : '添加',
    cancel: lang === 'en' ? 'Cancel' : '取消',
    save: lang === 'en' ? 'Save' : '保存',
    delete: lang === 'en' ? 'Delete' : '删除',
    fields: {
      title: lang === 'en' ? 'Title' : '标题',
      date: lang === 'en' ? 'Date' : '日期',
      start: lang === 'en' ? 'Start' : '开始',
      end: lang === 'en' ? 'End' : '结束',
      notes: lang === 'en' ? 'Notes' : '备注',
      repeat: lang === 'en' ? 'Repeat' : '重复',
      reminder: lang === 'en' ? 'Reminder' : '提醒',
      color: lang === 'en' ? 'Color' : '颜色',
    },
    reminderBefore: lang === 'en' ? 'min before' : '分钟前',
    months: lang === 'en'
      ? ['January','February','March','April','May','June','July','August','September','October','November','December']
      : ['一月','二月','三月','四月','五月','六月','七月','八月','九月','十月','十一月','十二月'],
    weekdays: lang === 'en'
      ? ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
      : ['日','一','二','三','四','五','六'],
  };

  const [events, setEvents] = useState<Event[]>(load);
  const [cursor, setCursor] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [editing, setEditing] = useState<Event | null>(null);
  const [creating, setCreating] = useState<string | null>(null);

  // Notifications tick
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      const today = now.toISOString().slice(0, 10);
      const key = `cal-notified-${today}-${hh}${mm}`;
      if ((window as any)[key]) return;
      (window as any)[key] = true;

      events.forEach((e) => {
        if (e.date !== today) return;
        if ('Notification' in window && Notification.permission === 'granted') {
          const [eh, em] = e.startTime.split(':').map(Number);
          const eventMin = eh * 60 + em;
          const nowMin = now.getHours() * 60 + now.getMinutes();
          if (eventMin - nowMin === e.reminder && nowMin < eventMin) {
            new Notification(`📅 ${e.title}`, { body: `${e.startTime} - ${e.endTime}${e.notes ? ' · ' + e.notes : ''}` });
          }
        }
      });
    };
    tick();
    const id = setInterval(tick, 60000);
    return () => clearInterval(id);
  }, [events]);

  useEffect(() => { save(events); }, [events]);

  // Request notification permission
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Calendar grid
  const { year, month, days } = useMemo(() => {
    const y = cursor.getFullYear();
    const m = cursor.getMonth();
    const firstDay = new Date(y, m, 1);
    const firstWd = firstDay.getDay();
    const lastDate = new Date(y, m + 1, 0).getDate();
    const dayArr: { date: Date; inMonth: boolean; isToday: boolean; dateStr: string }[] = [];
    // Previous month tail
    for (let i = firstWd - 1; i >= 0; i--) {
      const d = new Date(y, m, -i);
      dayArr.push({ date: d, inMonth: false, isToday: false, dateStr: d.toISOString().slice(0, 10) });
    }
    // Current month
    const todayStr = new Date().toISOString().slice(0, 10);
    for (let d = 1; d <= lastDate; d++) {
      const dt = new Date(y, m, d);
      const ds = dt.toISOString().slice(0, 10);
      dayArr.push({ date: dt, inMonth: true, isToday: ds === todayStr, dateStr: ds });
    }
    // Next month head (fill to 42)
    while (dayArr.length < 42) {
      const last = dayArr[dayArr.length - 1].date;
      const next = new Date(last);
      next.setDate(next.getDate() + 1);
      dayArr.push({ date: next, inMonth: false, isToday: false, dateStr: next.toISOString().slice(0, 10) });
    }
    return { year: y, month: m, days: dayArr, firstWeekday: firstWd };
  }, [cursor]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, Event[]>();
    events.forEach((e) => {
      if (!map.has(e.date)) map.set(e.date, []);
      map.get(e.date)!.push(e);
    });
    return map;
  }, [events]);

  const selectedEvents = eventsByDate.get(selectedDate) || [];
  const selectedDayLabel = useMemo(() => {
    const d = new Date(selectedDate);
    return `${T.months[d.getMonth()]} ${d.getDate()}, ${lang === 'en' ? 'Weekday ' + T.weekdays[d.getDay()] : '周' + T.weekdays[d.getDay()]}`;
  }, [selectedDate, lang]);

  const saveEvent = (e: Event) => {
    if (events.find((x) => x.id === e.id)) {
      setEvents(events.map((x) => x.id === e.id ? e : x));
    } else {
      setEvents([...events, e]);
    }
    setEditing(null);
    setCreating(null);
  };

  const removeEvent = (id: string) => {
    setEvents(events.filter((e) => e.id !== id));
    setEditing(null);
  };

  return (
    <div className="grid grid-cols-[1fr_360px] h-full">
      {/* Left: calendar grid */}
      <div className="p-6 flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>
              {T.months[month]} {year}
            </h2>
            <button
              onClick={() => { setCursor(new Date()); setSelectedDate(new Date().toISOString().slice(0, 10)); }}
              className="h-7 px-2.5 rounded-md text-[11px] font-medium"
              style={{ background: 'var(--color-accent-glow)', color: 'var(--color-accent)' }}
            >
              {T.today}
            </button>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCursor(new Date(year, month - 1, 1))}
              className="w-8 h-8 rounded-md flex items-center justify-center"
              style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}
            >
              <ChevronLeft size={14} />
            </button>
            <button
              onClick={() => setCursor(new Date(year, month + 1, 1))}
              className="w-8 h-8 rounded-md flex items-center justify-center"
              style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>

        {/* Weekday header */}
        <div className="grid grid-cols-7 mb-2">
          {T.weekdays.map((w) => (
            <div key={w} className="text-center text-[10px] font-semibold uppercase tracking-wider py-2" style={{ color: 'var(--color-text-muted)' }}>
              {w}
            </div>
          ))}
        </div>

        {/* Days grid */}
        <div className="grid grid-cols-7 gap-1 flex-1">
          {days.map((d, i) => {
            const isSelected = d.dateStr === selectedDate;
            const dayEvents = eventsByDate.get(d.dateStr) || [];
            return (
              <button
                key={i}
                onClick={() => setSelectedDate(d.dateStr)}
                className="min-h-[80px] rounded-lg p-1.5 text-left flex flex-col gap-1 transition-all relative"
                style={{
                  background: isSelected ? 'var(--color-accent-glow)' : d.inMonth ? 'var(--color-bg-card)' : 'transparent',
                  border: `1px solid ${isSelected ? 'var(--color-accent)' : d.isToday ? 'var(--color-accent)' : 'var(--color-border)'}`,
                  opacity: d.inMonth ? 1 : 0.4,
                }}
              >
                <span
                  className="text-[12px] font-medium"
                  style={{
                    color: d.isToday ? 'var(--color-accent)' : 'var(--color-text-primary)',
                    fontWeight: d.isToday ? 700 : 500,
                  }}
                >
                  {d.date.getDate()}
                </span>
                <div className="flex flex-col gap-0.5 overflow-hidden">
                  {dayEvents.slice(0, 3).map((e) => (
                    <div
                      key={e.id}
                      className="text-[9px] px-1.5 py-0.5 rounded truncate"
                      style={{ background: e.color, color: '#0a0a0c' }}
                    >
                      {e.startTime} {e.title}
                    </div>
                  ))}
                  {dayEvents.length > 3 && (
                    <div className="text-[9px]" style={{ color: 'var(--color-text-muted)' }}>+{dayEvents.length - 3} more</div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Right: day detail + events */}
      <div className="p-6 overflow-y-auto" style={{ borderLeft: '1px solid var(--color-border)', background: 'var(--color-bg-card)' }}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>{T.today}</p>
            <h3 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>{selectedDayLabel}</h3>
          </div>
          <ConfirmButton
            onClick={() => setCreating(selectedDate)}
            icon={Plus}
            size="sm"
          >
            {T.new}
          </ConfirmButton>
        </div>

        {selectedEvents.length === 0 ? (
          <div className="rounded-xl p-8 text-center" style={{ background: 'var(--color-bg-main)', border: '1px dashed var(--color-border)' }}>
            <CalIcon size={28} style={{ color: 'var(--color-text-muted)' }} />
            <p className="text-[12px] mt-2" style={{ color: 'var(--color-text-muted)' }}>{T.noEvents}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {selectedEvents.sort((a, b) => a.startTime.localeCompare(b.startTime)).map((e) => (
              <EventCard key={e.id} event={e} onClick={() => setEditing(e)} lang={lang} />
            ))}
          </div>
        )}

        <div className="mt-6 pt-4" style={{ borderTop: '1px solid var(--color-border)' }}>
          <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--color-text-muted)' }}>
            {lang === 'en' ? 'All upcoming' : '即将到来'}
          </p>
          <div className="space-y-1">
            {events
              .filter((e) => e.date >= new Date().toISOString().slice(0, 10))
              .sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime))
              .slice(0, 5)
              .map((e) => (
                <button
                  key={e.id}
                  onClick={() => { setSelectedDate(e.date); setEditing(e); }}
                  className="w-full text-left p-2 rounded-md transition-colors"
                  style={{ background: 'var(--color-bg-main)' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--color-bg-card-hover)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--color-bg-main)'; }}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-6 rounded-full" style={{ background: e.color }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>{e.title}</p>
                      <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>{e.date} · {e.startTime}-{e.endTime}</p>
                    </div>
                  </div>
                </button>
              ))}
          </div>
        </div>
      </div>

      {(editing || creating) && (
        <EventEditor
          initial={editing || { id: 'new_' + Date.now().toString(36), title: '', date: creating || selectedDate, startTime: '09:00', endTime: '10:00', notes: '', repeat: 'none', reminder: 15, color: COLORS[0] }}
          onSave={saveEvent}
          onDelete={editing ? () => removeEvent(editing.id) : undefined}
          onClose={() => { setEditing(null); setCreating(null); }}
          lang={lang}
          T={T}
        />
      )}
    </div>
  );
}

function EventCard({ event, onClick, lang }: { event: Event; onClick: () => void; lang: 'zh' | 'en' }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left p-3 rounded-xl transition-colors"
      style={{ background: 'var(--color-bg-main)', border: '1px solid var(--color-border)' }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = event.color; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-border)'; }}
    >
      <div className="flex items-start gap-3">
        <div className="w-1 self-stretch rounded-full" style={{ background: event.color }} />
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>{event.title}</p>
          <div className="flex items-center gap-2 mt-1 text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
            <span className="flex items-center gap-1"><Clock size={10} />{event.startTime} - {event.endTime}</span>
            {event.repeat !== 'none' && <span className="flex items-center gap-1"><Repeat size={10} />{REPEAT_LABEL[event.repeat][lang as 'zh' | 'en']}</span>}
            {event.reminder > 0 && <span className="flex items-center gap-1"><Bell size={10} />{event.reminder}m</span>}
          </div>
          {event.notes && <p className="text-[11px] mt-1.5 leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>{event.notes}</p>}
        </div>
      </div>
    </button>
  );
}

function EventEditor({ initial, onSave, onDelete, onClose, lang, T }: any) {
  const [e, setE] = useState<Event>(initial);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[520px] max-w-[92vw] rounded-2xl p-6"
        style={{ background: 'var(--color-bg-main)', border: '1px solid var(--color-border)', boxShadow: '0 16px 48px rgba(0,0,0,0.5)' }}
      >
        <h3 className="text-base font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>
          {initial.title ? T.fields.title : T.new}
        </h3>
        <div className="space-y-3">
          <div>
            <label className="text-[11px] font-medium mb-1 block" style={{ color: 'var(--color-text-muted)' }}>{T.fields.title}</label>
            <input
              type="text"
              value={e.title}
              onChange={(ev) => setE({ ...e, title: ev.target.value })}
              className="w-full h-9 px-3 rounded-lg text-[13px] outline-none"
              style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
              autoFocus
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-[11px] font-medium mb-1 block" style={{ color: 'var(--color-text-muted)' }}>{T.fields.date}</label>
              <input
                type="date"
                value={e.date}
                onChange={(ev) => setE({ ...e, date: ev.target.value })}
                className="w-full h-9 px-2 rounded-lg text-[12px] outline-none"
                style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
              />
            </div>
            <div>
              <label className="text-[11px] font-medium mb-1 block" style={{ color: 'var(--color-text-muted)' }}>{T.fields.start}</label>
              <input
                type="time"
                value={e.startTime}
                onChange={(ev) => setE({ ...e, startTime: ev.target.value })}
                className="w-full h-9 px-2 rounded-lg text-[12px] outline-none"
                style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
              />
            </div>
            <div>
              <label className="text-[11px] font-medium mb-1 block" style={{ color: 'var(--color-text-muted)' }}>{T.fields.end}</label>
              <input
                type="time"
                value={e.endTime}
                onChange={(ev) => setE({ ...e, endTime: ev.target.value })}
                className="w-full h-9 px-2 rounded-lg text-[12px] outline-none"
                style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
              />
            </div>
          </div>
          <div>
            <label className="text-[11px] font-medium mb-1 block" style={{ color: 'var(--color-text-muted)' }}>{T.fields.notes}</label>
            <textarea
              value={e.notes || ''}
              onChange={(ev) => setE({ ...e, notes: ev.target.value })}
              rows={2}
              className="w-full px-3 py-2 rounded-lg text-[12px] outline-none resize-none"
              style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] font-medium mb-1 block" style={{ color: 'var(--color-text-muted)' }}>{T.fields.repeat}</label>
              <select
                value={e.repeat}
                onChange={(ev) => setE({ ...e, repeat: ev.target.value as Repeat })}
                className="w-full h-9 px-2 rounded-lg text-[12px] outline-none appearance-none cursor-pointer"
                style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
              >
                {(Object.keys(REPEAT_LABEL) as Repeat[]).map((k) => (
                  <option key={k} value={k}>{REPEAT_LABEL[k][lang as 'zh' | 'en']}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-medium mb-1 block" style={{ color: 'var(--color-text-muted)' }}>{T.fields.reminder}</label>
              <select
                value={e.reminder}
                onChange={(ev) => setE({ ...e, reminder: Number(ev.target.value) })}
                className="w-full h-9 px-2 rounded-lg text-[12px] outline-none appearance-none cursor-pointer"
                style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
              >
                <option value={0}>{lang === 'en' ? 'None' : '不提醒'}</option>
                <option value={5}>5 {T.reminderBefore}</option>
                <option value={15}>15 {T.reminderBefore}</option>
                <option value={30}>30 {T.reminderBefore}</option>
                <option value={60}>60 {T.reminderBefore}</option>
                <option value={1440}>1 {lang === 'en' ? 'day before' : '天前'}</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-[11px] font-medium mb-1 block" style={{ color: 'var(--color-text-muted)' }}>{T.fields.color}</label>
            <div className="flex gap-1.5">
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setE({ ...e, color: c })}
                  className="w-7 h-7 rounded-full transition-transform"
                  style={{
                    background: c,
                    transform: e.color === c ? 'scale(1.2)' : 'scale(1)',
                    boxShadow: e.color === c ? `0 0 0 2px var(--color-bg-main), 0 0 0 3.5px ${c}` : 'none',
                  }}
                />
              ))}
            </div>
          </div>
        </div>
        <div className="mt-5 flex items-center justify-between">
          {onDelete ? (
            <DeleteButton onClick={onDelete} icon={Trash2} size="sm">{T.delete}</DeleteButton>
          ) : <span />}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>{T.cancel}</Button>
            <ConfirmButton onClick={() => e.title.trim() && onSave(e)}>{T.save}</ConfirmButton>
          </div>
        </div>
      </div>
    </div>
  );
}
