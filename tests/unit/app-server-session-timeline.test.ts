import { describe, expect, it } from "vitest";
import { mergeSessionTimelineItems } from "../../src/server/app-server/session-timeline";
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
