/* AI Service Layer
 * - OpenAI-compatible: OpenAI / 国内代理 / 自定义 baseURL
 * - Anthropic Claude
 * - Local storage of API keys (XOR-obfuscated, not real crypto)
 * - Streaming chat, image gen, TTS, ASR
 */

export type Provider = 'openai' | 'anthropic' | 'custom' | 'MiniMax';
export type Model =
  | 'gpt-4o' | 'gpt-4o-mini' | 'gpt-4-turbo' | 'o1-mini' | 'o1'
  | 'claude-sonnet-4-6' | 'claude-haiku-4-5' | 'claude-opus-4-8'
  | 'custom';

export interface ChatMessage { role: 'system' | 'user' | 'assistant'; content: string; }

/** Result of a chat call split into "thinking" and "text" parts.
 *  Some providers (notably MiniMax-M3) emit a chain-of-thought block before
 *  the actual answer; consumers that want to display them in separate UI
 *  regions use the structured form. */
export interface ChatParts { thinking: string; text: string; }

/** Returns the current UI language from settings (zh|en). Defaults to zh
 *  on any failure so we never accidentally call the model in the wrong
 *  language because of a corrupted localStorage entry. */
function getCurrentLanguage(): 'zh' | 'en' {
  if (typeof localStorage === 'undefined') return 'zh';
  try {
    const raw = localStorage.getItem('ai-tools-launcher.settings.v1');
    if (raw) {
      const s = JSON.parse(raw);
      return s?.language === 'en' ? 'en' : 'zh';
    }
  } catch {}
  return 'zh';
}

/** Directive that overrides any tool-level language assumption.
 *  Appended at the END of the system prompt so it has the last word. */
const LANG_DIRECTIVE: Record<'zh' | 'en', string> = {
  zh: '\n\n## 输出语言\n请务必使用简体中文回复,所有字段、示例、解释都使用中文。即使用户用其他语言提问,也用中文回答。',
  en: '\n\n## Output Language\nAlways reply in English. All field names, examples, and explanations must be in English, even if the user prompts in another language.',
};

export interface ChatRequest {
  messages: ChatMessage[];
  model?: Model | string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  systemPrompt?: string;
}

export interface ImageRequest {
  prompt: string;
  model?: 'dall-e-3' | 'dall-e-2' | string;
  size?: '1024x1024' | '1792x1024' | '1024x1792' | '256x256' | '512x512';
  n?: number;
}

export interface TTSRequest {
  text: string;
  voice?: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer' | string;
  speed?: number;
  model?: 'tts-1' | 'tts-1-hd' | string;
}

export interface KeyConfig {
  provider: Provider;
  apiKey: string;
  baseURL?: string;
  model?: string;
}

const KEY_STORAGE = 'ai-tools-launcher.ai-keys.v1';

/* Very simple XOR obfuscation (NOT real encryption — keys are still accessible
   to any script in the same origin. This just prevents casual inspection.) */
