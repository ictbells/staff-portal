import { Navigate, useParams } from 'react-router-dom';
import { PhysicalClearancePage } from './PhysicalClearancePage';
import { clearanceChannelByKey } from './constants';

export default function PhysicalClearanceChannelPage() {
  const { channel } = useParams<{ channel: string }>();
  const config = channel ? clearanceChannelByKey(channel) : undefined;

  if (!config) {
    return <Navigate to="/applications/clearance/undergraduate" replace />;
  }

  return <PhysicalClearancePage channel={config} />;
}
