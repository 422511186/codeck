"use client";

import { useEffect, useState } from "react";
import {
  cancelAccountLogin,
  disableRemoteControl,
  enableRemoteControl,
  getAccountTokenUsage,
  installPlugin,
  loginWithApiKey,
  loginWithChatGpt,
  loginMcpServer,
  logoutAccount,
  readMcpResource,
  readRemoteControlPairingStatus,
  readSettings,
  readPlugin,
  readPluginSkill,
  refreshMcpServer,
  revokeRemoteControlClient,
  setSkillsExtraRoots,
  sendAddCreditsNudgeEmail,
  startRemoteControlPairing,
  uninstallPlugin,
  writeSkillConfig
} from "../lib/client-api";
import type {
  MobileAccountTokenUsageView,
  MobileModelOption,
  MobileMcpResourceReadView,
  MobilePluginDetailView,
  MobileRemoteControlPairingView,
  MobileSettingsView
} from "../shared/codex";

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

function hooksLabel(settings: MobileSettingsView): string {
  const hooks = settings.hooks ?? [];
  if (!hooks.length) {
    return "无 Hooks";
  }

  const enabledCount = hooks.filter((hook) => hook.enabled).length;
  return `${enabledCount} 个启用 / ${hooks.length} 个 Hooks`;
}

function hookNamesLabel(settings: MobileSettingsView): string {
  const hooks = settings.hooks ?? [];
  if (!hooks.length) {
    return "-";
  }

  return hooks.map((hook) => hook.key).join(" / ");
}

