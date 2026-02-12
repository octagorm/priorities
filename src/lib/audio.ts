export function playSound(filename: string) {
  try {
    const audio = new Audio(`/${filename}`);
    audio.play().catch(() => {
      // Silently ignore autoplay restrictions
    });
  } catch {
    // Silently ignore errors
  }
}
