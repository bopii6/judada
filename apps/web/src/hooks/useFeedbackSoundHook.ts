import { useSoundEffect } from '../contexts/SoundEffectContext';
import { playSuccessSound, playErrorSound } from './useFeedbackSound';

// Hook版本，使用context中的音效设置
export const useFeedbackSound = () => {
  const { playClickSound } = useSoundEffect();
  
  return {
    playClickSound,
    playSuccessSound,
    playErrorSound
  };
};







