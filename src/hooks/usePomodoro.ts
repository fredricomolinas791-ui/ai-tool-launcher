import { useState, useEffect, useRef, useCallback } from 'react';

/* ─────────── Types ─────────── */
export type Phase = 'focus' | 'shortBreak' | 'longBreak';

export interface Task {
  id: string;
  title: string;
  notes?: string;
  completed: boolean;
  createdAt: number;
  totalFocusedSec: number;
  pomodorosCompleted: number;
}

export interface Settings {
  focusMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  cyclesUntilLongBreak: number;
  autoStartBreaks: boolean;
  autoStartFocus: boolean;
  soundEnabled: boolean;
  notificationsEnabled: boolean;
  whiteNoise: 'none' | 'rain' | 'forest' | 'cafe';
  whiteNoiseVolume: number;
}

export interface DailyStat {
  date: string; // YYYY-MM-DD
  pomodoros: number;
  focusedSec: number;
}

const TASKS_KEY = 'ai-tools-launcher.pomodoro.tasks.v1';
const SETTINGS_KEY = 'ai-tools-launcher.pomodoro.settings.v1';
const STATS_KEY = 'ai-tools-launcher.pomodoro.stats.v1';

const DEFAULT_SETTINGS: Settings = {
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  cyclesUntilLongBreak: 4,
  autoStartBreaks: true,
  autoStartFocus: false,
  soundEnabled: true,
  notificationsEnabled: true,
  whiteNoise: 'none',
  whiteNoiseVolume: 0.4,
};

/* ─────────── Persistence helpers ─────────── */
function loadTasks(): Task[] {
  try { const r = localStorage.getItem(TASKS_KEY); if (r) return JSON.parse(r); } catch {}
  return [];
}
function saveTasks(t: Task[]) { try { localStorage.setItem(TASKS_KEY, JSON.stringify(t)); } catch {} }

function loadSettings(): Settings {
  try { const r = localStorage.getItem(SETTINGS_KEY); if (r) return { ...DEFAULT_SETTINGS, ...JSON.parse(r) }; } catch {}
  return DEFAULT_SETTINGS;
}
function saveSettings(s: Settings) { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch {} }

function loadStats(): DailyStat[] {
  try { const r = localStorage.getItem(STATS_KEY); if (r) return JSON.parse(r); } catch {}
  return [];
}
function saveStats(s: DailyStat[]) { try { localStorage.setItem(STATS_KEY, JSON.stringify(s)); } catch {} }

/* ─────────── Web Audio engine ─────────── */
class AudioEngine {
  ctx: AudioContext | null = null;
  nodes: AudioNode[] = [];
  gainNode: GainNode | null = null;
  intervalId: number | null = null;

