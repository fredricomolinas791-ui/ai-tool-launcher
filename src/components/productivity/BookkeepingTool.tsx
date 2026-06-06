import { useState, useMemo } from 'react';
import { Wallet, Plus, Trash2, Edit, TrendingUp, TrendingDown, Target } from 'lucide-react';
import { useI18n } from '../../hooks/useI18n';
import { Button, ConfirmButton, DeleteButton } from '../ui/Button';

interface Account {
  id: string;
  name: string;
  balance: number;
  type: 'cash' | 'bank' | 'card' | 'other';
  color: string;
}

interface Transaction {
  id: string;
  accountId: string;
  type: 'income' | 'expense';
  amount: number;
  category: string;
  date: string;
  note?: string;
}

interface Budget {
  category: string;
  limit: number;
}

const ACCT_KEY = 'ai-tools-launcher.bookkeeping.v1';
const TX_KEY = 'ai-tools-launcher.transactions.v1';
const BDG_KEY = 'ai-tools-launcher.budgets.v1';

function loadAccounts(): Account[] {
  try { const r = localStorage.getItem(ACCT_KEY); if (r) return JSON.parse(r); } catch {}
  return [
    { id: 'a_cash', name: '现金', balance: 0, type: 'cash', color: '#10b981' },
    { id: 'a_bank', name: '银行卡', balance: 0, type: 'bank', color: '#0ea5e9' },
  ];
}
function saveAccounts(a: Account[]) { try { localStorage.setItem(ACCT_KEY, JSON.stringify(a)); } catch {} }

function loadTx(): Transaction[] {
  try { const r = localStorage.getItem(TX_KEY); if (r) return JSON.parse(r); } catch {}
  return [];
}
function saveTx(t: Transaction[]) { try { localStorage.setItem(TX_KEY, JSON.stringify(t)); } catch {} }

function loadBudgets(): Budget[] {
  try { const r = localStorage.getItem(BDG_KEY); if (r) return JSON.parse(r); } catch {}
  return [
    { category: '餐饮', limit: 1500 },
    { category: '交通', limit: 500 },
    { category: '购物', limit: 1000 },
  ];
}
function saveBudgets(b: Budget[]) { try { localStorage.setItem(BDG_KEY, JSON.stringify(b)); } catch {} }

const EXPENSE_CATS = ['餐饮', '交通', '购物', '娱乐', '居住', '医疗', '教育', '通讯', '其他'];
const INCOME_CATS = ['工资', '奖金', '投资', '兼职', '红包', '退款', '其他'];

const CAT_COLORS: Record<string, string> = {
  餐饮: '#f43f5e', 交通: '#0ea5e9', 购物: '#8b5cf6', 娱乐: '#f59e0b',
  居住: '#14b8a6', 医疗: '#ec4899', 教育: '#10b981', 通讯: '#6366f1',
  工资: '#10b981', 奖金: '#22c55e', 投资: '#06b6d4', 兼职: '#84cc16',
  红包: '#f43f5e', 退款: '#f59e0b', 其他: '#94a3b8',
};

