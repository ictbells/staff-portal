import { Navigate, useParams } from 'react-router-dom';
import { AdmissionsPipeline } from './AdmissionsPipeline';
import { admissionsChannelByKey } from './constants';

export default function AdmissionsChannelPage() {
  const { channel } = useParams<{ channel: string }>();
  const config = channel ? admissionsChannelByKey(channel) : undefined;

  if (!config) {
    return <Navigate to="/applications/undergraduate" replace />;
  }

  return <AdmissionsPipeline channel={config} />;
}
