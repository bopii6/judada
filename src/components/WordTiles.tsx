import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

const normalizeToken = (val: string) => val.replace(/[^\w']/gi, '').toLowerCase();

export function WordTiles({ sentence, settings, allowInput, onResult, speakSentence, lockSignal }: WordTilesProps) {
  const tiles = useMemo(() => buildTiles(sentence.en), [sentence.en]);
  const [shuffledTiles, setShuffledTiles] = useState<Tile[]>(() =>
    shuffle(tiles).map((text, index) => ({ id: `${sentence.id}-${index}`, text }))
  );
  const [selected, setSelected] = useState<Tile[]>([]);
  const [feedback, setFeedback] = useState<'idle' | 'correct' | 'incorrect'>('idle');
  const [errorPulse, setErrorPulse] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const playTap = useCallback(() => {
    if (!settings.enableSFX) return;
    if (typeof window === 'undefined' || !window.AudioContext) return;
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext();
    }
    const ctx = audioCtxRef.current;
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const gain = ctx.createGain();
    const oscA = ctx.createOscillator();
    const oscB = ctx.createOscillator();

    oscA.type = 'sine';
    oscB.type = 'triangle';
    oscA.frequency.value = 540 + Math.random() * 40;
    oscB.frequency.value = 680 + Math.random() * 40;

    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.32, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.32);

    oscA.connect(gain).connect(ctx.destination);
    oscB.connect(gain);

    oscA.start();
    oscB.start();
    oscA.stop(ctx.currentTime + 0.35);
    oscB.stop(ctx.currentTime + 0.35);
  }, [settings.enableSFX]);

  const playError = useCallback(() => {
    if (!settings.enableSFX) return;
    if (typeof window === 'undefined' || !window.AudioContext) return;
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext();
    }
    const ctx = audioCtxRef.current;
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const gain = ctx.createGain();
    const osc = ctx.createOscillator();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(280, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(180, ctx.currentTime + 0.18);

    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.28, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.22);

    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.24);
  }, [settings.enableSFX]);

  useEffect(() => {
    setShuffledTiles(shuffle(tiles).map((text, index) => ({ id: `${sentence.id}-${index}`, text })));
    setSelected([]);
    setFeedback('idle');
    setErrorPulse(false);
  }, [sentence.id, tiles, lockSignal]);

  const handleSubmit = useCallback(
    (override?: string) => {
      const assembledText = override ?? selected.map(tile => tile.text).join(' ');
      const assembled = assembledText.trim();
      if (!assembled) return;
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
    },
    [onResult, selected, sentence]
  );

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
    const nextSelected = [...selected, tile];
    const expectedToken = tiles[nextSelected.length - 1];

    if (expectedToken && normalizeToken(tile.text) === normalizeToken(expectedToken)) {
      playTap();
      setSelected(nextSelected);
      setShuffledTiles(prev => prev.filter(item => item.id !== tile.id));
      setFeedback('idle');

      if (nextSelected.length === tiles.length) {
        handleSubmit(nextSelected.map(item => item.text).join(' '));
      }
    } else {
      playError();
      setErrorPulse(true);
      setFeedback('incorrect');
      setTimeout(() => {
        setErrorPulse(false);
        setFeedback('idle');
      }, 320);
    }
  };

  return (
    <div className={`word-tiles ${feedback === 'correct' ? 'word-tiles--success' : ''} ${feedback === 'incorrect' ? 'word-tiles--error' : ''}`}>
      <div className="cn-prompt">{sentence.cn}</div>
      <div className={`tiles-selected ${errorPulse ? 'tiles-selected--error' : ''}`}>
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
    </div>
  );
}

export default WordTiles;
