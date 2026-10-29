/**
 * Aparência (white label): o suporte troca as cores da sidebar, dos menus, dos botões e dos títulos e as logos.
 * As mudanças aparecem ao vivo no site inteiro enquanto a tela está aberta e só valem para todos depois de salvar.
 */
import { useEffect, useState } from 'react';
import { ImageUp, Palette, RotateCcw, Save } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useBranding } from '../context/BrandingContext.jsx';
import { createAuthHeaders, readResponse } from '../utils/api.js';
import BackButton from '../components/BackButton.jsx';
import { BRAND_COLOR_GROUPS, BRAND_COLORS, contrastRatio, DEFAULT_LOGOS, LOGO_TYPES, MAX_LOGO_KB } from '../constants/branding.js';

const LOGOS = [
  { key: 'logoLight', title: 'Logo da sidebar', text: 'Aparece sobre o fundo escuro da sidebar. Prefira uma versão clara ou branca.', dark: true },
  { key: 'logoDark', title: 'Logo do login e do cabeçalho', text: 'Aparece sobre fundo claro. Prefira uma versão escura ou colorida.', dark: false }
];
const HEX = /^#[0-9a-f]{6}$/i;
const fromBranding = (branding) => ({ colors: { ...branding.colors }, logoLight: branding.logoLight || null, logoDark: branding.logoDark || null });

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Não foi possível ler a imagem.'));
    reader.readAsDataURL(file);
  });
}

