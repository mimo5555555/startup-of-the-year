import { createContext, useContext } from 'react';
import type { TokyoWorld } from '@lw/world';
import { useStore } from './store';
import { dirOf, translate, type StringKey, type UiLang } from './i18n';

export const WorldCtx = createContext<TokyoWorld | null>(null);
export const useWorld = () => useContext(WorldCtx);

export function useT() {
  const lang = useStore((s) => s.uiLang);
  return {
    lang,
    dir: dirOf(lang),
    t: (key: StringKey, vars?: Record<string, string | number>) => translate(lang, key, vars),
  };
}

export const useLang = (): UiLang => useStore((s) => s.uiLang);
