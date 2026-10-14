/** Keep one exercise generating while the current exercise is being practiced. */
export class ExerciseQueue<T> {
  private controller = new AbortController();
  private pending: Promise<T> | null = null;
  constructor(private generate: (signal: AbortSignal) => Promise<T>) {}
  warm(): void {
    if (this.pending) return;
    if (this.controller.signal.aborted) this.controller = new AbortController();
    const signal = this.controller.signal;
    this.pending = Promise.resolve().then(() => {
      if (signal.aborted) throw new Error('Generation cancelled');
      return this.generate(signal);
    });
    // Background errors are reported when the exercise is requested.
    void this.pending.catch(() => {});
  }
  async take(signal: AbortSignal): Promise<T> {
    if (signal.aborted || this.controller.signal.aborted) throw new Error('Generation cancelled');
    this.warm();
    const controller = this.controller;
    const pending = this.pending!;
    let cancel!: () => void;
    const cancelled = new Promise<never>((_, reject) => { cancel = () => reject(new Error('Generation cancelled')); signal.addEventListener('abort', cancel, { once: true }); });
    let value: T;
    try { value = await Promise.race([pending, cancelled]); }
    catch (error) { if (!signal.aborted && this.pending === pending) this.pending = null; throw error; }
    finally { signal.removeEventListener('abort', cancel); }
    if (signal.aborted || controller.signal.aborted) throw new Error('Generation cancelled');
    if (this.pending === pending) { this.pending = null; this.warm(); }
    return structuredClone(value);
  }
  dispose(): void { this.controller.abort(); this.pending = null; }
}
