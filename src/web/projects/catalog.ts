import {
  normalizeProjectPathKey,
  type ProjectRecord,
  type ServerProjectRecord
} from "../../shared/projects";

export type ProjectPathConflict = {
  local: ProjectRecord;
  server: ServerProjectRecord;
};

export type MergedProjectCatalog = {
  projects: ProjectRecord[];
  conflicts: ProjectPathConflict[];
};

export function mergeProjectCatalog(
  localProjects: ProjectRecord[],
  serverProjects: ServerProjectRecord[]
): MergedProjectCatalog {
  const localByPath = new Map(
    localProjects.map((project) => [normalizeProjectPathKey(project.path), project])
  );
  const serverPaths = new Set<string>();
  const conflicts: ProjectPathConflict[] = [];

  for (const server of serverProjects) {
    const pathKey = normalizeProjectPathKey(server.path);
    serverPaths.add(pathKey);
    const local = localByPath.get(pathKey);
    if (local) {
      conflicts.push({ local, server });
    }
  }

  const projects = [
    ...serverProjects,
    ...localProjects.filter((project) => !serverPaths.has(normalizeProjectPathKey(project.path)))
  ].sort((left, right) => right.lastUsedAt - left.lastUsedAt);

  return { projects, conflicts };
}
export function findProjectByPath(
  projects: ProjectRecord[],
  path: string
): ProjectRecord | undefined {
  const pathKey = normalizeProjectPathKey(path);
  return projects.find((project) => normalizeProjectPathKey(project.path) === pathKey);
}
