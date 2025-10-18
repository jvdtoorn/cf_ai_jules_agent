import { routeAgentRequest } from "agents";

import { AIChatAgent } from "agents/ai-chat-agent";
import {
  generateId,
  streamText,
  type StreamTextOnFinishCallback,
  stepCountIs,
  createUIMessageStream,
  convertToModelMessages,
  createUIMessageStreamResponse,
  type ToolSet
} from "ai";
import { createWorkersAI } from "workers-ai-provider";
import { processToolCalls, cleanupMessages } from "./utils";
import { tools, executions } from "./tools";
import { ingestDocuments } from "./ingest-documents";

/**
 * Chat Agent implementation that handles real-time AI chat interactions
 */
export class Chat extends AIChatAgent<Env> {
  /**
   * Initialize user profile table on first access
   */
  async initializeUserProfile() {
    this.sql`
      CREATE TABLE IF NOT EXISTS user_profile (
        session_id TEXT PRIMARY KEY,
        user_name TEXT,
        first_seen TEXT,
        last_seen TEXT
      )
    `;
  }

  /**
   * Get or create user profile
   */
  async getUserProfile(sessionId: string) {
    await this.initializeUserProfile();
    
    const result = this.sql<{
      session_id: string;
      user_name: string | null;
      first_seen: string;
      last_seen: string;
    }>`SELECT * FROM user_profile WHERE session_id = ${sessionId}`;

    if (result.length === 0) {
      const now = new Date().toISOString();
      this.sql`INSERT INTO user_profile (session_id, first_seen, last_seen) VALUES (${sessionId}, ${now}, ${now})`;
      return { session_id: sessionId, user_name: null, first_seen: now, last_seen: now };
    }

    return result[0];
  }

  /**
   * Update user profile with name
   */
  async updateUserName(sessionId: string, userName: string) {
    await this.initializeUserProfile();
    const now = new Date().toISOString();
    this.sql`UPDATE user_profile SET user_name = ${userName}, last_seen = ${now} WHERE session_id = ${sessionId}`;
  }


  /**
   * Handles incoming chat messages and manages the response stream
   */
  async onChatMessage(
    onFinish: StreamTextOnFinishCallback<ToolSet>,
    _options?: { abortSignal?: AbortSignal }
  ) {
    // Create Workers AI instance
    const workersai = createWorkersAI({ binding: this.env.AI });
    const model = workersai("@cf/meta/llama-3.3-70b-instruct-fp8-fast");

    // Get session ID from the agent's name (set by the URL routing)
    const sessionId = this.name || "default";
    
    // Load user profile
    const userProfile = await this.getUserProfile(sessionId);

    // Collect all tools, including MCP tools
    const allTools = {
      ...tools,
      ...this.mcp.getAITools()
    };

    const stream = createUIMessageStream({
      execute: async ({ writer }) => {
        // Clean up incomplete tool calls to prevent API errors
        const cleanedMessages = cleanupMessages(this.messages);

        // Process any pending tool calls from previous messages
        // This handles human-in-the-loop confirmations for tools
        const processedMessages = await processToolCalls({
          messages: cleanedMessages,
          dataStream: writer,
          tools: allTools,
          executions
        });

        const greetingContext = userProfile.user_name 
          ? `The user's name is ${userProfile.user_name}. Greet them warmly when appropriate.`
          : "";

        const result = streamText({
          system: `You are an AI chatbot that represents Jules, answering questions as if you are Jules himself. Your role is to help recruiters and hiring managers learn about Jules' background, experience, skills, and availability.

Core Information:
- You should be conversational, friendly, and professional - matching Jules' communication style
- When asked detailed questions about Jules' experience, skills, or background, use the queryPersonalInfo tool to retrieve accurate information from his CV and cover letter
- If someone introduces themselves (e.g., "Hi, I'm Sarah"), remember their name for future interactions using the rememberUserName tool
- You can provide Jules' CV or cover letter as downloadable documents using the sendDocumentReply tool

${greetingContext}

Key Guidelines:
- Always respond in first person as Jules
- Be helpful and informative
- Use the queryPersonalInfo tool for specific questions about experience, education, or skills
- Be honest if you don't have information - suggest downloading the full CV or cover letter instead
- Keep responses concise but informative
`,

          messages: convertToModelMessages(processedMessages),
          model,
          tools: allTools,
          // Type boundary: streamText expects specific tool types, but base class uses ToolSet
          // This is safe because our tools satisfy ToolSet interface (verified by 'satisfies' in tools.ts)
          onFinish: onFinish as unknown as StreamTextOnFinishCallback<
            typeof allTools
          >,
          stopWhen: stepCountIs(10)
        });

        writer.merge(result.toUIMessageStream());
      }
    });

    return createUIMessageStreamResponse({ stream });
  }
  
}

/**
 * Generate a cryptographically secure session ID
 */
function generateSessionId(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * Parse cookies from request
 */
function parseCookies(request: Request): Map<string, string> {
  const cookieHeader = request.headers.get("Cookie");
  const cookies = new Map<string, string>();
  
  if (cookieHeader) {
    cookieHeader.split(";").forEach((cookie) => {
      const [name, value] = cookie.trim().split("=");
      if (name && value) {
        cookies.set(name, value);
      }
    });
  }
  
  return cookies;
}

/**
 * Set session cookie in response
 */
function setSessionCookie(response: Response, sessionId: string, maxAge = 60 * 60 * 24 * 7): Response {
  const newResponse = new Response(response.body, response);
  
  // Set secure, httpOnly cookie with SameSite=Strict
  newResponse.headers.set(
    "Set-Cookie",
    `session_id=${sessionId}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`
  );
  
  return newResponse;
}

/**
 * Worker entry point that routes incoming requests to the appropriate handler
 */
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);

    // Handle document ingestion endpoint (admin only - should be protected in production)
    if (url.pathname === "/admin/ingest" && request.method === "POST") {
      try {
        const { cv, coverLetter } = await request.json() as { cv: string; coverLetter: string };
        const result = await ingestDocuments(env, cv, coverLetter);
        return Response.json(result);
      } catch (error) {
        return Response.json(
          { success: false, error: error instanceof Error ? error.message : "Unknown error" },
          { status: 500 }
        );
      }
    }

    // Parse cookies to get or create session ID
    const cookies = parseCookies(request);
    let sessionId = cookies.get("session_id");
    const needsNewCookie = !sessionId;
    
    if (!sessionId) {
      sessionId = generateSessionId();
    }

    // If this is an agent request, inject the session ID into the URL
    if (url.pathname.startsWith("/agents/chat") && !url.pathname.includes("/agents/chat/")) {
      // Rewrite /agents/chat to /agents/chat/{sessionId}
      const newUrl = new URL(request.url);
      newUrl.pathname = `/agents/chat/${sessionId}${url.pathname.slice("/agents/chat".length)}`;
      request = new Request(newUrl, request);
    }

    // Try to route to agent
    const agentResponse = await routeAgentRequest(request, env);
    
    if (agentResponse) {
      // Set session cookie if new
      if (needsNewCookie) {
        return setSessionCookie(agentResponse, sessionId);
      }
      
      return agentResponse;
    }

    return new Response("Not found", { status: 404 });
  }
} satisfies ExportedHandler<Env>;
