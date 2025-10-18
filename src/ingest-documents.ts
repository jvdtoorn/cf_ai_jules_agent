/**
 * Document ingestion script for embedding CV and cover letter into Vectorize
 * This can be run once during setup or exposed as an admin endpoint
 */

interface EmbeddingChunk {
	id: string;
	text: string;
	metadata: {
		source: string;
		section?: string;
		page?: number;
	};
}

/**
 * Chunk text into smaller pieces for better retrieval
 */
function chunkText(
	text: string,
	chunkSize = 500,
	overlap = 50
): { text: string; index: number }[] {
	const chunks: { text: string; index: number }[] = [];
	let start = 0;
	let index = 0;

	while (start < text.length) {
		const end = Math.min(start + chunkSize, text.length);
		chunks.push({
			text: text.slice(start, end),
			index: index++
		});
		start += chunkSize - overlap;
	}

	return chunks;
}

/**
 * Generate embeddings for text using Workers AI
 */
async function generateEmbedding(
	ai: Ai,
	text: string
): Promise<number[]> {
	const response = await ai.run("@cf/baai/bge-base-en-v1.5", {
		text: [text]
	});

	// @ts-expect-error - Workers AI types may not be complete
	return response.data[0];
}

/**
 * Ingest documents into Vectorize
 */
export async function ingestDocuments(
	env: Env,
	cv: string,
	coverLetter: string
): Promise<{ success: boolean; count: number; error?: string }> {
	try {
		const chunks: EmbeddingChunk[] = [];

		// Process CV
		const cvChunks = chunkText(cv);
		for (const chunk of cvChunks) {
			chunks.push({
				id: `cv-${chunk.index}`,
				text: chunk.text,
				metadata: {
					source: "cv",
					section: `chunk-${chunk.index}`
				}
			});
		}

		// Process cover letter
		const clChunks = chunkText(coverLetter);
		for (const chunk of clChunks) {
			chunks.push({
				id: `cl-${chunk.index}`,
				text: chunk.text,
				metadata: {
					source: "cover_letter",
					section: `chunk-${chunk.index}`
				}
			});
		}

		// Generate embeddings and insert into Vectorize
		const vectors = [];
		for (const chunk of chunks) {
			const embedding = await generateEmbedding(env.AI, chunk.text);
			vectors.push({
				id: chunk.id,
				values: embedding,
				metadata: {
					text: chunk.text,
					...chunk.metadata
				}
			});
		}

		// Insert into Vectorize
		await env.VECTORIZE.upsert(vectors);

		return { success: true, count: vectors.length };
	} catch (error) {
		console.error("Error ingesting documents:", error);
		return {
			success: false,
			count: 0,
			error: error instanceof Error ? error.message : "Unknown error"
		};
	}
}

/**
 * Query Vectorize for relevant document chunks
 */
export async function queryDocuments(
	env: Env,
	query: string,
	topK = 5
): Promise<string[]> {
	try {
		// Generate embedding for the query
		const queryEmbedding = await generateEmbedding(env.AI, query);

		// Query Vectorize
		const results = await env.VECTORIZE.query(queryEmbedding, {
			topK,
			returnMetadata: true
		});

		// Extract and return the text chunks
		return results.matches.map((match) => {
			const text = match.metadata?.text as string;
			return text || "";
		});
	} catch (error) {
		console.error("Error querying documents:", error);
		return [];
	}
}
