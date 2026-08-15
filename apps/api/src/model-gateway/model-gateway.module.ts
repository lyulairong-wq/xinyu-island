import { Module } from "@nestjs/common";
import { loadConfig } from "@xinyu/config";
import { ModelGatewayService } from "./model-gateway.service";

@Module({
  providers: [{ provide: ModelGatewayService, useFactory: () => ModelGatewayService.fromConfig(loadConfig(process.env)) }],
  exports: [ModelGatewayService]
})
export class ModelGatewayModule {}
