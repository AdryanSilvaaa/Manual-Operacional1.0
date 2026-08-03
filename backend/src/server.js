/**
 * Entrada do backend: carrega o ambiente e abre a porta HTTP.
 * Altere PORT no .env para mudar a porta; a configuração da API fica em app.js.
 */
import 'dotenv/config';
import app from './app.js';

const port = Number(process.env.PORT) || 4000;

app.listen(port, () => {
  console.log(`API rodando em http://localhost:${port}`);
});
