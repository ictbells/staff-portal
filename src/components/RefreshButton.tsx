import { Button } from 'antd';
import { RefreshCw } from 'lucide-react';

type RefreshButtonProps = {
  onClick: () => void;
  loading?: boolean;
};

export function RefreshButton({ onClick, loading }: RefreshButtonProps) {
  return (
    <Button type="primary" icon={<RefreshCw size={14} />} onClick={onClick} loading={loading}>
      Refresh
    </Button>
  );
}