export default function Aparencia() {
  const { apiUrl, token } = useAuth();
  const { branding, preview, commit } = useBranding();
  const [draft, setDraft] = useState(() => fromBranding(branding));
  const [edited, setEdited] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Se a aparência salva chegar da API depois de abrir a tela (página recarregada aqui), usa ela enquanto nada foi editado.
  useEffect(() => { if (!edited) setDraft(fromBranding(branding)); }, [branding, edited]);

  // Mostra o rascunho no site inteiro; ao sair da tela sem salvar, volta à aparência salva.
  useEffect(() => { preview(draft); }, [draft, preview]);
  useEffect(() => () => preview(null), [preview]);

  const colorOf = (key) => draft.colors[key] || BRAND_COLORS.find((item) => item.key === key).default;
  const lowContrast = contrastRatio(colorOf('primaryText'), colorOf('primary')) < 3;

  function setColor(key, value) {
    setMessage('');
    setEdited(true);
    setDraft((current) => ({ ...current, colors: { ...current.colors, [key]: value } }));
  }

  function resetColor(key) {
    setEdited(true);
    setDraft((current) => {
      const colors = { ...current.colors };
      delete colors[key];
      return { ...current, colors };
    });
  }

  async function chooseLogo(key, input) {
    const file = input.files[0];
    input.value = '';
    if (!file) return;
    setError('');
    if (!LOGO_TYPES.includes(file.type)) return setError('Envie a logo em PNG, JPG, WebP ou SVG.');
    if (file.size > MAX_LOGO_KB * 1024) return setError(`A logo tem ${Math.round(file.size / 1024)} KB. O limite é ${MAX_LOGO_KB} KB.`);
    const dataUrl = await readAsDataUrl(file);
    setEdited(true);
    setDraft((current) => ({ ...current, [key]: dataUrl }));
  }

  async function handleSave() {
    // Campo de texto com cor incompleta não é enviado: a API só aceita #RRGGBB.
    const invalid = Object.entries(draft.colors).find(([, value]) => !HEX.test(value));
    if (invalid) return setError(`Cor inválida: "${invalid[1]}". Use o formato #RRGGBB.`);
    setSaving(true);
    setError('');
    try {
      const response = await fetch(`${apiUrl}/api/branding`, { method: 'PUT', headers: createAuthHeaders(token), body: JSON.stringify(draft) });
      commit(await readResponse(response));
      setEdited(false);
      setMessage('Aparência salva. Ela vale para todos os usuários no próximo carregamento da página.');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  function discard() {
    setDraft(fromBranding(branding));
    setEdited(false);
    setMessage('');
    setError('');
  }

  function restoreDefaults() {
    setEdited(true);
    setDraft({ colors: {}, logoLight: null, logoDark: null });
    setMessage('Cores e logos padrão carregadas. Clique em Salvar para aplicar a todos.');
  }

  return <section className="admin-page">
    <BackButton fallback="/configuracoes" />
    <div className="page-heading"><p className="eyebrow">Configurações</p><h1>Aparência</h1><p>Cores e logos da plataforma. O que você muda aqui aparece na hora nesta tela; os demais usuários só veem depois de salvar.</p></div>
    {message && <p className="notice">{message}</p>}
    {error && <p className="alert">{error}</p>}

    <div className="branding-layout">
      <div className="branding-settings">
        {BRAND_COLOR_GROUPS.map((group) => <div className="admin-panel branding-panel" key={group.title}>
          <h2><Palette size={18} /> {group.title}</h2>
          {group.colors.map((item) => <div className="color-field" key={item.key}>
            <label htmlFor={`color-${item.key}`}>{item.label}</label>
            <input type="color" id={`color-${item.key}`} value={HEX.test(colorOf(item.key)) ? colorOf(item.key) : item.default} onChange={(event) => setColor(item.key, event.target.value)} />
            <input className="color-hex" aria-label={`${item.label} (código)`} value={colorOf(item.key)} maxLength={7} onChange={(event) => setColor(item.key, event.target.value.trim())} />
            <button type="button" className="secondary-button" onClick={() => resetColor(item.key)} disabled={!draft.colors[item.key]} title="Voltar à cor padrão">Padrão</button>
          </div>)}
          {group.title === 'Botões' && lowContrast && <p className="hint branding-warning">Pouco contraste entre o texto e a cor do botão: pode ficar difícil de ler.</p>}
        </div>)}

        <div className="admin-panel branding-panel">
          <h2><ImageUp size={18} /> Logos</h2>
          <div className="logo-grid">
            {LOGOS.map((logo) => <div className="logo-field" key={logo.key}>
              <strong>{logo.title}</strong>
              <span className="hint">{logo.text}</span>
              <div className={`logo-preview ${logo.dark ? 'logo-preview-dark' : ''}`}><img src={draft[logo.key] || DEFAULT_LOGOS[logo.key]} alt={logo.title} /></div>
              <div className="logo-actions">
                <label className="secondary-button file-button">Trocar imagem<input type="file" accept={LOGO_TYPES.join(',')} onChange={(event) => chooseLogo(logo.key, event.target)} /></label>
                <button type="button" className="secondary-button" onClick={() => { setEdited(true); setDraft((current) => ({ ...current, [logo.key]: null })); }} disabled={!draft[logo.key]}>Usar a padrão</button>
              </div>
            </div>)}
          </div>
          <p className="hint">PNG, JPG, WebP ou SVG, até {MAX_LOGO_KB} KB. De preferência com fundo transparente e formato horizontal.</p>
        </div>
      </div>

      <aside className="admin-panel branding-preview" aria-label="Pré-visualização">
        <h2>Pré-visualização</h2>
        <div className="preview-shell">
          <div className="preview-sidebar">
            <img src={draft.logoLight || DEFAULT_LOGOS.logoLight} alt="" />
            <span>Sistemas</span>
            <span className="preview-hover">Painel de uso</span>
            <span>Configurações</span>
          </div>
          <div className="preview-content">
            <p className="eyebrow">Subtítulo</p>
            <h3>Título da página</h3>
            <button type="button" className="primary-button">Botão</button>
            <button type="button" className="primary-button preview-button-hover">Botão com o mouse em cima</button>
          </div>
        </div>
        <p className="hint">O segundo item do menu e o segundo botão mostram as cores de quando o mouse passa por cima.</p>
      </aside>
    </div>

    <div className="branding-actions">
      <button type="button" className="primary-button" onClick={handleSave} disabled={saving}><Save size={17} />{saving ? 'Salvando...' : 'Salvar aparência'}</button>
      <button type="button" className="secondary-button" onClick={discard}>Descartar alterações</button>
      <button type="button" className="secondary-button" onClick={restoreDefaults}><RotateCcw size={15} /> Restaurar padrão</button>
    </div>
  </section>;
}
