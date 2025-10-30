import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import sentencesSource from './data/sentences.json';
import { GameSettings, MetaStats, PracticeHistory, Sentence, DailyLog } from './types';
import { useLocalStore } from './hooks/useLocalStore';
import { useTTS } from './hooks/useTTS';
import { useVibration } from './hooks/useVibration';
import { TopBar } from './components/TopBar';
import { CoreLoop, AttemptResult } from './components/CoreLoop';
import { WordTiles } from './components/WordTiles';
import SettingsPanel from './components/Settings';
import ParentPanel, { ParentSummaryData } from './components/ParentPanel';
import { sampleWithoutReplacement, shuffle } from './utils/random';

const sentences = sentencesSource as Sentence[];

const DEFAULT_SETTINGS: GameSettings = {
  mode: 'type',
  tierMin: 1,
  tierMax: 3,
  sessionLength: 10,
  enableTTS: true,
  enableSFX: true,
  enableVibration: true,
  speechRate: 1
};

const DEFAULT_HISTORY: PracticeHistory = {};
const DEFAULT_META: MetaStats = { highestCombo: 0, totalAttempts: 0 };

interface SessionState {
  queue: Sentence[];
  currentIndex: number;
  combo: number;
  bestCombo: number;
  locked: boolean;
  lastAttempt: AttemptResult | null;
  roundSeed: number;
  finished: boolean;
}

interface StatusBanner {
  id: number;
  text: string;
}

function buildQueue(settings: GameSettings): Sentence[] {
  const filtered = sentences.filter(
    sentence => sentence.tier >= settings.tierMin && sentence.tier <= settings.tierMax
  );
  if (filtered.length === 0) return [];

  const grouped = filtered.reduce<Map<number, Sentence[]>>((acc, item) => {
    if (!acc.has(item.tier)) {
      acc.set(item.tier, []);
    }
    acc.get(item.tier)!.push(item);
    return acc;
  }, new Map());

  grouped.forEach((value, key) => {
    grouped.set(key, shuffle(value));
  });

  const orderedTiers = Array.from(grouped.keys()).sort((a, b) => a - b);
  const queue: Sentence[] = [];

  while (queue.length < settings.sessionLength) {
    let added = false;
    for (const tier of orderedTiers) {
      const bucket = grouped.get(tier);
      if (bucket && bucket.length > 0) {
        queue.push(bucket.shift()!);
        added = true;
        if (queue.length >= settings.sessionLength) break;
      }
    }
    if (!added) break;
  }

  if (queue.length < settings.sessionLength) {
    const remaining = filtered.filter(item => !queue.find(q => q.id === item.id));
    queue.push(...sampleWithoutReplacement(remaining, settings.sessionLength - queue.length));
  }

  return queue;
}

function getDateKey(timestamp: number) {
  return new Date(timestamp).toISOString().slice(0, 10);
}

function createDailyLog(date: string): DailyLog {
  return {
    date,
    attempts: 0,
    successes: 0,
    comboRecord: 0,
    sentences: {}
  };
}

function aggregateToday(history: PracticeHistory, sentencesMap: Map<number, Sentence>): ParentSummaryData | null {
  const todayKey = getDateKey(Date.now());
  const entry = history[todayKey];
  if (!entry) return null;

  const sentencesList = Object.values(entry.sentences).map(stat => ({
    sentenceId: stat.sentenceId,
    text: sentencesMap.get(stat.sentenceId)?.en ?? 'Unknown sentence',
    attempts: stat.attempts,
    successes: stat.successes
  }));

  const tagCounter = new Map<string, number>();
  sentencesList.forEach(item => {
    const source = sentencesMap.get(item.sentenceId);
    if (!source) return;
    source.tags.forEach(tag => {
      tagCounter.set(tag, (tagCounter.get(tag) ?? 0) + item.attempts);
    });
  });

  const totalTags = Array.from(tagCounter.values()).reduce((sum, value) => sum + value, 0);
  const tagStats = Array.from(tagCounter.entries())
    .map(([tag, value]) => ({
      tag,
      percentage: totalTags === 0 ? 0 : (value / totalTags) * 100
    }))
    .sort((a, b) => b.percentage - a.percentage)
    .slice(0, 8);

  return {
    dateLabel: todayKey,
    totalAttempts: entry.attempts,
    successes: entry.successes,
    comboRecord: entry.comboRecord,
    sentences: sentencesList,
    tagStats,
    totalUnique: sentencesList.length
  };
}

