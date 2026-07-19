import { getRuntimeConfig } from "../runtime";
import { getAppServerGateway } from "../app-server/runtime";
import { ThreadModelBindingStore } from "./binding-store";
import { CustomModelCatalogStore } from "./catalog-store";
import { ThreadModelSwitchService } from "./switch-service";
import { ThreadModelLifecycleService } from "./lifecycle-service";

const globalForCustomModels = globalThis as typeof globalThis & {
  __codexWebCustomModelCatalogStore?: CustomModelCatalogStore;
  __codexWebThreadModelBindingStore?: ThreadModelBindingStore;
  __codexWebThreadModelSwitchService?: ThreadModelSwitchService;
  __codexWebThreadModelLifecycleService?: ThreadModelLifecycleService;
};

export function getCustomModelCatalogStore(): CustomModelCatalogStore {
  if (!globalForCustomModels.__codexWebCustomModelCatalogStore) {
    globalForCustomModels.__codexWebCustomModelCatalogStore = new CustomModelCatalogStore({
      dataDir: getRuntimeConfig().dataDir
    });
  }
  return globalForCustomModels.__codexWebCustomModelCatalogStore;
}

export function getThreadModelBindingStore(): ThreadModelBindingStore {
  if (!globalForCustomModels.__codexWebThreadModelBindingStore) {
    globalForCustomModels.__codexWebThreadModelBindingStore = new ThreadModelBindingStore({
      dataDir: getRuntimeConfig().dataDir
    });
  }
  return globalForCustomModels.__codexWebThreadModelBindingStore;
}

export function getThreadModelSwitchService(): ThreadModelSwitchService {
  if (!globalForCustomModels.__codexWebThreadModelSwitchService) {
    globalForCustomModels.__codexWebThreadModelSwitchService = new ThreadModelSwitchService({
      catalogStore: getCustomModelCatalogStore(),
      bindingStore: getThreadModelBindingStore(),
      gateway: getAppServerGateway()
    });
  }
  return globalForCustomModels.__codexWebThreadModelSwitchService;
}

export function getThreadModelLifecycleService(): ThreadModelLifecycleService {
  if (!globalForCustomModels.__codexWebThreadModelLifecycleService) {
    globalForCustomModels.__codexWebThreadModelLifecycleService = new ThreadModelLifecycleService({
      catalogStore: getCustomModelCatalogStore(),
      bindingStore: getThreadModelBindingStore(),
      gateway: getAppServerGateway(),
      switchService: getThreadModelSwitchService()
    });
  }
  return globalForCustomModels.__codexWebThreadModelLifecycleService;
}
