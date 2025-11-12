export const vibrate = (pattern: number | number[]) => {
  if (typeof navigator === "undefined" || !("vibrate" in navigator)) {
    return;
  }
  try {
    navigator.vibrate(pattern);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn("vibration not available", error);
  }
};
