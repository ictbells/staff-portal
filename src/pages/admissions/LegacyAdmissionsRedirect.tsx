import { Navigate, useParams } from 'react-router-dom';

export default function LegacyAdmissionsRedirect() {
  const { channel } = useParams<{ channel?: string }>();

  return <Navigate to={`/applications/${channel ?? 'undergraduate'}`} replace />;
}
