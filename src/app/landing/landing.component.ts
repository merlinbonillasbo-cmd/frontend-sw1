// src/app/landing/landing.component.ts
import { Component, AfterViewInit, OnDestroy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NavbarComponent } from '../shared/components/navbar/navbar.component';
import { FooterComponent } from '../shared/components/footer/footer.component';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [NavbarComponent, FooterComponent, RouterLink],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.css'
})
export class LandingComponent implements AfterViewInit, OnDestroy {
  private observer: IntersectionObserver | null = null;

  features = [
    {
      icon: 'palette',
      label: 'Editor Visual de Flujos',
      description: 'Diseña procesos complejos con drag & drop. Swimlanes, condicionales y bifurcaciones sin una sola línea de código.',
      color: 'sky'
    },
    {
      icon: 'bolt',
      label: 'Motor de Enrutamiento',
      description: 'Enrutamiento automático con condiciones SpEL. Reglas dinámicas que se adaptan a cada caso de negocio en tiempo real.',
      color: 'blue'
    },
    {
      icon: 'traffic',
      label: 'Semáforo en Tiempo Real',
      description: 'Monitorea cada instancia con estados visuales Rojo, Amarillo y Verde. Alertas inteligentes antes de que escale.',
      color: 'green'
    },
    {
      icon: 'users',
      label: 'Colaboración en Vivo',
      description: 'Múltiples diseñadores trabajando simultáneamente sobre el mismo diagrama. Cambios sincronizados al instante.',
      color: 'violet'
    },
    {
      icon: 'chart',
      label: 'Analítica del Gerente',
      description: 'Identifica cuellos de botella con IA. Dashboards de rendimiento, SLA y predicciones de tiempos de ciclo.',
      color: 'amber'
    },
    {
      icon: 'mobile',
      label: 'App Móvil para Clientes',
      description: 'Seguimiento de trámites en tiempo real. Notificaciones push, aprobación con un toque y firma digital móvil.',
      color: 'sky'
    }
  ];

  steps = [
    {
      num: '01',
      title: 'Diseña tu proceso',
      description: 'Usa el editor visual para diagramar swimlanes, tareas, compuertas y participantes en minutos.',
    },
    {
      num: '02',
      title: 'El motor enruta solo',
      description: 'Define reglas de negocio en lenguaje natural. El motor distribuye cada caso automáticamente entre departamentos.',
    },
    {
      num: '03',
      title: 'Supervisa con analítica',
      description: 'El panel gerencial muestra el estado de cada instancia, métricas de SLA y alertas de desvíos en tiempo real.',
    }
  ];

  pricingPlans = [
    {
      name: 'Básico',
      price: '29',
      period: 'mes',
      description: 'Ideal para startups y equipos pequeños que quieren automatizar sus primeros procesos.',
      featured: false,
      features: [
        '1 proceso activo',
        '5 usuarios incluidos',
        '5 GB de almacenamiento',
        'Editor visual básico',
        'Reportes estándar',
        'Soporte por email',
      ],
      cta: 'Empezar gratis'
    },
    {
      name: 'Profesional',
      price: '79',
      period: 'mes',
      description: 'Para empresas en crecimiento que necesitan automatización avanzada y colaboración.',
      featured: true,
      features: [
        'Procesos ilimitados',
        '50 usuarios incluidos',
        '50 GB de almacenamiento',
        'Editor avanzado + swimlanes',
        'Motor SpEL + condiciones',
        'Analítica con IA',
        'App móvil incluida',
        'Webhooks & API REST',
        'Soporte prioritario 24/5',
      ],
      cta: 'Comenzar ahora'
    },
    {
      name: 'Enterprise',
      price: '199',
      period: 'mes',
      description: 'Para grandes corporaciones que requieren máxima seguridad, escala y soporte dedicado.',
      featured: false,
      features: [
        'Todo en Profesional',
        'Usuarios ilimitados',
        'Almacenamiento ilimitado',
        'SLA 99.9% garantizado',
        'SSO / SAML / LDAP',
        'Auditoría completa',
        'Implementación asistida',
        'Soporte dedicado 24/7',
        'Facturación personalizada',
      ],
      cta: 'Contactar ventas'
    }
  ];

  ngAfterViewInit(): void {
    if (typeof window === 'undefined') return;

    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
    );

    document.querySelectorAll('.fade-in-up').forEach(el => {
      this.observer!.observe(el);
    });
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }

  scrollTo(id: string): void {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
