"use client";

import React, { useState, useMemo, useEffect } from 'react';
import type { ChatHistoryEntry } from "@/components/chat/chat-interface";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useTheme, accentColors, AccentColor } from "@/context/theme-provider";
import { 
  FilePlus2, MessageSquareText, Moon, Sun, Palette, Settings, X, CheckCircle, 
  Volume2, ArrowLeft, Trash2, Edit3, Save, Search, Pin, PinOff, XCircle
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn, triggerHapticFeedback } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";

const MAX_CHAT_TITLE_LENGTH = 35; 
const MAX_EDITABLE_TITLE_LENGTH = 50;

interface AppSidebarProps {
  chatHistory: ChatHistoryEntry[];
  onNewChat: () => void;
  onSelectChat: (sessionId: string) => void;
  onDeleteChat: (sessionId: string) => void;
  onRenameChat: (sessionId: string, newTitle: string) => void;
  onTogglePinChat: (sessionId: string) => void;
  isOpen: boolean;
  onClose: () => void;
  currentSessionId: string | null;
}

export default function AppSidebar({ 
  chatHistory, onNewChat, onSelectChat, onDeleteChat, onRenameChat, onTogglePinChat, 
  isOpen, onClose, currentSessionId 
}: AppSidebarProps) {
  const {
    theme,
    setTheme,
    accentColor,
    setAccentColor,
    availableVoices,
    selectedVoiceURI,
    setSelectedVoiceURI,
    isLoadingVoices
  } = useTheme();
  const { toast } = useToast();
  const [sidebarView, setSidebarView] = useState<'history' | 'settings'>('history');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [chatToDelete, setChatToDelete] = useState<string | null>(null);
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const editInputRef = React.useRef<HTMLInputElement>(null);

  const spanishVoices = useMemo(() => {
    return availableVoices.filter(voice => voice.lang.startsWith('es'));
  }, [availableVoices]);

  const handleThemeChange = (checked: boolean) => {
    triggerHapticFeedback();
    setTheme(checked ? 'dark' : 'light');
  };

  const handleAccentChange = (color: AccentColor) => {
    triggerHapticFeedback();
    setAccentColor(color);
  };

  const handleVoiceChange = (voiceURI: string) => {
    triggerHapticFeedback();
    setSelectedVoiceURI(voiceURI);
  };

  const handleDeleteInitiate = (sessionId: string) => {
    triggerHapticFeedback();
    setChatToDelete(sessionId);
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = () => {
    triggerHapticFeedback();
    if (chatToDelete) {
      onDeleteChat(chatToDelete);
      toast({ title: "Chat Eliminado", description: "La conversación ha sido eliminada." });
    }
    setShowDeleteConfirm(false);
    setChatToDelete(null);
  };

  const handleEditStart = (chat: ChatHistoryEntry) => {
    triggerHapticFeedback();
    setEditingChatId(chat.sessionId);
    setEditingTitle(chat.title);
  };

  useEffect(() => {
    if (editingChatId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingChatId]);

  const handleEditSave = () => {
    triggerHapticFeedback();
    if (editingChatId && editingTitle.trim()) {
      onRenameChat(editingChatId, editingTitle.trim());
      toast({ title: "Chat Renombrado", description: "El título de la conversación ha sido actualizado." });
    } else if (editingChatId && !editingTitle.trim()){
       toast({ title: "Error", description: "El título no puede estar vacío.", variant: "destructive"});
       const originalChat = chatHistory.find(c => c.sessionId === editingChatId);
       if(originalChat) setEditingTitle(originalChat.title); 
       return; 
    }
    setEditingChatId(null);
  };

  const handleEditCancel = () => {
    triggerHapticFeedback();
    setEditingChatId(null);
  };

  const handleTogglePin = (sessionId: string) => {
    triggerHapticFeedback();
    onTogglePinChat(sessionId);
    const chat = chatHistory.find(c => c.sessionId === sessionId);
    toast({ 
      title: chat?.isPinned ? "Chat Desfijado" : "Chat Fijado",
      description: `La conversación ha sido ${chat?.isPinned ? 'desfijada' : 'fijada'}.`
    });
  };

  const filteredAndSortedChatHistory = useMemo(() => {
    return chatHistory
      .filter(chat => chat.title.toLowerCase().includes(searchTerm.toLowerCase()))
      .sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      });
  }, [chatHistory, searchTerm]);
  
  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => { triggerHapticFeedback(); onClose(); }}
          aria-hidden="true"
        />
      )}
      <div
        className={`fixed top-0 left-0 h-full bg-sidebar text-sidebar-foreground flex flex-col z-40 transition-transform duration-300 ease-in-out
                    ${isOpen ? 'translate-x-0' : '-translate-x-full'}
                    w-72 md:w-80 border-r border-sidebar-border shadow-lg`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sidebar-title"
      >
        <header className="p-4 border-b border-sidebar-border flex items-center justify-between h-16 shrink-0">
          <div className="flex items-center gap-2">
            {sidebarView === 'settings' ? (
              <Button variant="ghost" size="icon" onClick={() => { triggerHapticFeedback(); setSidebarView('history');}} className="text-sidebar-foreground hover:bg-sidebar-accent" aria-label="Volver al historial">
                <ArrowLeft size={20} />
              </Button>
            ) : (
              <MessageSquareText size={22} />
            )}
            <h2 id="sidebar-title" className="text-lg font-semibold">
              {sidebarView === 'settings' ? 'Configuración' : 'Historial de Chats'}
            </h2>
          </div>
          <Button variant="ghost" size="icon" onClick={() => { triggerHapticFeedback(); onClose(); }} className="text-sidebar-foreground hover:bg-sidebar-accent" aria-label="Cerrar barra lateral">
            <X size={20} />
          </Button>
        </header>

        {sidebarView === 'history' && (
          <>
            <div className="p-4 shrink-0 space-y-3">
              <Button
                onClick={() => {
                  onNewChat(); // Haptic is called inside onNewChat's implementation in chat-interface
                }}
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <FilePlus2 size={18} className="mr-2" />
                Nuevo Chat
              </Button>
              <div className="relative">
                <Input 
                  type="text"
                  placeholder="Buscar en chats..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-input text-foreground pl-9 h-9 text-sm"
                />
                <Search size={16} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              </div>
            </div>
            <Separator className="bg-sidebar-border" />
            <ScrollArea className="flex-grow p-0">
              <div className="p-4">
                {filteredAndSortedChatHistory.length === 0 ? (
                  <p className="text-xs text-sidebar-foreground/60 px-2 text-center py-4">
                    {searchTerm ? "No se encontraron chats." : "No hay chats recientes."}
                  </p>
                ) : (
                  <ul className="space-y-1">
                    {filteredAndSortedChatHistory.map((chat) => {
                      let displayMessage = chat.title || "Chat sin título";
                      if (displayMessage.length > MAX_CHAT_TITLE_LENGTH && editingChatId !== chat.sessionId) {
                        displayMessage = `${displayMessage.substring(0, MAX_CHAT_TITLE_LENGTH)}...`;
                      }
                      return (
                        <li
                          key={chat.sessionId}
                          className={cn(
                            "flex items-center justify-between rounded-md group relative",
                            chat.sessionId === currentSessionId && editingChatId !== chat.sessionId ? "bg-sidebar-accent" : "hover:bg-sidebar-accent/80"
                          )}
                        >
                          {editingChatId === chat.sessionId ? (
                            <div className="flex-1 flex items-center p-2 gap-2">
                              <Input
                                ref={editInputRef}
                                type="text"
                                value={editingTitle}
                                onChange={(e) => setEditingTitle(e.target.value.substring(0, MAX_EDITABLE_TITLE_LENGTH))}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleEditSave();
                                  if (e.key === 'Escape') handleEditCancel();
                                }}
                                className="h-8 text-sm flex-1 bg-input"
                                maxLength={MAX_EDITABLE_TITLE_LENGTH}
                              />
                              <Button variant="ghost" size="icon" onClick={handleEditSave} className="h-7 w-7 text-green-600 hover:text-green-500"><Save size={16} /></Button>
                              <Button variant="ghost" size="icon" onClick={handleEditCancel} className="h-7 w-7 text-destructive hover:text-destructive/80"><XCircle size={16} /></Button>
                            </div>
                          ) : (
                            <>
                              <div
                                role="button"
                                tabIndex={0}
                                onClick={() => { triggerHapticFeedback(); onSelectChat(chat.sessionId);}}
                                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') {triggerHapticFeedback(); onSelectChat(chat.sessionId);} }}
                                className={cn(
                                  "flex-1 flex items-center text-sm h-auto py-2 pl-2 pr-1 cursor-pointer overflow-hidden",
                                  chat.sessionId === currentSessionId ? "text-sidebar-accent-foreground font-medium" : "text-sidebar-foreground group-hover:text-sidebar-accent-foreground"
                                )}
                                title={chat.title}
                              >
                                {chat.isPinned && <Pin size={12} className="mr-1.5 text-primary shrink-0" />}
                                {!chat.isPinned && <MessageSquareText size={16} className="mr-2 shrink-0 opacity-70 group-hover:opacity-100" />}
                                <div className="flex flex-col items-start overflow-hidden min-w-0">
                                  <span className="block truncate">{displayMessage}</span>
                                  <span className="text-xs text-sidebar-foreground/60 block">
                                    {formatDistanceToNow(new Date(chat.timestamp), { addSuffix: true, locale: es })}
                                  </span>
                                </div>
                                {chat.sessionId === currentSessionId && (
                                  <CheckCircle size={16} className="ml-2 text-primary shrink-0" />
                                )}
                              </div>
                              <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-150">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="w-7 h-7 p-1"
                                  onClick={() => handleTogglePin(chat.sessionId)}
                                  title={chat.isPinned ? "Desfijar chat" : "Fijar chat"}
                                >
                                  {chat.isPinned ? <PinOff size={15} className="text-primary"/> : <Pin size={15} className="text-sidebar-foreground/70 hover:text-primary"/>}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="w-7 h-7 p-1 text-sidebar-foreground/70 hover:text-primary"
                                  onClick={() => handleEditStart(chat)}
                                  title="Renombrar chat"
                                >
                                  <Edit3 size={15} />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="w-7 h-7 p-1 text-sidebar-foreground/70 hover:text-destructive"
                                  onClick={(e) => {
                                    e.stopPropagation(); 
                                    handleDeleteInitiate(chat.sessionId);
                                  }}
                                  title="Eliminar chat"
                                >
                                  <Trash2 size={15} />
                                </Button>
                              </div>
                            </>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </ScrollArea>
            <Separator className="bg-sidebar-border" />
            <div className="p-4 shrink-0 mt-auto">
              <Button
                variant="outline"
                onClick={() => { triggerHapticFeedback(); setSidebarView('settings'); }}
                className="w-full text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground border-sidebar-border"
              >
                <Settings size={18} className="mr-2" />
                Configuración
              </Button>
            </div>
          </>
        )}

        {sidebarView === 'settings' && (
          <ScrollArea className="flex-grow p-0">
            <div className="p-4 space-y-6">
              <div>
                <h3 className="text-sm font-medium text-sidebar-foreground/70 mb-3 px-1 flex items-center">
                  <Palette size={16} className="mr-2"/> Apariencia
                </h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-2 rounded-md hover:bg-sidebar-accent group">
                    <Label htmlFor="theme-toggle" className="flex items-center gap-2 cursor-pointer text-sm group-hover:text-sidebar-accent-foreground">
                      {theme === 'dark' ? <Moon size={16} /> : <Sun size={16} />}
                      Modo {theme === 'dark' ? 'Noche' : 'Día'}
                    </Label>
                    <Switch
                      id="theme-toggle"
                      checked={theme === 'dark'}
                      onCheckedChange={handleThemeChange}
                      className="data-[state=checked]:bg-primary data-[state=unchecked]:bg-muted"
                      aria-label={`Cambiar a modo ${theme === 'dark' ? 'día' : 'noche'}`}
                    />
                  </div>

                  <div>
                    <Label className="text-sm px-1 mb-2 block text-sidebar-foreground/90">Color de Acento</Label>
                    <div className="grid grid-cols-5 gap-2 px-1">
                      {accentColors.map((color) => (
                        <Button
                          key={color.name}
                          variant="outline"
                          size="icon"
                          onClick={() => handleAccentChange(color)}
                          className={`h-8 w-8 rounded-full border-2
                                      ${accentColor.name === color.name ? 'border-ring ring-2 ring-ring ring-offset-2 ring-offset-sidebar-background' : 'border-transparent'}
                                      hover:border-ring/50`}
                          style={{ backgroundColor: `hsl(${color.hsl})` }}
                          aria-label={`Establecer acento a ${color.name}`}
                        >
                          {accentColor.name === color.name && <div className="h-3 w-3 rounded-full bg-sidebar-foreground/80" />}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium text-sidebar-foreground/70 mb-3 px-1 flex items-center">
                  <Volume2 size={16} className="mr-2"/> Voz del Asistente
                </h3>
                <div className="px-1">
                  <Select
                    value={selectedVoiceURI || ""}
                    onValueChange={handleVoiceChange}
                    disabled={isLoadingVoices || spanishVoices.length === 0}
                  >
                    <SelectTrigger className="w-full bg-input text-foreground border-sidebar-border">
                      <SelectValue placeholder={isLoadingVoices ? "Cargando voces..." : (spanishVoices.length === 0 ? "No hay voces en español" : "Selecciona una voz")} />
                    </SelectTrigger>
                    <SelectContent className="bg-popover text-popover-foreground">
                      {isLoadingVoices ? (
                        <SelectItem value="loading" disabled>Cargando voces...</SelectItem>
                      ) : (
                        spanishVoices.length === 0 ? (
                          <SelectItem value="no-voices" disabled>No hay voces en español disponibles</SelectItem>
                        ) : (
                          spanishVoices.map((voice) => (
                            <SelectItem key={voice.voiceURI} value={voice.voiceURI}>
                              {voice.name} ({voice.lang})
                            </SelectItem>
                          ))
                        )
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </ScrollArea>
        )}

        <Separator className="bg-sidebar-border mt-auto" />
        <p className="p-4 text-xs text-sidebar-foreground/50 text-center shrink-0">
            EchoFlow v1.0
        </p>
      </div>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar Chat?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. ¿Estás seguro de que quieres eliminar esta conversación permanentemente?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { triggerHapticFeedback(); setShowDeleteConfirm(false); }}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className={cn(buttonVariants({ variant: "destructive" }))}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
