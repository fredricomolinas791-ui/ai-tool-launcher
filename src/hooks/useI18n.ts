import { useSettings } from './useSettings';
import { UI, type UILang } from '../i18n/strings';

export function useI18n() {
  const { settings } = useSettings();
  const lang: UILang = settings.language;
  return { lang, t: UI[lang] };
}
