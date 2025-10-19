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
import { getSystemPrompt } from "./system-prompt";

/** Chat Agent that handles AI chat interactions with automatic cleanup after 7 days of inactivity */
export class Chat extends AIChatAgent<Env> {
  private static readonly INACTIVITY_TIMEOUT_MS = 7 * 24 * 60 * 60 * 1000;

  private async clearMessagesInternal() {
    this.messages.length = 0;
    await this.sql`DELETE FROM cf_ai_chat_agent_messages`;
  }

  async clearConversationHistory() {
    await this.clearMessagesInternal();
    return { success: true, message: "Conversation history cleared" };
  }

  private async extendInactivityTimeout() {
    await this.ctx.storage.setAlarm(Date.now() + Chat.INACTIVITY_TIMEOUT_MS);
  }

  alarm = async () => {
    await this.clearMessagesInternal();
  };
  async onChatMessage(
    onFinish: StreamTextOnFinishCallback<ToolSet>,
    _options?: { abortSignal?: AbortSignal }
  ) {
    await this.extendInactivityTimeout();

    const workersai = createWorkersAI({ binding: this.env.AI });
    // biome-ignore lint/suspicious/noExplicitAny: workers-ai-provider requires type casting for model IDs
    const model = workersai("@cf/google/gemma-3-12b-it" as any);

    const allTools = this.mcp.getAITools();

    const stream = createUIMessageStream({
      execute: async ({ writer }) => {
        const cleanedMessages = cleanupMessages(this.messages);
        const processedMessages = await processToolCalls({
          messages: cleanedMessages,
          dataStream: writer,
          tools: allTools,
          executions: {}
        });

        const systemPrompt = await getSystemPrompt(this.env);
        const modelMessages = convertToModelMessages(processedMessages);

        const result = streamText({
          system: systemPrompt,
          messages: modelMessages,
          model,
          tools: allTools,
          onFinish: async (result) => {
            if (onFinish) {
              // biome-ignore lint/suspicious/noExplicitAny: type mismatch between AI SDK and Agents SDK
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

function generateSessionId(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join(
    ""
  );
}

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

function setSessionCookie(response: Response, sessionId: string): Response {
  const newResponse = new Response(response.body, response);
  const maxAge = 60 * 60 * 24 * 7; // 7 days

  newResponse.headers.set(
    "Set-Cookie",
    `session_id=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`
  );

  return newResponse;
}

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext) {
    const url = new URL(request.url);

    const cookies = parseCookies(request);
    let sessionId = cookies.get("session_id");
    const needsNewCookie = !sessionId;

    if (!sessionId) {
      sessionId = generateSessionId();
    }

    // API: Get current session ID
    if (url.pathname === "/api/session" && request.method === "GET") {
      const response = Response.json({ sessionId });
      return needsNewCookie ? setSessionCookie(response, sessionId) : response;
    }

    // API: Clear conversation history for current session
    if (url.pathname === "/api/clear-history" && request.method === "POST") {
      if (!sessionId) {
        return Response.json(
          { success: false, error: "No session found" },
          { status: 400 }
        );
      }

      try {
        const id = env.Chat.idFromName(sessionId);
        const stub = env.Chat.get(id);
        const result = await stub.clearConversationHistory();
        return Response.json(result);
      } catch (error) {
        return Response.json(
          {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error"
          },
          { status: 500 }
        );
      }
    }

    // API: Download documents (CV/cover letter)
    if (url.pathname.startsWith("/api/download/")) {
      const documentType = url.pathname.split("/api/download/")[1];

      try {
        const fileMap: Record<string, string> = {
          cv: "resume.pdf",
          cover_letter: "cover-letter.pdf"
        };

        const fileName = fileMap[documentType];
        if (!fileName) {
          return new Response("Document type not found", { status: 404 });
        }

        const object = await env.DOCUMENTS.get(fileName);
        if (!object) {
          return new Response("Document not found", { status: 404 });
        }

        const headers = new Headers();
        headers.set("Content-Type", "application/pdf");
        headers.set(
          "Content-Disposition",
          `attachment; filename="${fileName}"`
        );

        return new Response(object.body, { headers });
      } catch (error) {
        console.error("Error fetching document:", error);
        return Response.json(
          {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error"
          },
          { status: 500 }
        );
      }
    }

    // Route agent requests with session ID
    if (
      url.pathname.startsWith("/agents/chat") &&
      !url.pathname.includes("/agents/chat/")
    ) {
      const newUrl = new URL(request.url);
      newUrl.pathname = `/agents/chat/${sessionId}${url.pathname.slice("/agents/chat".length)}`;
      request = new Request(newUrl, request);
    }

    const agentResponse = await routeAgentRequest(request, env);
    if (agentResponse) {
      return needsNewCookie
        ? setSessionCookie(agentResponse, sessionId)
        : agentResponse;
    }

    return new Response("Not found", { status: 404 });
  }
} satisfies ExportedHandler<Env>;
