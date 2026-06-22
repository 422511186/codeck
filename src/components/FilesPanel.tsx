"use client";

import { useEffect, useState } from "react";
import { readDirectory, readFile } from "../lib/client-api";
import type { MobileFileContent, MobileFileEntry } from "../shared/codex";

type FilesPanelProps = {
  rootPath: string;
};

export function FilesPanel({ rootPath }: FilesPanelProps) {
  const [currentPath, setCurrentPath] = useState(rootPath);
  const [entries, setEntries] = useState<MobileFileEntry[]>([]);
  const [file, setFile] = useState<MobileFileContent | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadDirectory() {
      setError("");
      setFile(null);
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

    loadDirectory();
    return () => {
      cancelled = true;
    };
  }, [currentPath]);

  useEffect(() => {
    setCurrentPath(rootPath);
  }, [rootPath]);

  async function handleOpen(entry: MobileFileEntry) {
    setError("");
    if (entry.isDirectory) {
      setCurrentPath(entry.path);
      return;
    }

    try {
      setFile(await readFile(entry.path));
    } catch (readError) {
      setError(readError instanceof Error ? readError.message : "无法读取文件");
    }
  }

  return (
    <section className="panel-view" aria-label="文件面板">
      <div className="section-title">
        <h2>文件</h2>
        <span>{entries.length}</span>
      </div>
      <p className="path-line">{currentPath}</p>
      {error ? <p className="form-error">{error}</p> : null}
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
          <pre>{file.text}</pre>
        </article>
      ) : null}
    </section>
  );
}
