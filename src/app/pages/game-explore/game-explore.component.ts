import { Component, computed, OnInit, signal } from '@angular/core';
import { DungeonActiveViewerComponent } from '../../components/dungeon-active-viewer/dungeon-active-viewer.component';
import { DungeonListComponent } from '../../components/dungeon-list/dungeon-list.component';
import { PageCardComponent } from '../../components/page-card/page-card.component';
import { RelicListComponent } from '../../components/relic-list/relic-list.component';
import { AnalyticsClickDirective } from '../../directives/analytics-click.directive';
import { allUnlockedDungeons, gamestate } from '../../helpers';

@Component({
  selector: 'app-game-explore',
  imports: [
    PageCardComponent,
    DungeonListComponent,
    RelicListComponent,
    DungeonActiveViewerComponent,
    AnalyticsClickDirective,
  ],
  templateUrl: './game-explore.component.html',
  styleUrl: './game-explore.component.scss',
})
export class GameExploreComponent implements OnInit {
  public mode = signal<'Exploration' | 'Dungeons' | 'Relics'>('Dungeons');

  public dungeonList = computed(() => allUnlockedDungeons());
  public canShowExploration = computed(
    () => gamestate().exploration.isExploring,
  );

  ngOnInit() {
    if (this.canShowExploration()) {
      this.mode.set('Exploration');
    }
  }
}
