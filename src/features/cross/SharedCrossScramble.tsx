import { useEffect, useState, type ReactNode } from 'react';
import { Check, Copy } from 'lucide-react';
import type { CrossCase } from '../../domain/cross';
import { SOLVED } from '../../domain/cube';
import { requestExerciseSetup } from '../../workers/setup-client';
import { Button } from '../../components/ui/button';

const cache = new Map<string, string>();

export function SharedCrossScramble({ caseData, children }: { caseData: CrossCase; children?: ReactNode }) {
  const direct = (caseData.scrambleSource ?? SOLVED) === SOLVED ? caseData.originalScramble : null;
  const [result, setResult] = useState<{ state: string; text: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [revision, setRevision] = useState(0);
  const scramble = direct ?? (result?.state === caseData.startingState ? result.text : cache.get(caseData.startingState));
  useEffect(() => {
    setCopied(false); setError(null);
    if (direct || cache.has(caseData.startingState)) return;
    const controller = new AbortController();
    void requestExerciseSetup(SOLVED, { original: caseData.originalScramble, source: caseData.scrambleSource, target: caseData.startingState }, controller.signal)
      .then(setup => {
        if (controller.signal.aborted) return;
        const text = setup.moves.join(' ');
        cache.set(caseData.startingState, text);
        setResult({ state: caseData.startingState, text });
      }, cause => { if (!controller.signal.aborted) setError(`Scramble could not be prepared: ${String(cause)}`); });
    return () => controller.abort();
  }, [caseData.startingState, caseData.originalScramble, caseData.scrambleSource, direct, revision]);

  async function copy() {
    try { await navigator.clipboard.writeText(scramble!); setCopied(true); setError(null); }
    catch { setError(children ? 'Copy failed. Try again or copy the scramble from the saved case details.' : 'Copy failed. Select the scramble text and copy it manually.'); }
  }
  return <div className="shared-cross-scramble">
    <div className="scramble-heading"><span>Scramble</span><Button variant="ghost" size="icon" aria-label="Copy scramble" title="Copy scramble" disabled={!scramble} onClick={() => void copy()}>{copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}</Button></div>
    {children ?? (scramble ? <code className="scramble-text">{scramble}</code> : !error && <p role="status">Preparing shareable scramble…</p>)}
    {!children && <p className="holding-instructions">From solved: white on top, green in front.</p>}
    {copied && <span role="status">Scramble copied</span>}
    {error && <p role="alert">{error}{!scramble && <Button variant="outline" onClick={() => setRevision(value => value + 1)}>Retry scramble</Button>}</p>}
  </div>;
}
