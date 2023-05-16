import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UsersRouterModule } from './users.routes';
import { ListUsersComponent } from './components/list-users/list-users.component';

@NgModule({
  declarations: [ListUsersComponent],
  imports: [CommonModule, UsersRouterModule],
})
export class UsersModule {}
