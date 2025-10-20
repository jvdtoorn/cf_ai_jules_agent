/** Fetches system prompt from R2 and replaces template variables */

let systemPromptCache: string | null = null;

function calculateAge(): number {
  return Math.floor(
    (Date.now() - (new Date(962_064_000_000)).getTime()) / (1000 * 60 * 60 * 24 * 365.25)
  );
}

function getCurrentDateTime(): string {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Amsterdam',
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(now);
  const get = (type: string) => parts.find(p => p.type === type)?.value;

  return `${get('weekday')}, ${get('day')}/${get('month')}/${get('year')} at ${get('hour')}:${get('minute')}`;
}

function replaceTemplateVariables(template: string): string {
  return template
    .replace(/\{\{AGE\}\}/g, calculateAge().toString())
    .replace(/\{\{CURRENT_DATE_TIME\}\}/g, getCurrentDateTime())
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
