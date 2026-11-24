import { useState } from 'react';
import { checkStudyAnswer } from '../lib/api';
import type { StudyItem } from '../types';

type QuizQuestionProps = {
  item: StudyItem;
  token: string;
  documentId: string;
  onOpenSource: (page: number) => void;
};

export default function QuizQuestion({ item, token, documentId, onOpenSource }: QuizQuestionProps) {
  const [selectedOptions, setSelectedOptions] = useState<number[]>([]);
  const [result, setResult] = useState<Awaited<ReturnType<typeof checkStudyAnswer>> | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');

  function toggleOption(index: number) {
    if (result) return;
    setSelectedOptions((current) => current.includes(index)
      ? current.filter((option) => option !== index)
      : [...current, index]);
  }

  async function checkAnswer() {
    if (!selectedOptions.length || checking || result) return;
    setChecking(true);
    setError('');
    try {
      setResult(await checkStudyAnswer(token, documentId, item.id, selectedOptions));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not check your answer.');
    } finally {
      setChecking(false);
    }
  }

  return <div className="quiz-question">
    <p className="quiz-instructions">Select all that apply.</p>
    <div className="quiz-options" role="group" aria-label="Choose your answer options">
      {item.options.map((option, index) => <label className={`quiz-option${selectedOptions.includes(index) ? ' selected' : ''}`} key={`${index}-${option}`}>
        <input
          type="checkbox"
          checked={selectedOptions.includes(index)}
          disabled={Boolean(result) || checking}
          onChange={() => toggleOption(index)}
        />
        <span>{option}</span>
      </label>)}
    </div>
    {!result ? <button className="quiz-check-btn" disabled={!selectedOptions.length || checking} onClick={() => void checkAnswer()}>
      {checking ? 'Checking…' : 'Check answer'}
    </button> : <div className={`quiz-feedback ${result.isCorrect ? 'correct' : 'incorrect'}`} role="status">
      <strong>{result.isCorrect ? 'Correct!' : 'Not quite.'}</strong>
      {!result.isCorrect && <p><b>Correct answer:</b> {result.correctOptions.join('; ')}</p>}
      {result.explanation && <p>{result.explanation}</p>}
    </div>}
    {error && <p className="quiz-error" role="alert">{error}</p>}
    <button className="citation-inline" onClick={() => void onOpenSource(item.sourcePages[0] ?? 1)}>
      Source page {item.sourcePages.join(', ') || '—'} ↗
    </button>
  </div>;
}
