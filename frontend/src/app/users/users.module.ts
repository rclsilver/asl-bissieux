import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ListUsersComponent } from './list-users/list-users.component';
import { UserMenuComponent } from './user-menu/user-menu.component';
import { UsersRouterModule } from './users.routes';

@NgModule({
  declarations: [ListUsersComponent, UserMenuComponent],
  exports: [UserMenuComponent],
  imports: [CommonModule, UsersRouterModule],
})
export class UsersModule {}
