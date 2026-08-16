import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { RequestStatus } from '@vpp/shared';
import { api } from './api';
import type { AppSettings, CatalogItem, VppRequest } from './types';

/** Query/mutation dành riêng cho các màn quản trị (M4). */

export interface AdminRequest extends VppRequest {
  userName: string | null;
  userEmail: string | null;
  departmentName: string | null;
}

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface RequestFilters {
  period?: string;
  /** Tìm theo mã đơn hoặc tên người đăng ký. */
  search?: string;
  departmentId?: string;
  status?: RequestStatus;
  page: number;
  pageSize: number;
}

export interface SummaryRow {
  name: string;
  unit: string;
  totalQty: number;
  deliveredQty: number;
  requestCount: number;
}

export interface StatsResponse {
  from: string | null;
  to: string | null;
  byPeriod: { period: string; requestCount: number; itemQty: number; deliveredQty: number }[];
  byDepartment: { departmentName: string; requestCount: number; itemQty: number }[];
  totals: { requestCount: number; deliveredRequests: number; deliveredRatio: number };
}

export interface DirectoryUser {
  id: string;
  pmhSub: string;
  email: string | null;
  name: string | null;
  employeeCode: string | null;
  department: string | null;
  role: 'admin' | 'member';
  disabled: boolean;
  source: 'login' | 'directory';
  lastLoginAt: string | null;
  hasLoggedIn: boolean;
}

export interface AuditEntry {
  id: string;
  actorName: string | null;
  action: string;
  objectType: string | null;
  objectId: string | null;
  detail: unknown;
  createdAt: string;
}

export interface Department {
  id: string;
  name: string;
}

export const adminKeys = {
  requests: (filters: RequestFilters) => ['admin', 'requests', filters] as const,
  summary: (period?: string, departmentId?: string) =>
    ['admin', 'summary', period ?? '', departmentId ?? ''] as const,
  stats: (from?: string, to?: string) => ['admin', 'stats', from ?? '', to ?? ''] as const,
  users: (search: string, page: number) => ['admin', 'users', search, page] as const,
  audit: (action: string, page: number) => ['admin', 'audit', action, page] as const,
  departments: ['departments'] as const,
};

function toQuery(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : '';
}

export function useAdminRequests(filters: RequestFilters) {
  return useQuery({
    queryKey: adminKeys.requests(filters),
    queryFn: () => api.get<Paged<AdminRequest>>(`/admin/requests${toQuery({ ...filters })}`),
  });
}

export function useDepartments() {
  return useQuery({
    queryKey: adminKeys.departments,
    queryFn: () => api.get<Department[]>('/departments'),
    staleTime: 10 * 60 * 1000,
  });
}

export function useSummary(period?: string, departmentId?: string) {
  return useQuery({
    queryKey: adminKeys.summary(period, departmentId),
    queryFn: () =>
      api.get<{ period: string; items: SummaryRow[] }>(
        `/admin/requests/summary${toQuery({ period, departmentId })}`,
      ),
  });
}

export function useStats(from?: string, to?: string) {
  return useQuery({
    queryKey: adminKeys.stats(from, to),
    queryFn: () => api.get<StatsResponse>(`/admin/stats${toQuery({ from, to })}`),
    // Kỳ hiện tại đến từ máy chủ. Chưa biết mà vẫn gọi thì server hiểu là
    // "không lọc kỳ" và trả về toàn bộ lịch sử — biểu đồ nháy sai rồi mới đúng.
    enabled: Boolean(from && to),
  });
}

export function useDirectoryUsers(search: string, page: number) {
  return useQuery({
    queryKey: adminKeys.users(search, page),
    queryFn: () => api.get<Paged<DirectoryUser>>(`/admin/users${toQuery({ search, page })}`),
  });
}

export function useAuditLog(action: string, page: number) {
  return useQuery({
    queryKey: adminKeys.audit(action, page),
    queryFn: () => api.get<Paged<AuditEntry>>(`/admin/audit${toQuery({ action, page })}`),
  });
}

