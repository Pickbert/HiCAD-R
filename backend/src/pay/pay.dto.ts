import { IsIn, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateOrderDto {
  @IsString()
  plan!: string;

  @IsNumber()
  @Min(1)
  amount!: number;
}

export class PayCallbackDto {
  @IsString()
  orderNo!: string;

  @IsNumber()
  amount!: number;

  @IsIn(['paid', 'cancelled'])
  status!: 'paid' | 'cancelled';

  @IsOptional()
  @IsString()
  signature?: string;

  @IsOptional()
  timestamp?: number;
}
