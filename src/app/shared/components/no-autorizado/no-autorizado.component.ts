// src/app/shared/components/no-autorizado/no-autorizado.component.ts
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-no-autorizado',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div class="text-center">
        <p class="text-6xl font-extrabold text-sky-500 mb-4">403</p>
        <h1 class="text-2xl font-bold text-white mb-2">Acceso no autorizado</h1>
        <p class="text-slate-400 mb-8">No tienes permisos para ver esta página.</p>
        <a routerLink="/login"
          class="px-6 py-3 bg-sky-500 hover:bg-sky-400 text-white font-semibold rounded-xl transition-all">
          Volver al inicio
        </a>
      </div>
    </div>
  `
})
export class NoAutorizadoComponent {}
