'use server';
/**
 * @fileOverview A flow to categorize conversations by theme.
 *
 * - categorizeConversations - A function that takes conversations and groups them by theme.
 * - CategorizeConversationsInput - The input type for the function.
 * - InternalCategorizeConversationsOutput - The *internal* return type for the AI flow.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SerializableConversationSchema = z.object({
    id: z.string(),
    userId: z.string(),
    questionText: z.string(),
    answerText: z.string(),
    timestamp: z.string().describe("The ISO 8601 timestamp string for when the conversation happened."),
});

const CategorizeConversationsInputSchema = z.object({
    conversations: z.array(SerializableConversationSchema).describe("An array of conversation objects to be categorized."),
});
export type CategorizeConversationsInput = z.infer<typeof CategorizeConversationsInputSchema>;

// Define a more structured output that avoids using a plain z.record at the top level.
const ThemeGroupSchema = z.object({
    themeName: z.string().describe("The name of the category/theme in Spanish."),
    conversationIds: z.array(z.string()).describe("An array of conversation IDs that fall under this theme."),
});

// The AI will return an object containing an array of these theme groups.
const InternalCategorizeConversationsOutputSchema = z.object({
    categorizedThemes: z.array(ThemeGroupSchema).describe("A list of themes, each containing the theme name and the IDs of the conversations belonging to it.")
});
export type InternalCategorizeConversationsOutput = z.infer<typeof InternalCategorizeConversationsOutputSchema>;

// The final output of the exported function will still be Record<string, string[]>
export type CategorizeConversationsOutput = Record<string, string[]>;


export async function categorizeConversations(
  input: CategorizeConversationsInput
): Promise<CategorizeConversationsOutput> {
  const internalResult = await categorizeConversationsFlow(input);

  // Transform the AI's array-based output into the record/map format the client expects.
  if (!internalResult?.categorizedThemes) {
    return {};
  }

  const finalOutput: CategorizeConversationsOutput = {};
  for (const group of internalResult.categorizedThemes) {
    if (group.themeName && group.conversationIds) {
        finalOutput[group.themeName] = group.conversationIds;
    }
  }
  return finalOutput;
}

const prompt = ai.definePrompt({
    name: 'categorizeConversationsPrompt',
    input: { schema: CategorizeConversationsInputSchema },
    output: { schema: InternalCategorizeConversationsOutputSchema }, // Use the new, more structured schema
    prompt: `You are an expert data analyst. Your task is to categorize a list of user questions from a Q&A system into relevant themes.

You will receive an array of conversation objects, each with a 'questionText' and an 'id'.

Analyze all the 'questionText' fields and identify 3 to 5 main themes. The themes should be concise and descriptive in Spanish (e.g., "Consultas de Precios", "Información de Producto", "Soporte Técnico").

Group the conversation IDs under the most appropriate theme.

If a conversation doesn't fit into any of the main themes you've identified, place its ID under a special theme called "Otros temas".

Your final output MUST be a JSON object containing a single key "categorizedThemes". The value of this key will be an array of objects. Each object in the array represents one theme and must have two keys: "themeName" (a string for the theme's name) and "conversationIds" (an array of strings, where each string is a conversation ID).

Example format:
{
  "categorizedThemes": [
    {
      "themeName": "Consultas de Precios",
      "conversationIds": ["conv_1", "conv_5"]
    },
    {
      "themeName": "Soporte Técnico",
      "conversationIds": ["conv_2", "conv_3"]
    },
    {
      "themeName": "Otros temas",
      "conversationIds": ["conv_4"]
    }
  ]
}

Here is the list of conversations to analyze:
{{{json conversations}}}
`,
});

const categorizeConversationsFlow = ai.defineFlow(
  {
    name: 'categorizeConversationsFlow',
    inputSchema: CategorizeConversationsInputSchema,
    outputSchema: InternalCategorizeConversationsOutputSchema, // The flow itself outputs the internal format
  },
  async (input) => {
    if (input.conversations.length === 0) {
        return { categorizedThemes: [] };
    }
    const {output} = await prompt(input);
    return output!;
  }
);
