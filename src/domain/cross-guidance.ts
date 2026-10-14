import { turn } from './cube';
import { crossCoordinate, isCrossSolved, type CrossCase, type CrossGraph } from './cross';
import { inverse, normalizeTurns } from './guidance';

export type CrossMode = 'free' | 'semi-guided' | 'fully-guided';
export interface CrossOptions { mode?: CrossMode; repeat?: boolean; imported?: boolean }

/** Count activity, pairing adjacent matching quarters without algebraic cancellation. */
export function countExecutedMoves(moves: readonly string[]): number {
  let count = 0;
  for (let i = 0; i < moves.length; i++) {
    const move = moves[i];
    if (!/^[URFDLB](2|')?$/.test(move)) throw new Error('Invalid executed face turn');
    count++;
    if (!move.endsWith('2') && moves[i + 1] === move) i++;
  }
  return count;
}

/** Cube-intrinsic face names make regrips irrelevant to the optimal-prefix graph. */
export class CrossGuidance {
  private node: number;
  private state: string;
  private anchor: string;
  private prefix: string[] = [];
  private pending: string | null = null;
  private correction: string[] | null = null;
  private displayed: string[];
  mistakeEpisodes = 0;

  constructor(private readonly caseData: CrossCase, private readonly graph: CrossGraph) {
    if (graph.root !== crossCoordinate(caseData.startingState, caseData.color) || graph.nodes[graph.root]?.distance !== caseData.optimum) throw new Error('Optimal graph does not match the cross case');
    this.node = graph.root;
    this.state = this.anchor = caseData.startingState;
    this.displayed = this.continuation(this.node);
  }
  private edge(move: string) { return this.graph.nodes[this.node].edges.find(edge => edge.move === move); }
  private continuation(node: number): string[] {
    const moves: string[] = [];
    while (this.graph.nodes[node].distance > 0) {
      const edge = this.graph.nodes[node].edges[0];
      if (!edge) throw new Error('Incomplete optimal graph');
      moves.push(edge.move); node = edge.next;
    }
    return moves;
  }
  private commit(move: string, state: string): void {
    const edge = this.edge(move);
    if (!edge) throw new Error('Cannot commit an incompatible cross move');
    this.node = edge.next; this.prefix.push(move); this.anchor = state;
  }
  private mistake(moves: string[]): void {
    this.pending = null; this.correction = [...moves]; this.mistakeEpisodes++;
  }
  receive(move: string): void {
    if (!/^[URFDLB](2|')?$/.test(move)) throw new Error('Invalid guided face turn');
    if (this.correction) {
      this.state = turn(this.state, move);
      this.correction.push(move);
      if (this.state === this.anchor) this.correction = null;
      return;
    }
    if (this.pending) {
      const previous = this.pending;
      this.pending = null;
      if (previous === move && this.edge(`${move[0]}2`)) {
        this.state = turn(this.state, move);
        this.commit(`${move[0]}2`, this.state);
        return;
      }
      // A valid quarter is the last valid prefix even if its following turn is wrong.
      if (this.edge(previous)) this.commit(previous, this.state);
      else this.mistake([previous]);
    }
    this.state = turn(this.state, move);
    const correction = this.correction as string[] | null;
    if (correction) {
      correction.push(move);
    } else if (move.endsWith('2')) {
      if (this.edge(move)) this.commit(move, this.state);
      else this.mistake([move]);
    } else if (this.edge(move) || this.edge(`${move[0]}2`)) {
      if (isCrossSolved(this.state, this.caseData.color) && this.edge(move)) this.commit(move, this.state);
      else this.pending = move;
    } else this.mistake([move]);
    if (this.correction && this.state === this.anchor) this.correction = null;
  }
  /** Unobserved state changes cannot manufacture a valid prefix. */
  reconcile(state: string): boolean { return state === this.state; }
  get completed(): boolean { return !this.correction && !this.pending && this.graph.nodes[this.node].distance === 0; }
  snapshot() {
    const pendingEdge = this.pending ? this.edge(this.pending) : undefined;
    const completed = [...this.prefix, ...(pendingEdge ? [this.pending!] : [])];
    const displayNode = pendingEdge?.next ?? this.node;
    // Preserve the displayed route until the accepted prefix forces another branch.
    if (!completed.every((move, index) => this.displayed[index] === move)
      || (this.pending && !pendingEdge && this.displayed[completed.length] !== `${this.pending[0]}2`)) {
      this.displayed = [...completed, ...this.continuation(displayNode)];
      if (this.pending && !pendingEdge) {
        const half = this.edge(`${this.pending[0]}2`)!;
        this.displayed = [...completed, half.move, ...this.continuation(half.next)];
      }
    }
    return {
      status: this.correction ? 'correction' as const : this.completed ? 'completed' as const : 'training' as const,
      completedMoves: completed, provisional: this.pending !== null, sequence: [...this.displayed],
      undo: this.correction ? normalizeTurns(this.correction).reverse().map(inverse) : [],
      mistakeEpisodes: this.mistakeEpisodes,
    };
  }
}
