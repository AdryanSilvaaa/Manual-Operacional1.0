import { useEffect, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';

export default function Quiz({ apiUrl, token, manualId, onPassed }) {
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);

  useEffect(() => {
    fetch(`${apiUrl}/api/quiz/${manualId}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((response) => response.json()).then(setQuestions);
  }, [apiUrl, manualId, token]);

  if (!questions.length) return null;
  async function submit(event) {
    event.preventDefault();
    const response = await fetch(`${apiUrl}/api/quiz/${manualId}/attempts`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ answers }) });
    const data = await response.json();
    setResult(data);
    if (data.passed) onPassed?.();
  }

  return <form className="dashboard-panel quiz-form" onSubmit={submit}><h2>Questionário de aprendizagem</h2>{questions.map((question, index) => <fieldset key={question.id}><legend>{index + 1}. {question.prompt}</legend>{question.options.map((option, optionIndex) => <label className="quiz-option" key={optionIndex}><input type="radio" name={`question-${question.id}`} checked={Number(answers[question.id]) === optionIndex} onChange={() => setAnswers({ ...answers, [question.id]: optionIndex })} required />{option}</label>)}</fieldset>)}<button className="primary-button">Enviar respostas</button>{result && <p className={result.passed ? 'notice' : 'alert'}>{result.passed && <CheckCircle2 size={16} />} Nota: {result.score}% — {result.passed ? 'Aprovado' : 'Tente novamente'}</p>}</form>;
}
