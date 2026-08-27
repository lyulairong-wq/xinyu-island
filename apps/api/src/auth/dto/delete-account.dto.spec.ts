import { type ArgumentMetadata, ValidationPipe } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { DeleteAccountDto } from "./delete-account.dto";

describe("DeleteAccountDto", () => {
  it("rejects deletion requests without an explicit true confirmation", async () => {
    const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
    const metadata: ArgumentMetadata = { type: "body", metatype: DeleteAccountDto };

    await expect(pipe.transform({ password: "password123", confirmed: false }, metadata)).rejects.toMatchObject({ status: 400 });
  });

  it("accepts a confirmed password within the supported length range", async () => {
    const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
    const metadata: ArgumentMetadata = { type: "body", metatype: DeleteAccountDto };

    await expect(pipe.transform({ password: "password123", confirmed: true }, metadata)).resolves.toBeInstanceOf(DeleteAccountDto);
  });
});