function xor(text: string, key = 'ai-tools-launcher-2026'): string {
  let out = '';
  for (let i = 0; i < text.length; i++) {
    out += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return out;
}

function loadKeys(): Record<string, KeyConfig> {
  try {
    const raw = localStorage.getItem(KEY_STORAGE);
    if (!raw) return {};
    const obj = JSON.parse(raw);
    const out: Record<string, KeyConfig> = {};
    for (const k of Object.keys(obj)) {
      const v = obj[k];
      out[k] = { ...v, apiKey: xor(v.apiKey) };
    }
    return out;
  } catch { return {}; }
}

function saveKeys(keys: Record<string, KeyConfig>) {
  const enc: Record<string, KeyConfig> = {};
  for (const k of Object.keys(keys)) {
    enc[k] = { ...keys[k], apiKey: xor(keys[k].apiKey) };
  }
  localStorage.setItem(KEY_STORAGE, JSON.stringify(enc));
}

let _keys: Record<string, KeyConfig> = loadKeys();
let _activeProvider: Provider = (localStorage.getItem('ai-tools-launcher.active-provider.v1') as Provider) || 'openai';
const listeners = new Set<() => void>();

function emit() { listeners.forEach((l) => l()); }

/* P0 Bug 1 修复:模块顶层 loadKeys() 在 init 时读 localStorage,如果用户当时未配 key,
   _keys = {} 永久锁定。即使后续 setItem / addInitScript 注入都无效。
   修复:每次 getActiveKey()/getKeys() 调用前都重新读 localStorage(保证新注入的 key 能生效)。
   性能损耗可忽略(loadKeys 仅 ~100 行 JSON.parse)。 */
function refreshIfStale() {
  // 每次调用都重读 (优化:可加 debounce, 但 game 模块高频调用不值得)
  const fresh = loadKeys();
  _keys = fresh;
}

export const aiStore = {
  getKeys: () => { refreshIfStale(); return _keys; },
  getActiveProvider: () => _activeProvider,
  getActiveKey: (): KeyConfig | null => { refreshIfStale(); return _keys[_activeProvider] || null; },
  setKey: (provider: Provider, cfg: Omit<KeyConfig, 'provider'>) => {
    _keys = { ..._keys, [provider]: { ...cfg, provider } };
    saveKeys(_keys);
    emit();
  },
  removeKey: (provider: Provider) => {
    const next = { ..._keys };
    delete next[provider];
    _keys = next;
    saveKeys(_keys);
    if (_activeProvider === provider) _activeProvider = 'openai';
    emit();
  },
  setActiveProvider: (p: Provider) => {
    _activeProvider = p;
    localStorage.setItem('ai-tools-launcher.active-provider.v1', p);
    emit();
  },
  subscribe: (l: () => void) => { listeners.add(l); return () => listeners.delete(l); },
};

/* ─────────── HTTP helpers ─────────── */

async function fetchSSE(url: string, body: any, headers: Record<string, string>, onDelta: (text: string) => void): Promise<string> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`HTTP ${res.status}: ${err.slice(0, 200)}`);
  }
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  let full = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() || '';
    for (const line of lines) {
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (data === '[DONE]') continue;
      try {
        const j = JSON.parse(data);
        const delta = j.choices?.[0]?.delta?.content || j.delta?.text || '';
        if (delta) {
          full += delta;
          onDelta(delta);
        }
      } catch {}
    }
  }
  return full;
}

async function fetchJSON(url: string, body: any, headers: Record<string, string>): Promise<any> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`HTTP ${res.status}: ${err.slice(0, 200)}`);
  }
  return res.json();
}

/* ─────────── OpenAI chat ─────────── */

export async function chatOpenAI(
  req: ChatRequest,
  key: KeyConfig,
  onDelta?: (text: string, kind: 'thinking' | 'text') => void,
): Promise<ChatParts> {
  const base = key.baseURL || 'https://api.openai.com/v1';
  // Append the language directive last so it overrides any tool-level
  // language assumption baked into the system prompt.
  const langTail = LANG_DIRECTIVE[getCurrentLanguage()];
  const messages = req.systemPrompt || langTail
    ? [
        ...(req.systemPrompt ? [{ role: 'system' as const, content: req.systemPrompt }] : []),
        ...(langTail ? [{ role: 'system' as const, content: langTail }] : []),
        ...req.messages,
      ]
    : req.messages;
  const body: any = {
    model: req.model || key.model || 'gpt-4o-mini',
    messages,
    temperature: req.temperature ?? 0.7,
    max_tokens: req.maxTokens || 2048,
    stream: !!onDelta,
  };
  if (onDelta) {
    // OpenAI has no native "thinking" concept — the streamed delta is
    // always plain text. Route it through a kind:'text' wrapper.
    const full = await fetchSSE(`${base}/chat/completions`, body, { Authorization: `Bearer ${key.apiKey}` }, (chunk) => {
      onDelta(chunk, 'text');
    });
    return { thinking: '', text: full };
  }
  const j = await fetchJSON(`${base}/chat/completions`, body, { Authorization: `Bearer ${key.apiKey}` });
  return { thinking: '', text: j.choices?.[0]?.message?.content || '' };
}

/* ─────────── Anthropic Claude chat ─────────── */

