import { useState, useRef } from 'react';
import { BarChart3, Upload, Sparkles, FileSpreadsheet, Hash, Type, Calendar } from 'lucide-react';
import { useI18n } from '../../hooks/useI18n';
import { Button, ConfirmButton } from '../ui/Button';

interface DataColumn {
  name: string;
  type: 'number' | 'string' | 'date';
  samples: string[];
  stats?: {
    count: number;
    min: number;
    max: number;
    sum: number;
    avg: number;
    median: number;
    unique: number;
  };
}

interface ParsedData {
  columns: DataColumn[];
  rows: any[][];
  fileName: string;
}

function detectType(samples: string[]): 'number' | 'date' | 'string' {
  let numCount = 0, dateCount = 0;
  for (const s of samples) {
    if (!s) continue;
    if (!isNaN(Number(s)) && s.trim() !== '') numCount++;
    else if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(s) || /^\d{1,2}[-/]\d{1,2}[-/]\d{2,4}/.test(s)) dateCount++;
  }
  if (numCount / samples.length > 0.8) return 'number';
  if (dateCount / samples.length > 0.6) return 'date';
  return 'string';
}

function parseCSV(text: string): ParsedData {
  // Simple CSV parser (handles quoted strings)
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return { columns: [], rows: [], fileName: '' };

  const parseRow = (line: string): string[] => {
    const result: string[] = [];
    let cur = '';
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (inQuote && line[i + 1] === '"') { cur += '"'; i++; }
        else inQuote = !inQuote;
      } else if (c === ',' && !inQuote) {
        result.push(cur); cur = '';
      } else {
        cur += c;
      }
    }
    result.push(cur);
    return result;
  };

  const headers = parseRow(lines[0]);
  const dataRows = lines.slice(1).map(parseRow);

  // Build columns with samples
  const columns: DataColumn[] = headers.map((h, i) => {
    const samples = dataRows.slice(0, 20).map((r) => (r[i] || '').trim());
    const type = detectType(samples);
    const col: DataColumn = { name: h, type, samples };
    if (type === 'number') {
      const values = dataRows.map((r) => Number(r[i])).filter((v) => !isNaN(v));
      if (values.length > 0) {
        const sorted = [...values].sort((a, b) => a - b);
        col.stats = {
          count: values.length,
          min: sorted[0],
          max: sorted[sorted.length - 1],
          sum: values.reduce((s, v) => s + v, 0),
          avg: values.reduce((s, v) => s + v, 0) / values.length,
          median: sorted[Math.floor(sorted.length / 2)],
          unique: new Set(values).size,
        };
      }
    } else if (type === 'string') {
      col.stats = {
        count: 0, min: 0, max: 0, sum: 0, avg: 0, median: 0,
        unique: new Set(dataRows.map((r) => r[i])).size,
      };
    }
    return col;
  });

  return { columns, rows: dataRows, fileName: '' };
}

