// src/app/core/guards/role.guard.ts
import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const roleGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.isLoggedIn()) {
    return router.createUrlTree(['/login']);
  }

  const allowedRoles: string[] = route.data?.['roles'] ?? [];
  const userRole = auth.getRol() ?? '';

  if (allowedRoles.length > 0 && !allowedRoles.includes(userRole)) {
    return router.createUrlTree(['/no-autorizado']);
  }

  // Si la ruta tiene parámetro :dept, verificar que coincida con el departamento del usuario
  const routeDept = route.paramMap?.get('dept');
  if (routeDept) {
    const userDept = auth.getDepartamentoCodigo();
    if (userDept && routeDept.toLowerCase() !== userDept.toLowerCase()) {
      // Redirigir al propio dashboard del usuario
      return router.createUrlTree(['/officer', userDept, 'dashboard']);
    }
  }

  return true;
};
