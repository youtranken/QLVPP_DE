import {
  Body,
  Controller,
  Get,
  Put,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import type { AuthedRequest } from '../auth/identity.types';
import { Roles } from '../auth/roles.decorator';
import { ConfigAdminService } from './config-admin.service';

class SignersDto {
  @IsString()
  @MaxLength(200)
  preparer!: string;

  @IsString()
  @MaxLength(200)
  head!: string;

  @IsString()
  @MaxLength(200)
  approver!: string;
}

class ConfigUpdateDto {
  @IsOptional()
  @IsInt()
  @Min(3)
  @Max(28)
  registration_last_day?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(999)
  default_max_qty?: number;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  admin_group?: string;

  @IsOptional()
  @IsBoolean()
  low_stock_notify?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => SignersDto)
  signers?: SignersDto;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  admin_contact?: string;
}

@Controller('admin/config')
@Roles('sa', 'admin')
export class ConfigController {
  constructor(private readonly configAdmin: ConfigAdminService) {}

  @Get()
  list() {
    return this.configAdmin.listEditable();
  }

  @Put()
  update(@Body() body: ConfigUpdateDto, @Req() req: AuthedRequest) {
    if (!req.user) {
      throw new UnauthorizedException({
        code: 'UNAUTHENTICATED',
        message: 'Chưa đăng nhập.',
      });
    }
    return this.configAdmin.update(body, req.user.sub);
  }
}
