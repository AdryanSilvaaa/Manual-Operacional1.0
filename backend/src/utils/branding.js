/**
 * Regras da aparência (white label): quais cores podem ser trocadas e como as logos são validadas.
 * As chaves das cores precisam bater com frontend/src/constants/branding.js.
 */
export const BRAND_COLOR_KEYS = [
  'sidebarStart', 'sidebarEnd', 'sidebarText', 'sidebarHoverText', 'sidebarHoverBg',
  'primary', 'primaryHover', 'primaryText', 'title', 'accent'
];
export const LOGO_KEYS = ['logoLight', 'logoDark'];

const HEX_COLOR = /^#[0-9a-f]{6}$/i;
// A logo fica no próprio banco como data URL (imagens pequenas), então funciona igual em qualquer modo de armazenamento.
const LOGO_DATA_URL = /^data:image\/(png|jpeg|webp|svg\+xml);base64,[A-Za-z0-9+/]+=*$/;
export const MAX_LOGO_BYTES = 512 * 1024;

/**
 * Confere o que veio da tela e devolve só os campos aceitos.
 * Cor ausente ou vazia volta ao padrão; logo null volta à logo padrão do produto.
 */
export function sanitizeBranding(input = {}) {
  const colors = {};
  for (const key of BRAND_COLOR_KEYS) {
    const value = input.colors?.[key];
    if (value === undefined || value === null || value === '') continue;
    if (!HEX_COLOR.test(String(value))) return { error: `Cor inválida em "${key}". Use o formato #RRGGBB.` };
    colors[key] = String(value).toLowerCase();
  }

  const logos = {};
  for (const key of LOGO_KEYS) {
    const value = input[key];
    if (value === undefined || value === null || value === '') continue;
    if (!LOGO_DATA_URL.test(String(value))) return { error: 'Logo inválida. Envie uma imagem PNG, JPG, WebP ou SVG.' };
    const base64 = String(value).split(',')[1];
    const bytes = Math.floor((base64.length * 3) / 4);
    if (bytes > MAX_LOGO_BYTES) return { error: `A logo passa de ${MAX_LOGO_BYTES / 1024} KB. Reduza a imagem antes de enviar.` };
    logos[key] = String(value);
  }

  return { value: { colors, ...logos } };
}
