import { useEffect, useRef, useCallback } from 'react';
import { useSyncStore } from '../stores/syncStore';
import { API_URL } from 'app';
import type { SyncStatusData } from 'types';

interface UseSyncStatusSSEOptions {
  onSyncComplete?: () => void;
  onError?: (error: Error) => void;
}

export function useSyncStatusSSE(options: UseSyncStatusSSEOptions = {}) {
  const { onSyncComplete, onError } = options;

  const {
    isSyncing,
    syncStatus,
    connectionMode,
    pollInterval,
    setSyncStatus,
    setIsConnected,
    setConnectionMode,
    setLastError,
    incrementPollInterval,
    resetPollInterval,
    fetchStatus,
  } = useSyncStore();

  const eventSourceRef = useRef<EventSource | null>(null);
  const pollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const wasSyncingRef = useRef(false);
  const isTabVisibleRef = useRef(true);

  // Handle visibility change
  useEffect(() => {
    const handleVisibilityChange = () => {
      isTabVisibleRef.current = !document.hidden;

      if (!document.hidden && isSyncing) {
        // Tab became visible and sync is running, refresh status
        fetchStatus();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isSyncing, fetchStatus]);

  // Cleanup function
  const cleanup = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current);
      pollTimeoutRef.current = null;
    }
  }, []);

  // Start SSE connection
  const startSSE = useCallback(() => {
    cleanup();

    try {
      const sseUrl = `${API_URL}/routes/sync-status-stream`;
      const eventSource = new EventSource(sseUrl);
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        console.log('[SSE] Connected');
        setIsConnected(true);
        setConnectionMode('sse');
        setLastError(null);
        resetPollInterval();
      };

      eventSource.onmessage = (event) => {
        try {
          const data: SyncStatusData = JSON.parse(event.data);
          setSyncStatus(data);

          // Check if sync just completed
          if (wasSyncingRef.current && !data.is_running) {
            console.log('[SSE] Sync completed');
            onSyncComplete?.();
          }
          wasSyncingRef.current = data.is_running;

          // If sync stopped, close the connection
          if (!data.is_running) {
            eventSource.close();
            eventSourceRef.current = null;
            setIsConnected(false);
            setConnectionMode('disconnected');
          }
        } catch (e) {
          console.error('[SSE] Error parsing message:', e);
        }
      };

      eventSource.onerror = (error) => {
        console.error('[SSE] Error:', error);
        eventSource.close();
        eventSourceRef.current = null;
        setIsConnected(false);

        // Fall back to polling
        console.log('[SSE] Falling back to polling');
        setConnectionMode('polling');
        startPolling();
      };
    } catch (error) {
      console.error('[SSE] Failed to create EventSource:', error);
      setConnectionMode('polling');
      startPolling();
    }
  }, [cleanup, setIsConnected, setConnectionMode, setLastError, setSyncStatus, resetPollInterval, onSyncComplete]);

  // Polling fallback
  const poll = useCallback(async () => {
    // Don't poll if tab is hidden
    if (!isTabVisibleRef.current) {
      pollTimeoutRef.current = setTimeout(poll, pollInterval);
      return;
    }

    try {
      await fetchStatus();

      const status = useSyncStore.getState().syncStatus;

      // Check if sync just completed
      if (wasSyncingRef.current && status && !status.is_running) {
        console.log('[Polling] Sync completed');
        onSyncComplete?.();
        wasSyncingRef.current = false;

        // Stop polling when sync completes
        setConnectionMode('disconnected');
        return;
      }

      wasSyncingRef.current = status?.is_running ?? false;

      // Continue polling while syncing
      if (status?.is_running) {
        resetPollInterval();
        pollTimeoutRef.current = setTimeout(poll, useSyncStore.getState().pollInterval);
      } else {
        setConnectionMode('disconnected');
      }
    } catch (error) {
      console.error('[Polling] Error:', error);
      incrementPollInterval();
      onError?.(error instanceof Error ? error : new Error('Unknown polling error'));

      // Continue polling with backoff
      pollTimeoutRef.current = setTimeout(poll, useSyncStore.getState().pollInterval);
    }
  }, [fetchStatus, pollInterval, resetPollInterval, incrementPollInterval, setConnectionMode, onSyncComplete, onError]);

  const startPolling = useCallback(() => {
    cleanup();
    setConnectionMode('polling');
    poll();
  }, [cleanup, setConnectionMode, poll]);

  // Effect to start SSE/polling when sync starts
  useEffect(() => {
    if (isSyncing && connectionMode === 'disconnected') {
      // Try SSE first, fall back to polling
      startSSE();
    }

    return () => {
      // Only cleanup if sync stopped
      if (!isSyncing) {
        cleanup();
      }
    };
  }, [isSyncing, connectionMode, startSSE, cleanup]);

  // Initial status check on mount
  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    syncStatus,
    isSyncing,
    connectionMode,
    isConnected: connectionMode !== 'disconnected',
  };
}
