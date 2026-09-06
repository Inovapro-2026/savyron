import * as React from 'react';

export function Card({ className = '', children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`card ${className}`} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        <h3 className="font-bold text-white tracking-tight text-base">{title}</h3>
        {subtitle ? <p className="mt-0.5 text-xs text-[#A8B3C7]">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

