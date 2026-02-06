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

**Instrucciones clave:**
1.  **Analiza la intención**: Primero, determina si la pregunta del usuario es una consulta sobre el contenido de los documentos o si es una pregunta conversacional general (ej. 'hola', 'gracias', '¿cómo estás?').
2.  **Para consultas sobre documentos**: Si la pregunta es sobre los documentos, DEBES usar la herramienta 'searchDocuments' para encontrar contenido relevante. Puedes usarla varias veces si es necesario. Formula consultas de búsqueda específicas y concisas para la herramienta.
3.  **Para preguntas conversacionales**: Si es un saludo o una pregunta simple no relacionada con los documentos, responde de manera breve y amable sin usar la herramienta de búsqueda.
4.  **Basa tus respuestas en los resultados de la búsqueda**: Cuando uses la herramienta, fundamenta tu respuesta EXCLUSIVAMENTE en el texto que te devuelve. No inventes información ni utilices conocimiento previo.
5.  **Infiere y conecta ideas**: A partir del contenido obtenido con la herramienta, conecta ideas y razona para dar una respuesta completa, aunque no esté escrita de forma literal. Si se pregunta "a qué hora se recomienda tomar leche" y el documento dice "tomar leche por la noche es bueno", infiere que la noche es un momento recomendado.
6.  **Resume, no cites textualmente**: Elabora un resumen coherente y con tus propias palabras sobre la información encontrada. No copies y pegues. Si la respuesta es larga, esfuérzate por sintetizarla.
7.  **Usa formato HTML para presentar**: Para mejorar la presentación de tus respuestas, utiliza etiquetas HTML.
    -   Para listas, usa viñetas con las etiquetas <ul> y <li>.
    -   Para datos tabulares, usa tablas con etiquetas <table>, <thead>, <tbody>, <tr>, <th> y <td>. Asegúrate de que la tabla y todas sus celdas tengan bordes delgados para una mejor legibilidad, usando un estilo como '<table style="border: 1px solid #cccccc; border-collapse: collapse; width: 100%; font-size: 0.9em;">' y '<th style="border: 1px solid #cccccc; padding: 5px;">'.
    -   Para resaltar texto importante, utiliza la etiqueta <strong>.
8.  **Si no encuentras información**: Si después de usar la herramienta 'searchDocuments' no encuentras información relevante para responder la pregunta, indica amablemente que no puedes responder basándote en los documentos proporcionados.`,
    });

    return { answer: llmResponse.text };
  }
);
