import { useState } from 'react';
import { X, Users, Wrench, MessageSquare, BarChart3, Bell, Search, Shield, ShieldOff, Trash2, KeyRound, Check } from 'lucide-react';
import { useAuth, type User, type Role } from '../hooks/useAuth';
import { useI18n } from '../hooks/useI18n';
import { Button, ConfirmButton, DeleteButton } from './ui/Button';
import { categories, toolsByCategory } from '../data/tools';
import { LIFE_TOOLS } from './life/LifeTools';
import { TEXT_TOOLS } from './text/TextTools';

type AdminTab = 'overview' | 'users' | 'tools' | 'feedback' | 'announcements';

interface AdminPanelProps { open: boolean; onClose: () => void; }

export function AdminPanel({ open, onClose }: AdminPanelProps) {
  const { lang } = useI18n();
  const [tab, setTab] = useState<AdminTab>('overview');

  const T = {
    title: lang === 'en' ? 'Admin Console' : '管理员控制台',
    tabs: {
      overview: lang === 'en' ? 'Overview' : '总览',
      users: lang === 'en' ? 'Users' : '用户',
      tools: lang === 'en' ? 'Tools' : '工具',
      feedback: lang === 'en' ? 'Feedback' : '反馈',
      announcements: lang === 'en' ? 'Announce' : '公告',
    },
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center"
      style={{ background: 'rgba(0, 0, 0, 0.55)', backdropFilter: 'blur(6px)', animation: 'backdropIn 0.2s ease' }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[1100px] max-w-[96vw] h-[700px] max-h-[92vh] rounded-2xl overflow-hidden flex"
        style={{
          background: 'var(--color-bg-main)',
          border: '1px solid var(--color-border)',
          boxShadow: '0 24px 80px rgba(0, 0, 0, 0.55), 0 8px 24px rgba(0, 0, 0, 0.35)',
          animation: 'authIn 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <AdminSidebar tab={tab} setTab={setTab} T={T} onClose={onClose} lang={lang} />
        <div className="flex-1 flex flex-col min-w-0">
          <AdminHeader title={T.tabs[tab]} onClose={onClose} />
          <div className="flex-1 overflow-y-auto">
            {tab === 'overview' && <OverviewTab lang={lang} />}
            {tab === 'users' && <UsersTab lang={lang} />}
            {tab === 'tools' && <ToolsTab lang={lang} />}
            {tab === 'feedback' && <FeedbackTab lang={lang} />}
            {tab === 'announcements' && <AnnouncementsTab lang={lang} />}
          </div>
        </div>
      </div>
      <style>{`
        @keyframes authIn { from { opacity: 0; transform: scale(0.96) translateY(8px); } to { opacity: 1; transform: scale(1) translateY(0); } }
      `}</style>
    </div>
  );
}

function AdminSidebar({ tab, setTab, T, onClose, lang }: any) {
  return (
    <aside className="w-56 shrink-0 flex flex-col py-5" style={{ background: 'var(--color-bg-sidebar)', borderRight: '1px solid var(--color-border)' }}>
      <div className="px-5 mb-5 flex items-center gap-2.5">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, var(--color-accent) 0%, var(--color-accent-soft) 100%)', boxShadow: '0 4px 14px var(--color-accent-glow)' }}
        >
          <Shield size={18} strokeWidth={2} style={{ color: '#fff' }} />
        </div>
        <div>
          <div className="text-[14px] font-semibold" style={{ color: 'var(--color-text-primary)' }}>{T.title}</div>
          <div className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>v1.0</div>
        </div>
      </div>
      <nav className="flex-1 px-3 space-y-0.5">
        <SideItem icon={BarChart3} label={T.tabs.overview} active={tab === 'overview'} onClick={() => setTab('overview')} />
        <SideItem icon={Users} label={T.tabs.users} active={tab === 'users'} onClick={() => setTab('users')} />
        <SideItem icon={Wrench} label={T.tabs.tools} active={tab === 'tools'} onClick={() => setTab('tools')} />
        <SideItem icon={MessageSquare} label={T.tabs.feedback} active={tab === 'feedback'} onClick={() => setTab('feedback')} />
        <SideItem icon={Bell} label={T.tabs.announcements} active={tab === 'announcements'} onClick={() => setTab('announcements')} />
      </nav>
      <div className="px-5 pt-4" style={{ borderTop: '1px solid var(--color-border)' }}>
        <Button variant="ghost" onClick={onClose} fullWidth icon={X}>{lang === 'en' ? 'Close' : '关闭'}</Button>
      </div>
    </aside>
  );
}

function SideItem({ icon: Icon, label, active, onClick }: any) {
  return (
    <button
      onClick={onClick}
      className="w-full h-9 px-3 rounded-lg flex items-center gap-2.5 text-[13px] font-medium transition-colors"
      style={{
        background: active ? 'var(--color-bg-card)' : 'transparent',
        color: active ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
      }}
      onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = 'var(--color-bg-card)'; }}
      onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
    >
      <Icon size={15} strokeWidth={1.8} />
      <span>{label}</span>
    </button>
  );
}

function AdminHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="h-14 px-6 flex items-center justify-between shrink-0" style={{ borderBottom: '1px solid var(--color-border)' }}>
      <h2 className="text-[15px] font-semibold" style={{ color: 'var(--color-text-primary)' }}>{title}</h2>
      <button
        onClick={onClose}
        className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
        style={{ color: 'var(--color-text-muted)' }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--color-bg-card)'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
      >
        <X size={16} />
      </button>
    </div>
  );
}

/* ═══════════════ Overview Tab ═══════════════ */

function OverviewTab({ lang }: { lang: 'zh' | 'en' }) {
  const { users } = useAuth();
  const totalUsers = users.length;
  const activeUsers = users.filter((u) => {
    const last = new Date(u.lastActiveAt).getTime();
    return Date.now() - last < 7 * 24 * 3600 * 1000;
  }).length;
  const bannedUsers = users.filter((u) => u.role === 'banned').length;
  const totalTools = Object.values(toolsByCategory).reduce((sum, list) => sum + list.length, 0);
  const implementedTools = Object.keys(LIFE_TOOLS).length + Object.keys(TEXT_TOOLS).length;

  const stats = [
    { label: lang === 'en' ? 'Total users' : '总用户', value: totalUsers, sub: lang === 'en' ? `${activeUsers} active` : `${activeUsers} 活跃` },
    { label: lang === 'en' ? 'Total tools' : '工具总数', value: totalTools, sub: lang === 'en' ? `${implementedTools} implemented` : `${implementedTools} 已实现` },
    { label: lang === 'en' ? 'Active (7d)' : '7 天活跃', value: activeUsers, sub: lang === 'en' ? 'Last week' : '上周' },
    { label: lang === 'en' ? 'Banned' : '已封禁', value: bannedUsers, sub: lang === 'en' ? 'Need attention' : '需要关注' },
  ];

  return (
    <div className="p-6 space-y-5">
      <div className="grid grid-cols-4 gap-3">
        {stats.map((s, i) => (
          <div key={i} className="rounded-xl p-4" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
            <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>{s.label}</p>
            <p className="text-3xl font-semibold mt-2" style={{ color: 'var(--color-text-primary)' }}>{s.value}</p>
            <p className="text-[11px] mt-1" style={{ color: 'var(--color-text-muted)' }}>{s.sub}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl p-5" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
        <h3 className="text-[14px] font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>
          {lang === 'en' ? 'User activity (last 7 days)' : '用户活跃度(最近 7 天)'}
        </h3>
        <ActivityChart lang={lang} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl p-5" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
          <h3 className="text-[14px] font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>
            {lang === 'en' ? 'Top categories' : '热门分类'}
          </h3>
          <div className="space-y-2">
            {categories.slice(0, 5).map((c) => {
              const count = (toolsByCategory[c.id] || []).length;
              const max = 10;
              return (
                <div key={c.id}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[12px]" style={{ color: 'var(--color-text-secondary)' }}>{c.name[lang]}</span>
                    <span className="text-[11px] font-mono" style={{ color: 'var(--color-text-muted)' }}>{count}</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--color-border)' }}>
                    <div className="h-full" style={{ width: `${(count / max) * 100}%`, background: 'var(--color-accent)' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-xl p-5" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
          <h3 className="text-[14px] font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>
            {lang === 'en' ? 'Quick actions' : '快捷操作'}
          </h3>
          <div className="grid grid-cols-2 gap-2">
            <QuickAction icon={Users} label={lang === 'en' ? 'View users' : '查看用户'} />
            <QuickAction icon={Wrench} label={lang === 'en' ? 'Manage tools' : '管理工具'} />
            <QuickAction icon={MessageSquare} label={lang === 'en' ? 'Read feedback' : '查看反馈'} />
            <QuickAction icon={Bell} label={lang === 'en' ? 'Send announce' : '发公告'} />
          </div>
        </div>
      </div>
    </div>
  );
}

function ActivityChart({ lang }: { lang: 'zh' | 'en' }) {
  // Demo data: 7 days
  const data = [3, 5, 4, 7, 6, 8, 5];
  const max = Math.max(...data);
  const days = lang === 'en' ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] : ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
  return (
    <div className="flex items-end gap-2 h-32">
      {data.map((v, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <div
            className="w-full rounded-t-md transition-all"
            style={{
              height: `${(v / max) * 100}%`,
              background: 'linear-gradient(180deg, var(--color-accent) 0%, var(--color-accent-soft) 100%)',
              opacity: 0.6 + (v / max) * 0.4,
            }}
          />
          <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>{days[i]}</span>
        </div>
      ))}
    </div>
  );
}

function QuickAction({ icon: Icon, label }: any) {
  return (
    <button
      className="flex items-center gap-2 px-3 py-2.5 rounded-lg transition-colors"
      style={{ background: 'var(--color-bg-main)', border: '1px solid var(--color-border)' }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-accent)'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-border)'; }}
    >
      <Icon size={14} style={{ color: 'var(--color-accent)' }} />
      <span className="text-[12px] font-medium" style={{ color: 'var(--color-text-primary)' }}>{label}</span>
    </button>
  );
}

/* ═══════════════ Users Tab ═══════════════ */

function UsersTab({ lang }: { lang: 'zh' | 'en' }) {
  const { users, updateUser, deleteUser, updatePassword, user: me } = useAuth();
  const [search, setSearch] = useState('');
  const [resetPwd, setResetPwd] = useState<User | null>(null);
  const [newPwd, setNewPwd] = useState('');
  const [confirmDel, setConfirmDel] = useState<User | null>(null);

  const filtered = users.filter((u) =>
    u.username.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={lang === 'en' ? 'Search users...' : '搜索用户名或邮箱...'}
            className="w-full h-9 pl-9 pr-3 rounded-lg text-[13px] outline-none"
            style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
          />
        </div>
        <span className="text-[12px]" style={{ color: 'var(--color-text-muted)' }}>
          {filtered.length} {lang === 'en' ? 'of' : '/'} {users.length}
        </span>
      </div>

      <div className="rounded-xl overflow-hidden" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
        <table className="w-full">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-bg-main)' }}>
              <Th>{lang === 'en' ? 'User' : '用户'}</Th>
              <Th>{lang === 'en' ? 'Email' : '邮箱'}</Th>
              <Th>{lang === 'en' ? 'Role' : '角色'}</Th>
              <Th>{lang === 'en' ? 'Favorites' : '收藏'}</Th>
              <Th>{lang === 'en' ? 'Joined' : '注册'}</Th>
              <Th>{lang === 'en' ? 'Last active' : '最近活跃'}</Th>
              <Th align="right">{lang === 'en' ? 'Actions' : '操作'}</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr key={u.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-semibold shrink-0"
                      style={{ background: u.role === 'admin' ? 'var(--color-accent-glow)' : 'var(--color-border)', color: u.role === 'admin' ? 'var(--color-accent)' : 'var(--color-text-secondary)' }}
                    >
                      {u.username[0].toUpperCase()}
                    </div>
                    <div>
                      <div className="text-[13px] font-medium" style={{ color: 'var(--color-text-primary)' }}>{u.username}</div>
                      <div className="text-[10px] font-mono" style={{ color: 'var(--color-text-muted)' }}>{u.id}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-[12px]" style={{ color: 'var(--color-text-secondary)' }}>{u.email}</td>
                <td className="px-4 py-3"><RoleBadge role={u.role} lang={lang} /></td>
                <td className="px-4 py-3 text-[12px]" style={{ color: 'var(--color-text-secondary)' }}>{u.favorites.length}</td>
                <td className="px-4 py-3 text-[11px]" style={{ color: 'var(--color-text-muted)' }}>{u.createdAt.slice(0, 10)}</td>
                <td className="px-4 py-3 text-[11px]" style={{ color: 'var(--color-text-muted)' }}>{u.lastActiveAt.slice(0, 10)}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => setResetPwd(u)}
                      title={lang === 'en' ? 'Reset password' : '重置密码'}
                      className="w-7 h-7 rounded-md flex items-center justify-center transition-colors"
                      style={{ color: 'var(--color-text-muted)' }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--color-bg-card-hover)'; (e.currentTarget as HTMLElement).style.color = 'var(--color-text-primary)'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--color-text-muted)'; }}
                    >
                      <KeyRound size={13} />
                    </button>
                    {u.role === 'banned' ? (
                      <button
                        onClick={() => updateUser({ id: u.id, role: 'user' })}
                        title={lang === 'en' ? 'Unban' : '解封'}
                        className="w-7 h-7 rounded-md flex items-center justify-center"
                        style={{ color: 'var(--color-success)' }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(52, 211, 153, 0.12)'; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                      >
                        <ShieldOff size={13} />
                      </button>
                    ) : (
                      <button
                        onClick={() => updateUser({ id: u.id, role: 'banned' })}
                        title={lang === 'en' ? 'Ban' : '封禁'}
                        className="w-7 h-7 rounded-md flex items-center justify-center"
                        style={{ color: 'var(--color-warning)' }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(251, 191, 36, 0.12)'; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                        disabled={u.id === me?.id}
                      >
                        <Shield size={13} />
                      </button>
                    )}
                    <button
                      onClick={() => setConfirmDel(u)}
                      title={lang === 'en' ? 'Delete' : '删除'}
                      className="w-7 h-7 rounded-md flex items-center justify-center"
                      style={{ color: 'var(--color-warning)' }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(239, 68, 68, 0.12)'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                      disabled={u.id === me?.id}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {resetPwd && (
        <Modal onClose={() => { setResetPwd(null); setNewPwd(''); }}>
          <h3 className="text-[14px] font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>
            {lang === 'en' ? `Reset password for ${resetPwd.username}` : `重置 ${resetPwd.username} 的密码`}
          </h3>
          <input
            type="password"
            value={newPwd}
            onChange={(e) => setNewPwd(e.target.value)}
            placeholder={lang === 'en' ? 'New password (min 6 chars)' : '新密码(至少 6 位)'}
            className="w-full h-9 px-3 rounded-lg text-[13px] outline-none mb-3"
            style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => { setResetPwd(null); setNewPwd(''); }}>{lang === 'en' ? 'Cancel' : '取消'}</Button>
            <ConfirmButton
              onClick={() => {
                const r = updatePassword(resetPwd.id, newPwd);
                if (r.ok) { setResetPwd(null); setNewPwd(''); }
              }}
              icon={KeyRound}
            >
              {lang === 'en' ? 'Reset' : '重置'}
            </ConfirmButton>
          </div>
        </Modal>
      )}

      {confirmDel && (
        <Modal onClose={() => setConfirmDel(null)}>
          <h3 className="text-[14px] font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>
            {lang === 'en' ? `Delete ${confirmDel.username}?` : `删除用户 ${confirmDel.username}?`}
          </h3>
          <p className="text-[12px] mb-4" style={{ color: 'var(--color-text-muted)' }}>
            {lang === 'en' ? 'This action cannot be undone.' : '此操作不可撤销。'}
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirmDel(null)}>{lang === 'en' ? 'Cancel' : '取消'}</Button>
            <DeleteButton onClick={() => { deleteUser(confirmDel.id); setConfirmDel(null); }} icon={Trash2}>
              {lang === 'en' ? 'Delete' : '删除'}
            </DeleteButton>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Th({ children, align = 'left' }: any) {
  return (
    <th className={`px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-${align}`} style={{ color: 'var(--color-text-muted)' }}>
      {children}
    </th>
  );
}

function RoleBadge({ role, lang }: { role: Role; lang: 'zh' | 'en' }) {
  const map: Record<Role, { zh: string; en: string; bg: string; fg: string }> = {
    admin: { zh: '管理员', en: 'Admin', bg: 'var(--color-accent-glow)', fg: 'var(--color-accent)' },
    user: { zh: '用户', en: 'User', bg: 'var(--color-border)', fg: 'var(--color-text-secondary)' },
    banned: { zh: '已封禁', en: 'Banned', bg: 'rgba(239, 68, 68, 0.12)', fg: '#fca5a5' },
  };
  const m = map[role];
  return (
    <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ background: m.bg, color: m.fg }}>
      {lang === 'en' ? m.en : m.zh}
    </span>
  );
}

/* ═══════════════ Tools Tab ═══════════════ */

function ToolsTab({ lang }: { lang: 'zh' | 'en' }) {
  const allTools: { id: number; name: { zh: string; en: string }; category: string; implemented: boolean }[] = [];
  Object.entries(toolsByCategory).forEach(([catId, tools]) => {
    tools.forEach((t) => {
      allTools.push({
        id: t.id,
        name: t.name,
        category: catId,
        implemented: !!(LIFE_TOOLS[t.id] || TEXT_TOOLS[t.id]),
      });
    });
  });

  return (
    <div className="p-6 space-y-3">
      <p className="text-[12px]" style={{ color: 'var(--color-text-muted)' }}>
        {lang === 'en'
          ? `${allTools.length} tools in catalog · ${allTools.filter(t => t.implemented).length} implemented`
          : `共 ${allTools.length} 个工具,${allTools.filter(t => t.implemented).length} 个已实现`}
      </p>
      {categories.map((cat) => {
        const tools = allTools.filter((t) => t.category === cat.id);
        if (tools.length === 0) return null;
        const implementedCount = tools.filter((t) => t.implemented).length;
        return (
          <div key={cat.id} className="rounded-xl overflow-hidden" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
            <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid var(--color-border)' }}>
              <cat.icon size={14} style={{ color: 'var(--color-accent)' }} />
              <span className="text-[13px] font-semibold" style={{ color: 'var(--color-text-primary)' }}>{cat.name[lang]}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--color-border)', color: 'var(--color-text-muted)' }}>
                {implementedCount}/{tools.length}
              </span>
            </div>
            <div className="grid grid-cols-2">
              {tools.map((t) => (
                <div key={t.id} className="px-4 py-2.5 flex items-center justify-between" style={{ borderRight: '1px solid var(--color-border)', borderBottom: '1px solid var(--color-border)' }}>
                  <div className="min-w-0 flex-1">
                    <div className="text-[12px] truncate" style={{ color: 'var(--color-text-primary)' }}>{t.name[lang]}</div>
                    <div className="text-[10px] font-mono" style={{ color: 'var(--color-text-muted)' }}>id: {t.id}</div>
                  </div>
                  <span
                    className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0"
                    style={{
                      background: t.implemented ? 'rgba(52, 211, 153, 0.12)' : 'var(--color-border)',
                      color: t.implemented ? 'var(--color-success)' : 'var(--color-text-muted)',
                    }}
                  >
                    {t.implemented ? (lang === 'en' ? 'Ready' : '已实现') : (lang === 'en' ? 'Pending' : '待开发')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ═══════════════ Feedback Tab ═══════════════ */

function FeedbackTab({ lang }: { lang: 'zh' | 'en' }) {
  const feedback = [
    { user: 'alice', text: lang === 'en' ? 'Suggestion: add a Pomodoro timer in productivity tools.' : '建议:在办公效率里加一个番茄钟。', status: 'pending', date: '2026-05-30' },
    { user: 'demo', text: lang === 'en' ? 'Great design! Love the cyber theme.' : '设计超棒!喜欢科技蓝主题。', status: 'resolved', date: '2026-05-29' },
    { user: 'bob', text: lang === 'en' ? 'Found a typo in the dream oracle.' : '解梦占卜里有错别字。', status: 'pending', date: '2026-05-28' },
    { user: 'alice', text: lang === 'en' ? 'Could you add dark mode to charts?' : '图表能加个深色模式吗?', status: 'ignored', date: '2026-05-25' },
  ];

  return (
    <div className="p-6 space-y-2.5">
      {feedback.map((f, i) => (
        <div key={i} className="rounded-xl p-4" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-semibold"
                style={{ background: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
              >
                {f.user[0].toUpperCase()}
              </div>
              <span className="text-[13px] font-medium" style={{ color: 'var(--color-text-primary)' }}>@{f.user}</span>
              <span className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>· {f.date}</span>
            </div>
            <FeedbackStatus status={f.status as any} lang={lang} />
          </div>
          <p className="text-[13px] leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>{f.text}</p>
          {f.status === 'pending' && (
            <div className="mt-3 flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => {}} icon={Check}>{lang === 'en' ? 'Mark resolved' : '标记已处理'}</Button>
              <Button variant="ghost" size="sm" onClick={() => {}} icon={X}>{lang === 'en' ? 'Ignore' : '忽略'}</Button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function FeedbackStatus({ status, lang }: { status: 'pending' | 'resolved' | 'ignored'; lang: 'zh' | 'en' }) {
  const map = {
    pending: { zh: '待处理', en: 'Pending', bg: 'rgba(245, 158, 11, 0.15)', fg: 'var(--color-warning)' },
    resolved: { zh: '已处理', en: 'Resolved', bg: 'rgba(52, 211, 153, 0.12)', fg: 'var(--color-success)' },
    ignored: { zh: '已忽略', en: 'Ignored', bg: 'var(--color-border)', fg: 'var(--color-text-muted)' },
  };
  const m = map[status];
  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold" style={{ background: m.bg, color: m.fg }}>
      {lang === 'en' ? m.en : m.zh}
    </span>
  );
}

/* ═══════════════ Announcements Tab ═══════════════ */

function AnnouncementsTab({ lang }: { lang: 'zh' | 'en' }) {
  const [text, setText] = useState('');
  const [sent, setSent] = useState<{ text: string; date: string }[]>([
    { text: lang === 'en' ? 'Welcome to AI Tools Launcher v1.0! New tools added every week.' : '欢迎使用 AI 工具集 v1.0!每周都有新工具上线。', date: '2026-06-01' },
  ]);

  return (
    <div className="p-6 space-y-4">
      <div className="rounded-xl p-4" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
        <p className="text-[12px] font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>
          {lang === 'en' ? 'New announcement' : '新建公告'}
        </p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={lang === 'en' ? 'Write an announcement to all users...' : '向所有用户发送公告...'}
          rows={4}
          className="w-full px-3 py-2.5 rounded-lg text-[13px] outline-none resize-none"
          style={{ background: 'var(--color-bg-main)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)', lineHeight: 1.5 }}
        />
        <div className="mt-3 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setText('')}>{lang === 'en' ? 'Clear' : '清空'}</Button>
          <ConfirmButton
            onClick={() => {
              if (!text.trim()) return;
              setSent([{ text, date: new Date().toISOString().slice(0, 10) }, ...sent]);
              setText('');
            }}
            icon={Bell}
          >
            {lang === 'en' ? 'Send' : '发布'}
          </ConfirmButton>
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-[12px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
          {lang === 'en' ? 'History' : '历史公告'}
        </h3>
        {sent.map((s, i) => (
          <div key={i} className="rounded-lg p-3" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
            <p className="text-[12px] leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>{s.text}</p>
            <p className="text-[10px] mt-1" style={{ color: 'var(--color-text-muted)' }}>{s.date}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─────────── Modal helper ─────────── */

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center"
      style={{ background: 'rgba(0, 0, 0, 0.5)', animation: 'backdropIn 0.18s ease' }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[420px] max-w-[92vw] rounded-xl p-5"
        style={{ background: 'var(--color-bg-main)', border: '1px solid var(--color-border)', boxShadow: '0 16px 48px rgba(0, 0, 0, 0.5)', animation: 'authIn 0.18s cubic-bezier(0.16, 1, 0.3, 1)' }}
      >
        {children}
      </div>
    </div>
  );
}
