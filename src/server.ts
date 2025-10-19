import { routeAgentRequest } from "agents";

import { AIChatAgent } from "agents/ai-chat-agent";
import {
  streamText,
  type StreamTextOnFinishCallback,
  createUIMessageStream,
  convertToModelMessages,
  createUIMessageStreamResponse,
  type ToolSet
} from "ai";
import { createWorkersAI } from "workers-ai-provider";
import { processToolCalls, cleanupMessages } from "./utils";
import { tools, executions } from "./tools";
import { getSystemPrompt } from "./system-prompt";

/**
 * Chat Agent implementation that handles real-time AI chat interactions
 */
export class Chat extends AIChatAgent<Env> {
  /**
   * Clear all conversation history
   */
  async clearConversationHistory() {
    // Clear messages by replacing with empty array
    // The AIChatAgent stores messages in memory and manages them internally
    while (this.messages.length > 0) {
      this.messages.pop();
    }
    
    return { success: true, message: "Conversation history cleared" };
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
    const model = workersai("@cf/google/gemma-3-12b-it" as any);
    // const model = workersai("@cf/mistralai/mistral-small-3.1-24b-instruct" as any);

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

        // Extract base URL from request (if available via context)
        // For Durable Objects, we don't have direct request access, so we use empty string
        // The document links will be relative URLs starting with /api/download/
        const baseUrl = '';
        
        // Fetch system prompt from R2 with document links injected
        console.log('[DEBUG] Fetching system prompt from R2...');
        const systemPrompt = await getSystemPrompt(this.env, baseUrl);
        console.log('[DEBUG] System prompt fetched successfully. Length:', systemPrompt.length, 'characters');
        console.log('[DEBUG] System prompt preview (first 200 chars):', systemPrompt.substring(0, 200));
        
        const modelMessages = convertToModelMessages(processedMessages);
        console.log('[DEBUG] Number of messages to send to model:', modelMessages.length);

        console.log('[DEBUG] Starting streamText with model: @cf/mistralai/mistral-small-3.1-24b-instruct');
        const result = streamText({
          system: systemPrompt,
          messages: modelMessages,
          model,
          tools: allTools,
          // Type boundary: streamText expects specific tool types, but base class uses ToolSet
          // This is safe because our tools satisfy ToolSet interface (verified by 'satisfies' in tools.ts)
          onFinish: async (result) => {
            if (onFinish) {
              await (onFinish as any)(result);
            }
          }
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
  
  // Set httpOnly cookie with SameSite=Lax
  // Note: Secure flag is omitted for local development compatibility (Safari)
  // In production, the cookie will be secure automatically via HTTPS
  newResponse.headers.set(
    "Set-Cookie",
    `session_id=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`
  );
  
  return newResponse;
}

/**
 * Worker entry point that routes incoming requests to the appropriate handler
 */
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);

    // Parse cookies to get or create session ID
    const cookies = parseCookies(request);
    let sessionId = cookies.get("session_id");
    const needsNewCookie = !sessionId;
    
    if (!sessionId) {
      sessionId = generateSessionId();
    }

    // Handle session endpoint - returns current session ID
    if (url.pathname === "/api/session" && request.method === "GET") {
      const response = Response.json({ sessionId });
      
      if (needsNewCookie) {
        return setSessionCookie(response, sessionId);
      }
      
      return response;
    }

    // Handle clear history endpoint
    if (url.pathname === "/api/clear-history" && request.method === "POST") {
      if (!sessionId) {
        return Response.json({ success: false, error: "No session found" }, { status: 400 });
      }
      
      try {
        // Get the Durable Object stub for this session
        const id = env.Chat.idFromName(sessionId);
        const stub = env.Chat.get(id);
        
        // Call the clearConversationHistory method
        const result = await stub.clearConversationHistory();
        
        return Response.json(result);
      } catch (error) {
        return Response.json(
          { success: false, error: error instanceof Error ? error.message : "Unknown error" },
          { status: 500 }
        );
      }
    }

    // Handle document download endpoint
    if (url.pathname.startsWith("/api/download/")) {
      const documentType = url.pathname.split("/api/download/")[1];
      
      try {
        let fileName: string;
        if (documentType === "cv") {
          fileName = "resume.pdf";
        } else if (documentType === "cover_letter") {
          fileName = "cover-letter.pdf";
        } else {
          return new Response("Document type not found", { status: 404 });
        }

        const object = await env.DOCUMENTS.get(fileName);
        
        if (!object) {
          return new Response("Document not found", { status: 404 });
        }

        const headers = new Headers();
        headers.set("Content-Type", "application/pdf");
        headers.set("Content-Disposition", `attachment; filename="${fileName}"`);
        
        return new Response(object.body, { headers });
      } catch (error) {
        console.error("Error fetching document:", error);
        return Response.json(
          { success: false, error: error instanceof Error ? error.message : "Unknown error" },
          { status: 500 }
        );
      }
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
