import { useRef, useState } from 'react';
import { Upload, FileText, X, AlertCircle } from 'lucide-react';

/**
 * FileUpload — drop a text-ish file in, get its content back as a string.
 *
 * Supports .txt / .md / .csv / .json / .ts / .js / .py / etc. by reading
 * as UTF-8. For binary files the reader will still return raw text but
 * it'll be garbage — which is fine because the AI is the consumer and
 * will just see nonsense.
 *
 * MAX_BYTES caps very large files at 200 KB (above that the AI context
 * window explodes). Bump if you need more.
 *
 * Usage
 * -----
 *   <FileUpload onText={(text, name) => setInput(text)} />
 *   ...
 *   <textarea value={input} onChange={...} />
 */
const MAX_BYTES = 200 * 1024;
const ACCEPT = '.txt,.md,.markdown,.csv,.json,.ts,.tsx,.js,.jsx,.py,.java,.c,.cpp,.go,.rs,.rb,.php,.html,.css,.xml,.yaml,.yml,.sql,.log,.ini,.conf,.sh,.bat,.ps1,.tsv,.mdx';

export interface FileUploadProps {
  /** Called with file content and filename when a file is loaded. */
  onText: (text: string, filename: string) => void;
  /** Optional class for the wrapper. */
  className?: string;
  /** Compact variant (inline button only). */
  compact?: boolean;
  /** Label override. */
  label?: string;
  /** Custom accept list. Default covers most text-ish files. */
  accept?: string;
}

export function FileUpload({ onText, className = '', compact = false, label, accept = ACCEPT }: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [current, setCurrent] = useState<{ name: string; size: number; chars: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFile = (file: File) => {
    setError(null);
    if (file.size > MAX_BYTES) {
      setError(`文件过大 (${(file.size / 1024).toFixed(0)} KB > ${MAX_BYTES / 1024} KB 上限)`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || '');
      onText(text, file.name);
      setCurrent({ name: file.name, size: file.size, chars: text.length });
    };
    reader.onerror = () => setError(`读取失败: ${reader.error?.message || '未知错误'}`);
    reader.readAsText(file);
  };

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
    // Reset so picking the same file again still triggers onChange
    e.target.value = '';
  };

  const onDrop = (e: React.DragEvent<HTMLButtonElement>) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  };

  if (compact) {
    return (
      <>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className={`h-7 px-2 rounded-md text-[11px] flex items-center gap-1 transition-colors ${className}`}
          style={{
            background: 'var(--color-bg-card)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text-secondary)',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--color-bg-card-hover)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--color-bg-card)'; }}
          title={label ?? '上传文件'}
        >
          <Upload size={11} strokeWidth={1.8} />
          {label ?? '上传文件'}
        </button>
        <input ref={inputRef} type="file" accept={accept} onChange={onChange} className="hidden" />
      </>
    );
  }

  return (
    <div className={className}>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
          className="h-8 px-3 rounded-md text-[12px] flex items-center gap-1.5 transition-colors"
          style={{
            background: 'var(--color-bg-card)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text-secondary)',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--color-bg-card-hover)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--color-bg-card)'; }}
          title="点击或拖入文件"
        >
          <Upload size={12} strokeWidth={1.8} />
          {label ?? '上传文件'}
        </button>
        <input ref={inputRef} type="file" accept={accept} onChange={onChange} className="hidden" />
        {current && (
          <div
            className="flex items-center gap-1.5 text-[11px] px-2 py-1 rounded"
            style={{ background: 'var(--color-bg-card)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)' }}
          >
            <FileText size={11} />
            <span className="font-medium">{current.name}</span>
            <span style={{ color: 'var(--color-text-muted)' }}>
              {current.chars.toLocaleString()} 字
            </span>
            <button
              onClick={() => { setCurrent(null); onText('', ''); }}
              className="ml-1 flex items-center justify-center"
              style={{ color: 'var(--color-text-muted)' }}
              title="移除"
            >
              <X size={11} />
            </button>
          </div>
        )}
      </div>
      {error && (
        <div
          className="mt-1.5 flex items-center gap-1.5 text-[11px] px-2 py-1 rounded"
          style={{ background: 'rgba(239, 68, 68, 0.08)', color: 'var(--color-warning)', border: '1px solid var(--color-warning)' }}
        >
          <AlertCircle size={11} />
          {error}
        </div>
      )}
    </div>
  );
}
