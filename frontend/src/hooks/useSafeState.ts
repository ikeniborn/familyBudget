import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * Безопасный setState который не вызывает обновление после unmount компонента
 * Предотвращает ошибку "Can't perform a React state update on an unmounted component"
 */
export function useSafeState<T>(initialState: T | (() => T)) {
  const [state, setState] = useState(initialState);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const setSafeState = useCallback((newState: T | ((prevState: T) => T)) => {
    if (isMountedRef.current) {
      setState(newState);
    }
  }, []);

  return [state, setSafeState] as const;
}