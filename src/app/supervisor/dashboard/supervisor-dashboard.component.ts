// src/app/supervisor/dashboard/supervisor-dashboard.component.ts
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-supervisor-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './supervisor-dashboard.component.html',
  styleUrl: './supervisor-dashboard.component.css'
})
export class SupervisorDashboardComponent {
  constructor(public auth: AuthService) {}

  logout(): void {
    this.auth.logout();
  }
}
