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
        outputSchema: z.string().describe('A string containing the concatenated content of the most relevant document chunks found. Returns an empty string if no relevant content is found.'),
      },
      async ({ query }) => {
        const searchWords = query.toLowerCase().split(/\s+/).filter(word => word.length > 2);
        if (searchWords.length === 0) {
          return "No relevant information found for the given query.";
        }

        // 1. First pass: Rank documents to find the most promising ones
        const rankedDocs = documents
          .map(doc => {
            const lowerCaseContent = doc.content.toLowerCase();
            const lowerCaseFileName = doc.fileName.toLowerCase();
            let score = 0;
            
            for (const word of searchWords) {
              // Add points for each occurrence of a search word
              score += (lowerCaseContent.match(new RegExp(word, 'g')) || []).length;
            }
            
            // Boost score significantly if file name contains any of the search words
            if (searchWords.some(word => lowerCaseFileName.includes(word))) {
                score += 10;
            }

            return { doc, score };
          })
          .filter(item => item.score > 0)
          .sort((a, b) => b.score - a.score);

        // Take the top 5 most relevant documents for a deeper analysis
        const topDocs = rankedDocs.slice(0, 5).map(item => item.doc);

        if (topDocs.length === 0) {
          return "No relevant information found in the documents for the given query.";
        }

        // 2. Second pass: Extract and rank chunks (paragraphs) from the top documents
        let allChunks: { content: string; score: number; fileName: string }[] = [];
        for (const doc of topDocs) {
            // Split content into paragraphs. A paragraph is defined by one or more empty lines.
            const paragraphs = doc.content.split(/\n\s*\n/).filter(p => p.trim().length > 10);
            
            for (const p of paragraphs) {
                const lowerCaseParagraph = p.toLowerCase();
                let chunkScore = 0;
                const matchedWords = new Set<string>();

                for (const word of searchWords) {
                    if (lowerCaseParagraph.includes(word)) {
                        chunkScore += (lowerCaseParagraph.match(new RegExp(word, 'g')) || []).length;
                        matchedWords.add(word);
                    }
                }
                
                // Add a bonus for matching multiple distinct query words in the same chunk
                if (matchedWords.size > 1) {
                    chunkScore += matchedWords.size * 5;
                }

                if (chunkScore > 0) {
                    allChunks.push({
                        content: p,
                        score: chunkScore,
                        fileName: doc.fileName,
                    });
                }
            }
        }
        
        // If after analyzing chunks, we have nothing, it might be the document isn't structured with paragraphs.
        // As a fallback, we can take the beginning of the most relevant document.
        if (allChunks.length === 0 && topDocs.length > 0) {
            const fallbackDoc = topDocs[0];
            const truncatedContent = fallbackDoc.content.substring(0, 15000);
            return `Content from document "${fallbackDoc.fileName}":\n${truncatedContent}${fallbackDoc.content.length > 15000 ? '... (truncated)' : ''}`;
        }

        // 3. Rank all collected chunks from the top documents by their score
        const rankedChunks = allChunks.sort((a, b) => b.score - a.score);

        // 4. Take the top 7 most relevant chunks to create the context
        const topChunks = rankedChunks.slice(0, 7);

        // 5. Format the final output for the LLM
        return topChunks
            .map(chunk => `Relevant snippet from document "${chunk.fileName}":\n"${chunk.content}"`)
            .join('\n\n---\n\n');
      }
    );

    const llmResponse = await ai.generate({
      model: 'googleai/gemini-2.5-flash',
      tools: [searchDocumentsTool],
      history: input.history.map(m => ({role: m.role, content: [{text: m.content}]})),
      prompt: input.question,
      system: `Eres un agente de chat de IA experto en análisis de documentos. Tu objetivo principal es responder preguntas basándote en la información de los documentos proporcionados.

**Instrucciones Clave:**

1.  **Analiza la Pregunta del Usuario:**
    *   **Si es una pregunta conversacional:** Si la pregunta es un saludo, una despedida o una pregunta social simple (ej: 'hola', 'gracias', '¿cómo estás?', 'adiós'), **NO uses ninguna herramienta**. Responde directamente de forma amable y breve. Por ejemplo, si el usuario dice "hola", puedes responder "¡Hola! ¿En qué puedo ayudarte con tus documentos hoy?".
    *   **Si es una consulta sobre el contenido:** Si la pregunta busca información que podría estar en los documentos, DEBES usar la herramienta \`searchDocuments\` para encontrarla.

2.  **Cómo Usar la Herramienta \`searchDocuments\`:**
    *   Crea consultas de búsqueda concisas y específicas para encontrar la información más relevante.
    *   Puedes usar la herramienta varias veces si la pregunta es compleja y requiere buscar diferentes conceptos.

3.  **Cómo Generar tu Respuesta Final:**
    *   **Si usaste la herramienta de búsqueda:**
        *   **Y encontraste información:** Basa tu respuesta EXCLUSIVAMENTE en el texto que te devolvió la herramienta. Conecta las ideas, razona e infiere para dar una respuesta completa. Resume la información en lugar de copiarla textualmente.
        *   **Y NO encontraste información:** Si la herramienta te devolvió un mensaje indicando que no encontró nada, informa amablemente al usuario. Por ejemplo: "He buscado en los documentos, pero no he encontrado información sobre su consulta.".
    *   **Si NO usaste la herramienta (porque era una pregunta conversacional):** Simplemente proporciona la respuesta amable y breve que preparaste.
    *   **En todos los casos, usa formato HTML:** Para mejorar la presentación de tus respuestas, utiliza etiquetas HTML. Para listas, usa viñetas con \`<ul>\` y \`<li>\`. Para resaltar, usa \`<strong>\`. Para datos tabulares, usa tablas con \`<table>\`, \`<thead>\`, \`<tbody>\`, \`<tr>\`, \`<th>\` y \`<td>\`, y asegúrate de que tengan bordes para legibilidad, como en el ejemplo: \`<table style="border: 1px solid #cccccc; border-collapse: collapse; width: 100%; font-size: 0.9em;">\`.

4.  **Regla de Oro:** Nunca inventes información ni uses conocimiento externo que no provenga de los documentos a través de la herramienta de búsqueda.`,
    });

    return { answer: llmResponse.text };
  }
);
