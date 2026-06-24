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
        totalTokens: 100,
        inputTokens: 30,
        outputTokens: 50,
        reasoningOutputTokens: 20,
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

  it("忽略当前未渲染的 notification", () => {
    expect(normalizeAppServerNotification({ method: "unknown", params: {} })).toBeNull();
  });
});
