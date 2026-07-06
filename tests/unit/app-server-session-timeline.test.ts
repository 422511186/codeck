import { describe, expect, it } from "vitest";
import {
  latestSessionContextUsage,
  mergeSessionTimelineItems
} from "../../src/server/app-server/session-timeline";
import type { MobileTimelineItem } from "../../src/shared/codex";

function sessionLine(payload: Record<string, unknown>): string {
  return JSON.stringify({
    type: "response_item",
    payload: {
      ...payload,
      internal_chat_message_metadata_passthrough: { turn_id: "turn-1" }
    }
  });
}

describe("app-server session timeline merge", () => {
  it("reads the latest context usage from session token_count records", () => {
    const jsonl = [
      JSON.stringify({
        timestamp: "2026-07-04T19:00:00.000Z",
        type: "event_msg",
        payload: {
          type: "token_count",
          info: {
            total_token_usage: {
              input_tokens: 1000,
              output_tokens: 200,
              reasoning_output_tokens: 50,
              total_tokens: 1250
            },
            last_token_usage: {
              input_tokens: 900,
              output_tokens: 150,
              reasoning_output_tokens: 25,
              total_tokens: 1075
            },
            model_context_window: 200000
          }
        }
      }),
      JSON.stringify({
        timestamp: "2026-07-04T19:01:00.000Z",
        type: "event_msg",
        payload: {
          type: "token_count",
          info: {
            total_token_usage: {
              input_tokens: 2000,
              output_tokens: 300,
              reasoning_output_tokens: 100,
              total_tokens: 2400
            },
            last_token_usage: {
              input_tokens: 1200,
              output_tokens: 200,
              reasoning_output_tokens: 80,
              total_tokens: 1480
            },
            model_context_window: 258400
          }
        }
      })
    ].join("\n");

    expect(latestSessionContextUsage(jsonl)).toEqual({
      totalTokens: 1480,
      inputTokens: 1200,
      outputTokens: 200,
      reasoningOutputTokens: 80,
      modelContextWindow: 258400,
      updatedAt: Date.parse("2026-07-04T19:01:00.000Z")
    });
  });

  it("places unanchored JSONL tool activity before the final assistant message", () => {
    const baseItems: MobileTimelineItem[] = [
      {
        id: "user-1",
        turnId: "turn-1",
        turnIndex: 0,
        role: "user",
        text: "分析 bug"
      },
      {
        id: "agent-final",
        turnId: "turn-1",
        turnIndex: 0,
        role: "agent",
        text: "结论已经整理好了。"
      }
    ];
    const jsonl = [
      sessionLine({
        type: "function_call",
        id: "tool-read",
        call_id: "call-read",
        name: "exec_command",
        arguments: JSON.stringify({
          cmd: "rg timeline src",
          workdir: "/repo"
        })
      }),
      sessionLine({
        type: "function_call_output",
        call_id: "call-read",
        output: "Chunk ID: read\nProcess exited with code 0\nOutput:\nsrc/web/state/store.ts"
      })
    ].join("\n");

    const merged = mergeSessionTimelineItems(baseItems, jsonl);

    expect(merged.map((item) => item.id)).toEqual(["user-1", "tool-read", "agent-final"]);
    expect(merged[1]).toMatchObject({
      id: "tool-read",
      turnId: "turn-1",
      turnIndex: 0,
      role: "tool",
      toolKind: "command",
      server: "/repo",
      tool: "rg timeline src",
      status: "success"
    });
  });
});
