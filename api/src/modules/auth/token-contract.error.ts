// Token đúng chữ ký nhưng không mang hợp đồng claims v3: vai không đọc được thì không cho vào
export class TokenContractError extends Error {
  constructor(readonly ver: unknown) {
    super(`Access token PMH ID ver=${JSON.stringify(ver ?? null)}, cần ver=3`);
    this.name = 'TokenContractError';
  }
}
