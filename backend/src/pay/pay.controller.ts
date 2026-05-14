import {
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  NotFoundException,
  Param,
  Post,
  UnauthorizedException,
  UseGuards
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/current-user.decorator.js';
import { JwtGuard } from '../common/jwt.guard.js';
import { JsonDatabaseService } from '../database/json-database.service.js';
import { nowIso, StoredUser } from '../domain.js';
import { getRequiredSecret } from '../security/runtime-security.js';
import { CreateOrderDto, PayCallbackDto } from './pay.dto.js';
import { MockPaymentProvider } from './payment-provider.js';

@ApiTags('pay')
@Controller('pay')
export class PayController {
  constructor(@Inject(JsonDatabaseService) private readonly db: JsonDatabaseService) {}

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a mock payment order' })
  @UseGuards(JwtGuard)
  @Post('create')
  create(@CurrentUser() user: StoredUser, @Body() dto: CreateOrderDto) {
    return this.db.mutate((state) => {
      const now = nowIso();
      const order = {
        orderNo: `ORD-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
        userId: user.id,
        plan: dto.plan,
        amount: dto.amount,
        status: 'pending' as const,
        provider: 'mock' as const,
        createdAt: now,
        updatedAt: now
      };
      state.orders.push(order);
      const provider = new MockPaymentProvider(
        getRequiredSecret(
          'PAY_CALLBACK_SECRET',
          process.env.PAY_CALLBACK_SECRET,
          'development-payment-secret-with-32-chars'
        )
      );
      return provider.createPayment(order).then((payment) => ({ ...order, ...payment }));
    });
  }

  @ApiOperation({ summary: 'Read payment order status' })
  @Get('status/:orderNo')
  status(@Param('orderNo') orderNo: string) {
    const order = this.db.data.orders.find((entry) => entry.orderNo === orderNo);
    if (!order) throw new NotFoundException('order not found');
    return order;
  }

  @ApiOperation({ summary: 'Read mock payment QR text' })
  @Get('code/:orderNo')
  code(@Param('orderNo') orderNo: string) {
    const order = this.db.data.orders.find((entry) => entry.orderNo === orderNo);
    if (!order) throw new NotFoundException('order not found');
    return { orderNo, provider: 'mock', qrText: `hicad://pay/${orderNo}` };
  }

  @ApiOperation({ summary: 'Receive a signed mock payment callback' })
  @Post('callback')
  callback(@Body() body: PayCallbackDto, @Headers('x-hicad-signature') headerSignature?: string) {
    const secret = getRequiredSecret(
      'PAY_CALLBACK_SECRET',
      process.env.PAY_CALLBACK_SECRET,
      'development-payment-secret-with-32-chars'
    );
    const provider = new MockPaymentProvider(secret);
    const signature = headerSignature ?? body.signature;
    if (!provider.verifyCallback({ ...body }, signature)) {
      throw new UnauthorizedException('invalid payment callback signature');
    }
    return this.db.mutate((state) => {
      const order = state.orders.find((entry) => entry.orderNo === body.orderNo);
      if (!order) throw new NotFoundException('order not found');
      if (order.amount !== body.amount) throw new UnauthorizedException('payment amount mismatch');
      order.status = body.status;
      order.updatedAt = nowIso();
      if (body.status === 'paid') {
        order.activationCode = order.activationCode ?? crypto.randomUUID().slice(0, 12);
      }
      return { ok: true, order };
    });
  }
}
