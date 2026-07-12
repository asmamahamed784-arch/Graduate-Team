import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { apiClient } from '../api/apiClient';

/**
 * Reusable API fetching hook for screens that load backend data.
 * Implements full loading, error, cancel token support, and automatic cleanups.
 */
export const useFetch = (url, options = {}) => {
  const [data, setData] = useState(options.initialData || null);
  const [loading, setLoading] = useState(!!url && !options.lazy);
  const [error, setError] = useState(null);

  const abortControllerRef = useRef(null);

  const fetchData = useCallback(async (customUrl, customOptions = {}) => {
    const fetchUrl = customUrl || url;
    if (!fetchUrl) return;

    // Abort previous request if in flight
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    setError(null);

    try {
      // Connect to the apiClient wrapper which mimics Axios responses
      const response = await apiClient.get(fetchUrl, {
        signal: controller.signal,
        ...options,
        ...customOptions
      });

      setData(response.data);
      if (options.onSuccess) {
        options.onSuccess(response.data);
      }
      return response.data;
    } catch (err) {
      if (axios.isCancel(err) || err.name === 'AbortError') {
        return;
      }
      const errMsg = err.response?.data?.message || err.message || 'Server connection error';
      setError(errMsg);
      if (options.onError) {
        options.onError(errMsg);
      }
      throw err;
    } finally {
      setLoading(false);
    }
  }, [url, options]);

  useEffect(() => {
    if (options.lazy) {
      setLoading(false);
      return;
    }
    fetchData();

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  return {
    data,
    loading,
    error,
    refetch: fetchData,
    setData
  };
};
