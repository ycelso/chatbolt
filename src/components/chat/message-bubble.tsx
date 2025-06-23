
"use client";

import type { Message } from '@/types/chat';
import { cn, triggerHapticFeedback } from '@/lib/utils';
import { Loader2, Copy, Check, Share2 } from 'lucide-react'; 
import { Button } from '@/components/ui/button';
import { useToast } from "@/hooks/use-toast";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useState } from 'react';

interface MessageBubbleProps {
  message: Message;
}

interface CodeBlockProps {
  inline?: boolean;
  className?: string;
  children?: React.ReactNode;
}

const CodeBlock: React.FC<CodeBlockProps> = ({ inline, className, children }) => {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const match = /language-(\w+)/.exec(className || '');
  const lang = match?.[1] || 'bash'; 
  const codeText = String(children).replace(/\n$/, '');

  const handleCopyCode = async () => {
    triggerHapticFeedback();
    try {
      await navigator.clipboard.writeText(codeText);
      setCopied(true);
      toast({
        title: "Copiado",
        description: "Bloque de código copiado.",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast({
        title: "Error",
        description: "No se pudo copiar el bloque de código.",
        variant: "destructive",
      });
    }
  };

  if (inline) {
    return <code className={className}>{children}</code>;
  }

  return (
    <div className="relative my-2 rounded-md border bg-[hsl(var(--markdown-code-bg))]">
      <div className="code-block-header">
        <span className="code-block-lang">{lang}</span>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleCopyCode}
          className="h-6 w-6 p-1 text-muted-foreground hover:text-foreground"
          aria-label="Copiar código"
        >
          {copied ? <Check size={14} className="text-green-500" /> : <Copy size={12} />}
        </Button>
      </div>
      <pre className="!my-0 !bg-transparent">
        <code className={className}>{children}</code>
      </pre>
    </div>
  );
};


export default function MessageBubble({ message }: MessageBubbleProps) {
  const { toast } = useToast();

  const handleCopyText = async (textToCopy: string) => {
    triggerHapticFeedback();
    try {
      await navigator.clipboard.writeText(textToCopy);
      toast({
        title: "Copiado",
        description: "Mensaje copiado al portapapeles.",
      });
    } catch (err) {
      toast({
        title: "Error",
        description: "No se pudo copiar el mensaje.",
        variant: "destructive",
      });
    }
  };

  const handleShareMessage = async (textToShare: string) => {
    triggerHapticFeedback();
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Mensaje de EchoFlow',
          text: textToShare,
        });
        // No toast for successful native share, as the OS handles UI
      } catch (error) {
        // Only show error if it's not an AbortError (user cancellation)
        if ((error as DOMException)?.name !== 'AbortError') {
          toast({
            title: "Error al Compartir",
            description: "No se pudo compartir. Mensaje copiado como alternativa.",
            variant: "default", 
          });
          await handleCopyText(textToShare); // Fallback to copy
        }
      }
    } else {
      // Fallback for browsers/WebViews that don't support navigator.share
      toast({
        title: "Función no Soportada",
        description: "Compartir no está disponible. Mensaje copiado.",
        variant: "default",
      });
      await handleCopyText(textToShare);
    }
  };

  const isUser = message.sender === 'user';
  const isSystem = message.sender === 'system';

  if (isSystem) {
    return (
      <div className={cn(
        "flex justify-center my-2",
        "animate-in fade-in-0 slide-in-from-bottom-1 duration-300 ease-out"
      )}>
        <div className="text-xs text-muted-foreground px-3 py-1 bg-muted rounded-full">
          {message.text}
        </div>
      </div>
    );
  }
  
  return (
    <div
      className={cn(
        'w-full flex', 
        isUser ? 'justify-end' : 'justify-start',
        !isUser && "animate-in fade-in-0 slide-in-from-bottom-1 duration-300 ease-out"
      )}
    >
      <div
        className={cn(
          'rounded-xl p-3 shadow-md max-w-[85%] md:max-w-[75%]',
          isUser
            ? 'bg-primary text-primary-foreground rounded-br-none'
            : 'bg-secondary text-secondary-foreground rounded-bl-none'
        )}
      >
        <div className="flex flex-col">
          {message.isLoading && message.sender === 'bot' ? (
             <div className="flex items-center gap-2 text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>{message.text}</span>
             </div>
          ) : message.sender === 'bot' ? (
            <ReactMarkdown
              className="markdown-content"
              remarkPlugins={[remarkGfm]}
              components={{
                code: CodeBlock,
              }}
            >
              {message.text}
            </ReactMarkdown>
          ) : (
            <p className="text-sm break-words flex-grow">{message.text}</p>
          )}
       
          {message.sender === 'bot' && !message.isLoading && (
            <div className="flex gap-1 mt-2 self-end">
              <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleCopyText(message.text)}
                  className="h-7 w-7 p-1.5 text-secondary-foreground/60 hover:text-secondary-foreground"
                  aria-label="Copiar mensaje"
              >
                  <Copy size={14} />
              </Button>
              <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleShareMessage(message.text)}
                  className="h-7 w-7 p-1.5 text-secondary-foreground/60 hover:text-secondary-foreground"
                  aria-label="Compartir mensaje"
              >
                  <Share2 size={14} />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
