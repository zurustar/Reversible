/** TransportService (S-01). Orchestrates play/stop/tempo. */
import type { Store } from '../state/store';
import type { Scheduler, TriggerTarget } from '../sequencer/scheduler';

export class TransportService {
  constructor(private store: Store, private engine: TriggerTarget, private scheduler: Scheduler) {}

  async play(): Promise<void> {
    if (this.store.getState().playing) return; // no double-play (TR-01)
    await this.engine.resume();
    this.scheduler.start();
    this.store.dispatch({ type: 'transport', playing: true });
  }

  stop(): void {
    this.scheduler.stop();
    this.store.dispatch({ type: 'transport', playing: false });
  }

  toggle(): void {
    if (this.store.getState().playing) this.stop();
    else void this.play();
  }

  setBpm(bpm: number): void {
    this.store.dispatch({ type: 'setBpm', bpm });
  }

  setSwing(swing: number): void {
    this.store.dispatch({ type: 'setSwing', swing });
  }
}
