import { create } from 'zustand';
import brain from 'brain';
import type { SyncStatusData } from 'types';

type ConnectionMode = 'sse' | 'polling' | 'disconnected';

interface SyncState {
  // Connection state
  isConnected: boolean;
  connectionMode: ConnectionMode;
  pollInterval: number;
  lastError: string | null;

  // Sync state
  isSyncing: boolean;
  syncStatus: SyncStatusData | null;

  // Actions
  setIsConnected: (connected: boolean) => void;
  setConnectionMode: (mode: ConnectionMode) => void;
  setSyncStatus: (status: SyncStatusData | null) => void;
  setIsSyncing: (syncing: boolean) => void;
  setLastError: (error: string | null) => void;

  // Polling backoff
  incrementPollInterval: () => void;
  resetPollInterval: () => void;

  // Sync actions
  startSync: (type: 'sync' | 'syncAll') => Promise<boolean>;
  fetchStatus: () => Promise<void>;
}

const MIN_POLL_INTERVAL = 2000; // 2 seconds
const MAX_POLL_INTERVAL = 30000; // 30 seconds

export const useSyncStore = create<SyncState>((set, get) => ({
  // Initial state
  isConnected: false,
  connectionMode: 'disconnected',
  pollInterval: MIN_POLL_INTERVAL,
  lastError: null,
  isSyncing: false,
  syncStatus: null,

  // Setters
  setIsConnected: (connected) => set({ isConnected: connected }),
  setConnectionMode: (mode) => set({ connectionMode: mode }),
  setSyncStatus: (status) => set({
    syncStatus: status,
    isSyncing: status?.is_running ?? false,
  }),
  setIsSyncing: (syncing) => set({ isSyncing: syncing }),
  setLastError: (error) => set({ lastError: error }),

  // Polling backoff
  incrementPollInterval: () => set((state) => ({
    pollInterval: Math.min(state.pollInterval * 2, MAX_POLL_INTERVAL),
  })),
  resetPollInterval: () => set({ pollInterval: MIN_POLL_INTERVAL }),

  // Fetch current sync status
  fetchStatus: async () => {
    try {
      const response = await brain.get_sync_status();
      if (response.ok && response.data) {
        set({
          syncStatus: response.data,
          isSyncing: response.data.is_running,
          lastError: null,
        });
        get().resetPollInterval();
      }
    } catch (error) {
      console.error('[SyncStore] Error fetching status:', error);
      set({ lastError: error instanceof Error ? error.message : 'Unknown error' });
      get().incrementPollInterval();
    }
  },

  // Start a sync operation
  startSync: async (type) => {
    const state = get();

    // Prevent duplicate syncs
    if (state.isSyncing) {
      console.log('[SyncStore] Sync already in progress');
      return false;
    }

    // Optimistically set syncing state
    set({ isSyncing: true, lastError: null });

    try {
      const response = type === 'syncAll'
        ? await brain.trigger_sync_all()
        : await brain.trigger_sync();

      if (response.ok) {
        // Fetch status immediately to get initial stats
        await get().fetchStatus();
        return true;
      } else {
        set({ isSyncing: false, lastError: 'Failed to start sync' });
        return false;
      }
    } catch (error) {
      console.error('[SyncStore] Error starting sync:', error);
      set({
        isSyncing: false,
        lastError: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  },
}));

// Selectors for optimized re-renders
export const selectSyncProgress = (state: SyncState) => {
  const stats = state.syncStatus?.stats;
  if (!stats || stats.total_cases === 0) return 0;
  return (stats.processed / stats.total_cases) * 100;
};

export const selectSyncStats = (state: SyncState) => state.syncStatus?.stats ?? null;

export const selectIsSyncing = (state: SyncState) => state.isSyncing;

export const selectSyncType = (state: SyncState) => state.syncStatus?.sync_type ?? null;

export const selectElapsedSeconds = (state: SyncState) => state.syncStatus?.elapsed_seconds ?? null;
