/**
 * Entrada do React: conecta a aplicação ao #root e instala roteamento, autenticação e pop-ups de mensagem.
 * Altere os providers globais aqui; rotas e páginas são configuradas em AppRoutes.jsx.
 */
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import AppRoutes from './AppRoutes.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { BrandingProvider } from './context/BrandingContext.jsx';
import { ToastProvider } from './context/ToastContext.jsx';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <BrandingProvider>
        <ToastProvider>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </ToastProvider>
      </BrandingProvider>
    </BrowserRouter>
  </React.StrictMode>
);
