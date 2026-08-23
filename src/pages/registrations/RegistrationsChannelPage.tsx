import { Navigate, useParams } from 'react-router-dom';
import { RegistrationsList } from './RegistrationsList';
import { registrationChannelByKey } from './constants';

export default function RegistrationsChannelPage() {
  const { channel } = useParams<{ channel: string }>();
  const config = channel ? registrationChannelByKey(channel) : undefined;

  if (!config) {
    return <Navigate to="/registrations/undergraduate" replace />;
  }

  return <RegistrationsList channel={config} />;
}
