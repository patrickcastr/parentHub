import React from 'react';

type Toast = { id: string; variant: 'success' | 'error' | 'info'; message: string; title?: string };
const EVT = 'local-toast';

export function showToast(t: Omit<Toast, 'id'>) {
  const payload: Toast = { id: (crypto as any).randomUUID ? (crypto as any).randomUUID() : Math.random().toString(36).slice(2), ...t };
  window.dispatchEvent(new CustomEvent(EVT, { detail: payload }));
}

export function ToastHost() {
  const [items, setItems] = React.useState<Toast[]>([]);
  React.useEffect(() => {
    function onToast(e: Event) {
      const t = (e as CustomEvent<Toast>).detail;
      setItems(prev => [...prev, t]);
      setTimeout(() => setItems(prev => prev.filter(x => x.id !== t.id)), 3000);
    }
    window.addEventListener(EVT, onToast);
    return () => window.removeEventListener(EVT, onToast);
  }, []);
  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2">
      {items.map(t => (
        <div key={t.id} className={`rounded-md border p-3 shadow-sm bg-white text-sm transition-opacity duration-300 ${
          t.variant === 'error' ? 'border-red-400' : t.variant === 'success' ? 'border-green-400' : 'border-gray-300'
        }`}>
          {t.title && <div className="font-medium mb-0.5">{t.title}</div>}
          <div>{t.message}</div>
        </div>
      ))}
    </div>
  );
}
