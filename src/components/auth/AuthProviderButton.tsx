import type { AuthProvider } from '@/config/authProviders';
import { API } from '@/lib/api';

type Props = { provider: AuthProvider; overridePath?: string; disabled?: boolean };
export default function AuthProviderButton({ provider, overridePath, disabled }: Props) {
  const { label, redirectPath, iconSrc, bgClass = 'bg-neutral-900 hover:bg-neutral-800', textClass = 'text-white' } = provider;
  const handleClick = () => {
    if (disabled) return;
    const next = new URLSearchParams(window.location.search).get('next');
    const path = overridePath || redirectPath;
    const href = path.startsWith('http') ? path : (path.startsWith('/api') ? `${API}${path}` : path);
    window.location.assign(href + (next ? `?next=${encodeURIComponent(next)}` : ''));
  };
  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      className={`w-full flex items-center justify-center gap-2 px-6 py-3 rounded-lg ${bgClass} ${textClass} transition focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 disabled:opacity-60`}
      aria-label={label}
    >
      {iconSrc && <img src={iconSrc} alt="" className="w-5 h-5" />}
      <span className="font-medium">{label}</span>
    </button>
  );
}
