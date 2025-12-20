import { NestFactory } from "@nestjs/core";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { ValidationPipe, Logger } from "@nestjs/common";
import { AppModule } from "./app.module";
import { AppConfigService } from "./config/config.service";

/**
 * Bootstrap the NestJS application
 * 
 * Startup sequence:
 * 1. Create NestJS application
 * 2. Setup global pipes (validation)
 * 3. Setup CORS (for Postman/frontend testing)
 * 4. Setup Swagger documentation
 * 5. Start listening on configured port
 */
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger("Bootstrap");
  const configService = app.get(AppConfigService);

  // ==================== CORS Configuration ====================
  app.enableCors({
    origin: [
      "http://localhost:3000",
      "http://localhost:3001",
      "http://127.0.0.1:3000",
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Accept"],
  });
  logger.log("CORS enabled for local development");

  // ==================== Global Validation Pipe ====================
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    })
  );
  logger.log("Global validation pipe configured");

  // ==================== API Versioning ====================
  const apiVersion = "v1";
  const apiPath = `/api/${apiVersion}`;
  app.setGlobalPrefix(apiPath);
  logger.log(`API prefix set to: ${apiPath}`);

  // ==================== Swagger Documentation ====================
  const swaggerConfig = new DocumentBuilder()
    .setTitle("MarketInsight API")
    .setDescription("AI-powered Marketing Intelligence Platform")
    .setVersion("1.0.0")
    .addBearerAuth(
      {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "Enter JWT token",
      },
      "bearer"
    )
    .addServer(`http://localhost:${configService.appPort}`, "Local Development")
    .addTag("Users", "User management endpoints")
    .addTag("Campaigns", "Marketing campaign management")
    .build();

  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("api/v1/docs", app, swaggerDocument, {
    swaggerOptions: {
      persistAuthorization: true,
    },
    customSiteTitle: "MarketInsight API Docs",
  });
  logger.log(`Swagger docs available at: /api/v1/docs`);

  // ==================== Start Server ====================
  const port = configService.appPort || 3000;
  await app.listen(port, "0.0.0.0");

  logger.log(`
╔════════════════════════════════════════════════════════╗
║          MarketInsight Server Started                  ║
╠════════════════════════════════════════════════════════╣
║ Port:           ${port.toString().padEnd(40)}║
║ API Path:       ${apiPath.padEnd(40)}║
║ Swagger:        /api/v1/docs${" ".repeat(28)}║
╠════════════════════════════════════════════════════════╣
║ Test URLs:                                             ║
║ - Health:       http://localhost:${port}/api/v1        ${" ".repeat(7)}║
║ - Swagger UI:   http://localhost:${port}/api/v1/docs   ${" ".repeat(4)}║
╚════════════════════════════════════════════════════════╝
  `);
}

bootstrap().catch((error) => {
  const logger = new Logger("Bootstrap");
  logger.error(`Failed to start: ${error.message}`, error.stack);
  process.exit(1);
});