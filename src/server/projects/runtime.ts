import { getRuntimeConfig } from "../runtime";
import { ProjectCatalogStore } from "./catalog-store";

const globalForProjects = globalThis as typeof globalThis & {
  __codexWebProjectCatalogStore?: ProjectCatalogStore;
};

export function getProjectCatalogStore(): ProjectCatalogStore {
  if (!globalForProjects.__codexWebProjectCatalogStore) {
    globalForProjects.__codexWebProjectCatalogStore = new ProjectCatalogStore({
      dataDir: getRuntimeConfig().dataDir
    });
  }
  return globalForProjects.__codexWebProjectCatalogStore;
}
