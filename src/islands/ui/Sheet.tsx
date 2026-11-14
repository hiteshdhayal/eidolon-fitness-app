import type { ComponentChildren } from 'preact';
import { useEffect, useRef } from 'preact/hooks';

interface Props {
  id: string;
  open: boolean;
  title: string;
  onClose: () => void;
  children: ComponentChildren;
}

/**
 * Native <dialog>: modal focus trap, Esc to close and focus return come from
 * the browser. Styled as a bottom sheet on mobile and centred on desktop.
 */
export default function Sheet({ id, open, title, onClose, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      id={id}
      class="pv-sheet"
      aria-labelledby={`${id}-title`}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
    >
      <div class="pv-sheet-body">
        <div class="pv-sheet-head">
          <h2 class="pv-sheet-title" id={`${id}-title`}>
            {title}
          </h2>
          <button type="button" class="pv-sheet-close" aria-label="Close" onClick={onClose}>
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