  ensure() {
    if (!this.ctx) {
      try { this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)(); } catch { return; }
    }
    if (this.ctx?.state === 'suspended') this.ctx.resume();
  }

  /* Pleasant completion "ding" — three sine tones */
  playDing() {
    this.ensure();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const tones = [880, 1108, 1318]; // A5, C#6, E6
    tones.forEach((freq, i) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const t0 = now + i * 0.12;
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(0.18, t0 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.5);
      osc.connect(gain).connect(this.ctx!.destination);
      osc.start(t0);
      osc.stop(t0 + 0.55);
    });
  }

  /* Phase transition — soft "whoosh" with white noise burst */
  playWhoosh() {
    this.ensure();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const bufferSize = this.ctx.sampleRate * 0.6;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      const t = i / bufferSize;
      data[i] = (Math.random() * 2 - 1) * (1 - t) * 0.25;
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1200;
    filter.Q.value = 0.6;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.15, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);
    src.connect(filter).connect(gain).connect(this.ctx.destination);
    src.start(now);
  }

  /* Tick on every second while timer running — gentle keyboard-click (volume ~0) */
  playTick() {
    this.ensure();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = 1800;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.012, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.05);
  }

  /* White noise generator for ambient */
  startWhiteNoise(type: 'rain' | 'forest' | 'cafe', volume: number) {
    this.stopWhiteNoise();
    this.ensure();
    if (!this.ctx) return;
    const ctx = this.ctx;
    this.gainNode = ctx.createGain();
    this.gainNode.gain.value = volume;
    this.gainNode.connect(ctx.destination);

    if (type === 'rain') {
      // Filtered noise (low-pass) to simulate rain
      const bufSize = ctx.sampleRate * 2;
      const buffer = ctx.createBuffer(1, bufSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 2500;
      filter.Q.value = 0.5;
      src.connect(filter).connect(this.gainNode);
      src.start();
      this.nodes.push(src, filter);
    } else if (type === 'forest') {
      // Pink-ish noise + occasional chirp simulation
      const bufSize = ctx.sampleRate * 2;
      const buffer = ctx.createBuffer(1, bufSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < bufSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99765 * b0 + white * 0.0990460;
        b1 = 0.96300 * b1 + white * 0.2965164;
        b2 = 0.57000 * b2 + white * 1.0526913;
        data[i] = (b0 + b1 + b2 + white * 0.1848) * 0.15;
      }
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;
      src.connect(this.gainNode);
      src.start();
      this.nodes.push(src);
    } else if (type === 'cafe') {
      // Brown noise for cafe murmur
      const bufSize = ctx.sampleRate * 2;
      const buffer = ctx.createBuffer(1, bufSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      let last = 0;
      for (let i = 0; i < bufSize; i++) {
        const white = Math.random() * 2 - 1;
        last = (last + 0.02 * white) / 1.02;
        data[i] = last * 3.5;
      }
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 500;
      filter.Q.value = 0.3;
      src.connect(filter).connect(this.gainNode);
      src.start();
      this.nodes.push(src, filter);
    }
  }

  stopWhiteNoise() {
    this.nodes.forEach((n) => { try { (n as any).stop?.(); } catch {} });
    this.nodes = [];
    if (this.gainNode) { try { this.gainNode.disconnect(); } catch {} }
    this.gainNode = null;
  }

  setVolume(v: number) {
    if (this.gainNode) this.gainNode.gain.value = v;
  }
}

/* ─────────── Hook ─────────── */
export function usePomodoro() {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [tasks, setTasks] = useState<Task[]>(loadTasks);
  const [stats, setStats] = useState<DailyStat[]>(loadStats);

  const [phase, setPhase] = useState<Phase>('focus');
  const [cycleCount, setCycleCount] = useState(0);
  const [remaining, setRemaining] = useState(settings.focusMinutes * 60);
  const [running, setRunning] = useState(false);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [immersive, setImmersive] = useState(false);

  const audioRef = useRef<AudioEngine>(new AudioEngine());
  const tickRef = useRef<number | null>(null);
  const lastTickRef = useRef<number>(-1);

  // Persist
  useEffect(() => { saveSettings(settings); }, [settings]);
  useEffect(() => { saveTasks(tasks); }, [tasks]);
  useEffect(() => { saveStats(stats); }, [stats]);

  // White noise control
  useEffect(() => {
    if (running && phase === 'focus' && settings.whiteNoise !== 'none') {
      audioRef.current.startWhiteNoise(settings.whiteNoise, settings.whiteNoiseVolume);
    } else {
      audioRef.current.stopWhiteNoise();
    }
    return () => { audioRef.current.stopWhiteNoise(); };
  }, [running, phase, settings.whiteNoise, settings.whiteNoiseVolume]);

  // Phase duration
  const phaseDuration = (): number => {
    if (phase === 'focus') return settings.focusMinutes * 60;
    if (phase === 'shortBreak') return settings.shortBreakMinutes * 60;
    return settings.longBreakMinutes * 60;
  };

  const resetPhase = useCallback(() => {
    setRemaining(phaseDuration());
    lastTickRef.current = -1;
  }, [phase, settings]);

  // Switch to next phase
  const advancePhase = useCallback(() => {
    audioRef.current.playDing();
    audioRef.current.playWhoosh();

    if (phase === 'focus') {
      // Log completion
      const today = new Date().toISOString().slice(0, 10);
      setStats((prev) => {
        const idx = prev.findIndex((s) => s.date === today);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = { ...next[idx], pomodoros: next[idx].pomodoros + 1, focusedSec: next[idx].focusedSec + settings.focusMinutes * 60 };
          return next;
        }
        return [...prev, { date: today, pomodoros: 1, focusedSec: settings.focusMinutes * 60 }];
      });
      // Update active task
      if (activeTaskId) {
        setTasks((prev) => prev.map((t) => t.id === activeTaskId
          ? { ...t, totalFocusedSec: t.totalFocusedSec + settings.focusMinutes * 60, pomodorosCompleted: t.pomodorosCompleted + 1 }
          : t
        ));
      }
      const nextCount = cycleCount + 1;
      setCycleCount(nextCount);
      const isLong = nextCount % settings.cyclesUntilLongBreak === 0;
      const next: Phase = isLong ? 'longBreak' : 'shortBreak';
      setPhase(next);
      setRemaining((isLong ? settings.longBreakMinutes : settings.shortBreakMinutes) * 60);
      if (settings.notificationsEnabled) {
        notify('专注完成!', isLong ? '开始长休息 15 分钟' : '开始短休息 5 分钟');
      }
      if (settings.autoStartBreaks) {
        setRunning(true);
      } else {
        setRunning(false);
      }
    } else {
      // Break finished → back to focus
      setPhase('focus');
      setRemaining(settings.focusMinutes * 60);
      if (settings.notificationsEnabled) {
        notify('休息结束', '开始下一轮专注');
      }
      if (settings.autoStartFocus) {
        setRunning(true);
      } else {
        setRunning(false);
      }
    }
    lastTickRef.current = -1;
  }, [phase, cycleCount, settings, activeTaskId]);

  // Timer tick — 纯递减,不在 updater 里触发任何副作用。
  // 之前是 `setRemaining((r) => { if (r <= 1) { setTimeout(advancePhase, 0); return 0 } return r-1 })`
  // 嵌套副作用 —— Strict Mode 下 setRemaining 的 updater 会被双调,
  // setTimeout 会被排两个、advancePhase 跑两次,导致 cycle 翻倍、
  // 统计翻倍、通知发两次、phase 跳两步。
  // 改成纯递减 + 下面单独的 useEffect 观察 remaining 命中 0。
  useEffect(() => {
    if (!running) {
      if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
      return;
    }
    tickRef.current = window.setInterval(() => {
      setRemaining((r) => Math.max(0, r - 1));
    }, 1000);
    return () => { if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; } };
  }, [running]);

  // 倒计时归零时推进 phase —— 写成独立 effect,advancePhase 只会被调一次。
  // advancePhase 会立即把 remaining 重置成大数,所以这个 effect 不会重入。
  useEffect(() => {
    if (running && remaining === 0) {
      advancePhase();
    }
  }, [remaining, running, advancePhase]);

  // Final tick +30s sound (last 3 seconds tick)
  useEffect(() => {
    if (!running) return;
    if (remaining <= 3 && remaining > 0 && remaining !== lastTickRef.current) {
      lastTickRef.current = remaining;
      if (settings.soundEnabled) audioRef.current.playTick();
    }
  }, [remaining, running, settings.soundEnabled]);

  // Document title
  useEffect(() => {
    const mm = Math.floor(remaining / 60);
    const ss = (remaining % 60).toString().padStart(2, '0');
    const label = phase === 'focus' ? '专注' : phase === 'shortBreak' ? '短休息' : '长休息';
    document.title = running ? `${mm}:${ss} · ${label} · 番茄钟` : 'AI Tools Launcher';
  }, [remaining, running, phase]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (immersive) {
        if (e.key === 'Escape') { e.preventDefault(); setImmersive(false); }
        return;
      }
      // Don't intercept while typing
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === ' ') { e.preventDefault(); setRunning((r) => !r); }
      if (e.key === 'r' || e.key === 'R') { e.preventDefault(); resetPhase(); setRunning(false); }
      if (e.key === 's' || e.key === 'S') { e.preventDefault(); advancePhase(); }
      if (e.key === 'f' || e.key === 'F') { e.preventDefault(); setImmersive((v) => !v); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [advancePhase, resetPhase, immersive]);

  // Notifications
  function notify(title: string, body: string) {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body, icon: '/favicon.ico' });
    }
  }

  // Task operations
  const addTask = (title: string, notes?: string) => {
    if (!title.trim()) return;
    const t: Task = {
      id: 't_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      title: title.trim(),
      notes: notes?.trim(),
      completed: false,
      createdAt: Date.now(),
      totalFocusedSec: 0,
      pomodorosCompleted: 0,
    };
    setTasks((prev) => [t, ...prev]);
  };
  const updateTask = (id: string, patch: Partial<Task>) => {
    setTasks((prev) => prev.map((t) => t.id === id ? { ...t, ...patch } : t));
  };
  const deleteTask = (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    if (activeTaskId === id) setActiveTaskId(null);
  };
  const toggleTaskComplete = (id: string) => {
    setTasks((prev) => prev.map((t) => t.id === id ? { ...t, completed: !t.completed } : t));
  };

  // Total today
  const today = new Date().toISOString().slice(0, 10);
  const todayStat = stats.find((s) => s.date === today) || { date: today, pomodoros: 0, focusedSec: 0 };

  return {
    // state
    settings, setSettings,
    tasks, addTask, updateTask, deleteTask, toggleTaskComplete,
    stats, todayStat,
    phase, setPhase,
    cycleCount,
    remaining, running,
    activeTaskId, setActiveTaskId,
    immersive, setImmersive,
    // controls
    start: () => setRunning(true),
    pause: () => setRunning(false),
    toggle: () => setRunning((r) => !r),
    reset: () => { setRunning(false); resetPhase(); },
    skip: advancePhase,
    requestNotifications: async () => {
      if ('Notification' in window && Notification.permission === 'default') {
        await Notification.requestPermission();
      }
    },
  };
}
