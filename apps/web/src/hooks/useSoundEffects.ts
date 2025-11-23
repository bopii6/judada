import { useCallback, useRef } from 'react';

export const useSoundEffects = () => {
    const audioContextRef = useRef<AudioContext | null>(null);

    const getContext = useCallback(() => {
        if (!audioContextRef.current) {
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            audioContextRef.current = new AudioContextClass();
        }
        if (audioContextRef.current.state === 'suspended') {
            audioContextRef.current.resume();
        }
        return audioContextRef.current;
    }, []);

    const playTone = useCallback((freq: number, type: OscillatorType, duration: number, startTime: number = 0, volume: number = 0.1) => {
        const ctx = getContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, ctx.currentTime + startTime);

        gain.gain.setValueAtTime(volume, ctx.currentTime + startTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + startTime + duration);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(ctx.currentTime + startTime);
        osc.stop(ctx.currentTime + startTime + duration);
    }, [getContext]);

    const playClick = useCallback(() => {
        // Crisp, short click
        playTone(800, 'sine', 0.05, 0, 0.05);
    }, [playTone]);

    const playSuccess = useCallback(() => {
        // A major chord arpeggio (C5, E5, G5)
        const now = 0;
        playTone(523.25, 'sine', 0.3, now, 0.1);       // C5
        playTone(659.25, 'sine', 0.3, now + 0.1, 0.1); // E5
        playTone(783.99, 'sine', 0.6, now + 0.2, 0.1); // G5
    }, [playTone]);

    const playError = useCallback(() => {
        // A dissonant low tone
        const ctx = getContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(100, ctx.currentTime + 0.3);

        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start();
        osc.stop(ctx.currentTime + 0.3);
    }, [getContext]);

    const playPop = useCallback(() => {
        // Bubble pop sound
        const ctx = getContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.frequency.setValueAtTime(400, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.1);

        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start();
        osc.stop(ctx.currentTime + 0.1);
    }, [getContext]);

    const playLevelComplete = useCallback(() => {
        // Victory fanfare
        const now = 0;
        // Quick ascending run
        playTone(523.25, 'sine', 0.1, now, 0.1);       // C5
        playTone(659.25, 'sine', 0.1, now + 0.1, 0.1); // E5
        playTone(783.99, 'sine', 0.1, now + 0.2, 0.1); // G5
        playTone(1046.50, 'sine', 0.4, now + 0.3, 0.1); // C6

        // Harmony
        playTone(523.25, 'triangle', 0.4, now + 0.3, 0.05); // C5
        playTone(659.25, 'triangle', 0.4, now + 0.3, 0.05); // E5
    }, [playTone]);

    return {
        playClick,
        playSuccess,
        playError,
        playPop,
        playLevelComplete
    };
};
