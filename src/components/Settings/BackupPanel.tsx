import { useRef, useState } from 'react';
import { Download, Upload, Trash2, Shield, AlertTriangle, Check } from 'lucide-react';

/**
 * BackupPanel — export/import/clear every localStorage key the app owns.
 *
 * Why: nothing in this app hits a backend. All data (settings, AI
 * providers, users, favorites, tool history, Pomodoro sessions, medication
 * reminders, mood logs) lives in localStorage. If a future browser update,
 * extension, or power loss nukes that storage, all state is gone. The
 * user asked for a "rollback version" — this is it: a single JSON file
 * that captures the entire localStorage state of the app and can be
 * re-imported later.
 *
 * Format
 * ------
 *   {
 *     "version": 1,
 *     "exportedAt": "2026-06-05T00:00:00.000Z",
 *     "keys": {
 *       "ai-tools-launcher.settings.v1": { ... },
 *       "ai-tools-launcher.users.v1":    [ ... ],
 *       ...
 *     }
 *   }
 *
 * Only keys prefixed with "ai-tools-launcher." are touched on import —
 * unrelated localStorage entries (from other apps / browser settings)
 * are left alone, so the file is safe to keep around.
 */

const KEY_PREFIX = 'ai-tools-launcher.';

function snapshotLocalStorage(): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(KEY_PREFIX)) {
      const raw = localStorage.getItem(k);
      try {
        out[k] = raw === null ? null : JSON.parse(raw);
      } catch {
        // Non-JSON value — keep as raw string
        out[k] = raw;
      }
    }
  }
  return out;
}

function downloadBlob(filename: string, mime: string, content: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function ts() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

export function BackupPanel() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [confirming, setConfirming] = useState<null | 'import' | 'clear'>(null);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const handleExport = () => {
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      app: 'ai-tools-launcher',
      keys: snapshotLocalStorage(),
    };
    const json = JSON.stringify(payload, null, 2);
    const count = Object.keys(payload.keys).length;
    downloadBlob(
      `ai-tools-launcher-backup-${ts()}.json`,
      'application/json;charset=utf-8',
      json
    );
    setResult({ ok: true, message: `已导出 ${count} 项数据` });
  };

  const handleImport = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result || '');
        const data = JSON.parse(text);
        if (!data || typeof data !== 'object' || !data.keys || typeof data.keys !== 'object') {
          setResult({ ok: false, message: '文件格式不对,需要 { keys: { ... } } 结构' });
          return;
        }
        let restored = 0;
        for (const [k, v] of Object.entries(data.keys)) {
          if (typeof k === 'string' && k.startsWith(KEY_PREFIX)) {
            localStorage.setItem(k, JSON.stringify(v));
            restored += 1;
          }
        }
        setResult({ ok: true, message: `已恢复 ${restored} 项,刷新页面生效` });
        setConfirming(null);
      } catch (e: any) {
        setResult({ ok: false, message: `解析失败: ${e?.message || '未知错误'}` });
      }
    };
    reader.readAsText(file);
  };

  const handleClear = () => {
    if (confirming !== 'clear') {
      setConfirming('clear');
      setTimeout(() => setConfirming(null), 3000);
      return;
    }
    const removed: string[] = [];
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith(KEY_PREFIX)) {
        localStorage.removeItem(k);
        removed.push(k);
      }
    }
    setResult({ ok: true, message: `已清除 ${removed.length} 项,刷新页面生效` });
    setConfirming(null);
  };

  return (
    <div
      className="rounded-xl p-4 space-y-3"
      style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
    >
      <div className="flex items-start gap-2.5">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: 'var(--color-accent-glow)', color: 'var(--color-accent)' }}
        >
          <Shield size={16} strokeWidth={1.8} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium" style={{ color: 'var(--color-text-primary)' }}>
            本地数据备份
          </p>
          <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
            应用所有数据(设置、AI Key、收藏、历史、用药提醒、心情打卡)都存在浏览器本地。导出 JSON 备份,出问题可恢复。
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={handleExport}
          className="h-8 px-3 rounded-lg text-[12px] font-medium flex items-center gap-1.5 transition-colors"
          style={{
            background: 'var(--color-bg-main)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text-primary)',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--color-bg-card-hover)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--color-bg-main)'; }}
        >
          <Download size={13} strokeWidth={1.8} />
          导出备份
        </button>

        <button
          onClick={() => {
            if (confirming === 'import') {
              fileInputRef.current?.click();
              return;
            }
            setConfirming('import');
            setTimeout(() => setConfirming(null), 3000);
          }}
          className="h-8 px-3 rounded-lg text-[12px] font-medium flex items-center gap-1.5 transition-colors"
          style={{
            background: confirming === 'import' ? 'var(--color-accent-glow)' : 'var(--color-bg-main)',
            border: `1px solid ${confirming === 'import' ? 'var(--color-accent)' : 'var(--color-border)'}`,
            color: confirming === 'import' ? 'var(--color-accent)' : 'var(--color-text-primary)',
          }}
        >
          <Upload size={13} strokeWidth={1.8} />
          {confirming === 'import' ? '再点确认选文件' : '从备份恢复'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleImport(f);
            e.target.value = '';
          }}
        />

        <button
          onClick={handleClear}
          className="h-8 px-3 rounded-lg text-[12px] font-medium flex items-center gap-1.5 transition-colors"
          style={{
            background: 'var(--color-bg-main)',
            border: `1px solid ${confirming === 'clear' ? 'var(--color-warning)' : 'var(--color-border)'}`,
            color: confirming === 'clear' ? 'var(--color-warning)' : 'var(--color-text-muted)',
          }}
        >
          <Trash2 size={13} strokeWidth={1.8} />
          {confirming === 'clear' ? '再点确认清除' : '清空全部数据'}
        </button>
      </div>

      {result && (
        <div
          className="rounded-lg p-2.5 flex items-start gap-2 text-[12px]"
          style={{
            background: result.ok ? 'rgba(52, 211, 153, 0.08)' : 'rgba(251, 191, 36, 0.08)',
            border: `1px solid ${result.ok ? 'var(--color-success)' : 'var(--color-warning)'}`,
            color: result.ok ? 'var(--color-success)' : 'var(--color-warning)',
          }}
        >
          {result.ok
            ? <Check size={13} className="mt-0.5 shrink-0" />
            : <AlertTriangle size={13} className="mt-0.5 shrink-0" />}
          <span>{result.message}</span>
        </div>
      )}
    </div>
  );
}
