"use client";

import { useEffect, useState } from "react";
import {
  copyPath,
  createDirectory,
  getMetadata,
  readDirectory,
  readFile,
  removePath,
  writeFile
} from "../lib/client-api";
import type { MobileFileContent, MobileFileEntry, MobileFileMetadata } from "../shared/codex";

type FilesPanelProps = {
  rootPath: string;
};

export function FilesPanel({ rootPath }: FilesPanelProps) {
  const [currentPath, setCurrentPath] = useState(rootPath);
  const [entries, setEntries] = useState<MobileFileEntry[]>([]);
  const [file, setFile] = useState<MobileFileContent | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<MobileFileEntry | null>(null);
  const [draftText, setDraftText] = useState("");
  const [directoryPath, setDirectoryPath] = useState("");
  const [copyTargetPath, setCopyTargetPath] = useState("");
  const [metadata, setMetadata] = useState<MobileFileMetadata | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  async function loadDirectory(path = currentPath) {
    setError("");
    try {
      const nextEntries = await readDirectory(path);
      setEntries(nextEntries);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "无法读取目录");
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function loadCurrentDirectory() {
      setError("");
      setFile(null);
      setSelectedEntry(null);
      setMetadata(null);
      try {
        const nextEntries = await readDirectory(currentPath);
        if (!cancelled) {
          setEntries(nextEntries);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "无法读取目录");
        }
      }
    }

    loadCurrentDirectory();
    return () => {
      cancelled = true;
    };
  }, [currentPath]);

  useEffect(() => {
    setCurrentPath(rootPath);
  }, [rootPath]);

  async function handleOpen(entry: MobileFileEntry) {
    setError("");
    setNotice("");
    setMetadata(null);
    setSelectedEntry(entry);
    if (entry.isDirectory) {
      setCurrentPath(entry.path);
      return;
    }

    try {
      const nextFile = await readFile(entry.path);
      setFile(nextFile);
      setDraftText(nextFile.text);
      setCopyTargetPath(`${entry.path}.copy`);
    } catch (readError) {
      setError(readError instanceof Error ? readError.message : "无法读取文件");
    }
  }

  function resolvePath(input: string): string {
    const trimmed = input.trim();
    if (/^[A-Za-z]:[\\/]/.test(trimmed) || trimmed.startsWith("\\\\")) {
      return trimmed;
    }
    return `${currentPath.replace(/[\\/]+$/, "")}\\${trimmed}`;
  }

  function selectedPath(): string | null {
    return file?.path ?? selectedEntry?.path ?? null;
  }

  async function runFileAction(action: () => Promise<void>, successMessage: string) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
      setNotice(successMessage);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "文件操作失败");
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveFile() {
    if (!file) {
      return;
    }

    await runFileAction(async () => {
      await writeFile(file.path, draftText);
      const nextFile = await readFile(file.path);
      setFile(nextFile);
      setDraftText(nextFile.text);
      await loadDirectory();
    }, "文件已保存");
  }

  async function handleCreateDirectory() {
    if (!directoryPath.trim()) {
      setError("请输入目录路径");
      return;
    }

    await runFileAction(async () => {
      await createDirectory(resolvePath(directoryPath));
      setDirectoryPath("");
      await loadDirectory();
    }, "目录已创建");
  }

  async function handleCopyPath() {
    const sourcePath = selectedPath();
    if (!sourcePath) {
      setError("请先选择文件或目录");
      return;
    }
    if (!copyTargetPath.trim()) {
      setError("请输入复制目标路径");
      return;
    }

    await runFileAction(async () => {
      await copyPath(sourcePath, resolvePath(copyTargetPath));
      await loadDirectory();
    }, "路径已复制");
  }

  async function handleRemovePath() {
    const targetPath = selectedPath();
    if (!targetPath) {
      setError("请先选择文件或目录");
      return;
    }

    await runFileAction(async () => {
      await removePath(targetPath);
      setFile(null);
      setSelectedEntry(null);
      setMetadata(null);
      await loadDirectory();
    }, "路径已删除");
  }

  async function handleReadMetadata() {
    const targetPath = selectedPath();
    if (!targetPath) {
      setError("请先选择文件或目录");
      return;
    }

    await runFileAction(async () => {
      setMetadata(await getMetadata(targetPath));
    }, "元数据已读取");
  }

  return (
    <section className="panel-view" aria-label="文件面板">
      <div className="section-title">
        <h2>文件</h2>
        <span>{entries.length}</span>
      </div>
      <p className="path-line">{currentPath}</p>
      {error ? <p className="form-error">{error}</p> : null}
      {notice ? <p className="form-success">{notice}</p> : null}
      <div className="file-toolbox">
        <label>
          <span>新目录</span>
          <input
            value={directoryPath}
            onChange={(event) => setDirectoryPath(event.target.value)}
            placeholder="docs 或 C:\path\docs"
            disabled={busy}
          />
        </label>
        <button type="button" onClick={handleCreateDirectory} disabled={busy || !directoryPath.trim()}>
          创建目录
        </button>
      </div>
      <div className="file-list">
        {entries.map((entry) => (
          <button className="file-row" type="button" key={entry.path} onClick={() => handleOpen(entry)}>
            <span>{entry.name}</span>
            <small>{entry.isDirectory ? "目录" : "文件"}</small>
          </button>
        ))}
      </div>
      {file ? (
        <article className="file-preview">
          <h3>{file.path}</h3>
          <textarea value={draftText} onChange={(event) => setDraftText(event.target.value)} disabled={busy} />
          <button type="button" onClick={handleSaveFile} disabled={busy}>
            保存文件
          </button>
        </article>
      ) : null}
      <div className="file-toolbox">
        <label>
          <span>复制到</span>
          <input
            value={copyTargetPath}
            onChange={(event) => setCopyTargetPath(event.target.value)}
            placeholder="README.copy.md 或绝对路径"
            disabled={busy}
          />
        </label>
        <button type="button" onClick={handleCopyPath} disabled={busy || !selectedPath() || !copyTargetPath.trim()}>
          复制
        </button>
        <button type="button" onClick={handleReadMetadata} disabled={busy || !selectedPath()}>
          查看元数据
        </button>
        <button type="button" onClick={handleRemovePath} disabled={busy || !selectedPath()}>
          删除
        </button>
      </div>
      {metadata ? (
        <dl className="file-metadata">
          <div>
            <dt>类型</dt>
            <dd>{metadata.isDirectory ? "目录" : metadata.isFile ? "文件" : "其他"}</dd>
          </div>
          <div>
            <dt>符号链接</dt>
            <dd>{metadata.isSymlink ? "是" : "否"}</dd>
          </div>
          <div>
            <dt>修改时间</dt>
            <dd>{new Date(metadata.modifiedAtMs).toLocaleString("zh-CN")}</dd>
          </div>
        </dl>
      ) : null}
    </section>
  );
}
