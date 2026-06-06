import { useState, useEffect, useMemo } from 'react';
import {
  Play, Pause, RotateCcw, SkipForward, Plus, Trash2, Check, X,
  Volume2, VolumeX, Maximize2, Settings as SettingsIcon,
  Coffee, Brain, TreePine, CloudRain, Bell, BellOff, Clock, Flame, Target,
} from 'lucide-react';
import { usePomodoro, type Task, type Phase } from '../../hooks/usePomodoro';
import { useI18n } from '../../hooks/useI18n';
import { Button, ConfirmButton, CancelButton } from '../ui/Button';

const T_ZH = {
  title: '番茄钟', sub: '深度专注 · 让每一分钟都算数',
  tasks: '任务清单', addTask: '添加任务', noTasks: '还没有任务,先添加一个吧',
  focus: '专注', shortBreak: '短休息', longBreak: '长休息',
  start: '开始', pause: '暂停', reset: '重置', skip: '跳过',
  today: '今日', finishedPomodoros: '完成番茄', focused: '专注时长', cycle: '本轮',
  sound: '提示音', notif: '桌面通知', autoBreak: '自动开始休息', autoFocus: '自动开始专注',
  whiteNoise: '白噪音', none: '无', rain: '雨声', forest: '森林', cafe: '咖啡馆',
  immersive: '沉浸模式', exit: '按 Esc 退出',
  volume: '音量', settings: '设置', resetConfirm: '确定要重置当前阶段吗?',
  shortcut: '快捷键', kbSpace: '空格 开始/暂停', kbR: 'R 重置', kbS: 'S 跳过', kbF: 'F 沉浸模式',
  pomodoros: '个', mins: '分钟',
  activeTask: '当前任务', clickToSelect: '点击选择关联任务',
};

function t(lang: 'zh' | 'en') { return lang === 'en' ? null : T_ZH; }

