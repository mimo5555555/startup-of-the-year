import { useEffect } from 'react';
import { useStore } from '../store';
import { Icon } from './Icon';

export function Toasts() {
  const toast = useStore((s) => s.toast);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => useStore.setState((s) => (s.toast?.id === toast.id ? { toast: null } : {})), 2300);
    return () => clearTimeout(id);
  }, [toast]);
  if (!toast) return null;
  return (
    <div className={`toast ${toast.tone ?? 'info'}`} role="status" key={toast.id}>
      {toast.tone === 'good' && <Icon name="check" size={16} stroke={2.6} />}
      <span dir="auto">{toast.text}</span>
    </div>
  );
}
