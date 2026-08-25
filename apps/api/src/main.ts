import "reflect-metadata";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseEnv } from "node:util";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { loadConfig } from "@xinyu/config";
import { HttpExceptionFilter } from "./common/http-exception.filter";
import { requestIdMiddleware } from "./common/request-id.middleware";

const localEnvPath = resolve(__dirname, "../../..", ".env");
if (existsSync(localEnvPath)) {
  const localEnvironment = parseEnv(readFileSync(localEnvPath, "utf8"));
  for (const [name, value] of Object.entries(localEnvironment)) {
    if (process.env[name] === undefined) process.env[name] = value;
  }
}
const config = loadConfig(process.env);

async function bootstrap(): Promise<void> {
  const { AppModule } = await import("./app.module");
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  app.use(requestIdMiddleware);
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.enableCors({ origin: config.webOrigin });
  app.setGlobalPrefix("api/v1");
  await app.listen(config.apiPort);
}

void bootstrap();
