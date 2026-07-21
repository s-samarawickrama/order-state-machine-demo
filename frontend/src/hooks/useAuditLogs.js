import { useState, useCallback, useEffect } from "react";
import { fetchAuditLogs } from "@/api/workflowApi";

/**
 * Fetches audit logs from the backend.
 */
export function useAuditLogs() {
  const [auditLogs, setAuditLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetchAuditLogs();
      setAuditLogs(data);
    } catch (err) {
      console.error("Failed to fetch audit logs:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { auditLogs, isLoading, refetch };
}
