import type { ButtonHTMLAttributes } from 'react';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { primary?: boolean };

export function Button({ primary, className = '', ...rest }: Props) {
  const tone = primary
    ? 'bg-accent text-white hover:opacity-90'
    : 'bg-white text-neutral-900 border border-neutral-300 hover:bg-neutral-100';
  return (
    <button
      {...rest}
      className={`rounded px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-40 ${tone} ${className}`}
    />
  );
}