export function PomodoroTool() {
  const i18n = useI18n();
  const lang = i18n.lang as 'zh' | 'en';
  const T = t(lang) || {
    title: 'Pomodoro', sub: 'Deep focus. Every minute counts.',
    tasks: 'Tasks', addTask: 'Add task', noTasks: 'No tasks yet — add one to start',
    focus: 'Focus', shortBreak: 'Short break', longBreak: 'Long break',
    start: 'Start', pause: 'Pause', reset: 'Reset', skip: 'Skip',
    today: 'Today', finishedPomodoros: 'Pomodoros', focused: 'Focused', cycle: 'Cycle',
    sound: 'Sound', notif: 'Notifications', autoBreak: 'Auto-start breaks', autoFocus: 'Auto-start focus',
    whiteNoise: 'White noise', none: 'None', rain: 'Rain', forest: 'Forest', cafe: 'Cafe',
    immersive: 'Immersive', exit: 'Press Esc to exit',
    volume: 'Volume', settings: 'Settings', resetConfirm: 'Reset current phase?',
    shortcut: 'Shortcuts', kbSpace: 'Space Start/Pause', kbR: 'R Reset', kbS: 'S Skip', kbF: 'F Immersive',
    pomodoros: '', mins: ' min',
    activeTask: 'Active task', clickToSelect: 'Click to link a task',
  };

  const p = usePomodoro();
  const [showSettings, setShowSettings] = useState(false);
  const [newTask, setNewTask] = useState('');

  // Active task
  const activeTask = useMemo(() => p.tasks.find((t) => t.id === p.activeTaskId), [p.tasks, p.activeTaskId]);

  // Request notification permission on mount
  useEffect(() => { p.requestNotifications(); }, []);

  // Phase info
  const phaseInfo = {
    focus: { label: T.focus, color: 'var(--color-accent)', bg: 'var(--color-accent-glow)', icon: Brain },
    shortBreak: { label: T.shortBreak, color: '#10b981', bg: 'rgba(16, 185, 129, 0.12)', icon: Coffee },
    longBreak: { label: T.longBreak, color: '#0ea5e9', bg: 'rgba(14, 165, 233, 0.12)', icon: Coffee },
  }[p.phase];

  // Format time
  const mm = Math.floor(p.remaining / 60).toString().padStart(2, '0');
  const ss = (p.remaining % 60).toString().padStart(2, '0');
  const totalSec = p.phase === 'focus' ? p.settings.focusMinutes * 60 : p.phase === 'shortBreak' ? p.settings.shortBreakMinutes * 60 : p.settings.longBreakMinutes * 60;
  const progress = 1 - p.remaining / totalSec;

  // SVG circle
  const R = 130;
  const C = 2 * Math.PI * R;

  // Last 7 days stats
  const last7 = useMemo(() => {
    const out: { date: string; label: string; pomodoros: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const stat = p.stats.find((s) => s.date === dateStr);
      out.push({
        date: dateStr,
        label: ['日', '一', '二', '三', '四', '五', '六'][d.getDay()],
        pomodoros: stat?.pomodoros || 0,
      });
    }
    return out;
  }, [p.stats]);
  const maxDay = Math.max(1, ...last7.map((d) => d.pomodoros));

  // Immersive
  if (p.immersive) return <ImmersiveView p={p} phaseInfo={phaseInfo} mm={mm} ss={ss} progress={progress} C={C} R={R} lang={lang} T={T} />;

  return (
    <div className="grid grid-cols-[420px_1fr] h-full">
      {/* ─────── Left: Tasks ─────── */}
      <div className="flex flex-col" style={{ borderRight: '1px solid var(--color-border)' }}>
        <div className="p-5 pb-3" style={{ borderBottom: '1px solid var(--color-border)' }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[14px] font-semibold" style={{ color: 'var(--color-text-primary)' }}>{T.tasks}</h3>
            <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--color-border)', color: 'var(--color-text-muted)' }}>
              {p.tasks.filter((t) => !t.completed).length}
            </span>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={newTask}
              onChange={(e) => setNewTask(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && newTask.trim()) { p.addTask(newTask); setNewTask(''); } }}
              placeholder={T.addTask}
              className="flex-1 h-9 px-3 rounded-lg text-[13px] outline-none"
              style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
              onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--color-accent)'; e.currentTarget.style.boxShadow = '0 0 0 3px var(--color-accent-glow)'; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.boxShadow = 'none'; }}
            />
            <ConfirmButton onClick={() => { if (newTask.trim()) { p.addTask(newTask); setNewTask(''); } }} icon={Plus} size="sm" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
          {p.tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-8">
              <Target size={32} style={{ color: 'var(--color-text-muted)' }} />
              <p className="text-[12px] mt-3" style={{ color: 'var(--color-text-muted)' }}>{T.noTasks}</p>
            </div>
          ) : p.tasks.map((task) => (
            <TaskItem
              key={task.id}
              task={task}
              active={p.activeTaskId === task.id}
              onSelect={() => p.setActiveTaskId(p.activeTaskId === task.id ? null : task.id)}
              onToggle={() => p.toggleTaskComplete(task.id)}
              onDelete={() => p.deleteTask(task.id)}
              lang={lang}
            />
          ))}
        </div>
      </div>

      {/* ─────── Right: Timer + Stats ─────── */}
      <div className="flex flex-col overflow-y-auto">
        {/* Phase tabs */}
        <div className="px-6 pt-5 pb-3 flex items-center gap-2">
          {(['focus', 'shortBreak', 'longBreak'] as Phase[]).map((ph) => {
            const info = {
              focus: { label: T.focus, color: 'var(--color-accent)' },
              shortBreak: { label: T.shortBreak, color: '#10b981' },
              longBreak: { label: T.longBreak, color: '#0ea5e9' },
            }[ph];
            const active = p.phase === ph;
            return (
              <button
                key={ph}
                onClick={() => { p.setPhase(ph); p.pause(); }}
                className="h-8 px-3.5 rounded-lg text-[12px] font-medium transition-all"
                style={{
                  background: active ? info.color : 'var(--color-bg-card)',
                  color: active ? '#0a0a0c' : 'var(--color-text-secondary)',
                  border: `1px solid ${active ? info.color : 'var(--color-border)'}`,
                }}
              >
                {info.label}
              </button>
            );
          })}
          <div className="ml-auto flex items-center gap-1.5">
            <button
              onClick={() => p.setImmersive(true)}
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
              style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}
              title={T.immersive}
            >
              <Maximize2 size={14} />
            </button>
            <button
              onClick={() => setShowSettings(true)}
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
              style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}
              title={T.settings}
            >
              <SettingsIcon size={14} />
            </button>
          </div>
        </div>

        {/* Active task pill */}
        <div className="px-6 pb-3">
          {activeTask ? (
            <div className="rounded-lg px-3 py-2 flex items-center gap-2" style={{ background: 'var(--color-accent-glow)', border: '1px solid var(--color-accent)' }}>
              <Target size={13} style={{ color: 'var(--color-accent)' }} />
              <span className="text-[12px] font-medium truncate flex-1" style={{ color: 'var(--color-text-primary)' }}>{activeTask.title}</span>
              <span className="text-[10px] font-mono" style={{ color: 'var(--color-accent)' }}>
                {activeTask.pomodorosCompleted} 🍅 · {Math.round(activeTask.totalFocusedSec / 60)}m
              </span>
            </div>
          ) : (
            <div className="rounded-lg px-3 py-2 text-center" style={{ background: 'var(--color-bg-card)', border: '1px dashed var(--color-border)' }}>
              <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>{T.clickToSelect}</p>
            </div>
          )}
        </div>

        {/* Timer ring */}
        <div className="flex-1 flex flex-col items-center justify-center px-6">
          <div className="relative" style={{ width: 320, height: 320 }}>
            <svg width="320" height="320" className="-rotate-90">
              <circle cx="160" cy="160" r={R} fill="none" stroke="var(--color-border)" strokeWidth="8" />
              <circle
                cx="160" cy="160" r={R}
                fill="none"
                stroke={phaseInfo.color}
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={C}
                strokeDashoffset={C * (1 - progress)}
                style={{ transition: 'stroke-dashoffset 0.5s linear, stroke 0.4s ease' }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="text-[10px] uppercase tracking-widest font-semibold mb-1" style={{ color: phaseInfo.color }}>
                {phaseInfo.label}
              </div>
              <div className="text-7xl font-light tabular-nums tracking-tight" style={{ color: 'var(--color-text-primary)' }}>
                {mm}<span className="opacity-30">:</span>{ss}
              </div>
              <div className="text-[11px] mt-2" style={{ color: 'var(--color-text-muted)' }}>
                {T.cycle} {p.cycleCount + 1} / {p.settings.cyclesUntilLongBreak}
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2 mt-6">
            <Button variant="ghost" onClick={p.reset} icon={RotateCcw}>{T.reset}</Button>
            <button
              onClick={p.toggle}
              className="w-16 h-16 rounded-full flex items-center justify-center transition-all"
              style={{
                background: phaseInfo.color,
                boxShadow: `0 4px 24px ${phaseInfo.color}40`,
              }}
            >
              {p.running ? <Pause size={26} fill="white" stroke="white" /> : <Play size={26} fill="#0a0a0c" stroke="#0a0a0c" className="ml-1" />}
            </button>
            <Button variant="ghost" onClick={p.skip} icon={SkipForward}>{T.skip}</Button>
          </div>
        </div>

        {/* Bottom: stats + white noise */}
        <div className="px-6 pb-6 pt-3 grid grid-cols-2 gap-3">
          {/* Today stats */}
          <div className="rounded-xl p-4" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
            <p className="text-[10px] font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--color-text-muted)' }}>{T.today}</p>
            <div className="grid grid-cols-2 gap-3">
              <Stat icon={Flame} label={T.finishedPomodoros} value={String(p.todayStat.pomodoros)} color="var(--color-accent)" />
              <Stat icon={Clock} label={T.focused} value={`${Math.round(p.todayStat.focusedSec / 60)}${T.mins}`} color="#10b981" />
            </div>
            {/* 7-day chart */}
            <div className="mt-3 flex items-end gap-1 h-12">
              {last7.map((d, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                  <div
                    className="w-full rounded-t transition-all"
                    style={{
                      height: `${(d.pomodoros / maxDay) * 100}%`,
                      minHeight: d.pomodoros > 0 ? 4 : 2,
                      background: d.pomodoros > 0 ? 'var(--color-accent)' : 'var(--color-border)',
                    }}
                  />
                  <span className="text-[9px]" style={{ color: 'var(--color-text-muted)' }}>{d.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* White noise + toggles */}
          <div className="rounded-xl p-4" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
            <p className="text-[10px] font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--color-text-muted)' }}>{T.whiteNoise}</p>
            <div className="grid grid-cols-4 gap-1.5">
              {([
                { v: 'none', l: T.none, icon: VolumeX },
                { v: 'rain', l: T.rain, icon: CloudRain },
                { v: 'forest', l: T.forest, icon: TreePine },
                { v: 'cafe', l: T.cafe, icon: Coffee },
              ] as const).map((o) => (
                <button
                  key={o.v}
                  onClick={() => p.setSettings({ ...p.settings, whiteNoise: o.v as any })}
                  className="h-14 rounded-lg flex flex-col items-center justify-center gap-1 transition-all"
                  style={{
                    background: p.settings.whiteNoise === o.v ? 'var(--color-accent-glow)' : 'var(--color-bg-main)',
                    border: `1px solid ${p.settings.whiteNoise === o.v ? 'var(--color-accent)' : 'var(--color-border)'}`,
                    color: p.settings.whiteNoise === o.v ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                  }}
                >
                  <o.icon size={14} />
                  <span className="text-[9px]">{o.l}</span>
                </button>
              ))}
            </div>
            <div className="mt-3 space-y-2">
              <SmallToggle
                icon={p.settings.soundEnabled ? Volume2 : VolumeX}
                label={T.sound}
                checked={p.settings.soundEnabled}
                onChange={(v) => p.setSettings({ ...p.settings, soundEnabled: v })}
              />
              <SmallToggle
                icon={p.settings.notificationsEnabled ? Bell : BellOff}
                label={T.notif}
                checked={p.settings.notificationsEnabled}
                onChange={(v) => p.setSettings({ ...p.settings, notificationsEnabled: v })}
              />
            </div>
          </div>
        </div>

        {/* Shortcut hint */}
        <div className="px-6 pb-3 flex items-center justify-center gap-3 text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
          <span><kbd className="px-1 py-0.5 rounded" style={{ background: 'var(--color-border)' }}>Space</kbd> {T.kbSpace.replace('Space ', '')}</span>
          <span><kbd className="px-1 py-0.5 rounded" style={{ background: 'var(--color-border)' }}>R</kbd> {T.kbR.replace('R ', '')}</span>
          <span><kbd className="px-1 py-0.5 rounded" style={{ background: 'var(--color-border)' }}>S</kbd> {T.kbS.replace('S ', '')}</span>
          <span><kbd className="px-1 py-0.5 rounded" style={{ background: 'var(--color-border)' }}>F</kbd> {T.kbF.replace('F ', '')}</span>
        </div>
      </div>

      {/* Settings modal */}
      {showSettings && (
        <SettingsModal p={p} onClose={() => setShowSettings(false)} lang={lang} T={T} />
      )}
    </div>
  );
}

/* ─────────── Task Item ─────────── */
function TaskItem({ task, active, onSelect, onToggle, onDelete, lang }: {
  task: Task; active: boolean; onSelect: () => void; onToggle: () => void; onDelete: () => void; lang: 'zh' | 'en';
}) {
  const [confirmDel, setConfirmDel] = useState(false);

  return (
    <div
      className="rounded-lg p-3 transition-all"
      style={{
        background: active ? 'var(--color-accent-glow)' : 'var(--color-bg-card)',
        border: `1px solid ${active ? 'var(--color-accent)' : 'var(--color-border)'}`,
        opacity: task.completed ? 0.55 : 1,
      }}
    >
      <div className="flex items-center gap-2">
        <button
          onClick={onToggle}
          className="w-4 h-4 rounded flex items-center justify-center shrink-0 transition-all"
          style={{
            background: task.completed ? 'var(--color-accent)' : 'transparent',
            border: `1.5px solid ${task.completed ? 'var(--color-accent)' : 'var(--color-border-light)'}`,
          }}
        >
          {task.completed && <Check size={11} strokeWidth={3} style={{ color: '#0a0a0c' }} />}
        </button>
        <button onClick={onSelect} className="flex-1 min-w-0 text-left">
          <p
            className="text-[13px] font-medium truncate"
            style={{
              color: 'var(--color-text-primary)',
              textDecoration: task.completed ? 'line-through' : 'none',
            }}
          >
            {task.title}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] flex items-center gap-0.5" style={{ color: 'var(--color-text-muted)' }}>
              <Flame size={9} />{task.pomodorosCompleted}
            </span>
            <span className="text-[10px] flex items-center gap-0.5" style={{ color: 'var(--color-text-muted)' }}>
              <Clock size={9} />{Math.round(task.totalFocusedSec / 60)}m
            </span>
            {active && <span className="text-[10px] font-semibold" style={{ color: 'var(--color-accent)' }}>● {lang === 'en' ? 'Active' : '进行中'}</span>}
          </div>
        </button>
        {confirmDel ? (
          <div className="flex items-center gap-1">
            <button onClick={onDelete} className="w-6 h-6 rounded flex items-center justify-center" style={{ background: 'rgba(239, 68, 68, 0.15)', color: 'var(--color-warning)' }}>
              <Check size={12} />
            </button>
            <button onClick={() => setConfirmDel(false)} className="w-6 h-6 rounded flex items-center justify-center" style={{ color: 'var(--color-text-muted)' }}>
              <X size={12} />
            </button>
          </div>
        ) : (
          <button onClick={() => setConfirmDel(true)} className="w-6 h-6 rounded flex items-center justify-center opacity-40 hover:opacity-100 transition-opacity" style={{ color: 'var(--color-text-muted)' }}>
            <Trash2 size={12} />
          </button>
        )}
      </div>
    </div>
  );
}

/* ─────────── Stat ─────────── */
function Stat({ icon: Icon, label, value, color }: any) {
  return (
    <div>
      <div className="flex items-center gap-1 mb-0.5">
        <Icon size={10} style={{ color }} />
        <span className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>{label}</span>
      </div>
      <p className="text-[20px] font-semibold" style={{ color: 'var(--color-text-primary)' }}>{value}</p>
    </div>
  );
}

/* ─────────── Small Toggle ─────────── */
function SmallToggle({ icon: Icon, label, checked, onChange }: { icon: any; label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className="w-full flex items-center justify-between text-[11px]"
      style={{ color: 'var(--color-text-secondary)' }}
    >
      <span className="flex items-center gap-1.5">
        <Icon size={11} />
        {label}
      </span>
      <span
        className="w-7 h-4 rounded-full relative transition-colors"
        style={{ background: checked ? 'var(--color-accent)' : 'var(--color-border)' }}
      >
        <span
          className="absolute top-0.5 w-3 h-3 rounded-full transition-all"
          style={{ left: checked ? '14px' : '2px', background: '#fff' }}
        />
      </span>
    </button>
  );
}

/* ─────────── Immersive View ─────────── */
function ImmersiveView({ p, phaseInfo, mm, ss, progress, C, R, lang, T }: any) {
  return (
    <div
      className="h-full w-full flex flex-col items-center justify-center relative"
      style={{ background: 'var(--color-bg-deep)' }}
      onClick={p.toggle}
    >
      <div className="absolute top-4 right-4 text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
        {T.exit}
      </div>
      <div className="absolute top-4 left-4 text-[11px] flex items-center gap-2" style={{ color: 'var(--color-text-muted)' }}>
        {phaseInfo.label} · {T.cycle} {p.cycleCount + 1}
      </div>
      {p.tasks.find((t: Task) => t.id === p.activeTaskId) && (
        <div className="absolute top-12 left-1/2 -translate-x-1/2 text-[14px] font-medium" style={{ color: 'var(--color-text-secondary)' }}>
          {p.tasks.find((t: Task) => t.id === p.activeTaskId)?.title}
        </div>
      )}
      <div className="relative" style={{ width: 360, height: 360 }}>
        <svg width="360" height="360" className="-rotate-90">
          <circle cx="180" cy="180" r={R} fill="none" stroke="var(--color-border)" strokeWidth="6" />
          <circle
            cx="180" cy="180" r={R}
            fill="none"
            stroke={phaseInfo.color}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={C * (1 - progress)}
            style={{ transition: 'stroke-dashoffset 0.5s linear' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-9xl font-light tabular-nums tracking-tight" style={{ color: 'var(--color-text-primary)' }}>
            {mm}<span className="opacity-30">:</span>{ss}
          </div>
        </div>
      </div>
      <p className="mt-6 text-[12px]" style={{ color: 'var(--color-text-muted)' }}>
        {p.running ? (lang === 'en' ? 'Click anywhere to pause' : '点击任意位置暂停') : (lang === 'en' ? 'Click anywhere to start' : '点击任意位置开始')}
      </p>
    </div>
  );
}

/* ─────────── Settings Modal ─────────── */
function SettingsModal({ p, onClose, lang, T }: any) {
  const [local, setLocal] = useState(p.settings);
  const save = () => { p.setSettings(local); onClose(); };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0, 0, 0, 0.5)', backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[480px] max-w-[92vw] rounded-2xl p-6"
        style={{ background: 'var(--color-bg-main)', border: '1px solid var(--color-border)', boxShadow: '0 16px 48px rgba(0, 0, 0, 0.5)' }}
      >
        <h2 className="text-[16px] font-semibold mb-5" style={{ color: 'var(--color-text-primary)' }}>{T.settings}</h2>
        <div className="space-y-4">
          <NumField
            label={lang === 'en' ? 'Focus duration' : '专注时长'}
            suffix={T.mins}
            value={local.focusMinutes}
            min={1} max={90}
            onChange={(v) => setLocal({ ...local, focusMinutes: v })}
          />
          <NumField
            label={lang === 'en' ? 'Short break' : '短休息'}
            suffix={T.mins}
            value={local.shortBreakMinutes}
            min={1} max={30}
            onChange={(v) => setLocal({ ...local, shortBreakMinutes: v })}
          />
          <NumField
            label={lang === 'en' ? 'Long break' : '长休息'}
            suffix={T.mins}
            value={local.longBreakMinutes}
            min={1} max={60}
            onChange={(v) => setLocal({ ...local, longBreakMinutes: v })}
          />
          <NumField
            label={lang === 'en' ? 'Cycles until long break' : '几轮后长休息'}
            suffix={lang === 'en' ? 'cycles' : '轮'}
            value={local.cyclesUntilLongBreak}
            min={2} max={10}
            onChange={(v) => setLocal({ ...local, cyclesUntilLongBreak: v })}
          />
          <div className="space-y-2 pt-2 border-t" style={{ borderColor: 'var(--color-border)' }}>
            <SmallToggle icon={Coffee} label={T.autoBreak} checked={local.autoStartBreaks} onChange={(v) => setLocal({ ...local, autoStartBreaks: v })} />
            <SmallToggle icon={Brain} label={T.autoFocus} checked={local.autoStartFocus} onChange={(v) => setLocal({ ...local, autoStartFocus: v })} />
            <SmallToggle icon={Volume2} label={T.sound} checked={local.soundEnabled} onChange={(v) => setLocal({ ...local, soundEnabled: v })} />
            <SmallToggle icon={Bell} label={T.notif} checked={local.notificationsEnabled} onChange={(v) => setLocal({ ...local, notificationsEnabled: v })} />
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <CancelButton onClick={onClose}>{lang === 'en' ? 'Cancel' : '取消'}</CancelButton>
          <ConfirmButton onClick={save}>{lang === 'en' ? 'Save' : '保存'}</ConfirmButton>
        </div>
      </div>
    </div>
  );
}

function NumField({ label, suffix, value, min, max, onChange }: { label: string; suffix: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[13px]" style={{ color: 'var(--color-text-primary)' }}>{label}</span>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onChange(Math.max(min, value - 1))}
          className="w-7 h-7 rounded-md flex items-center justify-center"
          style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}
        >−</button>
        <span className="w-14 text-center text-[14px] font-semibold tabular-nums" style={{ color: 'var(--color-text-primary)' }}>
          {value}<span className="text-[10px] ml-0.5" style={{ color: 'var(--color-text-muted)' }}>{suffix}</span>
        </span>
        <button
          onClick={() => onChange(Math.min(max, value + 1))}
          className="w-7 h-7 rounded-md flex items-center justify-center"
          style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}
        >+</button>
      </div>
    </div>
  );
}
