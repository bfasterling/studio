'use server';

/**
 * @fileOverview Limits the AI chat agent to respond only to questions related to the content of the uploaded documents.
 *
 * - limitResponsesToDocumentContent - A function that limits the AI chat agent's responses to the content of uploaded documents.
 * - LimitResponsesToDocumentContentInput - The input type for the limitResponsesToDocumentContent function.
 * - LimitResponsesToDocumentContentOutput - The return type for the limitResponsesToDocumentContent function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const MessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string(),
});

const LimitResponsesToDocumentContentInputSchema = z.object({
  question: z.string().describe('The user question.'),
  documentContent: z.string().describe('The content of the uploaded documents.'),
  analysisInstructions: z.string().describe('The analysis instructions provided by the administrator.'),
  history: z.array(MessageSchema).describe('The conversation history.'),
});
export type LimitResponsesToDocumentContentInput = z.infer<
  typeof LimitResponsesToDocumentContentInputSchema
>;

const LimitResponsesToDocumentContentOutputSchema = z.object({
  answer: z.string().describe('The AI chat agent answer.'),
});
export type LimitResponsesToDocumentContentOutput = z.infer<
  typeof LimitResponsesToDocumentContentOutputSchema
>;

export async function limitResponsesToDocumentContent(
  input: LimitResponsesToDocumentContentInput
): Promise<LimitResponsesToDocumentContentOutput> {
  return limitResponsesToDocumentContentFlow(input);
}

const prompt = ai.definePrompt({
  name: 'limitResponsesToDocumentContentPrompt',
  input: {
    schema: LimitResponsesToDocumentContentInputSchema,
  },
  output: {
    schema: LimitResponsesToDocumentContentOutputSchema,
  },
  prompt: `Eres un agente de chat de IA experto en análisis de documentos. Tu objetivo es responder preguntas basándote únicamente en el contenido de los documentos proporcionados. Tu principal habilidad es analizar, sintetizar, inferir y resumir la información para proporcionar respuestas detalladas, claras y concisas.

**Instrucciones clave:**
1.  **Infiere y conecta ideas:** No te limites a encontrar respuestas literales. Si una pregunta no se responde directamente en el texto, busca conceptos relacionados e infiere una respuesta lógica a partir de la información disponible. Por ejemplo, si se pregunta "a qué hora se recomienda tomar leche" y un documento dice "tomar leche por la noche es bueno", debes inferir que la noche es un momento recomendado.
2.  **Resume, no cites textualmente:** No copies y pegues. Elabora un resumen coherente y con tus propias palabras sobre la información encontrada. Si la respuesta es larga, esfuérzate por sintetizarla.
3.  **Usa formato HTML para presentar:** Para mejorar la presentación de tus respuestas, utiliza etiquetas HTML.
    -   Para listas, usa viñetas con las etiquetas <ul> y <li>.
    -   Para datos tabulares, usa tablas con etiquetas <table>, <thead>, <tbody>, <tr>, <th> y <td>. Asegúrate de que la tabla y todas sus celdas tengan bordes delgados para una mejor legibilidad, usando un estilo como '<table style="border: 1px solid #cccccc; border-collapse: collapse; width: 100%; font-size: 0.9em;">' y '<th style="border: 1px solid #cccccc; padding: 5px;">'.
    -   Para resaltar texto importante, utiliza la etiqueta <strong>.
4.  **Mantente dentro del contexto:** Si la pregunta no se puede responder ni directa ni indirectamente con el contenido de los documentos, indica amablemente que solo puedes responder preguntas relacionadas con la información proporcionada.

**Contexto para tu respuesta:**
Has analizado los siguientes documentos basándote en estas instrucciones: {{{analysisInstructions}}}.
Aquí está el contenido de los documentos relevantes:
{{{documentContent}}}

Ahora, siguiendo todas las instrucciones anteriores, responde la siguiente pregunta de la forma más detallada y útil posible.
Pregunta: {{{question}}}
Respuesta: `,
});

const limitResponsesToDocumentContentFlow = ai.defineFlow(
  {
    name: 'limitResponsesToDocumentContentFlow',
    inputSchema: LimitResponsesToDocumentContentInputSchema,
    outputSchema: LimitResponsesToDocumentContentOutputSchema,
  },
  async input => {
    const {output} = await prompt(input, {
        history: input.history.map(m => ({role: m.role, content: [{text: m.content}]})),
    });
    return output!;
  }
);
