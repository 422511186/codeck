"use client";

import { useEffect, useState } from "react";
import {
  cleanThreadBackgroundTerminals,
  execCommand,
  killProcessSession,
  listThreadBackgroundTerminals,
  readProcessSession,
  startProcessSession,
  terminateThreadBackgroundTerminal,
  writeProcessStdin
} from "../lib/client-api";
import type { MobileBackgroundTerminalView, MobileCommandResult, MobileTerminalSession } from "../shared/codex";

type TerminalPanelProps = {
  threadId: string;
  cwd: string;
};

function parseCommand(commandLine: string): string[] {
  return commandLine
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

export function TerminalPanel({ threadId, cwd }: TerminalPanelProps) {
  const [commandLine, setCommandLine] = useState("npm --version");
  const [stdinText, setStdinText] = useState("");
  const [result, setResult] = useState<MobileCommandResult | null>(null);
  const [session, setSession] = useState<MobileTerminalSession | null>(null);
  const [backgroundTerminals, setBackgroundTerminals] = useState<MobileBackgroundTerminalView[]>([]);
  const [backgroundNotice, setBackgroundNotice] = useState("");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!session) {
      return;
    }

    const interval = window.setInterval(async () => {
      try {
        const nextSession = await readProcessSession(session.processHandle);
        setSession(nextSession);
        if (!nextSession.running) {
          window.clearInterval(interval);
        }
      } catch {
        window.clearInterval(interval);
      }
    }, 500);

    return () => window.clearInterval(interval);
  }, [session?.processHandle]);

  async function handleRun() {
    const command = parseCommand(commandLine);
    if (!command.length) {
      setError("命令不能为空");
      return;
    }

    setRunning(true);
    setError("");
    try {
      setResult(await execCommand({ command, cwd }));
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "无法执行命令");
    } finally {
      setRunning(false);
    }
  }

  async function handleStartSession() {
    const command = parseCommand(commandLine);
    if (!command.length) {
      setError("命令不能为空");
      return;
    }

    setRunning(true);
    setError("");
    try {
      const nextSession = await startProcessSession({ command, cwd });
      setSession(nextSession);
      window.setTimeout(async () => {
        setSession(await readProcessSession(nextSession.processHandle));
      }, 50);
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "无法启动终端会话");
    } finally {
      setRunning(false);
    }
  }

  async function handleWriteStdin() {
    if (!session || !stdinText) {
      return;
    }

    setError("");
    try {
      await writeProcessStdin(session.processHandle, stdinText.endsWith("\n") ? stdinText : `${stdinText}\n`);
      setStdinText("");
      setSession(await readProcessSession(session.processHandle));
    } catch (writeError) {
      setError(writeError instanceof Error ? writeError.message : "无法写入终端输入");
    }
  }

  async function handleKillSession() {
    if (!session) {
      return;
    }

    setError("");
    try {
      await killProcessSession(session.processHandle);
      setSession(await readProcessSession(session.processHandle));
    } catch (killError) {
      setError(killError instanceof Error ? killError.message : "无法终止终端会话");
    }
  }

  async function handleListBackgroundTerminals() {
    setRunning(true);
    setError("");
    setBackgroundNotice("");
    try {
      const page = await listThreadBackgroundTerminals(threadId);
      setBackgroundTerminals(page.terminals);
      if (!page.terminals.length) {
        setBackgroundNotice("没有后台终端");
      }
    } catch (listError) {
      setError(listError instanceof Error ? listError.message : "无法读取后台终端");
    } finally {
      setRunning(false);
    }
  }

  async function handleTerminateBackgroundTerminal(processId: string) {
    setRunning(true);
    setError("");
    setBackgroundNotice("");
    try {
      await terminateThreadBackgroundTerminal(threadId, processId);
      setBackgroundTerminals((terminals) => terminals.filter((terminal) => terminal.processId !== processId));
      setBackgroundNotice("已终止后台终端");
    } catch (terminateError) {
      setError(terminateError instanceof Error ? terminateError.message : "无法终止后台终端");
    } finally {
      setRunning(false);
    }
  }

  async function handleCleanBackgroundTerminals() {
    setRunning(true);
    setError("");
    setBackgroundNotice("");
    try {
      await cleanThreadBackgroundTerminals(threadId);
      setBackgroundTerminals([]);
      setBackgroundNotice("后台终端已清理");
    } catch (cleanError) {
      setError(cleanError instanceof Error ? cleanError.message : "无法清理后台终端");
    } finally {
      setRunning(false);
    }
  }

  return (
    <section className="panel-view" aria-label="终端面板">
      <div className="section-title">
        <h2>终端</h2>
        <span>{cwd}</span>
      </div>
      <form
        className="terminal-form"
        onSubmit={(event) => {
          event.preventDefault();
          handleRun();
        }}
      >
        <input
          aria-label="输入命令"
          placeholder="输入命令"
          value={commandLine}
          onChange={(event) => setCommandLine(event.target.value)}
        />
        <button type="submit" disabled={running}>
          运行
        </button>
      </form>
      <button className="terminal-session-button" type="button" onClick={handleStartSession} disabled={running}>
        启动会话
      </button>
      {error ? <p className="form-error">{error}</p> : null}
      {result ? (
        <article className="terminal-output">
          <p>退出码 {result.exitCode}</p>
          <pre>{[result.stdout, result.stderr].filter(Boolean).join("\n")}</pre>
        </article>
      ) : null}
      {session ? (
        <article className="terminal-output">
          <p>{session.running ? "运行中" : `已退出 ${session.exitCode ?? "-"}`}</p>
          <pre>{session.output || "等待输出"}</pre>
          <form
            className="terminal-form"
            onSubmit={(event) => {
              event.preventDefault();
              handleWriteStdin();
            }}
          >
            <input
              aria-label="输入 stdin"
              placeholder="输入 stdin"
              value={stdinText}
              onChange={(event) => setStdinText(event.target.value)}
              disabled={!session.running}
            />
            <button type="submit" disabled={!session.running || !stdinText}>
              发送输入
            </button>
          </form>
          <button className="terminal-session-button" type="button" onClick={handleKillSession} disabled={!session.running}>
            终止会话
          </button>
        </article>
      ) : null}
      <div className="terminal-background-actions">
        <button type="button" onClick={handleListBackgroundTerminals} disabled={running}>
          刷新后台终端
        </button>
        <button type="button" onClick={handleCleanBackgroundTerminals} disabled={running}>
          清理后台终端
        </button>
      </div>
      {backgroundNotice ? <p className="settings-note">{backgroundNotice}</p> : null}
      {backgroundTerminals.length ? (
        <div className="terminal-background-list">
          {backgroundTerminals.map((terminal) => (
            <article className="terminal-output" key={terminal.processId}>
              <p>{terminal.command}</p>
              <dl className="settings-list">
                <div className="settings-row">
                  <dt>进程</dt>
                  <dd>{terminal.processId}</dd>
                </div>
                <div className="settings-row">
                  <dt>PID</dt>
                  <dd>{terminal.osPid === null ? "-" : `PID ${terminal.osPid}`}</dd>
                </div>
                <div className="settings-row">
                  <dt>目录</dt>
                  <dd>{terminal.cwd}</dd>
                </div>
                <div className="settings-row">
                  <dt>CPU</dt>
                  <dd>{terminal.cpuPercent === null ? "-" : `${terminal.cpuPercent}%`}</dd>
                </div>
                <div className="settings-row">
                  <dt>内存</dt>
                  <dd>{terminal.rssKb === null ? "-" : `${terminal.rssKb} KB`}</dd>
                </div>
              </dl>
              <button
                className="terminal-session-button"
                type="button"
                onClick={() => handleTerminateBackgroundTerminal(terminal.processId)}
                disabled={running}
              >
                终止 {terminal.processId}
              </button>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
