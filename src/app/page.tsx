
'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { DocSetup } from '@/components/doc-setup';
import { useToast } from '@/hooks/use-toast';
import { LucideMessageSquare, Trash2, Loader2, Download, ChevronLeft, ChevronRight, ArrowUpDown } from 'lucide-react';
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
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import * as XLSX from 'xlsx';

export default function Home() {
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  // Pagination & Sorting State
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState('5');
  const [sortField, setSortField] = useState<'fileName' | 'createdAt'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const documentsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, `documents`), orderBy('createdAt', 'desc'));
  }, [firestore, user]);

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
    if (!firestore) {
      handleUploadError("No se pudo eliminar el documento. Base de datos no disponible.");
      return;
    }
    setIsDeleting(documentId);
    
    deleteDocumentFromDb(
      firestore,
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

  const handleExportToExcel = () => {
    if (!documents || documents.length === 0) return;

    const dataToExport = documents.map((doc: any) => ({
      'Nombre de Archivo': doc.fileName,
      'Instrucciones de Análisis': doc.analysisInstructions || 'N/A',
      'Fecha de Carga': doc.createdAt ? new Date(doc.createdAt.seconds * 1000).toLocaleString() : 'N/A'
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Documentos");
    XLSX.writeFile(workbook, "Listado_Documentos.xlsx");

    toast({
      title: "Exportación Exitosa",
      description: "El listado de documentos ha sido descargado.",
    });
  };

  const toggleSort = (field: 'fileName' | 'createdAt') => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const sortedAndPaginatedDocs = useMemo(() => {
    if (!documents) return [];

    let result = [...documents];

    // Sorting
    result.sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];

      if (sortField === 'createdAt') {
        valA = a.createdAt?.seconds || 0;
        valB = b.createdAt?.seconds || 0;
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    // Pagination
    const rpp = parseInt(rowsPerPage);
    const startIndex = (currentPage - 1) * rpp;
    return result.slice(startIndex, startIndex + rpp);
  }, [documents, sortField, sortOrder, currentPage, rowsPerPage]);

  const totalPages = useMemo(() => {
    if (!documents) return 0;
    return Math.ceil(documents.length / parseInt(rowsPerPage));
  }, [documents, rowsPerPage]);

  const isLoading = isUserLoading || isLoadingDocuments;

  return (
    <div className="flex flex-col items-center min-h-screen bg-background p-4">
      <div className="w-full max-w-4xl mx-auto">
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
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <h2 className="text-2xl font-bold">Documentos Cargados</h2>
              <div className="flex flex-wrap gap-2">
                <Button onClick={handleExportToExcel} variant="outline" disabled={!documents || documents.length === 0}>
                  <Download className="mr-2 h-4 w-4" /> Exportar Excel
                </Button>
                <Button asChild variant="outline">
                    <Link href="/reports">Ver Reportes</Link>
                </Button>
                <Button asChild>
                    <Link href="/chat">Ir al Chat</Link>
                </Button>
              </div>
            </div>

            <div className="border rounded-lg p-6 bg-card shadow-sm">
              <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
                <div className="flex items-center gap-4">
                   <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Ordenar por:</span>
                    <Button variant="ghost" size="sm" onClick={() => toggleSort('fileName')} className="text-xs">
                      Nombre {sortField === 'fileName' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => toggleSort('createdAt')} className="text-xs">
                      Fecha {sortField === 'createdAt' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </Button>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Ver:</span>
                  <Select value={rowsPerPage} onValueChange={(v) => { setRowsPerPage(v); setCurrentPage(1); }}>
                    <SelectTrigger className="w-[70px] h-8 text-xs">
                      <SelectValue placeholder="RPP" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5</SelectItem>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="20">20</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {isLoading && (
                <div className="flex justify-center p-10">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              )}
              
              {!isLoading && (!documents || documents.length === 0) && (
                <p className="text-muted-foreground text-center py-10 italic">Aún no se han cargado documentos.</p>
              )}

              <ul className="divide-y">
                {sortedAndPaginatedDocs.map((doc: any) => (
                   <li key={doc.id} className="py-4 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4 group">
                    <div className="flex flex-col flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-foreground truncate">{doc.fileName}</span>
                        <span className="text-[10px] bg-muted px-2 py-0.5 rounded-full text-muted-foreground shrink-0">
                          {doc.createdAt ? new Date(doc.createdAt.seconds * 1000).toLocaleDateString() : ''}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2 italic">
                        <span className="font-medium not-italic">Instrucciones:</span> {doc.analysisInstructions || "Sin instrucciones específicas"}
                      </p>
                    </div>
                    
                    <div className='flex items-center gap-2 shrink-0'>
                       <AlertDialog>
                        <AlertDialogTrigger asChild>
                           <Button variant="ghost" size="icon" className="h-9 w-9 opacity-50 group-hover:opacity-100" disabled={!!isDeleting}>
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

              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-8 pt-4 border-t">
                  <span className="text-xs text-muted-foreground">
                    Página {currentPage} de {totalPages} ({documents?.length} docs)
                  </span>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
      <footer className="mt-8 text-center text-muted-foreground text-sm">
        <p>Powered By IFNovative B Fasterling</p>
      </footer>
    </div>
  );
}
