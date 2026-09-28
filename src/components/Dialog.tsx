import { useEffect, useId, useRef, type ReactNode } from 'react';

import styles from './Dialog.module.css';

interface DialogProps {
  title: string;
  children: ReactNode;
  /** Escape or the backdrop's cancel. */
  onCancel: () => void;
}

/** A modal dialog, open while rendered. Its first button gets focus. */
export function Dialog({ title, children, onCancel }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();

  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => {
      dialog?.close();
    };
  }, []);

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby={id}
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
    >
      <h2 id={id} className={styles.title}>
        {title}
      </h2>
      {children}
    </dialog>
  );
}