export function DataAnalysisTool() {
  const { lang } = useI18n();
  const T = {
    title: lang === 'en' ? 'Data Analysis' : '数据分析',
    sub: lang === 'en' ? 'Upload CSV, get instant insights' : '上传 CSV,即时分析',
    upload: lang === 'en' ? 'Upload CSV' : '上传 CSV',
    sample: lang === 'en' ? 'Try sample data' : '试试示例数据',
    cols: lang === 'en' ? 'Columns' : '列',
    rows: lang === 'en' ? 'Rows' : '行',
    stats: lang === 'en' ? 'Statistics' : '统计',
    preview: lang === 'en' ? 'Data preview' : '数据预览',
    distribution: lang === 'en' ? 'Value distribution' : '值分布',
    noData: lang === 'en' ? 'Upload a CSV to start' : '上传 CSV 文件开始',
    rowCount: lang === 'en' ? 'rows' : '行',
    colCount: lang === 'en' ? 'columns' : '列',
    min: 'Min', max: 'Max', avg: 'Avg', sum: 'Sum', median: 'Median', unique: 'Unique',
    reset: lang === 'en' ? 'Reset' : '重置',
  };

  const [data, setData] = useState<ParsedData | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const parsed = parseCSV(text);
      parsed.fileName = file.name;
      setData(parsed);
    };
    reader.readAsText(file);
  };

  const loadSample = () => {
    // Sample: monthly sales by region
    const sample = `Month,Region,Product,Sales,Units
2026-01,East,GPT Pro,12500,42
2026-01,West,GPT Pro,9800,31
2026-01,East,Claude Pro,15200,38
2026-01,South,Claude Pro,7800,25
2026-02,East,GPT Pro,14200,48
2026-02,West,GPT Pro,11000,35
2026-02,East,Claude Pro,16800,42
2026-02,South,Claude Pro,9200,29
2026-03,East,GPT Pro,15600,52
2026-03,West,GPT Pro,12500,40
2026-03,East,Claude Pro,18500,46
2026-03,South,Claude Pro,10800,34
2026-04,East,GPT Pro,18900,63
2026-04,West,GPT Pro,14200,45
2026-04,East,Claude Pro,22000,55
2026-04,South,Claude Pro,13500,42`;
    const parsed = parseCSV(sample);
    parsed.fileName = 'sample_sales.csv';
    setData(parsed);
  };

  // Histogram for number columns
  const histogram = (col: DataColumn) => {
    if (!col.stats) return [];
    const { min, max } = col.stats;
    const bucketCount = Math.min(10, col.stats.count);
    const step = (max - min) / bucketCount || 1;
    const buckets = Array.from({ length: bucketCount }, (_, i) => ({
      range: `${(min + i * step).toFixed(0)}-${(min + (i + 1) * step).toFixed(0)}`,
      count: 0,
    }));
    data?.rows.forEach((r) => {
      const idx = data.columns.indexOf(col);
      const v = Number(r[idx]);
      if (isNaN(v)) return;
      const bIdx = Math.min(bucketCount - 1, Math.floor((v - min) / step));
      buckets[bIdx].count++;
    });
    return buckets;
  };

  // Top values for string columns
  const topValues = (col: DataColumn) => {
    if (!data) return [];
    const idx = data.columns.indexOf(col);
    const map = new Map<string, number>();
    data.rows.forEach((r) => {
      const v = (r[idx] || '').trim();
      if (v) map.set(v, (map.get(v) || 0) + 1);
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 pt-4 pb-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--color-border)' }}>
        <div className="flex items-center gap-3">
          <h2 className="text-[14px] font-semibold" style={{ color: 'var(--color-text-primary)' }}>{data?.fileName || T.title}</h2>
          {data && (
            <div className="flex items-center gap-2 text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
              <span className="flex items-center gap-1"><Hash size={10} />{data.rows.length} {T.rowCount}</span>
              <span className="flex items-center gap-1"><BarChart3 size={10} />{data.columns.length} {T.colCount}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => e.target.files?.[0] && loadFile(e.target.files[0])} />
          <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()} icon={Upload}>{T.upload}</Button>
          <ConfirmButton onClick={loadSample} size="sm" icon={Sparkles}>{T.sample}</ConfirmButton>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {!data ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <FileSpreadsheet size={48} strokeWidth={1.2} style={{ color: 'var(--color-text-muted)' }} />
            <p className="text-[13px] mt-3" style={{ color: 'var(--color-text-muted)' }}>{T.noData}</p>
            <p className="text-[11px] mt-1" style={{ color: 'var(--color-text-muted)' }}>CSV 格式 · 第一行表头 · 支持逗号分隔</p>
            <div className="flex gap-2 mt-4">
              <Button variant="secondary" onClick={() => fileRef.current?.click()} icon={Upload}>{T.upload}</Button>
              <ConfirmButton onClick={loadSample} icon={Sparkles}>{T.sample}</ConfirmButton>
            </div>
          </div>
        ) : (
          <div className="space-y-4 max-w-6xl mx-auto">
            {/* Columns summary */}
            <div className="grid grid-cols-2 gap-3">
              {data.columns.map((col, i) => (
                <div key={i} className="rounded-xl p-4" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
                  <div className="flex items-center gap-2 mb-2">
                    <div
                      className="w-7 h-7 rounded-md flex items-center justify-center"
                      style={{ background: col.type === 'number' ? 'var(--color-accent-glow)' : col.type === 'date' ? 'rgba(14, 165, 233, 0.12)' : 'var(--color-bg-main)' }}
                    >
                      {col.type === 'number' && <Hash size={13} style={{ color: 'var(--color-accent)' }} />}
                      {col.type === 'date' && <Calendar size={13} style={{ color: '#0ea5e9' }} />}
                      {col.type === 'string' && <Type size={13} style={{ color: 'var(--color-text-muted)' }} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>{col.name}</p>
                      <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>{col.type === 'number' ? '数字' : col.type === 'date' ? '日期' : '文本'}</p>
                    </div>
                  </div>

                  {col.stats && col.type === 'number' && (
                    <>
                      <div className="grid grid-cols-3 gap-1.5 mb-3">
                        <StatMini label="Min" value={col.stats.min.toFixed(2)} />
                        <StatMini label="Avg" value={col.stats.avg.toFixed(2)} />
                        <StatMini label="Max" value={col.stats.max.toFixed(2)} />
                      </div>
                      <MiniBar buckets={histogram(col)} />
                    </>
                  )}

                  {col.type === 'string' && col.stats && (
                    <>
                      <p className="text-[11px] mb-2" style={{ color: 'var(--color-text-muted)' }}>{col.stats.unique} 个唯一值</p>
                      <div className="space-y-1">
                        {topValues(col).map(([v, c]) => {
                          const max = topValues(col)[0]?.[1] || 1;
                          return (
                            <div key={v} className="flex items-center gap-2 text-[11px]">
                              <span className="w-20 truncate" style={{ color: 'var(--color-text-secondary)' }}>{v}</span>
                              <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--color-bg-main)' }}>
                                <div className="h-full" style={{ width: `${(c / max) * 100}%`, background: 'var(--color-accent)' }} />
                              </div>
                              <span className="w-8 text-right font-mono" style={{ color: 'var(--color-text-muted)' }}>{c}</span>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>

            {/* Data preview */}
            <div className="rounded-xl overflow-hidden" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
              <div className="px-4 py-2.5 flex items-center justify-between" style={{ borderBottom: '1px solid var(--color-border)' }}>
                <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>{T.preview}</p>
                <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>前 20 行</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[12px]">
                  <thead>
                    <tr style={{ background: 'var(--color-bg-main)' }}>
                      <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)', width: 40 }}>#</th>
                      {data.columns.map((c, i) => (
                        <th key={i} className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                          <div className="flex items-center gap-1">
                            {c.type === 'number' && <Hash size={9} style={{ color: 'var(--color-accent)' }} />}
                            {c.type === 'date' && <Calendar size={9} style={{ color: '#0ea5e9' }} />}
                            {c.type === 'string' && <Type size={9} style={{ color: 'var(--color-text-muted)' }} />}
                            {c.name}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.slice(0, 20).map((row, i) => (
                      <tr key={i} style={{ borderTop: '1px solid var(--color-border)' }}>
                        <td className="px-3 py-1.5 text-[10px] font-mono" style={{ color: 'var(--color-text-muted)' }}>{i + 1}</td>
                        {row.map((cell, j) => {
                          const col = data.columns[j];
                          const isNum = col?.type === 'number';
                          return (
                            <td
                              key={j}
                              className="px-3 py-1.5 tabular-nums"
                              style={{ color: isNum ? 'var(--color-accent)' : 'var(--color-text-primary)' }}
                            >
                              {cell}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatMini({ label, value }: any) {
  return (
    <div className="rounded-md py-1 text-center" style={{ background: 'var(--color-bg-main)' }}>
      <div className="text-[12px] font-semibold tabular-nums" style={{ color: 'var(--color-text-primary)' }}>{value}</div>
      <div className="text-[9px] uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>{label}</div>
    </div>
  );
}

function MiniBar({ buckets }: { buckets: { range: string; count: number }[] }) {
  if (buckets.length === 0) return null;
  const max = Math.max(...buckets.map((b) => b.count), 1);
  return (
    <div className="space-y-0.5">
      {buckets.map((b, i) => (
        <div key={i} className="flex items-center gap-2 text-[10px]">
          <span className="w-16 truncate text-right font-mono" style={{ color: 'var(--color-text-muted)' }}>{b.range}</span>
          <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--color-bg-main)' }}>
            <div className="h-full" style={{ width: `${(b.count / max) * 100}%`, background: 'var(--color-accent)' }} />
          </div>
          <span className="w-6 text-right font-mono" style={{ color: 'var(--color-text-muted)' }}>{b.count}</span>
        </div>
      ))}
    </div>
  );
}
