'use server';

import {
  limitResponsesToDocumentContent,
  LimitResponsesToDocumentContentInput,
} from '@/ai/flows/limit-responses-to-document-content';
import { translateText, TranslateTextInput } from '@/ai/flows/translate-text';
import { categorizeConversations, CategorizeConversationsInput } from '@/ai/flows/categorize-conversations';
// No longer need Timestamp from firebase/firestore.


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

// The `Conversation` type with Firestore's Timestamp is no longer needed in this file.
// The `getCategorizedConversations` function will receive already-serialized data.

export async function getAnswer(
  question: string,
  documents: Document[],
  history: Message[]
): Promise<{ success: boolean; data?: string; error?: string }> {
  try {
    if (!question || !documents) {
      return { success: false, error: 'La pregunta y los documentos son obligatorios.' };
    }
    
    const input: LimitResponsesToDocumentContentInput = {
      question,
      documents,
      history,
    };

    const { answer } = await limitResponsesToDocumentContent(input);
    
    if (!answer?.trim()) {
      return { success: true, data: 'La IA no generó una respuesta. Por favor, intenta reformular la pregunta.' };
    }

    return { success: true, data: answer };
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
  // The `conversations` parameter now expects the timestamp to be a pre-serialized ISO string.
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

    // Data is already serialized, so it can be passed directly to the AI flow.
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
