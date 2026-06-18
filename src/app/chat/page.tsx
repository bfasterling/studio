'use client';

import { Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { Chat as ChatComponent } from '@/components/chat';
import { Loader2 } from 'lucide-react';
import { useCollection, useMemoFirebase, useUser } from '@/firebase';
import { collection, query } from 'firebase/firestore';
import { useFirestore } from '@/firebase';

function ChatPage() {
  const router = useRouter();
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();

  const documentsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, `documents`));
  }, [firestore, user]);
  
  const { data: documents, isLoading: isLoadingDocuments } = useCollection(documentsQuery);

  const isLoading = isLoadingDocuments || isUserLoading;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-muted-foreground mt-4">Cargando chat...</p>
      </div>
    );
  }

  if (!documents || documents.length === 0) {
    return (
       <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
        <div className="text-center">
            <h2 className="text-2xl font-semibold mb-4">No se han cargado documentos.</h2>
            <p className="text-muted-foreground mb-6">Por favor, vuelve a la página principal para empezar.</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4 md:p-6">
      <div className="w-full max-w-4xl mx-auto">
        <main>
          <ChatComponent 
            documents={documents || []} 
            userId={user?.uid}
          />
        </main>
        <footer className="pt-4 pb-4 text-center text-muted-foreground text-xs">
          <p>Powered By IFNovative B Fasterling</p>
        </footer>
      </div>
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
