import { useEffect, useRef, useSyncExternalStore } from 'react';
import { confirmationStore, finishConfirmation } from '../lib/confirmation';
import { useT } from '../lib/i18n';

export default function ConfirmationDialog() {
  const request = useSyncExternalStore(confirmationStore.subscribe, confirmationStore.get);
  const cancel = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const t = useT();
  useEffect(() => {
    if (!request) return;
    const previous = document.activeElement as HTMLElement | null;
    cancel.current?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); finishConfirmation(false); }
      if (event.key !== 'Tab') return;
      const buttons = panel.current?.querySelectorAll<HTMLButtonElement>('button');
      if (!buttons?.length) return;
      const first = buttons[0], last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', keydown);
    return () => { window.removeEventListener('keydown', keydown); if (previous?.isConnected) previous.focus(); };
  }, [request]);
  useEffect(() => () => finishConfirmation(false), []);
  if (!request) return null;
  return (
    <div data-editor-modal role="dialog" aria-modal="true" aria-labelledby="confirmation-title" aria-describedby="confirmation-message"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm"
      onClick={() => finishConfirmation(false)}>
      <div ref={panel} className="w-full max-w-md rounded-xl border border-white/15 bg-[#17171f] p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <h2 id="confirmation-title" className="text-base font-semibold text-slate-100">{t('confirm.title')}</h2>
        <p id="confirmation-message" className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-300">{request.message}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button ref={cancel} onClick={() => finishConfirmation(false)} className="rounded-md border border-white/15 px-4 py-2 text-sm text-slate-300 hover:bg-white/5">{t('confirm.cancel')}</button>
          <button onClick={() => finishConfirmation(true)} className="rounded-md bg-amber-500 px-4 py-2 text-sm font-semibold text-black hover:bg-amber-400">{t('confirm.approve')}</button>
        </div>
      </div>
    </div>
  );
}
