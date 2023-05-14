import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MembersRouterModule } from './members.routes';
import { ListMembersComponent } from './components/list-members/list-members.component';

@NgModule({
  declarations: [ListMembersComponent],
  imports: [CommonModule, MembersRouterModule],
})
export class MembersModule {}
