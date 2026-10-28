export interface MeResponse {
  sub: string;
  role: string;
  devMode: boolean;
  csrfToken: string | null;
  fullName: string | null;
  email: string | null;
  department: string | null;
  employeeCode: string | null;
  locale: string | null;
  config: {
    registration_last_day: number;
    default_max_qty: number;
    admin_contact: string;
  };
}
