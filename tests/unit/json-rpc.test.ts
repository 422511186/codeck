import { describe, expect, it } from "vitest";
import { JsonRpcPeer } from "../../src/server/app-server/json-rpc";

describe("JsonRpcPeer", () => {
  it("能关联 request 和 response", async () => {
    const sent: string[] = [];
    const peer = new JsonRpcPeer((message) => sent.push(message));

    const pending = peer.request("model/list", {});
    const request = JSON.parse(sent[0]!) as { id: number; method: string };

    peer.handleMessage(
      JSON.stringify({
        jsonrpc: "2.0",
        id: request.id,
        result: { models: [] }
      })
    );

    await expect(pending).resolves.toEqual({ models: [] });
  });

  it("能分发 notification", () => {
    const received: unknown[] = [];
    const peer = new JsonRpcPeer(() => undefined);

    peer.onNotification((message) => received.push(message));
    peer.handleMessage(
      JSON.stringify({
        jsonrpc: "2.0",
        method: "thread/status/changed",
        params: { threadId: "abc" }
      })
    );

    expect(received).toEqual([{ method: "thread/status/changed", params: { threadId: "abc" } }]);
  });

  it("保留 JSON-RPC error.data 供 route 层分类", async () => {
    const sent: string[] = [];
    const peer = new JsonRpcPeer((message) => sent.push(message));

    const pending = peer.request("thread/compact/start", { threadId: "thread-1" });
    const request = JSON.parse(sent[0]!) as { id: number };
    peer.handleMessage(
      JSON.stringify({
        jsonrpc: "2.0",
        id: request.id,
        error: {
          message: "active turn cannot be steered",
          data: {
            codexErrorInfo: {
              activeTurnNotSteerable: { turnKind: "agent" }
            }
          }
        }
      })
    );

    await expect(pending).rejects.toMatchObject({
      message: "active turn cannot be steered",
      data: {
        codexErrorInfo: {
          activeTurnNotSteerable: { turnKind: "agent" }
        }
      }
    });
  });

  it("能区分 server request 并回传 response", () => {
    const sent: string[] = [];
    const received: unknown[] = [];
    const peer = new JsonRpcPeer((message) => sent.push(message));

    peer.onServerRequest((request) => received.push(request));
    peer.handleMessage(
      JSON.stringify({
        jsonrpc: "2.0",
        id: 99,
        method: "item/commandExecution/requestApproval",
        params: { threadId: "thread-1", turnId: "turn-1", itemId: "item-1" }
      })
    );
    peer.respond(99, { decision: "approved" });

    expect(received).toEqual([
      {
        id: 99,
        method: "item/commandExecution/requestApproval",
        params: { threadId: "thread-1", turnId: "turn-1", itemId: "item-1" }
      }
    ]);
    expect(JSON.parse(sent[0]!)).toEqual({
      jsonrpc: "2.0",
      id: 99,
      result: { decision: "approved" }
    });
  });

  it("能在连接断开时拒绝所有 pending request 并清空表", async () => {
    const sent: string[] = [];
    const peer = new JsonRpcPeer((message) => sent.push(message));

    const first = peer.request("model/list", {});
    const second = peer.request("thread/list", {});

    peer.failPendingRequests(new Error("app-server disconnected"));

    await expect(first).rejects.toThrow("app-server disconnected");
    await expect(second).rejects.toThrow("app-server disconnected");
    const firstRequest = JSON.parse(sent[0]!) as { id: number };
    peer.handleMessage(JSON.stringify({ jsonrpc: "2.0", id: firstRequest.id, result: { late: true } }));
    await expect(first).rejects.toThrow("app-server disconnected");
  });
});
