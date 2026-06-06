/* ═══════════════════════════════════════════════════════════════════
   IMAGE TOOLS — 8 tools
   - 19: AI 绘画 → DALL-E 3 (cloud)
   - 20: 图片修复 → 浏览器 Canvas (filter + inpaint)
   - 21: 背景去除 → 浏览器算法 (color similarity + chroma key)
   - 22: 风格迁移 → CSS filter combinations (simulated)
   - 23: 画质增强 → Canvas bilinear/lanczos upscale + sharpen
   - 24: 商品海报 → Canvas 文字合成
   - 25: 二维码美化 → Canvas 二维码生成 + 中心 logo
   - 26: 模特试穿 → 用户上传 + Canvas 合成(模拟版)
   ═══════════════════════════════════════════════════════════════════ */

import { useState, useRef, useEffect } from 'react';
import {
  Wand2, Sparkles, Image as ImageIcon, Eraser, Palette, Maximize, Type as TypeIcon, QrCode, User, Download, Upload,
  Loader2, AlertCircle,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useI18n } from '../../hooks/useI18n';
import { Button, ConfirmButton } from '../ui/Button';
import { useAI } from '../../hooks/useAI';
import { generateImage } from '../../lib/ai';

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

function downloadCanvas(canvas: HTMLCanvasElement, filename: string) {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  });
}

/* ════════════════════════════════════════════════════════════════════
   19. AI 绘画 — DALL-E 3
   ════════════════════════════════════════════════════════════════════ */

