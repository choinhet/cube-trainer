import type { GanCubeCommand, GanCubeEvent } from 'gan-web-bluetooth';
import { Diagnostic, type TraceEntry } from './diagnostic';

export interface Connection {
  readonly deviceName: string;
  events$: { subscribe(observer: { next(event: GanCubeEvent): void; error(error: unknown): void; complete(): void }): { unsubscribe(): void } };
  sendCubeCommand(command: GanCubeCommand): Promise<void>;
  disconnect(): Promise<void>;
}
export class DiagnosticSession {
  diagnostic = new Diagnostic();
  status: 'disconnected' | 'connecting' | 'connected' = 'disconnected';
  error: string | null = null;
  deviceName: string | null = null;
  previousRuns: TraceEntry[][] = [];
  private connection: Connection | null = null;
  private subscription: { unsubscribe(): void } | null = null;
  private generation = 0;
  private closing = false;
  get canConnect(): boolean { return this.status === 'disconnected' && !this.closing; }
  constructor(private chooser: () => Promise<Connection>, private clock: () => number, protected notify: () => void) {}
  protected onEvent(event: GanCubeEvent, hostMs: number): void { void event; void hostMs; /* Diagnostic needs explicit confirmation. */ }
  protected onDisconnected(): void {}
  protected createDiagnostic(): Diagnostic { return new Diagnostic(); }

  async connect(): Promise<void> {
    if (!this.canConnect) return;
    this.status = 'connecting';
    const generation = ++this.generation;
    this.error = null;
    this.notify();
    try {
      const connection = await this.chooser();
      if (generation !== this.generation) { await this.closeConnection(connection); return; }
      this.connection = connection;
      this.deviceName = connection.deviceName;
      if (this.diagnostic.trace().length) this.previousRuns.push(this.diagnostic.trace());
      this.diagnostic = this.createDiagnostic();
      this.status = 'connected';
      const subscription = connection.events$.subscribe({
        next: event => {
          if (generation !== this.generation) return;
          const hostMs = this.clock();
          this.diagnostic.receive(event, hostMs);
          this.onEvent(event, hostMs);
          if (event.type === 'DISCONNECT') this.markDisconnected();
          this.notify();
        },
        error: error => { if (generation !== this.generation) return; this.error = String(error); this.diagnostic.invalidate('Event stream failed'); this.markDisconnected(); void this.closeConnection(connection); this.notify(); },
        complete: () => { if (generation !== this.generation) return; this.diagnostic.invalidate('Event stream ended'); this.markDisconnected(); void this.closeConnection(connection); this.notify(); },
      });
      if (generation === this.generation) this.subscription = subscription;
      else subscription.unsubscribe();
    } catch (error) {
      const connection = this.connection;
      this.error = String(error);
      this.diagnostic.invalidate('Connection setup failed');
      this.markDisconnected();
      if (connection) await this.closeConnection(connection);
    }
    this.notify();
  }
  private markDisconnected(): void {
    this.onDisconnected();
    this.generation++;
    this.status = 'disconnected';
    this.connection = null;
    this.subscription?.unsubscribe();
    this.subscription = null;
  }
  private async closeConnection(connection: Connection): Promise<void> {
    this.closing = true;
    try { await connection.disconnect(); } catch (error) { this.error = String(error); }
    finally { this.closing = false; this.notify(); }
  }
  async request(command: 'REQUEST_FACELETS' | 'REQUEST_HARDWARE' | 'REQUEST_BATTERY'): Promise<void> {
    const connection = this.connection;
    const generation = this.generation;
    if (!connection) return;
    try { await connection.sendCubeCommand({ type: command }); }
    catch (error) {
      if (generation !== this.generation) return;
      this.error = `${String(error)} Click Connect cube to retry.`;
      this.diagnostic.invalidate('Command failed');
      this.markDisconnected();
      await this.closeConnection(connection);
    }
    this.notify();
  }
  async disconnect(): Promise<void> {
    const connection = this.connection;
    this.diagnostic.receive({ type: 'DISCONNECT', timestamp: Date.now() }, this.clock());
    this.markDisconnected();
    if (connection) await this.closeConnection(connection);
    this.notify();
  }
}
