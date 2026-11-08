import { ServiceUnavailableException } from '@nestjs/common';
import type {
  DirectoryClientApi,
  DirectoryUser,
} from '../src/modules/users/directory.client';

// Directory giả cho e2e, không bao giờ gọi PMH ID thật. fetchUser mặc định lỗi: đối chiếu
// sẽ tự hủy ở canary nên không ai trong DB test dùng chung bị đánh dấu no_access.
export function directoryStub(
  users: DirectoryUser[] = [],
  over: Partial<DirectoryClientApi> = {},
): DirectoryClientApi {
  let count = 0;
  return {
    fetchUsers: () => {
      count += 1;
      return Promise.resolve(users);
    },
    fetchUser: () => {
      count += 1;
      return Promise.reject(
        new ServiceUnavailableException({ code: 'DIRECTORY_UNAVAILABLE' }),
      );
    },
    requestCount: () => count,
    resetCount: () => {
      count = 0;
    },
    ...over,
  };
}
