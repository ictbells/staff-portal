import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../auth';
import { AccessDeniedPanel } from './AccessDeniedPanel';
import { PortalAccessNotice } from './PortalAccessNotice';
import { findNavItemForPath, getNavItemAccess } from '../lib/portalAccess';

type Props = {
  children: React.ReactNode;
};

export function PortalRouteAccess({ children }: Props) {
  const { auth, has } = useAuth();
  const location = useLocation();

  const access = useMemo(() => {
    if (location.pathname.startsWith('/academic')) {
      return { canAccess: true, level: 'full' as const, reason: 'ok' as const, label: undefined };
    }

    const navItem = findNavItemForPath(location.pathname);
    if (!navItem) {
      return { canAccess: true, level: 'full' as const, reason: 'ok' as const, label: undefined };
    }

    const state = getNavItemAccess(
      navItem,
      has,
      auth?.nav_unrestricted,
      auth?.nav_link_keys,
    );

    return { ...state, label: navItem.label };
  }, [auth?.nav_link_keys, auth?.nav_unrestricted, has, location.pathname]);

  if (!access.canAccess) {
    return <AccessDeniedPanel reason={access.reason} resourceLabel={access.label} />;
  }

  return (
    <>
      {access.level === 'limited' && <PortalAccessNotice />}
      {children}
    </>
  );
}
