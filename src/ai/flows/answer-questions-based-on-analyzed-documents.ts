'use server';

/**
 * @fileOverview A flow that answers questions based on analyzed documents.
 *
 * - answerQuestionsBasedOnAnalyzedDocuments - A function that answers questions based on analyzed documents.
 * - AnswerQuestionsBasedOnAnalyzedDocumentsInput - The input type for the answerQuestionsBasedOnAnalyzedDocuments function.
 * - AnswerQuestionsBasedOnAnalyzedDocumentsOutput - The return type for the answerQuestionsBasedOnAnalyzedDocuments function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AnswerQuestionsBasedOnAnalyzedDocumentsInputSchema = z.object({
  question: z.string().describe('The question to answer.'),
  analyzedDocumentContent: z
    .string()
    .describe('The analyzed content of the document(s).'),
});
export type AnswerQuestionsBasedOnAnalyzedDocumentsInput = z.infer<
  typeof AnswerQuestionsBasedOnAnalyzedDocumentsInputSchema
>;

const AnswerQuestionsBasedOnAnalyzedDocumentsOutputSchema = z.object({
  answer: z.string().describe('The answer to the question.'),
});
export type AnswerQuestionsBasedOnAnalyzedDocumentsOutput = z.infer<
  typeof AnswerQuestionsBasedOnAnalyzedDocumentsOutputSchema
>;

export async function answerQuestionsBasedOnAnalyzedDocuments(
  input: AnswerQuestionsBasedOnAnalyzedDocumentsInput
): Promise<AnswerQuestionsBasedOnAnalyzedDocumentsOutput> {
  return answerQuestionsBasedOnAnalyzedDocumentsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'answerQuestionsBasedOnAnalyzedDocumentsPrompt',
  input: {
    schema: AnswerQuestionsBasedOnAnalyzedDocumentsInputSchema,
  },
  output: {
    schema: AnswerQuestionsBasedOnAnalyzedDocumentsOutputSchema,
  },
  prompt: `You are an AI chat agent that answers questions based on the content of uploaded documents.

  You will be provided with the analyzed content of the document(s) and a question.

  Your task is to answer the question based on the analyzed content of the document(s).

  Only respond to questions related to the content of the uploaded documents. If a question falls outside of the scope of the document(s), simply state that you cannot answer it.

  Analyzed Document Content: {{{analyzedDocumentContent}}}

  Question: {{{question}}}

  Answer: `,
});

const answerQuestionsBasedOnAnalyzedDocumentsFlow = ai.defineFlow(
  {
    name: 'answerQuestionsBasedOnAnalyzedDocumentsFlow',
    inputSchema: AnswerQuestionsBasedOnAnalyzedDocumentsInputSchema,
    outputSchema: AnswerQuestionsBasedOnAnalyzedDocumentsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
