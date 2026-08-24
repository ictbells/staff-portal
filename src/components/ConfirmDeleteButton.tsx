import { useState } from 'react';
import { Button, Popconfirm } from 'antd';
import type { ButtonProps } from 'antd';
import { Trash2 } from 'lucide-react';

type ConfirmDeleteButtonProps = {
  onConfirm: () => void | Promise<void>;
  disabled?: boolean;
  title?: string;
  description?: string;
  buttonProps?: ButtonProps;
};

export function ConfirmDeleteButton({
  onConfirm,
  disabled,
  title = 'Are you sure you want to delete this record?',
  description,
  buttonProps,
}: ConfirmDeleteButtonProps) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const handleConfirm = () => {
    setConfirming(true);
    Promise.resolve(onConfirm())
      .then(() => setOpen(false))
      .finally(() => setConfirming(false));
  };

  return (
    <Popconfirm
      open={open}
      title={title}
      description={description}
      okText="Delete"
      cancelText="Cancel"
      okButtonProps={{ danger: true, loading: confirming }}
      destroyOnHidden
      onOpenChange={(next) => {
        if (confirming) return;
        setOpen(next);
      }}
      onConfirm={handleConfirm}
    >
      <Button
        type="text"
        danger
        icon={<Trash2 size={14} />}
        size="small"
        disabled={disabled || confirming}
        {...buttonProps}
      >
        Delete
      </Button>
    </Popconfirm>
  );
}
