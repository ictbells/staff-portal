import { Button, Popconfirm } from 'antd';
import type { ButtonProps } from 'antd';
import { Trash2 } from 'lucide-react';

type ConfirmDeleteButtonProps = {
  onConfirm: () => void | Promise<void>;
  disabled?: boolean;
  buttonProps?: ButtonProps;
};

export function ConfirmDeleteButton({
  onConfirm,
  disabled,
  buttonProps,
}: ConfirmDeleteButtonProps) {
  return (
    <Popconfirm
      title="Are you sure you want to delete this record?"
      okText="Delete"
      cancelText="Cancel"
      okButtonProps={{ danger: true }}
      onConfirm={onConfirm}
    >
      <Button
        type="text"
        danger
        icon={<Trash2 size={14} />}
        size="small"
        disabled={disabled}
        {...buttonProps}
      >
        Delete
      </Button>
    </Popconfirm>
  );
}
