'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { performAnalysis } from '@/app/actions';
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
import type * as PdfJs from 'pdfjs-dist';

// Set up the worker
const getPdfJs = async () => {
  const pdfjs = await import('pdfjs-dist/build/pdf.mjs');
  // @ts-ignore
  pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
  return pdfjs;
}

const formSchema = z.object({
  documentContent: z.string().min(1, 'El contenido del documento es obligatorio.'),
  analysisInstructions: z.string().min(1, 'Las instrucciones de análisis son obligatorias.'),
  fileName: z.string().optional(),
});

type DocSetupProps = {
  isAnalyzing: boolean;
  onAnalysisStart: () => void;
  onAnalysisComplete: (result: string) => void;
  onAnalysisError: (error: string) => void;
};

export function DocSetup({
  isAnalyzing,
  onAnalysisStart,
  onAnalysisComplete,
  onAnalysisError,
}: DocSetupProps) {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      documentContent: '',
      analysisInstructions: '',
      fileName: '',
    },
  });
  
  const [isReadingFile, setIsReadingFile] = React.useState(false);

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
        setIsReadingFile(true);
        form.setValue('fileName', file.name);

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
          onAnalysisError(error.message || 'No se pudo leer o procesar el archivo.');
        } finally {
          setIsReadingFile(false);
        }
      }
    },
    [form, onAnalysisError]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/plain': ['.txt'],
      'application/pdf': ['.pdf'],
    },
    maxFiles: 1,
    disabled: isReadingFile || isAnalyzing,
  });

  const clearFile = () => {
    form.setValue('documentContent', '');
    form.setValue('fileName', '');
  }

  async function onSubmit(values: z.infer<typeof formSchema>) {
    onAnalysisStart();
    const documents = [{ filename: values.fileName || 'uploaded-file.txt', content: values.documentContent }];
    const result = await performAnalysis(documents, values.analysisInstructions);
    if (result.success && result.data) {
      onAnalysisComplete(result.data);
    } else {
      onAnalysisError(result.error || 'Ocurrió un error desconocido.');
    }
  }

  const fileName = form.watch('fileName');
  const documentContent = form.watch('documentContent');
  const isLoading = isAnalyzing || isReadingFile;

  return (
    <Card className="w-full shadow-lg">
      <CardHeader>
        <CardTitle>Configuración de Documento</CardTitle>
        <CardDescription>
          Proporciona un documento e instrucciones de análisis para comenzar.
        </CardDescription>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-6">
            <FormField
              control={form.control}
              name="documentContent"
              render={() => (
                <FormItem>
                  <FormLabel>Documento</FormLabel>
                  <FormControl>
                    {fileName ? (
                      <div className="flex items-center justify-between p-3 rounded-md border border-input bg-background">
                        <div className="flex items-center gap-2">
                          <FileText className="h-5 w-5 text-muted-foreground" />
                          <span className="text-sm font-medium">{fileName}</span>
                        </div>
                        <Button variant="ghost" size="icon" onClick={clearFile} className="h-6 w-6" disabled={isLoading}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div
                        {...getRootProps()}
                        className={cn(
                          'flex flex-col items-center justify-center p-10 border-2 border-dashed rounded-md cursor-pointer transition-colors',
                          isDragActive ? 'border-primary bg-primary/10' : 'border-input hover:border-primary/50',
                          (isLoading) && 'cursor-not-allowed opacity-50'
                        )}
                      >
                        <input {...getInputProps()} />
                        {isReadingFile ? (
                           <Loader2 className="h-10 w-10 text-muted-foreground mb-2 animate-spin" />
                        ) : (
                          <UploadCloud className="h-10 w-10 text-muted-foreground mb-2" />
                        )}
                        <p className="text-center text-sm text-muted-foreground">
                          {isReadingFile ? 'Procesando archivo...' : isDragActive
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
                  <FormLabel>Instrucciones de Análisis</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Ej: 'Resume los hallazgos clave en cada documento.' o 'Extrae todos los nombres y direcciones.'"
                      className="resize-y"
                      {...field}
                      disabled={isLoading}
                    />
                  </FormControl>
                  <FormDescription>
                    Indica a la IA cómo analizar el contenido proporcionado.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={isLoading || !documentContent} className="w-full">
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              {isAnalyzing ? 'Analizando...' : isReadingFile ? 'Procesando...' : 'Analizar Documento'}
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
