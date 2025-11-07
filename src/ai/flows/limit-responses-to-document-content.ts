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

const LimitResponsesToDocumentContentInputSchema = z.object({
  question: z.string().describe('The user question.'),
  documentContent: z.string().describe('The content of the uploaded documents.'),
  analysisInstructions: z.string().describe('The analysis instructions provided by the administrator.'),
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
  prompt: `You are an AI chat agent that can only answer questions related to the content of the uploaded documents.

  You have analyzed the following documents based on these instructions: {{{analysisInstructions}}}.
  Here is the content of the documents:
  {{{documentContent}}}

  Now, answer the following question. If the question is not related to the content of the documents, respond that you can only answer questions related to the documents provided.
  Question: {{{question}}}
  Answer: `,
});

const limitResponsesToDocumentContentFlow = ai.defineFlow(
  {
    name: 'limitResponsesToDocumentContentFlow',
    inputSchema: LimitResponsesToDocumentContentInputSchema,
    outputSchema: LimitResponsesToDocumentContentOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
