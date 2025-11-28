import { useState, useCallback } from 'react';

/**
 * Hook to trigger a screen shake effect on a container element.
 * Returns a ref to attach to the container and a function to trigger the shake.
 */
export const useScreenShake = () => {
    const [shake, setShake] = useState(false);

    // Trigger shake for a short duration (e.g., 300ms)
    const triggerShake = useCallback(() => {
        setShake(true);
        const timeout = setTimeout(() => setShake(false), 300);
        return () => clearTimeout(timeout);
    }, []);

    // Return CSS class name based on shake state
    const shakeClass = shake ? 'shake' : '';

    return { shakeClass, triggerShake };
};
