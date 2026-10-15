import { useRef, type ReactNode, type RefObject } from 'react';
import { X } from 'lucide-react';
import { Dialog, DialogClose, DialogContent, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import './modal-patterns.css';
export function Overlay({ open, onOpenChange, title, children, size = 'medium', footer, returnFocus }: { open: boolean; onOpenChange: (open: boolean) => void; title: string; children: ReactNode; size?: 'small' | 'medium' | 'wide'; footer?: ReactNode; returnFocus?: RefObject<HTMLElement | null> }) {
  const opener = useRef<HTMLElement | null>(null);
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent aria-describedby={undefined} className="workspace-dialog modal-shell" data-size={size} showCloseButton={false} onOpenAutoFocus={() => { opener.current = document.activeElement as HTMLElement; }} onCloseAutoFocus={event => { event.preventDefault(); const candidate = returnFocus?.current ?? opener.current; const target = candidate?.isConnected && candidate !== document.body ? candidate : document.querySelector<HTMLElement>('.brand'); target?.focus(); }}>
    <header className="modal-header"><DialogTitle>{title}</DialogTitle><DialogClose asChild><Button variant="ghost" size="icon" aria-label="Close"><X aria-hidden="true" /></Button></DialogClose></header>
    <div className="modal-body">{children}</div>{footer && <footer className="modal-footer">{footer}</footer>}
  </DialogContent></Dialog>;
}
