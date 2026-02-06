'use server';
/**
 * @fileOverview A flow to categorize conversations by theme.
 *
 * - categorizeConversations - A function that takes conversations and groups them by theme.
 * - CategorizeConversationsInput - The input type for the function.
 * - CategorizeConversationsOutput - The return type for the function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SerializableConversationSchema = z.object({
    id: z.string(),
    userId: z.string(),
    questionText: z.string(),
    answerText: z.string(),
    // Pass timestamp as an ISO string
    timestamp: z.string().describe("The ISO 8601 timestamp string for when the conversation happened."),
});

const CategorizeConversationsInputSchema = z.object({
    conversations: z.array(SerializableConversationSchema).describe("An array of conversation objects to be categorized."),
});
export type CategorizeConversationsInput = z.infer<typeof CategorizeConversationsInputSchema>;

// The output will be a map of theme names to arrays of conversation IDs.
const CategorizeConversationsOutputSchema = z.object({
  themedConversations: z.record(z.string(), z.array(z.string())).describe("An object where each key is a theme, and the value is an array of conversation IDs belonging to that theme."),
});
export type CategorizeConversationsOutput = z.infer<typeof CategorizeConversationsOutputSchema>;


export async function categorizeConversations(
  input: CategorizeConversationsInput
): Promise<CategorizeConversationsOutput> {
  return categorizeConversationsFlow(input);
}


const prompt = ai.definePrompt({
    name: 'categorizeConversationsPrompt',
    input: { schema: CategorizeConversationsInputSchema },
    output: { schema: CategorizeConversationsOutputSchema },
    prompt: `You are an expert data analyst. Your task is to categorize a list of user questions from a Q&A system into relevant themes.

You will receive an array of conversation objects, each with a 'questionText' and an 'id'.

Analyze all the 'questionText' fields and identify 3 to 5 main themes. The themes should be concise and descriptive in Spanish (e.g., "Consultas de Precios", "Información de Producto", "Soporte Técnico").

Group the conversation IDs under the most appropriate theme.

If a conversation doesn't fit into any of the main themes you've identified, place its ID under a special theme called "Otros temas".

Your final output MUST be a single JSON object where each key is a theme name, and the value is an array of the corresponding conversation IDs.

Here is the list of conversations to analyze:
{{{json conversations}}}
`,
});

const categorizeConversationsFlow = ai.defineFlow(
  {
    name: 'categorizeConversationsFlow',
    inputSchema: CategorizeConversationsInputSchema,
    outputSchema: CategorizeConversationsOutputSchema,
  },
  async (input) => {
    // If there are no conversations, return an empty object.
    if (input.conversations.length === 0) {
        return { themedConversations: {} };
    }
    const {output} = await prompt(input);
    return output!;
  }
);
