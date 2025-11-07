'use client';

import { useState } from 'react';
import { DocSetup } from '@/components/doc-setup';
import { Chat } from '@/components/chat';
import { useToast } from '@/hooks/use-toast';
import { LucideMessageSquare } from 'lucide-react';

export type AnalysisResult = {
  documentContent: string;
  analysisInstructions: string;
};

export default function Home() {
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const { toast } = useToast();

  const handleAnalysisComplete = (result: AnalysisResult) => {
    setAnalysisResult(result);
    setIsAnalyzing(false);
    toast({
      title: "Documento Listo",
      description: "Ahora puedes empezar a chatear con la IA.",
    });
  };

  const handleAnalysisStart = () => {
    setAnalysisResult(null);
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

  const handleReset = () => {
    setAnalysisResult(null);
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
          {analysisResult === null ? (
            <DocSetup
              isAnalyzing={isAnalyzing}
              onAnalysisStart={handleAnalysisStart}
              onAnalysisComplete={handleAnalysisComplete}
              onAnalysisError={handleAnalysisError}
            />
          ) : (
            <Chat analysisContext={analysisResult} onReset={handleReset} />
          )}
        </main>
      </div>
      <footer className="mt-8 text-center text-muted-foreground text-sm">
        <p>Powered By Exagono Software</p>
      </footer>
    </div>
  );
}
