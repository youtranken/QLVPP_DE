import type { INestApplication } from '@nestjs/common';
import { ADMIN_ROUTE_CLASSES } from '../src/modules/periods/admin-route-classes';

interface Layer {
  route?: { path: string | string[]; methods: Record<string, boolean> };
}

// Express 5 để router ở app.router; Express 4 ở app._router
export function registeredRoutes(app: INestApplication): string[] {
  const instance = app.getHttpAdapter().getInstance() as {
    router?: { stack: Layer[] };
    _router?: { stack: Layer[] };
  };
  const stack = (instance.router ?? instance._router)?.stack ?? [];
  return stack.flatMap((layer) => {
    if (!layer.route) return [];
    const paths = [layer.route.path].flat();
    return Object.entries(layer.route.methods)
      .filter(([, on]) => on)
      .flatMap(([m]) => paths.map((p) => `${m.toUpperCase()} ${p}`));
  });
}

export function unclassifiedAdminRoutes(app: INestApplication): string[] {
  return registeredRoutes(app).filter(
    (r) =>
      r.split(' ')[1].startsWith('/api/admin/') && !(r in ADMIN_ROUTE_CLASSES),
  );
}

// Chiều ngược: khai báo lớp cho route không còn đăng ký (đổi tên/xóa) cũng làm test đỏ
export function staleAdminRouteClasses(
  app: INestApplication,
  classes: Record<string, unknown> = ADMIN_ROUTE_CLASSES,
): string[] {
  const registered = new Set(registeredRoutes(app));
  return Object.keys(classes).filter((r) => !registered.has(r));
}
