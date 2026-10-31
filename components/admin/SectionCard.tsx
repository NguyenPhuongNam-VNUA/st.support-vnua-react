import React from 'react';

interface SectionCardProps {
  title: React.ReactNode;
  /** Controls next to the title (buttons, filters). */
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  /** Classes for the white inner panel. */
  bodyClassName?: string;
  id?: string;
  style?: React.CSSProperties;
}

// Kravio section: muted outer shell with title row, white bordered panel inside.
export default function SectionCard({ title, actions, children, className = '', bodyClassName = '', id, style }: SectionCardProps) {
  return (
    <section
      id={id}
      style={style}
      className={`k-rise relative flex min-w-0 flex-col items-stretch overflow-clip rounded-xl bg-[#f6f6f6] p-1 shadow-[inset_0_0_0_0.8px_#e5e7eb] ${className}`}
    >
      <div className="relative flex w-full shrink-0 flex-wrap items-center justify-between gap-2 p-2">
        <h2 className="whitespace-nowrap text-sm font-medium leading-none text-[#4b5563]">{title}</h2>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      <div className={`relative flex min-h-px w-full flex-1 flex-col overflow-clip rounded-[10px] border-[0.8px] border-[#e5e7eb] bg-white ${bodyClassName}`}>
        {children}
      </div>
    </section>
  );
}
