import type { UserInput } from "../../../docs/generated/app-server-ts/v2/UserInput";

export function createTextUserInput(text: string): UserInput {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error("消息不能为空");
  }

  return {
    type: "text",
    text: trimmed,
    text_elements: []
  };
}

export function createLocalImageUserInput(path: string): UserInput {
  const trimmed = path.trim();
  if (!trimmed) {
    throw new Error("图片路径不能为空");
  }

  return {
    type: "localImage",
    path: trimmed
  };
}

export function createTurnUserInput(text: string, imagePaths: string[] = []): UserInput[] {
  return [createTextUserInput(text), ...imagePaths.map(createLocalImageUserInput)];
}
