'use client';

import * as React from 'react';
import { getAnswer, AIResponseData } from '@/app/actions';
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
import { saveConversation } from '@/firebase/firestore/chat-messages';

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

// Firestore document structure for a conversation turn
type Conversation = {
    id: string;
    userId: string;
    questionText: string;
    answerText: string;
    timestamp: any; // Firestore timestamp
    inputTokens?: number;
    outputTokens?: number;
    cost?: number;
    [key: string]: any;
}

type ChatProps = {
  documents: Document[];
  userId?: string;
};

export function Chat({ documents, userId }: ChatProps) {
  const [messages, setMessages] = React.useState<Conversation[]>([]);
  const [input, setInput] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const [optimisticQuestion, setOptimisticQuestion] = React.useState<string | null>(null);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const firestore = useFirestore();

  React.useEffect(() => {
    // Scroll to bottom whenever messages change
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, optimisticQuestion, isLoading]);

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
    setOptimisticQuestion(question);
    setInput('');
    setIsLoading(true);

    // Prepare history for the AI: we take the last 10 turns (20 messages) to provide good memory
    const historyForAI: Message[] = messages.slice(-10).flatMap(conv => ([
        { role: 'user', content: conv.questionText },
        { role: 'model', content: conv.answerText }
    ]));

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
    
    setOptimisticQuestion(null);
    setIsLoading(false);

    if (result.success && result.data) {
      const aiData = result.data as AIResponseData;

      // Save the entire Q&A turn to Firestore in the background
      saveConversation(firestore, {
        userId,
        questionText: question,
        answerText: aiData.answer,
        inputTokens: aiData.inputTokens,
        outputTokens: aiData.outputTokens,
        cost: aiData.cost,
      });

      const newConversationPair: Conversation = {
        id: `qa-${Date.now()}`,
        userId,
        questionText: question,
        answerText: aiData.answer,
        timestamp: new Date(),
        inputTokens: aiData.inputTokens,
        outputTokens: aiData.outputTokens,
        cost: aiData.cost,
      };
      setMessages(prev => [...prev, newConversationPair]);

    } else {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: result.error || 'No se pudo obtener una respuesta de la IA.',
      });
    }
  };

  return (
    <Card className="w-full h-[70vh] flex flex-col shadow-lg">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Chatea con tus Documentos</CardTitle>
      </CardHeader>
      <CardContent className="flex-grow overflow-hidden">
        <ScrollArea className="h-full pr-4">
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

            {messages.map((conversation) => (
              <React.Fragment key={conversation.id}>
                <div className="flex items-start gap-4 justify-end">
                    <div className="p-3 rounded-lg max-w-[80%] text-sm bg-primary text-primary-foreground">
                      {conversation.questionText}
                    </div>
                    <Avatar className="w-8 h-8 border">
                        <AvatarFallback><User className="w-4 h-4 text-primary" /></AvatarFallback>
                    </Avatar>
                </div>
                <div className="flex items-start gap-4">
                    <Avatar className="w-8 h-8 border">
                        <AvatarFallback><Bot className="w-4 h-4 text-primary" /></AvatarFallback>
                    </Avatar>
                    <div
                      className="p-3 rounded-lg max-w-[80%] text-sm bg-muted text-foreground prose-chat overflow-x-auto"
                      dangerouslySetInnerHTML={{ __html: conversation.answerText }}
                    />
                </div>
              </React.Fragment>
            ))}

            {optimisticQuestion && (
               <div className="flex items-start gap-4 justify-end">
                  <div className="p-3 rounded-lg max-w-[80%] text-sm bg-primary text-primary-foreground">
                    {optimisticQuestion}
                  </div>
                  <Avatar className="w-8 h-8 border">
                      <AvatarFallback><User className="w-4 h-4 text-primary" /></AvatarFallback>
                  </Avatar>
              </div>
            )}

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
            <div ref={messagesEndRef} />
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
