import { useState, useMemo } from 'react';
import { X, Key, Check, AlertCircle, Loader2, Eye, EyeOff, Trash2, Sparkles, ExternalLink, ChevronRight, Search, Globe, Zap } from 'lucide-react';
import { useAI } from '../../hooks/useAI';
import { testConnection, type Provider } from '../../lib/ai';
import { ConfirmButton } from '../ui/Button';

/* ════════════════════════════════════════════════════════════════════
   模型库 — 3 级结构:地区 → 厂商 → 模型
   ════════════════════════════════════════════════════════════════════ */

type Region = 'international' | 'china';

interface ModelEntry {
  id: string;
  label: string;
  desc: string;
  cost: string;
}

interface ProviderEntry {
  id: Provider;
  label: string;
  baseURL: string;
  docs: string;
  defaultModel: string;
  models: ModelEntry[];
}

interface RegionEntry {
  id: Region;
  flag: string;
  label: { zh: string; en: string };
  providers: ProviderEntry[];
}

const REGIONS: RegionEntry[] = [
  {
    id: 'international',
    flag: '🌐',
    label: { zh: '国际厂商', en: 'International' },
    providers: [
      {
        id: 'openai',
        label: 'OpenAI',
        baseURL: 'https://api.openai.com/v1',
        docs: 'https://platform.openai.com/api-keys',
        defaultModel: 'gpt-5',
        models: [
          { id: 'gpt-5', label: 'GPT-5', desc: '最新旗舰 · 400k 上下文 · 多模态', cost: '$2.50/1M' },
          { id: 'gpt-5-mini', label: 'GPT-5 mini', desc: '更快便宜 · 推理增强', cost: '$0.25/1M' },
          { id: 'gpt-5-nano', label: 'GPT-5 nano', desc: '超快超便宜', cost: '$0.05/1M' },
          { id: 'gpt-4o', label: 'GPT-4o', desc: '上代旗舰 · 多模态', cost: '$2.50/1M' },
          { id: 'gpt-4o-mini', label: 'GPT-4o mini', desc: '稳定便宜', cost: '$0.15/1M' },
          { id: 'gpt-image-1', label: 'GPT Image 1', desc: '图像生成', cost: '$0.04/张' },
          { id: 'o3', label: 'o3', desc: '推理模型 · 复杂任务', cost: '$15/1M' },
          { id: 'o3-mini', label: 'o3-mini', desc: '推理 · 便宜', cost: '$1.10/1M' },
          { id: 'o4-mini', label: 'o4-mini', desc: '最新推理', cost: '$1.10/1M' },
          { id: 'gpt-oss-120b', label: 'GPT-OSS 120B', desc: '开源 · 自部署', cost: '免费' },
        ],
      },
      {
        id: 'anthropic',
        label: 'Anthropic Claude',
        baseURL: 'https://api.anthropic.com/v1',
        docs: 'https://console.anthropic.com/settings/keys',
        defaultModel: 'claude-sonnet-4-8',
        models: [
          { id: 'claude-opus-4-8', label: 'Claude Opus 4.8', desc: '最新旗舰 · 1M 上下文', cost: '$15/1M' },
          { id: 'claude-sonnet-4-8', label: 'Claude Sonnet 4.8', desc: '推荐 · 1M 上下文', cost: '$3/1M' },
          { id: 'claude-sonnet-4-7', label: 'Claude Sonnet 4.7', desc: '上一版旗舰', cost: '$3/1M' },
          { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5', desc: '快速便宜', cost: '$0.80/1M' },
          { id: 'claude-opus-4-5', label: 'Claude Opus 4.5', desc: '深度推理', cost: '$15/1M' },
        ],
      },
      {
        id: 'custom',
        label: 'Google Gemini',
        baseURL: 'https://generativelanguage.googleapis.com/v1beta',
        docs: 'https://aistudio.google.com/apikey',
        defaultModel: 'gemini-3-pro',
        models: [
          { id: 'gemini-3-pro', label: 'Gemini 3 Pro', desc: '最新旗舰 · 2M 上下文', cost: '$1.25/1M' },
          { id: 'gemini-3-flash', label: 'Gemini 3 Flash', desc: '快速便宜', cost: '$0.075/1M' },
          { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', desc: '稳定', cost: '$1.25/1M' },
          { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', desc: '老牌稳定', cost: '$0.075/1M' },
        ],
      },
      {
        id: 'custom',
        label: 'xAI Grok',
        baseURL: 'https://api.x.ai/v1',
        docs: 'https://console.x.ai',
        defaultModel: 'grok-3',
        models: [
          { id: 'grok-3', label: 'Grok 3', desc: '最新旗舰 · 128k', cost: '$3/1M' },
          { id: 'grok-3-mini', label: 'Grok 3 mini', desc: '快速便宜', cost: '$0.30/1M' },
        ],
      },
      {
        id: 'custom',
        label: 'Mistral AI',
        baseURL: 'https://api.mistral.ai/v1',
        docs: 'https://console.mistral.ai',
        defaultModel: 'mistral-large-latest',
        models: [
          { id: 'mistral-large-latest', label: 'Mistral Large', desc: '旗舰 · 多语言', cost: '$2/1M' },
          { id: 'codestral-latest', label: 'Codestral', desc: '代码专用', cost: '$0.20/1M' },
          { id: 'mistral-small-latest', label: 'Mistral Small', desc: '快速便宜', cost: '$0.20/1M' },
        ],
      },
      {
        id: 'custom',
        label: 'Custom (OpenAI 兼容)',
        baseURL: '',
        docs: '',
        defaultModel: 'gpt-4o-mini',
        models: [
          { id: 'gpt-4o-mini', label: 'gpt-4o-mini', desc: '通用模型', cost: '按平台' },
          { id: 'claude-sonnet-4-8', label: 'claude-sonnet-4-8', desc: 'Claude 兼容', cost: '按平台' },
        ],
      },
    ],
  },
  {
    id: 'china',
    flag: '🇨🇳',
    label: { zh: '国内厂商', en: 'China' },
    providers: [
      {
        id: 'custom',
        label: 'DeepSeek',
        baseURL: 'https://api.deepseek.com/v1',
        docs: 'https://platform.deepseek.com/api_keys',
        defaultModel: 'deepseek-v4-pro',
        models: [
          { id: 'deepseek-v4-pro', label: 'DeepSeek-V4 Pro 🆕', desc: '最新旗舰 · 1M 上下文 · 极致推理', cost: '¥4/1M' },
          { id: 'deepseek-v4-flash', label: 'DeepSeek-V4 Flash 🆕', desc: '最新快模型 · 便宜', cost: '¥0.5/1M' },
          { id: 'deepseek-v4', label: 'DeepSeek-V4', desc: '通用升级版', cost: '¥2/1M' },
          { id: 'deepseek-v4-lite', label: 'DeepSeek-V4 Lite', desc: '入门级', cost: '¥0.2/1M' },
          { id: 'deepseek-reasoner', label: 'DeepSeek-R1', desc: '推理强项', cost: '¥4/1M' },
          { id: 'deepseek-chat', label: 'DeepSeek-V3', desc: '上一版', cost: '¥1-2/1M' },
        ],
      },
      {
        id: 'custom',
        label: '智谱 GLM',
        baseURL: 'https://open.bigmodel.cn/api/paas/v4',
        docs: 'https://bigmodel.cn/usercenter/apikeys',
        defaultModel: 'glm-4.6',
        models: [
          { id: 'glm-4.6', label: 'GLM-4.6 🆕', desc: '最新旗舰', cost: '¥50/1M' },
          { id: 'glm-4.5', label: 'GLM-4.5', desc: '推理强', cost: '¥40/1M' },
          { id: 'glm-4-plus', label: 'GLM-4-Plus', desc: '通用', cost: '¥50/1M' },
          { id: 'glm-4-flash', label: 'GLM-4-Flash', desc: '免费 · 快速', cost: '免费' },
          { id: 'glm-4-air', label: 'GLM-4-Air', desc: '轻量', cost: '¥1/1M' },
          { id: 'glm-z1-air', label: 'GLM-Z1-Air', desc: '推理', cost: '免费' },
        ],
      },
      {
        id: 'custom',
        label: '通义千问 Qwen',
        baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        docs: 'https://dashscope.console.aliyun.com/apiKey',
        defaultModel: 'qwen3-max',
        models: [
          { id: 'qwen3-max', label: 'Qwen3-Max-Preview 🆕', desc: '最新旗舰 · 1M 上下文', cost: '¥20/1M' },
          { id: 'qwen3-plus', label: 'Qwen3-Plus', desc: '通用强', cost: '¥4/1M' },
          { id: 'qwen3-turbo', label: 'Qwen3-Turbo', desc: '快便宜', cost: '¥2/1M' },
          { id: 'qwen-max', label: 'Qwen-Max', desc: '上代旗舰', cost: '¥20/1M' },
          { id: 'qwen-plus', label: 'Qwen-Plus', desc: '通用', cost: '¥4/1M' },
          { id: 'qwen-coder-plus', label: 'Qwen-Coder-Plus', desc: '代码专用', cost: '¥4/1M' },
        ],
      },
      {
        id: 'custom',
        label: 'Kimi 月之暗面',
        baseURL: 'https://api.moonshot.cn/v1',
        docs: 'https://platform.moonshot.cn/console/api-keys',
        defaultModel: 'kimi-k2',
        models: [
          { id: 'kimi-k2', label: 'Kimi K2 🆕', desc: '最新旗舰 · 256k · 极致推理', cost: '¥12/1M' },
          { id: 'kimi-v2', label: 'Kimi v2', desc: '上一版', cost: '¥12/1M' },
          { id: 'moonshot-v1-128k', label: 'Moonshot v1 (128k)', desc: '长上下文', cost: '¥12/1M' },
          { id: 'moonshot-v1-32k', label: 'Moonshot v1 (32k)', desc: '中长', cost: '¥6/1M' },
        ],
      },
      {
        id: 'custom',
        label: '豆包 / 字节跳动',
        baseURL: 'https://ark.cn-beijing.volces.com/api/v3',
        docs: 'https://console.volcengine.com/ark',
        defaultModel: 'doubao-1-5-pro',
        models: [
          { id: 'doubao-1-5-pro', label: 'Doubao 1.5 Pro 🆕', desc: '最新旗舰 · 128k', cost: '¥0.8/1M' },
          { id: 'doubao-1-5-lite', label: 'Doubao 1.5 Lite 🆕', desc: '最新轻量', cost: '¥0.3/1M' },
          { id: 'doubao-pro-32k', label: 'Doubao Pro 32k', desc: '上一版', cost: '¥0.8/1M' },
          { id: 'doubao-lite-32k', label: 'Doubao Lite 32k', desc: '老牌轻量', cost: '¥0.3/1M' },
        ],
      },
      {
        id: 'custom',
        label: '腾讯混元 Hunyuan',
        baseURL: 'https://api.hunyuan.tencent.com/v1',
        docs: 'https://console.cloud.tencent.com/hunyuan',
        defaultModel: 'hunyuan-pro',
        models: [
          { id: 'hunyuan-pro', label: 'Hunyuan Pro', desc: '旗舰 · 256k', cost: '¥30/1M' },
          { id: 'hunyuan-standard', label: 'Hunyuan Standard', desc: '通用', cost: '¥10/1M' },
          { id: 'hunyuan-turbo', label: 'Hunyuan Turbo', desc: '快速', cost: '¥4/1M' },
        ],
      },
      {
        id: 'custom',
        label: '文心一言 百度',
        baseURL: 'https://qianfan.baidubce.com/v2',
        docs: 'https://console.bce.baidu.com/qianfan',
        defaultModel: 'ernie-4.5',
        models: [
          { id: 'ernie-4.5', label: 'ERNIE 4.5 🆕', desc: '最新旗舰 · 128k', cost: '¥20/1M' },
          { id: 'ernie-4.0', label: 'ERNIE 4.0', desc: '稳定', cost: '¥15/1M' },
          { id: 'ernie-3.5', label: 'ERNIE 3.5', desc: '便宜', cost: '¥4/1M' },
        ],
      },
      {
        id: 'custom',
        label: '百川',
        baseURL: 'https://api.baichuan-ai.com/v1',
        docs: 'https://platform.baichuan-ai.com/console/apikey',
        defaultModel: 'Baichuan4',
        models: [
          { id: 'Baichuan4', label: 'Baichuan 4', desc: '通用', cost: '¥40/1M' },
          { id: 'Baichuan3-Turbo', label: 'Baichuan 3 Turbo', desc: '快速', cost: '¥8/1M' },
        ],
      },
      {
        id: 'custom',
        label: '讯飞星火',
        baseURL: 'https://spark-api-open.xf-yun.com/v1',
        docs: 'https://console.xfyun.cn/services/bm3',
        defaultModel: 'generalv3.5',
        models: [
          { id: 'generalv3.5', label: 'Spark v3.5', desc: '通用', cost: '按 token' },
          { id: 'generalv3', label: 'Spark v3.0', desc: '稳定', cost: '按 token' },
        ],
      },
      {
        id: 'MiniMax',
        label: 'MiniMax (稀宇科技)',
        baseURL: 'https://api.minimaxi.com/anthropic/v1',
        docs: 'https://platform.minimaxi.com/docs/guides/models-intro',
        defaultModel: 'MiniMax-M3',
        models: [
          { id: 'MiniMax-M3', label: 'MiniMax-M3 🆕', desc: '最新旗舰 · 兼容 Claude API · 长上下文 + 推理', cost: '按 token' },
          { id: 'MiniMax-Text-01', label: 'MiniMax-Text-01', desc: '文本旗舰 · 456B MoE · 1M 上下文', cost: '¥1/1M in · ¥8/1M out' },
          { id: 'MiniMax-VL-01', label: 'MiniMax-VL-01', desc: '多模态视觉语言 · 图片理解', cost: '¥1/1M' },
          { id: 'abab6.5s-chat', label: 'ABAB 6.5s', desc: '上一代通用 · 仍可服务', cost: '¥0.3/1M' },
          { id: 'abab6.5g-chat', label: 'ABAB 6.5g', desc: '上一代 · 长文本', cost: '¥0.8/1M' },
          { id: 'abab7-chat', label: 'ABAB 7', desc: 'ABAB 系列上一版本', cost: '按 token' },
        ],
      },
    ],
  },
];

export function ApiKeyPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ai = useAI();
  const [region, setRegion] = useState<Region>('international');
  const [providerIdx, setProviderIdx] = useState(0);
  const [apiKey, setApiKey] = useState('');
  const [baseURL, setBaseURL] = useState('');
  const [model, setModel] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string; latencyMs?: number } | null>(null);
  const [filter, setFilter] = useState('');

  if (!open) return null;

  const currentRegion = REGIONS.find((r) => r.id === region)!;
  const currentProvider = currentRegion.providers[providerIdx];
  const currentModel = useMemo(() => {
    return currentProvider.models.find((m) => m.id === model) || currentProvider.models.find((m) => m.id === currentProvider.defaultModel) || currentProvider.models[0];
  }, [model, currentProvider]);

  const filteredModels = filter
    ? currentProvider.models.filter((m) => m.label.toLowerCase().includes(filter.toLowerCase()) || m.id.toLowerCase().includes(filter.toLowerCase()) || m.desc.toLowerCase().includes(filter.toLowerCase()))
    : currentProvider.models;

  const switchRegion = (r: Region) => {
    setRegion(r);
    setProviderIdx(0);
    const newReg = REGIONS.find((x) => x.id === r)!;
    setModel(newReg.providers[0].defaultModel);
    setBaseURL(newReg.providers[0].baseURL);
    setTestResult(null);
  };

  const switchProvider = (idx: number) => {
    setProviderIdx(idx);
    setModel(currentRegion.providers[idx].defaultModel);
    setBaseURL(currentRegion.providers[idx].baseURL);
    setTestResult(null);
  };

  const save = () => {
    if (!apiKey.trim()) return;
    ai.setKey(currentProvider.id, {
      apiKey: apiKey.trim(),
      baseURL: baseURL.trim() || currentProvider.baseURL || undefined,
      model,
    });
    setApiKey('');
    setTestResult(null);
  };

  const test = async () => {
    // Need a saved key to test
    if (!apiKey.trim()) {
      setTestResult({ ok: false, message: '请先填入 Key 再测试(可临时填一个)' });
      return;
    }
    // Temporarily set for test
    ai.setKey(currentProvider.id, { apiKey: apiKey.trim(), baseURL: baseURL.trim() || currentProvider.baseURL, model });
    setTesting(true);
    setTestResult(null);
    const r = await testConnection();
    setTestResult(r);
    setTesting(false);
  };

  const configuredKeys = ai.keys;
  const allConfigured = Object.entries(configuredKeys);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center"
      style={{ background: 'rgba(0, 0, 0, 0.55)', backdropFilter: 'blur(6px)', animation: 'backdropIn 0.2s ease' }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[760px] max-w-[94vw] h-[640px] max-h-[90vh] rounded-2xl overflow-hidden flex flex-col"
        style={{ background: 'var(--color-bg-main)', border: '1px solid var(--color-border)', boxShadow: '0 24px 80px rgba(0, 0, 0, 0.55)' }}
      >
        {/* Header */}
        <div className="px-6 pt-5 pb-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--color-border)' }}>
          <div className="flex items-center gap-2.5">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, var(--color-accent) 0%, var(--color-accent-soft) 100%)', boxShadow: '0 4px 14px var(--color-accent-glow)' }}
            >
              <Key size={16} strokeWidth={2} style={{ color: '#0a0a0c' }} />
            </div>
            <div>
              <h2 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>AI Provider 配置</h2>
              <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>为 AI 工具接入大模型能力(已配置 {allConfigured.length} 个)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ color: 'var(--color-text-muted)' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--color-bg-card)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* ─────── LEFT: 3-level menu (Region > Provider > Model) ─────── */}
          <div className="w-72 flex flex-col" style={{ borderRight: '1px solid var(--color-border)', background: 'var(--color-bg-sidebar)' }}>
            {/* Region tabs */}
            <div className="flex p-2 gap-1" style={{ borderBottom: '1px solid var(--color-border)' }}>
              {REGIONS.map((r) => (
                <button
                  key={r.id}
                  onClick={() => switchRegion(r.id)}
                  className="flex-1 h-8 px-2 rounded-md text-[12px] font-medium flex items-center justify-center gap-1.5 transition-colors"
                  style={{
                    background: region === r.id ? 'var(--color-accent-glow)' : 'transparent',
                    color: region === r.id ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                    border: `1px solid ${region === r.id ? 'var(--color-accent)' : 'var(--color-border)'}`,
                  }}
                >
                  <span className="text-[14px]">{r.flag}</span>
                  {r.label.zh}
                </button>
              ))}
            </div>

            {/* Provider list */}
            <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
              {currentRegion.providers.map((p, idx) => {
                const active = providerIdx === idx;
                const configured = !!configuredKeys[p.id] && configuredKeys[p.id].baseURL === p.baseURL;
                return (
                  <button
                    key={p.label + idx}
                    onClick={() => switchProvider(idx)}
                    className="w-full text-left px-3 py-2.5 rounded-md transition-colors"
                    style={{
                      background: active ? 'var(--color-bg-card)' : 'transparent',
                      border: `1px solid ${active ? 'var(--color-accent)' : 'transparent'}`,
                    }}
                    onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = 'var(--color-bg-card)'; }}
                    onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-medium" style={{ color: 'var(--color-text-primary)' }}>{p.label}</span>
                      {configured && <Check size={11} style={{ color: 'var(--color-success)' }} />}
                      {active && <ChevronRight size={11} className="ml-auto" style={{ color: 'var(--color-accent)' }} />}
                    </div>
                    <p className="text-[10px] mt-0.5 truncate" style={{ color: 'var(--color-text-muted)' }}>{p.models.length} 个模型 · {p.baseURL ? new URL(p.baseURL).hostname : '自定义'}</p>
                  </button>
                );
              })}
            </div>

            {/* Configured keys (quick switch) */}
            {allConfigured.length > 0 && (
              <div className="p-2" style={{ borderTop: '1px solid var(--color-border)' }}>
                <p className="text-[10px] font-semibold uppercase tracking-wider mb-1.5 px-2" style={{ color: 'var(--color-text-muted)' }}>已配置</p>
                <div className="space-y-0.5">
                  {allConfigured.map(([pid, k]) => {
                    const active = ai.activeProvider === pid;
                    return (
                      <div
                        key={pid}
                        className="px-2 py-1.5 rounded-md flex items-center gap-1.5 text-[11px]"
                        style={{ background: active ? 'var(--color-accent-glow)' : 'var(--color-bg-card)' }}
                      >
                        <Sparkles size={10} style={{ color: active ? 'var(--color-accent)' : 'var(--color-text-muted)' }} />
                        <span className="flex-1 truncate" style={{ color: 'var(--color-text-primary)' }}>
                          {k.model || pid}
                        </span>
                        {active ? <Zap size={10} style={{ color: 'var(--color-accent)' }} /> : (
                          <button
                            onClick={() => ai.setActiveProvider(pid as Provider)}
                            className="text-[10px] px-1.5 py-0.5 rounded"
                            style={{ background: 'var(--color-bg-main)', color: 'var(--color-text-muted)' }}
                          >
                            激活
                          </button>
                        )}
                        <button
                          onClick={() => ai.removeKey(pid as Provider)}
                          className="opacity-60 hover:opacity-100"
                          style={{ color: 'var(--color-warning)' }}
                          title="删除"
                        >
                          <Trash2 size={10} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* ─────── RIGHT: Form ─────── */}
          <div className="flex-1 flex flex-col overflow-y-auto p-5">
            {/* Provider header */}
            <div className="flex items-center gap-2 mb-3">
              <h3 className="text-[15px] font-semibold" style={{ color: 'var(--color-text-primary)' }}>{currentProvider.label}</h3>
              {currentProvider.docs && (
                <a href={currentProvider.docs} target="_blank" rel="noreferrer"
                  className="text-[11px] flex items-center gap-1 px-2 py-0.5 rounded"
                  style={{ background: 'var(--color-accent-glow)', color: 'var(--color-accent)' }}
                >
                  获取 Key <ExternalLink size={10} />
                </a>
              )}
            </div>

            {/* API Key */}
            <div className="mb-3">
              <label className="text-[11px] font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: 'var(--color-text-muted)' }}>API Key</label>
              <div className="relative">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-... 或对应平台的 key"
                  className="w-full h-9 pl-3 pr-10 rounded-lg text-[12px] font-mono outline-none"
                  style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--color-accent)'; e.currentTarget.style.boxShadow = '0 0 0 3px var(--color-accent-glow)'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.boxShadow = 'none'; }}
                />
                <button
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  {showKey ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
              </div>
            </div>

            {/* Base URL */}
            <div className="mb-3">
              <label className="text-[11px] font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: 'var(--color-text-muted)' }}>Base URL</label>
              <input
                type="text"
                value={baseURL}
                onChange={(e) => setBaseURL(e.target.value)}
                placeholder={currentProvider.baseURL || 'https://api.example.com/v1'}
                className="w-full h-9 px-3 rounded-lg text-[12px] font-mono outline-none"
                style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--color-accent)'; e.currentTarget.style.boxShadow = '0 0 0 3px var(--color-accent-glow)'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.boxShadow = 'none'; }}
              />
              <p className="text-[10px] mt-1" style={{ color: 'var(--color-text-muted)' }}>
                💡 留空使用默认地址。国内平台通常使用自家地址。
              </p>
            </div>

            {/* Model picker */}
            <div className="mb-3">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>模型</label>
                <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>{currentModel.label} · {currentModel.cost}</span>
              </div>
              <div className="relative mb-2">
                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }} />
                <input
                  type="text"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  placeholder="筛选模型..."
                  className="w-full h-7 pl-8 pr-2 rounded-md text-[11px] outline-none"
                  style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
                />
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {filteredModels.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setModel(m.id)}
                    className="text-left p-2 rounded-md transition-colors"
                    style={{
                      background: model === m.id ? 'var(--color-accent-glow)' : 'var(--color-bg-card)',
                      border: `1px solid ${model === m.id ? 'var(--color-accent)' : 'var(--color-border)'}`,
                    }}
                  >
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-[12px] font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>{m.label}</span>
                      {model === m.id && <Check size={10} style={{ color: 'var(--color-accent)' }} />}
                    </div>
                    <p className="text-[10px] truncate" style={{ color: 'var(--color-text-muted)' }}>{m.desc}</p>
                    <p className="text-[9px] mt-0.5 font-mono" style={{ color: 'var(--color-text-muted)' }}>{m.cost}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Test result */}
            {testResult && (
              <div
                className="rounded-lg p-3 flex items-start gap-2"
                style={{
                  background: testResult.ok ? 'rgba(52, 211, 153, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                  border: `1px solid ${testResult.ok ? 'var(--color-success)' : 'var(--color-warning)'}`,
                }}
              >
                {testResult.ok ? <Check size={14} className="mt-0.5" style={{ color: 'var(--color-success)' }} /> : <AlertCircle size={14} className="mt-0.5" style={{ color: 'var(--color-warning)' }} />}
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-semibold" style={{ color: testResult.ok ? 'var(--color-success)' : '#fca5a5' }}>
                    {testResult.ok ? '连接成功' : '连接失败'}
                    {testResult.latencyMs !== undefined && <span className="ml-2 opacity-70">{testResult.latencyMs} ms</span>}
                  </p>
                  <p className="text-[11px] mt-0.5 break-all" style={{ color: 'var(--color-text-secondary)' }}>{testResult.message}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 flex items-center justify-between" style={{ borderTop: '1px solid var(--color-border)' }}>
          <div className="flex items-center gap-1 text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
            <Globe size={11} />
            <span>当前: <span style={{ color: 'var(--color-text-primary)' }}>{currentRegion.flag} {currentRegion.label.zh} · {currentProvider.label}</span></span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={test}
              disabled={testing || !apiKey.trim()}
              className="h-9 px-3 rounded-lg text-[12px] font-medium flex items-center gap-1.5 transition-colors disabled:opacity-50"
              style={{ background: 'var(--color-bg-card)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)' }}
            >
              {testing ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
              {testing ? '测试中...' : '测试连接'}
            </button>
            <button
              onClick={onClose}
              className="h-9 px-3 rounded-lg text-[12px] font-medium"
              style={{ background: 'transparent', color: 'var(--color-text-secondary)' }}
            >
              取消
            </button>
            <ConfirmButton
              onClick={() => {
                if (!apiKey.trim()) return;
                save();
                if (ai.activeProvider !== currentProvider.id) ai.setActiveProvider(currentProvider.id);
                onClose();
              }}
              icon={Check}
            >
              保存
            </ConfirmButton>
          </div>
        </div>
      </div>
    </div>
  );
}
