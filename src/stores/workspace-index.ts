import { browser } from '$app/environment';
import { logger } from '$lib/logger';
import { WorkspaceInstance } from '$models/workspace-instance';
import type { WorkspaceSettingsInitial } from '$models/workspace-settings';
import { storage } from './storage';

const log = logger.getSubLogger({ prefix: ['Stores', 'Workspace Index'] });

const workspaceIndexStorageKey = 'workspaces';
const defaultWorkspaceId = 'default';

export type WorkspaceInfo = { id: string; name: string };

function getStorageKey(id: string) {
  return `workspace_${id}`;
}

export class WorkspaceIndex {
  #entries: WorkspaceInfo[];
  #defaultWorkspaceId: string;
  constructor(defaultWorkspaceId: string, entries: WorkspaceInfo[]) {
    this.#defaultWorkspaceId = defaultWorkspaceId;
    this.#entries = entries;
  }

  get entries(): ReadonlyArray<WorkspaceInfo> {
    return this.#entries;
  }

  async getInitialSettings(id: string) {
    const storageKey = getStorageKey(id);
    let storageRecord: WorkspaceSettingsInitial | undefined;
    try {
      storageRecord = (await storage.local.get(storageKey))[storageKey];
    } catch (e) {
      log.warn('An error occurred during loading workspace settings', { id }, e);
    }

    if (!storageRecord) {
      storageRecord = {};
    }

    return storageRecord;
  }

  async get(id: string) {
    const settings = await this.getInitialSettings(id);
    return await WorkspaceInstance.create(settings);
  }

  async getDefault() {
    return { id: this.#defaultWorkspaceId, workspace: await this.get(this.#defaultWorkspaceId) };
  }

  async #updateIndex(updater: (index: WorkspaceInfo[]) => Promise<WorkspaceInfo[]> | WorkspaceInfo[]) {
    this.#entries = await updater(this.#entries);
    if (browser) {
      await storage.local.set({
        [workspaceIndexStorageKey]: { default: this.#defaultWorkspaceId, entries: this.#entries },
      });
    }
  }

  async save(id: string, workspace: WorkspaceInstance | WorkspaceSettingsInitial) {
    const storageKey = getStorageKey(id);
    await this.#updateIndex(index => {
      const item = index.find(wi => wi.id === id);
      const workspaceName = (workspace instanceof WorkspaceInstance ? workspace.name.value : workspace.name) || '';
      if (!item) {
        index.push({ id: id, name: workspaceName });
      } else {
        item.name = workspaceName;
      }

      return index;
    });
    if (workspace instanceof WorkspaceInstance) {
      await workspace.commit(data => storage.local.set({ [storageKey]: data }));
    } else {
      await storage.local.set({ [storageKey]: workspace });
    }
  }

  async delete(...id: string[]) {
    const storageKeys = id.map(m => getStorageKey(m));
    await this.#updateIndex(index => index.filter(f => !id.includes(f.id)));
    await storage.local.remove(storageKeys);
  }

  async wipeAll() {
    await storage.local.clear();
  }

  async setDefault(id: string) {
    this.#defaultWorkspaceId = id;
    await this.#updateIndex(i => i);
  }

  static async create() {
    let indexData: { default: string; entries: WorkspaceInfo[] } | undefined;
    if (browser) {
      try {
        indexData = (await storage.local.get(workspaceIndexStorageKey))[workspaceIndexStorageKey];
      } catch (e) {
        log.warn('An error occurred during loading workspaces info list', e);
      }
    }

    const index = new WorkspaceIndex(indexData?.default || defaultWorkspaceId, indexData?.entries || []);
    if (index.entries.length <= 0 && browser) {
      await index.save(defaultWorkspaceId, await WorkspaceInstance.create({ name: 'Default' }));
    }

    return index;
  }
}

export const Workspaces = await WorkspaceIndex.create();
