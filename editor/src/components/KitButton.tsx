import { useEffect, useRef } from 'react';
import { mount, type KitHandle } from '../vendor/loomkit/loomkit.esm.js';

/** React adapter for the shared LoomKit button. Business actions remain in React. */
export function KitButton({ children, onClick, disabled = false, variant = 'secondary' }: {
  children: string; onClick: () => void; disabled?: boolean; variant?: 'primary' | 'secondary' | 'quiet';
}) {
  const host = useRef<HTMLSpanElement>(null), handle = useRef<KitHandle | null>(null);
  const action = useRef(onClick);
  action.current = onClick;
  useEffect(() => {
    handle.current = mount(host.current!, 'button', { data: { label: children, variant, disabled, size: 'sm' }, on: { press: () => action.current() } });
    return () => { handle.current?.destroy(); handle.current = null; };
    // Mount once; subsequent React updates use the public data contract.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => handle.current?.update({ label: children, variant, disabled }), [children, variant, disabled]);
  return <span ref={host} className="inline-flex shrink-0" />;
}
