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
import { Loader2, Sparkles } from 'lucide-react';

const formSchema = z.object({
  documentContent: z.string().min(1, 'Document content is required.'),
  analysisInstructions: z.string().min(1, 'Analysis instructions are required.'),
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
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    onAnalysisStart();
    const documents = [{ filename: 'pasted-content.txt', content: values.documentContent }];
    const result = await performAnalysis(documents, values.analysisInstructions);
    if (result.success && result.data) {
      onAnalysisComplete(result.data);
    } else {
      onAnalysisError(result.error || 'An unknown error occurred.');
    }
  }

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
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Document Content</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Paste your PDF or text document content here."
                      className="min-h-[200px] resize-y"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    You can copy and paste content from one or multiple documents.
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
            <Button type="submit" disabled={isAnalyzing} className="w-full">
              {isAnalyzing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              {isAnalyzing ? 'Analyzing...' : 'Analyze Documents'}
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
