/**
 * Toque — Hook de Consulta de Datos (useDataQuery)
 * Manejo de estado liviano con:
 * - 4 estados: cargando, vacío, error, éxito + estado sin conexión
 * - Actualización al volver a la pestaña (focus)
 * - Actualización cada 45 s SOLO si la pestaña está visible
 * - Cero polling innecesario
 */

import { useState, useEffect, useCallback, useRef } from 'react';

interface UseDataQueryOptions<T> {
  queryFn: () => Promise<T>;
  enabled?: boolean;
  refetchIntervalMs?: number; // Por defecto 45.000 ms (45 segundos)
}

export interface UseDataQueryResult<T> {
  data: T | null;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  isOffline: boolean;
  refetch: () => Promise<void>;
}

export function useDataQuery<T>({
  queryFn,
  enabled = true,
  refetchIntervalMs = 45000,
}: UseDataQueryOptions<T>): UseDataQueryResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isError, setIsError] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [isOffline, setIsOffline] = useState<boolean>(!navigator.onLine);

  const queryFnRef = useRef(queryFn);
  queryFnRef.current = queryFn;

  const executeFetch = useCallback(async (isInitial = false) => {
    if (!navigator.onLine) {
      setIsOffline(true);
      if (isInitial) setIsLoading(false);
      return;
    }
    setIsOffline(false);

    if (isInitial) {
      setIsLoading(true);
    }

    try {
      const result = await queryFnRef.current();
      setData(result);
      setIsError(false);
      setError(null);
    } catch (err) {
      setIsError(true);
      setError(err instanceof Error ? err : new Error('Error al cargar datos'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Carga inicial
  useEffect(() => {
    if (enabled) {
      executeFetch(true);
    }
  }, [enabled, executeFetch]);

  // Actualización al volver a la pestaña y cada 45 segundos si es visible
  useEffect(() => {
    if (!enabled) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        executeFetch(false);
      }
    };

    const handleOnline = () => {
      setIsOffline(false);
      executeFetch(false);
    };

    const handleOffline = () => {
      setIsOffline(true);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Intervalo de 45s sólo si está visible
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        executeFetch(false);
      }
    }, refetchIntervalMs);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(timer);
    };
  }, [enabled, executeFetch, refetchIntervalMs]);

  const refetch = useCallback(async () => {
    await executeFetch(false);
  }, [executeFetch]);

  return {
    data,
    isLoading,
    isError,
    error,
    isOffline,
    refetch,
  };
}
