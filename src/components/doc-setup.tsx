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
import { Progress } from '@/components/ui/progress';
import { saveDocument } from '@/firebase/firestore/documents';
import { translateContent } from '@/app/actions';

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
  const [isProcessingFile, setIsProcessingFile] = React.useState(false);
  const [status, setStatus] = React.useState<'idle' | 'translating' | 'saving'>('idle');
  const [uploadProgress, setUploadProgress] = React.useState(0);
  const firestore = useFirestore();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      documentContent: '',
      analysisInstructions: '',
      fileName: '',
    },
  });

  const extractTextFromPdf = async (file: File, onProgress: (progress: number) => void): Promise<string> => {
    try {
      const pdfjs = await getPdfJs();
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjs.getDocument(arrayBuffer).promise;
      let textContent = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const text = await page.getTextContent();
        textContent += text.items.map((item: any) => item.str).join(' ');
        onProgress(Math.round((i / pdf.numPages) * 100));
      }
      return textContent;
    } catch (error) {
      console.error("Error extracting PDF text:", error);
      throw new Error("No se pudo extraer el texto del PDF.");
    }
  };

  const extractTextFromTxt = (file: File, onProgress: (progress: number) => void): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onprogress = (event) => {
            if (event.lengthComputable) {
                const progress = Math.round((event.loaded / event.total) * 100);
                onProgress(progress);
            }
        };
        reader.onload = (event) => {
            onProgress(100);
            resolve(event.target?.result as string);
        };
        reader.onerror = (error) => {
            reject(new Error("No se pudo leer el archivo de texto."));
        };
        reader.readAsText(file);
    });
  }

  const onDrop = React.useCallback(
    async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (file) {
        setIsProcessingFile(true);
        setUploadProgress(0);
        form.setValue('fileName', file.name, { shouldValidate: true });

        try {
          let content = '';
          if (file.type === 'application/pdf') {
            content = await extractTextFromPdf(file, setUploadProgress);
          } else {
            content = await extractTextFromTxt(file, setUploadProgress);
          }
          form.setValue('documentContent', content, { shouldValidate: true });
        } catch (error: any) {
          console.error('Error procesando archivo:', error);
          onUploadError(error.message || 'No se pudo leer o procesar el archivo.');
          clearFile();
        } finally {
          setIsProcessingFile(false);
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
    disabled: isProcessingFile || status !== 'idle',
  });

  const clearFile = () => {
    form.reset();
    setUploadProgress(0);
  }

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!firestore) {
        onUploadError("La base de datos no está lista. Inténtalo de nuevo.");
        return;
    }

    let documentContent = values.documentContent;
    const analysisInstructions = values.analysisInstructions.toLowerCase();

    if (analysisInstructions.includes('traducir a español')) {
      setStatus('translating');
      try {
        const translationResult = await translateContent(documentContent, 'español');
        if (translationResult.success && translationResult.data) {
          documentContent = translationResult.data;
        } else {
          throw new Error(translationResult.error || 'La traducción falló.');
        }
      } catch (error: any) {
        onUploadError(error.message || 'Ocurrió un error durante la traducción.');
        setStatus('idle');
        return;
      }
    }

    setStatus('saving');

    const docData = {
      fileName: values.fileName,
      content: documentContent,
      analysisInstructions: values.analysisInstructions,
    };
    
    saveDocument(
      firestore,
      docData,
      () => { // onSuccess callback
        onUploadSuccess();
        clearFile();
        setStatus('idle');
      },
      (error) => { // onError callback
        console.error("Error guardando documento: ", error);
        onUploadError(error.message || "No se pudo guardar el documento.");
        setStatus('idle');
      }
    );
  }

  const fileName = form.watch('fileName');
  const documentContent = form.watch('documentContent');
  const isProcessing = isProcessingFile || status !== 'idle';

  const getButtonText = () => {
    switch (status) {
      case 'translating':
        return 'Traduciendo...';
      case 'saving':
        return 'Guardando...';
      default:
        return 'Guardar Documento';
    }
  };

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
                      <div className="space-y-2">
                        <div className="flex items-center justify-between p-3 rounded-md border border-input bg-background">
                          <div className="flex items-center gap-2 overflow-hidden">
                            <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                            <span className="text-sm font-medium truncate">{fileName}</span>
                          </div>
                          <Button variant="ghost" size="icon" onClick={clearFile} className="h-6 w-6 flex-shrink-0" disabled={isProcessing}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                        {(isProcessingFile || (uploadProgress > 0 && uploadProgress < 100)) && (
                            <div className="flex items-center gap-2">
                               <Progress value={uploadProgress} className="w-full h-2" />
                               <span className="text-sm text-muted-foreground">{uploadProgress}%</span>
                            </div>
                        )}
                      </div>
                    ) : (
                      <div
                        {...getRootProps()}
                        className={cn(
                          'flex flex-col items-center justify-center p-10 border-2 border-dashed rounded-md cursor-pointer transition-colors',
                          isDragActive ? 'border-primary bg-primary/10' : 'border-input hover:border-primary/50',
                          isProcessing && 'cursor-not-allowed opacity-50'
                        )}
                      >
                        <input {...getInputProps()} />
                        {isProcessingFile ? (
                           <Loader2 className="h-10 w-10 text-muted-foreground mb-2 animate-spin" />
                        ) : (
                          <UploadCloud className="h-10 w-10 text-muted-foreground mb-2" />
                        )}
                        <p className="text-center text-sm text-muted-foreground">
                          {isProcessingFile ? 'Procesando archivo...' : isDragActive
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
                      placeholder="Ej: 'Actúa como un experto en finanzas y solo responde preguntas sobre el documento.' o 'Resume los hallazgos clave.' Si el documento está en otro idioma, escribe 'traducir a español'."
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
          <CardFooter className="flex-col items-stretch gap-4">
             {status === 'saving' && (
                 <div className="flex items-center gap-2 w-full">
                    <Progress value={uploadProgress} className="w-full h-2 animate-pulse" />
                 </div>
            )}
            <Button type="submit" disabled={isProcessing || !documentContent} className="w-full">
              {status !== 'idle' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              {getButtonText()}
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
