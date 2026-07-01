import type { UserInput } from "../../../docs/generated/app-server-ts/v2/UserInput";
import type { MobileSkillReference } from "../../shared/codex";

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

export function createSkillUserInput(skill: MobileSkillReference): UserInput {
  const name = skill.name.trim();
  const path = skill.path.trim();
  if (!name || !path) {
    throw new Error("Skill 引用不能为空");
  }

  return {
    type: "skill",
    name,
    path
  };
}

export function createTurnUserInput(
  text: string,
  imagePaths: string[] = [],
  skillReferences: MobileSkillReference[] = []
): UserInput[] {
  return [
    createTextUserInput(text),
    ...skillReferences.map(createSkillUserInput),
    ...imagePaths.map(createLocalImageUserInput)
  ];
}
