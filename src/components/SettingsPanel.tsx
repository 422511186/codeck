"use client";

import { useEffect, useState } from "react";
import { readSettings } from "../lib/client-api";
import type { MobileModelOption, MobileSettingsView } from "../shared/codex";

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
  const [error, setError] = useState("");
  const selectedModel = models.find((model) => model.id === selectedModelId) || models[0] || null;
  const reasoningOptions = selectedModel?.supportedReasoningEfforts || [];
  const permissionOptions = settings?.permissionProfiles.length
    ? settings.permissionProfiles
    : [{ id: selectedPermissions, label: selectedPermissions, description: null }];

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
        ["协作模式", collaborationModesLabel(settings)]
      ]
    : [];

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
    </section>
  );
}
