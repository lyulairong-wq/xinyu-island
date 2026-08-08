import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "心屿 · Island",
  description: "和不同的 AI 角色聊天，体验不同的故事与人生可能。"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
