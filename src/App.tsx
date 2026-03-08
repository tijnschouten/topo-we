import { useEffect, useMemo, useState } from 'react';
import TopoMap from './components/TopoMap';
import { categoryLabels, topoItems } from './data/topoItems';
import type { AnswerOutcome, Category, QuizQuestion, QuizSettings, TopoItem } from './types';
import {
  buildQuestions,
  calculateScore,
  calculateStreak,
  filterItemsByCategory,
  loadBestScore,
  loadSettings,
  saveBestScore,
  saveSettings
} from './utils/quiz';

type Stage = 'setup' | 'playing' | 'finished';

const allCategories: Category[] = ['land', 'plaats', 'water', 'gebied'];

function defaultSettings(): QuizSettings {
  const stored = loadSettings();
  if (stored && stored.categories.length > 0) {
    return stored;
  }
  return { mode: 'zoek-op-kaart', categories: allCategories };
}

function createInitialStats() {
  return {
    land: { correct: 0, attempted: 0 },
    plaats: { correct: 0, attempted: 0 },
    water: { correct: 0, attempted: 0 },
    gebied: { correct: 0, attempted: 0 }
  };
}

export default function App() {
  const [settings, setSettings] = useState<QuizSettings>(defaultSettings);
  const [stage, setStage] = useState<Stage>('setup');
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestScore, setBestScore] = useState(loadBestScore);
  const [feedback, setFeedback] = useState<AnswerOutcome | null>(null);
  const [categoryStats, setCategoryStats] = useState(createInitialStats);
  const [error, setError] = useState('');

  const currentQuestion = questions[index];
  const progressLabel = `${Math.min(index + 1, questions.length)}/${questions.length}`;

  const itemByTargetId = useMemo(() => {
    return topoItems.reduce<Record<string, TopoItem>>((acc, item) => {
      acc[item.targetId] = item;
      return acc;
    }, {});
  }, []);

  useEffect(() => {
    saveSettings(settings.mode, settings.categories);
  }, [settings]);

  useEffect(() => {
    if (stage !== 'playing' || settings.mode !== 'wat-is-dit' || feedback || !currentQuestion) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (!['1', '2', '3', '4'].includes(event.key)) return;
      const optionIndex = Number(event.key) - 1;
      const option = currentQuestion.opties[optionIndex];
      if (!option) return;
      event.preventDefault();
      handleAnswer(option);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [stage, settings.mode, feedback, currentQuestion]);

  const startQuiz = () => {
    const items = filterItemsByCategory(topoItems, settings.categories);
    if (items.length === 0) {
      setError('Kies minimaal één categorie om te starten.');
      return;
    }

    const builtQuestions = buildQuestions(items, settings.mode);
    setQuestions(builtQuestions);
    setIndex(0);
    setScore(0);
    setStreak(0);
    setFeedback(null);
    setCategoryStats(createInitialStats());
    setError('');
    setStage('playing');
  };

  const handleAnswer = (gekozenItem: TopoItem) => {
    if (!currentQuestion || feedback) return;

    const correctItem = currentQuestion.item;
    const correct = gekozenItem.id === correctItem.id;
    const newScore = calculateScore(score, correct);
    const newStreak = calculateStreak(streak, correct);

    setScore(newScore);
    setStreak(newStreak);
    setCategoryStats((prev) => ({
      ...prev,
      [correctItem.categorie]: {
        attempted: prev[correctItem.categorie].attempted + 1,
        correct: prev[correctItem.categorie].correct + (correct ? 1 : 0)
      }
    }));

    setFeedback({
      correct,
      correctItem,
      gekozenItem: correct ? undefined : gekozenItem
    });
  };

  const handleMapTargetClick = (targetIds: string[]) => {
    if (!currentQuestion || settings.mode !== 'zoek-op-kaart' || feedback) return;
    if (targetIds.includes(currentQuestion.item.targetId)) {
      handleAnswer(currentQuestion.item);
      return;
    }

    const gekozenItem = itemByTargetId[targetIds[0]];
    if (!gekozenItem) return;
    handleAnswer(gekozenItem);
  };

  const nextQuestion = () => {
    if (!currentQuestion || !feedback) return;

    if (index >= questions.length - 1) {
      saveBestScore(score);
      setBestScore((prev) => Math.max(prev, score));
      setStage('finished');
      return;
    }

    setIndex((prev) => prev + 1);
    setFeedback(null);
  };

  const toggleCategory = (category: Category) => {
    setSettings((prev) => {
      const enabled = prev.categories.includes(category);
      const categories = enabled
        ? prev.categories.filter((value) => value !== category)
        : [...prev.categories, category];
      return {
        ...prev,
        categories
      };
    });
  };

  const resetToSetup = () => {
    setStage('setup');
    setFeedback(null);
    setError('');
  };

  return (
    <main className="app-shell">
      <header className={`app-header ${stage === 'playing' ? 'app-header-compact' : ''}`}>
        <h1>Topo Trainer: West-Europa</h1>
        {stage !== 'playing' && (
          <p>Leer landen, plaatsen, wateren en gebieden met directe feedback.</p>
        )}
      </header>

      {stage === 'setup' && (
        <section className="card setup-card" aria-label="Instellingen">
          <h2>Start je oefensessie</h2>

          <div className="setting-group">
            <p className="setting-label">Kies leerstand</p>
            <div className="mode-grid">
              <label className="mode-option">
                <input
                  type="radio"
                  name="mode"
                  checked={settings.mode === 'zoek-op-kaart'}
                  onChange={() => setSettings((prev) => ({ ...prev, mode: 'zoek-op-kaart' }))}
                />
                <span>Zoek op kaart</span>
              </label>
              <label className="mode-option">
                <input
                  type="radio"
                  name="mode"
                  checked={settings.mode === 'wat-is-dit'}
                  onChange={() => setSettings((prev) => ({ ...prev, mode: 'wat-is-dit' }))}
                />
                <span>Wat is dit? (meerkeuze)</span>
              </label>
            </div>
          </div>

          <div className="setting-group">
            <p className="setting-label">Kies categorieën</p>
            <div className="category-grid">
              {allCategories.map((category) => (
                <label key={category} className="category-option">
                  <input
                    type="checkbox"
                    checked={settings.categories.includes(category)}
                    onChange={() => toggleCategory(category)}
                  />
                  <span>{categoryLabels[category]}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="setup-footer">
            <button type="button" className="cta-button" onClick={startQuiz}>
              Start oefenen
            </button>
            <p className="best-score">Beste score: {bestScore}</p>
          </div>

          {error && <p className="error-text">{error}</p>}
        </section>
      )}

      {stage === 'playing' && currentQuestion && (
        <section className="play-layout" aria-label="Quiz">
          <aside className="card status-card">
            <p className="meta-row">
              <strong>Voortgang:</strong> {progressLabel}
            </p>
            <p className="meta-row">
              <strong>Score:</strong> {score}
            </p>
            <p className="meta-row">
              <strong>Streak:</strong> {streak}
            </p>
            <p className="meta-row">
              <strong>Categorie:</strong> {categoryLabels[currentQuestion.item.categorie]}
            </p>

            <div className="prompt-box">
              {settings.mode === 'zoek-op-kaart' ? (
                <>
                  <h2>Zoek op kaart</h2>
                  <p>Klik op: <strong>{currentQuestion.item.naam}</strong></p>
                </>
              ) : (
                <>
                  <h2>Wat is dit?</h2>
                  <p>Kies de juiste naam voor het gemarkeerde onderdeel.</p>
                  <p className="hint-hotkey">Tip: gebruik toets 1 t/m 4.</p>
                </>
              )}
            </div>

            {settings.mode === 'wat-is-dit' && (
              <div className="choices" role="group" aria-label="Antwoordopties">
                {currentQuestion.opties.map((option, optionIndex) => (
                  <button
                    key={option.id}
                    type="button"
                    className="choice-button"
                    onClick={() => handleAnswer(option)}
                    disabled={Boolean(feedback)}
                  >
                    {optionIndex + 1}. {option.naam}
                  </button>
                ))}
              </div>
            )}

            {feedback && (
              <div className={`feedback-box ${feedback.correct ? 'ok' : 'wrong'}`}>
                <p>
                  {feedback.correct
                    ? 'Goed gedaan!'
                    : `Niet goed. Dit was: ${feedback.correctItem.naam}.`}
                </p>
                <p className="hint-text">Hint: {feedback.correctItem.hint}</p>
                {feedback.gekozenItem && (
                  <p className="hint-text">Jouw antwoord: {feedback.gekozenItem.naam}</p>
                )}
                <button type="button" className="cta-button" onClick={nextQuestion}>
                  {index >= questions.length - 1 ? 'Bekijk eindscore' : 'Volgende vraag'}
                </button>
              </div>
            )}
          </aside>

          <div className="card map-card">
            <TopoMap
              interactive={settings.mode === 'zoek-op-kaart' && !feedback}
              onTargetClick={handleMapTargetClick}
              highlightedTargetId={settings.mode === 'wat-is-dit' ? currentQuestion.item.targetId : undefined}
              correctTargetId={feedback?.correctItem.targetId}
              wrongTargetId={
                feedback?.gekozenItem && feedback.gekozenItem.id !== feedback.correctItem.id
                  ? feedback.gekozenItem.targetId
                  : undefined
              }
            />
          </div>
        </section>
      )}

      {stage === 'finished' && (
        <section className="card result-card" aria-label="Eindscore">
          <h2>Klaar met oefenen</h2>
          <p className="final-score">Jouw score: {score} / {questions.length}</p>
          <p className="best-score">Beste score ooit: {Math.max(bestScore, score)}</p>

          <div className="stats-grid">
            {allCategories.map((category) => {
              const stat = categoryStats[category];
              const percentage = stat.attempted > 0 ? Math.round((stat.correct / stat.attempted) * 100) : 0;
              return (
                <article key={category} className="category-stat">
                  <h3>{categoryLabels[category]}</h3>
                  <p>{stat.correct}/{stat.attempted} goed ({percentage}%)</p>
                </article>
              );
            })}
          </div>

          <div className="result-actions">
            <button type="button" className="cta-button" onClick={startQuiz}>
              Opnieuw oefenen
            </button>
            <button type="button" className="ghost-button" onClick={resetToSetup}>
              Instellingen aanpassen
            </button>
          </div>
        </section>
      )}
    </main>
  );
}
