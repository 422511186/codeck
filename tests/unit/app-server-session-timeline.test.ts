import { describe, expect, it } from "vitest";
import {
  latestSessionContextUsageFromLines,
  latestSessionContextUsage,
  mergeSessionTimelineItems,
  scanSessionTimelineSupplement
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
  it("stops scanning rollout records when the line budget is exhausted", () => {
    const outsideLine = JSON.stringify({
      type: "response_item",
      payload: {
        type: "function_call",
        id: "tool-outside",
        call_id: "call-outside",
        name: "exec_command",
        arguments: JSON.stringify({ cmd: "rg outside", workdir: "/repo" }),
        internal_chat_message_metadata_passthrough: { turn_id: "turn-outside" }
      }
    });
    const allowedLine = sessionLine({
      type: "function_call",
      id: "tool-current",
      call_id: "call-current",
      name: "exec_command",
      arguments: JSON.stringify({ cmd: "rg current", workdir: "/repo" })
    });
    let pulledLines = 0;
    const lines = {
      *[Symbol.iterator]() {
        for (const line of [outsideLine, outsideLine, allowedLine]) {
          pulledLines += 1;
          if (pulledLines > 2) {
            throw new Error("scanner read beyond maxScanLines");
          }
          yield line;
        }
      }
    };

    const supplement = scanSessionTimelineSupplement(lines, {
      allowedTurnIds: new Set(["turn-1"]),
      maxScanLines: 2,
      maxSupplementRecords: 1
    });

    expect(supplement.records).toEqual([]);
    expect(supplement.diagnostics).toMatchObject({
      scannedLines: 2,
      budgetExhausted: true
    });
    expect(pulledLines).toBe(2);
  });

  it("reports exhaustion when the matching supplement record budget is consumed", () => {
    const lines = [
      sessionLine({
        type: "function_call",
        id: "tool-first",
        call_id: "call-first",
        name: "exec_command",
        arguments: JSON.stringify({ cmd: "rg first", workdir: "/repo" })
      }),
      sessionLine({
        type: "function_call",
        id: "tool-second",
        call_id: "call-second",
        name: "exec_command",
        arguments: JSON.stringify({ cmd: "rg second", workdir: "/repo" })
      })
    ];

    const supplement = scanSessionTimelineSupplement(lines, {
      allowedTurnIds: new Set(["turn-1"]),
      maxSupplementRecords: 1
    });

    expect(supplement.records).toEqual([
      expect.objectContaining({
        kind: "tool",
        item: expect.objectContaining({ id: "tool-first" })
      })
    ]);
    expect(supplement.diagnostics).toMatchObject({
      scannedLines: 2,
      parsedRecords: 1,
      budgetExhausted: true
    });
  });

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

  it("reads context usage from bounded line input without requiring a full JSONL string", () => {
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
    const latestUsage = JSON.stringify({
      timestamp: "2026-07-04T19:02:00.000Z",
      type: "event_msg",
      payload: {
        type: "token_count",
        info: {
          last_token_usage: {
            input_tokens: 2000,
            output_tokens: 300,
            reasoning_output_tokens: 80,
            total_tokens: 2380
          },
          model_context_window: 258400
        }
      }
    });

    expect(latestSessionContextUsageFromLines([oldUsage, "{}", latestUsage], { maxTailLines: 2 })).toEqual({
      totalTokens: 2380,
      inputTokens: 2000,
      outputTokens: 300,
      reasoningOutputTokens: 80,
      modelContextWindow: 258400,
      updatedAt: Date.parse("2026-07-04T19:02:00.000Z")
    });
  });

  it("recovers a hidden rollout Skill for the preceding user message without retaining its body", () => {
    const skillBody = [
      "<skill>",
      "<name>skill-installer</name>",
      "<path>C:\\Users\\hzy\\.codex\\skills\\.system\\skill-installer\\SKILL.md</path>",
      "---",
      "name: skill-installer",
      "private instructions that must not enter the timeline",
      "</skill>"
    ].join("\n");
    const jsonl = [
      sessionLine({
        type: "message",
        role: "user",
        content: [{ type: "input_text", text: "这个技能是干嘛的呢" }]
      }),
      sessionLine({
        type: "message",
        role: "user",
        content: [{ type: "input_text", text: skillBody }]
      }),
      sessionLine({
        type: "message",
        role: "assistant",
        content: [{ type: "output_text", text: "这是技能安装器。" }]
      })
    ].join("\n");
    const baseItems: MobileTimelineItem[] = [
      { id: "user-1", turnId: "turn-1", role: "user", text: "这个技能是干嘛的呢" },
      { id: "agent-1", turnId: "turn-1", role: "agent", text: "这是技能安装器。" }
    ];

    const supplement = scanSessionTimelineSupplement(jsonl.split("\n"), {
      allowedTurnIds: new Set(["turn-1"])
    });
    const merged = mergeSessionTimelineItems(baseItems, jsonl);

    expect(supplement.records).toContainEqual({
      kind: "skill-reference",
      turnId: "turn-1",
      anchorText: "这个技能是干嘛的呢",
      skillReferences: [
        {
          name: "skill-installer",
          path: "C:\\Users\\hzy\\.codex\\skills\\.system\\skill-installer\\SKILL.md"
        }
      ],
      sequence: 2
    });
    expect(JSON.stringify(supplement.records)).not.toContain("private instructions");
    expect(merged).toHaveLength(2);
    expect(merged[0]).toMatchObject({
      id: "user-1",
      text: "这个技能是干嘛的呢",
      skillReferences: [
        {
          name: "skill-installer",
          path: "C:\\Users\\hzy\\.codex\\skills\\.system\\skill-installer\\SKILL.md"
        }
      ]
    });
  });

  it("recovers and deduplicates multiple hidden rollout Skills in their original order", () => {
    const hiddenSkill = (name: string) => [
      "<skill>",
      `<name>${name}</name>`,
      `<path>C:\\Users\\hzy\\.codex\\skills\\.system\\${name}\\SKILL.md</path>`,
      "---",
      `name: ${name}`,
      "</skill>"
    ].join("\n");
    const jsonl = [
      sessionLine({
        type: "message",
        role: "user",
        content: [{ type: "input_text", text: "他们做什么？" }]
      }),
      sessionLine({
        type: "message",
        role: "user",
        content: [{ type: "input_text", text: hiddenSkill("plugin-creator") }]
      }),
      sessionLine({
        type: "message",
        role: "user",
        content: [{ type: "input_text", text: hiddenSkill("openai-docs") }]
      }),
      sessionLine({
        type: "message",
        role: "user",
        content: [{ type: "input_text", text: hiddenSkill("plugin-creator") }]
      })
    ].join("\n");
    const merged = mergeSessionTimelineItems(
      [{ id: "user-1", turnId: "turn-1", role: "user", text: "他们做什么？" }],
      jsonl
    );

    expect(merged[0]?.skillReferences).toEqual([
      {
        name: "plugin-creator",
        path: "C:\\Users\\hzy\\.codex\\skills\\.system\\plugin-creator\\SKILL.md"
      },
      {
        name: "openai-docs",
        path: "C:\\Users\\hzy\\.codex\\skills\\.system\\openai-docs\\SKILL.md"
      }
    ]);
  });

  it("keeps structured history Skill references authoritative over rollout recovery", () => {
    const jsonl = [
      sessionLine({
        type: "message",
        role: "user",
        content: [{ type: "input_text", text: "介绍技能" }]
      }),
      sessionLine({
        type: "message",
        role: "user",
        content: [{
          type: "input_text",
          text: [
            "<skill>",
            "<name>rollout-skill</name>",
            "<path>C:\\skills\\rollout-skill\\SKILL.md</path>",
            "</skill>"
          ].join("\n")
        }]
      })
    ].join("\n");
    const structured = {
      name: "structured-skill",
      path: "C:\\skills\\structured-skill\\SKILL.md"
    };
    const merged = mergeSessionTimelineItems(
      [{
        id: "user-1",
        turnId: "turn-1",
        role: "user",
        text: "介绍技能",
        skillReferences: [structured]
      }],
      jsonl
    );

    expect(merged[0]?.skillReferences).toEqual([structured]);
  });

  it("rejects incomplete hidden Skill envelopes and ambiguous user anchors", () => {
    const incompleteJsonl = [
      sessionLine({
        type: "message",
        role: "user",
        content: [{ type: "input_text", text: "介绍技能" }]
      }),
      sessionLine({
        type: "message",
        role: "user",
        content: [{
          type: "input_text",
          text: [
            "<skill>",
            "<name>skill-installer</name>",
            "<path>C:\\skills\\skill-installer\\SKILL.md</path>",
            "missing closing tag"
          ].join("\n")
        }]
      })
    ].join("\n");
    const incomplete = mergeSessionTimelineItems(
      [{ id: "user-1", turnId: "turn-1", role: "user", text: "介绍技能" }],
      incompleteJsonl
    );
    const relativePath = mergeSessionTimelineItems(
      [{ id: "user-1", turnId: "turn-1", role: "user", text: "介绍技能" }],
      [
        sessionLine({
          type: "message",
          role: "user",
          content: [{ type: "input_text", text: "介绍技能" }]
        }),
        sessionLine({
          type: "message",
          role: "user",
          content: [{
            type: "input_text",
            text: [
              "<skill>",
              "<name>skill-installer</name>",
              "<path>skills/skill-installer/SKILL.md</path>",
              "</skill>"
            ].join("\n")
          }]
        })
      ].join("\n")
    );
    const ambiguous = mergeSessionTimelineItems(
      [
        { id: "user-1", turnId: "turn-1", role: "user", text: "重复问题" },
        { id: "user-2", turnId: "turn-1", role: "user", text: "重复问题" }
      ],
      [
        sessionLine({
          type: "message",
          role: "user",
          content: [{ type: "input_text", text: "重复问题" }]
        }),
        sessionLine({
          type: "message",
          role: "user",
          content: [{
            type: "input_text",
            text: [
              "<skill>",
              "<name>skill-installer</name>",
              "<path>C:\\skills\\skill-installer\\SKILL.md</path>",
              "</skill>"
            ].join("\n")
          }]
        })
      ].join("\n")
    );

    expect(incomplete[0]?.skillReferences).toBeUndefined();
    expect(relativePath[0]?.skillReferences).toBeUndefined();
    expect(ambiguous.every((item) => item.skillReferences === undefined)).toBe(true);
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

  it("recovers a direct nested exec_command from functions exec", () => {
    const lines = [
      sessionLine({
        type: "custom_tool_call",
        id: "functions-exec-1",
        call_id: "call-functions-exec-1",
        name: "exec",
        status: "completed",
        input: [
          "const result = await tools.exec_command({",
          '  cmd: "sed -n \'1,80p\' src/app.ts",',
          '  workdir: "/repo",',
          "  yield_time_ms: 10000",
          "});",
          "text(result.output);"
        ].join("\n")
      }),
      sessionLine({
        type: "custom_tool_call_output",
        call_id: "call-functions-exec-1",
        output: [
          { type: "input_text", text: "Script completed\nWall time 0.1 seconds\nOutput:\n" },
          { type: "input_text", text: "const app = true;\n" }
        ]
      })
    ];

    const supplement = scanSessionTimelineSupplement(lines, {
      allowedTurnIds: new Set(["turn-1"])
    });

    expect(supplement.records).toEqual([
      expect.objectContaining({
        kind: "tool",
        callId: "call-functions-exec-1",
        item: expect.objectContaining({
          id: "functions-exec-1:nested:0",
          role: "tool",
          toolKind: "command",
          actionKind: "read",
          server: "/repo",
          tool: "sed -n '1,80p' src/app.ts",
          text: "const app = true;\n",
          status: "success"
        })
      })
    ]);
  });

  it("recovers multiple nested commands in order when output parts align", () => {
    const lines = [
      sessionLine({
        type: "custom_tool_call",
        id: "functions-exec-many",
        call_id: "call-functions-exec-many",
        name: "exec",
        status: "completed",
        input: [
          "const results = await Promise.all([",
          '  tools.exec_command({ cmd: "rg timeline src", workdir: "/repo" }),',
          '  tools.exec_command({ cmd: "npm test", workdir: "/repo" })',
          "]);",
          "for (const result of results) text(result.output);"
        ].join("\n")
      }),
      sessionLine({
        type: "custom_tool_call_output",
        call_id: "call-functions-exec-many",
        output: [
          { type: "input_text", text: "Script completed\nWall time 0.3 seconds\nOutput:\n" },
          { type: "input_text", text: "src/web/components/Timeline.tsx\n" },
          { type: "input_text", text: "53 tests passed\n" }
        ]
      })
    ];

    const supplement = scanSessionTimelineSupplement(lines, {
      allowedTurnIds: new Set(["turn-1"])
    });
    const tools = supplement.records
      .filter((record) => record.kind === "tool")
      .map((record) => record.item);

    expect(tools).toEqual([
      expect.objectContaining({
        id: "functions-exec-many:nested:0",
        actionKind: "search",
        tool: "rg timeline src",
        text: "src/web/components/Timeline.tsx\n"
      }),
      expect.objectContaining({
        id: "functions-exec-many:nested:1",
        actionKind: "command",
        tool: "npm test",
        text: "53 tests passed\n"
      })
    ]);
  });

  it("keeps dynamic nested exec arguments as a generic tool without evaluating them", () => {
    const lines = [
      sessionLine({
        type: "custom_tool_call",
        id: "functions-exec-dynamic",
        call_id: "call-functions-exec-dynamic",
        name: "exec",
        status: "completed",
        input: [
          'const command = "npm test";',
          "const result = await tools.exec_command({ cmd: command, workdir: `/repo/${project}` });",
          "text(result.output);"
        ].join("\n")
      })
    ];

    const supplement = scanSessionTimelineSupplement(lines, {
      allowedTurnIds: new Set(["turn-1"])
    });

    expect(supplement.records).toEqual([
      expect.objectContaining({
        kind: "tool",
        item: expect.objectContaining({
          id: "functions-exec-dynamic",
          toolKind: "dynamic",
          tool: "exec"
        })
      })
    ]);
  });

  it("fails closed for unsupported nested exec object syntax", () => {
    const unsafeInputs = [
      'tools.exec_command({ cmd: "npm test", ...dynamic })',
      'tools.exec_command({ cmd: "npm test", ["workdir"]: "/repo" })',
      'tools.exec_command({ cmd: "npm test", workdir })',
      'tools.exec_command({ cmd: "npm test", cmd: "npm run build" })'
    ];

    for (const [index, input] of unsafeInputs.entries()) {
      const supplement = scanSessionTimelineSupplement(
        [
          sessionLine({
            type: "custom_tool_call",
            id: `functions-exec-unsafe-${index}`,
            call_id: `call-functions-exec-unsafe-${index}`,
            name: "exec",
            status: "completed",
            input
          })
        ],
        { allowedTurnIds: new Set(["turn-1"]) }
      );

      expect(supplement.records).toEqual([
        expect.objectContaining({
          kind: "tool",
          item: expect.objectContaining({
            id: `functions-exec-unsafe-${index}`,
            toolKind: "dynamic",
            tool: "exec"
          })
        })
      ]);
    }
  });

  it("把真实 spawn/followup 调用规范化为可聚合的 Subagent 活动", () => {
    const lines = [
      sessionLine({
        type: "function_call",
        id: "spawn-1",
        call_id: "call-spawn-1",
        name: "spawn_agent",
        arguments: JSON.stringify({ task_name: "audit", fork_turns: "all", message: "encrypted" })
      }),
      sessionLine({
        type: "function_call_output",
        call_id: "call-spawn-1",
        output: JSON.stringify({ task_name: "/root/audit" })
      }),
      sessionLine({
        type: "function_call",
        id: "followup-1",
        call_id: "call-followup-1",
        name: "followup_task",
        arguments: JSON.stringify({ target: "audit", message: "encrypted" })
      }),
      sessionLine({
        type: "function_call_output",
        call_id: "call-followup-1",
        output: "{}"
      })
    ];

    const tools = scanSessionTimelineSupplement(lines, {
      allowedTurnIds: new Set(["turn-1"])
    }).records.flatMap((record) => record.kind === "tool" ? [record.item] : []);

    expect(tools).toHaveLength(2);
    expect(tools).toEqual([
      expect.objectContaining({
        id: "spawn-1",
        server: "sub-agent",
        tool: "spawn_agent",
        text: JSON.stringify({
          agentThreadId: "",
          agentPath: "/root/audit",
          kind: "started"
        })
      }),
      expect.objectContaining({
        id: "followup-1",
        server: "sub-agent",
        tool: "followup_task",
        text: JSON.stringify({
          agentThreadId: "",
          agentPath: "/root/audit",
          kind: "updated"
        })
      })
    ]);
    expect(tools.map((item) => item.arguments).join("\n")).not.toContain("encrypted");
  });

  it("外层 exec 未包含可恢复命令时不再重复展示编排工具", () => {
    const lines = [
      sessionLine({
        type: "custom_tool_call",
        id: "functions-browser-only",
        call_id: "call-functions-browser-only",
        name: "exec",
        status: "completed",
        input: "const result = await tools.mcp__node_repl__js({ code: 'inspect' }); text(result);"
      })
    ];

    expect(
      scanSessionTimelineSupplement(lines, { allowedTurnIds: new Set(["turn-1"]) }).records
    ).toEqual([]);
  });

  it("命令正文仅提到 failed 时不误判为执行失败", () => {
    const lines = [
      sessionLine({
        type: "function_call",
        id: "read-status-source",
        call_id: "call-read-status-source",
        name: "exec_command",
        arguments: JSON.stringify({ cmd: "sed -n '1,20p' status.ts", workdir: "/repo" })
      }),
      sessionLine({
        type: "function_call_output",
        call_id: "call-read-status-source",
        output: "const failed = false;\nconst error = undefined;"
      })
    ];

    expect(
      scanSessionTimelineSupplement(lines, { allowedTurnIds: new Set(["turn-1"]) }).records
    ).toEqual([
      expect.objectContaining({
        kind: "tool",
        item: expect.objectContaining({ status: "success" })
      })
    ]);
  });

  it("partial latest page does not consume an earlier identical-metadata command from whole-turn supplement", () => {
    const baseItems: MobileTimelineItem[] = [
      {
        id: "agent-mid",
        turnId: "turn-1",
        role: "agent",
        text: "中途说明"
      },
      {
        id: "cmd-b",
        turnId: "turn-1",
        role: "tool",
        text: "second",
        toolKind: "command",
        server: "/repo",
        tool: "rg timeline src",
        status: "success"
      }
    ];
    const jsonl = [
      sessionLine({
        type: "function_call",
        id: "cmd-a",
        call_id: "call-cmd-a",
        name: "exec_command",
        arguments: JSON.stringify({ cmd: "rg timeline src", workdir: "/repo" })
      }),
      sessionLine({
        type: "message",
        role: "assistant",
        content: [{ type: "output_text", text: "中途说明" }]
      }),
      sessionLine({
        type: "function_call",
        id: "cmd-b",
        call_id: "call-cmd-b",
        name: "exec_command",
        arguments: JSON.stringify({ cmd: "rg timeline src", workdir: "/repo" })
      })
    ].join("\n");

    const merged = mergeSessionTimelineItems(baseItems, jsonl);

    expect(merged.map((item) => item.id)).toEqual(["cmd-a", "agent-mid", "cmd-b"]);
    expect(merged.filter((item) => item.role === "tool").map((item) => item.id)).toEqual([
      "cmd-a",
      "cmd-b"
    ]);
  });

  it("keeps metadata-identical tools distinct unless strong identity or unique anchors match", () => {
    const baseItems: MobileTimelineItem[] = [
      { id: "user-1", turnId: "turn-1", role: "user", text: "运行两次" },
      {
        id: "tool-base",
        turnId: "turn-1",
        role: "tool",
        text: "first",
        toolKind: "command",
        server: "/repo",
        tool: "rg timeline src",
        status: "success"
      },
      { id: "agent-final", turnId: "turn-1", role: "agent", text: "done" }
    ];
    const jsonl = ["tool-rollout-1", "tool-rollout-2"].map((id) => sessionLine({
      type: "function_call",
      id,
      call_id: `call-${id}`,
      name: "exec_command",
      arguments: JSON.stringify({ cmd: "rg timeline src", workdir: "/repo" })
    })).join("\n");

    const merged = mergeSessionTimelineItems(baseItems, jsonl);

    expect(merged.filter((item) => item.role === "tool").map((item) => item.id)).toEqual([
      "tool-base",
      "tool-rollout-1",
      "tool-rollout-2"
    ]);
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

  it("adds UTF-8 truncation metadata and contentRef for long tool output", () => {
    const output = "中文🙂".repeat(30_000);
    const baseItems: MobileTimelineItem[] = [
      {
        id: "agent-final",
        turnId: "turn-1",
        role: "agent",
        text: "完成"
      }
    ];
    const jsonl = [
      sessionLine({
        type: "function_call",
        id: "tool-long",
        call_id: "call-long",
        name: "exec_command",
        arguments: JSON.stringify({ cmd: "generate-long-output", workdir: "/repo" })
      }),
      sessionLine({
        type: "function_call_output",
        call_id: "call-long",
        output
      })
    ].join("\n");

    const merged = mergeSessionTimelineItems(baseItems, jsonl);
    const tool = merged.find((item) => item.id === "tool-long");

    expect(tool).toEqual(
      expect.objectContaining({
        completeness: expect.objectContaining({
          status: "truncated",
          reason: "item-budget",
          originalBytes: Buffer.byteLength(output, "utf8"),
          includedBytes: expect.any(Number),
          contentRef: expect.any(String)
        })
      })
    );
    expect(Buffer.byteLength(tool?.text ?? "", "utf8")).toBeLessThanOrEqual(96 * 1024);
    expect(tool?.text.endsWith("\uFFFD")).toBe(false);
  });
});
