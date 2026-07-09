import { describe, expect, it } from "vitest";
import { normalizeAppServerNotification } from "../../src/server/app-server/events";

describe("normalizeAppServerNotification", () => {
  it("把 agent message delta 映射为浏览器 timeline 事件", () => {
    expect(
      normalizeAppServerNotification({
        method: "item/agentMessage/delta",
        params: {
          threadId: "thread-1",
          turnId: "turn-1",
          itemId: "item-1",
          delta: "正在分析"
        }
      })
    ).toEqual({
      type: "codex-event",
      event: {
        kind: "agent_message_delta",
        threadId: "thread-1",
        turnId: "turn-1",
        itemId: "item-1",
        delta: "正在分析"
      }
    });
  });

  it("把 turn 生命周期 notification 映射为浏览器运行态事件", () => {
    const turn = {
      id: "turn-1",
      items: [],
      itemsView: "full",
      status: "inProgress",
      error: null,
      startedAt: 1,
      completedAt: null,
      durationMs: null
    };

    expect(
      normalizeAppServerNotification({
        method: "turn/started",
        params: {
          threadId: "thread-1",
          turn
        }
      })
    ).toEqual({
      type: "codex-event",
      event: {
        kind: "turn_started",
        threadId: "thread-1",
        turnId: "turn-1"
      }
    });

    expect(
      normalizeAppServerNotification({
        method: "turn/completed",
        params: {
          threadId: "thread-1",
          turn: { ...turn, status: "completed", completedAt: 2, durationMs: 1000 }
        }
      })
    ).toEqual({
      type: "codex-event",
      event: {
        kind: "turn_completed",
        threadId: "thread-1",
        turnId: "turn-1",
        status: "completed"
      }
    });
  });

  it.each(["active", "idle", "notLoaded", "systemError"])(
    "把 thread/status/changed %s 映射为线程状态事件",
    (status) => {
      expect(
        normalizeAppServerNotification({
          method: "thread/status/changed",
          params: {
            threadId: "thread-1",
            status: status === "active" ? { type: status, activeFlags: [] } : { type: status }
          }
        })
      ).toEqual({
        type: "codex-event",
        event: {
          kind: "thread_status_changed",
          threadId: "thread-1",
          status,
          ...(status === "active" ? { activeFlags: [] } : {})
        }
      });
    }
  );

  it("把 turn diff 更新映射为浏览器 diff 事件", () => {
    expect(
      normalizeAppServerNotification({
        method: "turn/diff/updated",
        params: {
          threadId: "thread-1",
          turnId: "turn-1",
          diff: "diff --git a/a.ts b/a.ts"
        }
      })
    ).toEqual({
      type: "codex-event",
      event: {
        kind: "turn_diff_updated",
        threadId: "thread-1",
        turnId: "turn-1",
        diff: "diff --git a/a.ts b/a.ts"
      }
    });
  });

  it("把 turn plan 更新映射为前端计划状态事件", () => {
    expect(
      normalizeAppServerNotification({
        method: "turn/plan/updated",
        params: {
          threadId: "thread-1",
          turnId: "turn-1",
          explanation: null,
          plan: [
            { step: "检查事件", status: "completed" },
            { step: "修复渲染", status: "inProgress" }
          ]
        }
      })
    ).toEqual({
      type: "codex-event",
      event: {
        kind: "plan.delta",
        threadId: "thread-1",
        turnId: "turn-1",
        plan: [
          { text: "检查事件", completed: true },
          { text: "修复渲染", completed: false }
        ]
      }
    });
  });

  it("把 hook started/completed 映射为可见工具事件", () => {
    expect(
      normalizeAppServerNotification({
        method: "hook/started",
        params: {
          threadId: "thread-1",
          turnId: "turn-1",
          run: {
            id: "hook-1",
            eventName: "after-edit",
            status: "running",
            statusMessage: "正在运行 hook",
            entries: []
          }
        }
      })
    ).toEqual({
      type: "codex-event",
      event: {
        kind: "item_updated",
        threadId: "thread-1",
        turnId: "turn-1",
        completedAtMs: expect.any(Number),
        item: {
          id: "hook-1",
          role: "tool",
          text: "正在运行 hook",
          toolKind: "system",
          server: "hook",
          tool: "after-edit",
          status: "running"
        }
      }
    });
  });

  it("把 file change output delta 映射为浏览器 timeline 事件", () => {
    expect(
      normalizeAppServerNotification({
        method: "item/fileChange/outputDelta",
        params: {
          threadId: "thread-1",
          turnId: "turn-1",
          itemId: "file-1",
          delta: "写入 src/app.ts"
        }
      })
    ).toEqual({
      type: "codex-event",
      event: {
        kind: "file_output_delta",
        threadId: "thread-1",
        turnId: "turn-1",
        itemId: "file-1",
        delta: "写入 src/app.ts"
      }
    });
  });

  it("把 command/process base64 output delta 映射为浏览器 timeline 事件", () => {
    expect(
      normalizeAppServerNotification({
        method: "command/exec/outputDelta",
        params: {
          threadId: "thread-1",
          turnId: "turn-1",
          processId: "cmd-1",
          stream: "stdout",
          deltaBase64: Buffer.from("命令输出\n", "utf8").toString("base64"),
          capReached: false
        }
      })
    ).toEqual({
      type: "codex-event",
      event: {
        kind: "command_output_delta",
        threadId: "thread-1",
        turnId: "turn-1",
        itemId: "cmd-1",
        delta: "命令输出\n"
      }
    });

    expect(
      normalizeAppServerNotification({
        method: "process/outputDelta",
        params: {
          threadId: "thread-1",
          turnId: "turn-1",
          processHandle: "proc-1",
          stream: "stderr",
          deltaBase64: Buffer.from("进程输出\n", "utf8").toString("base64"),
          capReached: false
        }
      })
    ).toEqual({
      type: "codex-event",
      event: {
        kind: "command_output_delta",
        threadId: "thread-1",
        turnId: "turn-1",
        itemId: "proc-1",
        delta: "进程输出\n"
      }
    });
  });

  it("把 command terminal interaction 映射为命令输出", () => {
    expect(
      normalizeAppServerNotification({
        method: "item/commandExecution/terminalInteraction",
        params: {
          threadId: "thread-1",
          turnId: "turn-1",
          itemId: "cmd-1",
          processId: "proc-1",
          stdin: "y\n"
        }
      })
    ).toEqual({
      type: "codex-event",
      event: {
        kind: "command_output_delta",
        threadId: "thread-1",
        turnId: "turn-1",
        itemId: "cmd-1",
        delta: "\n$ y\n"
      }
    });
  });

  it("忽略没有会话上下文的 command/process output delta", () => {
    expect(
      normalizeAppServerNotification({
        method: "command/exec/outputDelta",
        params: {
          processId: "cmd-1",
          stream: "stdout",
          deltaBase64: Buffer.from("终端输出\n", "utf8").toString("base64"),
          capReached: false
        }
      })
    ).toBeNull();
  });

  it("把 reasoning summary part 事件映射为运行态占位", () => {
    expect(
      normalizeAppServerNotification({
        method: "item/reasoning/summaryPartAdded",
        params: {
          threadId: "thread-1",
          turnId: "turn-1",
          itemId: "reasoning-1",
          summaryIndex: 0
        }
      })
    ).toEqual({
      type: "codex-event",
      event: {
        kind: "reasoning_started",
        threadId: "thread-1",
        turnId: "turn-1",
        itemId: "reasoning-1"
      }
    });

    expect(
      normalizeAppServerNotification({
        method: "item/reasoning/summaryTextDelta",
        params: {
          threadId: "thread-1",
          turnId: "turn-1",
          itemId: "reasoning-1",
          summaryIndex: 0,
          delta: "推理摘要"
        }
      })
    ).toEqual({
      type: "codex-event",
      event: {
        kind: "reasoning_delta",
        threadId: "thread-1",
        turnId: "turn-1",
        itemId: "reasoning-1",
        delta: "推理摘要"
      }
    });
  });

  it("把 MCP 工具进度映射为类型保真的可见工具输出", () => {
    expect(
      normalizeAppServerNotification({
        method: "item/mcpToolCall/progress",
        params: {
          threadId: "thread-1",
          turnId: "turn-1",
          itemId: "mcp-1",
          message: "正在读取文件"
        }
      })
    ).toEqual({
      type: "codex-event",
      event: {
        kind: "tool_output_delta",
        threadId: "thread-1",
        turnId: "turn-1",
        itemId: "mcp-1",
        delta: "正在读取文件",
        server: "mcp",
        tool: "progress",
        toolKind: "mcp"
      }
    });
  });

  it("把 raw response reasoning 完成项映射为完整 timeline item 更新", () => {
    const event = normalizeAppServerNotification({
      method: "rawResponseItem/completed",
      params: {
        threadId: "thread-1",
        turnId: "turn-1",
        item: {
          type: "reasoning",
          id: "reasoning-1",
          summary: [{ type: "summary_text", text: "分析路径" }],
          content: [{ type: "text", text: "检查 UI" }],
          encrypted_content: null,
          metadata: { turn_id: "turn-1" }
        }
      }
    });

    expect(event).toMatchObject({
      type: "codex-event",
      event: {
        kind: "item_updated",
        threadId: "thread-1",
        turnId: "turn-1",
        item: {
          id: "reasoning-1",
          role: "reasoning",
          text: "分析路径\n检查 UI",
          done: true
        }
      }
    });
  });

  it("把 raw response message/agent_message 完成项映射为可读 agent 回复", () => {
    expect(
      normalizeAppServerNotification({
        method: "rawResponseItem/completed",
        params: {
          threadId: "thread-1",
          turnId: "turn-1",
          item: {
            type: "message",
            id: "msg-1",
            role: "assistant",
            content: [
              { type: "output_text", text: "第一段" },
              { type: "text", text: "第二段" }
            ],
            metadata: { turn_id: "turn-1" }
          }
        }
      })
    ).toMatchObject({
      type: "codex-event",
      event: {
        kind: "item_updated",
        threadId: "thread-1",
        turnId: "turn-1",
        item: {
          id: "msg-1",
          role: "agent",
          text: "第一段\n第二段"
        }
      }
    });

    expect(
      normalizeAppServerNotification({
        method: "rawResponseItem/completed",
        params: {
          threadId: "thread-1",
          turnId: "turn-1",
          item: {
            type: "agent_message",
            id: "agent-raw-1",
            text: "最终回答",
            metadata: { turn_id: "turn-1" }
          }
        }
      })
    ).toMatchObject({
      type: "codex-event",
      event: {
        kind: "item_updated",
        item: {
          id: "agent-raw-1",
          role: "agent",
          text: "最终回答"
        }
      }
    });
  });

  it("把未知 raw response 完成项映射为可见运行活动 fallback", () => {
    expect(
      normalizeAppServerNotification({
        method: "rawResponseItem/completed",
        params: {
          threadId: "thread-1",
          turnId: "turn-1",
          item: {
            id: "future-raw-1",
            type: "future_tool_call",
            name: "future_lookup",
            status: "completed",
            payload: { value: "visible" }
          }
        }
      })
    ).toMatchObject({
      type: "codex-event",
      event: {
        kind: "item_updated",
        threadId: "thread-1",
        turnId: "turn-1",
        item: {
          id: "future-raw-1",
          role: "tool",
          toolKind: "dynamic",
          server: "raw",
          tool: "future_lookup",
          status: "success",
          text: expect.stringContaining("future_tool_call")
        }
      }
    });
  });

  it("把 item/completed 映射为完整 timeline item 更新", () => {
    expect(
      normalizeAppServerNotification({
        method: "item/completed",
        params: {
          threadId: "thread-1",
          turnId: "turn-1",
          completedAtMs: 1234,
          item: {
            type: "agentMessage",
            id: "agent-1",
            text: "完整回复",
            phase: "final",
            memoryCitation: null
          }
        }
      })
    ).toEqual({
      type: "codex-event",
      event: {
        kind: "item_updated",
        threadId: "thread-1",
        turnId: "turn-1",
        completedAtMs: 1234,
        item: { id: "agent-1", role: "agent", text: "完整回复" }
      }
    });
  });

  it("把 token usage 更新映射为浏览器 token 事件", () => {
    expect(
      normalizeAppServerNotification({
        method: "thread/tokenUsage/updated",
        params: {
          threadId: "thread-1",
          turnId: "turn-1",
          tokenUsage: {
            total: {
              totalTokens: 100,
              inputTokens: 30,
              cachedInputTokens: 10,
              outputTokens: 50,
              reasoningOutputTokens: 20
            },
            last: {
              totalTokens: 40,
              inputTokens: 15,
              cachedInputTokens: 5,
              outputTokens: 20,
              reasoningOutputTokens: 5
            },
            modelContextWindow: 200000
          }
        }
      })
    ).toEqual({
      type: "codex-event",
      event: {
        kind: "token_usage_updated",
        threadId: "thread-1",
        turnId: "turn-1",
        totalTokens: 40,
        inputTokens: 15,
        outputTokens: 20,
        reasoningOutputTokens: 5,
        modelContextWindow: 200000
      }
    });
  });

  it("把线程 warning 映射为浏览器警告事件", () => {
    expect(
      normalizeAppServerNotification({
        method: "warning",
        params: {
          threadId: "thread-1",
          message: "模型额度即将耗尽"
        }
      })
    ).toEqual({
      type: "codex-event",
      event: {
        kind: "warning",
        threadId: "thread-1",
        message: "模型额度即将耗尽"
      }
    });
  });

  it("把 turn error notification 映射为浏览器错误事件", () => {
    expect(
      normalizeAppServerNotification({
        method: "error",
        params: {
          threadId: "thread-1",
          turnId: "turn-1",
          willRetry: false,
          error: {
            message: "API 调用失败",
            codexErrorInfo: null,
            additionalDetails: "502 Bad Gateway"
          }
        }
      })
    ).toEqual({
      type: "codex-event",
      event: {
        kind: "turn_error",
        threadId: "thread-1",
        turnId: "turn-1",
        message: "API 调用失败：502 Bad Gateway",
        willRetry: false
      }
    });
  });

  it("把 config warning 映射为全局警告事件", () => {
    expect(
      normalizeAppServerNotification({
        method: "configWarning",
        params: {
          summary: "配置有误",
          details: "请检查 config.toml",
          path: "C:\\Users\\huang\\.codex\\config.toml"
        }
      })
    ).toEqual({
      type: "codex-event",
      event: {
        kind: "warning",
        threadId: null,
        message: "配置有误：请检查 config.toml"
      }
    });
  });

  it("把集成状态变化映射为设置刷新事件", () => {
    for (const method of [
      "account/updated",
      "account/rateLimits/updated",
      "mcpServer/startupStatus/updated",
      "remoteControl/status/changed"
    ]) {
      expect(normalizeAppServerNotification({ method, params: {} })).toEqual({
        type: "codex-event",
        event: { kind: "settings_invalidated" }
      });
    }
  });

  it("把 Skills 变更通知映射为无归属缓存失效事件", () => {
    expect(normalizeAppServerNotification({ method: "skills/changed", params: {} })).toEqual({
      type: "codex-event",
      event: { kind: "skills_changed" }
    });
  });

  it("即使 Skills 变更通知携带额外字段也只作为缓存失效事件", () => {
    expect(
      normalizeAppServerNotification({
        method: "skills/changed",
        params: {
          threadId: "thread-1",
          turnId: "turn-1",
          skills: [{ name: "openspec-explore" }, "systematic-debugging"]
        }
      })
    ).toEqual({
      type: "codex-event",
      event: { kind: "skills_changed" }
    });
  });

  it("把会话设置更新映射为浏览器会话设置事件", () => {
    expect(
      normalizeAppServerNotification({
        method: "thread/settings/updated",
        params: {
          threadId: "thread-1",
          threadSettings: {
            cwd: "C:\\repo",
            approvalPolicy: "on-request",
            approvalsReviewer: "user",
            sandboxPolicy: { mode: "workspace-write" },
            activePermissionProfile: { id: "read-only", extends: null },
            model: "gpt-5-codex",
            modelProvider: "custom",
            serviceTier: null,
            effort: "high",
            summary: null,
            collaborationMode: {
              mode: "plan",
              settings: {
                model: "gpt-5-codex",
                reasoning_effort: "high",
                developer_instructions: null
              }
            },
            personality: null
          }
        }
      })
    ).toEqual({
      type: "codex-event",
      event: {
        kind: "thread_settings_updated",
        threadId: "thread-1",
        model: "gpt-5-codex",
        reasoningEffort: "high",
        approvalsReviewer: "user",
        activePermissionProfile: { id: "read-only", extends: null },
        collaborationMode: "plan"
      }
    });
  });

  it("把会话目标更新和清除映射为浏览器事件", () => {
    expect(
      normalizeAppServerNotification({
        method: "thread/goal/updated",
        params: {
          threadId: "thread-1",
          turnId: null,
          goal: {
            threadId: "thread-1",
            objective: "完整目标",
            status: "active",
            tokenBudget: 9000,
            tokensUsed: 1,
            timeUsedSeconds: 2,
            createdAt: 3,
            updatedAt: 4
          }
        }
      })
    ).toEqual({
      type: "codex-event",
      event: {
        kind: "thread_goal_updated",
        threadId: "thread-1",
        goal: {
          threadId: "thread-1",
          objective: "完整目标",
          status: "active",
          tokenBudget: 9000,
          tokensUsed: 1,
          timeUsedSeconds: 2,
          createdAt: 3,
          updatedAt: 4
        }
      }
    });

    expect(
      normalizeAppServerNotification({
        method: "thread/goal/cleared",
        params: { threadId: "thread-1" }
      })
    ).toEqual({
      type: "codex-event",
      event: { kind: "thread_goal_cleared", threadId: "thread-1" }
    });
  });

  it("把上下文压缩完成映射为浏览器事件", () => {
    expect(
      normalizeAppServerNotification({
        method: "thread/compacted",
        params: { threadId: "thread-1", turnId: "turn-1" }
      })
    ).toEqual({
      type: "codex-event",
      event: { kind: "context_compacted", threadId: "thread-1", turnId: "turn-1" }
    });
  });

  it("把文件监听变更映射为浏览器事件", () => {
    expect(
      normalizeAppServerNotification({
        method: "fs/changed",
        params: {
          watchId: "watch-1",
          changedPaths: ["C:\\repo\\README.md", "C:\\repo\\src"]
        }
      })
    ).toEqual({
      type: "codex-event",
      event: {
        kind: "fs_changed",
        watchId: "watch-1",
        paths: ["C:\\repo\\README.md", "C:\\repo\\src"]
      }
    });
  });

  it("把会话式文件搜索结果映射为浏览器事件", () => {
    expect(
      normalizeAppServerNotification({
        method: "fuzzyFileSearch/sessionUpdated",
        params: {
          sessionId: "search-1",
          query: "app",
          files: [
            {
              root: "C:\\repo",
              path: "src\\app.ts",
              match_type: "file",
              file_name: "app.ts",
              score: 99,
              indices: [0, 1, 2]
            }
          ]
        }
      })
    ).toEqual({
      type: "codex-event",
      event: {
        kind: "file_search_session_updated",
        sessionId: "search-1",
        query: "app",
        results: [
          {
            root: "C:\\repo",
            path: "src\\app.ts",
            fullPath: "C:\\repo\\src\\app.ts",
            fileName: "app.ts",
            matchType: "file",
            score: 99,
            indices: [0, 1, 2]
          }
        ]
      }
    });

    expect(
      normalizeAppServerNotification({
        method: "fuzzyFileSearch/sessionCompleted",
        params: { sessionId: "search-1" }
      })
    ).toEqual({
      type: "codex-event",
      event: { kind: "file_search_session_completed", sessionId: "search-1" }
    });
  });

  it("把 realtime notification 映射为浏览器事件", () => {
    expect(
      normalizeAppServerNotification({
        method: "thread/realtime/started",
        params: { threadId: "thread-1", realtimeSessionId: "rt-1", version: "v2" }
      })
    ).toEqual({
      type: "codex-event",
      event: { kind: "realtime_started", threadId: "thread-1", realtimeSessionId: "rt-1", version: "v2" }
    });

    expect(
      normalizeAppServerNotification({
        method: "thread/realtime/transcript/delta",
        params: { threadId: "thread-1", role: "user", delta: "你" }
      })
    ).toEqual({
      type: "codex-event",
      event: { kind: "realtime_transcript_delta", threadId: "thread-1", role: "user", delta: "你" }
    });

    expect(
      normalizeAppServerNotification({
        method: "thread/realtime/outputAudio/delta",
        params: {
          threadId: "thread-1",
          audio: { data: "AAAA", sampleRate: 24000, numChannels: 1, samplesPerChannel: null, itemId: null }
        }
      })
    ).toEqual({
      type: "codex-event",
      event: {
        kind: "realtime_output_audio_delta",
        threadId: "thread-1",
        audio: { data: "AAAA", sampleRate: 24000, numChannels: 1, samplesPerChannel: null, itemId: null }
      }
    });
  });

  it("把 external agent config 导入完成 notification 映射为浏览器事件", () => {
    expect(
      normalizeAppServerNotification({
        method: "externalAgentConfig/import/completed",
        params: {
          importId: "import-1",
          itemTypeResults: [
            {
              itemType: "AGENTS_MD",
              successes: [{ itemType: "AGENTS_MD", cwd: "C:\\repo", source: "AGENTS.md", target: ".codex/AGENTS.md" }],
              failures: []
            }
          ]
        }
      })
    ).toEqual({
      type: "codex-event",
      event: {
        kind: "external_agent_config_import_completed",
        importId: "import-1",
        itemTypeResults: [
          {
            itemType: "AGENTS_MD",
            successes: [{ itemType: "AGENTS_MD", cwd: "C:\\repo", source: "AGENTS.md", target: ".codex/AGENTS.md" }],
            failures: []
          }
        ]
      }
    });
  });

  it("把 serverRequest/resolved notification 映射为 resolved 事件", () => {
    expect(
      normalizeAppServerNotification({
        method: "serverRequest/resolved",
        params: { requestId: 22 }
      })
    ).toEqual({ type: "server-request-resolved", requestId: "22" });
  });

  it("忽略当前未渲染的 notification", () => {
    expect(normalizeAppServerNotification({ method: "unknown", params: {} })).toBeNull();
  });
});
