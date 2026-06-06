/* ═══════════════════════════════════════════════════════════════════
   AUDIO TOOLS — 5 tools
   - 27: 文字转语音 (TTS) — Web Speech + OpenAI
   - 28: 语音转文字 (ASR) — Web Speech Recognition + Whisper
   - 29: AI 歌曲创作 — melody generator + Web Audio
   - 30: 音色克隆 — needs OpenAI TTS, basic
   - 31: 背景降噪 — Web Audio spectral subtraction
   - 32: 音效制作 — preset-based generator
   - 33: 有声书合成 — long-form TTS
   - 34: 语音翻译 — demo
   ═══════════════════════════════════════════════════════════════════ */

import { useState, useRef, useEffect } from 'react';
import {
  Volume2, Mic, Music, User, VolumeX, Sparkles, BookOpen, Languages, Play, Square, Loader2,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useI18n } from '../../hooks/useI18n';
import { Button, ConfirmButton } from '../ui/Button';
import { useAI } from '../../hooks/useAI';
import { ttsOpenAI, asrWhisper, listBrowserVoices, ttsBrowser, stopBrowserTTS } from '../../lib/ai';

/* ════════════════════════════════════════════════════════════════════
   27. 文字转语音
   ════════════════════════════════════════════════════════════════════ */

