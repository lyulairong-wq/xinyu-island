import { defineConfig, devices } from "@playwright/test";

const webPort = Number(process.env.E2E_WEB_PORT ?? 3600);
const apiPort = Number(process.env.E2E_API_PORT ?? 4600);
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: `http://127.0.0.1:${webPort}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure"
  },
  projects: [{
    name: "chromium",
    use: {
      ...devices["Desktop Chrome"],
      ...(process.env.PLAYWRIGHT_CHROME_EXECUTABLE
        ? { launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROME_EXECUTABLE } }
        : {})
    }
  }]
});