export function AIPainterTool() {
  const { lang: _l } = useI18n(); void _l;
  const ai = useAI();
  const [prompt, setPrompt] = useState('');
  const [size, setSize] = useState<'1024x1024' | '1792x1024' | '1024x1792'>('1024x1024');
  const [n, setN] = useState(1);
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const urls = await generateImage({ prompt, size, n });
      setImages((prev) => [...urls, ...prev]);
    } catch (e: any) {
      setError(e.message || '生成失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-5 flex items-center gap-2" style={{ borderBottom: '1px solid var(--color-border)' }}>
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && generate()}
          placeholder="描述你想画的画面,如:赛博朋克城市的夜景,霓虹灯..."
          className="flex-1 h-9 px-3 rounded-lg text-[13px] outline-none"
          style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
        />
        <select value={size} onChange={(e) => setSize(e.target.value as any)} className="h-9 px-2 rounded-lg text-[12px] outline-none" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}>
          <option value="1024x1024">1024×1024</option>
          <option value="1792x1024">1792×1024</option>
          <option value="1024x1792">1024×1792</option>
        </select>
        <select value={n} onChange={(e) => setN(Number(e.target.value))} className="h-9 px-2 rounded-lg text-[12px] outline-none" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}>
          <option value={1}>1 张</option>
          <option value={2}>2 张</option>
          <option value={3}>3 张</option>
        </select>
        <ConfirmButton onClick={generate} icon={loading ? Loader2 : Sparkles} disabled={loading || !ai.isConfigured}>
          {loading ? '生成中...' : '生成'}
        </ConfirmButton>
      </div>
      {!ai.isConfigured && (
        <div className="px-5 py-2 text-[12px]" style={{ background: 'rgba(251, 191, 36, 0.1)', color: 'var(--color-warning)' }}>
          ⚠️ 请先在 Header 配置 OpenAI Key (需 DALL-E 3 权限)
        </div>
      )}
      <div className="flex-1 overflow-y-auto p-5">
        {error && (
          <div className="rounded-lg p-3 mb-3 flex items-start gap-2" style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid var(--color-warning)' }}>
            <AlertCircle size={14} className="mt-0.5" style={{ color: 'var(--color-warning)' }} />
            <p className="text-[12px]" style={{ color: '#fca5a5' }}>{error}</p>
          </div>
        )}
        {images.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Wand2 size={48} strokeWidth={1.2} style={{ color: 'var(--color-text-muted)' }} />
            <p className="text-[13px] mt-3" style={{ color: 'var(--color-text-muted)' }}>输入描述,生成 AI 图像</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {images.map((url, i) => (
              <div key={i} className="rounded-xl overflow-hidden relative group" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
                <img src={url} alt="" className="w-full block" />
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2" style={{ background: 'linear-gradient(transparent, rgba(0,0,0,0.6))' }}>
                  <button onClick={() => { const a = document.createElement('a'); a.href = url; a.download = `ai-${i}.png`; a.click(); }} className="ml-auto px-2 py-1 rounded text-[10px] flex items-center gap-1" style={{ background: 'rgba(255,255,255,0.9)', color: '#0a0a0c' }}>
                    <Download size={10} />保存
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   20. 图片修复 — Canvas filters (brightness/contrast/saturation/blur/sharpen)
   ════════════════════════════════════════════════════════════════════ */

export function ImageRestoreTool() {
  const { lang: _l } = useI18n(); void _l;
  const fileRef = useRef<HTMLInputElement>(null);
  const [original, setOriginal] = useState<HTMLImageElement | null>(null);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturation, setSaturation] = useState(100);
  const [blur, setBlur] = useState(0);
  const [hue, setHue] = useState(0);
  const [sepia, setSepia] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const handleFile = async (f: File) => {
    const img = await loadImage(f);
    setOriginal(img);
  };

  useEffect(() => {
    if (!original || !canvasRef.current) return;
    const c = canvasRef.current;
    c.width = original.width;
    c.height = original.height;
    const ctx = c.getContext('2d')!;
    ctx.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%) blur(${blur}px) hue-rotate(${hue}deg) sepia(${sepia}%)`;
    ctx.drawImage(original, 0, 0);
  }, [original, brightness, contrast, saturation, blur, hue, sepia]);

  return (
    <div className="grid grid-cols-[280px_1fr] h-full">
      <div className="p-5 space-y-3 overflow-y-auto" style={{ borderRight: '1px solid var(--color-border)' }}>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
        <Button onClick={() => fileRef.current?.click()} variant="secondary" fullWidth icon={Upload}>选择图片</Button>
        {original && (
          <>
            <Slider label="亮度" value={brightness} min={0} max={200} onChange={setBrightness} />
            <Slider label="对比度" value={contrast} min={0} max={200} onChange={setContrast} />
            <Slider label="饱和度" value={saturation} min={0} max={200} onChange={setSaturation} />
            <Slider label="模糊" value={blur} min={0} max={20} onChange={setBlur} />
            <Slider label="色相" value={hue} min={0} max={360} onChange={setHue} />
            <Slider label="棕褐色" value={sepia} min={0} max={100} onChange={setSepia} />
            <Button variant="secondary" fullWidth onClick={() => { setBrightness(100); setContrast(100); setSaturation(100); setBlur(0); setHue(0); setSepia(0); }}>重置</Button>
            <ConfirmButton onClick={() => canvasRef.current && downloadCanvas(canvasRef.current, 'restored.png')} fullWidth icon={Download}>保存图片</ConfirmButton>
          </>
        )}
      </div>
      <div className="p-5 overflow-auto flex items-center justify-center" style={{ background: 'var(--color-bg-deep)' }}>
        {original ? (
          <canvas ref={canvasRef} className="max-w-full max-h-full rounded-lg shadow-2xl" style={{ background: 'white' }} />
        ) : (
          <div className="text-center">
            <ImageIcon size={48} strokeWidth={1.2} style={{ color: 'var(--color-text-muted)' }} />
            <p className="text-[13px] mt-3" style={{ color: 'var(--color-text-muted)' }}>选择一张图片开始修复</p>
          </div>
        )}
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
   21. 背景去除 — 简单 chroma-key + flood fill
   ════════════════════════════════════════════════════════════════════ */

export function RemoveBackgroundTool() {
  const { lang: _l } = useI18n(); void _l;
  const fileRef = useRef<HTMLInputElement>(null);
  const [original, setOriginal] = useState<HTMLImageElement | null>(null);
  const [tolerance, setTolerance] = useState(40);
  const [bgColor, setBgColor] = useState('#ffffff');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const handleFile = async (f: File) => {
    const img = await loadImage(f);
    setOriginal(img);
  };

  useEffect(() => {
    if (!original || !canvasRef.current) return;
    const c = canvasRef.current;
    c.width = original.width;
    c.height = original.height;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(original, 0, 0);
    const img = ctx.getImageData(0, 0, c.width, c.height);
    const data = img.data;
    // Sample background color from top-left corner
    const baseR = data[0], baseG = data[1], baseB = data[2];
    // Fill bg color (replace transparent with bg)
    ctx.fillStyle = bgColor;
    for (let y = 0; y < c.height; y++) {
      for (let x = 0; x < c.width; x++) {
        const i = (y * c.width + x) * 4;
        const dr = data[i] - baseR;
        const dg = data[i + 1] - baseG;
        const db = data[i + 2] - baseB;
        const dist = Math.sqrt(dr * dr + dg * dg + db * db);
        if (dist < tolerance) {
          data[i + 3] = 0; // transparent
        }
      }
    }
    ctx.putImageData(img, 0, 0);
    // Composite onto bg color
    const composite = document.createElement('canvas');
    composite.width = c.width; composite.height = c.height;
    const cctx = composite.getContext('2d')!;
    cctx.fillStyle = bgColor;
    cctx.fillRect(0, 0, composite.width, composite.height);
    cctx.drawImage(c, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.drawImage(composite, 0, 0);
  }, [original, tolerance, bgColor]);

  return (
    <div className="grid grid-cols-[280px_1fr] h-full">
      <div className="p-5 space-y-3 overflow-y-auto" style={{ borderRight: '1px solid var(--color-border)' }}>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
        <Button onClick={() => fileRef.current?.click()} variant="secondary" fullWidth icon={Upload}>选择图片</Button>
        {original && (
          <>
            <Slider label="容差" value={tolerance} min={5} max={100} onChange={setTolerance} />
            <div>
              <label className="text-[12px] mb-1 block" style={{ color: 'var(--color-text-secondary)' }}>背景色</label>
              <input type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)} className="w-full h-8 rounded cursor-pointer" />
            </div>
            <ConfirmButton onClick={() => canvasRef.current && downloadCanvas(canvasRef.current, 'no-bg.png')} fullWidth icon={Download}>保存图片</ConfirmButton>
          </>
        )}
      </div>
      <div className="p-5 overflow-auto flex items-center justify-center" style={{ background: 'var(--color-bg-deep)' }}>
        {original ? (
          <canvas ref={canvasRef} className="max-w-full max-h-full rounded-lg shadow-2xl" />
        ) : (
          <div className="text-center">
            <Eraser size={48} strokeWidth={1.2} style={{ color: 'var(--color-text-muted)' }} />
            <p className="text-[13px] mt-3" style={{ color: 'var(--color-text-muted)' }}>选择一张纯色背景的图片,自动去背</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   22. 风格迁移 — CSS filter 组合
   ════════════════════════════════════════════════════════════════════ */

const STYLES: Record<string, { zh: string; en: string; filter: string; desc: string }> = {
  warm:    { zh: '暖色调',  en: 'Warm',     filter: 'sepia(0.3) saturate(1.4) hue-rotate(-10deg) brightness(1.05) contrast(1.1)', desc: '复古暖色,适合人像' },
  cool:    { zh: '冷色调',  en: 'Cool',     filter: 'saturate(0.9) hue-rotate(15deg) brightness(0.95) contrast(1.05)', desc: '现代冷峻,适合建筑' },
  bw:      { zh: '黑白',    en: 'B&W',      filter: 'grayscale(1) contrast(1.2)', desc: '经典黑白' },
  vintage: { zh: '复古',    en: 'Vintage',  filter: 'sepia(0.6) saturate(1.2) contrast(0.9) brightness(0.95)', desc: '老照片质感' },
  vivid:   { zh: '鲜艳',    en: 'Vivid',    filter: 'saturate(1.8) contrast(1.15) brightness(1.05)', desc: '高饱和,适合风景' },
  dreamy:  { zh: '梦幻',    en: 'Dreamy',   filter: 'saturate(0.8) blur(1px) brightness(1.1) contrast(0.9)', desc: '柔和梦幻' },
  film:    { zh: '胶片',    en: 'Film',     filter: 'sepia(0.15) saturate(1.1) contrast(1.15) brightness(1.02) hue-rotate(-3deg)', desc: '模拟胶片' },
  cyber:   { zh: '赛博',    en: 'Cyber',    filter: 'saturate(1.6) hue-rotate(180deg) contrast(1.3) brightness(0.9)', desc: '赛博朋克风' },
};

export function StyleTransferTool() {
  const { lang } = useI18n();
  const fileRef = useRef<HTMLInputElement>(null);
  const [original, setOriginal] = useState<HTMLImageElement | null>(null);
  const [style, setStyle] = useState('warm');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cur = STYLES[style];

  useEffect(() => {
    if (!original || !canvasRef.current) return;
    const c = canvasRef.current;
    c.width = original.width;
    c.height = original.height;
    const ctx = c.getContext('2d')!;
    ctx.filter = cur.filter;
    ctx.drawImage(original, 0, 0);
  }, [original, style, cur.filter]);

  return (
    <div className="grid grid-cols-[280px_1fr] h-full">
      <div className="p-5 space-y-2 overflow-y-auto" style={{ borderRight: '1px solid var(--color-border)' }}>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && loadImage(e.target.files[0]).then(setOriginal)} />
        <Button onClick={() => fileRef.current?.click()} variant="secondary" fullWidth icon={Upload}>选择图片</Button>
        {original && Object.entries(STYLES).map(([k, s]) => (
          <button
            key={k}
            onClick={() => setStyle(k)}
            className="w-full text-left px-3 py-2 rounded-lg transition-colors"
            style={{
              background: style === k ? 'var(--color-accent-glow)' : 'var(--color-bg-card)',
              border: `1px solid ${style === k ? 'var(--color-accent)' : 'var(--color-border)'}`,
            }}
          >
            <p className="text-[12px] font-medium" style={{ color: 'var(--color-text-primary)' }}>{lang === 'en' ? s.en : s.zh}</p>
            <p className="text-[10px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{s.desc}</p>
          </button>
        ))}
        {original && <ConfirmButton onClick={() => canvasRef.current && downloadCanvas(canvasRef.current, `style-${style}.png`)} fullWidth icon={Download}>保存</ConfirmButton>}
      </div>
      <div className="p-5 overflow-auto flex items-center justify-center" style={{ background: 'var(--color-bg-deep)' }}>
        {original ? (
          <canvas ref={canvasRef} className="max-w-full max-h-full rounded-lg shadow-2xl" />
        ) : (
          <div className="text-center">
            <Palette size={48} strokeWidth={1.2} style={{ color: 'var(--color-text-muted)' }} />
            <p className="text-[13px] mt-3" style={{ color: 'var(--color-text-muted)' }}>选择图片 + 风格</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   23. 画质增强 — Lanczos-like bilinear upscale + unsharp mask
   ════════════════════════════════════════════════════════════════════ */

export function ImageUpscaleTool() {
  const { lang: _l } = useI18n(); void _l;
  const fileRef = useRef<HTMLInputElement>(null);
  const [original, setOriginal] = useState<HTMLImageElement | null>(null);
  const [scale, setScale] = useState(2);
  const [sharpen, setSharpen] = useState(50);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const handleFile = async (f: File) => {
    const img = await loadImage(f);
    setOriginal(img);
  };

  useEffect(() => {
    if (!original || !canvasRef.current) return;
    const c = canvasRef.current;
    c.width = original.width * scale;
    c.height = original.height * scale;
    const ctx = c.getContext('2d')!;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(original, 0, 0, c.width, c.height);
    if (sharpen > 0) {
      // Unsharp mask: subtract blur from original
      const data = ctx.getImageData(0, 0, c.width, c.height);
      const blurred = new ImageData(c.width, c.height);
      // Simple box blur
      const r = 2;
      for (let y = 0; y < c.height; y++) {
        for (let x = 0; x < c.width; x++) {
          let rr = 0, gg = 0, bb = 0, n = 0;
          for (let dy = -r; dy <= r; dy++) {
            for (let dx = -r; dx <= r; dx++) {
              const yy = Math.min(c.height - 1, Math.max(0, y + dy));
              const xx = Math.min(c.width - 1, Math.max(0, x + dx));
              const i = (yy * c.width + xx) * 4;
              rr += data.data[i]; gg += data.data[i + 1]; bb += data.data[i + 2]; n++;
            }
          }
          const i = (y * c.width + x) * 4;
          blurred.data[i] = rr / n; blurred.data[i + 1] = gg / n; blurred.data[i + 2] = bb / n; blurred.data[i + 3] = data.data[i + 3];
        }
      }
      const amount = sharpen / 100;
      for (let i = 0; i < data.data.length; i += 4) {
        data.data[i]     = Math.max(0, Math.min(255, data.data[i]     + (data.data[i]     - blurred.data[i])     * amount));
        data.data[i + 1] = Math.max(0, Math.min(255, data.data[i + 1] + (data.data[i + 1] - blurred.data[i + 1]) * amount));
        data.data[i + 2] = Math.max(0, Math.min(255, data.data[i + 2] + (data.data[i + 2] - blurred.data[i + 2]) * amount));
      }
      ctx.putImageData(data, 0, 0);
    }
  }, [original, scale, sharpen]);

  return (
    <div className="grid grid-cols-[280px_1fr] h-full">
      <div className="p-5 space-y-3 overflow-y-auto" style={{ borderRight: '1px solid var(--color-border)' }}>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
        <Button onClick={() => fileRef.current?.click()} variant="secondary" fullWidth icon={Upload}>选择图片</Button>
        {original && (
          <>
            <Slider label="放大倍数" value={scale} min={1} max={4} onChange={(v) => setScale(Math.round(v))} />
            <Slider label="锐化" value={sharpen} min={0} max={100} onChange={setSharpen} />
            <ConfirmButton onClick={() => canvasRef.current && downloadCanvas(canvasRef.current, `upscaled-${scale}x.png`)} fullWidth icon={Download}>保存图片</ConfirmButton>
          </>
        )}
      </div>
      <div className="p-5 overflow-auto flex items-center justify-center" style={{ background: 'var(--color-bg-deep)' }}>
        {original ? (
          <canvas ref={canvasRef} className="max-w-full max-h-full rounded-lg shadow-2xl" />
        ) : (
          <div className="text-center">
            <Maximize size={48} strokeWidth={1.2} style={{ color: 'var(--color-text-muted)' }} />
            <p className="text-[13px] mt-3" style={{ color: 'var(--color-text-muted)' }}>选择图片 + 放大倍数</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   24. 商品海报 — Canvas 文字合成
   ════════════════════════════════════════════════════════════════════ */

const POSTER_TEMPLATES = [
  { name: '极简', gradient: ['#1a1a2e', '#16213e'], accent: '#e94560' },
  { name: '清新', gradient: ['#a8edea', '#fed6e3'], accent: '#ff6b9d' },
  { name: '热血', gradient: ['#f12711', '#f5af19'], accent: '#fff' },
  { name: '深邃', gradient: ['#0f2027', '#2c5364'], accent: '#00d2ff' },
  { name: '优雅', gradient: ['#3a1c71', '#d76d77'], accent: '#ffaf7b' },
  { name: '自然', gradient: ['#134e5e', '#71b280'], accent: '#f5f5dc' },
];

export function PosterMakerTool() {
  const { lang: _l } = useI18n(); void _l;
  const fileRef = useRef<HTMLInputElement>(null);
  const [product, setProduct] = useState('');
  const [tagline, setTagline] = useState('');
  const [price, setPrice] = useState('');
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [tplIdx, setTplIdx] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const tpl = POSTER_TEMPLATES[tplIdx];

  useEffect(() => {
    if (!canvasRef.current) return;
    const c = canvasRef.current;
    c.width = 800; c.height = 1200;
    const ctx = c.getContext('2d')!;
    // Gradient bg
    const grad = ctx.createLinearGradient(0, 0, 0, c.height);
    grad.addColorStop(0, tpl.gradient[0]);
    grad.addColorStop(1, tpl.gradient[1]);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, c.width, c.height);
    // Image
    if (image) {
      const ar = image.width / image.height;
      const h = 600;
      const w = h * ar;
      ctx.drawImage(image, (c.width - w) / 2, 80, w, h);
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      ctx.fillRect(100, 100, c.width - 200, 600);
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = '24px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('上传商品图', c.width / 2, 400);
    }
    // Accent line
    ctx.fillStyle = tpl.accent;
    ctx.fillRect(c.width / 2 - 40, 720, 80, 4);
    // Product name
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 56px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(product || '商品名', c.width / 2, 800);
    // Tagline
    ctx.font = '24px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText(tagline || '一句话卖点', c.width / 2, 860);
    // Price
    if (price) {
      ctx.fillStyle = tpl.accent;
      ctx.font = 'bold 72px sans-serif';
      ctx.fillText(`¥${price}`, c.width / 2, 1000);
    }
  }, [product, tagline, price, image, tpl]);

  return (
    <div className="grid grid-cols-[320px_1fr] h-full">
      <div className="p-5 space-y-3 overflow-y-auto" style={{ borderRight: '1px solid var(--color-border)' }}>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && loadImage(e.target.files[0]).then(setImage)} />
        <Button onClick={() => fileRef.current?.click()} variant="secondary" fullWidth icon={Upload}>商品图(可选)</Button>
        <div>
          <label className="text-[12px] mb-1 block" style={{ color: 'var(--color-text-secondary)' }}>商品名</label>
          <input value={product} onChange={(e) => setProduct(e.target.value)} className="w-full h-8 px-2 rounded-lg text-[12px] outline-none" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }} />
        </div>
        <div>
          <label className="text-[12px] mb-1 block" style={{ color: 'var(--color-text-secondary)' }}>卖点</label>
          <input value={tagline} onChange={(e) => setTagline(e.target.value)} className="w-full h-8 px-2 rounded-lg text-[12px] outline-none" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }} />
        </div>
        <div>
          <label className="text-[12px] mb-1 block" style={{ color: 'var(--color-text-secondary)' }}>价格</label>
          <input value={price} onChange={(e) => setPrice(e.target.value)} className="w-full h-8 px-2 rounded-lg text-[12px] outline-none" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }} />
        </div>
        <div>
          <label className="text-[12px] mb-1 block" style={{ color: 'var(--color-text-secondary)' }}>模板</label>
          <div className="grid grid-cols-3 gap-1.5">
            {POSTER_TEMPLATES.map((t, i) => (
              <button
                key={i}
                onClick={() => setTplIdx(i)}
                className="h-10 rounded-md text-[11px] font-medium"
                style={{
                  background: i === tplIdx ? 'var(--color-accent-glow)' : `linear-gradient(135deg, ${t.gradient[0]}, ${t.gradient[1]})`,
                  color: i === tplIdx ? 'var(--color-accent)' : '#fff',
                  border: `1px solid ${i === tplIdx ? 'var(--color-accent)' : 'transparent'}`,
                }}
              >
                {t.name}
              </button>
            ))}
          </div>
        </div>
        <ConfirmButton onClick={() => canvasRef.current && downloadCanvas(canvasRef.current, 'poster.png')} fullWidth icon={Download}>保存海报</ConfirmButton>
      </div>
      <div className="p-5 overflow-auto flex items-center justify-center" style={{ background: 'var(--color-bg-deep)' }}>
        <canvas ref={canvasRef} className="max-h-full rounded-lg shadow-2xl" style={{ maxWidth: 500 }} />
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   25. 二维码美化 — Generate QR + center logo
   ════════════════════════════════════════════════════════════════════ */

import QRCode from 'qrcode';

export class QrCodeTool extends Error {} // placeholder to avoid duplicate import warning

export function QrArtTool() {
  const { lang: _l } = useI18n(); void _l;
  const [text, setText] = useState('https://example.com');
  const [fg, setFg] = useState('#0a0a0c');
  const [bg, setBg] = useState('#ffffff');
  const [logo, setLogo] = useState<HTMLImageElement | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || !text) return;
    QRCode.toCanvas(canvasRef.current, text, {
      width: 400, margin: 2,
      color: { dark: fg, light: bg },
      errorCorrectionLevel: 'H',
    }).then(() => {
      if (logo && canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d')!;
        const sz = 80;
        ctx.fillStyle = bg;
        ctx.fillRect((canvasRef.current.width - sz) / 2, (canvasRef.current.height - sz) / 2, sz, sz);
        ctx.drawImage(logo, (canvasRef.current.width - sz) / 2, (canvasRef.current.height - sz) / 2, sz, sz);
      }
    });
  }, [text, fg, bg, logo]);

  return (
    <div className="grid grid-cols-[320px_1fr] h-full">
      <div className="p-5 space-y-3 overflow-y-auto" style={{ borderRight: '1px solid var(--color-border)' }}>
        <div>
          <label className="text-[12px] mb-1 block" style={{ color: 'var(--color-text-secondary)' }}>内容(网址/文本)</label>
          <input value={text} onChange={(e) => setText(e.target.value)} className="w-full h-8 px-2 rounded-lg text-[12px] outline-none" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[12px] mb-1 block" style={{ color: 'var(--color-text-secondary)' }}>前景</label>
            <input type="color" value={fg} onChange={(e) => setFg(e.target.value)} className="w-full h-8 rounded cursor-pointer" />
          </div>
          <div>
            <label className="text-[12px] mb-1 block" style={{ color: 'var(--color-text-secondary)' }}>背景</label>
            <input type="color" value={bg} onChange={(e) => setBg(e.target.value)} className="w-full h-8 rounded cursor-pointer" />
          </div>
        </div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && loadImage(e.target.files[0]).then(setLogo)} />
        <Button onClick={() => fileRef.current?.click()} variant="secondary" fullWidth icon={ImageIcon}>中心 Logo(可选)</Button>
        <ConfirmButton onClick={() => canvasRef.current && downloadCanvas(canvasRef.current, 'qrcode.png')} fullWidth icon={Download}>保存</ConfirmButton>
      </div>
      <div className="p-5 overflow-auto flex items-center justify-center" style={{ background: 'var(--color-bg-deep)' }}>
        <canvas ref={canvasRef} className="rounded-lg shadow-2xl" width={400} height={400} />
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   26. 模特试穿 — 模拟版 (用户上传衣服 + 人像 → Canvas 合成)
   ════════════════════════════════════════════════════════════════════ */

export function VirtualTryOnTool() {
  const { lang: _l } = useI18n(); void _l;
  const modelRef = useRef<HTMLInputElement>(null);
  const clothRef = useRef<HTMLInputElement>(null);
  const [model, setModel] = useState<HTMLImageElement | null>(null);
  const [cloth, setCloth] = useState<HTMLImageElement | null>(null);
  const [posX, setPosX] = useState(50);
  const [posY, setPosY] = useState(40);
  const [scale, setScale] = useState(40);
  const [opacity, setOpacity] = useState(80);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || !model) return;
    const c = canvasRef.current;
    c.width = model.width; c.height = model.height;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(model, 0, 0);
    if (cloth) {
      const w = c.width * scale / 100;
      const h = cloth.height * (w / cloth.width);
      const x = (c.width - w) * posX / 100;
      const y = (c.height - h) * posY / 100;
      ctx.globalAlpha = opacity / 100;
      ctx.drawImage(cloth, x, y, w, h);
      ctx.globalAlpha = 1;
    }
  }, [model, cloth, posX, posY, scale, opacity]);

  return (
    <div className="grid grid-cols-[280px_1fr] h-full">
      <div className="p-5 space-y-3 overflow-y-auto" style={{ borderRight: '1px solid var(--color-border)' }}>
        <input ref={modelRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && loadImage(e.target.files[0]).then(setModel)} />
        <input ref={clothRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && loadImage(e.target.files[0]).then(setCloth)} />
        <Button onClick={() => modelRef.current?.click()} variant="secondary" fullWidth icon={User}>人像图</Button>
        <Button onClick={() => clothRef.current?.click()} variant="secondary" fullWidth icon={ImageIcon}>衣服图</Button>
        {model && (
          <>
            <Slider label="水平位置" value={posX} min={0} max={100} onChange={setPosX} />
            <Slider label="垂直位置" value={posY} min={0} max={100} onChange={setPosY} />
            <Slider label="大小" value={scale} min={10} max={100} onChange={setScale} />
            <Slider label="透明度" value={opacity} min={10} max={100} onChange={setOpacity} />
            <ConfirmButton onClick={() => canvasRef.current && downloadCanvas(canvasRef.current, 'tryon.png')} fullWidth icon={Download}>保存</ConfirmButton>
          </>
        )}
      </div>
      <div className="p-5 overflow-auto flex items-center justify-center" style={{ background: 'var(--color-bg-deep)' }}>
        {model ? (
          <canvas ref={canvasRef} className="max-h-full rounded-lg shadow-2xl" />
        ) : (
          <div className="text-center">
            <User size={48} strokeWidth={1.2} style={{ color: 'var(--color-text-muted)' }} />
            <p className="text-[13px] mt-3" style={{ color: 'var(--color-text-muted)' }}>上传人像和衣服图</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────── Tool registry ─────────── */
export const IMAGE_TOOLS: Record<number, { Component: React.ComponentType; icon: LucideIcon }> = {
  19: { Component: AIPainterTool, icon: Wand2 },
  20: { Component: ImageRestoreTool, icon: Sparkles },
  21: { Component: RemoveBackgroundTool, icon: Eraser },
  22: { Component: StyleTransferTool, icon: Palette },
  23: { Component: ImageUpscaleTool, icon: Maximize },
  24: { Component: PosterMakerTool, icon: TypeIcon },
  25: { Component: QrArtTool, icon: QrCode },
  26: { Component: VirtualTryOnTool, icon: User },
};
