import path from "node:path";

type PathFlavor = "windows" | "posix";

export type WorkspaceRoot = {
  path: string;
  flavor: PathFlavor;
};

function pathFlavor(value: string): PathFlavor {
  return /^[a-zA-Z]:[\\/]/.test(value) || value.includes("\\") ? "windows" : "posix";
}

function pathApi(flavor: PathFlavor): typeof path.win32 | typeof path.posix {
  return flavor === "windows" ? path.win32 : path.posix;
}

function normalizePath(value: string, flavor = pathFlavor(value)): string {
  return pathApi(flavor).resolve(value);
}

function isSameOrChildPath(candidate: string, root: WorkspaceRoot): boolean {
  const api = pathApi(root.flavor);
  const normalizedCandidate = normalizePath(candidate, root.flavor);
  const relative = api.relative(root.path, normalizedCandidate);
  const samePath =
    root.flavor === "windows"
      ? normalizedCandidate.toLowerCase() === root.path.toLowerCase()
      : normalizedCandidate === root.path;

  return samePath || (relative.length > 0 && !relative.startsWith("..") && !api.isAbsolute(relative));
}

export function normalizeWorkspaceRoots(roots: string[]): WorkspaceRoot[] {
  const normalizedRoots = roots
    .map((root) => root.trim())
    .filter(Boolean)
    .map((root) => {
      const flavor = pathFlavor(root);
      return { path: normalizePath(root, flavor), flavor };
    });

  if (!normalizedRoots.length) {
    throw new Error("至少需要配置一个工作区根目录");
  }

  return normalizedRoots;
}

export function assertPathAllowed(candidatePath: string, roots: WorkspaceRoot[]): string {
  if (!candidatePath.trim()) {
    throw new Error("路径不能为空");
  }

  const matchedRoot = roots.find((root) => isSameOrChildPath(candidatePath, root));
  if (!matchedRoot) {
    throw new Error("路径不在允许的工作区范围内");
  }

  return normalizePath(candidatePath, matchedRoot.flavor);
}

export function assertWorkspaceRootsAllowed(candidateRoots: string[] | undefined, roots: WorkspaceRoot[]): string[] | undefined {
  if (!candidateRoots) {
    return undefined;
  }

  return candidateRoots.map((candidateRoot) => assertPathAllowed(candidateRoot, roots));
}
