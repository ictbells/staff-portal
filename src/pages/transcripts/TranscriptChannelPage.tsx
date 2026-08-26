import { Navigate, useParams } from 'react-router-dom';
import TranscriptRequests from '../TranscriptRequests';
import { transcriptChannelByKey } from './constants';

export default function TranscriptChannelPage() {
  const { channel } = useParams<{ channel: string }>();
  const config = channel ? transcriptChannelByKey(channel) : undefined;

  if (!config) {
    return <Navigate to="/transcript-requests/undergraduate" replace />;
  }

  return <TranscriptRequests channel={config} />;
}
