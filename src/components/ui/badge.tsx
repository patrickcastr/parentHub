import React from 'react';

type Props = React.HTMLAttributes<HTMLSpanElement> & {
  variant?: 'default' | 'secondary' | 'outline';
};
export function Badge({ className = '', variant = 'default', ...rest }: Props) {
  const base = 'inline-flex items-center rounded px-2 py-0.5 text-xs font-medium';
  const styles = {
    default: 'bg-slate-900 text-white',
    secondary: 'bg-slate-200 text-slate-900',
    outline: 'border border-slate-300 text-slate-700'
  } as const;
  return <span className={`${base} ${styles[variant]} ${className}`} {...rest} />;
}
export default Badge;