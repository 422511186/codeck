import type { MobileThreadDetail } from "../shared/codex";

export function appendPendingUserMessage(
  thread: MobileThreadDetail,
  text: string,
  imageCount: number,
  clientId: string
): MobileThreadDetail {
  const imageLines = Array.from({ length: imageCount }, () => "[图片]");
  const pendingText = [text, ...imageLines].filter(Boolean).join("\n");

  return {
    ...thread,
    timeline: [
      ...thread.timeline,
      {
        id: `pending-${clientId}`,
        role: "user",
        text: pendingText
      }
    ]
  };
}
