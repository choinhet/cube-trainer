import type { ComponentProps } from 'react';
import { Button } from './ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
export function IconButton({ label, title, ...props }: ComponentProps<typeof Button> & { label: string }) {
  return <TooltipProvider><Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" {...props} aria-label={label} /></TooltipTrigger><TooltipContent>{title ?? label}</TooltipContent></Tooltip></TooltipProvider>;
}
