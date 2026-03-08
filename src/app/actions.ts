'use server';

import {
  limitResponsesToDocumentContent,
  LimitResponsesToDocumentContentInput,
} from '@/ai/flows/limit-responses-to-document-content';
import { translateText, TranslateTextInput } from '@/ai/flows/translate-text';
import { categorizeConversations, CategorizeConversationsInput } from '@/ai/flows/categorize-conversations';

// COST CONSTANTS (Price per 1 million tokens)
// Gemini 2.5 Flash Prices (Approximate)
const COST_PER_1M_INPUT_TOKENS = 0.30; // USD
const COST_PER_1M_OUTPUT_TOKENS = 2.50;  // USD

type Message = {
  role: 'user' | 'model';
  content: string;
};

type Document = {
  id: string;
  content: string;
  fileName: string;
  analysisInstructions: string;
  [key: string]: any;
};

export type AIResponseData = {
  answer: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
};

export async function getAnswer(
  question: string,
  documents: Document[],
  history: Message[]
): Promise<{ success: boolean; data?: AIResponseData; error?: string }> {
  try {
    if (!question || !documents) {
      return { success: false, error: 'La pregunta y los documentos son obligatorios.' };
    }
    
    const input: LimitResponsesToDocumentContentInput = {
      question,
      documents,
      history,
    };

    const { answer, usage } = await limitResponsesToDocumentContent(input);
    
    if (!answer?.trim()) {
      return { success: true, data: { answer: 'La IA no generó una respuesta. Por favor, intenta reformular la pregunta.', inputTokens: 0, outputTokens: 0, cost: 0 } };
    }

    // Calculate cost
    const inputTokens = usage?.inputTokens || 0;
    const outputTokens = usage?.outputTokens || 0;
    const cost = (inputTokens / 1_000_000 * COST_PER_1M_INPUT_TOKENS) + 
                 (outputTokens / 1_000_000 * COST_PER_1M_OUTPUT_TOKENS);

    return { 
      success: true, 
      data: { 
        answer, 
        inputTokens, 
        outputTokens, 
        cost 
      } 
    };
  } catch (e) {
    console.error(e);
    const errorMessage = e instanceof Error ? e.message : 'Ocurrió un error desconocido.';
    return { success: false, error: `No se pudo obtener una respuesta de la IA: ${errorMessage}` };
  }
}

export async function translateContent(
  text: string,
  targetLanguage: string,
): Promise<{ success: boolean; data?: string; error?: string }> {
  try {
    if (!text || !targetLanguage) {
      return { success: false, error: 'El texto y el idioma de destino son obligatorios.' };
    }
    
    const input: TranslateTextInput = {
      text,
      targetLanguage,
    };

    const { translatedText } = await translateText(input);
    
    return { success: true, data: translatedText };
  } catch (e) {
    console.error(e);
    const errorMessage = e instanceof Error ? e.message : 'Ocurrió un error desconocido.';
    return { success: false, error: `No se pudo traducir el contenido: ${errorMessage}` };
  }
}

export async function getCategorizedConversations(
  conversations: {
    id: string;
    userId: string;
    questionText: string;
    answerText: string;
    timestamp: string;
  }[],
): Promise<{ success: boolean; data?: Record<string, string[]>; error?: string }> {
  try {
    if (!conversations || conversations.length === 0) {
      return { success: true, data: {} };
    }

    const input: CategorizeConversationsInput = {
      conversations: conversations,
    };

    const themedConversations = await categorizeConversations(input);
    
    return { success: true, data: themedConversations };

  } catch (e) {
    console.error(e);
    const errorMessage = e instanceof Error ? e.message : 'Ocurrió un error desconocido.';
    return { success: false, error: `No se pudo categorizar las conversaciones: ${errorMessage}` };
  }
}
