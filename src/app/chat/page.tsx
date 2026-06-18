
'use client';

import { Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { Chat as ChatComponent } from '@/components/chat';
import { Loader2 } from 'lucide-react';
import { useCollection, useMemoFirebase, useUser } from '@/firebase';
import { collection, query } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import Image from 'next/image';
import placeholderImages from '@/app/lib/placeholder-images.json';

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

  // Buscar el logo por el ID definido en placeholder-images.json
  const logo = placeholderImages.logos.find(img => img.id === 'nutrialia-logo');

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
    <div className="flex flex-col items-center min-h-screen bg-background p-4 md:p-8">
      <div className="w-full max-w-4xl mx-auto">
        <header className="flex flex-col items-center mb-10 w-full">
          {logo ? (
            <div className="w-full max-w-[350px] flex justify-center">
              <Image
                src={logo.url}
                alt={logo.alt}
                width={350}
                height={124}
                className="h-auto w-full object-contain"
                priority
                unoptimized // Añadido para asegurar que cargue la imagen local sin transformaciones que puedan fallar
              />
            </div>
          ) : (
            <h1 className="text-2xl font-bold text-primary">Nutrialia</h1>
          )}
        </header>
        <main>
          <ChatComponent 
            documents={documents || []} 
            userId={user?.uid}
          />
        </main>
      </div>
      <footer className="mt-auto pt-8 pb-4 text-center text-muted-foreground text-xs">
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
