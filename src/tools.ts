/**
 * Tool definitions for the AI chat agent
 * Tools execute automatically to provide information about Jules
 */
import { type ToolSet } from "ai";

/**
 * Export all available tools
 * These will be provided to the AI model to describe available capabilities
 * 
 * Note: Document links (CV/resume, cover letter) are now embedded directly
 * in the system prompt rather than using tool calls for simplicity and reliability.
 */
export const tools = {
  // No tools currently - document links are in system prompt
} satisfies ToolSet;

/**
 * Implementation of confirmation-required tools
 * This object contains the actual logic for tools that need human approval
 * Each function here corresponds to a tool above that doesn't have an execute function
 */
export const executions = {
  // All tools auto-execute for now
};
