'use server';

/**
 * @fileOverview Limits the AI chat agent to respond only to questions related to the content of the uploaded documents using a search tool.
 * Includes token usage tracking and advanced context awareness for conversational continuity.
 *
 * - limitResponsesToDocumentContent - A function that orchestrates document search and answer generation.
 * - LimitResponsesToDocumentContentInput - The input type for the function.
 * - LimitResponsesToDocumentContentOutput - The return type for the function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const MessageSchema = z.object({
  role: z.enum(['user', 'model']),
  content: z.string(),
});

type Document = {
  id: string;
  content: string;
  fileName: string;
  analysisInstructions: string;
  [key: string]: any;
};


const LimitResponsesToDocumentContentInputSchema = z.object({
  question: z.string().describe('The user question.'),
  documents: z.array(z.any()).describe('The full list of documents available to search.'),
  history: z.array(MessageSchema).describe('The conversation history.'),
});
export type LimitResponsesToDocumentContentInput = z.infer<
  typeof LimitResponsesToDocumentContentInputSchema
>;

const LimitResponsesToDocumentContentOutputSchema = z.object({
  answer: z.string().describe('The AI chat agent answer.'),
  usage: z.object({
    inputTokens: z.number(),
    outputTokens: z.number(),
    totalTokens: z.number(),
  }).optional(),
});
export type LimitResponsesToDocumentContentOutput = z.infer<
  typeof LimitResponsesToDocumentContentOutputSchema
>;

export async function limitResponsesToDocumentContent(
  input: LimitResponsesToDocumentContentInput
): Promise<LimitResponsesToDocumentContentOutput> {
  return limitResponsesToDocumentContentFlow(input);
}

const limitResponsesToDocumentContentFlow = ai.defineFlow(
  {
    name: 'limitResponsesToDocumentContentFlow',
    inputSchema: LimitResponsesToDocumentContentInputSchema,
    outputSchema: LimitResponsesToDocumentContentOutputSchema,
  },
  async (input) => {
    const documents: Document[] = input.documents;
    
    const searchDocumentsTool = ai.defineTool(
      {
        name: 'searchDocuments',
        description: 'Searches through the content of uploaded documents to find information relevant to a user query. Use the conversation history to understand pronouns or follow-up questions.',
        inputSchema: z.object({
          query: z.string().describe('A specific search query. If the user question is a follow-up (e.g., "tell me more about it"), include the entity name from history in this query.'),
        }),
        outputSchema: z.string().describe('Concatenated relevant fragments from documents.'),
      },
      async ({ query }) => {
        const searchWords = query.toLowerCase().split(/\s+/).filter(word => word.length > 2);
        if (searchWords.length === 0) {
            return "No se proporcionó una consulta de búsqueda válida.";
        }
    
        let allChunks: { content: string; score: number; fileName: string }[] = [];
        const CHUNK_SIZE = 1500;
        const CHUNK_OVERLAP = 300;

        for (const doc of documents) {
            if (!doc.content || typeof doc.content !== 'string') continue;

            const lowerCaseFileName = doc.fileName.toLowerCase();
            const fileNameBonus = searchWords.some(word => lowerCaseFileName.includes(word)) ? 20 : 0;

            for (let i = 0; i < doc.content.length; i += CHUNK_SIZE - CHUNK_OVERLAP) {
                const chunkContent = doc.content.substring(i, i + CHUNK_SIZE);
                const lowerCaseChunk = chunkContent.toLowerCase();

                let score = 0;
                const matchedWords = new Set<string>();

                for (const word of searchWords) {
                    if (lowerCaseChunk.includes(word)) {
                        matchedWords.add(word);
                    }
                }

                if (matchedWords.size > 0) {
                    score += matchedWords.size * 10; 
                    score += fileNameBonus;
                    const totalOccurrences = Array.from(matchedWords).reduce((acc, word) => {
                        return acc + (lowerCaseChunk.match(new RegExp(word, 'g')) || []).length;
                    }, 0);
                    const density = (totalOccurrences / chunkContent.length) * 500; 
                    score += density;

                    allChunks.push({
                        content: chunkContent,
                        score: score,
                        fileName: doc.fileName,
                    });
                }
            }
        }
        
        if (allChunks.length === 0) {
            return "He buscado en todos los documentos, pero no he encontrado información relevante para su consulta.";
        }
    
        const rankedChunks = allChunks.sort((a, b) => b.score - a.score);
        const topChunks = rankedChunks.slice(0, 7);
        const context = topChunks
            .map(chunk => `Fragmento relevante del documento "${chunk.fileName}":\n"${chunk.content}"`)
            .join('\n\n---\n\n');
        
        return context;
      }
    );

    const llmResponse = await ai.generate({
      model: 'googleai/gemini-2.5-flash',
      tools: [searchDocumentsTool],
      messages: input.history.map(m => ({
        role: m.role,
        content: [{text: m.content}]
      })),
      prompt: input.question,
      system: `Eres un agente de chat de IA experto en análisis de documentos, nutrición y salud. Tu objetivo es proporcionar respuestas extremadamente estructuradas y visualmente profesionales.

**REGLAS DE FORMATO (OBLIGATORIAS):**
1. **Estructura Visual:** No respondas con bloques largos de texto. Divide la información en secciones claras.
2. **Listas:** Utiliza listas con viñetas (<ul><li>) para beneficios, características o pasos.
3. **Tablas:** Si presentas comparativas, valores nutricionales o listas de elementos con propiedades, utiliza SIEMPRE tablas HTML (<table>, <tr>, <td>, etc.).
4. **Resaltado:** Usa <strong> para destacar términos clave, alimentos importantes o conclusiones. No abuses, úsalo para lo que realmente importa.
5. **Citas:** Usa <em> para mencionar nombres de archivos o citas textuales de los documentos.
6. **Párrafos:** Separa las ideas con etiquetas <p> para una lectura cómoda.

**INSTRUCCIONES DE CONTINUIDAD Y MEMORIA:**
1. **Contexto:** Analiza el historial. Si el usuario pregunta por "eso" o "cuánto tiene", identifica a qué alimento o tema se refería anteriormente.
2. **Búsqueda Inteligente:** Al usar 'searchDocuments', si la pregunta es un seguimiento, reformula la búsqueda incluyendo el tema del contexto (ej: si hablaban de "manzana", busca "beneficios de la manzana" aunque el usuario solo diga "beneficios").

**REGLA DE ORO:** Basa tu respuesta EXCLUSIVAMENTE en la información encontrada. No inventes datos. Si no hay información sobre el tema del contexto en los documentos, indícalo claramente.`,
    });

    return { 
      answer: llmResponse.text,
      usage: llmResponse.usage ? {
        inputTokens: llmResponse.usage.inputTokens || 0,
        outputTokens: llmResponse.usage.outputTokens || 0,
        totalTokens: (llmResponse.usage.inputTokens || 0) + (llmResponse.usage.outputTokens || 0),
      } : undefined
    };
  }
);
