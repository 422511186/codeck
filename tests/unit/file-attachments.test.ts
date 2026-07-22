import { describe, expect, it } from "vitest";
import { decodeFilesMentioned, encodeFilesMentioned, sanitizeFileName, validateFileReferences } from "../../src/shared/file-attachments";

const file = { id: "123e4567-e89b-42d3-a456-426614174000", name: "notes.txt", path: "C:/uploads/123e4567-e89b-42d3-a456-426614174000.txt", mimeType: "text/plain", size: 12 };

describe("file attachments", () => {
  it("清理控制字符和包装分隔符", () => expect(sanitizeFileName(" a/\u0000b:#.txt ")).toBe("a_b__.txt"));
  it("校验并保留文件引用", () => expect(validateFileReferences([file])).toEqual([file]));
  it("编码并恢复 Files-mentioned 包装", () => {
    const encoded = encodeFilesMentioned("hello", [file]);
    expect(encoded).toContain("## notes.txt: C:/uploads/123e4567-e89b-42d3-a456-426614174000.txt");
    expect(decodeFilesMentioned(encoded, "C:/uploads")).toMatchObject({ text: "hello", fileReferences: [{ name: "notes.txt", path: file.path }] });
  });
  it("不解析 uploadDir 外路径", () => expect(decodeFilesMentioned(encodeFilesMentioned("hello", [{ ...file, path: "C:/other/a.txt" }]), "C:/uploads").fileReferences).toEqual([]));
});
