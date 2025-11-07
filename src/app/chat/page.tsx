'use client';

import { Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { Chat as ChatComponent } from '@/components/chat';
import { LucideMessageSquare, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCollection } from '@/firebase';
import { collection, query } from 'firebase/firestore';
import { useFirestore } from '@/firebase';

export type AnalysisResult = {
  documentContent: string;
  analysisInstructions: string;
};

function ChatPage() {
  const router = useRouter();
  const firestore = useFirestore();

  const documentsQuery = firestore ? query(collection(firestore, 'documents')) : null;
  const { data: documents, isLoading } = useCollection(documentsQuery);

  const handleReset = () => {
    router.push('/');
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-muted-foreground mt-4">Cargando documentos...</p>
      </div>
    );
  }

  if (!documents || documents.length === 0) {
    return (
       <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
        <div className="text-center">
            <h2 className="text-2xl font-semibold mb-4">No se han cargado documentos.</h2>
            <p className="text-muted-foreground mb-6">Por favor, vuelve a la página principal para empezar.</p>
            <Button onClick={handleReset}>Volver al Inicio</Button>
        </div>
      </div>
    );
  }
  
  // Combine content and instructions from all documents
  const documentContent = documents.map(doc => `Contenido del documento "${doc.fileName}":\n${doc.content}`).join('\n\n---\n\n');
  const analysisInstructions = documents.map(doc => `Instrucciones para "${doc.fileName}":\n${doc.analysisInstructions}`).join('\n\n');


  const analysisContext: AnalysisResult = {
    documentContent,
    analysisInstructions,
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
      <div className="w-full max-w-3xl mx-auto">
        <header className="flex items-center justify-center gap-3 mb-8">
          <LucideMessageSquare className="w-8 h-8 text-primary" />
          <h1 className="text-4xl font-bold tracking-tight text-center text-foreground font-headline">
            XSIA
          </h1>
        </header>
        <main>
          <ChatComponent analysisContext={analysisContext} onReset={handleReset} />
        </main>
      </div>
      <footer className="mt-8 text-center text-muted-foreground text-sm">
        <p>Powered By Exagono Software</p>
      </footer>
    </div>
  );
}

export default function ChatPageWrapper() {
    return (
        <Suspense fallback={<div>Cargando...</div>}>
            <ChatPage />
        </Suspense>
    )
}