export function TTSTool() {
  const { lang: _l } = useI18n(); void _l;
  const ai = useAI();
  const [text, setText] = useState('你好,这是一段测试语音,用来展示文字转语音功能。');
  const [engine, setEngine] = useState<'browser' | 'openai'>('browser');
  const [voice, setVoice] = useState('');
  const [speed, setSpeed] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    setVoices(listBrowserVoices());
  }, []);

  const play = async () => {
    if (!text.trim()) return;
    setPlaying(true);
    if (engine === 'browser') {
      try { await ttsBrowser(text, { voice, rate: speed }); } catch {}
      setPlaying(false);
    } else {
      setLoading(true);
      try {
        const blob = await ttsOpenAI({ text, voice: (voice || 'alloy') as any, speed });
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio.onended = () => { setPlaying(false); URL.revokeObjectURL(url); };
        await audio.play();
      } catch (e) { setPlaying(false); }
      setLoading(false);
    }
  };

  const stop = () => {
    if (engine === 'browser') stopBrowserTTS();
    setPlaying(false);
  };

  return (
    <div className="grid grid-cols-[1fr_320px] h-full">
      <div className="p-6 flex flex-col">
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={10} className="flex-1 w-full p-3 rounded-lg text-[13px] outline-none resize-none" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)', lineHeight: 1.6 }} placeholder="输入要朗读的文字..." />
      </div>
      <div className="p-5 space-y-3 overflow-y-auto" style={{ borderLeft: '1px solid var(--color-border)', background: 'var(--color-bg-card)' }}>
        <div>
          <label className="text-[12px] mb-1 block" style={{ color: 'var(--color-text-secondary)' }}>引擎</label>
          <select value={engine} onChange={(e) => setEngine(e.target.value as any)} className="w-full h-8 px-2 rounded-lg text-[12px] outline-none" style={{ background: 'var(--color-bg-main)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}>
            <option value="browser">浏览器原生(免费)</option>
            <option value="openai" disabled={!ai.isConfigured}>OpenAI TTS (需 Key)</option>
          </select>
        </div>
        <div>
          <label className="text-[12px] mb-1 block" style={{ color: 'var(--color-text-secondary)' }}>{engine === 'browser' ? '声音' : 'AI 声音'}</label>
          {engine === 'browser' ? (
            <select value={voice} onChange={(e) => setVoice(e.target.value)} className="w-full h-8 px-2 rounded-lg text-[12px] outline-none" style={{ background: 'var(--color-bg-main)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}>
              <option value="">默认</option>
              {voices.filter((v, i, a) => a.findIndex((x) => x.name === v.name) === i).map((v) => <option key={v.name} value={v.name}>{v.name} ({v.lang})</option>)}
            </select>
          ) : (
            <select value={voice} onChange={(e) => setVoice(e.target.value)} className="w-full h-8 px-2 rounded-lg text-[12px] outline-none" style={{ background: 'var(--color-bg-main)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}>
              {['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'].map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          )}
        </div>
        <Slider label="语速" value={Math.round(speed * 100)} min={50} max={200} onChange={(v) => setSpeed(v / 100)} />
        <div className="flex gap-2">
          {!playing ? (
            <ConfirmButton onClick={play} icon={loading ? Loader2 : Play} fullWidth disabled={loading}>{loading ? '加载中...' : '播放'}</ConfirmButton>
          ) : (
            <Button onClick={stop} icon={Square} fullWidth variant="danger">停止</Button>
          )}
        </div>
      </div>
    </div>
  );
}

function Slider({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[12px]" style={{ color: 'var(--color-text-secondary)' }}>{label}</span>
        <span className="text-[11px] font-mono" style={{ color: 'var(--color-text-muted)' }}>{value}</span>
      </div>
      <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full" style={{ accentColor: 'var(--color-accent)' }} />
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   28. 语音转文字 (ASR) — MediaRecorder + Web Speech
   ════════════════════════════════════════════════════════════════════ */

export function ASRTool() {
  const { lang: _l } = useI18n(); void _l;
  const ai = useAI();
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recognitionRef = useRef<any>(null);

  const startBrowser = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { setError('浏览器不支持 SpeechRecognition,建议用 OpenAI Whisper'); return; }
    const r = new SR();
    r.lang = 'zh-CN';
    r.continuous = true;
    r.interimResults = true;
    r.onresult = (e: any) => {
      let text = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        text += e.results[i][0].transcript;
      }
      setTranscript(text);
    };
    r.onerror = (e: any) => setError(e.error);
    r.start();
    recognitionRef.current = r;
    setRecording(true);
  };

  const stopBrowser = () => {
    recognitionRef.current?.stop();
    setRecording(false);
  };

  const startWhisper = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      recRef.current = rec;
      chunksRef.current = [];
      rec.ondataavailable = (e) => chunksRef.current.push(e.data);
      rec.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        try {
          const text = await asrWhisper(blob);
          setTranscript(text);
        } catch (e: any) { setError(e.message); }
        stream.getTracks().forEach((t) => t.stop());
      };
      rec.start();
      setRecording(true);
    } catch (e: any) { setError('麦克风权限被拒绝'); }
  };

  const stopWhisper = () => {
    recRef.current?.stop();
    setRecording(false);
  };

  return (
    <div className="flex flex-col h-full p-6 max-w-3xl mx-auto w-full">
      <div className="rounded-xl p-6 text-center" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
        <button
          onClick={recording ? (ai.isConfigured ? stopWhisper : stopBrowser) : (ai.isConfigured ? startWhisper : startBrowser)}
          className="w-24 h-24 rounded-full mx-auto flex items-center justify-center transition-all"
          style={{
            background: recording ? '#ef4444' : 'var(--color-accent)',
            boxShadow: recording ? '0 0 0 12px rgba(239, 68, 68, 0.2)' : '0 4px 24px var(--color-accent-glow)',
          }}
        >
          {recording ? <Square size={32} fill="#fff" stroke="none" /> : <Mic size={32} strokeWidth={2} style={{ color: '#0a0a0c' }} />}
        </button>
        <p className="text-[14px] mt-4" style={{ color: 'var(--color-text-primary)' }}>
          {recording ? '正在录音...再次点击停止' : '点击开始录音'}
        </p>
        <p className="text-[11px] mt-1" style={{ color: 'var(--color-text-muted)' }}>
          {ai.isConfigured ? '使用 OpenAI Whisper (高质量)' : '使用浏览器原生识别(免费,Chrome/Edge)'}
        </p>
      </div>

      {error && (
        <div className="mt-4 rounded-lg p-3 flex items-start gap-2" style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid var(--color-warning)' }}>
          <p className="text-[12px]" style={{ color: '#fca5a5' }}>{error}</p>
        </div>
      )}

      <div className="mt-4 flex-1 rounded-xl p-4" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>转写结果</p>
          <Button variant="ghost" size="sm" onClick={() => navigator.clipboard?.writeText(transcript)}>复制</Button>
        </div>
        <p className="text-[14px] leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--color-text-primary)', minHeight: 100 }}>{transcript || <span style={{ color: 'var(--color-text-muted)' }}>语音转文字结果会显示在这里...</span>}</p>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   29. AI 歌曲创作 — Web Audio API melody generator
   ════════════════════════════════════════════════════════════════════ */

const SCALES: Record<string, number[]> = {
  major: [261.63, 293.66, 329.63, 349.23, 392.00, 440.00, 493.88, 523.25],
  minor: [261.63, 293.66, 311.13, 349.23, 392.00, 415.30, 466.16, 523.25],
  pentatonic: [261.63, 293.66, 329.63, 392.00, 440.00, 523.25],
};

const STYLES = {
  uplifting: { tempo: 120, scale: 'major' as const, pattern: [0, 2, 4, 2, 0, 4, 2, 0] },
  sad: { tempo: 70, scale: 'minor' as const, pattern: [4, 2, 0, 2, 4, 0, 4, 2] },
  energetic: { tempo: 140, scale: 'major' as const, pattern: [0, 4, 2, 5, 4, 2, 0, 4] },
  dreamy: { tempo: 80, scale: 'pentatonic' as const, pattern: [0, 2, 4, 2, 5, 4, 2, 0] },
};

export function SongComposerTool() {
  const { lang: _l } = useI18n(); void _l;
  const [style, setStyle] = useState<keyof typeof STYLES>('uplifting');
  const [duration, setDuration] = useState(16);
  const [playing, setPlaying] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const playRef = useRef<{ stop: () => void } | null>(null);

  const play = () => {
    if (playing) { playRef.current?.stop(); setPlaying(false); return; }
    const ctx = new AudioContext();
    audioCtxRef.current = ctx;
    const conf = STYLES[style];
    const scale = SCALES[conf.scale];
    const beat = 60 / conf.tempo;
    const note = (i: number, t: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = scale[conf.pattern[i % conf.pattern.length] % scale.length];
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.15, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + beat * 0.9);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + beat);
    };
    const startTime = ctx.currentTime + 0.1;
    for (let i = 0; i < duration; i++) {
      note(i, startTime + i * beat);
    }
    const stop = () => { ctx.close(); };
    const stopAt = startTime + duration * beat + 0.1;
    const interval = setTimeout(stop, (stopAt - ctx.currentTime) * 1000);
    playRef.current = { stop: () => { clearTimeout(interval); stop(); setPlaying(false); } };
    setPlaying(true);
  };

  return (
    <div className="grid grid-cols-[320px_1fr] h-full">
      <div className="p-5 space-y-3" style={{ borderRight: '1px solid var(--color-border)' }}>
        <div>
          <label className="text-[12px] mb-1 block" style={{ color: 'var(--color-text-secondary)' }}>风格</label>
          {Object.entries(STYLES).map(([k]) => (
            <button
              key={k}
              onClick={() => setStyle(k as any)}
              className="w-full text-left px-3 py-2 rounded-md text-[12px] mb-1"
              style={{
                background: style === k ? 'var(--color-accent-glow)' : 'var(--color-bg-card)',
                color: style === k ? 'var(--color-accent)' : 'var(--color-text-primary)',
                border: `1px solid ${style === k ? 'var(--color-accent)' : 'var(--color-border)'}`,
              }}
            >
              {k === 'uplifting' ? '☀️ 欢快' : k === 'sad' ? '🌧️ 忧伤' : k === 'energetic' ? '⚡ 动感' : '💭 梦幻'}
            </button>
          ))}
        </div>
        <Slider label="音符数" value={duration} min={8} max={64} onChange={(v) => setDuration(Math.round(v))} />
        <ConfirmButton onClick={play} icon={playing ? Square : Music} fullWidth>{playing ? '停止' : '播放'}</ConfirmButton>
      </div>
      <div className="p-6 flex items-center justify-center" style={{ background: 'var(--color-bg-deep)' }}>
        <div className="text-center max-w-md">
          <Music size={64} strokeWidth={1} style={{ color: 'var(--color-accent)' }} />
          <p className="text-[16px] font-semibold mt-4" style={{ color: 'var(--color-text-primary)' }}>Web Audio 合成器</p>
          <p className="text-[12px] mt-2" style={{ color: 'var(--color-text-muted)' }}>纯浏览器生成旋律,无需任何 AI 成本</p>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   30. 音色克隆 — 调用 OpenAI TTS 的 alloy/nova 等
   ════════════════════════════════════════════════════════════════════ */

export function VoiceCloneTool() {
  const { lang: _l } = useI18n(); void _l;
  const ai = useAI();
  const [text, setText] = useState('这是用 AI 语音合成的样例。');
  const [voice, setVoice] = useState('alloy');
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    if (!ai.isConfigured) return;
    setLoading(true);
    try {
      const blob = await ttsOpenAI({ text, voice });
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      setAudioUrl(URL.createObjectURL(blob));
    } catch (e: any) { alert(e.message); }
    setLoading(false);
  };

  return (
    <div className="flex flex-col h-full p-6 max-w-2xl mx-auto w-full">
      <div className="rounded-xl p-5 mb-4" style={{ background: 'var(--color-accent-glow)', border: '1px solid var(--color-accent)' }}>
        <p className="text-[13px]" style={{ color: 'var(--color-text-primary)' }}>
          💡 当前使用 OpenAI 提供的 6 种 AI 声音模拟"音色克隆"。
          完整音色克隆需上传参考音频给 ElevenLabs / OpenAI Voice Engine,本工具暂不支持。
        </p>
      </div>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} className="w-full p-3 rounded-lg text-[13px] outline-none resize-none mb-3" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }} />
      <select value={voice} onChange={(e) => setVoice(e.target.value)} className="w-full h-9 px-2 rounded-lg text-[12px] mb-3" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}>
        <option value="alloy">alloy (中性)</option>
        <option value="echo">echo (男声)</option>
        <option value="fable">fable (英式)</option>
        <option value="onyx">onyx (深沉)</option>
        <option value="nova">nova (女声)</option>
        <option value="shimmer">shimmer (柔和)</option>
      </select>
      <ConfirmButton onClick={generate} icon={loading ? Loader2 : User} disabled={!ai.isConfigured || loading}>{loading ? '生成中...' : '生成语音'}</ConfirmButton>
      {audioUrl && (
        <div className="mt-4 rounded-xl p-4" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
          <audio controls src={audioUrl} className="w-full" />
          <a href={audioUrl} download="voice.mp3" className="block mt-2 text-center text-[12px]" style={{ color: 'var(--color-accent)' }}>下载 MP3</a>
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   31. 背景降噪 — Web Audio 谱减法
   ════════════════════════════════════════════════════════════════════ */

export function NoiseReduceTool() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [original, setOriginal] = useState<AudioBuffer | null>(null);
  const [playing, setPlaying] = useState(false);
  const [noiseLevel, setNoiseLevel] = useState(50);
  const ctxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);

  const handleFile = async (f: File) => {
    const arrayBuffer = await f.arrayBuffer();
    const ctx = new AudioContext();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    setOriginal(audioBuffer);
    ctx.close();
  };

  const play = (reduced: boolean) => {
    if (!original) return;
    if (playing) { sourceRef.current?.stop(); setPlaying(false); return; }
    const factor = noiseLevel / 100;
    const ctx = new AudioContext();
    ctxRef.current = ctx;
    if (reduced) {
      const offline = new OfflineAudioContext(original.numberOfChannels, original.length, original.sampleRate);
      const src = offline.createBufferSource();
      const buf = offline.createBuffer(original.numberOfChannels, original.length, original.sampleRate);
      for (let ch = 0; ch < original.numberOfChannels; ch++) {
        const inData = original.getChannelData(ch);
        const outData = buf.getChannelData(ch);
        // Spectral subtraction approximation: simple high-pass + soft threshold
        let prev = 0;
        for (let i = 0; i < inData.length; i++) {
          const hp = inData[i] - prev * 0.95; // simple high-pass to remove low rumble
          // Soft threshold to suppress low-amplitude noise
          const mag = Math.abs(hp);
          const sign = Math.sign(hp);
          const newMag = Math.max(0, mag - factor * 0.05);
          outData[i] = sign * newMag;
          prev = inData[i];
        }
      }
      src.buffer = buf;
      src.connect(offline.destination);
      src.start();
      offline.startRendering();
      // Simplified: play the modified buffer directly via the live context
    }
    const liveSrc = ctx.createBufferSource();
    liveSrc.buffer = reduced ? (() => {
      const b = ctx.createBuffer(original.numberOfChannels, original.length, original.sampleRate);
      for (let ch = 0; ch < original.numberOfChannels; ch++) {
        const inData = original.getChannelData(ch);
        const outData = b.getChannelData(ch);
        let prev = 0;
        for (let i = 0; i < inData.length; i++) {
          const hp = inData[i] - prev * 0.95;
          const mag = Math.abs(hp);
          const newMag = Math.max(0, mag - factor * 0.05);
          outData[i] = Math.sign(hp) * newMag;
          prev = inData[i];
        }
      }
      return b;
    })() : original;
    liveSrc.connect(ctx.destination);
    liveSrc.start();
    sourceRef.current = liveSrc;
    setPlaying(true);
  };

  return (
    <div className="flex flex-col h-full p-6 max-w-2xl mx-auto w-full">
      <input ref={fileRef} type="file" accept="audio/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
      <Button onClick={() => fileRef.current?.click()} variant="secondary" fullWidth icon={Volume2}>{original ? `已加载: ${original.duration.toFixed(1)}s` : '选择音频'}</Button>
      {original && (
        <>
          <Slider label="降噪强度" value={noiseLevel} min={0} max={100} onChange={setNoiseLevel} />
          <div className="flex gap-2 mt-3">
            <Button variant="secondary" onClick={() => play(false)} icon={playing ? Square : Play} fullWidth>原声</Button>
            <ConfirmButton onClick={() => play(true)} icon={playing ? Square : VolumeX} fullWidth>{playing ? '停止' : '降噪'}</ConfirmButton>
          </div>
          <p className="text-[11px] text-center mt-3" style={{ color: 'var(--color-text-muted)' }}>基于一阶高通 + 软阈值降噪(浏览器内实时处理)</p>
        </>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   32. 音效制作 — 预设生成器
   ════════════════════════════════════════════════════════════════════ */

const SFX_PRESETS = [
  { name: '雨声', type: 'rain' },
  { name: '海浪', type: 'wave' },
  { name: '风声', type: 'wind' },
  { name: '鸟鸣', type: 'bird' },
  { name: '钟声', type: 'bell' },
  { name: '噼啪', type: 'fire' },
  { name: '心跳', type: 'heart' },
  { name: '激光', type: 'laser' },
];

function genSfx(ctx: AudioContext, type: string, duration: number): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const len = sampleRate * duration;
  const buf = ctx.createBuffer(1, len, sampleRate);
  const data = buf.getChannelData(0);
  switch (type) {
    case 'rain': {
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * 0.3;
      break;
    }
    case 'wave': {
      for (let i = 0; i < len; i++) {
        const t = i / sampleRate;
        data[i] = Math.sin(2 * Math.PI * 0.2 * t) * (Math.sin(2 * Math.PI * 0.5 * t) * 0.3 + Math.random() * 0.2);
      }
      break;
    }
    case 'wind': {
      let lp = 0;
      for (let i = 0; i < len; i++) {
        const n = Math.random() * 2 - 1;
        lp = lp * 0.99 + n * 0.01;
        data[i] = lp * 5;
      }
      break;
    }
    case 'bird': {
      for (let i = 0; i < len; i++) {
        const t = i / sampleRate;
        const chirp = Math.sin(2 * Math.PI * (800 + 400 * Math.sin(t * 20)) * t);
        data[i] = chirp * Math.exp(-((i % 8000) / 1000)) * 0.4;
      }
      break;
    }
    case 'bell': {
      for (let i = 0; i < len; i++) {
        const t = i / sampleRate;
        data[i] = (Math.sin(2 * Math.PI * 800 * t) + Math.sin(2 * Math.PI * 1200 * t) * 0.5) * Math.exp(-t * 2) * 0.5;
      }
      break;
    }
    case 'fire': {
      for (let i = 0; i < len; i++) {
        const t = i / sampleRate;
        data[i] = (Math.random() * 2 - 1) * (0.2 + 0.1 * Math.sin(2 * Math.PI * 3 * t));
      }
      break;
    }
    case 'heart': {
      for (let i = 0; i < len; i++) {
        const t = i / sampleRate;
        const beat = Math.exp(-((t * 1.2) % 0.8) * 5);
        data[i] = beat * Math.sin(2 * Math.PI * 60 * t) * 0.5;
      }
      break;
    }
    case 'laser': {
      for (let i = 0; i < len; i++) {
        const t = i / sampleRate;
        const f = 1000 + 1000 * Math.exp(-t * 10);
        data[i] = Math.sin(2 * Math.PI * f * t) * Math.exp(-t * 3) * 0.5;
      }
      break;
    }
  }
  return buf;
}

export function SfxMakerTool() {
  const { lang: _l } = useI18n(); void _l;
  const [duration, setDuration] = useState(3);
  const [playing, setPlaying] = useState<string | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const srcRef = useRef<AudioBufferSourceNode | null>(null);

  const play = (type: string) => {
    if (playing === type) { srcRef.current?.stop(); setPlaying(null); return; }
    if (!ctxRef.current) ctxRef.current = new AudioContext();
    const buf = genSfx(ctxRef.current, type, duration);
    const src = ctxRef.current.createBufferSource();
    src.buffer = buf;
    src.connect(ctxRef.current.destination);
    src.onended = () => setPlaying(null);
    src.start();
    srcRef.current = src;
    setPlaying(type);
  };

  return (
    <div className="flex flex-col h-full p-6 max-w-3xl mx-auto w-full">
      <Slider label="时长(秒)" value={duration} min={1} max={10} onChange={(v) => setDuration(v)} />
      <div className="grid grid-cols-4 gap-3 mt-4">
        {SFX_PRESETS.map((s) => (
          <button
            key={s.type}
            onClick={() => play(s.type)}
            className="rounded-xl p-4 transition-all"
            style={{
              background: playing === s.type ? 'var(--color-accent-glow)' : 'var(--color-bg-card)',
              border: `1.5px solid ${playing === s.type ? 'var(--color-accent)' : 'var(--color-border)'}`,
            }}
          >
            <Sparkles size={20} style={{ color: playing === s.type ? 'var(--color-accent)' : 'var(--color-text-secondary)' }} className="mx-auto" />
            <p className="text-[12px] mt-2 font-medium" style={{ color: 'var(--color-text-primary)' }}>{s.name}</p>
            <p className="text-[10px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{duration}s</p>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   33. 有声书合成 — 长文分段 TTS
   ════════════════════════════════════════════════════════════════════ */

export function AudiobookTool() {
  const { lang: _l } = useI18n(); void _l;
  const ai = useAI();
  const [text, setText] = useState('');
  const [engine, setEngine] = useState<'browser' | 'openai'>('browser');
  const [voice, setVoice] = useState('');
  void setVoice;
  const [speed, setSpeed] = useState(1);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  void voices;
  const [playing, setPlaying] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [audioUrls, setAudioUrls] = useState<string[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => setVoices(listBrowserVoices()), []);

  const paragraphs = text.split(/\n+/).filter((p) => p.trim());

  const playBrowser = async () => {
    if (playing) { stopBrowserTTS(); setPlaying(false); return; }
    setPlaying(true);
    for (let i = 0; i < paragraphs.length; i++) {
      setCurrentIdx(i);
      await ttsBrowser(paragraphs[i], { voice, rate: speed });
    }
    setPlaying(false);
  };

  const playOpenAI = async () => {
    if (audioUrls.length > 0 && audioRef.current) {
      audioRef.current.play();
      setPlaying(true);
      return;
    }
    setPlaying(true);
    const urls: string[] = [];
    for (let i = 0; i < paragraphs.length; i++) {
      try {
        const blob = await ttsOpenAI({ text: paragraphs[i], voice: (voice || 'alloy') as any, speed });
        urls.push(URL.createObjectURL(blob));
      } catch (e) { /* skip */ }
    }
    setAudioUrls(urls);
    setTimeout(() => playSequential(urls), 100);
  };

  const playSequential = (urls: string[]) => {
    if (urls.length === 0) { setPlaying(false); return; }
    setCurrentIdx(0);
    if (!audioRef.current) audioRef.current = new Audio();
    audioRef.current.src = urls[0];
    audioRef.current.play();
    audioRef.current.onended = () => {
      const idx = urls.indexOf(audioRef.current!.src);
      if (idx < urls.length - 1) {
        setCurrentIdx(idx + 1);
        audioRef.current!.src = urls[idx + 1];
        audioRef.current!.play();
      } else {
        setPlaying(false);
      }
    };
  };

  const stop = () => {
    if (engine === 'browser') stopBrowserTTS();
    if (audioRef.current) { audioRef.current.pause(); }
    setPlaying(false);
  };

  return (
    <div className="flex flex-col h-full p-6 max-w-3xl mx-auto w-full">
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={10} className="w-full p-3 rounded-lg text-[13px] outline-none resize-none" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)', lineHeight: 1.6 }} placeholder="粘贴长文,自动按段落分段朗读..." />
      <div className="flex items-center gap-2 mt-3">
        <select value={engine} onChange={(e) => setEngine(e.target.value as any)} className="h-9 px-2 rounded-lg text-[12px]" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}>
          <option value="browser">浏览器</option>
          <option value="openai" disabled={!ai.isConfigured}>OpenAI TTS</option>
        </select>
        <Slider label="语速" value={Math.round(speed * 100)} min={50} max={200} onChange={(v) => setSpeed(v / 100)} />
        {!playing ? (
          <ConfirmButton onClick={engine === 'browser' ? playBrowser : playOpenAI} icon={Play}>{paragraphs.length > 0 ? `播放 ${paragraphs.length} 段` : '播放'}</ConfirmButton>
        ) : (
          <Button onClick={stop} icon={Square} variant="danger">停止</Button>
        )}
      </div>
      {paragraphs.length > 0 && (
        <div className="mt-4 space-y-1.5 max-h-64 overflow-y-auto">
          {paragraphs.map((p, i) => (
            <div key={i} className="rounded-md px-3 py-2 text-[12px]" style={{ background: i === currentIdx ? 'var(--color-accent-glow)' : 'var(--color-bg-card)', border: `1px solid ${i === currentIdx ? 'var(--color-accent)' : 'var(--color-border)'}`, color: 'var(--color-text-secondary)' }}>
              <span className="text-[10px] mr-2" style={{ color: 'var(--color-text-muted)' }}>#{i + 1}</span>{p.slice(0, 80)}{p.length > 80 ? '...' : ''}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   34. 语音翻译 — Demo (mock pipeline)
   ════════════════════════════════════════════════════════════════════ */

export function VoiceTranslateTool() {
  const { lang: _l } = useI18n(); void _l;
  const [direction, setDirection] = useState<'zh-en' | 'en-zh'>('zh-en');
  const [transcript, setTranscript] = useState('');
  const [translated, setTranslated] = useState('');
  const [recording, setRecording] = useState(false);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      recRef.current = rec;
      chunksRef.current = [];
      rec.ondataavailable = (e) => chunksRef.current.push(e.data);
      rec.onstop = () => {
        // Local-only demo: would call ASR + translation APIs
        setTranscript('你好,今天天气真好');
        setTranslated('Hello, nice weather today');
        stream.getTracks().forEach((t) => t.stop());
      };
      rec.start();
      setRecording(true);
    } catch { /* ignore */ }
  };

  return (
    <div className="flex flex-col h-full p-6 max-w-2xl mx-auto w-full">
      <div className="rounded-xl p-4 mb-4" style={{ background: 'var(--color-accent-glow)', border: '1px solid var(--color-accent)' }}>
        <p className="text-[12px]" style={{ color: 'var(--color-text-primary)' }}>💡 这是一个演示:实际使用需 ASR(Whisper) + 翻译 API。完整流水线建议用 OpenAI Realtime API。</p>
      </div>
      <div className="flex gap-2 mb-3">
        <select value={direction} onChange={(e) => setDirection(e.target.value as any)} className="flex-1 h-9 px-2 rounded-lg text-[12px]" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}>
          <option value="zh-en">中文 → 英文</option>
          <option value="en-zh">英文 → 中文</option>
        </select>
        <Button onClick={recording ? () => { recRef.current?.stop(); setRecording(false); } : start} variant="primary" icon={Mic}>{recording ? '停止' : '录音'}</Button>
      </div>
      <div className="grid grid-cols-2 gap-3 flex-1">
        <div className="rounded-xl p-3" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
          <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--color-text-muted)' }}>转写</p>
          <p className="text-[13px]" style={{ color: 'var(--color-text-primary)' }}>{transcript || '—'}</p>
        </div>
        <div className="rounded-xl p-3" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
          <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--color-text-muted)' }}>翻译</p>
          <p className="text-[13px]" style={{ color: 'var(--color-text-primary)' }}>{translated || '—'}</p>
        </div>
      </div>
    </div>
  );
}

/* ─────────── Tool registry ─────────── */
export const AUDIO_TOOLS: Record<number, { Component: React.ComponentType; icon: LucideIcon }> = {
  27: { Component: TTSTool, icon: Volume2 },
  28: { Component: ASRTool, icon: Mic },
  29: { Component: SongComposerTool, icon: Music },
  30: { Component: VoiceCloneTool, icon: User },
  31: { Component: NoiseReduceTool, icon: VolumeX },
  32: { Component: SfxMakerTool, icon: Sparkles },
  33: { Component: AudiobookTool, icon: BookOpen },
  34: { Component: VoiceTranslateTool, icon: Languages },
};
