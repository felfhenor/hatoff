import { Component } from '@angular/core';
import { gamestate } from '../../helpers';

@Component({
  selector: 'app-savefile-export',
  standalone: true,
  imports: [],
  templateUrl: './savefile-export.component.html',
  styleUrl: './savefile-export.component.scss',
})
export class SavefileExportComponent {
  exportSavefile() {
    const state = gamestate();

    const fileName = `${state.townSetup.heroName}-${Date.now()}.hatoff`;
    const dataStr =
      'data:text/json;charset=utf-8,' +
      encodeURIComponent(JSON.stringify(state));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute('href', dataStr);
    downloadAnchorNode.setAttribute('download', fileName);
    downloadAnchorNode.click();
  }
}