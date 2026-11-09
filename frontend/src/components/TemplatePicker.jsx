/**
 * "Usar modelo": lista os modelos de prova do setor do usuário e entrega o modelo escolhido (com perguntas)
 * para a tela preencher o formulário. Usado em Criar Prova e na prova do manual em Criar Manual.
 */
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { createAuthHeaders, readResponse } from '../utils/api.js';
import { templateQuestionsToEditor } from './ExamQuestionsEditor.jsx';

export default function TemplatePicker({ value, onPick }) {
  const { apiUrl, token } = useAuth();
  const toast = useToast();
  const [templates, setTemplates] = useState([]);

  useEffect(() => {
    fetch(`${apiUrl}/api/exam-templates`, { headers: createAuthHeaders(token) })
      .then(readResponse).then(setTemplates).catch(() => setTemplates([]));
  }, [apiUrl, token]);

  async function choose(id) {
    if (!id) { onPick(null); return; }
    try {
      const template = await readResponse(await fetch(`${apiUrl}/api/exam-templates/${id}`, { headers: createAuthHeaders(token) }));
      onPick({ ...template, editorQuestions: templateQuestionsToEditor(template.questions) });
    } catch (error) { toast.error(error.message); }
  }

  if (!templates.length) return null;
  return <label>Usar modelo de prova (opcional)
    <select value={value || ''} onChange={(event) => choose(event.target.value)}>
      <option value="">Montar do zero</option>
      {templates.map((template) => <option key={template.id} value={template.id}>{template.titulo} ({template.sector_name})</option>)}
    </select>
    <span className="hint">As perguntas do modelo são copiadas e podem ser ajustadas antes de salvar.</span>
  </label>;
}
