
// Inspired by next-themes
"use client"

import * as React from "react"
import type { ThemeProviderProps as NextThemesProviderProps } from "next-themes/dist/types" // Using specific import path
import { ThemeProvider as NextThemesProvider, useTheme as useNextTheme } from "next-themes"

export type AccentColor = {
  name: string;
  hsl: string;
};

export const accentColors: AccentColor[] = [
  { name: "Blue", hsl: "217 91% 60%" },
  { name: "Green", hsl: "142 71% 45%" },
  { name: "Purple", hsl: "262 85% 60%" },
  { name: "Orange", hsl: "30 95% 55%" },
  { name: "Rose", hsl: "340 82% 52%" },
];

interface ThemeProviderContextValue {
  theme?: string;
  setTheme: (theme: string) => void;
  accentColor: AccentColor;
  setAccentColor: (accent: AccentColor) => void;
  themes: string[];
  availableVoices: SpeechSynthesisVoice[];
  selectedVoiceURI: string | null;
  setSelectedVoiceURI: (uri: string | null) => void;
  isLoadingVoices: boolean;
}

const ThemeContext = React.createContext<ThemeProviderContextValue | undefined>(undefined);

export function ThemeProvider({ children, ...props }: NextThemesProviderProps) {
  return (
    <NextThemesProvider {...props}>
      <ActualThemeProvider>{children}</ActualThemeProvider>
    </NextThemesProvider>
  );
}

function ActualThemeProvider({ children }: { children: React.ReactNode }) {
  const { theme, setTheme, themes } = useNextTheme();
  const [accentColor, setAccentColorState] = React.useState<AccentColor>(accentColors[0]);
  const [availableVoices, setAvailableVoices] = React.useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceURI, setSelectedVoiceURIState] = React.useState<string | null>(null);
  const [isLoadingVoices, setIsLoadingVoices] = React.useState(true);

  React.useEffect(() => {
    const savedAccentName = localStorage.getItem("accentColor");
    const foundAccent = accentColors.find(ac => ac.name === savedAccentName);
    if (foundAccent) {
      setAccentColorState(foundAccent);
    }
  }, []);

  React.useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.style.setProperty("--theme-accent-base", accentColor.hsl);
    }
  }, [accentColor]);

  React.useEffect(() => {
    let attempts = 0;
    const maxAttempts = 10; // Intentar hasta 10 veces
    let intervalId: NodeJS.Timeout | null = null;

    const processVoices = (voices: SpeechSynthesisVoice[]) => {
      setAvailableVoices(voices);
      setIsLoadingVoices(false);
      if (intervalId) clearInterval(intervalId);
      intervalId = null; // Marcar como limpiado

      const savedVoiceURI = localStorage.getItem("selectedVoiceURI");
      let voiceToSet: SpeechSynthesisVoice | null = null;

      if (savedVoiceURI) {
        voiceToSet = voices.find(v => v.voiceURI === savedVoiceURI) || null;
      }

      if (!voiceToSet) {
        const googleSpanishVoice = voices.find(v => v.lang.startsWith('es') && v.name.toLowerCase().includes('google'));
        const anySpanishVoice = voices.find(v => v.lang.startsWith('es'));
        voiceToSet = googleSpanishVoice || anySpanishVoice || (voices.length > 0 ? voices.find(v => v.default) || voices[0] : null);
      }
      
      if (voiceToSet) {
        setSelectedVoiceURIState(voiceToSet.voiceURI);
        localStorage.setItem("selectedVoiceURI", voiceToSet.voiceURI);
      } else {
        setSelectedVoiceURIState(null);
        localStorage.removeItem("selectedVoiceURI");
      }
      
      // Ya no necesitamos el listener si las voces se procesaron
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
    
    const populateVoices = () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        const voices = window.speechSynthesis.getVoices();
        if (voices.length > 0) {
          processVoices(voices);
          return true; 
        }
      }
      return false; 
    };

    const attemptToLoadVoices = () => {
      attempts++;
      if (populateVoices()) {
        return; 
      }
      if (attempts >= maxAttempts) {
        if (intervalId) clearInterval(intervalId);
        intervalId = null;
        setIsLoadingVoices(false); 
        console.warn('Speech synthesis voices could not be loaded after multiple attempts.');
        if (typeof window !== 'undefined' && window.speechSynthesis) {
            window.speechSynthesis.onvoiceschanged = null;
        }
      }
    };

    if (typeof window !== 'undefined' && window.speechSynthesis) {
      if (!populateVoices()) { 
        window.speechSynthesis.onvoiceschanged = populateVoices;
        // Si `onvoiceschanged` no se dispara pronto, los reintentos ayudarán
        intervalId = setInterval(attemptToLoadVoices, 500); // Reintentar cada 0.5 segundos
      }
    } else {
      setIsLoadingVoices(false); 
      console.warn('Speech synthesis not available in this environment.');
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, []);


  const setAccentColor = (newAccent: AccentColor) => {
    setAccentColorState(newAccent);
    localStorage.setItem("accentColor", newAccent.name);
  };

  const setSelectedVoiceURI = (uri: string | null) => {
    setSelectedVoiceURIState(uri);
    if (uri) {
      localStorage.setItem("selectedVoiceURI", uri);
    } else {
      localStorage.removeItem("selectedVoiceURI");
    }
  };
  
  React.useEffect(() => {
    if (theme && typeof document !== "undefined") {
      const currentTheme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
      if (theme !== currentTheme) {
         if (theme === 'dark') {
            document.documentElement.classList.add('dark');
         } else {
            document.documentElement.classList.remove('dark');
         }
      }
    }
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ 
      theme, 
      setTheme, 
      accentColor, 
      setAccentColor, 
      themes,
      availableVoices,
      selectedVoiceURI,
      setSelectedVoiceURI,
      isLoadingVoices
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => {
  const context = React.useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};

