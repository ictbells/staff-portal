import { useEffect, useRef } from 'react';
import { useAuth } from '../auth';

/** End the staff SPA session when the absolute max age (from login) is reached. */
export function useSessionMaxLogout(onLogout: () => void) {
  const { auth } = useAuth();
  const onLogoutRef = useRef(onLogout);

  useEffect(() => {
    onLogoutRef.current = onLogout;
  }, [onLogout]);

  useEffect(() => {
    const expiresAt = auth?.security?.session_expires_at;
    if (!expiresAt) return;

    const ms = new Date(expiresAt).getTime() - Date.now();
    if (Number.isNaN(ms)) return;

    if (ms <= 0) {
      onLogoutRef.current();
      return;
    }

    const id = window.setTimeout(() => {
      onLogoutRef.current();
    }, ms);

    return () => window.clearTimeout(id);
  }, [auth?.security?.session_expires_at]);
}
