import { useState, useMemo, useRef, useEffect } from 'react';
import { Network, Plus, Edit, Trash2, Download, Sparkles, ZoomIn, ZoomOut, Move } from 'lucide-react';
import { useI18n } from '../../hooks/useI18n';
import { Button } from '../ui/Button';

interface Node {
  id: string;
  label: string;
  parentId: string | null;
  color: string;
}

const PALETTE = [
  { name: 'indigo', color: '#6366f1' },
  { name: 'emerald', color: '#10b981' },
  { name: 'amber', color: '#f59e0b' },
  { name: 'rose', color: '#f43f5e' },
  { name: 'sky', color: '#0ea5e9' },
  { name: 'violet', color: '#8b5cf6' },
  { name: 'teal', color: '#14b8a6' },
];

const TEMPLATES: Record<string, { name: { zh: string; en: string }; center: string; branches: { label: string; subs: string[] }[] }> = {
  business: {
    name: { zh: '商业分析', en: 'Business' },
    center: '业务',
    branches: [
      { label: '市场', subs: ['规模', '增长', '竞争', '细分'] },
      { label: '用户', subs: ['画像', '需求', '行为', '痛点'] },
      { label: '产品', subs: ['功能', '体验', '定价', '迭代'] },
      { label: '运营', subs: ['获客', '留存', '转化', '复购'] },
      { label: '财务', subs: ['收入', '成本', '利润', '现金流'] },
      { label: '风险', subs: ['政策', '竞争', '技术', '市场'] },
    ],
  },
  product: {
    name: { zh: '产品设计', en: 'Product' },
    center: '产品',
    branches: [
      { label: '用户', subs: ['场景', '痛点', '目标'] },
      { label: '功能', subs: ['核心', '辅助', '扩展'] },
      { label: '体验', subs: ['交互', '视觉', '反馈'] },
      { label: '技术', subs: ['架构', '性能', '安全'] },
      { label: '数据', subs: ['埋点', '指标', '分析'] },
      { label: '运营', subs: ['推广', '留存', '变现'] },
    ],
  },
  study: {
    name: { zh: '学习计划', en: 'Study' },
    center: '主题',
    branches: [
      { label: '目标', subs: ['掌握', '应用', '输出'] },
      { label: '基础', subs: ['概念', '原理', '术语'] },
      { label: '方法', subs: ['输入', '练习', '复盘'] },
      { label: '资源', subs: ['书籍', '课程', '社区'] },
      { label: '时间', subs: ['日', '周', '月'] },
      { label: '评估', subs: ['自测', '应用', '反馈'] },
    ],
  },
  project: {
    name: { zh: '项目管理', en: 'Project' },
    center: '项目',
    branches: [
      { label: '目标', subs: ['范围', '质量', '时间'] },
      { label: '团队', subs: ['角色', '分工', '沟通'] },
      { label: '进度', subs: ['里程碑', '风险', '变更'] },
      { label: '资源', subs: ['预算', '工具', '外部'] },
      { label: '质量', subs: ['测试', '评审', '验收'] },
      { label: '沟通', subs: ['周会', '日报', '复盘'] },
    ],
  },
};

const MIND_KEY = 'ai-tools-launcher.mindmap.v1';

function loadNodes(): Node[] {
  try {
    const r = localStorage.getItem(MIND_KEY);
    if (r) return JSON.parse(r);
  } catch {}
  return [];
}
function saveNodes(n: Node[]) { try { localStorage.setItem(MIND_KEY, JSON.stringify(n)); } catch {} }

