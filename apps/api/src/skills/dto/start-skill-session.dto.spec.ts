import { type ArgumentMetadata, ValidationPipe } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { StartSkillSessionDto } from "./start-skill-session.dto";

const metadata: ArgumentMetadata = { type: "body", metatype: StartSkillSessionDto };
const request = {
  skill: "zodiac",
  mode: "free",
  requestId: "123e4567-e89b-42d3-a456-426614174000"
};

describe("StartSkillSessionDto", () => {
  it.each(["05-20", "5-20", "5月20日", "5月20"])("accepts a zodiac month-day input of %s", async (monthDay) => {
    const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });

    const input = await pipe.transform({ ...request, monthDay }, metadata);

    expect(input).toBeInstanceOf(StartSkillSessionDto);
    expect(input.monthDay).toBe(monthDay);
  });

  it("rejects an invalid zodiac month-day input", async () => {
    const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });

    await expect(pipe.transform({ ...request, monthDay: "13月40日" }, metadata)).rejects.toMatchObject({
      response: expect.objectContaining({ statusCode: 400 })
    });
  });
});
