import { Injectable, effect, inject, signal } from '@angular/core';
import { Subject, debounceTime, switchMap } from 'rxjs';
import { Task } from '../models/task.model';
import { SearchApiService } from './search-api.service';

@Injectable({ providedIn: 'root' })
export class SearchService {
  private readonly api = inject(SearchApiService);

  readonly searchQuery = signal<string>('');
  readonly searchResults = signal<Task[]>([]);
  readonly isSearching = signal<boolean>(false);

  private readonly trigger$ = new Subject<string>();

  constructor() {
    this.trigger$
      .pipe(
        debounceTime(250),
        switchMap((q) => {
          this.isSearching.set(true);
          return this.api.search(q);
        }),
      )
      .subscribe({
        next: (res) => {
          this.isSearching.set(false);
          this.searchResults.set(res.data ?? []);
        },
        error: () => this.isSearching.set(false),
      });

    effect(() => {
      const q = this.searchQuery().trim();
      if (q.length >= 2) {
        this.trigger$.next(q);
      } else {
        this.searchResults.set([]);
      }
    });
  }

  setQuery(q: string): void {
    this.searchQuery.set(q);
  }
}
