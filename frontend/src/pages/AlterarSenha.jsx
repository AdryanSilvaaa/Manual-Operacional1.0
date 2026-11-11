/**
 * Tela "Alterar senha". Também é a tela obrigatória do primeiro acesso: quem recebeu senha provisória
 * (cadastro, importação ou redefinição feita por outra pessoa) só consegue usar o sistema depois de trocá-la.
 * A regra de senha forte (8+ caracteres, letra e número) é validada de novo no backend (utils/security.js).
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BackButton from '../components/BackButton.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';

const EMPTY_FORM = { currentPassword: '', newPassword: '', confirmation: '' };

export default function AlterarSenha() {
  const { apiUrl, token, user, refreshUser } = useAuth();
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const navigate = useNavigate();
  const mustChange = Boolean(user?.must_change_password); // true = primeiro acesso com senha provisória

  // Atualiza um campo do formulário sem apagar os outros.
  const setField = (field) => (event) => setForm({ ...form, [field]: event.target.value });

  async function submit(event) {
    event.preventDefault();
    if (form.newPassword !== form.confirmation) return toast.error('A confirmação não confere.');
    setSaving(true);
    try {
      // Só senha atual e nova vão para a API (a confirmação é conferida aqui no navegador).
      const response = await fetch(`${apiUrl}/api/auth/password`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: form.currentPassword, newPassword: form.newPassword })
      });
      if (!response.ok) return toast.error((await response.json().catch(() => ({}))).message || 'Não foi possível alterar a senha.');
      setForm(EMPTY_FORM);
      toast.success('Senha alterada com sucesso.');
      if (mustChange) {
        await refreshUser(); // tira a marca de senha provisória e libera as outras telas
        navigate('/sistemas', { replace: true });
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="admin-page">
      {/* No primeiro acesso não há para onde voltar: as outras telas estão bloqueadas até a troca. */}
      {!mustChange && <BackButton fallback="/sistemas" />}
      <form className="admin-panel manual-form" onSubmit={submit}>
        <h1>{mustChange ? 'Crie a sua senha' : 'Alterar senha'}</h1>
        {mustChange && <p className="hint">Você entrou com uma senha provisória. Para continuar, escolha uma senha só sua.</p>}
        <label>Senha atual<input type="password" autoComplete="current-password" value={form.currentPassword} onChange={setField('currentPassword')} required /></label>
        <label>Nova senha<input type="password" autoComplete="new-password" minLength="8" maxLength="72" value={form.newPassword} onChange={setField('newPassword')} required /></label>
        <label>Confirmar nova senha<input type="password" autoComplete="new-password" value={form.confirmation} onChange={setField('confirmation')} required /></label>
        <p className="hint">Use pelo menos 8 caracteres, uma letra e um número.</p>
        <button className="primary-button" disabled={saving}>{saving ? 'Salvando...' : 'Alterar senha'}</button>
      </form>
    </section>
  );
}
