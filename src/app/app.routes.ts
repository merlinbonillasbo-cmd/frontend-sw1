import { Routes } from '@angular/router';
import { LandingComponent } from './landing/landing.component';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';

export const routes: Routes = [
  { path: '', component: LandingComponent },
  {
    path: 'registro',
    loadComponent: () =>
      import('./auth/registro/registro.component').then(m => m.RegistroComponent)
  },
  {
    path: 'login',
    loadComponent: () =>
      import('./auth/login/login.component').then(m => m.LoginComponent)
  },
  {
    path: 'admin/dashboard',
    loadComponent: () =>
      import('./admin/dashboard/admin-dashboard.component').then(m => m.AdminDashboardComponent),
    canActivate: [authGuard, roleGuard],
    data: { roles: ['ADM_DISENADOR'] }
  },
  {
    path: 'officer/dashboard',
    loadComponent: () =>
      import('./officer/dashboard/officer-dashboard.component').then(m => m.OfficerDashboardComponent),
    canActivate: [authGuard, roleGuard],
    data: { roles: ['OFFICER'] }
  },
  {
    path: 'officer/:dept/dashboard',
    loadComponent: () =>
      import('./officer/dashboard/officer-dashboard.component').then(m => m.OfficerDashboardComponent),
    canActivate: [authGuard, roleGuard],
    data: { roles: ['OFFICER'] }
  },
  {
    path: 'supervisor/dashboard',
    loadComponent: () =>
      import('./supervisor/dashboard/supervisor-dashboard.component').then(m => m.SupervisorDashboardComponent),
    canActivate: [authGuard, roleGuard],
    data: { roles: ['SUPERVISOR'] }
  },
  {
    path: 'cliente/dashboard',
    loadComponent: () =>
      import('./client/dashboard/client-dashboard.component').then(m => m.ClientDashboardComponent),
    canActivate: [authGuard, roleGuard],
    data: { roles: ['CLIENT'] }
  },
  {
    path: 'pizarra',
    loadComponent: () =>
      import('./pizarra/lista-flujos/lista-flujos.component').then(m => m.ListaFluiosComponent),
    canActivate: [authGuard, roleGuard],
    data: { roles: ['ADM_DISENADOR'] }
  },
  {
    path: 'pizarra/editor/:id',
    loadComponent: () =>
      import('./pizarra/editor/editor-pizarra.component').then(m => m.EditorPizarraComponent),
    canActivate: [authGuard, roleGuard],
    data: { roles: ['ADM_DISENADOR'] }
  },
  {
    path: 'no-autorizado',
    loadComponent: () =>
      import('./shared/components/no-autorizado/no-autorizado.component').then(m => m.NoAutorizadoComponent)
  },
  { path: '**', redirectTo: '' }
];
