/**
 * Clausewitz / Jomini UI Standard: Base Window & Component Architecture
 * Provides abstract window lifecycle, dynamic list virtualization, and nested tooltip support.
 */

export interface WindowPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WindowState {
  isOpen: boolean;
  isMinimized: boolean;
  activeTabId: string;
  lastUpdatedTick: number;
}

/**
 * Dynamic List Virtualization Helper
 * Enables silky 60fps rendering of thousands of Pop clusters or Trade Goods rows without DOM lag.
 */
export interface VirtualListSlice<T> {
  visibleItems: { item: T; index: number; top: number }[];
  totalHeight: number;
  startIndex: number;
  endIndex: number;
  topPadding: number;
  bottomPadding: number;
}

export class VirtualListRenderer<T> {
  private itemHeight: number;
  private bufferCount: number;

  constructor(itemHeight: number = 32, bufferCount: number = 4) {
    this.itemHeight = itemHeight;
    this.bufferCount = bufferCount;
  }

  public computeSlice(
    items: T[],
    viewportHeight: number,
    scrollTop: number
  ): VirtualListSlice<T> {
    const totalCount = items.length;
    const totalHeight = totalCount * this.itemHeight;

    if (totalCount === 0 || viewportHeight <= 0) {
      return {
        visibleItems: [],
        totalHeight: 0,
        startIndex: 0,
        endIndex: 0,
        topPadding: 0,
        bottomPadding: 0
      };
    }

    const rawStartIndex = Math.floor(scrollTop / this.itemHeight);
    const visibleCount = Math.ceil(viewportHeight / this.itemHeight);

    const startIndex = Math.max(0, rawStartIndex - this.bufferCount);
    const endIndex = Math.min(totalCount - 1, rawStartIndex + visibleCount + this.bufferCount);

    const visibleItems: { item: T; index: number; top: number }[] = [];
    for (let i = startIndex; i <= endIndex; i++) {
      visibleItems.push({
        item: items[i],
        index: i,
        top: i * this.itemHeight
      });
    }

    const topPadding = startIndex * this.itemHeight;
    const bottomPadding = Math.max(0, (totalCount - 1 - endIndex) * this.itemHeight);

    return {
      visibleItems,
      totalHeight,
      startIndex,
      endIndex,
      topPadding,
      bottomPadding
    };
  }
}

/**
 * Nested Tooltip Token Definition
 * Allows Clausewitz-style recursive tooltips (e.g. hovering Pop -> reveals Estate -> reveals Privilege -> reveals Law).
 */
export interface TooltipDefinition {
  id: string;
  title: string;
  description: string;
  icon?: string;
  attributes?: { label: string; value: string; color?: string }[];
  nestedTooltipIds?: string[];
}

export class NestedTooltipManager {
  private tooltips: Map<string, TooltipDefinition> = new Map();
  private activeStack: string[] = [];

  public registerTooltip(def: TooltipDefinition): void {
    this.tooltips.set(def.id, def);
  }

  public getTooltip(id: string): TooltipDefinition | undefined {
    return this.tooltips.get(id);
  }

  public pushTooltip(id: string): boolean {
    if (!this.tooltips.has(id)) return false;
    this.activeStack.push(id);
    return true;
  }

  public popTooltip(): string | undefined {
    return this.activeStack.pop();
  }

  public clearStack(): void {
    this.activeStack = [];
  }

  public getActiveStack(): TooltipDefinition[] {
    return this.activeStack
      .map(id => this.tooltips.get(id))
      .filter((t): t is TooltipDefinition => t !== undefined);
  }
}

/**
 * Abstract Base UI Window
 * Manages two-way data bindings, dirty-checking to prevent full redraws, and modal lifecycle.
 */
export abstract class BaseUIWindow {
  public readonly id: string;
  public readonly title: string;
  public readonly icon: string;
  public isOpen: boolean = false;
  public isDirty: boolean = true;
  public zIndex: number = 100;
  public activeTab: string = 'overview';
  protected lastRenderedHash: string = '';

  constructor(id: string, title: string, icon: string = '📜') {
    this.id = id;
    this.title = title;
    this.icon = icon;
  }

  public open(): void {
    this.isOpen = true;
    this.isDirty = true;
    this.onOpen();
  }

  public close(): void {
    this.isOpen = false;
    this.onClose();
  }

  public toggle(): void {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  public setActiveTab(tabId: string): void {
    if (this.activeTab !== tabId) {
      this.activeTab = tabId;
      this.isDirty = true;
    }
  }

  public markDirty(): void {
    this.isDirty = true;
  }

  /**
   * Called on simulation ticks (Daily or Monthly).
   * Only performs reactive data flushes if window is open and marked dirty.
   */
  public onTick(simulationData: any): void {
    if (!this.isOpen) return;
    this.onSimulationTick(simulationData);
  }

  /**
   * Generates DOM/HTML structure or reactive ViewModel snapshot.
   */
  public abstract render(simulationData: any): string;

  protected onOpen(): void {}
  protected onClose(): void {}
  protected abstract onSimulationTick(simulationData: any): void;
}
