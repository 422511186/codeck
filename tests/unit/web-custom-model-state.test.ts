import { beforeEach, describe, expect, it } from "vitest";
import { useStore } from "../../src/web/state/store";
import type { ThreadModelStateView } from "../../src/shared/custom-models";

const oldState: ThreadModelStateView = {
  selection: { source: "app-server", model: "gpt-5.6-sol" },
  model: "gpt-5.6-sol",
  label: "GPT-5.6",
  contextWindow: null,
  inputModalities: ["text", "image"],
  supportedReasoningEfforts: ["high"],
  defaultReasoningEffort: "high",
  reasoningEffort: "high",
  bindingVersion: null,
  sourceUpdatedAt: null,
  blocked: false,
  operationId: null
};

const targetState: ThreadModelStateView = {
  selection: { source: "custom", customModelId: "custom-1" },
  model: "mimo-v2.5-pro",
  label: "MIMO",
  contextWindow: 200_000,
  inputModalities: ["text"],
  supportedReasoningEfforts: ["xhigh"],
  defaultReasoningEffort: "xhigh",
  reasoningEffort: "xhigh",
  bindingVersion: "binding-1",
  sourceUpdatedAt: "2026-07-18T00:00:00.000Z",
  blocked: false,
  operationId: null
};

describe("thread store 模型切换终态", () => {
  beforeEach(() => {
    useStore.setState({ threads: {}, activeThreadId: null });
    useStore.getState().ensureThread("thread-1");
    useStore.getState().setModelState("thread-1", oldState);
  });

  it("pending 不乐观替换当前模型，switched 才提交目标状态", () => {
    useStore.getState().beginModelSwitch("thread-1", targetState.selection);
    expect(useStore.getState().threads["thread-1"]).toMatchObject({
      model: "gpt-5.6-sol",
      modelSelection: oldState.selection,
      modelSwitchStatus: "pending"
    });

    useStore.getState().applyModelSwitchResult("thread-1", {
      outcome: "switched",
      operationId: "operation-1",
      latestState: targetState
    });
    expect(useStore.getState().threads["thread-1"]).toMatchObject({
      model: "mimo-v2.5-pro",
      modelSelection: targetState.selection,
      modelBindingVersion: "binding-1",
      modelContextWindow: 200_000,
      modelSwitchStatus: "idle"
    });
  });

  it("recovered 保持后端恢复的旧模型", () => {
    useStore.getState().beginModelSwitch("thread-1", targetState.selection);
    useStore.getState().applyModelSwitchResult("thread-1", {
      outcome: "recovered",
      operationId: "operation-1",
      latestState: oldState
    });

    expect(useStore.getState().threads["thread-1"]).toMatchObject({
      model: "gpt-5.6-sol",
      modelSelection: oldState.selection,
      modelSwitchStatus: "idle",
      contextUsage: null
    });
  });

  it("运行时重建终态使旧 provider 的上下文观察失效", () => {
    useStore.getState().setContextUsage("thread-1", {
      totalTokens: 80_000,
      inputTokens: 70_000,
      outputTokens: 10_000,
      reasoningOutputTokens: 0,
      modelContextWindow: 100_000,
      updatedAt: 1
    });

    useStore.getState().applyModelSwitchResult("thread-1", {
      outcome: "switched",
      operationId: "operation-1",
      latestState: targetState
    });

    expect(useStore.getState().threads["thread-1"]?.contextUsage).toBeNull();
  });

  it("recovery_failed 保留当前状态、标记阻塞并禁止发送", () => {
    useStore.getState().beginModelSwitch("thread-1", targetState.selection);
    useStore.getState().applyModelSwitchResult("thread-1", {
      outcome: "recovery_failed",
      operationId: "operation-1",
      latestState: { ...oldState, blocked: true, operationId: "operation-1" }
    });

    expect(useStore.getState().threads["thread-1"]).toMatchObject({
      model: "gpt-5.6-sol",
      modelSelection: oldState.selection,
      modelSwitchStatus: "recovery_failed",
      modelSwitchOperationId: "operation-1"
    });
  });

  it("409 清除 pending 但保留模型和草稿相关状态", () => {
    useStore.getState().beginModelSwitch("thread-1", targetState.selection);
    useStore.getState().clearModelSwitchPending("thread-1");

    expect(useStore.getState().threads["thread-1"]).toMatchObject({
      model: "gpt-5.6-sol",
      modelSelection: oldState.selection,
      modelSwitchStatus: "idle"
    });
  });
});
