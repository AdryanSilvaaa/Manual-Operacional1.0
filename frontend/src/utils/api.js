/** Utilitários HTTP compartilhados; mudar cabeçalhos ou erros aqui afeta os formulários administrativos. */
/**
 * Monta os cabeçalhos autenticados usados pelas páginas administrativas.
 * O Content-Type só é incluído para JSON, nunca para FormData.
 */
export function createAuthHeaders(token, isJson = true) {
  const headers = { Authorization: `Bearer ${token}` };

  if (isJson) {
    headers['Content-Type'] = 'application/json';
  }

  return headers;
}

/** Lê a resposta da API e transforma erros HTTP em erros de interface. */
export async function readResponse(response) {
  const data = response.status === 204 ? null : await response.json();

  if (!response.ok) {
    throw new Error(data?.message || 'Não foi possível concluir a operação.');
  }

  return data;
}