export async function chatAnthropic(
  req: ChatRequest,
  key: KeyConfig,
  onDelta?: (text: string, kind: 'thinking' | 'text') => void,
): Promise<ChatParts> {
  const base = key.baseURL || 'https://api.anthropic.com/v1';
  const systemParts: string[] = [];
  const messages: ChatMessage[] = [];
  for (const m of req.messages) {
    if (m.role === 'system') systemParts.push(m.content);
    else messages.push(m);
  }
  if (req.systemPrompt) systemParts.unshift(req.systemPrompt);
  // Append the language directive last so it overrides any tool-level
  // language assumption baked into the system prompt.
  const langTail = LANG_DIRECTIVE[getCurrentLanguage()];
  if (langTail) systemParts.push(langTail);

  const body: any = {
    model: req.model || key.model || 'claude-haiku-4-5',
    max_tokens: req.maxTokens || 2048,
    temperature: req.temperature ?? 0.7,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
    system: systemParts.join('\n\n') || undefined,
    stream: !!onDelta,
  };

  if (onDelta) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Api-Key': key.apiKey,
      'anthropic-version': '2023-06-01',
    };
    if (key.provider === 'anthropic') {
      headers['anthropic-dangerous-direct-browser-access'] = 'true';
    }
    const res = await fetch(`${base}/messages`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`HTTP ${res.status}: ${err.slice(0, 200)}`);
    }
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    // Accumulate thinking and text in separate buffers so consumers can
    // render them in distinct UI regions (tabbed panels).
    const parts: ChatParts = { thinking: '', text: '' };
    let currentBlockKind: '' | 'thinking' | 'text' = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop() || '';
      for (const line of lines) {
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (data === '[DONE]' || data === '') continue;
        try {
          const j = JSON.parse(data);
          if (j.type === 'content_block_start' && j.content_block?.type) {
            currentBlockKind = j.content_block.type === 'thinking' ? 'thinking'
              : j.content_block.type === 'text' ? 'text' : '';
          } else if (j.type === 'content_block_delta') {
            // Anthropic text: delta.text; MiniMax thinking: delta.thinking.
            const piece: string = j.delta?.text ?? j.delta?.thinking ?? '';
            if (piece && currentBlockKind) {
              if (currentBlockKind === 'thinking') parts.thinking += piece;
              else if (currentBlockKind === 'text') parts.text += piece;
              onDelta(piece, currentBlockKind);
            }
          } else if (j.type === 'content_block_stop') {
            currentBlockKind = '';
          } else if (j.type === 'message_delta' && j.delta?.stop_reason) {
            // end
          }
        } catch {}
      }
    }
    return parts;
  }
  const j = await fetchJSON(`${base}/messages`, body, {
    'X-Api-Key': key.apiKey,
    'anthropic-version': '2023-06-01',
    ...(key.provider === 'anthropic' && {
      'anthropic-dangerous-direct-browser-access': 'true',
    }),
  });
  // Non-streaming: still split into thinking + text.
  const blocks: any[] = Array.isArray(j.content) ? j.content : [];
  const parts: ChatParts = { thinking: '', text: '' };
  for (const b of blocks) {
    if (typeof b?.text === 'string') parts.text += b.text;
    else if (typeof b?.thinking === 'string') parts.thinking += b.thinking;
  }
  return parts;
}

/* ─────────── Universal chat dispatcher ─────────── */

/** Plain string-returning chat. Kept for backward compat (testConnection,
 *  one-off callers). For UI that wants to separate "thinking" from
 *  "result", use `chatParts()` instead. */
export async function chat(req: ChatRequest, opts?: { onDelta?: (text: string) => void }): Promise<string> {
  const parts = await chatParts(req, opts?.onDelta ? (text) => opts.onDelta!(text) : undefined);
  return [parts.thinking, parts.text].filter((s) => s).join('\n\n');
}

/** Structured-output chat. Returns thinking and text in separate fields
 *  and emits each delta with a `kind` so the UI can route them to
 *  different panels without re-parsing. */
export async function chatParts(
  req: ChatRequest,
  onDelta?: (text: string, kind: 'thinking' | 'text') => void,
): Promise<ChatParts> {
  const key = aiStore.getActiveKey();
  if (!key) throw new Error(langErr('No API key configured. Set one in Settings → AI Provider.', '未配置 API Key,请到 设置 → AI Provider 配置。'));
  if (key.provider === 'anthropic' || key.provider === 'MiniMax') {
    // MiniMax's `/anthropic` endpoint speaks the Anthropic Messages protocol
    // (see platform.minimaxi.com provider admin: it accepts Claude-format
    //  requests with x-api-key header and a "MiniMax-M3" model name).
    return chatAnthropic(req, key, onDelta);
  }
  return chatOpenAI(req, key, onDelta);
}

/* ─────────── Image generation (OpenAI DALL-E) ─────────── */

