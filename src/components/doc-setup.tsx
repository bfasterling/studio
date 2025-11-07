'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Sparkles, UploadCloud, FileText, X } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { cn } from '@/lib/utils';
import { useFirestore } from '@/firebase';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';


// Set up the worker
const getPdfJs = async () => {
  const pdfjs = await import('pdfjs-dist/build/pdf.mjs');
  // HACK: This is a workaround to get the worker to load.
  if (typeof window !== 'undefined' && 'Worker' in window) {
    // @ts-ignore
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url,
    ).toString();
  }
  return pdfjs;
}

const formSchema = z.object({
  documentContent: z.string().min(1, 'El contenido del documento es obligatorio.'),
  analysisInstructions: z.string().min(1, 'Las instrucciones de análisis son obligatorias.'),
  fileName: z.string().min(1, 'El nombre del archivo es obligatorio.'),
});

export type DocSetupFormValues = z.infer<typeof formSchema>;

type DocSetupProps = {
  onUploadSuccess: () => void;
  onUploadError: (error: string) => void;
};

export function DocSetup({
  onUploadSuccess,
  onUploadError,
}: DocSetupProps) {
  const [isProcessing, setIsProcessing] = React.useState(false);
  const firestore = useFirestore();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      documentContent: '',
      analysisInstructions: '',
      fileName: '',
    },
  });
  

  const extractTextFromPdf = async (file: File): Promise<string> => {
    try {
      const pdfjs = await getPdfJs();
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjs.getDocument(arrayBuffer).promise;
      let textContent = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const text = await page.getTextContent();
        textContent += text.items.map((item: any) => item.str).join(' ');
      }
      return textContent;
    } catch (error) {
      console.error("Error extracting PDF text:", error);
      throw new Error("No se pudo extraer el texto del PDF.");
    }
  };

  const onDrop = React.useCallback(
    async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (file) {
        setIsProcessing(true);
        form.setValue('fileName', file.name, { shouldValidate: true });

        try {
          let content = '';
          if (file.type === 'application/pdf') {
            content = await extractTextFromPdf(file);
          } else {
            content = await file.text();
          }
          form.setValue('documentContent', content, { shouldValidate: true });
        } catch (error: any) {
          console.error('Error procesando archivo:', error);
          onUploadError(error.message || 'No se pudo leer o procesar el archivo.');
        } finally {
          setIsProcessing(false);
        }
      }
    },
    [form, onUploadError]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/plain': ['.txt'],
      'application/pdf': ['.pdf'],
    },
    maxFiles: 1,
    disabled: isProcessing,
  });

  const clearFile = () => {
    form.reset();
  }

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!firestore) {
        onUploadError("La base de datos no está lista. Inténtalo de nuevo.");
        return;
    }

    setIsProcessing(true);

    try {
        await addDoc(collection(firestore, 'documents'), {
            ...values,
            createdAt: serverTimestamp(),
        });
        onUploadSuccess();
        form.reset();
    } catch (error: any) {
        console.error("Error guardando documento: ", error);
        onUploadError(error.message || "No se pudo guardar el documento.");
    } finally {
        setIsProcessing(false);
    }
  }

  const fileName = form.watch('fileName');
  const documentContent = form.watch('documentContent');

  return (
    <Card className="w-full shadow-lg">
      <CardHeader>
        <CardTitle>Cargar Nuevo Documento</CardTitle>
        <CardDescription>
          Sube un documento y proporciona instrucciones para la IA.
        </CardDescription>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-6">
            <FormField
              control={form.control}
              name="fileName"
              render={() => (
                <FormItem>
                  <FormLabel>Documento</FormLabel>
                  <FormControl>
                    {fileName ? (
                      <div className="flex items-center justify-between p-3 rounded-md border border-input bg-background">
                        <div className="flex items-center gap-2 overflow-hidden">
                          <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                          <span className="text-sm font-medium truncate">{fileName}</span>
                        </div>
                        <Button variant="ghost" size="icon" onClick={clearFile} className="h-6 w-6 flex-shrink-0" disabled={isProcessing}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div
                        {...getRootProps()}
                        className={cn(
                          'flex flex-col items-center justify-center p-10 border-2 border-dashed rounded-md cursor-pointer transition-colors',
                          isDragActive ? 'border-primary bg-primary/10' : 'border-input hover:border-primary/50',
                          (isProcessing) && 'cursor-not-allowed opacity-50'
                        )}
                      >
                        <input {...getInputProps()} />
                        {isProcessing ? (
                           <Loader2 className="h-10 w-10 text-muted-foreground mb-2 animate-spin" />
                        ) : (
                          <UploadCloud className="h-10 w-10 text-muted-foreground mb-2" />
                        )}
                        <p className="text-center text-sm text-muted-foreground">
                          {isProcessing ? 'Procesando archivo...' : isDragActive
                            ? 'Suelta el archivo aquí...'
                            : "Arrastra y suelta un archivo .txt o .pdf aquí, o haz clic para seleccionar"}
                        </p>
                      </div>
                    )}
                  </FormControl>
                  <FormDescription>
                    Sube un archivo de texto plano o PDF para analizar.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="analysisInstructions"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Instrucciones de Comportamiento</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Ej: 'Actúa como un experto en finanzas y solo responde preguntas sobre el documento.' o 'Resume los hallazgos clave.'"
                      className="resize-y"
                      {...field}
                      disabled={isProcessing}
                    />
                  </FormControl>
                  <FormDescription>
                    Indica a la IA cómo debe comportarse y responder.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={isProcessing || !documentContent} className="w-full">
              {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              {isProcessing ? 'Guardando...' : 'Guardar Documento'}
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
