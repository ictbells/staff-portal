import { Alert } from 'antd';
import { limitedAccessDescription } from '../lib/portalAccess';

export function PortalAccessNotice() {
  return (
    <Alert
      type="info"
      showIcon
      className="mb-4"
      message="Limited access"
      description={limitedAccessDescription()}
    />
  );
}
