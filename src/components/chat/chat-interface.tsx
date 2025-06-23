"use client";

import type { Message, ChatInput, ChatOutput } from '@/types/chat';
import { generateSessionId } from '@/lib/session';
import MessageBubble from './message-bubble';
import AppSidebar from '@/components/sidebar/app-sidebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Menu, FilePlus2, SlidersHorizontal, Mic, ArrowUp, Loader2, StopCircle, ImageUp, FileText, X, Plus } from 'lucide-react'; 
import Image from 'next/image';
import React, { useState, useEffect, useRef, FormEvent, useCallback } from 'react';
import { useToast } from "@/hooks/use-toast";
import { useTheme } from '@/context/theme-provider';
import { cn, triggerHapticFeedback } from "@/lib/utils";
import LoadingScreen from '@/components/common/loading-screen';
import { transcribeAudio } from '@/ai/flows/transcribe-audio-flow';

export interface ChatHistoryEntry {
  sessionId: string;
  title: string; 
  firstMessageContent?: string; 
  timestamp: Date;
  isPinned?: boolean;
}

function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

const fileToDataUri = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

const MAX_TITLE_LENGTH = 50;

const deriveInitialTitle = (text: string, file?: File): string => {
  if (file) {
    if (text) return `${text.substring(0, MAX_TITLE_LENGTH - (file.name.length + 5))}... ${file.name}`;
    return file.name.substring(0, MAX_TITLE_LENGTH);
  }
  return text.substring(0, MAX_TITLE_LENGTH) || "Nuevo Chat";
};

const API_URL = process.env.NODE_ENV === 'production'
  ? 'https://tu-proyecto.vercel.app/api/chat' // <-- Cambia esto por tu URL real de Vercel
  : '/api/chat';

async function fetchChatResponse(input: ChatInput): Promise<ChatOutput> {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error('Error en la API');
  return await res.json();
}

