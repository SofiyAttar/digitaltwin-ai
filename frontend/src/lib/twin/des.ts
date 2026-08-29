/**
 * Minimal discrete-event simulation kernel — a TypeScript port of the
 * SimPy primitives used by the DigitalTwin.ai factory engine
 * (Environment, Timeout, Store, Process).
 */

export interface SimEvent {
  processed: boolean;
  callbacks: Array<(value: unknown) => void>;
  value: unknown;
}

export function createEvent(): SimEvent {
  return { processed: false, callbacks: [], value: undefined };
}

interface ScheduledItem {
  time: number;
  seq: number;
  event: SimEvent;
}

export class Environment {
  now = 0;
  private queue: ScheduledItem[] = [];
  private seq = 0;

  schedule(event: SimEvent, delay = 0) {
    this.queue.push({ time: this.now + delay, seq: this.seq++, event });
  }

  process(generator: Generator<SimEvent, void, unknown>) {
    const step = (value: unknown) => {
      let result: IteratorResult<SimEvent, void>;
      try {
        result = generator.next(value);
      } catch {
        return;
      }
      if (result.done) return;
      const event = result.value;
      if (event.processed) {
        const relay = createEvent();
        relay.value = event.value;
        relay.callbacks.push(step);
        this.schedule(relay, 0);
      } else {
        event.callbacks.push(step);
      }
    };

    const init = createEvent();
    init.callbacks.push(() => step(undefined));
    this.schedule(init, 0);
  }

  timeout(delay: number): SimEvent {
    const event = createEvent();
    this.schedule(event, delay);
    return event;
  }

  private popNext(): ScheduledItem | null {
    if (this.queue.length === 0) return null;
    let bestIndex = 0;
    for (let i = 1; i < this.queue.length; i++) {
      const a = this.queue[i]!;
      const b = this.queue[bestIndex]!;
      if (a.time < b.time || (a.time === b.time && a.seq < b.seq)) bestIndex = i;
    }
    const [item] = this.queue.splice(bestIndex, 1);
    return item ?? null;
  }

  run(until: number) {
    // Hard iteration cap: protects the browser from a runaway event loop.
    let guard = 0;
    for (;;) {
      if (++guard > 2_000_000) break;
      if (this.queue.length === 0) break;
      let earliest = this.queue[0]!;
      for (const item of this.queue) {
        if (item.time < earliest.time || (item.time === earliest.time && item.seq < earliest.seq)) {
          earliest = item;
        }
      }
      if (earliest.time > until) break;
      const item = this.popNext()!;
      this.now = item.time;
      item.event.processed = true;
      const callbacks = item.event.callbacks;
      item.event.callbacks = [];
      for (const cb of callbacks) cb(item.event.value);
    }
    this.now = until;
  }
}

export class Store<T> {
  items: T[] = [];
  readonly capacity: number;
  private getQueue: SimEvent[] = [];
  private putQueue: Array<{ event: SimEvent; item: T }> = [];

  constructor(
    private env: Environment,
    capacity = Number.POSITIVE_INFINITY,
  ) {
    this.capacity = capacity;
  }

  get(): SimEvent {
    const event = createEvent();
    this.getQueue.push(event);
    this.pump();
    return event;
  }

  put(item: T): SimEvent {
    const event = createEvent();
    this.putQueue.push({ event, item });
    this.pump();
    return event;
  }

  private pump() {
    let progressed = true;
    while (progressed) {
      progressed = false;
      if (this.putQueue.length > 0 && this.items.length < this.capacity) {
        const pending = this.putQueue.shift()!;
        this.items.push(pending.item);
        this.env.schedule(pending.event, 0);
        progressed = true;
      }
      if (this.getQueue.length > 0 && this.items.length > 0) {
        const waiter = this.getQueue.shift()!;
        waiter.value = this.items.shift();
        this.env.schedule(waiter, 0);
        progressed = true;
      }
    }
  }
}

/** Deterministic seeded PRNG (mulberry32) with a Gaussian sampler. */
export class SeededRandom {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  gauss(mu: number, sigma: number): number {
    let u = 0;
    let v = 0;
    while (u === 0) u = this.next();
    while (v === 0) v = this.next();
    const mag = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    return mu + sigma * mag;
  }
}

export const round = (value: number, digits = 2) => {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
};