function usageNumberLabel(value: number | null | undefined): string {
  return value === null || value === undefined ? "-" : String(value);
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
  const [pluginDetail, setPluginDetail] = useState<MobilePluginDetailView | null>(null);
  const [pluginNotice, setPluginNotice] = useState("");
  const [skillRootText, setSkillRootText] = useState("");
  const [skillNotice, setSkillNotice] = useState("");
  const [pluginSkillContent, setPluginSkillContent] = useState("");
  const [mcpNotice, setMcpNotice] = useState("");
  const [mcpAuthorizationUrl, setMcpAuthorizationUrl] = useState("");
  const [mcpResource, setMcpResource] = useState<MobileMcpResourceReadView | null>(null);
  const [apiKeyText, setApiKeyText] = useState("");
  const [accountNotice, setAccountNotice] = useState("");
  const [accountLoginId, setAccountLoginId] = useState("");
  const [accountAuthUrl, setAccountAuthUrl] = useState("");
  const [accountUsage, setAccountUsage] = useState<MobileAccountTokenUsageView | null>(null);
  const [accountUsageNotice, setAccountUsageNotice] = useState("");
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
        ["Hooks", hooksLabel(settings)],
        ["Hook 列表", hookNamesLabel(settings)],
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

  async function handleLoginWithChatGpt() {
    setRemoteBusy(true);
    setError("");
    setAccountNotice("");
    try {
      const login = await loginWithChatGpt();
      if (login.type === "chatgpt") {
        setAccountLoginId(login.loginId);
        setAccountAuthUrl(login.authUrl);
        setAccountNotice("ChatGPT 登录已启动");
      }
      await reloadSettings();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "无法启动 ChatGPT 登录");
    } finally {
      setRemoteBusy(false);
    }
  }

  async function handleLoginWithApiKey() {
    if (!apiKeyText.trim()) {
      setError("请输入 API Key");
      return;
    }

    setRemoteBusy(true);
    setError("");
    setAccountNotice("");
    try {
      await loginWithApiKey(apiKeyText.trim());
      setApiKeyText("");
      setAccountNotice("API Key 已登录");
      await reloadSettings();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "无法使用 API Key 登录");
    } finally {
      setRemoteBusy(false);
    }
  }

  async function handleCancelAccountLogin() {
    if (!accountLoginId) {
      return;
    }

    setRemoteBusy(true);
    setError("");
    setAccountNotice("");
    try {
      const result = await cancelAccountLogin(accountLoginId);
      setAccountNotice(`登录已取消：${result.status}`);
      setAccountLoginId("");
      setAccountAuthUrl("");
      await reloadSettings();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "无法取消账号登录");
    } finally {
      setRemoteBusy(false);
    }
  }

  async function handleLogoutAccount() {
    setRemoteBusy(true);
    setError("");
    setAccountNotice("");
    try {
      await logoutAccount();
      setAccountNotice("账号已退出");
      await reloadSettings();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "无法退出账号");
    } finally {
      setRemoteBusy(false);
    }
  }

  async function handleReadAccountTokenUsage() {
    setRemoteBusy(true);
    setError("");
    setAccountUsageNotice("");
    try {
      const usage = await getAccountTokenUsage();
      setAccountUsage(usage);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "无法读取账号 token 用量");
    } finally {
      setRemoteBusy(false);
    }
  }

  async function handleSendAddCreditsNudge(creditType: "credits" | "usage_limit") {
    setRemoteBusy(true);
    setError("");
    setAccountUsageNotice("");
    try {
      const result = await sendAddCreditsNudgeEmail(creditType);
      setAccountUsageNotice(`提醒结果：${result.status}`);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "无法发送加购提醒");
    } finally {
      setRemoteBusy(false);
    }
  }

  async function handleRefreshMcpServer(serverName: string) {
    setRemoteBusy(true);
    setError("");
    setMcpNotice("");
    try {
      await refreshMcpServer(serverName);
      setMcpNotice(`${serverName} 已刷新`);
      await reloadSettings();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "无法刷新 MCP 服务");
    } finally {
      setRemoteBusy(false);
    }
  }

  async function handleLoginMcpServer(serverName: string) {
    setRemoteBusy(true);
    setError("");
    setMcpNotice("");
    try {
      const login = await loginMcpServer(serverName);
      setMcpAuthorizationUrl(login.authorizationUrl);
      setMcpNotice(`${serverName} 登录已启动`);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "无法启动 MCP 登录");
    } finally {
      setRemoteBusy(false);
    }
  }

  async function handleReadMcpResource(serverName: string, uri: string) {
    setRemoteBusy(true);
    setError("");
    setMcpNotice("");
    try {
      const resource = await readMcpResource({ server: serverName, uri });
      setMcpResource(resource);
      setMcpNotice(`已读取 ${uri}`);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "无法读取 MCP 资源");
    } finally {
      setRemoteBusy(false);
    }
  }

  async function handleReadPlugin(pluginName: string) {
    const plugin = settings?.plugins.find((item) => item.name === pluginName);
    if (!plugin) {
      return;
    }

    setRemoteBusy(true);
    setError("");
    setPluginNotice("");
    try {
      const detail = await readPlugin({
        marketplaceName: plugin.marketplaceName,
        marketplacePath: plugin.marketplacePath,
        pluginName: plugin.name
      });
      setPluginDetail(detail);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "无法读取插件详情");
    } finally {
      setRemoteBusy(false);
    }
  }

  async function handleInstallPlugin(pluginName: string) {
    const plugin = settings?.plugins.find((item) => item.name === pluginName);
    if (!plugin) {
      return;
    }

    setRemoteBusy(true);
    setError("");
    try {
      const result = await installPlugin({
        marketplaceName: plugin.marketplaceName,
        marketplacePath: plugin.marketplacePath,
        pluginName: plugin.name
      });
      setPluginNotice(`安装结果：${result.authPolicy}`);
      await reloadSettings();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "无法安装插件");
    } finally {
      setRemoteBusy(false);
    }
  }

  async function handleUninstallPlugin(pluginId: string) {
    setRemoteBusy(true);
    setError("");
    try {
      await uninstallPlugin(pluginId);
      setPluginNotice(`插件已卸载：${pluginId}`);
      await reloadSettings();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "无法卸载插件");
    } finally {
      setRemoteBusy(false);
    }
  }

  async function handleSetSkillRoots() {
    const roots = skillRootText
      .split(/\r?\n/)
      .map((root) => root.trim())
      .filter(Boolean);
    setRemoteBusy(true);
    setError("");
    try {
      await setSkillsExtraRoots(roots);
      setSkillNotice("Skill 根目录已更新");
      await reloadSettings();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "无法设置 Skill 根目录");
    } finally {
      setRemoteBusy(false);
    }
  }

  async function handleWriteSkillConfig(name: string, enabled: boolean) {
    setRemoteBusy(true);
    setError("");
    try {
      const result = await writeSkillConfig({ name, enabled });
      setSkillNotice(`${name} ${result.effectiveEnabled ? "已启用" : "已禁用"}`);
      await reloadSettings();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "无法写入 Skill 配置");
    } finally {
      setRemoteBusy(false);
    }
  }

  async function handleReadPluginSkill(skillName: string) {
    if (!pluginDetail?.remotePluginId) {
      return;
    }

    setRemoteBusy(true);
    setError("");
    try {
      const skill = await readPluginSkill({
        remoteMarketplaceName: pluginDetail.marketplaceName,
        remotePluginId: pluginDetail.remotePluginId,
        skillName
      });
      setPluginSkillContent(skill.contents || "");
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "无法读取插件 Skill");
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
        <div className="account-control-panel">
          <div className="turn-actions-row">
            <button type="button" onClick={handleLoginWithChatGpt} disabled={remoteBusy}>
              ChatGPT 登录
            </button>
            <button type="button" onClick={handleCancelAccountLogin} disabled={remoteBusy || !accountLoginId}>
              取消登录
            </button>
            <button type="button" onClick={handleLogoutAccount} disabled={remoteBusy}>
              退出账号
            </button>
          </div>
          <div className="account-api-key-row">
            <input
              aria-label="OpenAI API Key"
              placeholder="OpenAI API Key"
              value={apiKeyText}
              onChange={(event) => setApiKeyText(event.target.value)}
              disabled={remoteBusy}
            />
            <button type="button" onClick={handleLoginWithApiKey} disabled={remoteBusy || !apiKeyText.trim()}>
              API Key 登录
            </button>
          </div>
          {accountAuthUrl ? (
            <p className="settings-note">
              登录 URL：<span>{accountAuthUrl}</span>
            </p>
          ) : null}
          {accountNotice ? <p className="settings-note">{accountNotice}</p> : null}
          <div className="turn-actions-row">
            <button type="button" onClick={handleReadAccountTokenUsage} disabled={remoteBusy}>
              读取用量
            </button>
            <button type="button" onClick={() => handleSendAddCreditsNudge("credits")} disabled={remoteBusy}>
              发送额度提醒
            </button>
            <button type="button" onClick={() => handleSendAddCreditsNudge("usage_limit")} disabled={remoteBusy}>
              发送用量限制提醒
            </button>
          </div>
          {accountUsage ? (
            <dl className="settings-list">
              <div className="settings-row">
                <dt>终身 Tokens</dt>
                <dd>{usageNumberLabel(accountUsage.summary.lifetimeTokens)}</dd>
              </div>
              <div className="settings-row">
                <dt>单日峰值</dt>
                <dd>{usageNumberLabel(accountUsage.summary.peakDailyTokens)}</dd>
              </div>
              <div className="settings-row">
                <dt>最长运行</dt>
                <dd>{usageNumberLabel(accountUsage.summary.longestRunningTurnSec)}</dd>
              </div>
              <div className="settings-row">
                <dt>当前连续</dt>
                <dd>{usageNumberLabel(accountUsage.summary.currentStreakDays)}</dd>
              </div>
              <div className="settings-row">
                <dt>最长连续</dt>
                <dd>{usageNumberLabel(accountUsage.summary.longestStreakDays)}</dd>
              </div>
              {(accountUsage.dailyUsageBuckets ?? []).slice(0, 5).map((bucket) => (
                <div className="settings-row" key={bucket.startDate}>
                  <dt>{bucket.startDate}</dt>
                  <dd>{bucket.tokens}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          {accountUsageNotice ? <p className="settings-note">{accountUsageNotice}</p> : null}
        </div>
      ) : null}
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
      {settings?.mcpServers.length ? (
        <div className="mcp-control-panel">
          {settings.mcpServers.map((server) => (
            <div className="mcp-server-block" key={server.name}>
              <div className="plugin-action-row">
                <span>{server.name}</span>
                <button type="button" onClick={() => handleRefreshMcpServer(server.name)} disabled={remoteBusy}>
                  刷新 {server.name}
                </button>
                <button type="button" onClick={() => handleLoginMcpServer(server.name)} disabled={remoteBusy}>
                  登录 {server.name}
                </button>
              </div>
              {server.resources.length ? (
                <div className="skill-control-panel">
                  {server.resources.map((resource) => (
                    <button
                      type="button"
                      key={resource.uri}
                      onClick={() => handleReadMcpResource(server.name, resource.uri)}
                      disabled={remoteBusy}
                    >
                      读取资源 {resource.name}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
          {mcpAuthorizationUrl ? (
            <p className="settings-note">
              OAuth URL：<span>{mcpAuthorizationUrl}</span>
            </p>
          ) : null}
          {mcpResource ? (
            <pre className="settings-code">
              {mcpResource.contents
                .map((content) => content.text ?? content.blob ?? "")
                .filter(Boolean)
                .join("\n\n")}
            </pre>
          ) : null}
          {mcpNotice ? <p className="settings-note">{mcpNotice}</p> : null}
        </div>
      ) : null}
      {settings?.hooks.length || settings?.hookWarnings.length || settings?.hookErrors.length ? (
        <div className="hook-control-panel">
          {settings.hooks.map((hook) => (
            <dl className="settings-list" key={`${hook.cwd}-${hook.key}`}>
              <div className="settings-row">
                <dt>Hook</dt>
                <dd>{hook.key}</dd>
              </div>
              <div className="settings-row">
                <dt>事件</dt>
                <dd>{hook.eventName}</dd>
              </div>
              <div className="settings-row">
                <dt>处理器</dt>
                <dd>{hook.handlerType}</dd>
              </div>
              <div className="settings-row">
                <dt>命令</dt>
                <dd>{hook.command || "-"}</dd>
              </div>
              <div className="settings-row">
                <dt>状态</dt>
                <dd>{`${hook.enabled ? "启用" : "禁用"} / ${hook.trustStatus} / ${hook.source}`}</dd>
              </div>
            </dl>
          ))}
          {settings.hookWarnings.map((warning) => (
            <p className="settings-note" key={`${warning.cwd}-${warning.message}`}>
              Hook 警告：{warning.message}
            </p>
          ))}
          {settings.hookErrors.map((error) => (
            <p className="form-error" key={`${error.cwd}-${error.path}`}>
              Hook 错误：{error.message}
            </p>
          ))}
        </div>
      ) : null}
      {settings?.plugins.length ? (
        <div className="plugin-control-panel">
          {settings.plugins.map((plugin) => {
            const label = plugin.displayName || plugin.name;
            return (
              <div className="plugin-action-row" key={plugin.id}>
                <span>{label}</span>
                <button type="button" onClick={() => handleReadPlugin(plugin.name)} disabled={remoteBusy}>
                  详情 {label}
                </button>
                <button type="button" onClick={() => handleInstallPlugin(plugin.name)} disabled={remoteBusy}>
                  安装 {label}
                </button>
                <button type="button" onClick={() => handleUninstallPlugin(plugin.id)} disabled={remoteBusy}>
                  卸载 {label}
                </button>
              </div>
            );
          })}
          {pluginDetail ? (
            <dl className="settings-list">
              <div className="settings-row">
                <dt>插件详情</dt>
                <dd>{pluginDetail.displayName || pluginDetail.name}</dd>
              </div>
              <div className="settings-row">
                <dt>描述</dt>
                <dd>{pluginDetail.description || "-"}</dd>
              </div>
              <div className="settings-row">
                <dt>组成</dt>
                <dd>
                  Skills {pluginDetail.skillCount} / Hooks {pluginDetail.hookCount} / Apps {pluginDetail.appCount}
                </dd>
              </div>
              <div className="settings-row">
                <dt>MCP</dt>
                <dd>{pluginDetail.mcpServers.length ? `MCP ${pluginDetail.mcpServers.join(" / ")}` : "-"}</dd>
              </div>
            </dl>
          ) : null}
          {pluginDetail?.skills.length ? (
            <div className="skill-control-panel">
              {pluginDetail.skills.map((skill) => (
                <button
                  type="button"
                  key={skill.name}
                  onClick={() => handleReadPluginSkill(skill.name)}
                  disabled={remoteBusy || !pluginDetail.remotePluginId}
                >
                  读取 Skill {skill.name}
                </button>
              ))}
            </div>
          ) : null}
          {pluginSkillContent ? <pre className="settings-code">{pluginSkillContent}</pre> : null}
          {pluginNotice ? <p className="settings-note">{pluginNotice}</p> : null}
        </div>
      ) : null}
      {settings ? (
        <div className="skill-control-panel">
          <textarea
            value={skillRootText}
            onChange={(event) => setSkillRootText(event.target.value)}
            placeholder="额外 Skill 根目录"
            disabled={remoteBusy}
          />
          <button type="button" onClick={handleSetSkillRoots} disabled={remoteBusy}>
            设置 Skill 根目录
          </button>
          {settings.skills.map((skill) => (
            <button
              type="button"
              key={`${skill.cwd}-${skill.name}`}
              onClick={() => handleWriteSkillConfig(skill.name, !skill.enabled)}
              disabled={remoteBusy}
            >
              {skill.enabled ? "禁用" : "启用"} {skill.name}
            </button>
          ))}
          {skillNotice ? <p className="settings-note">{skillNotice}</p> : null}
        </div>
      ) : null}
    </section>
  );
}
