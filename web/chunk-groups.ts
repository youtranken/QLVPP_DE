// Nhóm vendor của build (vite.config.ts giải thích thứ tự). Tách file để test kiểm được mà không nạp cả cấu hình Vite.
export const CHUNK_GROUPS = [
  { name: 'react-vendor', test: /node_modules[\\/](?:react|react-dom|scheduler)[\\/]/ },
  { name: 'data-vendor', test: /node_modules[\\/]@tanstack[\\/]/ },
  { name: 'i18n-vendor', test: /node_modules[\\/][^\\/]*i18next[^\\/]*[\\/]/ },
  { name: 'router-vendor', test: /node_modules[\\/]react-router[^\\/]*[\\/]/ },
]
