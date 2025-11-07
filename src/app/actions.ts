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
      return { success: false, error: 'El contenido del documento no puede estar vacío.' };
    }
    if (!analysisInstructions.trim()) {
        return { success: false, error: 'Las instrucciones de análisis no pueden estar vacías.' };
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
    const errorMessage = e instanceof Error ? e.message : 'Ocurrió un error desconocido.';
    return { success: false, error: `No se pudieron analizar los documentos: ${errorMessage}` };
  }
}

export async function getAnswer(
  question: string,
  analyzedDocumentContent: string
): Promise<{ success: boolean; data?: string; error?: string }> {
  try {
    if (!question || !analyzedDocumentContent) {
      return { success: false, error: 'La pregunta y el contexto son obligatorios.' };
    }
    
    const { answer } = await answerQuestionsBasedOnAnalyzedDocuments({
      question,
      analyzedDocumentContent,
    });
    
    return { success: true, data: answer };
  } catch (e) {
    console.error(e);
    const errorMessage = e instanceof Error ? e.message : 'Ocurrió un error desconocido.';
    return { success: false, error: `No se pudo obtener una respuesta de la IA: ${errorMessage}` };
  }
}
