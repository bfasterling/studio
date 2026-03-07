'use server';

/**
 * @fileOverview Limits the AI chat agent to respond only to questions related to the content of the uploaded documents using a search tool.
 * Includes token usage tracking.
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
        description: 'Searches through the content of uploaded documents to find information relevant to a user query. This is the primary way to get information.',
        inputSchema: z.object({
          query: z.string().describe('A specific, targeted query to search for within the documents. This should be more like a search engine query than a full question.'),
        }),
        outputSchema: z.string().describe('A string containing the concatenated content of the most relevant document chunks found. Returns a user-friendly message if no relevant content is found.'),
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
      history: input.history.map(m => ({role: m.role, content: [{text: m.content}]})),
      prompt: input.question,
      system: `Eres un agente de chat de IA experto en análisis de documentos. Tu objetivo principal es responder preguntas basándote en la información de los documentos proporcionados, presentando la respuesta de la forma más clara y profesional posible.

**Instrucciones Clave:**

1.  **Analiza la Pregunta del Usuario:**
    *   **Si es una pregunta conversacional:** Si la pregunta es un saludo, una despedida o una pregunta social simple (ej: 'hola', 'gracias', '¿cómo estás?', 'adiós'), **NO uses ninguna herramienta**. Responde directamente de forma amable y breve.
    *   **Si es una consulta sobre el contenido:** Si la pregunta busca información que podría estar en los documentos, DEBES usar la herramienta \`searchDocuments\` para encontrarla.

2.  **Cómo Usar la Herramienta \`searchDocuments\`:**
    *   Crea consultas de búsqueda concisas y específicas.
    *   Si en la pregunta se solicita referencia o autor, menciona en letra itálica los datos del articulo y/o autor.

3.  **Cómo Generar tu Respuesta Final:**
    *   **Si usaste la herramienta de búsqueda:**
        *   **Y encontraste información:** Basa tu respuesta EXCLUSIVAMENTE en el texto que te devolvió la herramienta. **¡Debes formatear esta respuesta usando HTML!**
            *   Usa párrafos (\`<p>\`).
            *   Utiliza \`<strong>\` para enfatizar.
            *   Usa \`<ul>\` con \`<li>\` para listas.
            *   Usa tablas HTML (\`<table style="border: 1px solid #cccccc; border-collapse: collapse; width: 100%; font-size: 0.9em;">\`) para datos comparativos.
        *   **Y NO encontraste información:** Simplemente devuelve el mensaje de no información encontrada.
    *   **Si NO usaste la herramienta:** Simplemente proporciona la respuesta amable sin formato HTML.

4.  **Regla de Oro:** Nunca inventes información externa.`,
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
