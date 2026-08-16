export function isStrongPassword(value) {
  return typeof value === 'string' && value.length >= 8 && /[A-Za-z]/.test(value) && /\d/.test(value);
}

export function calculateQuizResult(questions, answers) {
  if (!questions.length) return { score: 100, passed: true, correct: 0, total: 0 };
  const correct = questions.filter((question) => Number(answers[question.id]) === Number(question.correct_option)).length;
  const score = Math.round((correct / questions.length) * 100);
  return { score, passed: score >= 70, correct, total: questions.length };
}
