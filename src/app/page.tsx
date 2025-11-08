'use client';

import { useState } from 'react';
import Link from 'next/link';
import { DocSetup } from '@/components/doc-setup';
import { useToast } from '@/hooks/use-toast';
import { LucideMessageSquare, Trash2, Loader2 } from 'lucide-react';
import { useCollection, useMemoFirebase, useUser } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { Button } from '@/components/ui/button';
import { deleteDocument as deleteDocumentFromDb } from '@/firebase/firestore/documents';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"


export default function Home() {
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const documentsQuery = useMemoFirebase(() => {
    if (!firestore || !user?.uid) return null;
    return query(collection(firestore, `users/${user.uid}/documents`), orderBy('createdAt', 'desc'));
  }, [firestore, user?.uid]);

  const { data: documents, isLoading: isLoadingDocuments } = useCollection(documentsQuery);

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

  const handleDeleteDocument = async (documentId: string) => {
    if (!user || !firestore) {
      handleUploadError("No se pudo eliminar el documento. Usuario no autenticado.");
      return;
    }
    setIsDeleting(documentId);
    
    deleteDocumentFromDb(
      firestore,
      user.uid,
      documentId,
      () => { // onSuccess
        toast({
          title: "Documento Eliminado",
          description: "El documento ha sido eliminado correctamente.",
        });
        setIsDeleting(null);
      },
      (error) => { // onError
         toast({
          variant: "destructive",
          title: "Error al Eliminar",
          description: error.message || "No se pudo eliminar el documento.",
        });
        setIsDeleting(null);
      }
    );
  };


  const isLoading = isUserLoading || isLoadingDocuments;

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
              {!isLoading && (!documents || documents.length === 0) && (
                <p className="text-muted-foreground text-center">Aún no se han cargado documentos.</p>
              )}
              <ul className="space-y-2">
                {documents?.map((doc: any) => (
                   <li key={doc.id} className="flex items-center justify-between p-2 rounded-md bg-muted/50 group">
                    <span className="font-medium truncate pr-4">{doc.fileName}</span>
                    <div className='flex items-center gap-2'>
                      <span className="text-sm text-muted-foreground">
                        {doc.createdAt ? new Date(doc.createdAt.seconds * 1000).toLocaleDateString() : ''}
                      </span>
                       <AlertDialog>
                        <AlertDialogTrigger asChild>
                           <Button variant="ghost" size="icon" className="h-8 w-8 opacity-50 group-hover:opacity-100" disabled={!!isDeleting}>
                            {isDeleting === doc.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 text-destructive" />}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Esta acción no se puede deshacer. Esto eliminará permanentemente el documento <span className="font-semibold">{doc.fileName}</span> de la base de datos.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteDocument(doc.id)}>
                              Eliminar
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
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