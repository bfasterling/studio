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
  prompt: `Eres un agente de chat de IA que solo puede responder preguntas relacionadas con el contenido de los documentos cargados.

Has analizado los siguientes documentos basándote en estas instrucciones: {{{analysisInstructions}}}.
Aquí está el contenido de los documentos:
{{{documentContent}}}

Ahora, responde la siguiente pregunta. Si la pregunta no está relacionada con el contenido de los documentos, responde que solo puedes responder preguntas relacionadas con los documentos proporcionados.
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
