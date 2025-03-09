import { useCallback, useRef } from "react";

export const useThrottle = <T extends (...args: any[]) => any>(
    func: T,
    delay: number
  ) => {
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  
    return useCallback((...args: Parameters<T>) => {
      if (!timeoutRef.current) {
        timeoutRef.current = setTimeout(() => {
          timeoutRef.current = null;
        }, delay);
        return func(...args);
      }
    }, [func, delay]);
  };