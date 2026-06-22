"use client";

import { type FormEvent, useState } from "react";
import { uploadImage } from "../lib/client-api";

type ComposerProps = {
  disabled: boolean;
  sending: boolean;
  onSend(text: string, imagePaths?: string[]): Promise<void>;
};

export function Composer({ disabled, sending, onSend }: ComposerProps) {
  const [text, setText] = useState("");
  const [images, setImages] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = text.trim();
    if (!message || disabled || sending || uploading) {
      return;
    }

    try {
      setUploading(true);
      const uploadedImages = await Promise.all(images.map(uploadImage));
      await onSend(
        message,
        uploadedImages.map((image) => image.path)
      );
      setText("");
      setImages([]);
    } catch {
      return;
    } finally {
      setUploading(false);
    }
  }

  return (
    <form className="composer" onSubmit={handleSubmit}>
      <label className="image-picker">
        <span>{images.length ? `${images.length} 张` : "图片"}</span>
        <input
          aria-label="选择图片"
          type="file"
          accept="image/*"
          multiple
          disabled={disabled || sending || uploading}
          onChange={(event) => setImages(Array.from(event.target.files || []))}
        />
      </label>
      <input
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="给 Codex 发送消息"
        disabled={disabled || sending || uploading}
      />
      <button type="submit" disabled={!text.trim() || disabled || sending || uploading}>
        {sending || uploading ? "发送中" : "发送"}
      </button>
    </form>
  );
}
