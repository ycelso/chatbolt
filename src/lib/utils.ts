import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function triggerHapticFeedback(pattern: VibratePattern = 50): void {
  if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
    try {
      // Check if the device is already vibrating to prevent overlapping vibrations
      // This is a simple check; more complex scenarios might need more robust handling
      // For now, we assume short vibrations won't overlap significantly or be an issue.
      window.navigator.vibrate(pattern);
    } catch (error) {
      // Silently fail or log if in a development environment
      if (process.env.NODE_ENV === 'development') {
        console.warn("Haptic feedback failed:", error);
      }
    }
  }
}
