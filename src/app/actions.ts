'use server';

import {
  limitResponsesToDocumentContent,
  LimitResponsesToDocumentContentInput,
} from '@/ai/flows/limit-responses-to-document-content';
import { translateText, TranslateTextInput } from '@/ai/flows/translate-text';
import { categorizeConversations, CategorizeConversationsInput } from '@/ai/flows/categorize-conversations';
import { Timestamp } from 'firebase/firestore';


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

type Conversation = {
    id: string;
    userId: string;
    questionText: string;
    answerText:string;
    timestamp: Timestamp;
}

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
      return { success: true, data: 'He buscado en los documentos, pero no he encontrado información sobre su consulta.' };
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
  conversations: Conversation[],
): Promise<{ success: boolean; data?: Record<string, string[]>; error?: string }> {
  try {
    if (!conversations || conversations.length === 0) {
      return { success: true, data: {} };
    }

    // Convert Firestore Timestamps to ISO strings for serialization
    const serializableConversations = conversations.map(c => ({
        id: c.id,
        userId: c.userId,
        questionText: c.questionText,
        answerText: c.answerText,
        timestamp: c.timestamp.toDate().toISOString(),
    }));

    const input: CategorizeConversationsInput = {
      conversations: serializableConversations,
    };

    const { themedConversations } = await categorizeConversations(input);
    
    return { success: true, data: themedConversations };

  } catch (e) {
    console.error(e);
    const errorMessage = e instanceof Error ? e.message : 'Ocurrió un error desconocido.';
    return { success: false, error: `No se pudo categorizar las conversaciones: ${errorMessage}` };
  }
}
