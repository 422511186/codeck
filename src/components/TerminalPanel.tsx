"use client";

import { useState } from "react";
import { execCommand } from "../lib/client-api";
import type { MobileCommandResult } from "../shared/codex";

type TerminalPanelProps = {
  cwd: string;
};

function parseCommand(commandLine: string): string[] {
  return commandLine
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

export function TerminalPanel({ cwd }: TerminalPanelProps) {
  const [commandLine, setCommandLine] = useState("npm --version");
  const [result, setResult] = useState<MobileCommandResult | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");

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
      {error ? <p className="form-error">{error}</p> : null}
      {result ? (
        <article className="terminal-output">
          <p>退出码 {result.exitCode}</p>
          <pre>{[result.stdout, result.stderr].filter(Boolean).join("\n")}</pre>
        </article>
      ) : null}
    </section>
  );
}
