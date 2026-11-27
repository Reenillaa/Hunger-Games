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
  panel: 'population' | 'chronicle' | 'settings' | 'laws' | null;
  /** Arena: the contestant of the home team the player is directing. */
  arenaActorId: string | null;
  /** Neighbouring district being visited through the fog (read-only view), or null at home. */
  visiting: string | null;
  /** The camera reached the fog at an edge: the district that lies beyond it. */
  edge: { dir: 'n' | 'e' | 's' | 'w'; district: string } | null;
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
    visiting: null,
    edge: null,
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

  /** Idempotent close (Escape and the backdrop may both fire). */
  closePanel(): void {
    if (this.state.panel !== null) this.set({ panel: null });
  }

  togglePanel(panel: UiState['panel']): void {
    this.set({ panel: this.state.panel === panel ? null : panel });
  }

  /** Shown while the camera presses against the fog at an edge (cheap: only on change). */
  setEdge(edge: UiState['edge']): void {
    const a = this.state.edge;
    if (a?.dir === edge?.dir && a?.district === edge?.district) return;
    this.set({ edge });
  }

  visit(district: string | null): void {
    this.set({ visiting: district, edge: null, mode: 'view', placeKind: null, selectedId: null });
  }

  selectArenaActor(id: string | null): void {
    this.set({ arenaActorId: id });
  }

  hint(text: string | null): void {
    if (text !== this.state.placementHint) this.set({ placementHint: text });
  }
}
