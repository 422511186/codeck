"use client";

import { useEffect, useState } from "react";
import {
  disableRemoteControl,
  enableRemoteControl,
  readRemoteControlPairingStatus,
  readSettings,
  revokeRemoteControlClient,
  startRemoteControlPairing
} from "../lib/client-api";
import type { MobileModelOption, MobileRemoteControlPairingView, MobileSettingsView } from "../shared/codex";

type SettingsPanelProps = {
  models: MobileModelOption[];
  selectedModelId: string;
  selectedReasoningEffort: string;
  selectedPermissions: string;
  refreshVersion: number;
  onModelChange(modelId: string): void;
  onReasoningEffortChange(reasoningEffort: string): void;
  onPermissionsChange(permissions: string): void;
};

function accountLabel(settings: MobileSettingsView): string {
  if (settings.account.type === "none") {
    return "未登录";
  }

  if (settings.account.type === "chatgpt") {
    return settings.account.email ? `ChatGPT ${settings.account.email}` : "ChatGPT";
  }

  if (settings.account.type === "apiKey") {
    return "API Key";
  }

  return "Amazon Bedrock";
}

function rateLimitLabel(settings: MobileSettingsView): string {
  if (!settings.rateLimit || settings.rateLimit.usedPercent === null) {
    return "-";
  }

  const name = settings.rateLimit.limitName || settings.rateLimit.limitId || "主额度";
  return `${name} ${Math.round(settings.rateLimit.usedPercent)}%`;
}

function providerCapabilitiesLabel(settings: MobileSettingsView): string {
  const enabled = [
    settings.providerCapabilities.namespaceTools ? "命名空间工具" : null,
    settings.providerCapabilities.imageGeneration ? "图像生成" : null,
    settings.providerCapabilities.webSearch ? "Web 搜索" : null
  ].filter(Boolean);

  return enabled.length ? enabled.join(" / ") : "-";
}

function remoteClientsLabel(settings: MobileSettingsView): string {
  if (!settings.remoteControlClients.length) {
    return "无客户端";
  }

  return settings.remoteControlClients
    .map((client) => client.displayName || client.platform || client.deviceType || client.clientId)
    .join(" / ");
}

function mcpServersLabel(settings: MobileSettingsView): string {
  if (!settings.mcpServers.length) {
    return "无 MCP 服务";
  }

  const toolCount = settings.mcpServers.reduce((total, server) => total + server.toolCount, 0);
  return `${settings.mcpServers.length} 个服务 / ${toolCount} 个工具`;
}

function collaborationModesLabel(settings: MobileSettingsView): string {
  if (!settings.collaborationModes.length) {
    return "-";
  }

  return settings.collaborationModes.map((mode) => mode.name).join(" / ");
}

function skillsLabel(settings: MobileSettingsView): string {
  const skills = settings.skills ?? [];
  if (!skills.length) {
    return "无 Skills";
  }

  const enabledCount = skills.filter((skill) => skill.enabled).length;
  return `${enabledCount} 个启用 / ${skills.length} 个 Skills`;
}

function skillNamesLabel(settings: MobileSettingsView): string {
  const skills = settings.skills ?? [];
  if (!skills.length) {
    return "-";
  }

  return skills.map((skill) => skill.name).join(" / ");
}

function pluginsLabel(settings: MobileSettingsView): string {
  const plugins = settings.plugins ?? [];
  if (!plugins.length) {
    return "无插件";
  }

  const installedCount = plugins.filter((plugin) => plugin.installed).length;
  return `${installedCount} 个已安装 / ${plugins.length} 个插件`;
}

function pluginNamesLabel(settings: MobileSettingsView): string {
  const plugins = settings.plugins ?? [];
  if (!plugins.length) {
    return "-";
  }

  return plugins.map((plugin) => plugin.displayName || plugin.name).join(" / ");
}

