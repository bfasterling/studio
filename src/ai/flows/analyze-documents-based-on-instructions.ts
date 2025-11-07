'use server';

/**
 * @fileOverview Analyzes documents based on administrator-provided instructions.
 *
 * - analyzeDocumentsBasedOnInstructions - Analyzes the given documents based on specific instructions.
 * - AnalyzeDocumentsBasedOnInstructionsInput - The input type for the analyzeDocumentsBasedOnInstructions function.
 * - AnalyzeDocumentsBasedOnInstructionsOutput - The return type for the analyzeDocumentsBasedOnInstructions function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AnalyzeDocumentsBasedOnInstructionsInputSchema = z.object({
  documents: z
    .array(
      z.object({
        filename: z.string().describe('The name of the document file.'),
        content: z.string().describe('The content of the document (PDF or text) as a string.'),
      })
    )
    .describe('An array of documents to analyze, with their filenames and content.'),
  analysisInstructions: z
    .string()
    .describe('Specific instructions for analyzing the documents, provided by the administrator.'),
});

export type AnalyzeDocumentsBasedOnInstructionsInput = z.infer<
  typeof AnalyzeDocumentsBasedOnInstructionsInputSchema
>;

const AnalyzeDocumentsBasedOnInstructionsOutputSchema = z.object({
  analysisResults: z
    .array(z.string())
    .describe('An array of analysis results for each document.'),
});

export type AnalyzeDocumentsBasedOnInstructionsOutput = z.infer<
  typeof AnalyzeDocumentsBasedOnInstructionsOutputSchema
>;

export async function analyzeDocumentsBasedOnInstructions(
  input: AnalyzeDocumentsBasedOnInstructionsInput
): Promise<AnalyzeDocumentsBasedOnInstructionsOutput> {
  return analyzeDocumentsBasedOnInstructionsFlow(input);
}

const analyzeDocumentsBasedOnInstructionsPrompt = ai.definePrompt({
  name: 'analyzeDocumentsBasedOnInstructionsPrompt',
  input: {schema: AnalyzeDocumentsBasedOnInstructionsInputSchema},
  output: {schema: AnalyzeDocumentsBasedOnInstructionsOutputSchema},
  prompt: `You are an expert document analyst. Your task is to analyze a set of documents based on specific instructions provided by an administrator.

      Here are the documents to analyze:
      {{#each documents}}
        Document Name: {{{this.filename}}}
        Document Content:
        {{this.content}}
      {{/each}}

      Administrator Instructions: {{{analysisInstructions}}}

      Analyze each document according to the instructions. Return a concise summary of the analysis for each document.

      The analysis results should be an array of strings, where each string is the analysis of a single document.  Maintain the same order of documents.
      `,
});

const analyzeDocumentsBasedOnInstructionsFlow = ai.defineFlow(
  {
    name: 'analyzeDocumentsBasedOnInstructionsFlow',
    inputSchema: AnalyzeDocumentsBasedOnInstructionsInputSchema,
    outputSchema: AnalyzeDocumentsBasedOnInstructionsOutputSchema,
  },
  async input => {
    const {output} = await analyzeDocumentsBasedOnInstructionsPrompt(input);
    return output!;
  }
);
