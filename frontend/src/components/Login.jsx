import { useState } from 'react';
import { LogIn } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Login() {
  const [email, setEmail] = useState('');
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
      const user = await login(email, senha);
      navigate(user.role === 'gerente' ? '/admin' : '/manuais');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="auth-section">
      <form className="auth-card" onSubmit={handleSubmit}>
        <div>
          <p className="eyebrow">Acesso seguro</p>
          <h1>Entrar no sistema</h1>
        </div>

        {error && <p className="alert">{error}</p>}

        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
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
