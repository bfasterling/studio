'use server';

import {
  limitResponsesToDocumentContent,
  LimitResponsesToDocumentContentInput,
} from '@/ai/flows/limit-responses-to-document-content';
import { translateText, TranslateTextInput } from '@/ai/flows/translate-text';


type Message = {
  role: 'user' | 'assistant';
  content: string;
};

export async function getAnswer(
  question: string,
  documentContent: string,
  analysisInstructions: string,
  history: Message[]
): Promise<{ success: boolean; data?: string; error?: string }> {
  try {
    if (!question || !documentContent) {
      return { success: false, error: 'La pregunta y el contexto son obligatorios.' };
    }
    
    const input: LimitResponsesToDocumentContentInput = {
      question,
      documentContent,
      analysisInstructions,
      history,
    };

    const { answer } = await limitResponsesToDocumentContent(input);
    
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
