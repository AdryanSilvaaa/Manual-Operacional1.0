/**
 * Editor das perguntas de uma prova (até MAX_QUESTIONS, múltipla escolha A a D ou resposta aberta).
 * Usado em Criar Prova e na prova do manual em Criar Manual. Limites e tipos espelham backend/src/utils/exam.js.
 */
import { Plus, Trash2 } from 'lucide-react';
import { MAX_QUESTIONS, OPTION_LETTERS, QUESTION_TYPES } from '../constants/exam.js';

export function newQuestion() {
  return { type: QUESTION_TYPES.MULTIPLE_CHOICE, prompt: '', options: ['', '', '', ''], correctOption: 0 };
}

/** Perguntas vindas da API (modelo de prova) no formato do editor. */
export function templateQuestionsToEditor(questions = []) {
  return questions.map((question) => ({
    type: question.type,
    prompt: question.prompt,
    options: Array.isArray(question.options) ? [...question.options] : ['', '', '', ''],
    correctOption: question.correct_option ?? 0
  }));
}

/** Formato enviado ao backend: pergunta aberta vai sem alternativas. */
export function serializeQuestions(questions) {
  return questions.map((question) => (question.type === QUESTION_TYPES.OPEN
    ? { type: question.type, prompt: question.prompt }
    : question));
}

export default function ExamQuestionsEditor({ questions, onChange }) {
  function updateQuestion(index, changes) {
    onChange(questions.map((item, itemIndex) => (itemIndex === index ? { ...item, ...changes } : item)));
  }

  function updateOption(index, optionIndex, value) {
    onChange(questions.map((item, itemIndex) => (itemIndex === index
      ? { ...item, options: item.options.map((option, currentIndex) => (currentIndex === optionIndex ? value : option)) }
      : item)));
  }

  return <fieldset><legend>Perguntas ({questions.length} de {MAX_QUESTIONS})</legend>
    {questions.map((question, index) => <div className="quiz-editor" key={index}>
      <div className="exam-question-header">
        <strong>Pergunta {index + 1}</strong>
        <select aria-label={`Tipo da pergunta ${index + 1}`} value={question.type} onChange={(event) => updateQuestion(index, { type: event.target.value })}>
          <option value={QUESTION_TYPES.MULTIPLE_CHOICE}>Múltipla escolha (A a D)</option>
          <option value={QUESTION_TYPES.OPEN}>Resposta aberta</option>
        </select>
      </div>
      <label>Enunciado<textarea value={question.prompt} onChange={(event) => updateQuestion(index, { prompt: event.target.value })} required /></label>
      {question.type === QUESTION_TYPES.MULTIPLE_CHOICE && <>
        {question.options.map((option, optionIndex) => <label key={optionIndex}>Alternativa {OPTION_LETTERS[optionIndex]}<input value={option} onChange={(event) => updateOption(index, optionIndex, event.target.value)} required /></label>)}
        <label>Resposta correta<select value={question.correctOption} onChange={(event) => updateQuestion(index, { correctOption: Number(event.target.value) })}>{OPTION_LETTERS.map((letter, optionIndex) => <option value={optionIndex} key={letter}>Alternativa {letter}</option>)}</select></label>
      </>}
      {question.type === QUESTION_TYPES.OPEN && <p className="hint">O colaborador responde em texto livre. A resposta aparece em Resultados de Provas e não entra na nota.</p>}
      {questions.length > 1 && <button type="button" className="secondary-button" onClick={() => onChange(questions.filter((_, itemIndex) => itemIndex !== index))}><Trash2 size={15} /> Remover pergunta</button>}
    </div>)}
    {questions.length < MAX_QUESTIONS && <button type="button" className="secondary-button" onClick={() => onChange([...questions, newQuestion()])}><Plus size={15} /> Adicionar pergunta</button>}
  </fieldset>;
}
