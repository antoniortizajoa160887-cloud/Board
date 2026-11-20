/** English / Spanish text. Write each string in place as tr('English', 'Español'). */
import { profile, save } from './save';

export type Lang = 'en' | 'es';

export const lang = (): Lang => profile.settings.lang;

export const tr = (en: string, es: string) => (profile.settings.lang === 'es' ? es : en);

export function setLang(l: Lang) {
  profile.settings.lang = l;
  document.documentElement.lang = l;
  save();
}

/** Locale for numbers and dates. */
export const locale = () => (profile.settings.lang === 'es' ? 'es-US' : 'en-US');
