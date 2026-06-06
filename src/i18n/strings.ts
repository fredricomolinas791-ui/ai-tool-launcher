// Centralized i18n strings for UI chrome. Tool/category names live in tools.ts.

export interface UIStrings {
  brandName: string;
  brandSub: string;
  searchPlaceholder: string;
  navUser: string;
  navUserRole: string;
  ariaTheme: string;
  ariaSettings: string;
  searchResultsFor: string;
  statusUnimplemented: string;
  statusReady: string;
  tagHot: string;
  tagNew: string;
  emptyTitle: string;
  emptyHint: string;
  totalLabel: string;
  favorite: string;
  unfavorite: string;
  favoritesEmpty: string;
  favoritesHint: string;
  signInToFavorite: string;
}

export const UI: Record<'zh' | 'en', UIStrings> = {
  zh: {
    brandName: 'AI Tools',
    brandSub: 'LAUNCHER',
    searchPlaceholder: '搜索 AI 工具...',
    navUser: 'User',
    navUserRole: 'Pro 会员',
    ariaTheme: '切换主题',
    ariaSettings: '设置',
    searchResultsFor: '搜索',
    statusUnimplemented: '未实现',
    statusReady: '可用',
    tagHot: 'HOT',
    tagNew: 'NEW',
    emptyTitle: '未找到相关工具',
    emptyHint: '试试其他关键词或切换分类',
    totalLabel: '个工具',
    favorite: '收藏',
    unfavorite: '取消收藏',
    favoritesEmpty: '还没有收藏的工具',
    favoritesHint: '点卡片右上角的 ♡ 收藏常用工具',
    signInToFavorite: '请先登录后再收藏',
  },
  en: {
    brandName: 'AI Tools',
    brandSub: 'LAUNCHER',
    searchPlaceholder: 'Search AI tools...',
    navUser: 'User',
    navUserRole: 'Pro Member',
    ariaTheme: 'Cycle theme',
    ariaSettings: 'Settings',
    searchResultsFor: 'Search',
    statusUnimplemented: 'Coming soon',
    statusReady: 'Ready',
    tagHot: 'HOT',
    tagNew: 'NEW',
    emptyTitle: 'No matching tools',
    emptyHint: 'Try different keywords or change category',
    totalLabel: 'tools',
    favorite: 'Add to favorites',
    unfavorite: 'Remove from favorites',
    favoritesEmpty: 'No favorites yet',
    favoritesHint: 'Tap the ♡ on any card to save it here',
    signInToFavorite: 'Sign in to save favorites',
  },
};

export type UILang = 'zh' | 'en';

export function t(lang: UILang): UIStrings {
  return UI[lang];
}
