import { Navigate } from 'react-router-dom';
import { useAuth } from '../../auth';
import { AccessDeniedPanel } from '../../components/AccessDeniedPanel';
import { canAccessAcademicResource, accessibleAcademicResources } from './access';
import { getAcademicResourceAccess } from '../../lib/portalAccess';
import { ACADEMIC_RESOURCES, academicResourceByKey } from './constants';

type Props = {
  resourceKey: string;
  children: React.ReactNode;
};

export function AcademicResourceGuard({ resourceKey, children }: Props) {
  const { auth, has } = useAuth();
  const resource = academicResourceByKey(resourceKey);

  if (!resource) {
    return <AccessDeniedPanel reason="missing_both" resourceLabel="this academic resource" />;
  }

  const access = getAcademicResourceAccess(
    resource,
    has,
    auth?.nav_unrestricted,
    auth?.nav_link_keys,
  );

  if (canAccessAcademicResource(resource, has, auth?.nav_unrestricted, auth?.nav_link_keys)) {
    return <>{children}</>;
  }

  const fallback = accessibleAcademicResources(
    ACADEMIC_RESOURCES,
    has,
    auth?.nav_unrestricted,
    auth?.nav_link_keys,
  )[0];

  if (fallback) {
    return <Navigate to={fallback.path} replace />;
  }

  return <AccessDeniedPanel reason={access.reason} resourceLabel={resource.label} />;
}
