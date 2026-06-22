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
});