export function BookkeepingTool() {
  const { lang } = useI18n();
  const T = {
    title: lang === 'en' ? 'Bookkeeping' : '记账',
    sub: lang === 'en' ? 'Track income, expenses, and budgets' : '收入 / 支出 / 预算',
    accounts: lang === 'en' ? 'Accounts' : '账户',
    transactions: lang === 'en' ? 'Transactions' : '流水',
    budgets: lang === 'en' ? 'Budgets' : '预算',
    stats: lang === 'en' ? 'Stats' : '统计',
    add: lang === 'en' ? 'Add' : '添加',
    addTx: lang === 'en' ? 'New transaction' : '新增流水',
    addAcct: lang === 'en' ? 'Add account' : '添加账户',
    addBudget: lang === 'en' ? 'Add budget' : '添加预算',
    totalAssets: lang === 'en' ? 'Total assets' : '总资产',
    thisMonth: lang === 'en' ? 'This month' : '本月',
    income: lang === 'en' ? 'Income' : '收入',
    expense: lang === 'en' ? 'Expense' : '支出',
    net: lang === 'en' ? 'Net' : '结余',
    byCategory: lang === 'en' ? 'By category' : '分类统计',
    vsBudget: lang === 'en' ? 'vs Budget' : '对比预算',
    noTx: lang === 'en' ? 'No transactions yet' : '还没有记账',
    noBudget: lang === 'en' ? 'No budget set' : '未设预算',
    fields: {
      account: lang === 'en' ? 'Account' : '账户',
      type: lang === 'en' ? 'Type' : '类型',
      amount: lang === 'en' ? 'Amount' : '金额',
      category: lang === 'en' ? 'Category' : '分类',
      date: lang === 'en' ? 'Date' : '日期',
      note: lang === 'en' ? 'Note' : '备注',
    },
  };

  const [accounts, setAccounts] = useState<Account[]>(loadAccounts);
  const [txs, setTxs] = useState<Transaction[]>(loadTx);
  const [budgets, setBudgets] = useState<Budget[]>(loadBudgets);
  const [tab, setTab] = useState<'overview' | 'tx' | 'accounts' | 'budgets'>('overview');
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [creatingTx, setCreatingTx] = useState(false);
  const [editingAcct, setEditingAcct] = useState<Account | null>(null);
  const [creatingAcct, setCreatingAcct] = useState(false);

  // Persist
  useMemo(() => saveAccounts(accounts), [accounts]);
  useMemo(() => saveTx(txs), [txs]);
  useMemo(() => saveBudgets(budgets), [budgets]);

  // Stats
  const thisMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
  const monthTxs = txs.filter((t) => t.date.startsWith(thisMonth));
  const monthIncome = monthTxs.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const monthExpense = monthTxs.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const totalAssets = accounts.reduce((s, a) => s + a.balance, 0);

  const categoryExpense = useMemo<[string, number][]>(() => {
    const map = new Map<string, number>();
    monthTxs.filter((t) => t.type === 'expense').forEach((t) => {
      map.set(t.category, (map.get(t.category) || 0) + t.amount);
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [monthTxs]);

  const maxCategory = Math.max(1, ...categoryExpense.map(([, v]) => v));

  const handleSaveTx = (t: Transaction) => {
    const existing = txs.find((x) => x.id === t.id);
    if (existing) {
      // Revert old, apply new
      const revert = existing.type === 'income' ? -existing.amount : existing.amount;
      const apply = t.type === 'income' ? t.amount : -t.amount;
      setAccounts(accounts.map((a) => {
        let b = a.balance;
        if (a.id === existing.accountId) b += revert;
        if (a.id === t.accountId) b += apply;
        return { ...a, balance: b };
      }));
      setTxs(txs.map((x) => x.id === t.id ? t : x));
    } else {
      const delta = t.type === 'income' ? t.amount : -t.amount;
      setAccounts(accounts.map((a) => a.id === t.accountId ? { ...a, balance: a.balance + delta } : a));
      setTxs([t, ...txs]);
    }
    setEditingTx(null);
    setCreatingTx(false);
  };

  const removeTx = (id: string) => {
    const tx = txs.find((t) => t.id === id);
    if (tx) {
      const delta = tx.type === 'income' ? -tx.amount : tx.amount;
      setAccounts(accounts.map((a) => a.id === tx.accountId ? { ...a, balance: a.balance + delta } : a));
    }
    setTxs(txs.filter((t) => t.id !== id));
    setEditingTx(null);
  };

  const saveAcct = (a: Account) => {
    if (accounts.find((x) => x.id === a.id)) {
      setAccounts(accounts.map((x) => x.id === a.id ? a : x));
    } else {
      setAccounts([...accounts, a]);
    }
    setEditingAcct(null);
    setCreatingAcct(false);
  };

  const removeAcct = (id: string) => {
    if (txs.some((t) => t.accountId === id)) {
      alert(lang === 'en' ? 'Cannot delete: account has transactions' : '无法删除:该账户还有流水');
      return;
    }
    setAccounts(accounts.filter((a) => a.id !== id));
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header tabs */}
      <div className="px-6 pt-4 pb-3 flex items-center gap-2" style={{ borderBottom: '1px solid var(--color-border)' }}>
        {([
          { k: 'overview', l: T.stats },
          { k: 'tx', l: T.transactions + ` (${txs.length})` },
          { k: 'accounts', l: T.accounts + ` (${accounts.length})` },
          { k: 'budgets', l: T.budgets + ` (${budgets.length})` },
        ] as const).map((t) => (
          <button
            key={t.k}
            onClick={() => setTab(t.k as any)}
            className="h-8 px-3.5 rounded-lg text-[12px] font-medium transition-all"
            style={{
              background: tab === t.k ? 'var(--color-accent)' : 'var(--color-bg-card)',
              color: tab === t.k ? '#0a0a0c' : 'var(--color-text-secondary)',
              border: `1px solid ${tab === t.k ? 'var(--color-accent)' : 'var(--color-border)'}`,
            }}
          >
            {t.l}
          </button>
        ))}
        <div className="ml-auto">
          {tab === 'tx' && <ConfirmButton onClick={() => setCreatingTx(true)} icon={Plus} size="sm">{T.addTx}</ConfirmButton>}
          {tab === 'accounts' && <ConfirmButton onClick={() => setCreatingAcct(true)} icon={Plus} size="sm">{T.addAcct}</ConfirmButton>}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {tab === 'overview' && (
          <div className="space-y-5 max-w-5xl mx-auto">
            {/* Top stats */}
            <div className="grid grid-cols-4 gap-3">
              <StatCard label={T.totalAssets} value={`¥${totalAssets.toFixed(2)}`} color="var(--color-accent)" />
              <StatCard label={`${T.thisMonth} · ${T.income}`} value={`+¥${monthIncome.toFixed(2)}`} color="#10b981" />
              <StatCard label={`${T.thisMonth} · ${T.expense}`} value={`-¥${monthExpense.toFixed(2)}`} color="#f43f5e" />
              <StatCard label={`${T.thisMonth} · ${T.net}`} value={`¥${(monthIncome - monthExpense).toFixed(2)}`} color={monthIncome - monthExpense >= 0 ? '#10b981' : '#f43f5e'} />
            </div>

            {/* Category breakdown */}
            <div className="rounded-xl p-5" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
              <h3 className="text-[14px] font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>{T.byCategory}</h3>
              {categoryExpense.length === 0 ? (
                <p className="text-[12px] text-center py-8" style={{ color: 'var(--color-text-muted)' }}>{T.noTx}</p>
              ) : (
                <div className="space-y-2.5">
                  {categoryExpense.map(([cat, amt]) => (
                    <div key={cat}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[12px]" style={{ color: 'var(--color-text-secondary)' }}>{cat}</span>
                        <span className="text-[12px] font-mono" style={{ color: 'var(--color-text-primary)' }}>¥{amt.toFixed(2)}</span>
                      </div>
                      <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--color-bg-main)' }}>
                        <div
                          className="h-full transition-all"
                          style={{ width: `${(amt / maxCategory) * 100}%`, background: CAT_COLORS[cat] || 'var(--color-accent)' }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Budgets */}
            <div className="rounded-xl p-5" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
              <h3 className="text-[14px] font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>{T.vsBudget}</h3>
              <div className="grid grid-cols-3 gap-3">
                {budgets.map((b) => {
                  const spent = monthTxs.filter((t) => t.type === 'expense' && t.category === b.category).reduce((s, t) => s + t.amount, 0);
                  const pct = Math.min(100, (spent / b.limit) * 100);
                  const over = spent > b.limit;
                  return (
                    <div key={b.category} className="rounded-lg p-3" style={{ background: 'var(--color-bg-main)', border: '1px solid var(--color-border)' }}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] font-semibold" style={{ color: 'var(--color-text-primary)' }}>{b.category}</span>
                        <span className="text-[10px] font-mono" style={{ color: over ? '#f43f5e' : 'var(--color-text-muted)' }}>{pct.toFixed(0)}%</span>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden mb-1" style={{ background: 'var(--color-border)' }}>
                        <div className="h-full transition-all" style={{ width: `${pct}%`, background: over ? '#f43f5e' : (pct > 80 ? '#f59e0b' : '#10b981') }} />
                      </div>
                      <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>¥{spent.toFixed(0)} / ¥{b.limit}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Account balances */}
            <div className="rounded-xl p-5" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
              <h3 className="text-[14px] font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>{T.accounts}</h3>
              <div className="grid grid-cols-2 gap-3">
                {accounts.map((a) => (
                  <div key={a.id} className="rounded-lg p-3 flex items-center gap-3" style={{ background: 'var(--color-bg-main)' }}>
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: a.color }}>
                      <Wallet size={18} style={{ color: '#0a0a0c' }} />
                    </div>
                    <div className="flex-1">
                      <p className="text-[12px] font-medium" style={{ color: 'var(--color-text-primary)' }}>{a.name}</p>
                      <p className="text-[16px] font-semibold tabular-nums" style={{ color: a.balance >= 0 ? 'var(--color-text-primary)' : '#f43f5e' }}>¥{a.balance.toFixed(2)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === 'tx' && (
          <div className="max-w-3xl mx-auto space-y-2">
            {txs.length === 0 ? (
              <p className="text-center text-[13px] py-12" style={{ color: 'var(--color-text-muted)' }}>{T.noTx}</p>
            ) : txs.sort((a, b) => b.date.localeCompare(a.date)).map((t) => (
              <TxCard key={t.id} tx={t} account={accounts.find((a) => a.id === t.accountId)} onClick={() => setEditingTx(t)} />
            ))}
          </div>
        )}

        {tab === 'accounts' && (
          <div className="max-w-3xl mx-auto space-y-2">
            {accounts.map((a) => (
              <div key={a.id} className="rounded-xl p-4 flex items-center gap-3" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
                <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: a.color }}>
                  <Wallet size={20} style={{ color: '#0a0a0c' }} />
                </div>
                <div className="flex-1">
                  <p className="text-[14px] font-semibold" style={{ color: 'var(--color-text-primary)' }}>{a.name}</p>
                  <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>{a.type === 'cash' ? '现金' : a.type === 'bank' ? '银行' : a.type === 'card' ? '信用卡' : '其他'}</p>
                </div>
                <p className="text-lg font-semibold tabular-nums" style={{ color: a.balance >= 0 ? 'var(--color-text-primary)' : '#f43f5e' }}>¥{a.balance.toFixed(2)}</p>
                <div className="flex gap-1">
                  <button onClick={() => setEditingAcct(a)} className="w-8 h-8 rounded flex items-center justify-center" style={{ color: 'var(--color-text-muted)' }}><Edit size={13} /></button>
                  <button onClick={() => removeAcct(a.id)} className="w-8 h-8 rounded flex items-center justify-center" style={{ color: 'var(--color-warning)' }}><Trash2 size={13} /></button>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'budgets' && (
          <div className="max-w-3xl mx-auto space-y-2">
            {budgets.length === 0 ? (
              <p className="text-center text-[13px] py-12" style={{ color: 'var(--color-text-muted)' }}>{T.noBudget}</p>
            ) : budgets.map((b) => (
              <BudgetRow key={b.category} budget={b} onUpdate={(v: number) => setBudgets(budgets.map((x) => x.category === b.category ? { ...x, limit: v } : x))} onDelete={() => setBudgets(budgets.filter((x) => x.category !== b.category))} />
            ))}
          </div>
        )}
      </div>

      {(editingTx || creatingTx) && (
        <TxEditor
          initial={editingTx || { id: 'new_' + Date.now().toString(36), accountId: accounts[0]?.id || '', type: 'expense', amount: 0, category: '餐饮', date: new Date().toISOString().slice(0, 10), note: '' }}
          accounts={accounts}
          onSave={handleSaveTx}
          onDelete={editingTx ? () => removeTx(editingTx.id) : undefined}
          onClose={() => { setEditingTx(null); setCreatingTx(false); }}
          T={T}
        />
      )}
      {(editingAcct || creatingAcct) && (
        <AcctEditor
          initial={editingAcct || { id: 'new_' + Date.now().toString(36), name: '', balance: 0, type: 'cash', color: CAT_COLORS['其他'] }}
          onSave={saveAcct}
          onClose={() => { setEditingAcct(null); setCreatingAcct(false); }}
          T={T}
        />
      )}
    </div>
  );
}

function StatCard({ label, value, color }: any) {
  return (
    <div className="rounded-xl p-4" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
      <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--color-text-muted)' }}>{label}</p>
      <p className="text-2xl font-semibold tabular-nums" style={{ color }}>{value}</p>
    </div>
  );
}

function TxCard({ tx, account, onClick }: { tx: Transaction; account: Account | undefined; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full rounded-xl p-3 flex items-center gap-3 text-left transition-colors" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }} onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = CAT_COLORS[tx.category] || 'var(--color-border)'; }} onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-border)'; }}>
      <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: CAT_COLORS[tx.category] || '#94a3b8' }}>
        {tx.type === 'income' ? <TrendingUp size={16} style={{ color: '#0a0a0c' }} /> : <TrendingDown size={16} style={{ color: '#0a0a0c' }} />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>{tx.category} {tx.note && <span className="text-[11px] font-normal" style={{ color: 'var(--color-text-muted)' }}>· {tx.note}</span>}</p>
        <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>{tx.date} · {account?.name || '?'}</p>
      </div>
      <p className="text-[15px] font-semibold tabular-nums" style={{ color: tx.type === 'income' ? '#10b981' : '#f43f5e' }}>
        {tx.type === 'income' ? '+' : '-'}¥{tx.amount.toFixed(2)}
      </p>
    </button>
  );
}

function BudgetRow({ budget, onUpdate, onDelete }: { budget: Budget; onUpdate: (v: number) => void; onDelete: () => void }) {
  return (
    <div className="rounded-xl p-4 flex items-center gap-3" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
      <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: CAT_COLORS[budget.category] || 'var(--color-accent)' }}>
        <Target size={16} style={{ color: '#0a0a0c' }} />
      </div>
      <span className="text-[14px] font-medium w-20" style={{ color: 'var(--color-text-primary)' }}>{budget.category}</span>
      <input
        type="number"
        value={budget.limit}
        onChange={(e) => onUpdate(Number(e.target.value))}
        className="flex-1 h-9 px-3 rounded-lg text-[13px] outline-none"
        style={{ background: 'var(--color-bg-main)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
      />
      <button onClick={onDelete} className="w-8 h-8 rounded flex items-center justify-center" style={{ color: 'var(--color-warning)' }}><Trash2 size={13} /></button>
    </div>
  );
}

function TxEditor({ initial, accounts, onSave, onDelete, onClose, T }: { initial: Transaction; accounts: Account[]; onSave: (t: Transaction) => void; onDelete?: () => void; onClose: () => void; T: any }) {
  const [t, setT] = useState<Transaction>(initial);
  const cats = t.type === 'income' ? INCOME_CATS : EXPENSE_CATS;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-[480px] max-w-[92vw] rounded-2xl p-6" style={{ background: 'var(--color-bg-main)', border: '1px solid var(--color-border)', boxShadow: '0 16px 48px rgba(0,0,0,0.5)' }}>
        <h3 className="text-base font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>{T.addTx}</h3>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setT({ ...t, type: 'expense' })} className="h-9 rounded-lg text-[13px] font-medium" style={{ background: t.type === 'expense' ? '#f43f5e' : 'var(--color-bg-card)', color: t.type === 'expense' ? '#fff' : 'var(--color-text-secondary)', border: `1px solid ${t.type === 'expense' ? '#f43f5e' : 'var(--color-border)'}` }}>{T.expense}</button>
            <button onClick={() => setT({ ...t, type: 'income' })} className="h-9 rounded-lg text-[13px] font-medium" style={{ background: t.type === 'income' ? '#10b981' : 'var(--color-bg-card)', color: t.type === 'income' ? '#fff' : 'var(--color-text-secondary)', border: `1px solid ${t.type === 'income' ? '#10b981' : 'var(--color-border)'}` }}>{T.income}</button>
          </div>
          <div>
            <label className="text-[11px] mb-1 block" style={{ color: 'var(--color-text-muted)' }}>{T.fields.amount}</label>
            <input type="number" step="0.01" value={t.amount || ''} onChange={(e) => setT({ ...t, amount: Number(e.target.value) })} className="w-full h-10 px-3 rounded-lg text-[18px] font-semibold outline-none" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', color: t.type === 'income' ? '#10b981' : '#f43f5e' }} autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] mb-1 block" style={{ color: 'var(--color-text-muted)' }}>{T.fields.category}</label>
              <select value={t.category} onChange={(e) => setT({ ...t, category: e.target.value })} className="w-full h-9 px-2 rounded-lg text-[12px] outline-none" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}>
                {cats.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[11px] mb-1 block" style={{ color: 'var(--color-text-muted)' }}>{T.fields.account}</label>
              <select value={t.accountId} onChange={(e) => setT({ ...t, accountId: e.target.value })} className="w-full h-9 px-2 rounded-lg text-[12px] outline-none" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}>
                {accounts.map((a: Account) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-[11px] mb-1 block" style={{ color: 'var(--color-text-muted)' }}>{T.fields.date}</label>
            <input type="date" value={t.date} onChange={(e) => setT({ ...t, date: e.target.value })} className="w-full h-9 px-2 rounded-lg text-[12px] outline-none" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }} />
          </div>
          <div>
            <label className="text-[11px] mb-1 block" style={{ color: 'var(--color-text-muted)' }}>{T.fields.note}</label>
            <input type="text" value={t.note || ''} onChange={(e) => setT({ ...t, note: e.target.value })} className="w-full h-9 px-3 rounded-lg text-[12px] outline-none" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }} />
          </div>
        </div>
        <div className="mt-5 flex items-center justify-between">
          {onDelete ? <DeleteButton onClick={onDelete} size="sm">{T.fields.category === '' ? '删除' : '删除'}</DeleteButton> : <span />}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>取消</Button>
            <ConfirmButton onClick={() => t.amount > 0 && onSave(t)}>保存</ConfirmButton>
          </div>
        </div>
      </div>
    </div>
  );
}

function AcctEditor({ initial, onSave, onClose, T }: { initial: Account; onSave: (a: Account) => void; onClose: () => void; T: any }) {
  const [a, setA] = useState<Account>(initial);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-[420px] max-w-[92vw] rounded-2xl p-6" style={{ background: 'var(--color-bg-main)', border: '1px solid var(--color-border)', boxShadow: '0 16px 48px rgba(0,0,0,0.5)' }}>
        <h3 className="text-base font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>{T.addAcct}</h3>
        <div className="space-y-3">
          <div>
            <label className="text-[11px] mb-1 block" style={{ color: 'var(--color-text-muted)' }}>{T.fields.account}</label>
            <input type="text" value={a.name} onChange={(e) => setA({ ...a, name: e.target.value })} className="w-full h-9 px-3 rounded-lg text-[13px] outline-none" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }} autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] mb-1 block" style={{ color: 'var(--color-text-muted)' }}>{T.fields.type}</label>
              <select value={a.type} onChange={(e) => setA({ ...a, type: e.target.value as any })} className="w-full h-9 px-2 rounded-lg text-[12px] outline-none" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}>
                <option value="cash">现金</option>
                <option value="bank">银行</option>
                <option value="card">信用卡</option>
                <option value="other">其他</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] mb-1 block" style={{ color: 'var(--color-text-muted)' }}>{T.fields.amount}</label>
              <input type="number" step="0.01" value={a.balance} onChange={(e) => setA({ ...a, balance: Number(e.target.value) })} className="w-full h-9 px-3 rounded-lg text-[13px] outline-none" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }} />
            </div>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>取消</Button>
          <ConfirmButton onClick={() => a.name.trim() && onSave(a)}>保存</ConfirmButton>
        </div>
      </div>
    </div>
  );
}
