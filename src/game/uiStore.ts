import type { StructureKind } from '../core/index.ts';

/** Transient interaction state shared by the UI and the renderer. Never saved. */
export interface UiState {
  mode: 'view' | 'place';
  placeKind: StructureKind | null;
  selectedId: string | null;
  /** Last placement validation result while hovering, for the HUD hint. */
  placementHint: string | null;
  /** Citizen whose sheet is open. */
  citizenId: string | null;
  /** Side panel open from the HUD. */
  panel: 'population' | null;
  /** Arena: the contestant of the home team the player is directing. */
  arenaActorId: string | null;
}

export class UiStore {
  private state: UiState = {
    mode: 'view',
    placeKind: null,
    selectedId: null,
    placementHint: null,
    citizenId: null,
    panel: null,
    arenaActorId: null,
  };
  private readonly listeners = new Set<() => void>();

  get = (): UiState => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private set(patch: Partial<UiState>): void {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((l) => l());
  }

  startPlacing(kind: StructureKind): void {
    this.set({ mode: 'place', placeKind: kind, selectedId: null, placementHint: null });
  }

  cancel(): void {
    this.set({ mode: 'view', placeKind: null, placementHint: null });
  }

  select(id: string | null): void {
    this.set({ selectedId: id, mode: 'view', placeKind: null });
  }

  openCitizen(id: string | null): void {
    this.set({ citizenId: id });
  }

  togglePanel(panel: UiState['panel']): void {
    this.set({ panel: this.state.panel === panel ? null : panel });
  }

  selectArenaActor(id: string | null): void {
    this.set({ arenaActorId: id });
  }

  hint(text: string | null): void {
    if (text !== this.state.placementHint) this.set({ placementHint: text });
  }
}
