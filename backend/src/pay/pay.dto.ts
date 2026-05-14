import { IsIn, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateOrderDto {
  @ApiProperty({ example: 'pro' })
  @IsString()
  plan!: string;

  @ApiProperty({ minimum: 1, example: 199 })
  @IsNumber()
  @Min(1)
  amount!: number;
}

export class PayCallbackDto {
  @ApiProperty()
  @IsString()
  orderNo!: string;

  @ApiProperty({ minimum: 1 })
  @IsNumber()
  amount!: number;

  @ApiProperty({ enum: ['paid', 'cancelled'] })
  @IsIn(['paid', 'cancelled'])
  status!: 'paid' | 'cancelled';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  signature?: string;

  @ApiPropertyOptional()
  @IsOptional()
  timestamp?: number;
}