export async function generateImage(req: ImageRequest): Promise<string[]> {
  const key = aiStore.getActiveKey();
  if (!key) throw new Error(langErr('No API key configured.', '未配置 API Key。'));
  const base = key.baseURL || 'https://api.openai.com/v1';
  const j = await fetchJSON(`${base}/images/generations`, {
    model: req.model || 'dall-e-3',
    prompt: req.prompt,
    size: req.size || '1024x1024',
    n: req.n || 1,
    response_format: 'b64_json',
  }, { Authorization: `Bearer ${key.apiKey}` });
  return (j.data || []).map((d: any) => {
    if (d.url) return d.url;
    if (d.b64_json) return `data:image/png;base64,${d.b64_json}`;
    return '';
  });
}

/* ─────────── TTS (OpenAI) ─────────── */

export async function ttsOpenAI(req: TTSRequest): Promise<Blob> {
  const key = aiStore.getActiveKey();
  if (!key) throw new Error(langErr('No API key configured.', '未配置 API Key。'));
  const base = key.baseURL || 'https://api.openai.com/v1';
  const res = await fetch(`${base}/audio/speech`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key.apiKey}` },
    body: JSON.stringify({
      model: req.model || 'tts-1',
      input: req.text,
      voice: req.voice || 'alloy',
      speed: req.speed ?? 1.0,
      response_format: 'mp3',
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  return res.blob();
}

/* ─────────── Browser-native fallbacks ─────────── */

/** Browser SpeechSynthesis — works in Chrome/Edge/Safari, no API key needed. */
export function ttsBrowser(text: string, opts?: { voice?: string; rate?: number; pitch?: number }): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      reject(new Error('Web Speech API not available'));
      return;
    }
    const u = new SpeechSynthesisUtterance(text);
    if (opts?.voice) {
      const v = window.speechSynthesis.getVoices().find((v) => v.name === opts.voice);
      if (v) u.voice = v;
    }
    u.rate = opts?.rate ?? 1;
    u.pitch = opts?.pitch ?? 1;
    u.onend = () => resolve();
    u.onerror = (e) => reject(new Error(`TTS error: ${e.error}`));
    window.speechSynthesis.speak(u);
  });
}

export function stopBrowserTTS() {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

export function listBrowserVoices(): SpeechSynthesisVoice[] {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return [];
  return window.speechSynthesis.getVoices();
}

/* ─────────── ASR (Whisper via OpenAI, fallback to web speech) ─────────── */

export async function asrWhisper(audioBlob: Blob): Promise<string> {
  const key = aiStore.getActiveKey();
  if (!key) throw new Error(langErr('No API key configured.', '未配置 API Key。'));
  const base = key.baseURL || 'https://api.openai.com/v1';
  const form = new FormData();
  form.append('file', audioBlob, 'audio.webm');
  form.append('model', 'whisper-1');
  const res = await fetch(`${base}/audio/transcriptions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key.apiKey}` },
    body: form,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  const j = await res.json();
  return j.text || '';
}

/* ─────────── Connection test ─────────── */

export async function testConnection(): Promise<{ ok: boolean; message: string; latencyMs?: number }> {
  const key = aiStore.getActiveKey();
  if (!key) return { ok: false, message: 'No API key' };
  const t0 = Date.now();
  try {
    // Use 200 tokens: enough for MiniMax-M3 / Claude 4.x to emit both
    // thinking and the requested "ok" answer. With ≤20 tokens, the model's
    // internal reasoning consumes the whole budget and the test reports
    // "successful" with an empty message — which looks like a failure.
    const res = await chat({
      messages: [{ role: 'user', content: 'Reply with the single word: ok' }],
      maxTokens: 200,
    });
    const ms = Date.now() - t0;
    return { ok: true, message: res.slice(0, 100), latencyMs: ms };
  } catch (e: any) {
    return { ok: false, message: e.message || 'Connection failed' };
  }
}

/* ─────────── Cost estimation (very rough) ─────────── */

export function estimateChatCost(model: string, promptTokens: number, completionTokens: number): number {
  const rates: Record<string, [number, number]> = {
    'gpt-4o-mini': [0.15, 0.6],
    'gpt-4o': [2.5, 10],
    'gpt-4-turbo': [10, 30],
    'o1-mini': [3, 12],
    'o1': [15, 60],
    'claude-haiku-4-5': [0.8, 4],
    'claude-sonnet-4-6': [3, 15],
    'claude-opus-4-8': [15, 75],
  };
  const [inRate, outRate] = rates[model] || [1, 4];
  return (promptTokens * inRate + completionTokens * outRate) / 1_000_000;
}

/* Locale-aware error */
function langErr(en: string, zh: string): string {
  return (typeof navigator !== 'undefined' && navigator.language?.startsWith('zh')) ? zh : en;
}
