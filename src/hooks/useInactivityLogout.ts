import { useEffect, useRef } from 'react';
import { useAuth } from '../auth';
import api from '../api';

const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'scroll', 'touchstart'] as const;
/** Tell the API the user is still active — only on real interaction, throttled. */
const ACTIVITY_PING_THROTTLE_MS = 60_000;

export function useInactivityLogout(onTimeout: () => void) {
  const { auth } = useAuth();
  const timerRef = useRef<number | null>(null);
  const deadlineRef = useRef<number>(0);
  const lastPingRef = useRef(0);
  const onTimeoutRef = useRef(onTimeout);

  useEffect(() => {
    onTimeoutRef.current = onTimeout;
  }, [onTimeout]);

  const minutes = auth?.security?.inactivity_logout_minutes ?? 0;

  useEffect(() => {
    if (!minutes || minutes <= 0) {
      return;
    }

    const timeoutMs = minutes * 60 * 1000;

    const clearTimer = () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    const fireIfExpired = () => {
      if (deadlineRef.current > 0 && Date.now() >= deadlineRef.current) {
        clearTimer();
        onTimeoutRef.current();
        return true;
      }
      return false;
    };

    const pingActivity = () => {
      const now = Date.now();
      if (now - lastPingRef.current < ACTIVITY_PING_THROTTLE_MS) return;
      lastPingRef.current = now;
      api.get('/api/me').catch(() => {});
    };

    const schedule = () => {
      clearTimer();
      deadlineRef.current = Date.now() + timeoutMs;
      timerRef.current = window.setTimeout(() => {
        fireIfExpired();
      }, timeoutMs);
    };

    const onActivity = () => {
      if (fireIfExpired()) return;
      schedule();
      pingActivity();
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        fireIfExpired();
      }
    };

    ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, onActivity, { passive: true }));
    document.addEventListener('visibilitychange', onVisibility);
    schedule();

    return () => {
      clearTimer();
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, onActivity));
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [minutes]);
}
