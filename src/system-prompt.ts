/** Fetches system prompt from R2 and replaces template variables */

let systemPromptCache: string | null = null;

function calculateAge(): number {
  return Math.floor(
    (Date.now() - (new Date(962_064_000_000)).getTime()) / (1000 * 60 * 60 * 24 * 365.25)
  );
}

function replaceTemplateVariables(template: string): string {
  return template
    .replace(/\{\{AGE\}\}/g, calculateAge().toString())
    .replace(/\{\{RESUME_LINK\}\}/g, "/api/download/cv")
    .replace(/\{\{COVER_LETTER_LINK\}\}/g, "/api/download/cover_letter");
}

export async function getSystemPrompt(env: Env): Promise<string> {
  if (systemPromptCache) {
    return replaceTemplateVariables(systemPromptCache);
  }

  try {
    const object = await env.DOCUMENTS.get("system-prompt.txt");
    if (!object) {
      return getFallbackSystemPrompt();
    }

    const promptTemplate = await object.text();
    systemPromptCache = promptTemplate;

    return replaceTemplateVariables(promptTemplate);
  } catch (error) {
    console.error("Error fetching system prompt from R2:", error);
    return getFallbackSystemPrompt();
  }
}

function getFallbackSystemPrompt(): string {
  return `You are a helpful AI assistant. The system prompt could not be loaded from storage. Please inform the user that the service is temporarily unavailable and to try again later.`;
}