/**
 * Sau mọi thao tác lên đơn, làm mới cả danh sách, tổng hợp, thống kê và chuông.
 * Giữ kiểu KẾT QUẢ để nơi gọi đọc được phản hồi (vd duyệt hàng loạt trả về số
 * đơn đã duyệt / bị bỏ qua).
 */
function useRequestMutation<TVariables, TResult = unknown>(
  mutationFn: (variables: TVariables) => Promise<TResult>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin'] });
      void queryClient.invalidateQueries({ queryKey: ['requests'] });
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useApproveRequest() {
  return useRequestMutation((id: string) => api.post(`/admin/requests/${id}/approve`));
}

export function useRejectRequest() {
  return useRequestMutation((input: { id: string; reason: string }) =>
    api.post(`/admin/requests/${input.id}/reject`, { reason: input.reason }),
  );
}

export function useDeliverLine() {
  return useRequestMutation((input: { id: string; lineId: string; delivered: boolean }) =>
    api.post(`/admin/requests/${input.id}/items/${input.lineId}/deliver`, {
      delivered: input.delivered,
    }),
  );
}

export function useDeliverAll() {
  return useRequestMutation((input: { id: string; delivered: boolean }) =>
    api.post(`/admin/requests/${input.id}/${input.delivered ? 'deliver-all' : 'undeliver-all'}`),
  );
}

export interface AdjustLine {
  itemId: string | null;
  name?: string;
  unit?: string;
  quantity: number;
}

export function useAdjustRequest() {
  return useRequestMutation((input: { id: string; lines: AdjustLine[]; reason?: string }) =>
    api.patch(`/admin/requests/${input.id}`, { lines: input.lines, reason: input.reason }),
  );
}

/** Quản lý danh mục — làm mới `catalog` để cả màn đăng ký thấy ngay thay đổi. */
function useCatalogMutation<TVariables>(mutationFn: (variables: TVariables) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['catalog'] }),
  });
}

export function useSaveCategory() {
  return useCatalogMutation((input: { id?: string; name: string; sortOrder?: number }) =>
    input.id
      ? api.patch(`/admin/categories/${input.id}`, { name: input.name, sortOrder: input.sortOrder })
      : api.post('/admin/categories', { name: input.name, sortOrder: input.sortOrder }),
  );
}

export function useDeleteCategory() {
  return useCatalogMutation((id: string) => api.delete(`/admin/categories/${id}`));
}

export type ItemInput = Partial<
  Pick<CatalogItem, 'code' | 'name' | 'unit' | 'adminOnly' | 'maxQty' | 'active' | 'categoryId'>
>;

export function useSaveItem() {
  return useCatalogMutation((input: { id?: string; values: ItemInput }) =>
    input.id
      ? api.patch(`/admin/items/${input.id}`, input.values)
      : api.post('/admin/items', input.values),
  );
}

export function useDeleteItem() {
  return useCatalogMutation((id: string) => api.delete(`/admin/items/${id}`));
}

export function useDirectorySync() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<{ fetched: number; upserted: number }>('/admin/directory-sync'),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      void queryClient.invalidateQueries({ queryKey: adminKeys.departments });
    },
  });
}

/** Cài đặt hệ thống (ADMIN-8) — hiện chỉ có khung ngày đăng ký. */
export function useAppSettings() {
  return useQuery({
    queryKey: ['admin', 'settings'] as const,
    queryFn: () => api.get<AppSettings>('/admin/settings'),
  });
}

export function useUpdateRegistrationWindow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (window: { startDay: number; endDay: number }) =>
      api.patch<AppSettings>('/admin/settings/registration-window', window),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin'] });
      // Đổi khung ngày là đổi luôn KỲ hiện tại và quyền huỷ đơn — mọi màn đang
      // mở phải tải lại, nếu không người dùng thao tác theo thông tin đã cũ.
      void queryClient.invalidateQueries({ queryKey: ['registration-status'] });
      void queryClient.invalidateQueries({ queryKey: ['requests'] });
    },
  });
}

