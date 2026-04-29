// src/app/shared/components/navbar/navbar.component.ts
import { Component, HostListener, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.css'
})
export class NavbarComponent {
  isScrolled = signal(false);
  mobileMenuOpen = signal(false);

  @HostListener('window:scroll', [])
  onWindowScroll(): void {
    this.isScrolled.set(window.scrollY > 30);
  }

  toggleMobileMenu(): void {
    this.mobileMenuOpen.set(!this.mobileMenuOpen());
  }

  scrollTo(id: string): void {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    this.mobileMenuOpen.set(false);
  }
}
