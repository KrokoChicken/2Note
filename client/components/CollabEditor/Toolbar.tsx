"use client";

import React, { useMemo } from "react";
import { Editor } from "@tiptap/react";
import styles from "./Toolbar.module.css";

type Props = { editor: Editor | null };

type Btn = {
  label: string;
  title?: string;
  isActive?: () => boolean;
  onClick: () => void;
  disabled?: boolean;
};

function TB({ label, title, isActive, onClick, disabled }: Btn) {
  const active = isActive?.() ?? false;
  return (
    <button
      type="button"
      title={title ?? label}
      aria-pressed={active ? "true" : "false"}
      disabled={disabled}
      onClick={onClick}
      style={{
        padding: "6px 10px",
        border: "1px solid #ddd",
        background: active ? "#eef2ff" : "#fff",
        borderRadius: 6,
        fontWeight: 500,
      }}
    >
      {label}
    </button>
  );
}

export default function SimpleToolbar({ editor }: Props) {
  if (!editor) return null;

  const block = useMemo<"p" | "h1" | "h2" | "h3">(() => {
    if (editor.isActive("heading", { level: 1 })) return "h1";
    if (editor.isActive("heading", { level: 2 })) return "h2";
    if (editor.isActive("heading", { level: 3 })) return "h3";
    return "p";
  }, [editor.state]); // track editor changes

  const changeBlock = (v: "p" | "h1" | "h2" | "h3") => {
    const ch = editor.chain().focus();
    if (v === "p") ch.setParagraph().run();
    else ch.toggleHeading({ level: v === "h1" ? 1 : v === "h2" ? 2 : 3 }).run();
  };

  const canUndo = editor.can().undo();
  const canRedo = editor.can().redo();

  return (
    <div role="toolbar" aria-label="Editor toolbar" className={styles.toolbar}>
      {/* Block type */}
      <select
        value={block}
        onChange={(e) =>
          changeBlock(e.target.value as "p" | "h1" | "h2" | "h3")
        }
        title="Block type"
        aria-label="Block type"
        className={styles.blockSelect}
      >
        <option value="p">Paragraph</option>
        <option value="h1">Heading 1</option>
        <option value="h2">Heading 2</option>
        <option value="h3">Heading 3</option>
      </select>

      {/* Inline */}
      <TB
        label="B"
        title="Bold (Ctrl/Cmd+B)"
        isActive={() => editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
      />
      <TB
        label="I"
        title="Italic (Ctrl/Cmd+I)"
        isActive={() => editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      />

      {/* Undo / Redo */}
      <TB
        label="↶"
        title="Undo (Ctrl/Cmd+Z)"
        disabled={!canUndo}
        onClick={() => editor.chain().focus().undo().run()}
      />
      <TB
        label="↷"
        title="Redo (Ctrl/Cmd+Shift+Z)"
        disabled={!canRedo}
        onClick={() => editor.chain().focus().redo().run()}
      />

      {/* Clear */}
      <TB
        label="Clear"
        title="Clear formatting"
        onClick={() =>
          editor.chain().focus().unsetAllMarks().clearNodes().run()
        }
      />
    </div>
  );
}
