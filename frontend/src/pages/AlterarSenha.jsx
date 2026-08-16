import { useState } from 'react';
import BackButton from '../components/BackButton.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function AlterarSenha() {
  const { apiUrl, token } = useAuth();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmation: '' });
  const [message, setMessage] = useState('');
  async function submit(event) {
    event.preventDefault();
    if (form.newPassword !== form.confirmation) return setMessage('A confirmação não confere.');
    const response = await fetch(`${apiUrl}/api/auth/password`, { method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    if (!response.ok) return setMessage((await response.json()).message);
    setForm({ currentPassword: '', newPassword: '', confirmation: '' });
    setMessage('Senha alterada com sucesso.');
  }
  return <section className="admin-page"><BackButton fallback="/sistemas" /><form className="admin-panel manual-form" onSubmit={submit}><h1>Alterar senha</h1>{message && <p className="notice">{message}</p>}<label>Senha atual<input type="password" value={form.currentPassword} onChange={(event) => setForm({ ...form, currentPassword: event.target.value })} required /></label><label>Nova senha<input type="password" minLength="8" value={form.newPassword} onChange={(event) => setForm({ ...form, newPassword: event.target.value })} required /></label><label>Confirmar nova senha<input type="password" value={form.confirmation} onChange={(event) => setForm({ ...form, confirmation: event.target.value })} required /></label><p className="hint">Use pelo menos 8 caracteres, uma letra e um número.</p><button className="primary-button">Alterar senha</button></form></section>;
}
