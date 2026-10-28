const ALLOWED_ENVS = ['development', 'test'] as const;

export type EnvLike = Record<string, string | undefined>;

function inAllowedEnv(env: EnvLike): boolean {
  return ALLOWED_ENVS.includes(env.NODE_ENV as (typeof ALLOWED_ENVS)[number]);
}

export function isDevAuthActive(env: EnvLike): boolean {
  return env.AUTH_DEV_MODE === 'true' && inAllowedEnv(env);
}

export function assertAuthEnvSafe(env: EnvLike): void {
  if (env.AUTH_DEV_MODE === 'true' && !inAllowedEnv(env)) {
    throw new Error(
      `AUTH_DEV_MODE=true chỉ được phép khi NODE_ENV thuộc [${ALLOWED_ENVS.join(', ')}]; ` +
        `NODE_ENV hiện tại: ${JSON.stringify(env.NODE_ENV ?? null)}. Từ chối khởi động (fail-closed).`,
    );
  }
}
