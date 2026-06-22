import { describe, expect, it } from "vitest";
import { normalizePendingServerRequest } from "../../src/server/app-server/pending-requests";

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
});
