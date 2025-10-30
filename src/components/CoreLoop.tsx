import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Sentence, GameSettings, AttemptPayload } from '../types';
import { isLooseMatch, tokenize } from '../utils/normalize';
import { tokenDiff, TokenDiff } from '../utils/tokenDiff';
import Particles from './Particles';

export interface AttemptResult {
  attempt: AttemptPayload;
  diff: TokenDiff;
}

interface CoreLoopProps {
  sentence: Sentence;
  settings: GameSettings;
  combo: number;
  allowInput: boolean;
  onResult: (result: AttemptResult) => void;
  speakSentence: () => void;
  lockSignal: number;
}

export function CoreLoop({ sentence, settings, combo, allowInput, onResult, speakSentence, lockSignal }: CoreLoopProps) {
  const [value, setValue] = useState('');
  const [feedback, setFeedback] = useState<'idle' | 'correct' | 'incorrect'>('idle');
  const [diffState, setDiffState] = useState<TokenDiff | null>(null);
  const [floatingToken, setFloatingToken] = useState<string | null>(null);
  const [shakeKey, setShakeKey] = useState(0);
  const floatTimerRef = useRef<number | null>(null);

  useEffect(() => {
    setValue('');
    setFeedback('idle');
    setDiffState(null);
    setFloatingToken(null);
    setShakeKey(x => x + 1);
    if (floatTimerRef.current) {
      window.clearTimeout(floatTimerRef.current);
      floatTimerRef.current = null;
    }
  }, [sentence.id, lockSignal]);

  useEffect(() => {
    return () => {
      if (floatTimerRef.current) {
        window.clearTimeout(floatTimerRef.current);
      }
    };
  }, []);

  const userTokens = useMemo(() => tokenize(value), [value]);

  useEffect(() => {
    if (!allowInput) {
      return;
    }
    if (settings.enableTTS) {
      speakSentence();
    }
  }, [sentence.id, settings.enableTTS, speakSentence, allowInput]);

  const handleSubmit = useCallback(() => {
    if (!allowInput) return;
    const trimmed = value.trim();
    if (!trimmed) return;

    const success = isLooseMatch(trimmed, sentence.en, sentence.variants ?? []);
    const diff = tokenDiff(sentence.en, trimmed);
    setDiffState(diff);
    setFeedback(success ? 'correct' : 'incorrect');
    if (!success && diff.expectedToken) {
      setFloatingToken(diff.expectedToken);
      if (floatTimerRef.current) {
        window.clearTimeout(floatTimerRef.current);
      }
      floatTimerRef.current = window.setTimeout(() => {
        setFloatingToken(null);
        floatTimerRef.current = null;
      }, 800);
    } else {
      setFloatingToken(null);
    }

    const attempt: AttemptPayload = {
      sentence,
      userInput: trimmed,
      success,
      timestamp: Date.now()
    };
    onResult({ attempt, diff });
  }, [allowInput, onResult, sentence, value]);

  const handleKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement> = event => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className={`core-loop ${feedback === 'correct' ? 'core-loop--success' : ''} ${feedback === 'incorrect' ? 'core-loop--error' : ''}`} key={shakeKey}>
      <div className="cn-prompt">{sentence.cn}</div>
      <div className="input-wrapper">
        <textarea
          className="sentence-input"
          value={value}
          onChange={event => setValue(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="用英文打出完整句子..."
          disabled={!allowInput}
          rows={2}
        />
        <Particles active={feedback === 'correct'} />
        {floatingToken && <div className="floating-token">{floatingToken}</div>}
      </div>
      <div className="feedback-line">
        {diffState && diffState.mismatchIndex >= 0 && (
          <div className="token-feedback">
            {userTokens.map((token, index) => (
              <span
                key={`${token}-${index}`}
                className={`token-feedback__token ${index === diffState.mismatchIndex && feedback === 'incorrect' ? 'token-feedback__token--error' : ''}`}
              >
                {token}
              </span>
            ))}
          </div>
        )}
        <button type="button" className="secondary-button" onClick={speakSentence}>
          🔁 再听一遍 (Space)
        </button>
        <div className="combo-hint">当前连击：{combo}</div>
      </div>
    </div>
  );
}

export default CoreLoop;
