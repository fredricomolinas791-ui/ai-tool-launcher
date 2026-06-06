import { useState } from 'react';
import { X, User, LogIn, UserPlus, Mail, Lock, Eye, EyeOff, Shield, AlertCircle } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useI18n } from '../hooks/useI18n';
import { ConfirmButton } from './ui/Button';

type Mode = 'login' | 'register';

export function AuthPanel({ open, onClose, initialMode = 'login' }: { open: boolean; onClose: () => void; initialMode?: Mode }) {
  const { login, register } = useAuth();
  const { lang } = useI18n();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);

  if (!open) return null;

  const T = {
    login: lang === 'en' ? 'Sign in' : '登录',
    register: lang === 'en' ? 'Create account' : '注册',
    username: lang === 'en' ? 'Username or email' : '用户名或邮箱',
    email: lang === 'en' ? 'Email' : '邮箱',
    password: lang === 'en' ? 'Password' : '密码',
    forgot: lang === 'en' ? 'Forgot password?' : '忘记密码?',
    noAccount: lang === 'en' ? 'No account?' : '还没有账号?',
    hasAccount: lang === 'en' ? 'Have an account?' : '已有账号?',
    registerNow: lang === 'en' ? 'Sign up' : '立即注册',
    loginNow: lang === 'en' ? 'Sign in' : '立即登录',
    welcome: lang === 'en' ? 'Welcome back' : '欢迎回来',
    joinUs: lang === 'en' ? 'Join us' : '加入我们',
    subtitle1: lang === 'en' ? 'Continue your AI journey' : '继续你的 AI 之旅',
    subtitle2: lang === 'en' ? 'Save favorites and history' : '保存收藏与历史',
    demo: lang === 'en' ? 'Demo accounts' : '演示账号',
    adminLabel: lang === 'en' ? 'Admin' : '管理员',
    userLabel: lang === 'en' ? 'User' : '用户',
    terms: lang === 'en' ? 'By continuing, you agree to our terms and privacy policy.' : '继续即表示你同意我们的条款和隐私政策。',
  };

  const handleSubmit = () => {
    setError(null);
    if (mode === 'login') {
      const r = login(username, password);
      if (r.ok) { onClose(); reset(); }
      else { setError(r.error || ''); setShake(true); setTimeout(() => setShake(false), 500); }
    } else {
      const r = register(username, email, password);
      if (r.ok) { onClose(); reset(); }
      else { setError(r.error || ''); setShake(true); setTimeout(() => setShake(false), 500); }
    }
  };

  const reset = () => { setUsername(''); setEmail(''); setPassword(''); setError(null); };

  const fillDemo = (which: 'admin' | 'user') => {
    setUsername(which === 'admin' ? 'admin' : 'demo');
    setPassword(which === 'admin' ? 'admin123' : 'demo123');
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center"
      style={{ background: 'rgba(0, 0, 0, 0.55)', backdropFilter: 'blur(6px)', animation: 'backdropIn 0.2s ease' }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[440px] max-w-[92vw] rounded-2xl overflow-hidden"
        style={{
          background: 'var(--color-bg-main)',
          border: '1px solid var(--color-border)',
          boxShadow: '0 24px 80px rgba(0, 0, 0, 0.55), 0 8px 24px rgba(0, 0, 0, 0.35)',
          animation: shake ? 'shake 0.4s' : 'authIn 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 text-center relative">
          <button
            onClick={onClose}
            className="absolute right-4 top-4 w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
            style={{ color: 'var(--color-text-muted)' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--color-bg-card)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
          >
            <X size={16} />
          </button>
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3"
            style={{ background: 'linear-gradient(135deg, var(--color-accent) 0%, var(--color-accent-soft) 100%)', boxShadow: '0 4px 14px var(--color-accent-glow)' }}
          >
            {mode === 'login' ? <LogIn size={22} strokeWidth={2} style={{ color: '#fff' }} /> : <UserPlus size={22} strokeWidth={2} style={{ color: '#fff' }} />}
          </div>
          <h2 className="text-lg font-semibold mb-1" style={{ color: 'var(--color-text-primary)' }}>
            {mode === 'login' ? T.welcome : T.joinUs}
          </h2>
          <p className="text-[12px]" style={{ color: 'var(--color-text-muted)' }}>
            {mode === 'login' ? T.subtitle1 : T.subtitle2}
          </p>
        </div>

        {/* Form */}
        <div className="px-6 pb-2">
          {error && (
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-lg mb-3"
              style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--color-warning)' }}
            >
              <AlertCircle size={14} style={{ color: 'var(--color-warning)' }} />
              <span className="text-[12px]" style={{ color: '#fca5a5' }}>{error}</span>
            </div>
          )}

          <div className="space-y-2.5">
            <div className="relative">
              <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }} />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={mode === 'login' ? T.username : (lang === 'en' ? 'Username' : '用户名')}
                className="w-full h-10 pl-9 pr-3 rounded-lg text-[13px] outline-none transition-colors"
                style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--color-accent)'; e.currentTarget.style.boxShadow = '0 0 0 3px var(--color-accent-glow)'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.boxShadow = 'none'; }}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              />
            </div>

            {mode === 'register' && (
              <div className="relative">
                <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={T.email}
                  className="w-full h-10 pl-9 pr-3 rounded-lg text-[13px] outline-none transition-colors"
                  style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--color-accent)'; e.currentTarget.style.boxShadow = '0 0 0 3px var(--color-accent-glow)'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.boxShadow = 'none'; }}
                  onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                />
              </div>
            )}

            <div className="relative">
              <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }} />
              <input
                type={showPwd ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={T.password}
                className="w-full h-10 pl-9 pr-10 rounded-lg text-[13px] outline-none transition-colors"
                style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--color-accent)'; e.currentTarget.style.boxShadow = '0 0 0 3px var(--color-accent-glow)'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.boxShadow = 'none'; }}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              />
              <button
                onClick={() => setShowPwd(!showPwd)}
                className="absolute right-3 top-1/2 -translate-y-1/2"
                style={{ color: 'var(--color-text-muted)' }}
              >
                {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          <div className="mt-4">
            <ConfirmButton onClick={handleSubmit} icon={mode === 'login' ? LogIn : UserPlus} fullWidth size="lg">
              {mode === 'login' ? T.login : T.register}
            </ConfirmButton>
          </div>

          <div className="text-center mt-3">
            <span className="text-[12px]" style={{ color: 'var(--color-text-muted)' }}>
              {mode === 'login' ? T.noAccount : T.hasAccount}{' '}
            </span>
            <button
              onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(null); }}
              className="text-[12px] font-medium"
              style={{ color: 'var(--color-accent)' }}
            >
              {mode === 'login' ? T.registerNow : T.loginNow}
            </button>
          </div>
        </div>

        {/* Demo accounts */}
        <div className="px-6 py-4 mt-2" style={{ borderTop: '1px solid var(--color-border)', background: 'var(--color-bg-card)' }}>
          <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--color-text-muted)' }}>
            {T.demo}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => fillDemo('admin')}
              className="flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-left"
              style={{ background: 'var(--color-bg-main)', border: '1px solid var(--color-border)' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-accent)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-border)'; }}
            >
              <Shield size={14} style={{ color: 'var(--color-accent)' }} />
              <div className="min-w-0">
                <div className="text-[12px] font-medium" style={{ color: 'var(--color-text-primary)' }}>admin</div>
                <div className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>{T.adminLabel} · admin123</div>
              </div>
            </button>
            <button
              onClick={() => fillDemo('user')}
              className="flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-left"
              style={{ background: 'var(--color-bg-main)', border: '1px solid var(--color-border)' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-accent)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-border)'; }}
            >
              <User size={14} style={{ color: 'var(--color-text-secondary)' }} />
              <div className="min-w-0">
                <div className="text-[12px] font-medium" style={{ color: 'var(--color-text-primary)' }}>demo</div>
                <div className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>{T.userLabel} · demo123</div>
              </div>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-4">
          <p className="text-[10px] text-center" style={{ color: 'var(--color-text-muted)' }}>
            {T.terms}
          </p>
        </div>
      </div>

      <style>{`
        @keyframes authIn { from { opacity: 0; transform: scale(0.96) translateY(8px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        @keyframes shake { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-6px)} 75%{transform:translateX(6px)} }
      `}</style>
    </div>
  );
}
