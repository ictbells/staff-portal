import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import api from './api';

export type RolePermissionGroup = {
  role: { id: number; name: string; slug: string };
  permissions: { key: string; label: string; module: string }[];
};

export type SecurityPolicy = {
  two_factor_policy_enabled: boolean;
  two_factor_configured: boolean;
  password_rotation_days: number;
  password_change_required: boolean;
  password_expires_at: string | null;
  inactivity_logout_minutes: number;
  session_max_hours?: number;
  session_expires_at?: string | null;
};

export type AuthState = {
  user: any;
  roles: { id: number; name: string; slug: string }[];
  permissions: string[];
  role_permissions?: RolePermissionGroup[];
  portal_access: boolean;
  is_student: boolean;
  is_staff?: boolean;
  nav_unrestricted?: boolean;
  nav_link_keys?: string[] | null;
  is_office_hod?: boolean;
  is_office_unit_head?: boolean;
  security?: SecurityPolicy;
  lifecycle_stage?: string;
  unpaid_application_fee?: boolean;
  unpaid_acceptance_fee?: boolean;
  application_id?: number;
  university: { name: string; motto: string };
};

const Ctx = createContext<{
  auth: AuthState | null;
  loading: boolean;
  has: (key: string) => boolean;
  refresh: () => Promise<void>;
  setAuth: (a: AuthState | null) => void;
}>({ auth: null, loading: true, has: () => false, refresh: async () => {}, setAuth: () => {} });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [auth, setAuth] = useState<AuthState | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    if (!sessionStorage.getItem('bells_token')) {
      setAuth(null);
      setLoading(false);
      return;
    }
    try {
      const { data } = await api.get('/api/me');
      setAuth(data);
    } catch {
      setAuth(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const value = useMemo(
    () => ({
      auth,
      loading,
      setAuth,
      refresh,
      has: (key: string) => Boolean(auth?.permissions?.includes(key) || auth?.roles?.some((r) => r.slug === 'super-admin')),
    }),
    [auth, loading],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  return useContext(Ctx);
}
