import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Sentence, GameSettings, AttemptPayload } from '../types';
import { isLooseMatch } from '../utils/normalize';
import { tokenDiff } from '../utils/tokenDiff';
import { shuffle } from '../utils/random';
import Particles from './Particles';
import type { AttemptResult } from './CoreLoop';

interface WordTilesProps {
  sentence: Sentence;
  settings: GameSettings;
  allowInput: boolean;
  onResult: (result: AttemptResult) => void;
  speakSentence: () => void;
  lockSignal: number;
}

interface Tile {
  id: string;
  text: string;
}

const BUNDLE_WORDS = new Set(['the', 'a', 'an', 'this', 'that', 'these', 'those', 'my', 'your', 'his', 'her', 'our', 'their', "don't", "can't", "won't"]);

function buildTiles(sentence: string): string[] {
  const trimmed = sentence.trim();
  const endingMatch = trimmed.match(/([.!?])$/);
  const ending = endingMatch ? endingMatch[1] : '';
  const cleaned = ending ? trimmed.slice(0, -1) : trimmed;
  const tokens = cleaned.split(/\s+/);
  const result: string[] = [];

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    const next = tokens[i + 1];
    const lower = token.toLowerCase();
    if (next && BUNDLE_WORDS.has(lower)) {
      result.push(`${token} ${next}`);
      i += 1;
      continue;
    }
    if (next && lower === 'of') {
      result.push(`${token} ${next}`);
      i += 1;
      continue;
    }
    result.push(token);
  }

  if (ending) {
    const lastIndex = result.length - 1;
    result[lastIndex] = `${result[lastIndex]}${ending}`;
  }

  return result;
}

export function WordTiles({ sentence, settings, allowInput, onResult, speakSentence, lockSignal }: WordTilesProps) {
  const tiles = useMemo(() => buildTiles(sentence.en), [sentence.en]);
  const [shuffledTiles, setShuffledTiles] = useState<Tile[]>(() =>
    shuffle(tiles).map((text, index) => ({ id: `${sentence.id}-${index}`, text }))
  );
  const [selected, setSelected] = useState<Tile[]>([]);
  const [feedback, setFeedback] = useState<'idle' | 'correct' | 'incorrect'>('idle');

  useEffect(() => {
    setShuffledTiles(shuffle(tiles).map((text, index) => ({ id: `${sentence.id}-${index}`, text })));
    setSelected([]);
    setFeedback('idle');
  }, [sentence.id, tiles, lockSignal]);

  const handleSubmit = useCallback(() => {
    const assembled = selected.map(tile => tile.text).join(' ');
    if (!assembled.trim()) return;
    const success = isLooseMatch(assembled, sentence.en, sentence.variants ?? []);
    const diff = tokenDiff(sentence.en, assembled);
    setFeedback(success ? 'correct' : 'incorrect');
    const attempt: AttemptPayload = {
      sentence,
      userInput: assembled,
      success,
      timestamp: Date.now()
    };
    onResult({ attempt, diff });
  }, [onResult, selected, sentence]);

  useEffect(() => {
    if (!allowInput) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        handleSubmit();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [allowInput, handleSubmit]);

  useEffect(() => {
    if (!allowInput) return;
    if (settings.enableTTS) {
      speakSentence();
    }
  }, [allowInput, sentence.id, settings.enableTTS, speakSentence]);

  const handleSelect = (tile: Tile) => {
    if (!allowInput) return;
    setSelected(prev => [...prev, tile]);
    setShuffledTiles(prev => prev.filter(item => item.id !== tile.id));
  };

  const handleUndo = () => {
    if (!allowInput) return;
    setSelected(prev => {
      if (prev.length === 0) return prev;
      const restored = prev[prev.length - 1];
      setShuffledTiles(items => shuffle([...items, restored]));
      return prev.slice(0, -1);
    });
  };

  return (
    <div className={`word-tiles ${feedback === 'correct' ? 'word-tiles--success' : ''} ${feedback === 'incorrect' ? 'word-tiles--error' : ''}`}>
      <div className="cn-prompt">{sentence.cn}</div>
      <div className="tiles-selected">
        {selected.length === 0 ? <span className="tiles-placeholder">点选词块拼句子…</span> : null}
        {selected.map(tile => (
          <span key={tile.id} className="tile tile--selected">
            {tile.text}
          </span>
        ))}
        <Particles active={feedback === 'correct'} />
      </div>
      <div className="tiles-deck">
        {shuffledTiles.map(tile => (
          <button key={tile.id} type="button" className="tile-button" onClick={() => handleSelect(tile)} disabled={!allowInput}>
            {tile.text}
          </button>
        ))}
      </div>
      <div className="tiles-actions">
        <button type="button" className="secondary-button" onClick={speakSentence}>
          🔁 再听一遍 (Space)
        </button>
        <button type="button" className="secondary-button" onClick={handleUndo} disabled={selected.length === 0}>
          ⬅️ 撤回
        </button>
        <button type="button" className="primary-button" onClick={handleSubmit}>
          ✅ 提交 (Enter)
        </button>
      </div>
    </div>
  );
}

export default WordTiles;
