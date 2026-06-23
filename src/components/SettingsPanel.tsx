"use client";

import { useEffect, useState } from "react";
import {
  cancelAccountLogin,
  consumeRateLimitResetCredit,
  disableRemoteControl,
  enableRemoteControl,
  getConfigRequirements,
  getAccountTokenUsage,
  getWindowsSandboxReadiness,
  listApps,
  loginWithApiKey,
  loginWithChatGpt,
  logoutAccount,
  readRemoteControlPairingStatus,
  readSettings,
  revokeRemoteControlClient,
  setExperimentalFeatureEnablement,
  setSkillsExtraRoots,
  sendAddCreditsNudgeEmail,
  startWindowsSandboxSetup,
  startRemoteControlPairing,
  writeConfigBatch,
  writeSkillConfig
} from "../lib/client-api";
import type {
  MobileAccountTokenUsageView,
  MobileAppView,
  MobileConfigRequirementsView,
  MobileModelOption,
  MobileRemoteControlPairingView,
  MobileSettingsView,
  MobileWindowsSandboxReadinessView
} from "../shared/codex";

type SettingsPanelProps = {
  models: MobileModelOption[];
  selectedModelId: string;
  selectedReasoningEffort: string;
  selectedPermissions: string;
  theme: "dark" | "light";
  cwd: string;
  refreshVersion: number;
  onModelChange(modelId: string): void;
  onReasoningEffortChange(reasoningEffort: string): void;
  onPermissionsChange(permissions: string): void;
  onThemeChange(theme: "dark" | "light"): void;
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

function authStatusLabel(settings: MobileSettingsView): string {
  const method = settings.authStatus.authMethod || "未登录";
  return settings.authStatus.hasAuthToken ? `${method} / 已有 token` : `${method} / 无 token`;
}

function rateLimitLabel(settings: MobileSettingsView): string {
  if (!settings.rateLimit || settings.rateLimit.usedPercent === null) {
    return "-";
  }

  const name = settings.rateLimit.limitName || settings.rateLimit.limitId || "主额度";
  return `${name} ${Math.round(settings.rateLimit.usedPercent)}%`;
}

function rateLimitResetCreditsLabel(settings: MobileSettingsView): string {
  const count = settings.rateLimit?.resetCreditsAvailable;
  return count === null || count === undefined ? "-" : `${count} 个可用`;
}

function providerCapabilitiesLabel(settings: MobileSettingsView): string {
  const enabled = [
    settings.providerCapabilities.namespaceTools ? "命名空间工具" : null,
    settings.providerCapabilities.imageGeneration ? "图像生成" : null,
    settings.providerCapabilities.webSearch ? "Web 搜索" : null
  ].filter(Boolean);

  return enabled.length ? enabled.join(" / ") : "-";
}

function experimentalFeaturesLabel(settings: MobileSettingsView): string {
  if (!settings.experimentalFeatures.length) {
    return "无实验功能";
  }

  const enabledCount = settings.experimentalFeatures.filter((feature) => feature.enabled).length;
  return `${enabledCount} 个启用 / ${settings.experimentalFeatures.length} 个实验功能`;
}

function remoteClientsLabel(settings: MobileSettingsView): string {
  if (!settings.remoteControlClients.length) {
    return "无客户端";
  }

  return settings.remoteControlClients
    .map((client) => client.displayName || client.platform || client.deviceType || client.clientId)
    .join(" / ");
}

function loadedThreadsLabel(settings: MobileSettingsView): string {
  const count = settings.loadedThreadIds.length;
  return count ? `${count} 个已加载会话` : "无已加载会话";
}

function loadedThreadIdsLabel(settings: MobileSettingsView): string {
  return settings.loadedThreadIds.length ? settings.loadedThreadIds.join(" / ") : "-";
}

function mcpServersLabel(settings: MobileSettingsView): string {
  if (!settings.mcpServers.length) {
    return "MCP 预留：无服务";
  }

  const toolCount = settings.mcpServers.reduce((total, server) => total + server.toolCount, 0);
  return `MCP 预留：${settings.mcpServers.length} 个服务 / ${toolCount} 个工具`;
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
    return "插件预留：无插件";
  }

  const installedCount = plugins.filter((plugin) => plugin.installed).length;
  return `插件预留：${installedCount} 个已安装 / ${plugins.length} 个插件`;
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

const approvalPolicyOptions = ["untrusted", "on-request", "on-failure", "never"];
const sandboxModeOptions = ["read-only", "workspace-write", "danger-full-access"];

export function SettingsPanel({
  models,
  selectedModelId,
  selectedReasoningEffort,
  selectedPermissions,
  theme,
  cwd,
  refreshVersion,
  onModelChange,
  onReasoningEffortChange,
  onPermissionsChange,
  onThemeChange
}: SettingsPanelProps) {
  const [settings, setSettings] = useState<MobileSettingsView | null>(null);
  const [pairing, setPairing] = useState<MobileRemoteControlPairingView | null>(null);
  const [pairingClaimed, setPairingClaimed] = useState<boolean | null>(null);
  const [apps, setApps] = useState<MobileAppView[]>([]);
  const [appsNotice, setAppsNotice] = useState("");
  const [configRequirements, setConfigRequirements] = useState<MobileConfigRequirementsView | null>(null);
  const [configRequirementsNotice, setConfigRequirementsNotice] = useState("");
  const [windowsSandboxReadiness, setWindowsSandboxReadiness] = useState<MobileWindowsSandboxReadinessView | null>(null);
  const [windowsSandboxNotice, setWindowsSandboxNotice] = useState("");
  const [experimentalFeatureNotice, setExperimentalFeatureNotice] = useState("");
  const [skillRootText, setSkillRootText] = useState("");
  const [skillNotice, setSkillNotice] = useState("");
  const [apiKeyText, setApiKeyText] = useState("");
  const [accountNotice, setAccountNotice] = useState("");
  const [accountLoginId, setAccountLoginId] = useState("");
  const [accountAuthUrl, setAccountAuthUrl] = useState("");
  const [accountUsage, setAccountUsage] = useState<MobileAccountTokenUsageView | null>(null);
  const [accountUsageNotice, setAccountUsageNotice] = useState("");
  const [globalModelId, setGlobalModelId] = useState("");
  const [globalReasoningEffort, setGlobalReasoningEffort] = useState("");
  const [globalApprovalPolicy, setGlobalApprovalPolicy] = useState("");
  const [globalSandboxMode, setGlobalSandboxMode] = useState("");
  const [globalConfigNotice, setGlobalConfigNotice] = useState("");
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

  useEffect(() => {
    if (!settings) {
      return;
    }

    setGlobalModelId(settings.model || "");
    setGlobalReasoningEffort(settings.reasoningEffort || "");
    setGlobalApprovalPolicy(settings.approvalPolicy || "");
    setGlobalSandboxMode(settings.sandboxMode || "");
  }, [settings?.model, settings?.reasoningEffort, settings?.approvalPolicy, settings?.sandboxMode]);

  useEffect(() => {
    const efforts = models.find((model) => model.id === globalModelId)?.supportedReasoningEfforts || [];
    if (efforts.length && !efforts.includes(globalReasoningEffort)) {
      setGlobalReasoningEffort(efforts.includes("medium") ? "medium" : efforts[0]);
    }
  }, [models, globalModelId, globalReasoningEffort]);

  const rows = settings
    ? [
        ["模型", settings.model],
        ["Provider", settings.modelProvider],
        ["思考强度", settings.reasoningEffort],
        ["审批策略", settings.approvalPolicy],
        ["沙箱", settings.sandboxMode],
        ["远程控制", settings.remoteControlStatus],
        ["账号", accountLabel(settings)],
        ["鉴权方式", authStatusLabel(settings)],
        ["计划", settings.account.planType],
        ["OpenAI 鉴权", settings.account.requiresOpenaiAuth ? "需要" : "不需要"],
        ["额度", rateLimitLabel(settings)],
        ["重置 credit", rateLimitResetCreditsLabel(settings)],
        ["Provider 能力", providerCapabilitiesLabel(settings)],
        ["实验功能", experimentalFeaturesLabel(settings)],
        ["已加载会话", loadedThreadsLabel(settings)],
        ["会话 ID", loadedThreadIdsLabel(settings)],
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

  async function handleConsumeRateLimitResetCredit() {
    setRemoteBusy(true);
    setError("");
    setAccountUsageNotice("");
    try {
      const idempotencyKey =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `mobile-reset-${Date.now()}`;
      const result = await consumeRateLimitResetCredit(idempotencyKey);
      setAccountUsageNotice(`重置 credit：${result.outcome}`);
      await reloadSettings();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "无法消费重置额度 credit");
    } finally {
      setRemoteBusy(false);
    }
  }

  async function handleListApps() {
    setRemoteBusy(true);
    setError("");
    setAppsNotice("");
    try {
      const page = await listApps();
      setApps(page.apps);
      setAppsNotice(page.apps.length ? `${page.apps.length} 个 Apps` : "没有 Apps");
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "无法读取 Apps 列表");
    } finally {
      setRemoteBusy(false);
    }
  }

  async function handleReadConfigRequirements() {
    setRemoteBusy(true);
    setError("");
    setConfigRequirementsNotice("");
    try {
      const requirements = await getConfigRequirements();
      setConfigRequirements(requirements);
      setConfigRequirementsNotice(requirements ? "配置要求已读取" : "没有配置要求");
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "无法读取配置要求");
    } finally {
      setRemoteBusy(false);
    }
  }

  async function handleWriteGlobalConfig() {
    if (!globalModelId || !globalReasoningEffort || !globalApprovalPolicy || !globalSandboxMode) {
      setError("全局配置不能为空");
      return;
    }

    setRemoteBusy(true);
    setError("");
    setGlobalConfigNotice("");
    try {
      await writeConfigBatch([
        { keyPath: "model", value: globalModelId },
        { keyPath: "model_reasoning_effort", value: globalReasoningEffort },
        { keyPath: "approval_policy", value: globalApprovalPolicy },
        { keyPath: "sandbox_mode", value: globalSandboxMode }
      ]);
      setGlobalConfigNotice("全局配置已保存");
      await reloadSettings();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "无法保存全局配置");
    } finally {
      setRemoteBusy(false);
    }
  }

  async function handleReadWindowsSandboxReadiness() {
    setRemoteBusy(true);
    setError("");
    setWindowsSandboxNotice("");
    try {
      const readiness = await getWindowsSandboxReadiness();
      setWindowsSandboxReadiness(readiness);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "无法检查 Windows Sandbox");
    } finally {
      setRemoteBusy(false);
    }
  }

  async function handleStartWindowsSandboxSetup() {
    setRemoteBusy(true);
    setError("");
    setWindowsSandboxNotice("");
    try {
      const result = await startWindowsSandboxSetup("unelevated", cwd || null);
      setWindowsSandboxNotice(result.started ? "Sandbox 设置已启动" : "Sandbox 设置未启动");
      setWindowsSandboxReadiness(await getWindowsSandboxReadiness());
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "无法启动 Windows Sandbox 设置");
    } finally {
      setRemoteBusy(false);
    }
  }

  async function handleSetExperimentalFeature(name: string, enabled: boolean) {
    setRemoteBusy(true);
    setError("");
    setExperimentalFeatureNotice("");
    try {
      await setExperimentalFeatureEnablement(name, enabled);
      setExperimentalFeatureNotice(`实验功能 ${name} 已${enabled ? "启用" : "禁用"}`);
      await reloadSettings();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "无法设置实验功能");
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

  return (
    <section className="panel-view" aria-label="设置面板">
      <div className="section-title">
        <h2>设置</h2>
        <span>{settings ? "已连接" : "读取中"}</span>
      </div>
      {error ? <p className="form-error">{error}</p> : null}
      <div className="settings-controls">
        <label>
          <span>主题</span>
          <select aria-label="主题" value={theme} onChange={(event) => onThemeChange(event.target.value as "dark" | "light")}>
            <option value="dark">深色</option>
            <option value="light">浅色</option>
          </select>
        </label>
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
      {settings ? (
        <div className="settings-controls" aria-label="全局配置">
          <label>
            <span>全局模型</span>
            <select value={globalModelId} onChange={(event) => setGlobalModelId(event.target.value)}>
              {models.map((model) => (
                <option value={model.id} key={model.id}>
                  {model.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>全局思考强度</span>
            <select value={globalReasoningEffort} onChange={(event) => setGlobalReasoningEffort(event.target.value)}>
              {(models.find((model) => model.id === globalModelId)?.supportedReasoningEfforts || reasoningOptions).map((effort) => (
                <option value={effort} key={effort}>
                  {effort}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>全局审批策略</span>
            <select value={globalApprovalPolicy} onChange={(event) => setGlobalApprovalPolicy(event.target.value)}>
              {approvalPolicyOptions.map((policy) => (
                <option value={policy} key={policy}>
                  {policy}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>全局沙箱</span>
            <select value={globalSandboxMode} onChange={(event) => setGlobalSandboxMode(event.target.value)}>
              {sandboxModeOptions.map((mode) => (
                <option value={mode} key={mode}>
                  {mode}
                </option>
              ))}
            </select>
          </label>
          <button type="button" onClick={handleWriteGlobalConfig} disabled={remoteBusy}>
            保存全局配置
          </button>
          {globalConfigNotice ? <p className="settings-note">{globalConfigNotice}</p> : null}
        </div>
      ) : null}
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
            <button
              type="button"
              onClick={handleConsumeRateLimitResetCredit}
              disabled={remoteBusy || settings.rateLimit?.resetCreditsAvailable === 0}
            >
              消费重置 credit
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
        <p className="settings-note">MCP 的完整工具调用和资源工作流本次仅预留接口，不在移动端开放操作入口。</p>
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
        <p className="settings-note">插件、插件市场和共享本次仅预留接口，不在移动端开放详情、安装、卸载或共享入口。</p>
      ) : null}
      {settings ? (
        <div className="app-control-panel">
          <button type="button" className="remote-client-button" onClick={handleListApps} disabled={remoteBusy}>
            刷新 Apps
          </button>
          {apps.length ? (
            <div className="skill-control-panel">
              {apps.map((app) => (
                <dl className="settings-list" key={app.id}>
                  <div className="settings-row">
                    <dt>App</dt>
                    <dd>{app.name}</dd>
                  </div>
                  <div className="settings-row">
                    <dt>描述</dt>
                    <dd>{app.description || "-"}</dd>
                  </div>
                  <div className="settings-row">
                    <dt>状态</dt>
                    <dd>{`${app.isAccessible ? "可用" : "不可用"} / ${app.isEnabled ? "已启用" : "已禁用"}`}</dd>
                  </div>
                  <div className="settings-row">
                    <dt>分类</dt>
                    <dd>{app.category || "-"}</dd>
                  </div>
                  <div className="settings-row">
                    <dt>开发者</dt>
                    <dd>{app.developer || "-"}</dd>
                  </div>
                  <div className="settings-row">
                    <dt>插件</dt>
                    <dd>{app.pluginDisplayNames.length ? app.pluginDisplayNames.join(" / ") : "-"}</dd>
                  </div>
                </dl>
              ))}
            </div>
          ) : null}
          {appsNotice ? <p className="settings-note">{appsNotice}</p> : null}
        </div>
      ) : null}
      {settings ? (
        <div className="experimental-feature-panel">
          {settings.experimentalFeatures.map((feature) => {
            const label = feature.displayName || feature.name;
            return (
              <dl className="settings-list" key={feature.name}>
                <div className="settings-row">
                  <dt>实验功能</dt>
                  <dd>{label}</dd>
                </div>
                <div className="settings-row">
                  <dt>状态</dt>
                  <dd>{`${feature.enabled ? "启用" : "禁用"} / ${feature.stage}`}</dd>
                </div>
                <div className="settings-row">
                  <dt>说明</dt>
                  <dd>{feature.description || feature.announcement || "-"}</dd>
                </div>
                <button
                  type="button"
                  className="remote-client-button"
                  onClick={() => handleSetExperimentalFeature(feature.name, !feature.enabled)}
                  disabled={remoteBusy}
                >
                  {feature.enabled ? "禁用" : "启用"} {label}
                </button>
              </dl>
            );
          })}
          {experimentalFeatureNotice ? <p className="settings-note">{experimentalFeatureNotice}</p> : null}
        </div>
      ) : null}
      {settings ? (
        <div className="config-requirements-panel">
          <div className="turn-actions-row">
            <button type="button" onClick={handleReadConfigRequirements} disabled={remoteBusy}>
              读取配置要求
            </button>
            <button type="button" onClick={handleReadWindowsSandboxReadiness} disabled={remoteBusy}>
              检查 Windows Sandbox
            </button>
            <button type="button" onClick={handleStartWindowsSandboxSetup} disabled={remoteBusy}>
              设置 Windows Sandbox
            </button>
          </div>
          {configRequirements ? (
            <dl className="settings-list">
              <div className="settings-row">
                <dt>默认权限</dt>
                <dd>{configRequirements.defaultPermissions || "-"}</dd>
              </div>
              <div className="settings-row">
                <dt>审批策略</dt>
                <dd>{configRequirements.allowedApprovalPolicies?.join(" / ") || "-"}</dd>
              </div>
              <div className="settings-row">
                <dt>Sandbox</dt>
                <dd>{configRequirements.allowedSandboxModes?.join(" / ") || "-"}</dd>
              </div>
              <div className="settings-row">
                <dt>Windows Sandbox</dt>
                <dd>{configRequirements.allowedWindowsSandboxImplementations?.join(" / ") || "-"}</dd>
              </div>
              <div className="settings-row">
                <dt>远控</dt>
                <dd>{configRequirements.allowRemoteControl === null ? "-" : configRequirements.allowRemoteControl ? "允许" : "禁止"}</dd>
              </div>
              <div className="settings-row">
                <dt>权限配置</dt>
                <dd>
                  {configRequirements.allowedPermissionProfiles
                    ? Object.entries(configRequirements.allowedPermissionProfiles)
                        .filter(([, enabled]) => enabled)
                        .map(([name]) => name)
                        .join(" / ") || "-"
                    : "-"}
                </dd>
              </div>
              <div className="settings-row">
                <dt>功能要求</dt>
                <dd>
                  {configRequirements.featureRequirements
                    ? Object.entries(configRequirements.featureRequirements)
                        .filter(([, enabled]) => enabled)
                        .map(([name]) => name)
                        .join(" / ") || "-"
                    : "-"}
                </dd>
              </div>
            </dl>
          ) : null}
          {windowsSandboxReadiness ? (
            <dl className="settings-list">
              <div className="settings-row">
                <dt>Sandbox 状态</dt>
                <dd>{windowsSandboxReadiness.status}</dd>
              </div>
            </dl>
          ) : null}
          {configRequirementsNotice ? <p className="settings-note">{configRequirementsNotice}</p> : null}
          {windowsSandboxNotice ? <p className="settings-note">{windowsSandboxNotice}</p> : null}
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
