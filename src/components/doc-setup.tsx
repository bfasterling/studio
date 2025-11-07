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

const formSchema = z.object({
  documentContent: z.string().min(1, 'Document content is required.'),
  analysisInstructions: z.string().min(1, 'Analysis instructions are required.'),
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

  const onDrop = React.useCallback(
    (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const content = e.target?.result as string;
          form.setValue('documentContent', content, { shouldValidate: true });
          form.setValue('fileName', file.name);
        };
        reader.readAsText(file);
      }
    },
    [form]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/plain': ['.txt'],
    },
    maxFiles: 1,
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
      onAnalysisError(result.error || 'An unknown error occurred.');
    }
  }

  const fileName = form.watch('fileName');

  return (
    <Card className="w-full shadow-lg">
      <CardHeader>
        <CardTitle>Document Setup</CardTitle>
        <CardDescription>
          Provide document content and analysis instructions to begin.
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
                  <FormLabel>Document Content</FormLabel>
                  <FormControl>
                    {fileName ? (
                      <div className="flex items-center justify-between p-3 rounded-md border border-input bg-background">
                        <div className="flex items-center gap-2">
                          <FileText className="h-5 w-5 text-muted-foreground" />
                          <span className="text-sm font-medium">{fileName}</span>
                        </div>
                        <Button variant="ghost" size="icon" onClick={clearFile} className="h-6 w-6">
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div
                        {...getRootProps()}
                        className={cn(
                          'flex flex-col items-center justify-center p-10 border-2 border-dashed rounded-md cursor-pointer transition-colors',
                          isDragActive ? 'border-primary bg-primary/10' : 'border-input hover:border-primary/50'
                        )}
                      >
                        <input {...getInputProps()} />
                        <UploadCloud className="h-10 w-10 text-muted-foreground mb-2" />
                        <p className="text-center text-sm text-muted-foreground">
                          {isDragActive
                            ? 'Drop the file here...'
                            : "Drag & drop a .txt file here, or click to select file"}
                        </p>
                      </div>
                    )}
                  </FormControl>
                  <FormDescription>
                    Upload a plain text file for analysis.
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
                  <FormLabel>Analysis Instructions</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="e.g., 'Summarize the key findings in each document.' or 'Extract all names and addresses.'"
                      className="resize-y"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Tell the AI how to analyze the provided content.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={isAnalyzing || !form.watch('documentContent')} className="w-full">
              {isAnalyzing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              {isAnalyzing ? 'Analyzing...' : 'Analyze Document'}
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
