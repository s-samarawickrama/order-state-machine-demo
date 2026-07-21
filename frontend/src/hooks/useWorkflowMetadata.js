import { useState, useEffect, useCallback } from "react";
import { fetchWorkflowMetadata } from "@/api/workflowApi";

/**
 * Fetches and caches the workflow configuration metadata (states, transitions, workflows).
 * Called once on mount; can be manually refetched.
 */
export function useWorkflowMetadata() {
  const [workflowConfig, setWorkflowConfig] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchWorkflowMetadata();
      setWorkflowConfig(data);
    } catch (err) {
      console.error("Failed to fetch workflow metadata:", err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { workflowConfig, isLoading, error, refetch };
}
