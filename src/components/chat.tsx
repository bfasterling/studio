'use client';

import * as React from 'react';
import { getAnswer } from '@/app/actions';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Bot, Loader2, Send, User } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase';
import { saveChatMessage } from '@/firebase/firestore/chat-messages';

// AI message structure
type Message = {
  role: 'user' | 'model';
  content: string;
};

// Firestore document structure for Documents
type Document = {
  id: string;
  content: string;
  fileName: string;
  analysisInstructions: string;
  [key: string]: any;
};

// Firestore document structure for Chat Messages
type ChatMessage = {
    id: string;
    userId: string;
    messageText: string;
    isUserMessage: boolean;
    timestamp: any; // Firestore timestamp
    [key: string]: any;
}

type ChatProps = {
  documents: Document[];
  messages: ChatMessage[];
  userId?: string;
};

export function Chat({ documents, messages, userId }: ChatProps) {
  const [input, setInput] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const scrollAreaRef = React.useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const firestore = useFirestore();

  React.useEffect(() => {
    // Scroll to bottom whenever messages change
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTo({
        top: scrollAreaRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [messages]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim() || isLoading || !firestore || !userId) {
      if (!userId) {
        toast({
            variant: 'destructive',
            title: 'Error de autenticación',
            description: 'No se pudo identificar al usuario. Por favor, recarga la página.',
        });
      }
      return;
    }
    
    const question = input;
    setInput('');
    
    // Save user message to Firestore (non-blocking)
    saveChatMessage(firestore, {
      userId,
      messageText: question,
      isUserMessage: true,
    });
    
    setIsLoading(true);

    // Prepare history for the AI, which is the state of messages *before* the new question
    const historyForAI: Message[] = messages.map(msg => ({
        role: msg.isUserMessage ? 'user' : 'model',
        content: msg.messageText
    }));

    // Sanitize documents to pass only plain objects to the Server Action
    const sanitizedDocuments = documents.map(doc => ({
      id: doc.id,
      fileName: doc.fileName,
      content: doc.content,
      analysisInstructions: doc.analysisInstructions,
    }));

    const result = await getAnswer(
      question,
      sanitizedDocuments,
      historyForAI
    );
    
    if (result.success && result.data) {
      // Save AI response to Firestore (non-blocking)
      saveChatMessage(firestore, {
        userId,
        messageText: result.data,
        isUserMessage: false,
      });
    } else {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: result.error || 'No se pudo obtener una respuesta de la IA.',
      });
      // Note: We don't remove the user message anymore because it's already in Firestore.
    }
    
    setIsLoading(false);
  };

  return (
    <Card className="w-full h-[70vh] flex flex-col shadow-lg">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Chatea con tus Documentos</CardTitle>
      </CardHeader>
      <CardContent className="flex-grow overflow-hidden">
        <ScrollArea className="h-full pr-4" ref={scrollAreaRef}>
          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <Avatar className="w-8 h-8 border">
                <AvatarFallback><Bot className="w-4 h-4 text-primary" /></AvatarFallback>
              </Avatar>
              <div className="p-3 rounded-lg bg-muted max-w-[80%]">
                <p className="text-sm text-foreground">
                  ¡Hola! He analizado tus documentos. Pregúntame lo que quieras sobre su contenido.
                </p>
              </div>
            </div>

            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  'flex items-start gap-4',
                  message.isUserMessage && 'justify-end'
                )}
              >
                {!message.isUserMessage && (
                  <Avatar className="w-8 h-8 border">
                    <AvatarFallback><Bot className="w-4 h-4 text-primary" /></AvatarFallback>
                  </Avatar>
                )}
                <div
                  className={cn(
                    'p-3 rounded-lg max-w-[80%] text-sm',
                    message.isUserMessage
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-foreground'
                  )}
                  dangerouslySetInnerHTML={{ __html: message.messageText }}
                />
                {message.isUserMessage && (
                  <Avatar className="w-8 h-8 border">
                    <AvatarFallback><User className="w-4 h-4 text-primary" /></AvatarFallback>
                  </Avatar>
                )}
              </div>
            ))}
            {isLoading && (
              <div className="flex items-start gap-4">
                <Avatar className="w-8 h-8 border">
                   <AvatarFallback><Bot className="w-4 h-4 text-primary" /></AvatarFallback>
                </Avatar>
                <div className="flex items-center justify-center p-3 rounded-lg bg-muted">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
      <CardFooter>
        <form onSubmit={handleSubmit} className="flex w-full gap-2">
          <Input
            value={input}
            onChange={handleInputChange}
            placeholder="Haz una pregunta sobre tus documentos..."
            disabled={isLoading || !userId}
          />
          <Button type="submit" size="icon" disabled={isLoading || !input.trim() || !userId}>
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </CardFooter>
    </Card>
  );
}
