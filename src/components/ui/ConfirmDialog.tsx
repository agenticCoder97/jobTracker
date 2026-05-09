'use client';

import * as Dialog from '@radix-ui/react-dialog';
import type { ReactNode } from 'react';

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  onConfirm,
  trigger,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  trigger?: ReactNode;
}) {
  return (
    <Dialog.Root {...(open !== undefined ? { open } : {})} {...(onOpenChange ? { onOpenChange } : {})}>
      {trigger ? <Dialog.Trigger asChild>{trigger}</Dialog.Trigger> : null}
      <Dialog.Portal>
        <Dialog.Overlay className="confirm-overlay" />
        <Dialog.Content className="confirm-dialog">
          <Dialog.Title className="confirm-dialog__title">{title}</Dialog.Title>
          {description ? (
            <Dialog.Description className="confirm-dialog__desc">{description}</Dialog.Description>
          ) : null}
          <div className="confirm-dialog__actions">
            <Dialog.Close asChild>
              <button className="card-cta" type="button">
                {cancelLabel}
              </button>
            </Dialog.Close>
            <Dialog.Close asChild>
              <button
                className={destructive ? 'card-cta is-danger' : 'astral-gold-btn'}
                type="button"
                onClick={onConfirm}
              >
                {confirmLabel}
              </button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
