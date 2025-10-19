import type { UIMessage, UIMessageStreamWriter, ToolSet } from "ai";
import { isToolUIPart } from "ai";

/** Processes tool invocations (currently unused - no tools require human approval) */
export async function processToolCalls<Tools extends ToolSet>({
  messages
}: {
  tools: Tools;
  dataStream: UIMessageStreamWriter;
  messages: UIMessage[];
  executions: Record<string, (args: unknown) => Promise<unknown>>;
}): Promise<UIMessage[]> {
  return messages;
}

/** Cleans up incomplete tool calls and merges consecutive user messages */
export function cleanupMessages(messages: UIMessage[]): UIMessage[] {
  const filtered = messages.filter((message) => {
    if (!message.parts) return true;

    const hasIncompleteToolCall = message.parts.some((part) => {
      if (!isToolUIPart(part)) return false;
      return (
        part.state === "input-streaming" ||
        (part.state === "input-available" && !part.output && !part.errorText)
      );
    });

    return !hasIncompleteToolCall;
  });

  const merged: UIMessage[] = [];
  for (const message of filtered) {
    const lastMessage = merged[merged.length - 1];

    if (lastMessage && lastMessage.role === "user" && message.role === "user") {
      lastMessage.parts = [
        ...(lastMessage.parts || []),
        ...(message.parts || [])
      ];
    } else {
      merged.push(message);
    }
  }

  return merged;
}
