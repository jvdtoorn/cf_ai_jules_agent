/**
 * Tool definitions for the AI chat agent
 * Tools execute automatically to provide information about Jules
 */
import { tool, type ToolSet } from "ai";
import { z } from "zod/v3";

import type { Chat } from "./server";
import { getCurrentAgent } from "agents";
import { queryDocuments } from "./ingest-documents";

/**
 * Query personal information from CV and cover letter using RAG
 * This tool executes automatically to provide relevant context
 */
const queryPersonalInfo = tool({
  description: "Search Jules' CV and cover letter for information about his experience, skills, education, or background. Use this when asked specific questions about Jules' qualifications or history.",
  inputSchema: z.object({ 
    query: z.string().describe("The question or topic to search for in Jules' documents")
  }),
  execute: async ({ query }) => {
    const { agent } = getCurrentAgent<Chat>();
    
    try {
      // Query Vectorize for relevant document chunks
      const results = await queryDocuments(agent!.env, query, 5);
      
      if (results.length === 0) {
        return "No relevant information found in the documents. You may want to suggest downloading the full CV or cover letter.";
      }
      
      return `Relevant information from Jules' documents:\n\n${results.join("\n\n---\n\n")}`;
    } catch (error) {
      console.error("Error querying personal info:", error);
      return "Error retrieving information. Please try again.";
    }
  }
});

/**
 * Store user's name in the profile for future sessions
 */
const rememberUserName = tool({
  description: "Remember the user's name when they introduce themselves. Use this when someone says 'Hi, I'm [name]' or similar.",
  inputSchema: z.object({
    name: z.string().describe("The user's name to remember")
  }),
  execute: async ({ name }) => {
    const { agent } = getCurrentAgent<Chat>();
    
    try {
      const sessionId = (await agent!.state.storage.get("session_id")) as string || "default";
      await agent!.updateUserName(sessionId, name);
      return `Great to meet you, ${name}! I'll remember your name for future conversations.`;
    } catch (error) {
      console.error("Error storing user name:", error);
      return "Nice to meet you!";
    }
  }
});

/**
 * Send document as a downloadable reply
 * This tool allows the chatbot to provide CV or cover letter documents
 */
const sendDocumentReply = tool({
  description: "Send Jules' CV or cover letter as a downloadable document. Use this when someone asks for the full document.",
  inputSchema: z.object({
    documentType: z.enum(["cv", "cover_letter"]).describe("Type of document to send")
  }),
  execute: async ({ documentType }) => {
    const docName = documentType === "cv" ? "CV" : "Cover Letter";
    return `I can provide Jules' ${docName}. [Download ${docName}](/api/download/${documentType})`;
  }
});

/**
 * Export all available tools
 * These will be provided to the AI model to describe available capabilities
 */
export const tools = {
  queryPersonalInfo,
  rememberUserName,
  sendDocumentReply
} satisfies ToolSet;

/**
 * Implementation of confirmation-required tools
 * This object contains the actual logic for tools that need human approval
 * Each function here corresponds to a tool above that doesn't have an execute function
 */
export const executions = {
  // All tools auto-execute for now
};