export function MindMapTool() {
  const { lang } = useI18n();
  const T = {
    title: lang === 'en' ? 'Mind Map' : '思维导图',
    sub: lang === 'en' ? 'Visual thinking, click to edit' : '可视化思维,点击编辑',
    template: lang === 'en' ? 'Template' : '模板',
    new: lang === 'en' ? 'New' : '新建',
    addNode: lang === 'en' ? 'Add child' : '添加子节点',
    edit: lang === 'en' ? 'Edit' : '编辑',
    delete: lang === 'en' ? 'Delete' : '删除',
    save: lang === 'en' ? 'Save' : '保存',
    export: lang === 'en' ? 'Export PNG' : '导出图片',
    clear: lang === 'en' ? 'Clear' : '清空',
    empty: lang === 'en' ? 'Pick a template or start from scratch' : '选个模板或从空白开始',
    centerPlaceholder: lang === 'en' ? 'Center topic' : '中心主题',
    branchPlaceholder: lang === 'en' ? 'Branch' : '分支',
    childPlaceholder: lang === 'en' ? 'Sub-item' : '子项',
    saved: lang === 'en' ? 'Saved' : '已保存',
    zoom: lang === 'en' ? 'Zoom' : '缩放',
  };

  const [nodes, setNodes] = useState<Node[]>(loadNodes);
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging] = useState<{ id: string; offset: { x: number; y: number } } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => { saveNodes(nodes); }, [nodes]);

  // Tree structure
  const tree = useMemo(() => {
    const map = new Map<string, Node[]>();
    nodes.forEach((n) => {
      const k = n.parentId || '_root';
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(n);
    });
    return map;
  }, [nodes]);

  const root = nodes.find((n) => n.parentId === null);

  const addNode = (parentId: string | null, label: string) => {
    const n: Node = {
      id: 'n_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
      label,
      parentId,
      color: PALETTE[(nodes.length) % PALETTE.length].color,
    };
    setNodes([...nodes, n]);
  };

  const updateNode = (id: string, patch: Partial<Node>) => {
    setNodes(nodes.map((n) => n.id === id ? { ...n, ...patch } : n));
  };

  const deleteNode = (id: string) => {
    const toDelete = new Set<string>([id]);
    const collectChildren = (pid: string) => {
      tree.get(pid)?.forEach((c) => { toDelete.add(c.id); collectChildren(c.id); });
    };
    collectChildren(id);
    setNodes(nodes.filter((n) => !toDelete.has(n.id)));
  };

  const startEdit = (id: string, current: string) => {
    setEditing(id);
    setEditValue(current);
  };

  const commitEdit = () => {
    if (editing && editValue.trim()) updateNode(editing, { label: editValue.trim() });
    setEditing(null);
  };

  const applyTemplate = (key: keyof typeof TEMPLATES) => {
    const tpl = TEMPLATES[key];
    const list: Node[] = [];
    const centerId = 'n_center';
    list.push({ id: centerId, label: tpl.center, parentId: null, color: '#c9a961' });
    tpl.branches.forEach((b, i) => {
      const branchId = `n_b${i}`;
      list.push({ id: branchId, label: b.label, parentId: centerId, color: PALETTE[i % PALETTE.length].color });
      b.subs.forEach((s, j) => {
        list.push({ id: `n_b${i}_${j}`, label: s, parentId: branchId, color: PALETTE[i % PALETTE.length].color });
      });
    });
    setNodes(list);
  };

  const clear = () => setNodes([]);

  // Export SVG as PNG
  const exportPng = () => {
    if (!canvasRef.current) return;
    // Build inline SVG from nodes
    const W = 1200, H = 800;
    const positions = computeLayout();
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`;
    svg += `<rect width="${W}" height="${H}" fill="${getComputedStyle(document.documentElement).getPropertyValue('--color-bg-main') || '#0e0e11'}"/>`;
    // Edges
    positions.forEach((p) => {
      if (p.parent) {
        const pp = positions.find((x) => x.id === p.parent)!;
        svg += `<line x1="${pp.x}" y1="${pp.y}" x2="${p.x}" y2="${p.y}" stroke="${p.color}" stroke-width="2" opacity="0.6"/>`;
      }
    });
    // Nodes
    positions.forEach((p) => {
      const w = Math.max(80, p.label.length * 12);
      svg += `<rect x="${p.x - w / 2}" y="${p.y - 18}" width="${w}" height="36" rx="8" fill="${p.color}"/>`;
      svg += `<text x="${p.x}" y="${p.y + 5}" text-anchor="middle" fill="#0a0a0c" font-size="13" font-weight="600" font-family="Inter, sans-serif">${p.label}</text>`;
    });
    svg += '</svg>';
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mindmap.svg';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Compute layout (radial)
  const computeLayout = () => {
    if (!root) return [];
    const centerX = 600, centerY = 400;
    const r1 = 180;
    const branches = tree.get(root.id) || [];
    return nodes.map((n) => {
      if (n.id === root.id) return { ...n, x: centerX, y: centerY, parent: null };
      const bIdx = branches.findIndex((b) => b.id === n.id);
      if (bIdx >= 0) {
        const angle = (bIdx / branches.length) * Math.PI * 2 - Math.PI / 2;
        return { ...n, x: centerX + Math.cos(angle) * r1, y: centerY + Math.sin(angle) * r1, parent: root.id };
      }
      // Child of a branch
      const parentNode = nodes.find((x) => x.id === n.parentId);
      if (parentNode) {
        const parentIdx = branches.findIndex((b) => b.id === parentNode.id);
        const angle = (parentIdx / branches.length) * Math.PI * 2 - Math.PI / 2;
        const baseX = centerX + Math.cos(angle) * r1;
        const baseY = centerY + Math.sin(angle) * r1;
        const siblings = tree.get(parentNode.id) || [];
        const sIdx = siblings.findIndex((s) => s.id === n.id);
        const subAngle = angle + (sIdx - siblings.length / 2) * 0.3;
        return { ...n, x: baseX + Math.cos(subAngle) * 140, y: baseY + Math.sin(subAngle) * 140, parent: parentNode.id };
      }
      return { ...n, x: centerX, y: centerY, parent: null };
    });
  };

  const positions = useMemo(() => computeLayout(), [nodes]);

  return (
    <div className="grid grid-cols-[260px_1fr] h-full">
      {/* Left: controls */}
      <div className="p-4 space-y-3 overflow-y-auto" style={{ borderRight: '1px solid var(--color-border)' }}>
        <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>{T.template}</p>
        <div className="space-y-1.5">
          {(Object.keys(TEMPLATES) as (keyof typeof TEMPLATES)[]).map((k) => (
            <button
              key={k}
              onClick={() => applyTemplate(k)}
              className="w-full h-8 px-3 rounded-lg text-[12px] font-medium text-left transition-colors flex items-center gap-2"
              style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-accent)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-border)'; }}
            >
              <Sparkles size={11} style={{ color: 'var(--color-accent)' }} />
              {TEMPLATES[k].name[lang]}
            </button>
          ))}
        </div>

        <button
          onClick={() => { const label = prompt(T.centerPlaceholder) || ''; if (label) setNodes([{ id: 'n_root', label, parentId: null, color: '#c9a961' }]); }}
          className="w-full h-8 px-3 rounded-lg text-[12px] font-medium flex items-center gap-2"
          style={{ background: 'var(--color-accent-glow)', color: 'var(--color-accent)', border: '1px dashed var(--color-accent)' }}
        >
          <Plus size={11} />
          {T.new}
        </button>

        <div className="pt-3 space-y-1.5" style={{ borderTop: '1px solid var(--color-border)' }}>
          <Button variant="secondary" fullWidth size="sm" onClick={exportPng} icon={Download}>{T.export}</Button>
          <Button variant="ghost" fullWidth size="sm" onClick={clear} icon={Trash2}>{T.clear}</Button>
        </div>

        <div className="pt-3 space-y-2" style={{ borderTop: '1px solid var(--color-border)' }}>
          <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>{T.zoom}</p>
          <div className="flex items-center gap-2">
            <button onClick={() => setZoom(Math.max(0.3, zoom - 0.1))} className="w-7 h-7 rounded-md flex items-center justify-center" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
              <ZoomOut size={12} />
            </button>
            <span className="flex-1 text-center text-[11px] font-mono" style={{ color: 'var(--color-text-secondary)' }}>{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom(Math.min(2, zoom + 0.1))} className="w-7 h-7 rounded-md flex items-center justify-center" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
              <ZoomIn size={12} />
            </button>
          </div>
          <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} className="w-full h-7 rounded-md text-[11px] flex items-center justify-center gap-1" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
            <Move size={10} />{lang === 'en' ? 'Reset view' : '重置视图'}
          </button>
        </div>
      </div>

      {/* Right: canvas */}
      <div className="overflow-hidden relative" style={{ background: 'var(--color-bg-deep)' }} ref={canvasRef}
        onMouseMove={() => {
          if (dragging) {
            // No-op for now; we don't support drag-move of nodes
          }
        }}
      >
        {nodes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Network size={48} strokeWidth={1.2} style={{ color: 'var(--color-text-muted)' }} />
            <p className="text-[13px] mt-3" style={{ color: 'var(--color-text-muted)' }}>{T.empty}</p>
          </div>
        ) : (
          <svg
            width="100%"
            height="100%"
            viewBox="0 0 1200 800"
            style={{ transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`, transformOrigin: 'center' }}
          >
            {/* Edges */}
            {positions.map((p) => {
              if (!p.parent) return null;
              const pp = positions.find((x) => x.id === p.parent);
              if (!pp) return null;
              return (
                <line
                  key={'e_' + p.id}
                  x1={pp.x} y1={pp.y}
                  x2={p.x} y2={p.y}
                  stroke={p.color}
                  strokeWidth={2}
                  opacity={0.6}
                />
              );
            })}
            {/* Nodes */}
            {positions.map((p) => {
              const w = Math.max(80, p.label.length * 13);
              const h = 36;
              const isEditing = editing === p.id;
              const isRoot = p.id === root?.id;
              return (
                <g key={p.id} transform={`translate(${p.x}, ${p.y})`}>
                  <rect
                    x={-w / 2} y={-h / 2}
                    width={w} height={h}
                    rx={isRoot ? 18 : 8}
                    fill={p.color}
                    stroke={isRoot ? 'var(--color-text-primary)' : 'transparent'}
                    strokeWidth={isRoot ? 2 : 0}
                    style={{ cursor: 'pointer' }}
                    onDoubleClick={() => startEdit(p.id, p.label)}
                  />
                  {isEditing ? (
                    <foreignObject x={-w / 2} y={-h / 2} width={w} height={h}>
                      <input
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={commitEdit}
                        onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditing(null); }}
                        autoFocus
                        style={{ width: '100%', height: '100%', background: 'transparent', border: 'none', outline: 'none', textAlign: 'center', color: '#0a0a0c', fontWeight: 600, fontSize: 13 }}
                      />
                    </foreignObject>
                  ) : (
                    <text
                      x={0} y={5}
                      textAnchor="middle"
                      fill="#0a0a0c"
                      fontSize={isRoot ? 15 : 13}
                      fontWeight={isRoot ? 700 : 600}
                      fontFamily="Inter, sans-serif"
                      style={{ pointerEvents: 'none' }}
                    >
                      {p.label}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        )}

        {/* Floating action hint when node selected */}
        {nodes.length > 0 && (
          <div
            className="absolute bottom-4 left-4 px-3 py-2 rounded-lg text-[11px] flex items-center gap-2"
            style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}
          >
            <Edit size={11} />
            {lang === 'en' ? 'Double-click to edit · Right-click for menu' : '双击编辑 · 选中节点后可加子项'}
          </div>
        )}

        {/* Floating node controls - shown when at least one node exists */}
        {root && (
          <div
            className="absolute top-4 right-4 rounded-lg p-2 space-y-1"
            style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
          >
            <button
              onClick={() => {
                const label = prompt(T.branchPlaceholder) || '';
                if (label) addNode(root.id, label);
              }}
              className="w-full h-7 px-2 rounded text-[11px] flex items-center gap-1.5"
              style={{ color: 'var(--color-text-primary)' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--color-bg-card-hover)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            >
              <Plus size={10} /> {T.addNode}
            </button>
          </div>
        )}

        {/* Context menu: click any node button to add/edit/delete */}
        {root && (
          <NodeContextMenu nodes={nodes} addNode={addNode} updateNode={updateNode} deleteNode={deleteNode} T={T} lang={lang} />
        )}
      </div>
    </div>
  );
}

