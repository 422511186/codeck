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

  it("can restrict context usage parsing to a bounded tail window", () => {
    const oldUsage = JSON.stringify({
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
          model_context_window: 200000
        }
      }
    });
    const jsonl = [
      oldUsage,
      JSON.stringify({ type: "response_item", payload: { type: "message", text: "tail one" } }),
      JSON.stringify({ type: "response_item", payload: { type: "message", text: "tail two" } })
    ].join("\n");

    expect(latestSessionContextUsage(jsonl, { maxTailLines: 2 })).toBeNull();
    expect(latestSessionContextUsage(jsonl)).toEqual(
      expect.objectContaining({
        totalTokens: 1250
      })
    );
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

  it("only supplements records for the allowed timeline window turns", () => {
    const baseItems: MobileTimelineItem[] = [
      {
        id: "user-1",
        turnId: "turn-1",
        turnIndex: 0,
        role: "user",
        text: "当前窗口"
      },
      {
        id: "agent-1",
        turnId: "turn-1",
        turnIndex: 0,
        role: "agent",
        text: "当前窗口回复"
      },
      {
        id: "user-2",
        turnId: "turn-2",
        turnIndex: 1,
        role: "user",
        text: "窗口外"
      },
      {
        id: "agent-2",
        turnId: "turn-2",
        turnIndex: 1,
        role: "agent",
        text: "窗口外回复"
      }
    ];
    const line = (turnId: string, payload: Record<string, unknown>) =>
      JSON.stringify({
        type: "response_item",
        payload: {
          ...payload,
          internal_chat_message_metadata_passthrough: { turn_id: turnId }
        }
      });
    const jsonl = [
      line("turn-1", {
        type: "function_call",
        id: "tool-current",
        call_id: "call-current",
        name: "exec_command",
        arguments: JSON.stringify({ cmd: "rg current", workdir: "/repo" })
      }),
      line("turn-1", {
        type: "function_call_output",
        call_id: "call-current",
        output: "Process exited with code 0\nOutput:\ncurrent"
      }),
      line("turn-2", {
        type: "function_call",
        id: "tool-outside",
        call_id: "call-outside",
        name: "exec_command",
        arguments: JSON.stringify({ cmd: "rg outside", workdir: "/repo" })
      }),
      line("turn-2", {
        type: "function_call_output",
        call_id: "call-outside",
        output: "Process exited with code 0\nOutput:\noutside"
      })
    ].join("\n");

    const merged = mergeSessionTimelineItems(baseItems, jsonl, { allowedTurnIds: new Set(["turn-1"]) });

    expect(merged.map((item) => item.id)).toContain("tool-current");
    expect(merged.map((item) => item.id)).not.toContain("tool-outside");
  });

  it("does not let outside-window records consume the supplement record budget", () => {
    const baseItems: MobileTimelineItem[] = [
      {
        id: "user-1",
        turnId: "turn-1",
        turnIndex: 0,
        role: "user",
        text: "当前窗口"
      },
      {
        id: "agent-1",
        turnId: "turn-1",
        turnIndex: 0,
        role: "agent",
        text: "当前窗口回复"
      }
    ];
    const line = (turnId: string, payload: Record<string, unknown>) =>
      JSON.stringify({
        type: "response_item",
        payload: {
          ...payload,
          internal_chat_message_metadata_passthrough: { turn_id: turnId }
        }
      });
    const jsonl = [
      line("turn-outside", {
        type: "function_call",
        id: "tool-outside",
        call_id: "call-outside",
        name: "exec_command",
        arguments: JSON.stringify({ cmd: "rg outside", workdir: "/repo" })
      }),
      line("turn-1", {
        type: "function_call",
        id: "tool-current-1",
        call_id: "call-current-1",
        name: "exec_command",
        arguments: JSON.stringify({ cmd: "rg current 1", workdir: "/repo" })
      }),
      line("turn-1", {
        type: "function_call",
        id: "tool-current-2",
        call_id: "call-current-2",
        name: "exec_command",
        arguments: JSON.stringify({ cmd: "rg current 2", workdir: "/repo" })
      })
    ].join("\n");

    const merged = mergeSessionTimelineItems(baseItems, jsonl, {
      allowedTurnIds: new Set(["turn-1"]),
      maxSupplementRecords: 1
    });

    expect(merged.map((item) => item.id)).toContain("tool-current-1");
    expect(merged.map((item) => item.id)).not.toContain("tool-current-2");
    expect(merged.map((item) => item.id)).not.toContain("tool-outside");
  });
});
