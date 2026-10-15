import { useEffect, useMemo, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { IconButton } from '../../components/IconButton';
import type { TimedResult } from '../../domain/timed-attempt';
import { historyScramble } from '../../domain/history-scramble';
import { SOLVED, turn } from '../../domain/cube';
import { requestExerciseSetup } from '../../workers/setup-client';

const cache = new Map<string, string>();
export function SolveScramble({ result }: { result: TimedResult }) {
  const source = useMemo(() => historyScramble(result), [result]);
  const fallback = source?.moves.join(' ') ?? '';
  const [prepared, setPrepared] = useState<{ key: string; text: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!source?.equivalent || source.moves.length <= 25 || cache.has(fallback)) return;
    const controller = new AbortController();
    const target = source.moves.reduce(turn, SOLVED);
    void requestExerciseSetup(SOLVED, { original: fallback, target, minimumSetupMoves: 1 }, controller.signal).then(setup => {
      if (controller.signal.aborted) return;
      const text = setup.moves.join(' ');
      cache.set(fallback, text);
      setPrepared({ key: fallback, text });
    }, () => { /* The normalized, state-equivalent fallback stays available offline. */ });
    return () => controller.abort();
  }, [source, fallback]);
  if (!source) return null;
  const scramble = source.equivalent ? prepared?.key === fallback ? prepared.text : cache.get(fallback) ?? fallback : fallback;
  async function copy() {
    try { await navigator.clipboard.writeText(scramble); setCopied(true); setError(null); }
    catch { setError('Scramble could not be copied. Check clipboard access and try again.'); }
  }
  return <div className="solve-scramble" role="group" aria-label={source.equivalent ? 'Equivalent scramble' : 'Original scramble'}><p>{scramble || 'Solved position'}</p><IconButton className="solve-copy-scramble" label="Copy scramble" title={source.equivalent ? 'Copy equivalent scramble from solved' : 'Copy original scramble'} onClick={() => void copy()}>{copied ? <Check /> : <Copy />}</IconButton>{source.equivalent && <p className="solve-copy-note">Equivalent starting position; the original scramble was not saved.</p>}{copied && <span className="solve-copy-note" role="status">Scramble copied</span>}{error && <p className="solve-scramble-error" role="alert">{error}</p>}</div>;
}