function NodeContextMenu({ nodes, addNode, updateNode, deleteNode, T, lang }: { nodes: Node[]; addNode: (parentId: string | null, label: string) => void; updateNode: (id: string, patch: Partial<Node>) => void; deleteNode: (id: string) => void; T: any; lang: 'zh' | 'en' }) {
  // Render a "nodes list" panel at the bottom of canvas
  return (
    <div
      className="absolute bottom-4 right-4 rounded-lg p-3 max-w-xs"
      style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', maxHeight: 320, overflowY: 'auto' }}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--color-text-muted)' }}>{lang === 'en' ? 'Node manager' : '节点管理'}</p>
      <div className="space-y-1">
        {nodes.map((n: Node) => (
          <div key={n.id} className="flex items-center gap-1 text-[11px]">
            <div className="w-2 h-2 rounded-full shrink-0" style={{ background: n.color }} />
            <span className="truncate flex-1" style={{ color: 'var(--color-text-secondary)' }}>{n.label}</span>
            <button
              onClick={() => {
                const label = prompt(lang === 'en' ? 'Sub-item:' : '子项:') || '';
                if (label) addNode(n.id, label);
              }}
              className="w-5 h-5 rounded flex items-center justify-center"
              style={{ color: 'var(--color-text-muted)' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--color-text-primary)'; (e.currentTarget as HTMLElement).style.background = 'var(--color-bg-card-hover)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--color-text-muted)'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              title={T.addNode}
            >
              <Plus size={10} />
            </button>
            <button
              onClick={() => {
                const label = prompt(lang === 'en' ? 'Rename:' : '重命名:', n.label) || '';
                if (label) updateNode(n.id, { label });
              }}
              className="w-5 h-5 rounded flex items-center justify-center"
              style={{ color: 'var(--color-text-muted)' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--color-text-primary)'; (e.currentTarget as HTMLElement).style.background = 'var(--color-bg-card-hover)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--color-text-muted)'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              title={T.edit}
            >
              <Edit size={10} />
            </button>
            <button
              onClick={() => { if (confirm(`${T.delete} "${n.label}"?`)) deleteNode(n.id); }}
              className="w-5 h-5 rounded flex items-center justify-center"
              style={{ color: 'var(--color-warning)' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(239, 68, 68, 0.12)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              title={T.delete}
            >
              <Trash2 size={10} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
