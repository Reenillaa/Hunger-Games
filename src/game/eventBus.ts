import type { DomainEvent, DomainEventType } from '../core/index.ts';

type Listener<T extends DomainEventType> = (event: Extract<DomainEvent, { type: T }>) => void;
type AnyListener = (event: DomainEvent) => void;

/** Typed pub/sub for domain events leaving the core. */
export class EventBus {
  private readonly byType = new Map<DomainEventType, Set<AnyListener>>();
  private readonly any = new Set<AnyListener>();

  on<T extends DomainEventType>(type: T, listener: Listener<T>): () => void {
    let set = this.byType.get(type);
    if (!set) {
      set = new Set();
      this.byType.set(type, set);
    }
    set.add(listener as AnyListener);
    return () => set.delete(listener as AnyListener);
  }

  onAny(listener: AnyListener): () => void {
    this.any.add(listener);
    return () => this.any.delete(listener);
  }

  emit(event: DomainEvent): void {
    this.byType.get(event.type)?.forEach((l) => l(event));
    this.any.forEach((l) => l(event));
  }
}