export function SettingsPanel({
  models,
  selectedModelId,
  selectedReasoningEffort,
  selectedPermissions,
  refreshVersion,
  onModelChange,
  onReasoningEffortChange,
  onPermissionsChange
}: SettingsPanelProps) {
  const [settings, setSettings] = useState<MobileSettingsView | null>(null);
  const [pairing, setPairing] = useState<MobileRemoteControlPairingView | null>(null);
  const [pairingClaimed, setPairingClaimed] = useState<boolean | null>(null);
  const [error, setError] = useState("");
  const [remoteBusy, setRemoteBusy] = useState(false);
  const selectedModel = models.find((model) => model.id === selectedModelId) || models[0] || null;
  const reasoningOptions = selectedModel?.supportedReasoningEfforts || [];
  const permissionOptions = settings?.permissionProfiles.length
    ? settings.permissionProfiles
    : [{ id: selectedPermissions, label: selectedPermissions, description: null }];

  async function reloadSettings(): Promise<void> {
    const nextSettings = await readSettings();
    setSettings(nextSettings);
  }

  useEffect(() => {
    let cancelled = false;

    async function loadSettings() {
      setError("");
      try {
        const nextSettings = await readSettings();
        if (!cancelled) {
          setSettings(nextSettings);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "无法读取设置");
        }
      }
    }

    loadSettings();
    return () => {
      cancelled = true;
    };
  }, [refreshVersion]);

  const rows = settings
    ? [
        ["模型", settings.model],
        ["Provider", settings.modelProvider],
        ["思考强度", settings.reasoningEffort],
        ["审批策略", settings.approvalPolicy],
        ["沙箱", settings.sandboxMode],
        ["远程控制", settings.remoteControlStatus],
        ["账号", accountLabel(settings)],
        ["计划", settings.account.planType],
        ["OpenAI 鉴权", settings.account.requiresOpenaiAuth ? "需要" : "不需要"],
        ["额度", rateLimitLabel(settings)],
        ["Provider 能力", providerCapabilitiesLabel(settings)],
        ["远程客户端", remoteClientsLabel(settings)],
        ["MCP", mcpServersLabel(settings)],
        ["协作模式", collaborationModesLabel(settings)],
        ["Skills", skillsLabel(settings)],
        ["Skill 列表", skillNamesLabel(settings)],
        ["插件", pluginsLabel(settings)],
        ["插件列表", pluginNamesLabel(settings)]
      ]
    : [];

  async function runRemoteAction(action: () => Promise<unknown>) {
    setRemoteBusy(true);
    setError("");
    try {
      await action();
      await reloadSettings();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "远程控制操作失败");
    } finally {
      setRemoteBusy(false);
    }
  }

  async function handleStartPairing() {
    setRemoteBusy(true);
    setError("");
    try {
      const nextPairing = await startRemoteControlPairing();
      setPairing(nextPairing);
      setPairingClaimed(null);
      await reloadSettings();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "无法开始配对");
    } finally {
      setRemoteBusy(false);
    }
  }

  async function handleRefreshPairingStatus() {
    if (!pairing) {
      return;
    }

    setRemoteBusy(true);
    setError("");
    try {
      const nextStatus = await readRemoteControlPairingStatus({
        pairingCode: pairing.pairingCode,
        manualPairingCode: pairing.manualPairingCode
      });
      setPairingClaimed(nextStatus.claimed);
      await reloadSettings();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "无法读取配对状态");
    } finally {
      setRemoteBusy(false);
    }
  }

  return (
    <section className="panel-view" aria-label="设置面板">
      <div className="section-title">
        <h2>设置</h2>
        <span>{settings ? "已连接" : "读取中"}</span>
      </div>
      {error ? <p className="form-error">{error}</p> : null}
      <div className="settings-controls">
        <label>
          <span>模型</span>
          <select value={selectedModelId} onChange={(event) => onModelChange(event.target.value)}>
            {models.map((model) => (
              <option value={model.id} key={model.id}>
                {model.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>思考强度</span>
          <select value={selectedReasoningEffort} onChange={(event) => onReasoningEffortChange(event.target.value)}>
            {reasoningOptions.map((effort) => (
              <option value={effort} key={effort}>
                {effort}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>权限配置</span>
          <select value={selectedPermissions} onChange={(event) => onPermissionsChange(event.target.value)}>
            {permissionOptions.map((permission) => (
              <option value={permission.id} key={permission.id}>
                {permission.description ? `${permission.label} - ${permission.description}` : permission.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <dl className="settings-list">
        {rows.map(([label, value]) => (
          <div className="settings-row" key={label}>
            <dt>{label}</dt>
            <dd>{value || "-"}</dd>
          </div>
        ))}
      </dl>
      {settings ? (
        <div className="remote-control-panel">
          <div className="turn-actions-row">
            <button type="button" onClick={() => runRemoteAction(enableRemoteControl)} disabled={remoteBusy}>
              启用远控
            </button>
            <button
              type="button"
              onClick={() =>
                runRemoteAction(async () => {
                  await disableRemoteControl();
                  setPairing(null);
                  setPairingClaimed(null);
                })
              }
              disabled={remoteBusy}
            >
              关闭远控
            </button>
          </div>
          <div className="turn-actions-row">
            <button type="button" onClick={handleStartPairing} disabled={remoteBusy}>
              开始配对
            </button>
            <button type="button" onClick={handleRefreshPairingStatus} disabled={remoteBusy || !pairing}>
              刷新配对状态
            </button>
          </div>
          {pairing ? (
            <dl className="settings-list">
              <div className="settings-row">
                <dt>配对码</dt>
                <dd>{pairing.pairingCode}</dd>
              </div>
              <div className="settings-row">
                <dt>手动码</dt>
                <dd>{pairing.manualPairingCode || "-"}</dd>
              </div>
              <div className="settings-row">
                <dt>配对状态</dt>
                <dd>{pairingClaimed === null ? "等待领取" : pairingClaimed ? "配对已领取" : "未领取"}</dd>
              </div>
            </dl>
          ) : null}
          {settings.remoteControlClients.map((client) => {
            const label = client.displayName || client.platform || client.deviceType || client.clientId;
            return (
              <button
                type="button"
                className="remote-client-button"
                key={client.clientId}
                onClick={() =>
                  settings.remoteControlEnvironmentId
                    ? runRemoteAction(() =>
                        revokeRemoteControlClient(settings.remoteControlEnvironmentId as string, client.clientId)
                      )
                    : undefined
                }
                disabled={remoteBusy || !settings.remoteControlEnvironmentId}
              >
                撤销 {label}
              </button>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
