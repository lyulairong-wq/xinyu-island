import { type ArgumentMetadata, ValidationPipe } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { LoginDto } from "./login.dto";

describe("LoginDto", () => {
  it("accepts a whitespace-padded mixed-case email through the API validation pipe", async () => {
    const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
    const metadata: ArgumentMetadata = { type: "body", metatype: LoginDto };

    const input = await pipe.transform(
      { email: "  USER@example.com ", password: "password123", deviceLabel: "web" },
      metadata
    );

    expect(input).toBeInstanceOf(LoginDto);
    expect(input.email).toBe("USER@example.com");
  });
});
