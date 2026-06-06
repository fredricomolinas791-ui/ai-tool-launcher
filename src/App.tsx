import { useState, useMemo, useEffect } from 'react';
import { Heart } from 'lucide-react';
import { categories, toolsByCategory, type Tool, type Category } from './data/tools';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { MainContent } from './components/MainContent';
import { AuthPanel } from './components/AuthPanel';
import { AdminPanel } from './components/AdminPanel';
import { useSettings } from './hooks/useSettings';
import type { Theme } from './hooks/useSettings';
import { useAuth } from './hooks/useAuth';
import { useDebounce } from './hooks/useDebounce';

// Flattened list of all tools across categories, used for global search.
const allTools: Tool[] = Object.values(toolsByCategory).flat();

// Synthetic "favorites" category — used when scope = 'favorites'.
const favoritesCategory: Category = {
  id: 'favorites',
  name: { zh: '我的收藏', en: 'Favorites' },
  icon: Heart,
  desc: { zh: '你收藏的 AI 工具', en: 'Tools you have favorited' },
};

function App() {
  const { settings, update } = useSettings();
  const { isAdmin, user } = useAuth();
  const [activeCategory, setActiveCategory] = useState('hot');
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedQuery = useDebounce(searchQuery, 150);
  const [authOpen, setAuthOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        const input = document.querySelector('input[type="text"]') as HTMLInputElement;
        input?.focus();
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'T') {
        e.preventDefault();
        const order: Theme[] = ['dark', 'light', 'cyber'];
        const next = order[(order.indexOf(settings.theme) + 1) % order.length];
        update({ theme: next });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [settings.theme, update]);

  // Search scope: 'favorites' is a synthetic view; everything else uses the
  // active category. The search query itself always runs against the chosen
  // pool so a typed query can surface tools from any category.
  const isFavoritesView = settings.searchScope === 'favorites';
  const baseCategory = isFavoritesView
    ? favoritesCategory
    : (categories.find((c) => c.id === activeCategory) || categories[0]);

  // Pool of tools to search within, before applying the text filter.
  const toolPool = useMemo<Tool[]>(() => {
    if (isFavoritesView) {
      const favs = user?.favorites ?? [];
      return allTools.filter((t) => favs.includes(t.id));
    }
    // When the user types a query, search across the whole catalog
    // (this matches what "global" means intuitively and rescues them
    // from the local-only view). When empty, honor the category.
    if (debouncedQuery.trim()) return allTools;
    return toolsByCategory[activeCategory] || [];
  }, [isFavoritesView, user, debouncedQuery, activeCategory]);

  const filteredTools = useMemo(() => {
    const query = debouncedQuery.trim().toLowerCase();
    if (!query) return toolPool;
    const lang = settings.language;
    return toolPool.filter((tool) =>
      tool.name[lang].toLowerCase().includes(query) ||
      tool.desc[lang].toLowerCase().includes(query) ||
      tool.tags.some((tag) => tag[lang].toLowerCase().includes(query))
    );
  }, [toolPool, debouncedQuery, settings.language]);

  const handleCategoryChange = (id: string) => {
    setActiveCategory(id);
    setSearchQuery('');
  };

  const toggleTheme = () => {
    const order: Theme[] = ['dark', 'light', 'cyber'];
    const next = order[(order.indexOf(settings.theme) + 1) % order.length];
    update({ theme: next });
  };

  return (
    <div
      className="h-screen w-full theme-transition grid overflow-hidden"
      style={{ gridTemplateColumns: 'auto 1fr', columnGap: '24px' }}
    >
      <Sidebar
        categories={categories}
        activeCategory={isFavoritesView ? 'favorites' : activeCategory}
        onCategoryChange={handleCategoryChange}
        onAuthClick={() => setAuthOpen(true)}
        onAdminClick={() => setAdminOpen(true)}
      />

      <div className="flex flex-col min-w-0 min-h-0 overflow-hidden">
        <Header
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          theme={settings.theme}
          onToggleTheme={toggleTheme}
        />
        <MainContent
          category={baseCategory}
          tools={filteredTools}
          searchQuery={debouncedQuery}
          favoritesOnly={isFavoritesView}
          onAuthRequest={() => setAuthOpen(true)}
        />
      </div>

      <AuthPanel open={authOpen} onClose={() => setAuthOpen(false)} />
      {isAdmin && <AdminPanel open={adminOpen} onClose={() => setAdminOpen(false)} />}
    </div>
  );
}

export default App;