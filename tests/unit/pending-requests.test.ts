import { describe, expect, it } from "vitest";
import {
  buildPendingServerRequestResponse,
  normalizePendingServerRequest
} from "../../src/server/app-server/pending-requests";

describe("normalizePendingServerRequest", () => {
  it("把命令审批 request 转成移动端 pending 视图", () => {
    expect(
      normalizePendingServerRequest({
        id: 7,
        method: "item/commandExecution/requestApproval",
        params: {
          threadId: "thread-1",
          turnId: "turn-1",
          itemId: "item-1",
          startedAtMs: 1,
          command: "npm install",
          cwd: "C:/repo",
          reason: "需要安装依赖",
          availableDecisions: ["accept", "decline"]
        }
      })
    ).toMatchObject({
      requestId: 7,
      kind: "command_approval",
      method: "item/commandExecution/requestApproval",
      threadId: "thread-1",
      turnId: "turn-1",
      itemId: "item-1",
      title: "命令审批",
      description: "npm install",
      options: [
        { value: "accept", label: "允许" },
        { value: "decline", label: "拒绝" }
      ]
    });
  });

  it("把文件变更审批 request 转成移动端 pending 视图", () => {
    expect(
      normalizePendingServerRequest({
        id: 8,
        method: "item/fileChange/requestApproval",
        params: {
          threadId: "thread-1",
          turnId: "turn-1",
          itemId: "item-2",
          startedAtMs: 1,
          reason: "需要写入文件",
          grantRoot: "C:/repo"
        }
      })
    ).toMatchObject({
      requestId: 8,
      kind: "file_approval",
      title: "文件变更审批",
      description: "需要写入文件",
      options: [
        { value: "accept", label: "允许" },
        { value: "decline", label: "拒绝" }
      ]
    });
  });

  it("把 question request 转成移动端 pending 视图", () => {
    expect(
      normalizePendingServerRequest({
        id: 9,
        method: "item/tool/requestUserInput",
        params: {
          threadId: "thread-1",
          turnId: "turn-1",
          itemId: "item-3",
          questions: [
            {
              id: "choice",
              header: "模式",
              question: "请选择模式",
              isOther: false,
              isSecret: false,
              options: [{ id: "fast", label: "快速", description: "更快完成" }]
            }
          ],
          autoResolutionMs: null
        }
      })
    ).toMatchObject({
      requestId: 9,
      kind: "question",
      title: "需要你回答",
      description: "请选择模式",
      options: [{ value: "fast", label: "快速", description: "更快完成" }]
    });
  });

  it("question options 优先使用 id 作为 value，缺少 id 时回退到 label，并保留描述", () => {
    const request = normalizePendingServerRequest({
      id: 15,
      method: "item/tool/requestUserInput",
      params: {
        threadId: "thread-1",
        turnId: "turn-1",
        itemId: "item-3",
        questions: [
          {
            id: "mode",
            header: "模式",
            question: "请选择模式",
            isOther: false,
            isSecret: false,
            options: [
              { id: "fast", label: "快速", description: "更快完成" },
              { label: "稳妥", description: "多做验证" }
            ]
          }
        ],
        autoResolutionMs: null
      }
    });

    expect(request.options).toEqual([
      { value: "fast", label: "快速", description: "更快完成" },
      { value: "稳妥", label: "稳妥", description: "多做验证" }
    ]);
  });

  it("为文件审批构造 JSON-RPC response", () => {
    const request = normalizePendingServerRequest({
      id: 10,
      method: "item/fileChange/requestApproval",
      params: { threadId: "thread-1", turnId: "turn-1", itemId: "item-1", startedAtMs: 1 }
    });

    expect(buildPendingServerRequestResponse(request, "accept")).toEqual({ decision: "accept" });
  });

  it("为权限审批构造 JSON-RPC response", () => {
    const request = normalizePendingServerRequest({
      id: 11,
      method: "item/permissions/requestApproval",
      params: {
        threadId: "thread-1",
        turnId: "turn-1",
        itemId: "item-1",
        environmentId: null,
        startedAtMs: 1,
        cwd: "C:/repo",
        reason: "需要网络",
        permissions: { network: { mode: "allowAll" }, fileSystem: null }
      }
    });

    expect(buildPendingServerRequestResponse(request, "accept")).toEqual({
      permissions: { network: { mode: "allowAll" }, fileSystem: null },
      scope: "session"
    });
    expect(buildPendingServerRequestResponse(request, "decline")).toEqual({
      permissions: {},
      scope: "turn"
    });
  });

  it("为 question 构造 JSON-RPC response", () => {
    const request = normalizePendingServerRequest({
      id: 12,
      method: "item/tool/requestUserInput",
      params: {
        threadId: "thread-1",
        turnId: "turn-1",
        itemId: "item-1",
        questions: [
          {
            id: "mode",
            header: "模式",
            question: "请选择模式",
            isOther: false,
            isSecret: false,
            options: [{ label: "快速", description: "更快完成" }]
          }
        ],
        autoResolutionMs: null
      }
    });

    expect(buildPendingServerRequestResponse(request, "快速")).toEqual({
      answers: { mode: { answers: ["快速"] } }
    });
    expect(buildPendingServerRequestResponse(request, "快速")).not.toHaveProperty("decision");
  });

  it("question 缺少 id 时不构造空 answers response", () => {
    const request = normalizePendingServerRequest({
      id: 16,
      method: "item/tool/requestUserInput",
      params: {
        threadId: "thread-1",
        turnId: "turn-1",
        itemId: "item-1",
        questions: [
          {
            header: "模式",
            question: "请选择模式",
            isOther: false,
            isSecret: false,
            options: [{ id: "fast", label: "快速", description: "更快完成" }]
          }
        ],
        autoResolutionMs: null
      }
    });

    expect(() => buildPendingServerRequestResponse(request, "fast")).toThrow("question 缺少 id");
  });

  it("为 MCP elicitation 构造 JSON-RPC response", () => {
    const request = normalizePendingServerRequest({
      id: 13,
      method: "mcpServer/elicitation/request",
      params: {
        threadId: "thread-1",
        turnId: "turn-1",
        serverName: "demo",
        mode: "url",
        _meta: null,
        message: "请确认外部授权",
        url: "https://example.com",
        elicitationId: "elicit-1"
      }
    });

    expect(buildPendingServerRequestResponse(request, "accept")).toEqual({
      action: "accept",
      content: {},
      _meta: null
    });
    expect(buildPendingServerRequestResponse(request, "decline")).toEqual({
      action: "decline",
      content: null,
      _meta: null
    });
  });

  it("把动态工具调用 request 转成可回传的 DynamicToolCallResponse", () => {
    const request = normalizePendingServerRequest({
      id: 14,
      method: "item/tool/call",
      params: {
        threadId: "thread-1",
        turnId: "turn-1",
        callId: "call-1",
        namespace: "browser",
        tool: "search",
        arguments: { query: "Codex" }
      }
    });

    expect(request).toMatchObject({
      requestId: 14,
      kind: "dynamic_tool",
      title: "动态工具调用",
      description: "browser/search\n{\"query\":\"Codex\"}",
      options: [
        { value: "submit", label: "回传结果" },
        { value: "fail", label: "标记失败" }
      ]
    });
    expect(buildPendingServerRequestResponse(request, "搜索结果")).toEqual({
      success: true,
      contentItems: [{ type: "inputText", text: "搜索结果" }]
    });
    expect(buildPendingServerRequestResponse(request, "fail")).toEqual({
      success: false,
      contentItems: [{ type: "inputText", text: "用户在移动端标记动态工具调用失败" }]
    });
  });
});
