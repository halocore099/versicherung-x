
import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import brain from "brain";
import type { RepairCaseDB, FilteredRepairCasesResponse, SyncStatusData } from "brain/data-contracts";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { RefreshCw, AlertTriangle, LogOut, ShieldCheck, ArrowUpDown, ArrowUp, ArrowDown, Search, X, Filter, Menu, History, ChevronLeft, ChevronRight, Moon, Sun } from "lucide-react";
import { useTheme } from "@/extensions/shadcn/hooks/use-theme";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { firebaseAuth, useUserGuardContext, API_URL } from "app";
import { useNavigate } from "react-router-dom";
import RepairCaseDetailModal from "components/RepairCaseDetailModal";
import { Input } from "@/components/ui/input";
import { ADMIN_UIDS } from "utils/authConfig";
import { toast } from "sonner";

// Helper to format date strings
const formatDate = (dateString?: string | null) => {
  if (!dateString) return "N/A";
  try {
    return new Date(dateString).toLocaleDateString("de-DE", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch (e) {
    return "Invalid Date";
  }
};

// Helper to format currency
const formatCurrency = (amount?: number | null) => {
  if (amount === null || typeof amount === "undefined") return "N/A";
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(amount);
};

// Type for sort direction
type SortDirection = "ascending" | "descending";

// Interface for sort configuration
interface SortConfig {
  key: keyof RepairCaseDB | null;
  direction: SortDirection;
}

// Interface for insurance option
interface InsuranceOption {
  value: string;
  label: string;
}

// Interface for time range option
interface TimeRangeOption {
  value: string;
  label: string;
  months: number;
}

// Time range options
const timeRangeOptions: TimeRangeOption[] = [
  { value: "_ALL_TIME_", label: "Alle Zeiträume", months: 0 },
  { value: "LAST_MONTH", label: "Letzter Monat", months: 1 },
  { value: "LAST_3_MONTHS", label: "Letzte 3 Monate", months: 3 },
  { value: "LAST_6_MONTHS", label: "Letzte 6 Monate", months: 6 },
  { value: "LAST_YEAR", label: "Letztes Jahr", months: 12 },
];

export default function DashboardPage() {
  const [cases, setCases] = useState<RepairCaseDB[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [selectedInsurance, setSelectedInsurance] = useState<string>("_ALL_INSURANCES_");
  const [availableInsurances, setAvailableInsurances] = useState<InsuranceOption[]>([]);
  const [currentLogoUrl, setCurrentLogoUrl] = useState<string>("https://static.databutton.com/public/12488b2a-5495-49b3-9146-07e8a9e033b2/986bbf76-fbe1-44f3-b882-8143c72575ea.png");
  const navigate = useNavigate();
  const { user } = useUserGuardContext();
  const { theme, setTheme } = useTheme();

  const [isDetailModalOpen, setIsDetailModalOpen] = useState<boolean>(false);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: null, direction: "ascending" });
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [showActiveOnly, setShowActiveOnly] = useState<boolean>(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [selectedTimeRange, setSelectedTimeRange] = useState<string>("_ALL_TIME_");
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatusData | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(50);
  const [totalPages, setTotalPages] = useState<number>(1);
  const syncStatusIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isSyncInProgressRef = useRef<boolean>(false);

  // Debounced search to improve performance
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState<string>("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Poll sync status when sync is running
  useEffect(() => {
    const checkSyncStatus = async () => {
      try {
        const response = await brain.get_sync_status();
        if (response.ok && response.data) {
          const status = response.data;
          setSyncStatus(status);
          setIsSyncing(status.is_running);
          isSyncInProgressRef.current = status.is_running;
          
          // If sync finished, refresh cases and stop polling
          if (!status.is_running) {
            if (syncStatusIntervalRef.current) {
              clearInterval(syncStatusIntervalRef.current);
              syncStatusIntervalRef.current = null;
            }
            isSyncInProgressRef.current = false;
            // Refresh cases after sync completes
            setTimeout(() => {
              fetchCases(selectedInsurance, currentPage);
            }, 1000);
          }
        }
      } catch (error) {
        console.error("Error checking sync status:", error);
        // On error, assume sync is not running
        setIsSyncing(false);
        isSyncInProgressRef.current = false;
        if (syncStatusIntervalRef.current) {
          clearInterval(syncStatusIntervalRef.current);
          syncStatusIntervalRef.current = null;
        }
      }
    };

    // Check immediately if we think sync is running or if we have sync status
    if (isSyncing || syncStatus?.is_running) {
      checkSyncStatus();
      // Poll every 2 seconds while syncing
      if (!syncStatusIntervalRef.current) {
        syncStatusIntervalRef.current = setInterval(checkSyncStatus, 2000);
      }
    }

    return () => {
      if (syncStatusIntervalRef.current) {
        clearInterval(syncStatusIntervalRef.current);
        syncStatusIntervalRef.current = null;
      }
    };
  }, [isSyncing, selectedInsurance, currentPage, syncStatus?.is_running]);

  // Helper function to check sync status and start polling if needed
  // This function is non-destructive - it only updates status, never clears it unless backend confirms sync is done
  const checkSyncStatusAndStartPolling = useCallback(async () => {
    try {
      const response = await brain.get_sync_status();
      if (response.ok && response.data) {
        const status = response.data;
        
        // Always update sync status with latest data from backend
        setSyncStatus(status);
        setIsSyncing(status.is_running);
        isSyncInProgressRef.current = status.is_running;
        
        // Start polling if sync is running and we're not already polling
        if (status.is_running && !syncStatusIntervalRef.current) {
          syncStatusIntervalRef.current = setInterval(async () => {
            const pollResponse = await brain.get_sync_status();
            if (pollResponse.ok && pollResponse.data) {
              const pollStatus = pollResponse.data;
              setSyncStatus(pollStatus);
              setIsSyncing(pollStatus.is_running);
              isSyncInProgressRef.current = pollStatus.is_running;
              if (!pollStatus.is_running) {
                if (syncStatusIntervalRef.current) {
                  clearInterval(syncStatusIntervalRef.current);
                  syncStatusIntervalRef.current = null;
                }
                isSyncInProgressRef.current = false;
                // Refresh cases after sync completes - use current state values
                setTimeout(() => {
                  // Use a function to get current values at execution time
                  const currentInsurance = selectedInsurance;
                  const currentPageNum = currentPage;
                  fetchCases(currentInsurance, currentPageNum);
                }, 1000);
              }
            }
          }, 2000);
        } else if (!status.is_running && syncStatusIntervalRef.current) {
          // Only stop polling if backend explicitly says sync is not running
          // This ensures we don't clear sync status prematurely
          clearInterval(syncStatusIntervalRef.current);
          syncStatusIntervalRef.current = null;
          isSyncInProgressRef.current = false;
        }
        // If sync is not running and we're not polling, that's fine - just don't clear existing state
        // This prevents the progress bar from disappearing during data fetches
      }
    } catch (error) {
      console.error("Error checking sync status:", error);
      // On error, don't clear sync status - just log the error
      // This prevents the progress bar from disappearing due to network issues
      // Only clear if we're certain sync is not running (which we can't be on error)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedInsurance, currentPage]);

  // Check sync status on mount to see if a sync is already running
  useEffect(() => {
    checkSyncStatusAndStartPolling();
  }, [checkSyncStatusAndStartPolling]);

  const fetchCases = async (insuranceFilter: string | null = null, page: number = 1) => {
    setLoading(true);
    setError(null);

    // Always check sync status when fetching cases to see if a sync is running globally
    // Do this asynchronously so it doesn't block the data fetch
    checkSyncStatusAndStartPolling().catch(err => {
      console.error("Error checking sync status during fetch:", err);
      // Don't let sync status check errors affect data fetching
    });

    try {
      const filterToUse = insuranceFilter !== null ? insuranceFilter : selectedInsurance;
      const apiFilterValue = filterToUse === "_ALL_INSURANCES_" ? null : filterToUse;

      // Calculate time range months
      const timeRangeMonths = selectedTimeRange !== "_ALL_TIME_" 
        ? timeRangeOptions.find(opt => opt.value === selectedTimeRange)?.months || null
        : null;

      // Get sort field and direction
      const sortBy = sortConfig.key || "lastApiUpdate";
      const sortDirection = sortConfig.direction === "ascending" ? "asc" : "desc";

      console.log(`[Dashboard.tsx] Fetching cases with filter: ${apiFilterValue || '(all)'}, page: ${page}, limit: ${pageSize}`);

      const response = await brain.get_cases({ 
        insuranceName: apiFilterValue,
        page: page,
        limit: pageSize,
        search: debouncedSearchTerm.trim() || null,
        showActiveOnly: showActiveOnly,
        timeRangeMonths: timeRangeMonths,
        sortBy: sortBy,
        sortDirection: sortDirection
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }

      const data: FilteredRepairCasesResponse = response.data;
      console.log("[Dashboard.tsx] Raw data from API via brain client:", data);

      if (data && Array.isArray(data.cases)) {
        setCases(data.cases);
        setTotalCount(data.total_count || 0);
        setTotalPages(data.total_pages || 1);
        setCurrentPage(data.page || 1);

        if (data.cases.length === 0) {
          console.log("[Dashboard.tsx] No repair cases found after filtering.");
        }

        // Only update insurance list on first page load when no insurances are loaded yet
        if (page === 1 && (filterToUse === "_ALL_INSURANCES_" || !filterToUse) && availableInsurances.length === 0 && data.cases.length > 0) {
          // For insurance list, we might want to fetch all cases or use a separate endpoint
          // For now, we'll use the cases we have
          const uniqueInsurances = Array.from(
            new Set(
              data.cases
                .map(c => c.insuranceName)
                .filter(name => name && name.toLowerCase() !== 'wertgarantie')
            )
          ).sort((a, b) => (a || "").localeCompare(b || ""));

          const options: InsuranceOption[] = [
            { value: "_ALL_INSURANCES_", label: "Alle Versicherungen" },
            ...uniqueInsurances.map(name => ({ value: name || "", label: name || "N/A" }))
          ];

          setAvailableInsurances(options.filter(opt => opt.value !== ""));
        }
      } else {
        throw new Error("Invalid data format received from API");
      }
    } catch (err: any) {
      console.error("[Dashboard.tsx] Error fetching repair cases:", err);
      const errorMessage = err.message || "An unexpected error occurred while fetching repair cases.";
      setError(errorMessage);
      setCases([]);
      setTotalCount(0);
      setTotalPages(1);
      toast.error("Fehler beim Laden der Daten", {
        description: errorMessage,
      });
    } finally {
      setLoading(false);
    }
  };

  // Filters and sorting are now handled by the backend
  // We just use the cases directly from the API
  const filteredAndSortedCases = cases;

  const requestSort = useCallback((key: keyof RepairCaseDB) => {
    setSortConfig(current => {
      if (current.key === key) {
        const newDirection = current.direction === "ascending" ? "descending" : "ascending";
        return {
          key,
          direction: newDirection
        };
      } else {
        return { key, direction: "ascending" };
      }
    });
  }, []);

  const clearSearch = useCallback(() => {
    setSearchTerm("");
  }, []);

  const handleInsuranceChange = useCallback((value: string) => {
    setSelectedInsurance(value);
    setCurrentPage(1); // Reset to first page when filter changes
    fetchCases(value, 1);
  }, []);

  const handlePageChange = useCallback((page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      fetchCases(selectedInsurance, page);
      // Scroll to top of table
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [totalPages, selectedInsurance]);

  // Refetch when filters change (debounced search, active-only, time range)
  useEffect(() => {
    // Reset to page 1 when filters change
    setCurrentPage(1);
  }, [debouncedSearchTerm, showActiveOnly, selectedTimeRange]);

  // Refetch when page changes or when filters change
  useEffect(() => {
    fetchCases(selectedInsurance, currentPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, debouncedSearchTerm, showActiveOnly, selectedTimeRange, sortConfig, pageSize]);

  // Initial fetch on mount
  useEffect(() => {
    fetchCases("_ALL_INSURANCES_", 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  useEffect(() => {
    console.log("[Dashboard.tsx] selectedInsurance changed to:", selectedInsurance);
    if (selectedInsurance === "S-Mobilegeräteschutz") {
      setCurrentLogoUrl("https://static.databutton.com/public/12488b2a-5495-49b3-9146-07e8a9e033b2/986bbf76-fbe1-44f3-b882-8143c72575ea.png");
    } else if (selectedInsurance === "Haspa Versicherung") {
      setCurrentLogoUrl("https://static.databutton.com/public/12488b2a-5495-49b3-9146-07e8a9e033b2/986bbf76-fbe1-44f3-b882-8143c72575ea.png");
    } else {
      setCurrentLogoUrl("https://static.databutton.com/public/12488b2a-5495-49b3-9146-07e8a9e033b2/986bbf76-fbe1-44f3-b882-8143c72575ea.png");
    }
  }, [selectedInsurance]);

  const handleLogout = async () => {
    try {
      await firebaseAuth.signOut();
      navigate("/");
    } catch (err) {
      console.error("Logout failed:", err);
      setError(err instanceof Error ? err.message : "Logout fehlgeschlagen.");
    }
  };

  const statusMessage = useMemo(() => {
    const count = totalCount;
    const caseWord = count === 1 ? "Fall" : "Fälle";
    let message = `${count} ${showActiveOnly ? 'aktive ' : ''}${caseWord}`;

    if (selectedInsurance !== "_ALL_INSURANCES_") {
      const insuranceLabel = availableInsurances.find(ins => ins.value === selectedInsurance)?.label || selectedInsurance;
      message += ` für ${insuranceLabel}`;
    }

    if (selectedTimeRange !== "_ALL_TIME_") {
      const timeLabel = timeRangeOptions.find(opt => opt.value === selectedTimeRange)?.label;
      message += ` (${timeLabel})`;
    }

    if (debouncedSearchTerm) {
      message += ` (gefiltert)`;
    }

    return message;
  }, [totalCount, selectedInsurance, availableInsurances, debouncedSearchTerm, showActiveOnly, selectedTimeRange]);

  // Helper function to check if sync can be started
  const canStartSync = useCallback(async (): Promise<boolean> => {
    // Check local state first
    if (isSyncInProgressRef.current || isSyncing) {
      return false;
    }
    
    // Check backend status
    try {
      const response = await brain.get_sync_status();
      if (response.ok && response.data) {
        const status = response.data;
        if (status.is_running) {
          setSyncStatus(status);
          setIsSyncing(true);
          isSyncInProgressRef.current = true;
          return false;
        }
      }
    } catch (error) {
      console.error("Error checking sync status before starting:", error);
      // Allow sync to proceed if we can't check status (might be network issue)
    }
    
    return true;
  }, [isSyncing]);

  // Helper function to start sync with protection
  const startSync = useCallback(async (syncType: 'sync' | 'syncAll') => {
    // Check if sync is already in progress
    const canStart = await canStartSync();
    if (!canStart) {
      toast.info("Sync läuft bereits...", {
        description: "Bitte warten Sie, bis die aktuelle Synchronisierung abgeschlossen ist.",
      });
      return;
    }

    // Set local state immediately to prevent button spam
    setIsSyncing(true);
    isSyncInProgressRef.current = true;
    
    // Immediately check status to show progress bar
    try {
      const statusResponse = await brain.get_sync_status();
      if (statusResponse.ok && statusResponse.data) {
        setSyncStatus(statusResponse.data);
      }
    } catch (error) {
      console.error("Error fetching initial sync status:", error);
    }

    try {
      const response = syncType === 'syncAll' 
        ? await brain.trigger_sync_all()
        : await brain.trigger_sync();
      
      if (response.ok) {
        toast.success(syncType === 'syncAll' ? "Sync All gestartet" : "Sync gestartet", {
          description: syncType === 'syncAll' 
            ? "Alle Fälle werden synchronisiert. Die API-Timestamp wird nur bei Änderungen aktualisiert."
            : "Die Synchronisierung läuft im Hintergrund. Die Daten werden automatisch aktualisiert.",
        });
        
        // Immediately fetch status again to show progress
        setTimeout(async () => {
          try {
            const statusResponse = await brain.get_sync_status();
            if (statusResponse.ok && statusResponse.data) {
              setSyncStatus(statusResponse.data);
              setIsSyncing(statusResponse.data.is_running);
              isSyncInProgressRef.current = statusResponse.data.is_running;
            }
          } catch (error) {
            console.error("Error fetching sync status after start:", error);
          }
        }, 500);
      } else {
        toast.error(syncType === 'syncAll' ? "Sync All fehlgeschlagen" : "Sync fehlgeschlagen", {
          description: "Die Synchronisierung konnte nicht gestartet werden.",
        });
        setIsSyncing(false);
        isSyncInProgressRef.current = false;
      }
    } catch (error) {
      toast.error("Fehler beim Starten des Syncs", {
        description: error instanceof Error ? error.message : "Unbekannter Fehler",
      });
      setIsSyncing(false);
      isSyncInProgressRef.current = false;
    }
  }, [canStartSync]);

  // Toggle theme
  const toggleTheme = useCallback(() => {
    const currentTheme = theme === "system" 
      ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
      : theme;
    setTheme(currentTheme === "dark" ? "light" : "dark");
  }, [theme, setTheme]);

  const isDarkMode = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      {/* Navigation Header */}
      <div className="sticky top-0 z-50 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-gray-200/60 dark:border-slate-700/60 shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            {/* Logo and Title */}
            <div className="flex items-center space-x-4">
              <img src={currentLogoUrl} alt="Company Logo" className="h-10 w-auto" />
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent">
                  Justcom Dashboard
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-300">{statusMessage}</p>
              </div>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center space-x-3">
              {user && ADMIN_UIDS.includes(user.uid) && (
                <Button
                  variant="ghost"
                  onClick={() => navigate('/old-case-export')}
                  size="sm"
                  className="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400"
                >
                  <History className="h-4 w-4" />
                </Button>
              )}
              <Button
                onClick={async () => {
                  // Check sync status first, then refresh cases
                  await checkSyncStatusAndStartPolling();
                  fetchCases(selectedInsurance, currentPage);
                }}
                disabled={loading}
                variant="ghost"
                size="sm"
                className="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              </Button>
              
              <Button
                onClick={() => startSync('sync')}
                variant="ghost"
                size="sm"
                disabled={isSyncing}
                className="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400"
              >
                <RefreshCw className={`h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
                <span className="ml-2">{isSyncing ? "Sync läuft..." : "Sync"}</span>
              </Button>
              
              <Button
                onClick={() => startSync('syncAll')}
                variant="ghost"
                size="sm"
                disabled={isSyncing}
                className="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400"
                title="Synchronisiert alle Fälle. API-Timestamp wird nur bei Änderungen aktualisiert."
              >
                <RefreshCw className={`h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
                <span className="ml-2">{isSyncing ? "Sync läuft..." : "Sync All"}</span>
              </Button>

              {/* Theme Toggle */}
              <Button
                onClick={toggleTheme}
                variant="ghost"
                size="sm"
                className="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400"
                title={isDarkMode ? "Zu hellem Modus wechseln" : "Zu dunklem Modus wechseln"}
              >
                {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>

              {user && ADMIN_UIDS.includes(user.uid) && (
                <Button
                  onClick={() => navigate("/AdminUsersPage")}
                  variant="ghost"
                  size="sm"
                  className="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400"
                >
                  <ShieldCheck className="h-4 w-4" />
                </Button>
              )}

              <Button
                onClick={handleLogout}
                variant="ghost"
                size="sm"
                className="text-gray-600 dark:text-gray-300 hover:text-red-600 dark:hover:text-red-400"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>

            {/* Mobile Menu Button */}
            <div className="lg:hidden">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                <Menu className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* Mobile Menu */}
          {mobileMenuOpen && (
            <div className="lg:hidden mt-4 p-4 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-gray-200 dark:border-slate-700">
              <div className="flex flex-col space-y-2">
                <Button onClick={async () => {
                  await checkSyncStatusAndStartPolling();
                  fetchCases(selectedInsurance, currentPage);
                }} disabled={loading} variant="ghost" className="justify-start text-gray-700 dark:text-gray-200">
                  <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                  Aktualisieren
                </Button>

                <Button onClick={() => startSync('sync')} disabled={isSyncing} variant="ghost" className="justify-start text-gray-700 dark:text-gray-200">
                  <RefreshCw className={`mr-2 h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
                  {isSyncing ? "Sync läuft..." : "Sync"}
                </Button>

                <Button onClick={() => startSync('syncAll')} disabled={isSyncing} variant="ghost" className="justify-start text-gray-700 dark:text-gray-200">
                  <RefreshCw className={`mr-2 h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
                  {isSyncing ? "Sync läuft..." : "Sync All"}
                </Button>

                <Button onClick={toggleTheme} variant="ghost" className="justify-start text-gray-700 dark:text-gray-200">
                  {isDarkMode ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
                  {isDarkMode ? "Heller Modus" : "Dunkler Modus"}
                </Button>

                {user && ADMIN_UIDS.includes(user.uid) && (
                  <Button onClick={() => navigate("/AdminUsersPage")} variant="ghost" className="justify-start text-gray-700 dark:text-gray-200">
                    <ShieldCheck className="mr-2 h-4 w-4" />
                    Benutzer Verwalten
                  </Button>
                )}

                <Button onClick={handleLogout} variant="ghost" className="justify-start text-red-600 dark:text-red-400">
                  <LogOut className="mr-2 h-4 w-4" />
                  Abmelden
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        {/* Sync Status Indicator */}
        {/* Show progress bar if sync is running OR if we have sync status indicating it's running */}
        {(syncStatus?.is_running === true || isSyncing === true || isSyncInProgressRef.current) && (
          <Card className="mb-6 shadow-lg border-2 border-blue-200 dark:border-blue-700 bg-blue-50/80 dark:bg-blue-900/20 backdrop-blur-sm">
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <RefreshCw className="h-5 w-5 text-blue-600 dark:text-blue-400 animate-spin" />
                  <h3 className="font-semibold text-blue-900 dark:text-blue-100">Synchronisierung läuft...</h3>
                </div>
                {syncStatus?.elapsed_seconds !== null && syncStatus.elapsed_seconds !== undefined && (
                  <span className="text-sm text-blue-700 dark:text-blue-300">
                    {Math.floor(syncStatus.elapsed_seconds / 60)}:{(Math.floor(syncStatus.elapsed_seconds % 60)).toString().padStart(2, '0')}
                  </span>
                )}
              </div>
              
              {syncStatus && syncStatus.stats && syncStatus.stats.total_cases > 0 && (
                <>
                  <Progress 
                    value={(syncStatus.stats.processed / syncStatus.stats.total_cases) * 100} 
                    className="mb-3 h-2"
                  />
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                    <div>
                      <span className="text-gray-600 dark:text-gray-300">Fortschritt: </span>
                      <span className="font-semibold text-blue-700 dark:text-blue-300">
                        {syncStatus.stats.processed} / {syncStatus.stats.total_cases}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-300">Aktualisiert: </span>
                      <span className="font-semibold text-green-700 dark:text-green-400">{syncStatus.stats.upserted}</span>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-300">Übersprungen: </span>
                      <span className="font-semibold text-yellow-700 dark:text-yellow-400">
                        {syncStatus.stats.skipped_no_change + syncStatus.stats.skipped_not_insurance}
                      </span>
                    </div>
                    {syncStatus.stats.errors > 0 && (
                      <div>
                        <span className="text-gray-600 dark:text-gray-300">Fehler: </span>
                        <span className="font-semibold text-red-700 dark:text-red-400">{syncStatus.stats.errors}</span>
                      </div>
                    )}
                  </div>
                </>
              )}
              {(!syncStatus || !syncStatus.stats || syncStatus.stats.total_cases === 0) && (
                <div className="text-sm text-gray-600 dark:text-gray-300">
                  Synchronisierung wird gestartet...
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Filters Card */}
        <Card className="mb-8 shadow-lg border-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Suche in Tabelle..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-10 border-gray-300 dark:border-slate-600 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-700 dark:text-slate-100"
                />
                {searchTerm && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearSearch}
                    className="absolute right-1 top-1/2 -translate-y-1/2 transform h-6 w-6 p-0 flex items-center justify-center"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>

              {/* Insurance Filter */}
              {availableInsurances.length > 0 && (
                <Select value={selectedInsurance} onValueChange={handleInsuranceChange}>
                  <SelectTrigger className="border-gray-300 focus:ring-blue-500 focus:border-blue-500">
                    <SelectValue placeholder="Versicherung auswählen..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableInsurances.map(ins => (
                      <SelectItem key={ins.value} value={ins.value}>
                        {ins.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {/* Time Range Filter */}
              <Select value={selectedTimeRange} onValueChange={setSelectedTimeRange}>
                <SelectTrigger className="border-gray-300 focus:ring-blue-500 focus:border-blue-500">
                  <SelectValue placeholder="Zeitraum auswählen..." />
                </SelectTrigger>
                <SelectContent>
                  {timeRangeOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Active Cases Toggle */}
              <div className="flex items-center space-x-3 px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700">
                <Filter className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                <label className="text-sm font-medium text-gray-700 dark:text-gray-200 cursor-pointer flex-1" htmlFor="active-toggle">
                  Nur aktive Fälle
                </label>
                <button
                  id="active-toggle"
                  type="button"
                  onClick={() => setShowActiveOnly(!showActiveOnly)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${showActiveOnly ? 'bg-blue-600' : 'bg-gray-300'
                    }`}
                >
                  <span
                    className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${showActiveOnly ? 'translate-x-5' : 'translate-x-1'
                      }`}
                  />
                </button>
              </div>

              {/* Page Size Selector */}
              <Select 
                value={pageSize.toString()} 
                onValueChange={(value) => {
                  setPageSize(Number(value));
                  setCurrentPage(1);
                  fetchCases(selectedInsurance, 1);
                }}
              >
                <SelectTrigger className="border-gray-300 focus:ring-blue-500 focus:border-blue-500 w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="25">25 pro Seite</SelectItem>
                  <SelectItem value="50">50 pro Seite</SelectItem>
                  <SelectItem value="100">100 pro Seite</SelectItem>
                  <SelectItem value="200">200 pro Seite</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>

        {error && (
          <>
            {error?.toLowerCase().includes("invalid data format") ? (
              <Card className="mb-6 border border-amber-200 dark:border-amber-700 shadow-lg bg-gradient-to-br from-amber-50 to-red-50 dark:from-amber-900/20 dark:to-red-900/20">
                <div className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="mt-1">
                      <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Unerwartetes Datenformat</h3>
                      <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                        Die API hat Daten in einem unerwarteten Format zurückgegeben. Bitte versuchen Sie es erneut oder starten Sie eine Synchronisierung.
                      </p>
                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        <Button onClick={async () => {
                          await checkSyncStatusAndStartPolling();
                          fetchCases(selectedInsurance, currentPage);
                        }} disabled={loading}>
                          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                          Erneut laden
                        </Button>
                        <Button
                          onClick={() => startSync('sync')}
                          variant="outline"
                          disabled={isSyncing}
                          className="border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400"
                        >
                          <RefreshCw className={`mr-2 h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
                          {isSyncing ? "Sync läuft..." : "Sync jetzt starten"}
                        </Button>
                      </div>
                      <div className="mt-4 rounded-md bg-white/70 dark:bg-slate-800/70 p-3 text-xs text-gray-700 dark:text-gray-300 border border-amber-100 dark:border-amber-800">
                        <div className="font-medium mb-1">Technische Details</div>
                        <pre className="whitespace-pre-wrap break-words">{error}</pre>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            ) : (
              <Alert variant="destructive" className="mb-6 border-red-200 bg-red-50">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Fehler</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </>
        )}

        {loading ? (
          <Card className="shadow-lg border-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
            <div className="p-6 space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center space-x-4 p-4 border dark:border-slate-700 rounded-lg bg-gray-50 dark:bg-slate-700/50">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                  <Skeleton className="h-8 w-24" />
                </div>
              ))}
            </div>
          </Card>
        ) : !error && filteredAndSortedCases.length === 0 ? (
          <Card className="shadow-lg border-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
            <div className="text-center py-16">
              <div className="mx-auto w-24 h-24 bg-gray-100 dark:bg-slate-700 rounded-full flex items-center justify-center mb-4">
                <Search className="h-8 w-8 text-gray-400 dark:text-gray-500" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Keine Fälle gefunden</h3>
              <p className="text-gray-600 dark:text-gray-300 max-w-md mx-auto">
                {debouncedSearchTerm ?
                  `Keine Fälle für Ihre Suche "${debouncedSearchTerm}" gefunden.` :
                  (selectedInsurance !== "_ALL_INSURANCES_" ?
                    "Keine Fälle für die ausgewählte Versicherung gefunden." :
                    "Keine aktiven Reparaturfälle mit Versicherungsschutz gefunden."
                  )
                }
              </p>
            </div>
          </Card>
        ) : !error && filteredAndSortedCases.length > 0 ? (
          <Card className="shadow-lg border-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-slate-700 dark:to-slate-800">
                    <TableHead
                      className="text-gray-700 dark:text-gray-200 font-semibold cursor-pointer hover:bg-gray-200/50 dark:hover:bg-slate-700/50 transition-colors"
                      onClick={() => requestSort("insuranceContractNumber")}
                    >
                      <div className="flex items-center">
                        Versicherungsnr.
                        {sortConfig.key === "insuranceContractNumber" ? (
                          sortConfig.direction === "ascending" ?
                            <ArrowUp className="ml-2 h-4 w-4 text-blue-600" /> :
                            <ArrowDown className="ml-2 h-4 w-4 text-blue-600" />
                        ) : (
                          <ArrowUpDown className="ml-2 h-4 w-4 opacity-30" />
                        )}
                      </div>
                    </TableHead>
                    <TableHead
                      className="text-gray-700 font-semibold cursor-pointer hover:bg-gray-200/50 transition-colors"
                      onClick={() => requestSort("caseNumber")}
                    >
                      <div className="flex items-center">
                        Fallnummer
                        {sortConfig.key === "caseNumber" ? (
                          sortConfig.direction === "ascending" ?
                            <ArrowUp className="ml-2 h-4 w-4 text-blue-600" /> :
                            <ArrowDown className="ml-2 h-4 w-4 text-blue-600" />
                        ) : (
                          <ArrowUpDown className="ml-2 h-4 w-4 opacity-30" />
                        )}
                      </div>
                    </TableHead>
                    <TableHead
                      className="text-gray-700 font-semibold cursor-pointer hover:bg-gray-200/50 transition-colors"
                      onClick={() => requestSort("customerName")}
                    >
                      <div className="flex items-center">
                        Kunde
                        {sortConfig.key === "customerName" ? (
                          sortConfig.direction === "ascending" ?
                            <ArrowUp className="ml-2 h-4 w-4 text-blue-600" /> :
                            <ArrowDown className="ml-2 h-4 w-4 text-blue-600" />
                        ) : (
                          <ArrowUpDown className="ml-2 h-4 w-4 opacity-30" />
                        )}
                      </div>
                    </TableHead>
                    <TableHead
                      className="text-gray-700 font-semibold cursor-pointer hover:bg-gray-200/50 transition-colors"
                      onClick={() => requestSort("productName")}
                    >
                      <div className="flex items-center">
                        Produkt
                        {sortConfig.key === "productName" ? (
                          sortConfig.direction === "ascending" ?
                            <ArrowUp className="ml-2 h-4 w-4 text-blue-600" /> :
                            <ArrowDown className="ml-2 h-4 w-4 text-blue-600" />
                        ) : (
                          <ArrowUpDown className="ml-2 h-4 w-4 opacity-30" />
                        )}
                      </div>
                    </TableHead>
                    <TableHead
                      className="text-gray-700 font-semibold cursor-pointer hover:bg-gray-200/50 transition-colors"
                      onClick={() => requestSort("status")}
                    >
                      <div className="flex items-center">
                        Status
                        {sortConfig.key === "status" ? (
                          sortConfig.direction === "ascending" ?
                            <ArrowUp className="ml-2 h-4 w-4 text-blue-600" /> :
                            <ArrowDown className="ml-2 h-4 w-4 text-blue-600" />
                        ) : (
                          <ArrowUpDown className="ml-2 h-4 w-4 opacity-30" />
                        )}
                      </div>
                    </TableHead>
                    <TableHead
                      className="text-gray-700 font-semibold cursor-pointer hover:bg-gray-200/50 transition-colors"
                      onClick={() => requestSort("insuranceName")}
                    >
                      <div className="flex items-center">
                        Versicherung
                        {sortConfig.key === "insuranceName" ? (
                          sortConfig.direction === "ascending" ?
                            <ArrowUp className="ml-2 h-4 w-4 text-blue-600" /> :
                            <ArrowDown className="ml-2 h-4 w-4 text-blue-600" />
                        ) : (
                          <ArrowUpDown className="ml-2 h-4 w-4 opacity-30" />
                        )}
                      </div>
                    </TableHead>
                    <TableHead
                      className="text-right text-gray-700 font-semibold cursor-pointer hover:bg-gray-200/50 transition-colors"
                      onClick={() => requestSort("lastApiUpdate")}
                    >
                      <div className="flex items-center justify-end">
                        Letzte Änderung
                        {sortConfig.key === "lastApiUpdate" ? (
                          sortConfig.direction === "ascending" ?
                            <ArrowUp className="ml-2 h-4 w-4 text-blue-600" /> :
                            <ArrowDown className="ml-2 h-4 w-4 text-blue-600" />
                        ) : (
                          <ArrowUpDown className="ml-2 h-4 w-4 opacity-30" />
                        )}
                      </div>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAndSortedCases.map((caseItem, index) => (
                    <TableRow
                      key={caseItem.caseId}
                      onClick={() => {
                        setSelectedCaseId(caseItem.caseId);
                        setIsDetailModalOpen(true);
                      }}
                      className={`cursor-pointer transition-all duration-200 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:shadow-sm ${index % 2 === 0 ? 'bg-white dark:bg-slate-800' : 'bg-gray-50/50 dark:bg-slate-700/30'
                        }`}
                    >
                      <TableCell className="font-medium text-gray-900 dark:text-gray-100">{caseItem.insuranceContractNumber || "N/A"}</TableCell>
                      <TableCell className="font-medium text-blue-600 dark:text-blue-400">{caseItem.caseNumber || "N/A"}</TableCell>
                      <TableCell className="text-gray-700 dark:text-gray-300">{caseItem.customerName || "N/A"}</TableCell>
                      <TableCell className="text-gray-700 dark:text-gray-300">{caseItem.productName || "N/A"}</TableCell>
                      <TableCell className="text-gray-700 dark:text-gray-300">{caseItem.status || "N/A"}</TableCell>
                      <TableCell className="text-gray-700 dark:text-gray-300">{caseItem.insuranceName || "N/A"}</TableCell>
                      <TableCell className="text-right text-gray-700 dark:text-gray-300">{formatDate(caseItem.lastApiUpdate)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            
            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="p-4 border-t border-gray-200 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-700/30">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div className="text-sm text-gray-600 dark:text-gray-300">
                    Zeige {((currentPage - 1) * pageSize) + 1} - {Math.min(currentPage * pageSize, totalCount)} von {totalCount} Fällen
                  </div>
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious 
                          onClick={() => handlePageChange(currentPage - 1)}
                          className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                      </PaginationItem>
                      
                      {/* Page numbers */}
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum: number;
                        if (totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (currentPage <= 3) {
                          pageNum = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i;
                        } else {
                          pageNum = currentPage - 2 + i;
                        }
                        
                        return (
                          <PaginationItem key={pageNum}>
                            <PaginationLink
                              onClick={() => handlePageChange(pageNum)}
                              isActive={currentPage === pageNum}
                              className="cursor-pointer"
                            >
                              {pageNum}
                            </PaginationLink>
                          </PaginationItem>
                        );
                      })}
                      
                      {totalPages > 5 && currentPage < totalPages - 2 && (
                        <PaginationItem>
                          <PaginationEllipsis />
                        </PaginationItem>
                      )}
                      
                      <PaginationItem>
                        <PaginationNext 
                          onClick={() => handlePageChange(currentPage + 1)}
                          className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              </div>
            )}
          </Card>
        ) : null}

        <RepairCaseDetailModal
          isOpen={isDetailModalOpen}
          onOpenChange={setIsDetailModalOpen}
          caseId={selectedCaseId}
        />
      </div>
    </div>
  );
}