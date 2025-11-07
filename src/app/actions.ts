'use server';

import {
  analyzeDocumentsBasedOnInstructions,
  AnalyzeDocumentsBasedOnInstructionsInput,
} from '@/ai/flows/analyze-documents-based-on-instructions';
import {
  answerQuestionsBasedOnAnalyzedDocuments,
} from '@/ai/flows/answer-questions-based-on-analyzed-documents';

export async function performAnalysis(
  documents: { filename: string; content: string }[],
  analysisInstructions: string
): Promise<{ success: boolean; data?: string; error?: string }> {
  try {
    if (!documents.length || !documents[0].content.trim()) {
      return { success: false, error: 'Document content cannot be empty.' };
    }
    if (!analysisInstructions.trim()) {
        return { success: false, error: 'Analysis instructions cannot be empty.' };
    }

    const input: AnalyzeDocumentsBasedOnInstructionsInput = {
      documents,
      analysisInstructions,
    };

    const { analysisResults } = await analyzeDocumentsBasedOnInstructions(input);
    const combinedResults = analysisResults.join('\n\n---\n\n');

    return { success: true, data: combinedResults };
  } catch (e) {
    console.error(e);
    const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred.';
    return { success: false, error: `Failed to analyze documents: ${errorMessage}` };
  }
}

export async function getAnswer(
  question: string,
  analyzedDocumentContent: string
): Promise<{ success: boolean; data?: string; error?: string }> {
  try {
    if (!question || !analyzedDocumentContent) {
      return { success: false, error: 'Question and context are required.' };
    }
    
    const { answer } = await answerQuestionsBasedOnAnalyzedDocuments({
      question,
      analyzedDocumentContent,
    });
    
    return { success: true, data: answer };
  } catch (e) {
    console.error(e);
    const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred.';
    return { success: false, error: `Failed to get an answer from the AI: ${errorMessage}` };
  }
}