/** Nhập danh mục từ file (ADMIN-9) — xem trước ở component, mutation chỉ lo phần GHI. */
export interface DongXemTruoc {
  dong: number;
  ma: string;
  nhom: string;
  ten: string;
  donVi: string;
  toiDa: number;
  chiAdmin: boolean;
  hanhDong: 'them' | 'capNhat' | 'khongDoi' | 'loi';
  ghiChu: string;
}

export interface KetQuaXemTruoc {
  dong: DongXemTruoc[];
  tomTat: { them: number; capNhat: number; khongDoi: number; loi: number };
  nhomMoi: string[];
}

export function useApplyCatalogImport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dong: DongXemTruoc[]) =>
      api.post<{ daThem: number; daCapNhat: number; nhomDaTao: number; boQua: number }>(
        '/admin/catalog/import/apply',
        { dong },
      ),
    // Danh mục đổi thì màn đăng ký của mọi người phải thấy ngay.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['catalog'] }),
  });
}

/** Một MÓN được đăng ký — mỗi dòng ở bảng trang chủ quản trị (CORE-10b). */
export interface RequestItemRow {
  id: string;
  requestId: string;
  requestCode: string;
  period: string;
  status: RequestStatus;
  createdAt: string;
  /** Mã lấy từ danh mục; null với dòng "Khác" hoặc món chưa đặt mã. */
  itemCode: string | null;
  name: string;
  unit: string;
  quantity: number;
  deliveredQty: number;
  userName: string | null;
  departmentName: string | null;
}

export function useRequestItems(filters: RequestFilters) {
  return useQuery({
    queryKey: ['admin', 'request-items', filters] as const,
    queryFn: () =>
      api.get<Paged<RequestItemRow>>(`/admin/requests/items${toQuery({ ...filters })}`),
  });
}

/** Một đơn kèm tên người/phòng ban — cho ngăn kéo duyệt mở từ bảng theo món. */
export function useAdminRequest(id: string | null) {
  return useQuery({
    queryKey: ['admin', 'request', id] as const,
    queryFn: () => api.get<AdminRequest>(`/admin/requests/${id}`),
    enabled: Boolean(id),
  });
}

/** Số liệu tổng quan của kỳ đang nhận — hàng thẻ ở trang chủ quản trị. */
export interface AdminOverview {
  period: string;
  choDuyet: number;
  choGiao: number;
  tongMon: number;
  tongNguoi: number;
  daDangKy: number;
  chuaDangKy: number;
}

export function useAdminOverview() {
  return useQuery({
    queryKey: ['admin', 'overview'] as const,
    queryFn: () => api.get<AdminOverview>('/admin/requests/overview'),
  });
}

/** Duyệt nhiều đơn một lượt (CORE-11b). */
export function useApproveMany() {
  return useRequestMutation((ids: string[]) =>
    api.post<{ daDuyet: number; boQua: number }>('/admin/requests/approve-many', { ids }),
  );
}

/** Admin nhập đơn hộ một nhân viên (CORE-2c). */
export function useCreateRequestFor() {
  return useRequestMutation((input: { userId: string; note: string | null; lines: unknown[] }) =>
    api.post('/admin/requests', input),
  );
}

/** Một mốc trong dòng thời gian của đơn. */
export interface MocThoiGian {
  id: string;
  action: string;
  actorName: string | null;
  createdAt: string;
}

export function useRequestTimeline(requestId: string | null) {
  return useQuery({
    queryKey: ['request-timeline', requestId] as const,
    queryFn: () => api.get<MocThoiGian[]>(`/requests/${requestId}/timeline`),
    enabled: Boolean(requestId),
  });
}

/** Dữ liệu phiếu phát hàng (REPORT-4). */
export interface DongPhieuPhat {
  code: string;
  status: RequestStatus;
  userName: string | null;
  userEmail: string | null;
  departmentName: string;
  itemName: string;
  unit: string;
  quantity: number;
  deliveredQty: number;
  note: string | null;
}

export function useHandover(period?: string, departmentId?: string) {
  return useQuery({
    queryKey: ['admin', 'handover', period, departmentId] as const,
    queryFn: () =>
      api.get<{ period: string; rows: DongPhieuPhat[] }>(
        `/admin/handover${toQuery({ period, departmentId })}`,
      ),
  });
}
