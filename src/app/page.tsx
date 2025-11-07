'use client';

import { useState } from 'react';
import { DocSetup } from '@/components/doc-setup';
import { useToast } from '@/hooks/use-toast';
import { LucideMessageSquare } from 'lucide-react';
import { useCollection } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function Home() {
  const { toast } = useToast();
  const firestore = useFirestore();

  const documentsQuery = firestore ? query(collection(firestore, 'documents'), orderBy('createdAt', 'desc')) : null;
  const { data: documents, isLoading } = useCollection(documentsQuery);

  const handleUploadSuccess = () => {
    toast({
      title: "Documento Guardado",
      description: "Tu documento ha sido guardado en la base de datos.",
    });
  };

  const handleUploadError = (errorMessage: string) => {
    toast({
      variant: "destructive",
      title: "Error al Guardar",
      description: errorMessage,
    });
  };

  return (
    <div className="flex flex-col items-center min-h-screen bg-background p-4">
      <div className="w-full max-w-3xl mx-auto">
        <header className="flex items-center justify-center gap-3 mb-8">
          <LucideMessageSquare className="w-8 h-8 text-primary" />
          <h1 className="text-4xl font-bold tracking-tight text-center text-foreground font-headline">
            XSIA
          </h1>
        </header>
        <main className="space-y-8">
          <DocSetup
            onUploadSuccess={handleUploadSuccess}
            onUploadError={handleUploadError}
          />
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">Documentos Cargados</h2>
              <Button asChild>
                <Link href="/chat">Ir al Chat</Link>
              </Button>
            </div>
            <div className="border rounded-lg p-4">
              {isLoading && <p>Cargando documentos...</p>}
              {!isLoading && documents && documents.length === 0 && (
                <p className="text-muted-foreground text-center">Aún no se han cargado documentos.</p>
              )}
              <ul className="space-y-2">
                {documents?.map((doc: any) => (
                   <li key={doc.id} className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                    <span className="font-medium">{doc.fileName}</span>
                    <span className="text-sm text-muted-foreground">
                      {doc.createdAt ? new Date(doc.createdAt.seconds * 1000).toLocaleDateString() : ''}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </main>
      </div>
      <footer className="mt-8 text-center text-muted-foreground text-sm">
        <p>Powered By Exagono Software</p>
      </footer>
    </div>
  );
}
