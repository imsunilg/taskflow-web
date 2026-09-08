import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class UiStateService {
  readonly quickAddOpen = signal(false);
  readonly quickAddDate = signal<string | null>(null);
  readonly filterPanelOpen = signal(false);
  readonly sidebarDrawerOpen = signal(false);
  readonly voiceOpen = signal(false);
  readonly detailTaskId = signal<string | null>(null);

  openQuickAdd(date: string | null = null): void {
    this.quickAddDate.set(date);
    this.quickAddOpen.set(true);
  }
  closeQuickAdd(): void {
    this.quickAddOpen.set(false);
    this.quickAddDate.set(null);
  }

  openTaskDetail(id: string): void {
    this.detailTaskId.set(id);
  }
  closeTaskDetail(): void {
    this.detailTaskId.set(null);
  }

  toggleFilterPanel(): void {
    this.filterPanelOpen.update((v) => !v);
  }

  toggleSidebarDrawer(): void {
    this.sidebarDrawerOpen.update((v) => !v);
  }

  openVoice(): void {
    this.voiceOpen.set(true);
  }
  closeVoice(): void {
    this.voiceOpen.set(false);
  }

  closeTopmost(): void {
    if (this.voiceOpen()) return this.voiceOpen.set(false);
    if (this.detailTaskId()) return this.detailTaskId.set(null);
    if (this.quickAddOpen()) return this.closeQuickAdd();
    if (this.filterPanelOpen()) return this.filterPanelOpen.set(false);
    if (this.sidebarDrawerOpen()) return this.sidebarDrawerOpen.set(false);
  }
}
