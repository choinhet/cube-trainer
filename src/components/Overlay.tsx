import { useRef, type ReactNode } from 'react';
import { Dialog, DialogContent, DialogTitle } from './ui/dialog';
export function Overlay({ open, onOpenChange, title, children }: { open: boolean; onOpenChange: (open: boolean) => void; title: string; children: ReactNode }) {
  const opener = useRef<HTMLElement | null>(null);
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent aria-describedby={undefined} className="workspace-dialog" onOpenAutoFocus={() => { opener.current = document.activeElement as HTMLElement; }} onCloseAutoFocus={event => { event.preventDefault(); const target = opener.current?.isConnected && opener.current !== document.body ? opener.current : document.querySelector<HTMLElement>('.brand'); target?.focus(); }}><DialogTitle>{title}</DialogTitle>{children}</DialogContent></Dialog>;
}
