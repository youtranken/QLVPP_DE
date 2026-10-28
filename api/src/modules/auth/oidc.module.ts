import { Global, Module } from '@nestjs/common';
import { JwtVerifierService } from './jwt-verifier.service';
import { OIDC_PROVIDER } from './oidc-provider';
import { OpenidClientProvider } from './openid-client.provider';

// Tách khỏi AuthModule để tránh vòng AuthModule ↔ UsersModule (directory-sync cũng cần token M2M).
@Global()
@Module({
  providers: [
    { provide: OIDC_PROVIDER, useClass: OpenidClientProvider },
    JwtVerifierService,
  ],
  exports: [OIDC_PROVIDER, JwtVerifierService],
})
export class OidcModule {}
