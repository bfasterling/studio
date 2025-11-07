'use client';

import { useState } from 'react';
import { DocSetup } from '@/components/doc-setup';
import { Chat } from '@/components/chat';
import { useToast } from '@/hooks/use-toast';
import { FileMessageSquare } from 'lucide-react';

export default function Home() {
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const { toast } = useToast();

  const handleAnalysisComplete = (result: string) => {
    setAnalysisResult(result);
    setIsAnalyzing(false);
    toast({
      title: "Analysis Complete",
      description: "You can now start chatting with the AI.",
    });
  };

  const handleAnalysisStart = () => {
    setIsAnalyzing(true);
  };

  const handleAnalysisError = (errorMessage: string) => {
    toast({
      variant: "destructive",
      title: "Analysis Failed",
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
          <FileMessageSquare className="w-8 h-8 text-primary" />
          <h1 className="text-4xl font-bold tracking-tight text-center text-foreground font-headline">
            DocuChat AI
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
        <p>Powered by Firebase and Google AI</p>
      </footer>
    </div>
  );
}
