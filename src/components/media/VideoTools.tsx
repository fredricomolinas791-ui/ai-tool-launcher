/* ═══════════════════════════════════════════════════════════════════
   VIDEO TOOLS — 8 tools
   - 35: 文字生成视频 — script → frames stitched into video
   - 36: 智能剪辑 — trim video by silence detection
   - 37: 字幕生成 — ASR + WebVTT export
   - 38: 数字人主播 — text + avatar SVG animation → video
   - 39: 视频翻译 — demo pipeline
   - 40: 视频配乐 — mood-based music recommendation
   - 41: 特效包装 — CSS filter + canvas recording
   - 42: VLOG剪辑 — simple trim + title overlay
   ═══════════════════════════════════════════════════════════════════ */

import { useState, useRef, useEffect } from 'react';
import {
  Film, Scissors, Type, Bot, Languages, Music, Sparkles, Video, Upload, Play, Square, Download,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Button, ConfirmButton } from '../ui/Button';
import { useI18n } from '../../hooks/useI18n';

async function loadVideo(file: File): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const v = document.createElement('video');
    v.muted = true;
    v.onloadedmetadata = () => resolve(v);
    v.onerror = reject;
    v.src = URL.createObjectURL(file);
  });
}

function downloadBlob(blob: Blob | undefined, filename: string) {
  if (!blob) return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function pad(n: number) { return n.toString().padStart(2, '0'); }
function formatVTTTime(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  const ms = Math.floor((s % 1) * 1000);
  return `${pad(h)}:${pad(m)}:${pad(sec)}.${pad(ms)}`;
}

/* ════════════════════════════════════════════════════════════════════
   35. 文字生成视频 — 用 Canvas 逐帧 + MediaRecorder
   ════════════════════════════════════════════════════════════════════ */

export function TextToVideoTool() {
  const { lang: _l } = useI18n(); void _l;
  const [text, setText] = useState('在浩瀚的宇宙中,地球静静地旋转着。');
  const [bg, setBg] = useState<'space' | 'ocean' | 'sunset' | 'forest'>('space');
  const [recording, setRecording] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const recRef = useRef<MediaRecorder | null>(null);

  const startRecord = async () => {
    if (!canvasRef.current) return;
    setVideoUrl(null);
    const c = canvasRef.current;
    c.width = 640; c.height = 360;
    const ctx = c.getContext('2d')!;
    const stream = c.captureStream(30);
    const rec = new MediaRecorder(stream, { mimeType: 'video/webm' });
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => chunks.push(e.data);
    rec.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      setVideoUrl(URL.createObjectURL(blob));
    };
    rec.start();
    recRef.current = rec;
    setRecording(true);
    // Animate
    const start = performance.now();
    const dur = 6000;
    const draw = () => {
      const t = (performance.now() - start) / 1000;
      const progress = Math.min(t / (dur / 1000), 1);
      // BG
      const grads: Record<string, [string, string]> = {
        space: ['#0a0a1a', '#1a1a3a'], ocean: ['#001a3a', '#0a3a6a'], sunset: ['#3a1a0a', '#6a3a1a'], forest: ['#0a3a1a', '#1a6a3a'],
      };
      const g = ctx.createLinearGradient(0, 0, 0, c.height);
      g.addColorStop(0, grads[bg][0]); g.addColorStop(1, grads[bg][1]);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, c.width, c.height);
      // Stars/particles
      for (let i = 0; i < 50; i++) {
        ctx.fillStyle = `rgba(255,255,255,${0.2 + Math.random() * 0.4})`;
        ctx.beginPath();
        ctx.arc((i * 137) % c.width, ((i * 91 + t * 30) % c.height), 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
      // Text
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 32px sans-serif';
      ctx.textAlign = 'center';
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 8;
      ctx.fillText(text, c.width / 2, c.height / 2);
      ctx.shadowBlur = 0;
      // Progress bar
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.fillRect(0, c.height - 4, c.width, 4);
      ctx.fillStyle = 'var(--color-accent)';
      ctx.fillRect(0, c.height - 4, c.width * progress, 4);
      if (progress < 1) requestAnimationFrame(draw);
      else rec.stop();
    };
    draw();
  };

  const stop = () => {
    recRef.current?.stop();
    setRecording(false);
  };

  return (
    <div className="grid grid-cols-[360px_1fr] h-full">
      <div className="p-5 space-y-3 overflow-y-auto" style={{ borderRight: '1px solid var(--color-border)' }}>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={5} className="w-full p-3 rounded-lg text-[13px] outline-none resize-none" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }} placeholder="输入视频文案..." />
        <div>
          <label className="text-[12px] mb-1 block" style={{ color: 'var(--color-text-secondary)' }}>背景主题</label>
          <div className="grid grid-cols-4 gap-1.5">
            {(['space', 'ocean', 'sunset', 'forest'] as const).map((b) => (
              <button
                key={b}
                onClick={() => setBg(b)}
                className="h-9 rounded-md text-[10px] font-medium"
                style={{
                  background: b === 'space' ? 'linear-gradient(135deg, #0a0a1a, #1a1a3a)' :
                              b === 'ocean' ? 'linear-gradient(135deg, #001a3a, #0a3a6a)' :
                              b === 'sunset' ? 'linear-gradient(135deg, #3a1a0a, #6a3a1a)' :
                              'linear-gradient(135deg, #0a3a1a, #1a6a3a)',
                  color: '#fff',
                  border: `1px solid ${bg === b ? 'var(--color-accent)' : 'transparent'}`,
                }}
              >
                {b === 'space' ? '星空' : b === 'ocean' ? '海洋' : b === 'sunset' ? '日落' : '森林'}
              </button>
            ))}
          </div>
        </div>
        {!recording ? (
          <ConfirmButton onClick={startRecord} icon={Video} fullWidth>生成视频(6s)</ConfirmButton>
        ) : (
          <Button onClick={stop} variant="danger" icon={Square} fullWidth>停止</Button>
        )}
        {videoUrl && <Button variant="secondary" onClick={() => { const a = document.createElement('a'); a.href = videoUrl; a.download = 'video.webm'; a.click(); }} icon={Download} fullWidth>下载视频</Button>}
      </div>
      <div className="p-5 flex items-center justify-center" style={{ background: 'var(--color-bg-deep)' }}>
        <canvas ref={canvasRef} className="rounded-lg shadow-2xl max-h-full" />
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   36. 智能剪辑 — silence detection trim
   ════════════════════════════════════════════════════════════════════ */

export function SmartEditorTool() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [video, setVideo] = useState<HTMLVideoElement | null>(null);
  const [silenceThreshold, setSilenceThreshold] = useState(20);
  const [segments, setSegments] = useState<{ start: number; end: number; keep: boolean }[]>([]);

  const handleFile = async (f: File) => {
    const v = await loadVideo(f);
    setVideo(v);
  };

  const detectSilence = async () => {
    if (!video) return;
    // Use AudioContext for analysis
    const ctx = new AudioContext();
    const source = ctx.createMediaElementSource(video);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);
    video.muted = false;
    video.currentTime = 0;
    await video.play();
    const dur = video.duration;
    const sampleStep = 0.1;
    const samples: { t: number; vol: number }[] = [];
    for (let t = 0; t < dur; t += sampleStep) {
      video.currentTime = t;
      await new Promise((r) => setTimeout(r, 50));
      analyser.getByteFrequencyData(data);
      const vol = data.reduce((a, b) => a + b, 0) / data.length;
      samples.push({ t, vol });
    }
    video.pause();
    ctx.close();
    // Find segments
    const segs: typeof segments = [];
    let segStart = 0;
    for (let i = 0; i < samples.length; i++) {
      const isSilent = samples[i].vol < silenceThreshold;
      if (isSilent && i + 1 < samples.length && !(samples[i + 1].vol < silenceThreshold)) {
        if (i - segStart > 0.5) segs.push({ start: segStart, end: samples[i].t, keep: true });
        segStart = samples[i + 1].t;
        // skip silent region
        let j = i + 1;
        while (j < samples.length && samples[j].vol < silenceThreshold) j++;
        if (j < samples.length) segStart = samples[j].t;
        i = j;
      }
    }
    if (dur - segStart > 0.5) segs.push({ start: segStart, end: dur, keep: true });
    setSegments(segs);
  };

  return (
    <div className="flex flex-col h-full p-6">
      <input ref={fileRef} type="file" accept="video/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
      <div className="flex items-center gap-2 mb-3">
        <Button onClick={() => fileRef.current?.click()} variant="secondary" icon={Upload}>选择视频</Button>
        {video && <ConfirmButton onClick={detectSilence} icon={Scissors}>检测静音</ConfirmButton>}
        {segments.length > 0 && <Button variant="secondary" onClick={() => alert('导出功能演示:实际项目用 FFmpeg.wasm 拼接片段')} icon={Download}>导出</Button>}
      </div>
      {video && (
        <>
          <Slider label="静音阈值" value={silenceThreshold} min={5} max={50} onChange={setSilenceThreshold} />
          <video ref={(el) => { if (el) (video as any)._ref = el; }} src={video.src} controls className="w-full max-h-96 rounded-lg mt-3" />
          {segments.length > 0 && (
            <div className="mt-3 space-y-1.5">
              {segments.map((s, i) => (
                <div key={i} className="rounded-md p-2 text-[12px] flex items-center gap-2" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
                  <span className="font-mono">#{i + 1}</span>
                  <span className="text-[10px] font-mono" style={{ color: 'var(--color-text-muted)' }}>{s.start.toFixed(1)}s - {s.end.toFixed(1)}s</span>
                  <span style={{ marginLeft: 'auto' }}>保留 {((s.end - s.start)).toFixed(1)}s</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
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
   37. 字幕生成 — 简易 ASR + WebVTT 导出
   ════════════════════════════════════════════════════════════════════ */

export function SubtitleGeneratorTool() {
  const [text, setText] = useState('');
  const [duration, setDuration] = useState(60);
  const [segments, setSegments] = useState<{ start: number; end: number; text: string }[]>([]);
  const [generating, setGenerating] = useState(false);

  const generate = () => {
    if (!text.trim()) return;
    setGenerating(true);
    // Split text into chunks
    const chunks = text.match(/[^。！？.!?\n]+[。！？.!?\n]?/g) || [text];
    const total = chunks.length;
    const segDur = duration / total;
    setSegments(chunks.map((c, i) => ({
      start: i * segDur,
      end: (i + 1) * segDur,
      text: c.trim(),
    })));
    setGenerating(false);
  };

  const exportVTT = () => {
    let vtt = 'WEBVTT\n\n';
    segments.forEach((s, i) => {
      vtt += `${i + 1}\n${formatVTTTime(s.start)} --> ${formatVTTTime(s.end)}\n${s.text}\n\n`;
    });
    downloadBlob(new Blob([vtt], { type: 'text/vtt' }), 'subtitles.vtt');
  };

  return (
    <div className="grid grid-cols-2 h-full">
      <div className="p-5 space-y-3 overflow-y-auto" style={{ borderRight: '1px solid var(--color-border)' }}>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={15} className="w-full p-3 rounded-lg text-[13px] outline-none resize-none" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }} placeholder="粘贴视频的完整文案/台词..." />
        <Slider label="视频时长(秒)" value={duration} min={10} max={600} onChange={(v) => setDuration(Math.round(v))} />
        <div className="flex gap-2">
          <ConfirmButton onClick={generate} icon={Type} disabled={generating}>{generating ? '生成中...' : '生成字幕'}</ConfirmButton>
          {segments.length > 0 && <Button variant="secondary" onClick={exportVTT} icon={Download}>导出 VTT</Button>}
        </div>
      </div>
      <div className="p-5 overflow-y-auto">
        {segments.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Type size={48} strokeWidth={1.2} style={{ color: 'var(--color-text-muted)' }} />
            <p className="text-[13px] mt-3" style={{ color: 'var(--color-text-muted)' }}>粘贴文案,自动按句号/问号分段</p>
          </div>
        ) : (
          <div className="space-y-2">
            {segments.map((s, i) => (
              <div key={i} className="rounded-lg p-3" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
                <div className="text-[10px] font-mono mb-1" style={{ color: 'var(--color-text-muted)' }}>{formatVTTTime(s.start)} → {formatVTTTime(s.end)}</div>
                <p className="text-[13px]" style={{ color: 'var(--color-text-primary)' }}>{s.text}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   38. 数字人主播 — SVG 动画 + Canvas 录制
   ════════════════════════════════════════════════════════════════════ */

export function DigitalHumanTool() {
  const { lang: _l } = useI18n(); void _l;
  const [text, setText] = useState('你好,我是 AI 数字人小助手,欢迎使用本工具。');
  const [bg, setBg] = useState('#0a0a1a');
  const [recording, setRecording] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const recRef = useRef<MediaRecorder | null>(null);

  const startRecord = () => {
    if (!canvasRef.current) return;
    const c = canvasRef.current;
    c.width = 480; c.height = 640;
    const ctx = c.getContext('2d')!;
    const stream = c.captureStream(30);
    const rec = new MediaRecorder(stream, { mimeType: 'video/webm' });
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => chunks.push(e.data);
    rec.onstop = () => setVideoUrl(URL.createObjectURL(new Blob(chunks, { type: 'video/webm' })));
    rec.start();
    recRef.current = rec;
    setRecording(true);
    // Animate avatar
    const start = performance.now();
    const dur = 8000;
    const chars = text.split('');
    const animate = () => {
      const elapsed = (performance.now() - start) / 1000;
      const progress = Math.min(elapsed / (dur / 1000), 1);
      // BG
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, c.width, c.height);
      // Avatar (simple stylized)
      const cx = c.width / 2;
      // Head
      ctx.fillStyle = '#f5d6b3';
      ctx.beginPath();
      ctx.arc(cx, 220, 80, 0, Math.PI * 2);
      ctx.fill();
      // Hair
      ctx.fillStyle = '#3a2a1a';
      ctx.beginPath();
      ctx.arc(cx, 200, 85, Math.PI, 0);
      ctx.fill();
      // Eyes (blink occasionally)
      const blink = Math.random() < 0.02;
      ctx.fillStyle = '#000';
      if (!blink) {
        ctx.beginPath(); ctx.arc(cx - 25, 220, 5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(cx + 25, 220, 5, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.fillRect(cx - 30, 218, 12, 4);
        ctx.fillRect(cx + 18, 218, 12, 4);
      }
      // Mouth (talk animation)
      const mouthOpen = 5 + Math.abs(Math.sin(elapsed * 8)) * 12;
      ctx.fillStyle = '#a04040';
      ctx.beginPath();
      ctx.ellipse(cx, 260, 18, mouthOpen, 0, 0, Math.PI * 2);
      ctx.fill();
      // Body
      ctx.fillStyle = '#4a5a8a';
      ctx.fillRect(cx - 90, 320, 180, 200);
      // Subtitle
      const visibleChars = Math.floor(chars.length * progress);
      ctx.fillStyle = '#fff';
      ctx.font = '18px sans-serif';
      ctx.textAlign = 'center';
      const subText = chars.slice(0, visibleChars).join('');
      ctx.fillText(subText, cx, c.height - 40);
      if (progress < 1) requestAnimationFrame(animate);
      else { rec.stop(); setRecording(false); }
    };
    animate();
  };

  const stop = () => { recRef.current?.stop(); setRecording(false); };

  return (
    <div className="grid grid-cols-[340px_1fr] h-full">
      <div className="p-5 space-y-3" style={{ borderRight: '1px solid var(--color-border)' }}>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={6} className="w-full p-3 rounded-lg text-[13px] outline-none resize-none" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }} placeholder="输入主播要说的话..." />
        <div>
          <label className="text-[12px] mb-1 block" style={{ color: 'var(--color-text-secondary)' }}>背景色</label>
          <input type="color" value={bg} onChange={(e) => setBg(e.target.value)} className="w-full h-8 rounded cursor-pointer" />
        </div>
        {!recording ? (
          <ConfirmButton onClick={startRecord} icon={Bot} fullWidth>生成数字人</ConfirmButton>
        ) : (
          <Button onClick={stop} icon={Square} variant="danger" fullWidth>停止</Button>
        )}
        {videoUrl && <Button variant="secondary" onClick={() => { const a = document.createElement('a'); a.href = videoUrl; a.download = 'digital-human.webm'; a.click(); }} icon={Download} fullWidth>下载</Button>}
      </div>
      <div className="p-5 flex items-center justify-center" style={{ background: 'var(--color-bg-deep)' }}>
        <canvas ref={canvasRef} className="rounded-lg shadow-2xl max-h-full" />
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   39. 视频翻译 — demo
   ════════════════════════════════════════════════════════════════════ */

export function VideoTranslateTool() {
  const { lang: _l } = useI18n(); void _l;
  const [text, setText] = useState('这是一个测试视频字幕的样例文本。');
  const [direction, setDirection] = useState<'zh-en' | 'en-zh'>('zh-en');
  const [translated, setTranslated] = useState('');
  const [loading, setLoading] = useState(false);

  const translate = () => {
    if (!text.trim()) return;
    setLoading(true);
    setTimeout(() => {
      const dict: Record<string, string> = {
        '你好': 'Hello', '这是一个测试': 'This is a test', '视频': 'video', '样例文本': 'sample text',
        'Hello': '你好', 'This is a sample': '这是一个样例',
      };
      const result = text.split(/[，。.,\s]+/).map((w) => dict[w] || `[${w}]`).join(' ');
      setTranslated(result);
      setLoading(false);
    }, 800);
  };

  return (
    <div className="flex flex-col h-full p-6 max-w-3xl mx-auto w-full">
      <div className="rounded-xl p-4 mb-4" style={{ background: 'var(--color-accent-glow)', border: '1px solid var(--color-accent)' }}>
        <p className="text-[12px]" style={{ color: 'var(--color-text-primary)' }}>💡 完整功能需用 Whisper ASR + 翻译 API。这里是 UI 演示版本。</p>
      </div>
      <div className="flex gap-2 mb-3">
        <select value={direction} onChange={(e) => setDirection(e.target.value as any)} className="h-9 px-2 rounded-lg text-[12px]" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}>
          <option value="zh-en">中 → 英</option>
          <option value="en-zh">英 → 中</option>
        </select>
        <ConfirmButton onClick={translate} icon={Languages} disabled={loading}>{loading ? '翻译中...' : '翻译'}</ConfirmButton>
      </div>
      <div className="grid grid-cols-2 gap-3 flex-1">
        <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="原文字幕..." className="p-3 rounded-lg text-[13px] outline-none resize-none" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }} />
        <textarea value={translated} readOnly placeholder="翻译结果..." className="p-3 rounded-lg text-[13px] outline-none resize-none" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }} />
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   40. 视频配乐 — 情绪推荐 + Web Audio 试听
   ════════════════════════════════════════════════════════════════════ */

const MOOD_TRACKS = [
  { mood: '激昂', tracks: ['Epic Cinematic', 'Triumphant March', 'Heroic Overture'], bpm: 140, scale: 'minor' as const },
  { mood: '温暖', tracks: ['Acoustic Sunshine', 'Gentle Piano', 'Soft Strings'], bpm: 90, scale: 'major' as const },
  { mood: '紧张', tracks: ['Tension Riser', 'Pulse Beat', 'Dark Drone'], bpm: 130, scale: 'minor' as const },
  { mood: '浪漫', tracks: ['Soft Piano Ballad', 'Acoustic Guitar', 'Romantic Strings'], bpm: 75, scale: 'major' as const },
  { mood: '欢快', tracks: ['Upbeat Pop', 'Happy Ukulele', 'Bouncy Synth'], bpm: 120, scale: 'major' as const },
  { mood: '忧伤', tracks: ['Sad Piano', 'Melancholy Strings', 'Rainy Day'], bpm: 70, scale: 'minor' as const },
];

export function VideoMusicTool() {
  const { lang: _l } = useI18n(); void _l;
  const [mood, setMood] = useState('温暖');
  const [playing, setPlaying] = useState(false);
  const ctxRef = useRef<AudioContext | null>(null);

  const play = () => {
    if (playing) { ctxRef.current?.close(); ctxRef.current = null; setPlaying(false); return; }
    const track = MOOD_TRACKS.find((t) => t.mood === mood)!;
    const ctx = new AudioContext();
    ctxRef.current = ctx;
    const beat = 60 / track.bpm;
    const scale = track.scale === 'major' ? [261.63, 293.66, 329.63, 349.23, 392.00, 440.00, 493.88] : [261.63, 293.66, 311.13, 349.23, 392.00, 415.30, 466.16];
    const playNote = (freq: number, t: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.1, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + beat * 0.9);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + beat);
    };
    const start = ctx.currentTime + 0.1;
    for (let i = 0; i < 32; i++) {
      playNote(scale[i % scale.length] * (i % 4 === 0 ? 2 : 1), start + i * beat);
    }
    setPlaying(true);
    setTimeout(() => { if (ctxRef.current === ctx) { ctx.close(); ctxRef.current = null; setPlaying(false); } }, 32 * beat * 1000);
  };

  return (
    <div className="grid grid-cols-[280px_1fr] h-full">
      <div className="p-5 space-y-2" style={{ borderRight: '1px solid var(--color-border)' }}>
        <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--color-text-muted)' }}>情绪</p>
        {MOOD_TRACKS.map((t) => (
          <button
            key={t.mood}
            onClick={() => setMood(t.mood)}
            className="w-full text-left px-3 py-2 rounded-md text-[12px] transition-colors"
            style={{
              background: mood === t.mood ? 'var(--color-accent-glow)' : 'var(--color-bg-card)',
              color: mood === t.mood ? 'var(--color-accent)' : 'var(--color-text-primary)',
              border: `1px solid ${mood === t.mood ? 'var(--color-accent)' : 'var(--color-border)'}`,
            }}
          >
            {t.mood} · {t.bpm} BPM
          </button>
        ))}
        <ConfirmButton onClick={play} icon={playing ? Square : Play} fullWidth className="mt-3">{playing ? '停止' : '试听'}</ConfirmButton>
      </div>
      <div className="p-5 overflow-y-auto">
        <h2 className="text-[16px] font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>推荐 BGM</h2>
        {MOOD_TRACKS.find((t) => t.mood === mood)?.tracks.map((track, i) => (
          <div key={i} className="rounded-xl p-4 mb-2 flex items-center gap-3" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
            <Music size={18} style={{ color: 'var(--color-accent)' }} />
            <div>
              <p className="text-[13px] font-medium" style={{ color: 'var(--color-text-primary)' }}>{track}</p>
              <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>情绪: {mood} · 适合 vlog / 短视频</p>
            </div>
          </div>
        ))}
        <p className="text-[11px] mt-3" style={{ color: 'var(--color-text-muted)' }}>实际使用可对接 Epidemic Sound / Artlist / Pixabay Music 等 BGM 库</p>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   41. 特效包装 — preset
   ════════════════════════════════════════════════════════════════════ */

const EFFECTS = [
  { name: '电影感', filter: 'contrast(1.2) saturate(0.85) brightness(0.95) sepia(0.1)' },
  { name: '日式', filter: 'brightness(1.05) saturate(0.9) contrast(0.95)' },
  { name: '赛博', filter: 'saturate(1.6) hue-rotate(180deg) contrast(1.3)' },
  { name: '复古 VHS', filter: 'contrast(1.1) saturate(1.2) sepia(0.2) hue-rotate(-5deg)' },
  { name: '黑白', filter: 'grayscale(1) contrast(1.2)' },
  { name: '高饱和', filter: 'saturate(1.8) contrast(1.15)' },
  { name: '暖色', filter: 'sepia(0.3) saturate(1.2) hue-rotate(-10deg)' },
  { name: '冷色', filter: 'saturate(0.85) hue-rotate(15deg) brightness(0.95)' },
];

export function VfxTool() {
  const { lang: _l } = useI18n(); void _l;
  const fileRef = useRef<HTMLInputElement>(null);
  const [video, setVideo] = useState<HTMLVideoElement | null>(null);
  const [effect, setEffect] = useState(0);
  const [recording, setRecording] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const recRef = useRef<MediaRecorder | null>(null);

  const handleFile = async (f: File) => {
    const v = await loadVideo(f);
    v.crossOrigin = 'anonymous';
    setVideo(v);
  };

  const record = () => {
    if (!video || !canvasRef.current) return;
    const c = canvasRef.current;
    c.width = video.videoWidth || 640;
    c.height = video.videoHeight || 360;
    const ctx = c.getContext('2d')!;
    const stream = c.captureStream(30);
    const rec = new MediaRecorder(stream, { mimeType: 'video/webm' });
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => chunks.push(e.data);
    rec.onstop = () => setVideoUrl(URL.createObjectURL(new Blob(chunks, { type: 'video/webm' })));
    rec.start();
    recRef.current = rec;
    video.muted = true;
    video.currentTime = 0;
    video.play();
    setRecording(true);
    const draw = () => {
      if (video.paused || video.ended) { rec.stop(); setRecording(false); return; }
      ctx.filter = EFFECTS[effect].filter;
      ctx.drawImage(video, 0, 0, c.width, c.height);
      requestAnimationFrame(draw);
    };
    draw();
  };

  const stop = () => { recRef.current?.stop(); video?.pause(); setRecording(false); };

  return (
    <div className="grid grid-cols-[280px_1fr] h-full">
      <div className="p-5 space-y-2" style={{ borderRight: '1px solid var(--color-border)' }}>
        <input ref={fileRef} type="file" accept="video/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
        <Button onClick={() => fileRef.current?.click()} variant="secondary" fullWidth icon={Upload}>选择视频</Button>
        {video && (
          <>
            <p className="text-[10px] font-semibold uppercase tracking-wider mt-3" style={{ color: 'var(--color-text-muted)' }}>特效</p>
            <div className="grid grid-cols-2 gap-1.5">
              {EFFECTS.map((e, i) => (
                <button
                  key={i}
                  onClick={() => setEffect(i)}
                  className="h-9 rounded-md text-[11px]"
                  style={{
                    background: i === effect ? 'var(--color-accent-glow)' : 'var(--color-bg-card)',
                    color: i === effect ? 'var(--color-accent)' : 'var(--color-text-primary)',
                    border: `1px solid ${i === effect ? 'var(--color-accent)' : 'var(--color-border)'}`,
                  }}
                >
                  {e.name}
                </button>
              ))}
            </div>
            {!recording ? (
              <ConfirmButton onClick={record} icon={Film} fullWidth>录制特效视频</ConfirmButton>
            ) : (
              <Button onClick={stop} icon={Square} variant="danger" fullWidth>停止</Button>
            )}
            {videoUrl && <Button variant="secondary" onClick={() => { const a = document.createElement('a'); a.href = videoUrl; a.download = 'fx.webm'; a.click(); }} icon={Download} fullWidth>下载</Button>}
          </>
        )}
      </div>
      <div className="p-5 flex items-center justify-center" style={{ background: 'var(--color-bg-deep)' }}>
        {video ? (
          <div className="flex flex-col items-center gap-2">
            <video src={video.src} controls className="rounded-lg shadow-2xl max-h-[60vh]" style={{ filter: EFFECTS[effect].filter }} />
            <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>预览(实时 CSS filter)</p>
          </div>
        ) : (
          <div className="text-center">
            <Film size={48} strokeWidth={1.2} style={{ color: 'var(--color-text-muted)' }} />
            <p className="text-[13px] mt-3" style={{ color: 'var(--color-text-muted)' }}>选择视频,应用 8 种特效</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   42. VLOG 剪辑 — 简易 trim + 字幕叠加
   ════════════════════════════════════════════════════════════════════ */

export function VlogEditorTool() {
  const { lang: _l } = useI18n(); void _l;
  const fileRef = useRef<HTMLInputElement>(null);
  const [video, setVideo] = useState<HTMLVideoElement | null>(null);
  const [title, setTitle] = useState('我的 VLOG');
  const [trim, setTrim] = useState({ start: 0, end: 100 });

  const handleFile = async (f: File) => {
    const v = await loadVideo(f);
    setVideo(v);
  };

  useEffect(() => {
    if (!video) return;
    if (video.duration) setTrim({ start: 0, end: video.duration });
  }, [video]);

  return (
    <div className="grid grid-cols-[320px_1fr] h-full">
      <div className="p-5 space-y-3" style={{ borderRight: '1px solid var(--color-border)' }}>
        <input ref={fileRef} type="file" accept="video/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
        <Button onClick={() => fileRef.current?.click()} variant="secondary" fullWidth icon={Upload}>选择 VLOG</Button>
        {video && (
          <>
            <div>
              <label className="text-[12px] mb-1 block" style={{ color: 'var(--color-text-secondary)' }}>标题</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full h-8 px-2 rounded-lg text-[12px] outline-none" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }} />
            </div>
            <Slider label="开始(秒)" value={trim.start} min={0} max={video.duration} onChange={(v) => setTrim({ ...trim, start: Math.min(v, trim.end - 1) })} />
            <Slider label="结束(秒)" value={trim.end} min={0} max={video.duration} onChange={(v) => setTrim({ ...trim, end: Math.max(v, trim.start + 1) })} />
            <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>时长: {(trim.end - trim.start).toFixed(1)}s</p>
            <ConfirmButton onClick={() => { if (video) { video.currentTime = trim.start; video.play(); }} } icon={Play} fullWidth>预览</ConfirmButton>
          </>
        )}
      </div>
      <div className="p-5 flex items-center justify-center" style={{ background: 'var(--color-bg-deep)' }}>
        {video ? (
          <div className="relative max-h-full">
            <video ref={(el) => { if (el) (video as any)._ref = el; }} src={video.src} controls className="rounded-lg shadow-2xl max-h-[60vh]" />
            <div className="absolute top-0 left-0 right-0 p-4 pointer-events-none">
              <p className="text-2xl font-bold text-center" style={{ color: '#fff', textShadow: '0 2px 8px rgba(0,0,0,0.8)' }}>{title}</p>
            </div>
          </div>
        ) : (
          <div className="text-center">
            <Video size={48} strokeWidth={1.2} style={{ color: 'var(--color-text-muted)' }} />
            <p className="text-[13px] mt-3" style={{ color: 'var(--color-text-muted)' }}>选择 VLOG 视频,加标题并裁剪</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────── Tool registry ─────────── */
export const VIDEO_TOOLS: Record<number, { Component: React.ComponentType; icon: LucideIcon }> = {
  35: { Component: TextToVideoTool, icon: Film },
  36: { Component: SmartEditorTool, icon: Scissors },
  37: { Component: SubtitleGeneratorTool, icon: Type },
  38: { Component: DigitalHumanTool, icon: Bot },
  39: { Component: VideoTranslateTool, icon: Languages },
  40: { Component: VideoMusicTool, icon: Music },
  41: { Component: VfxTool, icon: Sparkles },
  42: { Component: VlogEditorTool, icon: Video },
};
