import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class SaLoginDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  username!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  password!: string;
}

export class IdentifyDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  identifier!: string;
}
