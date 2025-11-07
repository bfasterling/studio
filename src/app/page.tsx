'use client';

import { useRouter } from 'next/navigation';
import { DocSetup } from '@/components/doc-setup';
import { useToast } from '@/hooks/use-toast';
import { LucideMessageSquare } from 'lucide-react';
import { useState } from 'react';

export type AnalysisResult = {
  documentContent: string;
  analysisInstructions: string;
};

export default function Home() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const handleAnalysisComplete = (result: AnalysisResult) => {
    // Encode the data to be passed in the URL
    const queryParams = new URLSearchParams({
      documentContent: result.documentContent,
      analysisInstructions: result.analysisInstructions,
    });
    router.push(`/chat?${queryParams.toString()}`);
  };

  const handleAnalysisStart = () => {
    setIsAnalyzing(true);
  };

  const handleAnalysisError = (errorMessage: string) => {
    toast({
      variant: "destructive",
      title: "Análisis Fallido",
      description: errorMessage,
    });
    setIsAnalyzing(false);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
      <div className="w-full max-w-3xl mx-auto">
        <header className="flex items-center justify-center gap-3 mb-8">
          <LucideMessageSquare className="w-8 h-8 text-primary" />
          <h1 className="text-4xl font-bold tracking-tight text-center text-foreground font-headline">
            XSIA
          </h1>
        </header>
        <main className="transition-all duration-500">
          <DocSetup
            isAnalyzing={isAnalyzing}
            onAnalysisStart={handleAnalysisStart}
            onAnalysisComplete={handleAnalysisComplete}
            onAnalysisError={handleAnalysisError}
          />
        </main>
      </div>
      <footer className="mt-8 text-center text-muted-foreground text-sm">
        <p>Powered By Exagono Software</p>
      </footer>
    </div>
  );
}
