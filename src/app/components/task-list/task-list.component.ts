import { NgClass } from '@angular/common';
import { Component, computed, input, signal } from '@angular/core';
import { AnalyticsClickDirective } from '../../directives/analytics-click.directive';
import {
  baseCardClasses,
  halfCardClasses,
  hasEnoughFortifications,
} from '../../helpers';
import { GameTask } from '../../interfaces';
import { TaskDisplayComponent } from '../task-display/task-display.component';
import { TaskHeroSelectorComponent } from '../task-hero-selector/task-hero-selector.component';

@Component({
  selector: 'app-task-list',
  imports: [
    TaskDisplayComponent,
    NgClass,
    TaskHeroSelectorComponent,
    AnalyticsClickDirective,
  ],
  templateUrl: './task-list.component.html',
  styleUrl: './task-list.component.scss',
})
export class TaskListComponent {
  public tasks = input.required<GameTask[]>();
  public selectedTask = signal<GameTask | undefined>(undefined);

  public meetsRequiredDefense = computed(() => hasEnoughFortifications());

  public cardClasses = computed(() => {
    if (this.selectedTask()) {
      return halfCardClasses();
    }

    return baseCardClasses();
  });
}
