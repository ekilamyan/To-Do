import { Routes } from '@angular/router';
import { ActiveComponent } from './pages/active/active';
import { CompletedComponent } from './pages/completed/completed';
import { DeletedComponent } from './pages/deleted/deleted';
import { authGuard } from './guards/auth.guard';
import { loginRedirectGuard } from './guards/login-redirect.guard';
import { proGuard } from './guards/pro.guard';
import { adminGuard } from './guards/admin.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'active', pathMatch: 'full' },
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login').then(m => m.LoginComponent),
    canActivate: [loginRedirectGuard]
  },
  { path: 'active',    component: ActiveComponent,    canActivate: [authGuard] },
  { path: 'completed', component: CompletedComponent, canActivate: [authGuard, proGuard] },
  { path: 'deleted',   component: DeletedComponent,   canActivate: [authGuard, proGuard] },
  {
    path: 'admin',
    loadComponent: () => import('./pages/admin/admin').then(m => m.AdminComponent),
    canActivate: [authGuard, adminGuard]
  },
  { path: '**', redirectTo: 'active' }
];
