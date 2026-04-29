import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  // Rutas públicas: pre-renderizar en el servidor
  { path: '', renderMode: RenderMode.Prerender },
  { path: 'login', renderMode: RenderMode.Prerender },
  { path: 'registro', renderMode: RenderMode.Prerender },
  { path: 'no-autorizado', renderMode: RenderMode.Prerender },

  // Rutas protegidas: solo cliente (requieren localStorage y/o APIs del browser)
  { path: 'admin/dashboard', renderMode: RenderMode.Client },
  { path: 'officer/dashboard', renderMode: RenderMode.Client },
  { path: 'supervisor/dashboard', renderMode: RenderMode.Client },
  { path: 'cliente/dashboard', renderMode: RenderMode.Client },
  { path: 'pizarra', renderMode: RenderMode.Client },
  { path: 'pizarra/editor/:id', renderMode: RenderMode.Client },

  // Fallback
  { path: '**', renderMode: RenderMode.Client }
];
