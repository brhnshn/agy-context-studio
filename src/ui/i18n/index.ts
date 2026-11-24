import type { LanguageCode } from '../../core/types.js';
import { en, type TranslationDict } from './en.js';
import { tr } from './tr.js';

export function getTranslations(lang: LanguageCode): TranslationDict {
  return (lang === 'tr' ? tr : en) as TranslationDict;
}
