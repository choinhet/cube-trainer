import { isFacelets, turn } from './cube';
import type { PhysicalTurn } from './diagnostic';

export function inverse(move: string): string {
  return move.endsWith('2') ? move : move.endsWith("'") ? move[0] : `${move}'`;
}
function amount(move: string): number {
  if (!/^[URFDLB](2|')?$/.test(move)) throw new Error('Invalid outer-face turn');
  return move.endsWith('2') ? 2 : move.endsWith("'") ? 3 : 1;
}
function notation(face: string, count: number): string | null {
  const net = count % 4;
  return net === 0 ? null : face + (net === 2 ? '2' : net === 3 ? "'" : '');
}
export function normalizeTurns(moves: readonly string[]): string[] {
  const runs: { face: string; count: number }[] = [];
  for (const move of moves) {
    const count = amount(move);
    const last = runs.at(-1);
    if (last?.face === move[0]) last.count += count;
    else runs.push({ face: move[0], count });
  }
  return runs.flatMap(run => notation(run.face, run.count) ?? []);
}

/** Same-face runs stay open until a different face or the exact target arrives. */
export class Guidance {
  readonly sequence: readonly string[];
  readonly target: string;
  private facelets: string;
  private raw: PhysicalTurn[] = [];
  private committed = 0;
  private run: string[] = [];
  private ready = false;
  private anchor: string;
  private correction: string[] | null = null;
  constructor(start: string, sequence: readonly string[]) {
    if (!isFacelets(start)) throw new Error('A valid starting state is required');
    sequence.forEach(amount);
    if (sequence.some((move, i) => i > 0 && move[0] === sequence[i - 1][0])) throw new Error('Intended moves must use distinct adjacent faces');
    this.sequence = [...sequence];
    this.target = sequence.reduce(turn, start);
    this.facelets = start;
    this.anchor = start;
    this.ready = sequence.length === 0;
  }
  receive(event: PhysicalTurn): void {
    if (this.ready) return;
    amount(event.move);
    if (!this.correction && this.run.length && this.run[0][0] !== event.move[0]) {
      const net = normalizeTurns(this.run)[0];
      if (!net || net === this.sequence[this.committed]) {
        if (net) this.committed++;
        this.anchor = this.facelets;
        this.run = [];
      } else {
        this.correction = [...this.run];
        this.run = [];
      }
    }
    if (!this.correction && !this.run.length && event.move[0] !== this.sequence[this.committed]?.[0]) this.correction = [];
    this.raw.push({ ...event });
    this.facelets = turn(this.facelets, event.move);
    if (this.correction) {
      const last = this.correction.at(-1);
      if (last?.[0] === event.move[0]) {
        this.correction.pop();
        const net = notation(event.move[0], amount(last) + amount(event.move));
        if (net) this.correction.push(net);
      } else this.correction.push(event.move);
      // State equality is the recovery contract, independent of textual cancellation.
      if (this.facelets === this.anchor) this.correction = null;
      return;
    }
    this.run.push(event.move);
    if (normalizeTurns(this.run)[0] === this.sequence[this.committed] && this.committed === this.sequence.length - 1 && this.facelets === this.target) {
      this.committed++;
      this.run = [];
      this.ready = true;
    }
  }
  snapshot() {
    return { status: this.ready ? 'ready' as const : this.correction ? 'correction' as const : 'preparing' as const, facelets: this.facelets,
      target: this.target, sequence: [...this.sequence], progress: this.committed + (this.run.length > 0 && !this.correction && normalizeTurns(this.run)[0] === this.sequence[this.committed] ? 1 : 0),
      provisional: this.run.length > 0, undo: this.correction ? normalizeTurns(this.correction).reverse().map(inverse) : [], remaining: this.sequence.slice(this.committed), raw: structuredClone(this.raw) };
  }
}
