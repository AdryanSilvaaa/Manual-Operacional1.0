/**
 * Pop-ups (toasts) globais de sucesso, erro e aviso, exibidos no canto da tela em qualquer página.
 * Uso nas telas: const toast = useToast(); toast.success('Salvo.'); toast.error(error.message); toast.info('...').
 * Os pop-ups ficam acima de tudo e sobrevivem à troca de página. Estilos em styles/components.css (seção POP-UPS).
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

// Tempo na tela, em milissegundos. Erro fica mais tempo para dar tempo de ler o motivo.
const DURATION = { success: 4500, info: 6000, error: 8000 };
// Acima disso, o pop-up mais antigo sai para não cobrir a tela.
const MAX_VISIBLE = 4;
// Duração da animação de saída; precisa casar com .toast-leaving em components.css.
const LEAVE_MS = 200;

const ICONS = { success: CheckCircle2, error: AlertCircle, info: Info };
const TITLES = { success: 'Sucesso', error: 'Erro', info: 'Aviso' };

let nextId = 0;

function Toast({ toast, onClose }) {
  const Icon = ICONS[toast.type];
  const timer = useRef(null);
  const remaining = useRef(toast.duration);
  const startedAt = useRef(0);

  // O tempo para enquanto o mouse está em cima, para dar tempo de ler mensagens longas.
  const start = useCallback(() => {
    startedAt.current = Date.now();
    timer.current = setTimeout(() => onClose(toast.id), remaining.current);
  }, [onClose, toast.id]);

  const pause = useCallback(() => {
    clearTimeout(timer.current);
    remaining.current -= Date.now() - startedAt.current;
  }, []);

  // Mensagem repetida reinicia a contagem (version muda); ver push() no provider.
  useEffect(() => {
    remaining.current = toast.duration;
    start();
    return () => clearTimeout(timer.current);
  }, [start, toast.duration, toast.version]);

  return <div
    className={`toast toast-${toast.type}${toast.leaving ? ' toast-leaving' : ''}`}
    role={toast.type === 'error' ? 'alert' : 'status'}
    onMouseEnter={pause}
    onMouseLeave={start}
  >
    <Icon className="toast-icon" size={20} aria-hidden="true" />
    <div className="toast-body">
      <strong>{TITLES[toast.type]}</strong>
      <p>{toast.message}</p>
    </div>
    <button type="button" className="toast-close" onClick={() => onClose(toast.id)} aria-label="Fechar mensagem"><X size={16} /></button>
    <span className="toast-progress" style={{ animationDuration: `${toast.duration}ms` }} key={toast.version} />
  </div>;
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const remove = useCallback((id) => {
    setToasts((current) => current.map((item) => (item.id === id ? { ...item, leaving: true } : item)));
    setTimeout(() => setToasts((current) => current.filter((item) => item.id !== id)), LEAVE_MS);
  }, []);

  const push = useCallback((type, message) => {
    if (!message) return;
    const text = String(message);
    setToasts((current) => {
      // A mesma mensagem já aberta não duplica: só reinicia o tempo (evita pilhas iguais em cliques repetidos).
      const same = current.find((item) => !item.leaving && item.type === type && item.message === text);
      if (same) return current.map((item) => (item === same ? { ...item, version: item.version + 1 } : item));
      const toast = { id: ++nextId, type, message: text, duration: DURATION[type], version: 0, leaving: false };
      return [...current, toast].slice(-MAX_VISIBLE);
    });
  }, []);

  const api = useMemo(() => ({
    success: (message) => push('success', message),
    error: (message) => push('error', message),
    info: (message) => push('info', message)
  }), [push]);

  return <ToastContext.Provider value={api}>
    {children}
    <div className="toast-viewport" aria-live="polite">
      {toasts.map((toast) => <Toast key={toast.id} toast={toast} onClose={remove} />)}
    </div>
  </ToastContext.Provider>;
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast precisa estar dentro de <ToastProvider>.');
  return context;
}
