
'use client';

import { Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { Chat as ChatComponent } from '@/components/chat';
import { Loader2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCollection, useMemoFirebase, useUser } from '@/firebase';
import { collection, query } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import Image from 'next/image';
import placeholderImages from '@/app/lib/placeholder-images.json';
import Link from 'next/link';

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
            <Button asChild>
              <Link href="/">Volver al Inicio</Link>
            </Button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
      <div className="w-full max-w-3xl mx-auto">
        <header className="flex flex-col items-center mb-8 relative">
          <div className="absolute left-0 top-1/2 -translate-y-1/2">
            <Button variant="ghost" size="sm" asChild className="gap-2">
              <Link href="/">
                <ArrowLeft className="h-4 w-4" />
                <span>Inicio</span>
              </Link>
            </Button>
          </div>
          {logo && (
            <div className="relative w-full max-w-[320px] h-auto aspect-[4/1]">
              <Image
                src={logo.url}
                alt={logo.alt}
                fill
                className="object-contain"
                priority
                data-ai-hint={logo.hint}
              />
            </div>
          )}
        </header>
        <main>
          <ChatComponent 
            documents={documents || []} 
            userId={user?.uid}
          />
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
