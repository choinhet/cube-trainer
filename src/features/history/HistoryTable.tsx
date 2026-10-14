import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { IconButton } from '../../components/IconButton';
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '../../components/ui/table';

export function ResultTable({ children, label, moves = false }: { children: ReactNode; label?: string; moves?: boolean }) {
  return <Table className="history-list" aria-label={label} data-moves={moves || undefined}>
    <TableHeader><TableRow><TableHead scope="col">TPS</TableHead><TableHead scope="col">TIME</TableHead>{moves && <TableHead scope="col">Moves</TableHead>}</TableRow></TableHeader>
    <TableBody>{children}</TableBody>
  </Table>;
}

export interface HistoryEntry { id: string; tps: string; time: string; moves?: string }
export function HistoryTable({ entries, selected, onSelect, previousLabel, nextLabel, moves = false }: { entries: HistoryEntry[]; selected: string | null; onSelect: (id: string) => void; previousLabel: string; nextLabel: string; moves?: boolean }) {
  const area = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(5);
  useEffect(() => {
    const element = area.current;
    if (!element || typeof ResizeObserver === 'undefined') return;
    const measure = () => {
      const height = element.clientHeight;
      const rowHeight = Number.parseFloat(getComputedStyle(element).getPropertyValue('--history-row-height')) || 48;
      if (height) setPageSize(Math.max(1, Math.floor((height - 36) / rowHeight)));
    };
    const observer = new ResizeObserver(measure);
    observer.observe(element); measure();
    return () => observer.disconnect();
  }, []);
  const totalPages = Math.max(1, Math.ceil(entries.length / pageSize));
  const currentPage = Math.min(page, totalPages - 1);
  return <>
    <div className="history-table-area" ref={area}>
      <ResultTable moves={moves}>{entries.slice(currentPage * pageSize, (currentPage + 1) * pageSize).map(entry => <TableRow key={entry.id} data-selected={selected === entry.id}>
        <TableCell>{entry.tps}</TableCell><TableCell><Button variant="ghost" onClick={() => onSelect(entry.id)}>{entry.time}</Button></TableCell>
        {moves && <TableCell>{entry.moves}</TableCell>}
      </TableRow>)}</ResultTable>
    </div>
    <nav className="history-pagination" aria-label="History pages">
      <IconButton label={previousLabel} disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}><ChevronLeft /></IconButton>
      <span aria-live="polite" aria-label={`Page ${currentPage + 1} of ${totalPages}`}>{currentPage + 1} / {totalPages}</span>
      <IconButton label={nextLabel} disabled={currentPage + 1 === totalPages} onClick={() => setPage(currentPage + 1)}><ChevronRight /></IconButton>
    </nav>
  </>;
}
