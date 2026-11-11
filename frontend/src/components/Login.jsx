/**
 * Formulário de entrada e redirecionamento inicial conforme o perfil.
 * Altere campos/validação aqui; a requisição e persistência da sessão ficam em AuthContext.jsx.
 */
import { useState } from 'react';
import { LogIn } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import BrandLogo from './BrandLogo.jsx';

export default function Login() {
  const [identificador, setIdentificador] = useState('');
  const [senha, setSenha] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);

    try {
      const user = await login(identificador, senha);
      // Senha provisória vai direto para a troca; senão volta à página pedida antes do login (ou Sistemas).
      const requestedPage = location.state?.from?.pathname;
      navigate(user.must_change_password ? '/alterar-senha' : (requestedPage || '/sistemas'), { replace: true });
    } catch (err) {
      toast.error(err.message);
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