export default function ChatInterface() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const { toast } = useToast();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatHistoryEntry[]>([]);
  const { availableVoices, selectedVoiceURI, isLoadingVoices } = useTheme();

  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);

  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileType, setFileType] = useState<'image' | null>(null);
  const [isAttachmentMenuOpen, setIsAttachmentMenuOpen] = useState(false);

  const imageInputRef = useRef<HTMLInputElement>(null);
  const [isAppSpecificLoading, setIsAppSpecificLoading] = useState(true);


  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedHistory = localStorage.getItem('chatHistory');
      if (savedHistory) {
        try {
          const parsedHistory = JSON.parse(savedHistory) as Array<any>;
          const mappedHistory = parsedHistory.map((entry: any) => ({
            sessionId: entry.sessionId,
            title: entry.title || entry.firstMessage || `Chat ${entry.sessionId.substring(0,5)}`,
            firstMessageContent: entry.firstMessageContent || entry.firstMessage,
            timestamp: new Date(entry.timestamp),
            isPinned: entry.isPinned || false,
          })).sort((a,b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0) || new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
          setChatHistory(mappedHistory);
        } catch (error) {
          console.error("Error parsing chat history from localStorage:", error);
          setChatHistory([]);
        }
      }
    }
     const timer = setTimeout(() => {
      setIsAppSpecificLoading(false);
    }, 1000); 
    return () => clearTimeout(timer);
  }, []);

  const handleNewChat = useCallback((addToHistory = true) => {
    triggerHapticFeedback();
    const newSessionId = generateSessionId();
    setSessionId(newSessionId);
    setMessages([]);
    setInputValue('');
    setIsSidebarOpen(false);
    if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    } else {
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach(track => track.stop());
        audioStreamRef.current = null;
      }
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    }
    setIsRecording(false);
    setRecordingTime(0);
    setIsLoading(false);
    setSelectedFile(null);
    setPreviewUrl(null);
    setFileType(null);

  }, [setSessionId, setMessages, setInputValue, setIsSidebarOpen, setIsRecording, setRecordingTime, setIsLoading, setSelectedFile, setPreviewUrl, setFileType]);


  useEffect(() => {
    if (sessionId) {
      const savedMessages = localStorage.getItem(`chatMessages_${sessionId}`);
      if (savedMessages) {
        try {
          setMessages(JSON.parse(savedMessages).map((msg: any) => ({...msg, timestamp: new Date(msg.timestamp)})));
        } catch (error) {
          console.error("Error parsing messages from localStorage:", error);
          setMessages([]);
        }
      } else {
        setMessages([]);
      }
    }
  }, [sessionId]);


  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    if (sessionId && messages.length > 0) {
      localStorage.setItem(`chatMessages_${sessionId}`, JSON.stringify(messages));
    }
  }, [messages, sessionId]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (chatHistory.length > 0) {
        localStorage.setItem('chatHistory', JSON.stringify(chatHistory));
      } else {
        if (localStorage.getItem('chatHistory')) {
            localStorage.removeItem('chatHistory');
        }
      }
    }
  }, [chatHistory]);

  useEffect(() => {
    if (sessionId && typeof window !== 'undefined') {
      localStorage.setItem('lastActiveSessionId', sessionId);
    }
  }, [sessionId]);

  const speakMessage = (text: string) => {
    if (typeof window !== 'undefined' && window.speechSynthesis && text) {
      window.speechSynthesis.cancel(); // Stop any ongoing speech

      if (isLoadingVoices) {
        console.warn("Speech synthesis voices still loading. Cannot speak yet.");
        // Optionally, queue the message or notify the user
        return;
      }
      
      if (availableVoices.length === 0) {
        console.warn("No speech synthesis voices available to speak the message.");
        toast({ title: "Voz no disponible", description: "No se encontraron voces para la síntesis de voz.", variant: "default" });
        return;
      }

      const utterance = new SpeechSynthesisUtterance(text);
      if (selectedVoiceURI && availableVoices.length > 0) {
        const voice = availableVoices.find(v => v.voiceURI === selectedVoiceURI);
        if (voice) {
          utterance.voice = voice;
        } else {
            console.warn(`Selected voice URI "${selectedVoiceURI}" not found. Using default.`);
            // Fallback logic for selecting a voice
            const defaultSpanishGoogleVoice = availableVoices.find(v => v.lang.startsWith('es') && v.name.toLowerCase().includes('google'));
            const defaultSpanishVoice = availableVoices.find(v => v.lang.startsWith('es'));
            if (defaultSpanishGoogleVoice) utterance.voice = defaultSpanishGoogleVoice;
            else if (defaultSpanishVoice) utterance.voice = defaultSpanishVoice;
            else if (availableVoices.length > 0) utterance.voice = availableVoices.find(v => v.default) || availableVoices[0]; // Fallback to any default or first voice
        }
      } else if (availableVoices.length > 0) {
         // Fallback logic if no voice is selected (e.g. on first load)
        const defaultSpanishGoogleVoice = availableVoices.find(v => v.lang.startsWith('es') && v.name.toLowerCase().includes('google'));
        const defaultSpanishVoice = availableVoices.find(v => v.lang.startsWith('es'));
        if (defaultSpanishGoogleVoice) utterance.voice = defaultSpanishGoogleVoice;
        else if (defaultSpanishVoice) utterance.voice = defaultSpanishVoice;
        else utterance.voice = availableVoices.find(v => v.default) || availableVoices[0];
      }
      // else: no voices available, already handled above.
      
      window.speechSynthesis.speak(utterance);
    }
  };

  const handleSelectChat = (selectedSessionId: string) => {
    setSessionId(selectedSessionId);
    setIsSidebarOpen(false); 
    if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel(); 
    }
  };

  const handleDeleteChat = useCallback((sessionIdToDelete: string) => {
    triggerHapticFeedback();
    setChatHistory(prevHistory => prevHistory.filter(entry => entry.sessionId !== sessionIdToDelete));
    localStorage.removeItem(`chatMessages_${sessionIdToDelete}`);
    if (sessionId === sessionIdToDelete) {
      handleNewChat(false); 
    }
  }, [sessionId, handleNewChat]); 

  const handleRenameChat = useCallback((sessionIdToRename: string, newTitle: string) => {
    triggerHapticFeedback();
    setChatHistory(prevHistory => 
      prevHistory.map(entry => 
        entry.sessionId === sessionIdToRename ? { ...entry, title: newTitle.substring(0, MAX_TITLE_LENGTH), timestamp: new Date() } : entry
      ).sort((a,b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0) || new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    );
  }, []);

  const handleTogglePinChat = useCallback((sessionIdToPin: string) => {
    triggerHapticFeedback();
    setChatHistory(prevHistory => 
      prevHistory.map(entry => 
        entry.sessionId === sessionIdToPin ? { ...entry, isPinned: !entry.isPinned, timestamp: new Date() } : entry
      ).sort((a,b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0) || new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    );
  }, []);


  const submitMessageToAI = async (payload: ChatInput) => {
    setIsLoading(true);
    const typingMessageId = crypto.randomUUID(); 
    setMessages((prevMessages) => [
      ...prevMessages,
      {
        id: typingMessageId,
        text: 'Bot está escribiendo...',
        sender: 'bot',
        timestamp: new Date(),
        isLoading: true,
      },
    ]);

    try {
      const response = await fetchChatResponse(payload);
      setMessages((prevMessages) => prevMessages.filter(msg => msg.id !== typingMessageId));
      if (!response || !response.response) {
        throw new Error('Received an empty response from the AI.');
      }
      const botMessage: Message = {
        id: crypto.randomUUID(),
        text: response.response,
        sender: 'bot',
        timestamp: new Date(),
      };
      setMessages((prevMessages) => [...prevMessages, botMessage]);
      speakMessage(response.response);
    } catch (error) {
      console.error('Failed to get reply from AI:', error);
      const errorMessageText = error instanceof Error ? error.message : 'Failed to get response from the bot.';
      const systemErrorMessage: Message = {
        id: crypto.randomUUID(),
        text: `Error: ${errorMessageText}`, 
        sender: 'system', 
        timestamp: new Date(),
      };
      setMessages((prevMessages) => prevMessages.filter(msg => msg.id !== typingMessageId)); 
      setMessages((prevMessages) => [...prevMessages, systemErrorMessage]);
      toast({
        title: "Error",
        description: "No se pudo comunicar con el bot de IA. Por favor, inténtalo de nuevo más tarde.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleProcessVoiceMessage = async (audioDataUri: string) => {
    setIsLoading(true);
    const typingMessageId = crypto.randomUUID();
    setMessages((prev) => [
      ...prev,
      {id: typingMessageId, text: 'Procesando audio...', sender: 'bot', timestamp: new Date(), isLoading: true},
    ]);

    try {
      const {transcribedText} = await transcribeAudio({audioDataUri});
      if (!transcribedText) {
        throw new Error('La transcripción de audio no devolvió texto.');
      }
      
      setMessages(prev => prev.map(m => m.id === typingMessageId ? {...m, text: 'Bot está pensando...'} : m));

      const response = await fetchChatResponse({message: transcribedText});

      setMessages(prev => prev.filter(m => m.id !== typingMessageId));

      if (!response || !response.response) {
        throw new Error('La IA no generó una respuesta.');
      }

      const botMessage: Message = {
        id: crypto.randomUUID(),
        text: response.response,
        sender: 'bot',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, botMessage]);
      speakMessage(response.response);

    } catch (error) {
      console.error('Error processing voice message:', error);
      const errorMessageText = error instanceof Error ? error.message : 'No se pudo procesar la nota de voz.';
       const systemErrorMessage: Message = {
        id: crypto.randomUUID(),
        text: `Error: ${errorMessageText}`, 
        sender: 'system', 
        timestamp: new Date(),
      };
      setMessages((prevMessages) => prevMessages.filter(msg => msg.id !== typingMessageId)); 
      setMessages((prevMessages) => [...prevMessages, systemErrorMessage]);
      toast({
        title: "Error de Voz",
        description: errorMessageText,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleRecording = async () => {
    if (isRecording) {
      triggerHapticFeedback();
      setIsLoading(true); 
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
        mediaRecorderRef.current.stop(); 
      }
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      setIsRecording(false);
    } else {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        toast({ title: "Error", description: "La grabación de audio no es compatible con tu navegador.", variant: "destructive" });
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        triggerHapticFeedback(); // Haptic on successful stream acquisition
        audioStreamRef.current = stream;
        const options = { mimeType: 'audio/webm;codecs=opus' }; 
        mediaRecorderRef.current = new MediaRecorder(stream, MediaRecorder.isTypeSupported(options.mimeType) ? options : undefined);
        audioChunksRef.current = []; 

        mediaRecorderRef.current.ondataavailable = (event) => {
          audioChunksRef.current.push(event.data);
        };

        mediaRecorderRef.current.onstop = async () => {
          if (audioStreamRef.current) {
            audioStreamRef.current.getTracks().forEach(track => track.stop());
            audioStreamRef.current = null;
          }
          
          const audioBlob = new Blob(audioChunksRef.current, { type: mediaRecorderRef.current?.mimeType || 'audio/webm' });
          
          if (audioBlob.size === 0) {
            toast({ title: "Grabación Vacía", description: "No se grabó audio.", variant: "default" });
            setIsLoading(false); 
            return;
          }

          const reader = new FileReader();
          reader.readAsDataURL(audioBlob);
          reader.onloadend = async () => {
            const audioDataUri = reader.result as string;
            if (!sessionId) {
                console.error("No session ID available to send audio.");
                toast({ title: "Error de Sesión", description: "No se pudo enviar la nota de voz.", variant: "destructive" });
                setIsLoading(false); 
                return; 
            }

            const voiceMessageText = "🎤 Nota de voz enviada";
            const userVoiceMessage: Message = {
              id: crypto.randomUUID(),
              text: voiceMessageText,
              sender: 'user',
              timestamp: new Date(),
            };
            
            setMessages(prevMsgs => [...prevMsgs, userVoiceMessage]);
             setChatHistory(prevHistory => {
              const currentMessages = [...messages, userVoiceMessage];
              const historyEntryIndex = prevHistory.findIndex(entry => entry.sessionId === sessionId);
              const newTitle = deriveInitialTitle(voiceMessageText);
              const firstMessageContent = voiceMessageText;

              if (historyEntryIndex === -1) {
                return [
                  { sessionId, title: newTitle, firstMessageContent, timestamp: new Date(), isPinned: false },
                  ...prevHistory,
                ].sort((a,b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0) || new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
              } else {
                const updatedHistory = prevHistory.map(entry => {
                  if (entry.sessionId === sessionId) {
                    const isFirstUserMessageInSession = currentMessages.filter(m => m.sender === 'user').length === 1;
                    return {
                      ...entry,
                      timestamp: new Date(),
                      title: isFirstUserMessageInSession ? newTitle : entry.title,
                      firstMessageContent: isFirstUserMessageInSession ? firstMessageContent : entry.firstMessageContent,
                    };
                  }
                  return entry;
                });
                return updatedHistory.sort((a,b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0) || new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
              }
            });

            await handleProcessVoiceMessage(audioDataUri);
            setIsLoading(false); 
          };
          reader.onerror = () => {
            console.error("Error converting audio blob to Data URI");
            toast({ title: "Error", description: "No se pudo procesar el audio.", variant: "destructive" });
            setIsLoading(false); 
          };
        };

        mediaRecorderRef.current.start();
        setIsRecording(true);
        setRecordingTime(0);
        timerIntervalRef.current = setInterval(() => {
          setRecordingTime(prevTime => prevTime + 1);
        }, 1000);

      } catch (err) {
        console.error("Error accediendo al micrófono:", err);
        toast({ title: "Error de Micrófono", description: "No se pudo acceder al micrófono. Verifica los permisos.", variant: "destructive" });
        setIsRecording(false); 
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current); 
        setRecordingTime(0); 
        setIsLoading(false); 
      }
    }
  };


  const handleSendMessage = async (e: FormEvent) => {
    e.preventDefault();
    if ((!inputValue.trim() && !selectedFile) || !sessionId || isLoading || isRecording) return;

    triggerHapticFeedback();
    const userMessageText = inputValue.trim();
    let displayedMessageText = userMessageText;
    let attachmentDataUri: string | undefined = undefined;

    if (selectedFile && fileType === 'image') {
      try {
        attachmentDataUri = await fileToDataUri(selectedFile);
        displayedMessageText = userMessageText ? `${userMessageText} [Imagen adjunta: ${selectedFile.name}]` : `[Imagen adjunta: ${selectedFile.name}]`;
      } catch (error) {
        console.error("Error converting file to Data URI:", error);
        toast({ title: "Error", description: "No se pudo procesar el archivo.", variant: "destructive" });
        return;
      }
    }

    const userMessage: Message = {
      id: crypto.randomUUID(),
      text: displayedMessageText,
      sender: 'user',
      timestamp: new Date(),
    };

    setMessages(prevMessages => [...prevMessages, userMessage]);

    setChatHistory(prevHistory => {
        const currentMessages = [...messages, userMessage];
        const historyEntryIndex = prevHistory.findIndex(entry => entry.sessionId === sessionId);
        const newTitle = deriveInitialTitle(userMessageText, selectedFile || undefined);
        const firstMessageContent = displayedMessageText;

        if (historyEntryIndex === -1) { 
          return [
            { sessionId, title: newTitle, firstMessageContent, timestamp: new Date(), isPinned: false },
            ...prevHistory,
          ].sort((a,b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0) || new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        } else { 
            const updatedHistory = prevHistory.map(entry => {
              if (entry.sessionId === sessionId) {
                const isFirstUserMessageInSession = currentMessages.filter(m => m.sender === 'user').length === 1;
                return {
                  ...entry,
                  timestamp: new Date(),
                  title: isFirstUserMessageInSession ? newTitle : entry.title,
                  firstMessageContent: isFirstUserMessageInSession ? firstMessageContent : entry.firstMessageContent,
                };
              }
              return entry;
            });
            return updatedHistory.sort((a,b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0) || new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        }
    });
    
    setInputValue(''); 
    if (selectedFile) {
      handleCancelPreview(); 
    }

    const aiPayload: ChatInput = {
      message: userMessageText,
      imageDataUri: attachmentDataUri,
    };

    await submitMessageToAI(aiPayload);
  };

  useEffect(() => {
    if (typeof window !== 'undefined' && !sessionId) {
      const lastActiveSessionId = localStorage.getItem('lastActiveSessionId');
      if (lastActiveSessionId) {
        const storedHistoryRaw = localStorage.getItem('chatHistory');
        let historyExistsInStorage = false;
        if (storedHistoryRaw) {
            try {
                const parsedStoredHistory = JSON.parse(storedHistoryRaw);
                if (Array.isArray(parsedStoredHistory) && parsedStoredHistory.find((entry: any) => entry.sessionId === lastActiveSessionId)) {
                    historyExistsInStorage = true;
                }
            } catch { /* ignore parsing error, treat as not found */ }
        }

        if (historyExistsInStorage) {
            setSessionId(lastActiveSessionId);
        } else {
            handleNewChat(false); 
        }
      } else { 
        handleNewChat(false); 
      }
    }
  }, [sessionId, handleNewChat]); 

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
        mediaRecorderRef.current.stop();
      }
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
      if (previewUrl && fileType === 'image') { 
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl, fileType]);

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    touchStartXRef.current = e.touches[0].clientX;
    touchStartYRef.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!touchStartXRef.current || !touchStartYRef.current) {
      return;
    }

    const touchendX = e.changedTouches[0].clientX;
    const touchendY = e.changedTouches[0].clientY;

    const swipeDistanceX = touchendX - touchStartXRef.current;
    const swipeDistanceY = touchendY - touchStartYRef.current;

    const swipeThreshold = 50; 
    const verticalThreshold = 75; 

    if (swipeDistanceX > swipeThreshold && Math.abs(swipeDistanceY) < verticalThreshold) {
      if (!isSidebarOpen) {
        setIsSidebarOpen(true);
      }
    }

    touchStartXRef.current = null;
    touchStartYRef.current = null;
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      triggerHapticFeedback();
      setSelectedFile(file);
      setFileType('image');
      const objectUrl = URL.createObjectURL(file);
      setPreviewUrl(objectUrl);
      setIsAttachmentMenuOpen(false); 
    }
    if (event.target) {
      event.target.value = "";
    }
  };

  const handleCancelPreview = () => {
    triggerHapticFeedback();
    if (previewUrl && fileType === 'image') {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl(null);
    setFileType(null);
  };
  
  if (isAppSpecificLoading) {
     return <LoadingScreen />;
  }

  return (
    <div className="flex flex-col h-dvh w-full bg-background text-foreground">
      <AppSidebar
        chatHistory={chatHistory}
        onNewChat={() => handleNewChat()}
        onSelectChat={handleSelectChat}
        onDeleteChat={handleDeleteChat}
        onRenameChat={handleRenameChat}
        onTogglePinChat={handleTogglePinChat}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        currentSessionId={sessionId}
      />
      <header className="flex items-center justify-between p-3 border-b border-border sticky top-0 bg-background z-10 h-16 shrink-0">
        <Button variant="ghost" size="icon" className="text-foreground/80 hover:text-foreground" onClick={() => setIsSidebarOpen(true)}>
          <Menu size={22} />
        </Button>
        <h1 className="text-lg font-semibold text-foreground truncate px-2 text-center flex-1 min-w-0">EchoFlow</h1>
        <Button variant="ghost" size="icon" className="text-foreground/80 hover:text-foreground" onClick={() => handleNewChat()}>
          <FilePlus2 size={22} />
        </Button>
      </header>

      <ScrollArea 
        className="flex-grow p-4"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
         <div className="flex flex-col space-y-4 pb-4">
            {messages.length === 0 && !isLoading && !isRecording ? ( 
            <div className="flex flex-col items-center justify-center h-full pt-[10vh] text-center">
                <div className="bg-primary rounded-full p-3 mb-6 shadow-md">
                  <Image src="/logo.png" alt="EchoFlow Logo" width={40} height={40} />
                </div>
                <h2 className="text-3xl sm:text-4xl font-semibold text-foreground/90">
                ¿Por dónde empezamos?
                </h2>
            </div>
            ) : (
            messages.map((msg) => (
                <MessageBubble key={msg.id} message={msg} />
            ))
            )}
        </div>
        <div ref={messagesEndRef} />
      </ScrollArea>

      <div className="sticky bottom-0 shrink-0 bg-background border-t border-border px-4 pt-2 pb-3">
        <div className="w-full max-w-3xl mx-auto">
          {selectedFile && (
            <div className="mb-2 p-2 border rounded-md bg-muted/50 relative flex items-center justify-between">
              <div className="flex items-center gap-2 overflow-hidden">
                {fileType === 'image' && previewUrl ? (
                  <Image src={previewUrl} alt="Preview" width={40} height={40} className="rounded-md object-cover" />
                ) : (
                  <FileText size={24} className="text-muted-foreground shrink-0" />
                )}
                <span className="text-sm text-foreground truncate">{selectedFile.name}</span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                onClick={handleCancelPreview}
                aria-label="Cancelar adjunto"
              >
                <X size={18} />
              </Button>
            </div>
          )}

          {!isRecording && (
            <form onSubmit={handleSendMessage} className="relative flex items-center w-full">
              <Input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={selectedFile ? "Añade un mensaje (opcional)" : "Pregunta lo que quieras"}
                className="flex-grow h-12 pl-4 pr-12 py-3 rounded-xl bg-input border-input focus:ring-1 focus:ring-ring text-base shadow-sm"
                disabled={isLoading || isRecording}
                aria-label="Chat message input"
              />
              <Button
                type="submit"
                size="icon"
                disabled={isLoading || (!inputValue.trim() && !selectedFile) || isRecording}
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground rounded-lg w-9 h-9 flex items-center justify-center"
                aria-label="Send message"
              >
                {isLoading && !isRecording ? <Loader2 className="h-5 w-5 animate-spin" /> : <ArrowUp className="h-5 w-5" />}
              </Button>
            </form>
          )}

          {isRecording && (
            <div className="flex items-center justify-center w-full h-12 space-x-4">
              <span className="text-lg font-mono text-destructive">{formatTime(recordingTime)}</span>
            </div>
          )}
          
          <div className="flex items-center justify-between mt-2 px-1">
            {!isRecording ? (
              <>
                <div className="flex gap-1">
                  <Popover open={isAttachmentMenuOpen} onOpenChange={setIsAttachmentMenuOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground w-8 h-8" disabled={isLoading || isRecording} onClick={() => triggerHapticFeedback()}>
                        <Plus size={18}/>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-2" side="top" align="start">
                      <div className="flex flex-col gap-1">
                        <Button variant="ghost" className="justify-start px-2 py-1.5 h-auto text-sm" onClick={() => imageInputRef.current?.click()}>
                          <ImageUp size={16} className="mr-2 text-muted-foreground" /> Imagen
                        </Button>
                        <Button variant="ghost" className="justify-start px-2 py-1.5 h-auto text-sm" disabled title="Próximamente">
                          <FileText size={16} className="mr-2 text-muted-foreground" /> Documento
                        </Button>
                      </div>
                    </PopoverContent>
                  </Popover>
                  <input type="file" ref={imageInputRef} accept="image/*" onChange={handleFileChange} className="hidden" />
                  
                  <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground w-8 h-8" disabled={true /*isLoading || isRecording*/}>
                    <SlidersHorizontal size={18}/>
                  </Button>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="text-muted-foreground hover:text-foreground w-8 h-8"
                  onClick={handleToggleRecording}
                  disabled={isLoading || !!selectedFile} 
                  aria-label="Record voice note"
                >
                  <Mic size={18}/>
                </Button>
              </>
            ) : (
                <div className="w-full flex justify-center">
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        className={cn(
                            "text-destructive hover:bg-destructive/10 w-12 h-12 rounded-full",
                            isLoading && "opacity-50 cursor-not-allowed" 
                        )}
                        onClick={handleToggleRecording}
                        disabled={isLoading} 
                        aria-label="Stop recording"
                    >
                        <StopCircle size={28}/>
                    </Button>
                </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground text-center px-2 mt-2">
            EchoFlow puede cometer errores. Considera verificar la información importante.
          </p>
        </div>
      </div>
    </div>
  );
}
