import { useState, useEffect, useCallback } from 'react';

export type Role = 'user' | 'admin' | 'banned';

export interface User {
  id: string;
  username: string;
  email: string;
  role: Role;
  createdAt: string;
  lastActiveAt: string;
  favorites: number[];
  // Pre-set admin demo password "admin123" (hashed inline for demo)
  passwordHash: string;
}

interface Session {
  userId: string;
  loggedInAt: string;
}

const USERS_KEY = 'ai-tools-launcher.users.v1';
const SESSION_KEY = 'ai-tools-launcher.session.v1';

// Simple demo "hash" (NOT real crypto — local demo only)
function hash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i);
  return 'h_' + (h >>> 0).toString(16);
}

function seedUsers(): User[] {
  return [
    {
      id: 'u_admin',
      username: 'admin',
      email: 'admin@ai-tools.local',
      role: 'admin',
      createdAt: '2026-01-01T00:00:00Z',
      lastActiveAt: new Date().toISOString(),
      favorites: [],
      passwordHash: hash('admin123'),
    },
    {
      id: 'u_demo',
      username: 'demo',
      email: 'demo@ai-tools.local',
      role: 'user',
      createdAt: '2026-03-15T00:00:00Z',
      lastActiveAt: new Date().toISOString(),
      favorites: [1, 2, 19],
      passwordHash: hash('demo123'),
    },
    {
      id: 'u_alice',
      username: 'alice',
      email: 'alice@example.com',
      role: 'user',
      createdAt: '2026-04-20T00:00:00Z',
      lastActiveAt: '2026-05-28T12:00:00Z',
      favorites: [5, 9, 27],
      passwordHash: hash('alice123'),
    },
    {
      id: 'u_bob',
      username: 'bob',
      email: 'bob@example.com',
      role: 'user',
      createdAt: '2026-05-01T00:00:00Z',
      lastActiveAt: '2026-05-30T08:00:00Z',
      favorites: [1, 13],
      passwordHash: hash('bob123'),
    },
    {
      id: 'u_carol',
      username: 'carol',
      email: 'carol@example.com',
      role: 'banned',
      createdAt: '2026-02-10T00:00:00Z',
      lastActiveAt: '2026-04-12T10:00:00Z',
      favorites: [],
      passwordHash: hash('carol123'),
    },
  ];
}

function loadUsers(): User[] {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  const seeded = seedUsers();
  saveUsers(seeded);
  return seeded;
}

function saveUsers(users: User[]) {
  try { localStorage.setItem(USERS_KEY, JSON.stringify(users)); } catch {}
}

function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

function saveSession(s: Session | null) {
  try {
    if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    else localStorage.removeItem(SESSION_KEY);
  } catch {}
}

let listeners: Array<(u: User | null) => void> = [];
let state: { users: User[]; current: User | null } = {
  users: loadUsers(),
  current: null,
};

// Try restore session
const saved = loadSession();
if (saved) {
  const u = state.users.find((u) => u.id === saved.userId);
  if (u && u.role !== 'banned') state.current = u;
  else saveSession(null);
}

function commit(next: { users: User[]; current: User | null }) {
  state = next;
  saveUsers(next.users);
  if (next.current) {
    saveSession({ userId: next.current.id, loggedInAt: new Date().toISOString() });
  } else {
    saveSession(null);
  }
  listeners.forEach((l) => l(next.current));
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(state.current);
  useEffect(() => {
    const l = (u: User | null) => setUser(u);
    listeners.push(l);
    return () => { listeners = listeners.filter((x) => x !== l); };
  }, []);

  const login = useCallback((usernameOrEmail: string, password: string): { ok: boolean; error?: string } => {
    const u = state.users.find(
      (u) => (u.username === usernameOrEmail || u.email === usernameOrEmail) && u.passwordHash === hash(password)
    );
    if (!u) return { ok: false, error: '用户名或密码错误' };
    if (u.role === 'banned') return { ok: false, error: '该账号已被封禁' };
    commit({ ...state, current: u });
    return { ok: true };
  }, []);

  const register = useCallback((username: string, email: string, password: string): { ok: boolean; error?: string } => {
    if (!username.trim() || username.length < 2) return { ok: false, error: '用户名至少 2 个字符' };
    if (!email.includes('@')) return { ok: false, error: '邮箱格式不正确' };
    if (password.length < 6) return { ok: false, error: '密码至少 6 个字符' };
    if (state.users.some((u) => u.username === username)) return { ok: false, error: '用户名已存在' };
    if (state.users.some((u) => u.email === email)) return { ok: false, error: '邮箱已注册' };
    const newUser: User = {
      id: 'u_' + Date.now().toString(36),
      username,
      email,
      role: 'user',
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      favorites: [],
      passwordHash: hash(password),
    };
    const users = [...state.users, newUser];
    commit({ users, current: newUser });
    return { ok: true };
  }, []);

  const logout = useCallback(() => {
    commit({ ...state, current: null });
  }, []);

  const updateUser = useCallback((patch: Partial<User> & { id: string }) => {
    const users = state.users.map((u) => u.id === patch.id ? { ...u, ...patch } : u);
    const current = state.current && state.current.id === patch.id ? { ...state.current, ...patch } : state.current;
    commit({ users, current });
  }, []);

  const updatePassword = useCallback((userId: string, newPassword: string): { ok: boolean; error?: string } => {
    if (newPassword.length < 6) return { ok: false, error: '密码至少 6 个字符' };
    const users = state.users.map((u) => u.id === userId ? { ...u, passwordHash: hash(newPassword) } : u);
    commit({ ...state, users });
    return { ok: true };
  }, []);

  const deleteUser = useCallback((userId: string) => {
    const users = state.users.filter((u) => u.id !== userId);
    const current = state.current?.id === userId ? null : state.current;
    commit({ users, current });
  }, []);

  const toggleFavorite = useCallback((toolId: number) => {
    if (!state.current) return;
    const cur = state.current;
    const favorites = cur.favorites.includes(toolId)
      ? cur.favorites.filter((f) => f !== toolId)
      : [...cur.favorites, toolId];
    const updated = { ...cur, favorites };
    const users = state.users.map((u) => u.id === cur.id ? updated : u);
    commit({ users, current: updated });
  }, []);

  return {
    user,
    users: state.users,
    isLoggedIn: !!user,
    isAdmin: user?.role === 'admin',
    login,
    register,
    logout,
    updateUser,
    updatePassword,
    deleteUser,
    toggleFavorite,
  };
}