export default function App() {
  const [settings, setSettings] = useLocalStore<GameSettings>('jl-settings', DEFAULT_SETTINGS);
  const [history, setHistory] = useLocalStore<PracticeHistory>('jl-history', DEFAULT_HISTORY);
  const [meta, setMeta] = useLocalStore<MetaStats>('jl-meta', DEFAULT_META);
  const { speak, voices, supported: ttsSupported, unlock } = useTTS();
  const vibration = useVibration(settings.enableVibration);
  const audioContextRef = useRef<AudioContext | null>(null);
  const transitionTimerRef = useRef<number | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showParents, setShowParents] = useState(false);
  const [banner, setBanner] = useState<StatusBanner | null>(null);
  const sentencesMap = useMemo(() => new Map(sentences.map(sentence => [sentence.id, sentence])), []);

  const tierBounds = useMemo(() => {
    const tiers = sentences.map(sentence => sentence.tier);
    return {
      min: Math.min(...tiers),
      max: Math.max(...tiers)
    };
  }, []);

  const [session, setSession] = useState<SessionState>(() => ({
    queue: buildQueue(settings),
    currentIndex: 0,
    combo: 0,
    bestCombo: 0,
    locked: false,
    lastAttempt: null,
    roundSeed: 0,
    finished: false
  }));

  useEffect(() => {
    setSession({
      queue: buildQueue(settings),
      currentIndex: 0,
      combo: 0,
      bestCombo: 0,
      locked: false,
      lastAttempt: null,
      roundSeed: Date.now(),
      finished: false
    });
  }, [settings.tierMin, settings.tierMax, settings.sessionLength, meta.highestCombo]);

  useEffect(() => {
    return () => {
      if (transitionTimerRef.current) {
        window.clearTimeout(transitionTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!settings.enableTTS || !ttsSupported) return;
    const handlePointer = () => {
      unlock();
    };
    window.addEventListener('pointerdown', handlePointer, { once: true });
    window.addEventListener('touchstart', handlePointer, { once: true });
    return () => {
      window.removeEventListener('pointerdown', handlePointer);
      window.removeEventListener('touchstart', handlePointer);
    };
  }, [settings.enableTTS, ttsSupported, unlock]);

  const currentSentence = session.queue[session.currentIndex];
  const allowInput = !session.locked && !session.finished && Boolean(currentSentence);

  const speakSentence = useCallback(() => {
    if (!settings.enableTTS || !currentSentence) return;
    speak({
      text: currentSentence.en,
      voiceURI: settings.voiceURI,
      rate: settings.speechRate
    });
  }, [currentSentence, settings.enableTTS, settings.speechRate, settings.voiceURI, speak]);

  const ensureAudioContext = useCallback(() => {
    if (audioContextRef.current) return audioContextRef.current;
    if (typeof window === 'undefined' || !window.AudioContext) return null;
    audioContextRef.current = new AudioContext();
    return audioContextRef.current;
  }, []);

  const playTone = useCallback(
    (frequencies: number[], duration = 0.2) => {
      if (!settings.enableSFX) return;
      const ctx = ensureAudioContext();
      if (!ctx) return;
      ctx.resume();
      const now = ctx.currentTime;
      frequencies.forEach((freq, index) => {
        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.3, now + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
        oscillator.connect(gain).connect(ctx.destination);
        oscillator.start(now + index * 0.04);
        oscillator.stop(now + duration + index * 0.04);
      });
    },
    [ensureAudioContext, settings.enableSFX]
  );

  const handleAttempt = useCallback(
    (result: AttemptResult) => {
      if (transitionTimerRef.current) {
        window.clearTimeout(transitionTimerRef.current);
      }
      const { success } = result.attempt;
      let nextComboValue = 0;
      setSession(prev => {
        const nextCombo = success ? prev.combo + 1 : 0;
        nextComboValue = nextCombo;
        const nextBest = Math.max(prev.bestCombo, nextCombo);
        return {
          ...prev,
          combo: nextCombo,
          bestCombo: nextBest,
          locked: true,
          lastAttempt: result
        };
      });

      if (success) {
        playTone([660, 880, 1320], 0.3);
        vibration.vibrate(50);
        speak({
          text: result.attempt.sentence.en,
          voiceURI: settings.voiceURI,
          rate: settings.speechRate
        });
      } else {
        playTone([220, 160], 0.2);
      }

      const attemptComboAfter = nextComboValue;
      const now = Date.now();
      const dateKey = getDateKey(now);
      setHistory(prev => {
        const currentDay = prev[dateKey] ?? createDailyLog(dateKey);
        const updated: DailyLog = {
          ...currentDay,
          attempts: currentDay.attempts + 1,
          successes: currentDay.successes + (success ? 1 : 0),
          comboRecord: Math.max(currentDay.comboRecord, attemptComboAfter)
        };
        const sentenceId = result.attempt.sentence.id;
        const stat = updated.sentences[sentenceId] ?? {
          sentenceId,
          attempts: 0,
          successes: 0,
          tags: result.attempt.sentence.tags
        };
        updated.sentences = {
          ...updated.sentences,
          [sentenceId]: {
            ...stat,
            attempts: stat.attempts + 1,
            successes: stat.successes + (success ? 1 : 0)
          }
        };
        return {
          ...prev,
          [dateKey]: updated
        };
      });

      setMeta(prev => ({
        highestCombo: Math.max(prev.highestCombo, attemptComboAfter),
        totalAttempts: prev.totalAttempts + 1
      }));

      transitionTimerRef.current = window.setTimeout(() => {
        setSession(prev => {
          const nextIndex = prev.currentIndex + 1;
          if (nextIndex >= prev.queue.length) {
            return {
              ...prev,
              currentIndex: Math.min(prev.currentIndex, prev.queue.length - 1),
              locked: true,
              finished: true
            };
          }
          return {
            ...prev,
            currentIndex: nextIndex,
            locked: false,
            roundSeed: Date.now(),
            lastAttempt: null
          };
        });
      }, success ? 850 : 900);
    },
    [
      playTone,
      setHistory,
      setMeta,
      session.combo,
      settings.speechRate,
      settings.voiceURI,
      speak,
      vibration
    ]
  );

  useEffect(() => {
    if (!session.finished) return;
    const todaySummary = aggregateToday(history, sentencesMap);
    const totalToday = todaySummary?.totalAttempts ?? 0;
    const bannerId = Date.now();
    const bannerMessage =
      '本局完成 ' +
      session.queue.length +
      ' 句 | 最高连击 ' +
      session.bestCombo +
      ' | 今日累计 ' +
      totalToday +
      ' 句';
    setBanner({
      id: bannerId,
      text: bannerMessage
    });
    const timer = window.setTimeout(() => {
      setBanner(current => (current?.id === bannerId ? null : current));
    }, 4000);
    return () => window.clearTimeout(timer);
  }, [history, sentencesMap, session.finished, session.queue.length, session.bestCombo]);

  const todaysSummary = useMemo(() => aggregateToday(history, sentencesMap), [history, sentencesMap]);

  const todayAttempts = todaysSummary?.totalAttempts ?? 0;

  const resetHistory = () => {
    setHistory(DEFAULT_HISTORY);
    setMeta(DEFAULT_META);
  };

  const startNewSession = () => {
    setSession({
      queue: buildQueue(settings),
      currentIndex: 0,
      combo: 0,
      bestCombo: 0,
      locked: false,
      lastAttempt: null,
      roundSeed: Date.now(),
      finished: false
    });
  };

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.code === 'Space') {
        if (settings.enableTTS) {
          speakSentence();
        }
      } else if (event.key === 'Escape') {
        setShowSettings(prev => !prev);
      } else if (event.key === 'Enter' && session.finished) {
        event.preventDefault();
        startNewSession();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [settings.enableTTS, speakSentence, session.finished]);

  useEffect(() => {
    if (!session.finished && session.queue.length === 0) {
      setBanner({
        id: Date.now(),
        text: '当前难度范围内没有题目，请调整设置。'
      });
    }
  }, [session.finished, session.queue.length]);

  return (
    <div className="app">
      <TopBar
        currentIndex={session.currentIndex}
        total={session.queue.length}
        combo={session.combo}
        bestCombo={Math.max(session.bestCombo, meta.highestCombo)}
        soundEnabled={settings.enableSFX || settings.enableTTS}
        onToggleSound={() =>
          setSettings(prev => {
            const nextValue = !(prev.enableSFX || prev.enableTTS);
            return {
              ...prev,
              enableSFX: nextValue,
              enableTTS: nextValue
            };
          })
        }
        onOpenSettings={() => setShowSettings(true)}
        onOpenParents={() => setShowParents(true)}
      />

      <main className="app__stage">
        <div className="stage-card">
          {currentSentence ? (
            settings.mode === 'type' ? (
              <CoreLoop
                sentence={currentSentence}
                combo={session.combo}
                settings={settings}
                allowInput={allowInput}
                onResult={handleAttempt}
                speakSentence={speakSentence}
                lockSignal={session.roundSeed}
              />
            ) : (
              <WordTiles
                sentence={currentSentence}
                settings={settings}
                allowInput={allowInput}
                onResult={handleAttempt}
                speakSentence={speakSentence}
                lockSignal={session.roundSeed}
              />
            )
          ) : (
            <div>
              <p>{'\u5f53\u524d\u96be\u5ea6\u4e0b\u6ca1\u6709\u53ef\u7528\u53e5\u5b50\uff0c\u8bf7\u5728\u8bbe\u7f6e\u4e2d\u8c03\u6574 Tier \u8303\u56f4\u3002'}</p>
            </div>
          )}
        </div>
        {session.finished && (
          <button className="primary-button" onClick={startNewSession}>
            {'\u518d\u6765\u4e00\u5c40'}
          </button>
        )}
        <div className="session-info">
          <span>{'\u4eca\u65e5\u7d2f\u8bd5\uff1a'}{todayAttempts}</span>
        </div>
      </main>

      {showSettings && (
        <SettingsPanel
          open={showSettings}
          onClose={() => setShowSettings(false)}
          settings={settings}
          onChange={setSettings}
          tierBounds={tierBounds}
          voices={voices}
          ttsSupported={ttsSupported}
        />
      )}

      {showParents && (
        <ParentPanel
          open={showParents}
          onClose={() => setShowParents(false)}
          onReset={resetHistory}
          summary={todaysSummary}
        />
      )}

      {banner && <div className="status-banner">{banner.text}</div>}
    </div>
  );
}
