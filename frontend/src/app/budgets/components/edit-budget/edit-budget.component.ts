import { Component, EventEmitter, Output } from '@angular/core';
import { APISchemas } from 'src/app/core/api/openapi';

@Component({
  selector: 'app-edit-budget',
  templateUrl: './edit-budget.component.html',
  styleUrls: ['./edit-budget.component.scss'],
})
export class EditBudgetComponent {
  @Output()
  readonly save = new EventEmitter<APISchemas['CreateBudgetInput']>();

  @Output()
  readonly cancel = new EventEmitter<void>();

  doCancel() {
    this.cancel.emit();
  }

  doSave() {
    let payload: APISchemas['CreateBudgetInput'] = {
      label: 'dummy',
    };

    this.save.emit(payload);
  }
}
