import { useState } from 'react';
import { LogIn } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import BrandLogo from './BrandLogo.jsx';

export default function Login() {
  const [identificador, setIdentificador] = useState('');
  const [senha, setSenha] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const user = await login(identificador, senha);
      navigate(user.role === 'gerente' ? '/configuracoes' : '/sistemas');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="auth-section">
      <form className="auth-card" onSubmit={handleSubmit}>
        <BrandLogo />
        <div>
          <p className="eyebrow">Acesso seguro</p>
          <h1>Entrar no sistema</h1>
        </div>

        {error && <p className="alert">{error}</p>}

        <label>
          Usuário
          <input
            value={identificador}
            onChange={(event) => setIdentificador(event.target.value)}
            required
          />
        </label>

        <label>
          Senha
          <input
            type="password"
            value={senha}
            onChange={(event) => setSenha(event.target.value)}
            required
          />
        </label>

        <button className="primary-button" type="submit" disabled={submitting}>
          <LogIn size={18} />
          {submitting ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
    </section>
  );
}
