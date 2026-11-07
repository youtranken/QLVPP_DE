import { readFileSync } from 'node:fs';
import { expect, type APIRequestContext } from '@playwright/test';
import { devHeaders } from './helpers';

export async function createItemViaApi(request: APIRequestContext, name: string): Promise<string> {
  const headers = devHeaders('admin');
  const file = await request.post('/api/files', {
    headers,
    multipart: { purpose: 'item_image', file: { name: 'item.png', mimeType: 'image/png', buffer: readFileSync('playwright/fixtures/item.png') } },
  });
  expect(file.status()).toBe(201);
  const res = await request.post('/api/admin/items', { headers, data: { name, unit: 'cai', image_file_id: (await file.json()).id, max_qty: 5 } });
  expect(res.status()).toBe(201);
  return (await res.json()).id as string;
}
