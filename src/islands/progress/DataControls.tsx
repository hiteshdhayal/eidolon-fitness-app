import { useRef, useState } from 'preact/hooks';
import { clearAll } from '../../lib/storage';
import { formatLong, todayLocal } from '../../lib/progress/dates';
import {
  applyImport,
  buildExport,
  downloadExport,
  isTooBig,
  parseExport,
  type ExportBundle,
} from '../../lib/progress/transfer';
import Sheet from '../ui/Sheet';

interface Props {
  today: string;
  /** Re-read everything from storage after an import or a delete. */
  onReplaced: () => void;
  onAnnounce: (message: string) => void;
}

export default function DataControls({ today, onReplaced, onAnnounce }: Props) {
  const [pending, setPending] = useState<ExportBundle | null>(null);
  const [error, setError] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function exportData() {
    downloadExport(buildExport(), today);
    onAnnounce('Downloaded your data.');
  }

  async function onFile(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (isTooBig(file.size)) {
      setPending(null);
      setError('That file is too big to be an Eidolon export.');
      return;
    }
    const bundle = parseExport(await file.text());
    if (!bundle) {
      setPending(null);
      setError("That file isn't an Eidolon export, or it's damaged. Nothing was changed.");
      return;
    }
    setError('');
    setPending(bundle);
  }

  function confirmImport() {
    if (!pending) return;
    applyImport(pending);
    setPending(null);
    onAnnounce('Imported.');
    onReplaced();
  }

  function confirmDelete() {
    clearAll();
    setDeleteOpen(false);
    onAnnounce('Everything is deleted.');
    onReplaced();
  }

  const confirmText = pending
    ? `${
        pending.plan
          ? `This file has a plan from ${formatLong(todayLocal(new Date(pending.plan.savedAt)))} and ${pending.progress.entries.length} check-ins.`
          : `This file has ${pending.progress.entries.length} check-ins and no plan.`
      } Importing replaces what's on this phone.`
    : '';

  return (
    <div class="pv-data">
      <div class="pv-data-list">
        <div class="pv-data-row">
          <p class="pv-data-note">
            Download a JSON file with your plan, check-ins and grocery ticks.
          </p>
          <div class="pv-data-action">
            <button type="button" class="qc-secondary" onClick={exportData}>
              Export my data
            </button>
          </div>
        </div>

        <div class="pv-data-row">
          <p class="pv-data-note">
            Restore from an Eidolon export file. This replaces what's on this phone.
          </p>
          <div class="pv-data-action">
            <button type="button" class="qc-secondary" onClick={() => fileRef.current?.click()}>
              Import
            </button>
          </div>
        </div>

        <div class="pv-data-row">
          <p class="pv-data-note">
            This removes your plan, answers, check-ins and grocery ticks from this phone.
          </p>
          <div class="pv-data-action">
            <button type="button" class="pv-link" onClick={() => setDeleteOpen(true)}>
              Delete everything
            </button>
          </div>
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        class="sr-only"
        aria-hidden="true"
        tabIndex={-1}
        onChange={onFile}
      />

      {error ? <p class="pv-data-error">{error}</p> : null}

      {pending ? (
        <div class="pv-data-confirm">
          <p class="pv-data-note">{confirmText}</p>
          <div class="pv-data-confirm-actions">
            <button type="button" class="qc-next" onClick={confirmImport}>
              Import
            </button>
            <button type="button" class="qc-secondary" onClick={() => setPending(null)}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      <Sheet
        id="pv-delete"
        open={deleteOpen}
        title="Delete everything?"
        onClose={() => setDeleteOpen(false)}
      >
        <div class="pv-dialog-body">
          <p class="pv-body-text">
            This removes your plan, answers, check-ins and grocery ticks from this phone. It can't
            be undone. Export your data first if you want a copy.
          </p>
          <div class="pv-dialog-actions">
            <button type="button" class="qc-next" onClick={confirmDelete}>
              Delete everything
            </button>
            <button type="button" class="qc-secondary" onClick={() => setDeleteOpen(false)}>
              Cancel
            </button>
          </div>
        </div>
      </Sheet>
    </div>
  );
}
