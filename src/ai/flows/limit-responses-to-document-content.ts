'use server';

/**
 * @fileOverview Limits the AI chat agent to respond only to questions related to the content of the uploaded documents using a search tool.
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
    
    // Define the search tool within the flow to capture the 'documents' in its scope.
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
        const searchWords = query.toLowerCase().split(/\s+/).filter(word => word.length > 0);
        if (searchWords.length === 0) {
            return "No se proporcionó una consulta de búsqueda válida.";
        }
    
        let allChunks: { content: string; score: number; fileName: string }[] = [];
    
        // Iterate through all documents to find and score relevant chunks
        for (const doc of documents) {
            const paragraphs = doc.content.split(/\n\s*\n/).filter(p => p.trim().length > 10);
            const lowerCaseFileName = doc.fileName.toLowerCase();
            const fileNameBonus = searchWords.some(word => lowerCaseFileName.includes(word)) ? 10 : 0;
    
            for (const p of paragraphs) {
                const lowerCaseParagraph = p.toLowerCase();
                let chunkScore = 0;
                const matchedWords = new Set<string>();
    
                for (const word of searchWords) {
                    const occurrences = (lowerCaseParagraph.match(new RegExp(word, 'g')) || []).length;
                    if (occurrences > 0) {
                        chunkScore += occurrences; // 1 point per occurrence
                        matchedWords.add(word);
                    }
                }
                
                // Bonus for matching multiple distinct query words
                if (matchedWords.size > 1) {
                    chunkScore += matchedWords.size * 5;
                }
    
                if (chunkScore > 0) {
                    chunkScore += fileNameBonus; // Add file name bonus if chunk has any score
                    allChunks.push({
                        content: p,
                        score: chunkScore,
                        fileName: doc.fileName,
                    });
                }
            }
        }
        
        // If no chunks were found after searching all documents
        if (allChunks.length === 0) {
            return "He buscado en todos los documentos, pero no he encontrado información sobre su consulta.";
        }
    
        // Rank all collected chunks by their score
        const rankedChunks = allChunks.sort((a, b) => b.score - a.score);
    
        // Take the top 5 most relevant chunks to create the context
        const topChunks = rankedChunks.slice(0, 5);
    
        // Format the final output for the LLM
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
    *   **Si es una pregunta conversacional:** Si la pregunta es un saludo, una despedida o una pregunta social simple (ej: 'hola', 'gracias', '¿cómo estás?', 'adiós'), **NO uses ninguna herramienta**. Responde directamente de forma amable y breve. Por ejemplo, si el usuario dice "hola", puedes responder "¡Hola! ¿En qué puedo ayudarte con tus documentos hoy?".
    *   **Si es una consulta sobre el contenido:** Si la pregunta busca información que podría estar en los documentos, DEBES usar la herramienta \`searchDocuments\` para encontrarla.

2.  **Cómo Usar la Herramienta \`searchDocuments\`:**
    *   Crea consultas de búsqueda concisas y específicas para encontrar la información más relevante.
    *   Puedes usar la herramienta varias veces si la pregunta es compleja y requiere buscar diferentes conceptos.

3.  **Cómo Generar tu Respuesta Final:**
    *   **Si usaste la herramienta de búsqueda:**
        *   **Y encontraste información:** Basa tu respuesta EXCLUSIVAMENTE en el texto que te devolvió la herramienta. Conecta las ideas, razona e infiere para dar una respuesta completa. **¡Debes formatear esta respuesta usando HTML para máxima legibilidad!**
            *   **Estructura:** Usa párrafos (\`<p>\`) para separar ideas y hacer el texto más aireado.
            *   **Resaltado:** Utiliza \`<strong>\` para enfatizar conceptos clave, nombres, fechas o cifras importantes que respondan directamente a la pregunta del usuario.
            *   **Listas:** Si la información puede ser enumerada o listada (como características, pasos a seguir, o puntos importantes), usa \`<ul>\` con \`<li>\` para crear listas claras con viñetas.
            *   **Tablas:** Cuando la información sea comparativa o esté estructurada naturalmente en filas y columnas, DEBES usar una tabla HTML. Es crucial para presentar datos de forma ordenada. Asegúrate de que tenga bordes para que sea fácil de leer, usando este estilo: \`<table style="border: 1px solid #cccccc; border-collapse: collapse; width: 100%; font-size: 0.9em;">\`. Incluye cabeceras (\`<thead>\`, \`<th>\`) y el cuerpo de la tabla (\`<tbody>\`, \`<tr>\`, \`<td>\`).
        *   **Y NO encontraste información:** Si la herramienta te devolvió un mensaje indicando que no encontró nada (como "He buscado en todos los documentos..."), simplemente devuelve ese mismo mensaje al usuario. No añadas nada más y no uses formato HTML.
    *   **Si NO usaste la herramienta (porque era una pregunta conversacional):** Simplemente proporciona la respuesta amable y breve que preparaste, sin formato HTML.

4.  **Regla de Oro:** Nunca inventes información ni uses conocimiento externo que no provenga de los documentos a través de la herramienta de búsqueda.`,
    });

    return { answer: llmResponse.text };
  }
);
