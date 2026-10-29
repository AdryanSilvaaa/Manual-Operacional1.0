/**
 * Aparência (white label) carregada da API e aplicada em todo o site: cores viram variáveis CSS e as logos
 * alimentam components/BrandLogo.jsx. A tela Configurações > Aparência usa preview() para mostrar a mudança ao vivo.
 */
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { API_URL } from './AuthContext.jsx';
import { applyBrandColors, cacheBranding, DEFAULT_LOGOS, readCachedBranding } from '../constants/branding.js';

const EMPTY = { colors: {} };
const BrandingContext = createContext(null);

export function BrandingProvider({ children }) {
  const [saved, setSaved] = useState(() => readCachedBranding() || EMPTY);
  const [draft, setDraft] = useState(null);
  const current = draft || saved;

  useLayoutEffect(() => { applyBrandColors(current.colors); }, [current]);

  useEffect(() => {
    fetch(`${API_URL}/api/branding`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!data) return;
        setSaved(data);
        cacheBranding(data);
      })
      .catch(() => {});
  }, []);

  const commit = useCallback((data) => {
    setDraft(null);
    setSaved(data);
    cacheBranding(data);
  }, []);

  const value = useMemo(() => ({
    branding: saved,
    logos: {
      logoLight: current.logoLight || DEFAULT_LOGOS.logoLight,
      logoDark: current.logoDark || DEFAULT_LOGOS.logoDark
    },
    // Mostra uma aparência ainda não salva; preview(null) volta à salva.
    preview: setDraft,
    commit
  }), [saved, current, commit]);

  return <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>;
}

export function useBranding() {
  return useContext(BrandingContext);
}
