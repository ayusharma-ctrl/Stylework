import { Injectable, OnModuleDestroy } from '@nestjs/common';

@Injectable()
export class RuntimeState implements OnModuleDestroy {
  draining = false;
  onModuleDestroy() {
    this.draining = true;
  }
}
