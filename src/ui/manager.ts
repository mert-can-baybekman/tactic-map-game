/**
 * Centralized UI Manager & Window Orchestration Engine
 * Coordinates window focus stacks, event dispatching from simulation ticks, and nested tooltip resolutions.
 */

import { BaseUIWindow, NestedTooltipManager } from './base.ts';

export type UIEventType = 'window_opened' | 'window_closed' | 'tab_switched' | 'action_executed';

export interface UIEventListener {
  (eventType: UIEventType, payload: any): void;
}

export class UIManager {
  private windows: Map<string, BaseUIWindow> = new Map();
  private zIndexCounter: number = 100;
  private focusStack: string[] = [];
  public tooltipManager: NestedTooltipManager = new NestedTooltipManager();
  private listeners: UIEventListener[] = [];

  public registerWindow(window: BaseUIWindow): void {
    this.windows.set(window.id, window);
  }

  public getWindow<T extends BaseUIWindow>(id: string): T | undefined {
    return this.windows.get(id) as T | undefined;
  }

  public getAllWindows(): BaseUIWindow[] {
    return Array.from(this.windows.values());
  }

  public openWindow(id: string): boolean {
    const win = this.windows.get(id);
    if (!win) return false;

    this.bringToFront(id);
    win.open();
    this.notify('window_opened', { windowId: id });
    return true;
  }

  public closeWindow(id: string): boolean {
    const win = this.windows.get(id);
    if (!win) return false;

    win.close();
    this.focusStack = this.focusStack.filter(winId => winId !== id);
    this.notify('window_closed', { windowId: id });
    return true;
  }

  public toggleWindow(id: string): boolean {
    const win = this.windows.get(id);
    if (!win) return false;

    if (win.isOpen) {
      return this.closeWindow(id);
    } else {
      return this.openWindow(id);
    }
  }

  public closeTopmostWindow(): boolean {
    if (this.focusStack.length === 0) return false;
    const topId = this.focusStack[this.focusStack.length - 1];
    return this.closeWindow(topId);
  }

  public bringToFront(id: string): void {
    const win = this.windows.get(id);
    if (!win) return;

    this.zIndexCounter += 2;
    win.zIndex = this.zIndexCounter;
    this.focusStack = this.focusStack.filter(winId => winId !== id);
    this.focusStack.push(id);
  }

  /**
   * Dispatches simulation tick events to active visible windows.
   * Flushes data reactively without doing full-screen re-renders.
   */
  public dispatchSimulationTick(simulationData: any): void {
    for (const win of this.windows.values()) {
      if (win.isOpen) {
        win.onTick(simulationData);
      }
    }
  }

  public subscribe(listener: UIEventListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notify(eventType: UIEventType, payload: any): void {
    for (const listener of this.listeners) {
      listener(eventType, payload);
    }
  }
}
