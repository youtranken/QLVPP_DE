import { describe, expect, it } from 'vitest';
import { CHUNK_GROUPS as groups } from '../../chunk-groups';
// Cùng ưu tiên → nhóm đứng trước nhận module trước (rolldown), nên thứ tự mảng là một phần của cấu hình
const groupOf = (id: string) => groups.find((g) => g.test.test(id))?.name ?? 'app';
const nm = (p: string) => `/w/web/node_modules/${p}`;

describe('vite codeSplitting.groups', () => {
  it('react-vendor đứng đầu: react, react-dom, scheduler không bị nhóm khác (data-vendor) kéo đi', () => {
    expect(groups[0]!.name).toBe('react-vendor');
    for (const id of ['react/index.js', 'react/jsx-runtime.js', 'react/cjs/react.production.js', 'react-dom/client.js', 'scheduler/index.js']) {
      expect(groupOf(nm(id)), id).toBe('react-vendor');
    }
  });

  it('react-vendor chỉ chứa thứ ít đổi: không có router, floating-ui, TanStack, i18n', () => {
    expect(groupOf(nm('react-router/dist/index.mjs'))).toBe('router-vendor');
    expect(groupOf(nm('react-router-dom/dist/index.mjs'))).toBe('router-vendor');
    expect(groupOf(nm('@floating-ui/react/dist/floating-ui.react.mjs'))).toBe('app');
    expect(groupOf(nm('@floating-ui/react-dom/dist/x.mjs'))).toBe('app');
    expect(groupOf(nm('@tanstack/react-query/build/index.js'))).toBe('data-vendor');
    expect(groupOf(nm('react-i18next/dist/es/index.js'))).toBe('i18n-vendor');
    expect(groupOf(nm('i18next/dist/esm/i18next.js'))).toBe('i18n-vendor');
    expect(groupOf('/w/web/src/react/x.ts')).toBe('app');
  });
});
