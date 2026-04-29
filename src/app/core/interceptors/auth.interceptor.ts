// src/app/core/interceptors/auth.interceptor.ts
import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const token = auth.getToken();
  const isAuthRequest = req.url.includes('/api/v1/auth/login') || req.url.includes('/api/v1/auth/registro');

  const authReq = (token && !isAuthRequest)
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(authReq).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status === 401) {
        auth.clearSession();
        router.navigate(['/login']);
        return throwError(() => err);
      }
      if (err.status === 403) {
        const modified = new HttpErrorResponse({
          error: { message: 'No tienes permisos para realizar esta acción' },
          status: 403,
          statusText: 'Forbidden',
          url: err.url ?? undefined
        });
        return throwError(() => modified);
      }
      return throwError(() => err);
    })
  );
};
