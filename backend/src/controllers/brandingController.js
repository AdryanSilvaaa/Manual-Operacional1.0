/**
 * Aparência da aplicação (white label). A leitura é pública porque a tela de login já usa as cores e a logo;
 * só o admin grava.
 */
import { getSetting, saveSetting } from '../models/Setting.js';
import { audit } from '../models/Audit.js';
import { demoStore, shouldUseDemoStore } from '../config/demoStore.js';
import { sanitizeBranding } from '../utils/branding.js';

const KEY = 'branding';
const EMPTY = { colors: {} };

export async function show(req, res) {
  let setting;
  try {
    setting = await getSetting(KEY);
  } catch (error) {
    if (!shouldUseDemoStore(error)) throw error;
    setting = demoStore.getSetting(KEY);
  }
  // Sempre revalida: a troca de cores precisa aparecer para todos sem esperar o cache expirar.
  res.set('Cache-Control', 'no-cache');
  res.json({ ...EMPTY, ...(setting?.value || {}), updated_at: setting?.updated_at || null });
}

export async function update(req, res) {
  const result = sanitizeBranding(req.body);
  if (result.error) return res.status(400).json({ message: result.error });

  let saved;
  try {
    saved = await saveSetting(KEY, result.value, req.user.id);
    await audit(req.user.id, 'branding_updated', 'setting', KEY, {
      colors: Object.keys(result.value.colors),
      logoLight: Boolean(result.value.logoLight),
      logoDark: Boolean(result.value.logoDark)
    });
  } catch (error) {
    if (!shouldUseDemoStore(error)) throw error;
    saved = demoStore.saveSetting(KEY, result.value);
  }
  res.json({ ...EMPTY, ...saved.value, updated_at: saved.updated_at });
}
