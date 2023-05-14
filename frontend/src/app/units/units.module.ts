import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UnitsRouterModule } from './units.routes';
import { ListUnitsComponent } from './components/list-units/list-units.component';

@NgModule({
  declarations: [ListUnitsComponent],
  imports: [CommonModule, UnitsRouterModule],
})
export class UnitsModule {}
