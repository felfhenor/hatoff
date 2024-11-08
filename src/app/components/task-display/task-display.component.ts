import { Component, computed, input } from '@angular/core';
import { TippyDirective } from '@ngneat/helipopper';
import { getTaskProgress, heroesAllocatedToTask } from '../../helpers';
import { GameTask } from '../../interfaces';
import { TaskHeroSmallComponent } from '../task-hero-small/task-hero-small.component';

@Component({
  selector: 'app-task-display',
  standalone: true,
  imports: [TippyDirective, TaskHeroSmallComponent],
  templateUrl: './task-display.component.html',
  styleUrl: './task-display.component.scss',
})
export class TaskDisplayComponent {
  public task = input.required<GameTask>();
  public active = input<boolean>(false);
  public heroes = computed(() => heroesAllocatedToTask(this.task()));

  public completion = computed(
    () =>
      (getTaskProgress(this.task()) / this.task().damageRequiredPerCycle) * 100,
  );
}
