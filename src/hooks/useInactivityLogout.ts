import { useCallback, useEffect, useRef } from 'react';
import { useAuth } from '../auth';
import api from '../api';

const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'scroll', 'touchstart'] as const;

export function useInactivityLogout(onLogout: () => void) {
  const { auth } = useAuth();
  const timerRef = useRef<number | null>(null);
  const onLogoutRef = useRef(onLogout);

  useEffect(() => {
    onLogoutRef.current = onLogout;
  }, [onLogout]);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const schedule = useCallback(() => {
    clearTimer();
    const minutes = auth?.security?.inactivity_logout_minutes ?? 0;
    if (!minutes || minutes <= 0) return;

    timerRef.current = window.setTimeout(() => {
      onLogoutRef.current();
    }, minutes * 60 * 1000);
  }, [auth?.security?.inactivity_logout_minutes, clearTimer]);

  useEffect(() => {
    const minutes = auth?.security?.inactivity_logout_minutes ?? 0;
    if (!minutes || minutes <= 0) {
      clearTimer();
      return;
    }

    const reset = () => schedule();
    ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, reset, { passive: true }));
    schedule();

    return () => {
      clearTimer();
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, reset));
    };
  }, [auth?.security?.inactivity_logout_minutes, clearTimer, schedule]);

  const ping = useCallback(() => {
    if (!auth?.security?.inactivity_logout_minutes) return;
    api.get('/api/me').catch(() => {});
  }, [auth?.security?.inactivity_logout_minutes]);

  useEffect(() => {
    const minutes = auth?.security?.inactivity_logout_minutes ?? 0;
    if (!minutes) return;
    const interval = window.setInterval(ping, Math.min(minutes * 60 * 1000, 5 * 60 * 1000));
    return () => window.clearInterval(interval);
  }, [auth?.security?.inactivity_logout_minutes, ping]);
}
