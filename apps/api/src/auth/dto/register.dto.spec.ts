import { type ArgumentMetadata, ValidationPipe } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { RegisterDto } from "./register.dto";

describe("RegisterDto", () => {
  it("accepts a whitespace-padded email through the API validation pipe", async () => {
    const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
    const metadata: ArgumentMetadata = { type: "body", metatype: RegisterDto };

    const input = await pipe.transform({
      email: "  USER@example.com ",
      password: "password123",
      nickname: "Xinyu",
      ageBand: "18_plus",
      consents: [
        { type: "terms", version: "1.0" },
        { type: "privacy", version: "1.0" },
        { type: "entertainment_notice", version: "1.0" }
      ]
    }, metadata);

    expect(input.email).toBe("USER@example.com");
  });
});
