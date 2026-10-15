import { useId, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import './modal-patterns.css';
export function ModalSection({ title, children }: { title: string; children: ReactNode }) {
  const id = useId();
  return <section className="modal-section" aria-labelledby={id}><h3 id={id}>{title}</h3>{children}</section>;
}
export function FieldRow({ children, hint }: { children: ReactNode; hint?: string }) {
  return <div className="field-row"><label>{children}</label>{hint && <p className="field-hint">{hint}</p>}</div>;
}
export function Disclosure({ title, children, defaultOpen = false }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return <div className="shared-disclosure" role="group" aria-label={title}><button className="disclosure-trigger" type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}><span>{title}</span><ChevronDown aria-hidden="true" /></button><div id={id} hidden={!open} className="disclosure-content">{children}</div></div>;
}
export function ActionBar({ children, destructive = false }: { children: ReactNode; destructive?: boolean }) {
  return <div className={`action-bar${destructive ? ' action-bar-destructive' : ''}`}>{children}</div>;
}
export function MetricGroup({ children }: { children: ReactNode }) { return <dl className="metric-group">{children}</dl>; }
export function Metric({ label, value }: { label: string; value: ReactNode }) { return <div className="metric"><dt>{label}</dt><dd>{value}</dd></div>; }

