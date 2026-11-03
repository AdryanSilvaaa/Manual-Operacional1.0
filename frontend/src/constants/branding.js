/**
 * Cores e logos que o suporte pode trocar em Configurações > Aparência (white label).
 * Cada cor aponta para uma variável de styles/tokens.css; as chaves precisam bater com backend/src/utils/branding.js.
 * "default" é o valor mostrado no seletor quando nada foi personalizado (igual ao de tokens.css).
 */
export const BRAND_COLOR_GROUPS = [
  {
    title: 'Sidebar e menus',
    colors: [
      { key: 'sidebarStart', cssVar: '--sidebar-bg-start', label: 'Fundo da sidebar (topo)', default: '#222a69' },
      { key: 'sidebarEnd', cssVar: '--sidebar-bg-end', label: 'Fundo da sidebar (base)', default: '#171d4d' },
      { key: 'sidebarText', cssVar: '--sidebar-text', label: 'Ícones e textos do menu', default: '#d9ddff' },
      { key: 'sidebarHoverText', cssVar: '--sidebar-text-hover', label: 'Texto do menu ao passar o mouse', default: '#ffffff' },
      { key: 'sidebarHoverBg', cssVar: '--sidebar-hover-bg', label: 'Fundo do item ao passar o mouse', default: '#3b4275' }
    ]
  },
  {
    title: 'Botões',
    colors: [
      { key: 'primary', cssVar: '--color-primary', label: 'Cor dos botões e destaques', default: '#cc3399' },
      { key: 'primaryHover', cssVar: '--color-primary-hover', label: 'Botões ao passar o mouse', default: '#a8277f' },
      { key: 'primaryText', cssVar: '--color-on-primary', label: 'Texto dos botões', default: '#ffffff' }
    ]
  },
  {
    title: 'Títulos e textos',
    colors: [
      { key: 'title', cssVar: '--color-navy', label: 'Títulos e textos de destaque', default: '#222a69' },
      { key: 'accent', cssVar: '--color-sky', label: 'Subtítulos, links e detalhes', default: '#00aaff' }
    ]
  }
];

export const BRAND_COLORS = BRAND_COLOR_GROUPS.flatMap((group) => group.colors);

// Logo clara: usada na sidebar (fundo escuro). Logo escura: login e cabeçalho (fundo claro).
export const DEFAULT_LOGOS = {
  logoLight: '/brand/logo_duplo-Branco.png',
  logoDark: '/brand/logo_duplo-azul escuro.png'
};

export const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
export const MAX_LOGO_KB = 512;

/** Aplica as cores personalizadas no documento; cor não personalizada volta ao valor de tokens.css. */
export function applyBrandColors(colors = {}) {
  const root = document.documentElement.style;
  BRAND_COLORS.forEach(({ key, cssVar }) => {
    if (colors[key]) root.setProperty(cssVar, colors[key]);
    else root.removeProperty(cssVar);
  });
}

// Guarda a última aparência no navegador para aplicar as cores antes da resposta da API (evita piscar as cores padrão).
const CACHE_KEY = 'branding';

export function readCachedBranding() {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY)) || null;
  } catch {
    return null;
  }
}

export function cacheBranding(branding) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(branding));
  } catch {
    // Sem espaço ou armazenamento bloqueado: a aparência ainda vem da API a cada carregamento.
  }
}

/** Contraste WCAG entre duas cores #RRGGBB (1 a 21). Abaixo de 3, texto e fundo ficam difíceis de ler. */
export function contrastRatio(first, second) {
  const luminance = (hex) => {
    const [r, g, b] = [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16) / 255)
      .map((channel) => (channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const [light, dark] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (light + 0.05) / (dark + 0.05);
}
