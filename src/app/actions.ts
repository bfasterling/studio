'use server';

import {
  limitResponsesToDocumentContent,
  LimitResponsesToDocumentContentInput,
} from '@/ai/flows/limit-responses-to-document-content';
import { translateText, TranslateTextInput } from '@/ai/flows/translate-text';


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

export async function getAnswer(
  question: string,
  documents: Document[],
  history: Message[]
): Promise<{ success: boolean; data?: string; error?: string }> {
  try {
    if (!question || !documents || documents.length === 0) {
      return { success: false, error: 'La pregunta y los documentos son obligatorios.' };
    }
    
    const input: LimitResponsesToDocumentContentInput = {
      question,
      documents,
      history,
    };

    const { answer } = await limitResponsesToDocumentContent(input);
    
    if (!answer?.trim()) {
      return { success: false, error: 'La IA no generó una respuesta. Por favor, intenta reformular la pregunta.' };
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
