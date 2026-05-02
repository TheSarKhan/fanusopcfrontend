"use client";

import { useEditor, EditorContent, Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import ImageExt from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import HorizontalRule from "@tiptap/extension-horizontal-rule";
import { Node, mergeAttributes } from "@tiptap/core";
import { useEffect, useCallback, useRef, useState } from "react";

// ── Custom inline video node ─────────────────────────────────────────────────
const VideoExtension = Node.create({
  name: "video",
  group: "block",
  atom: true,
  draggable: true,
  addAttributes() {
    return { src: { default: null } };
  },
  parseHTML() {
    return [{ tag: "video[src]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "video",
      mergeAttributes(HTMLAttributes, {
        controls: "true",
        style: "max-width:100%;border-radius:10px;margin:8px 0;display:block;",
      }),
    ];
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  addCommands(): any {
    return {
      setVideo:
        (options: { src: string }) =>
        ({ commands }: { commands: Editor["commands"] }) =>
          commands.insertContent({ type: "video", attrs: options }),
    };
  },
});

// ── Helpers ──────────────────────────────────────────────────────────────────
function getStyleLabel(editor: Editor): string {
  if (editor.isActive("heading", { level: 1 })) return "Başlıq";
  if (editor.isActive("heading", { level: 2 })) return "Alt başlıq";
  return "Normal";
}

function setStyle(editor: Editor, value: string) {
  if (value === "h1") editor.chain().focus().setHeading({ level: 1 }).run();
  else if (value === "h2") editor.chain().focus().setHeading({ level: 2 }).run();
  else editor.chain().focus().setParagraph().run();
}

// ── Sub-components ───────────────────────────────────────────────────────────
const Divider = () => (
  <div
    style={{
      width: 1,
      height: 20,
      background: "#E4EDF6",
      margin: "auto 4px",
      flexShrink: 0,
    }}
  />
);

function ToolbarBtn({
  active,
  onClick,
  title,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      style={{
        padding: "5px 9px",
        borderRadius: 6,
        border: "none",
        background: active ? "#E8F0FE" : "transparent",
        color: active ? "#002147" : "#52718F",
        fontWeight: active ? 700 : 500,
        cursor: "pointer",
        fontSize: 13,
        lineHeight: 1,
        minWidth: 30,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "background 0.1s",
      }}
      onMouseEnter={(e) => {
        if (!active)
          (e.currentTarget as HTMLElement).style.background = "#F0F5FF";
      }}
      onMouseLeave={(e) => {
        if (!active)
          (e.currentTarget as HTMLElement).style.background = "transparent";
      }}
    >
      {children}
    </button>
  );
}

function StyleDropdown({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const label = getStyleLabel(editor);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as globalThis.Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const options = [
    { label: "Normal", value: "p", style: { fontSize: 14 } },
    { label: "Başlıq", value: "h1", style: { fontSize: 18, fontWeight: 700 } },
    { label: "Alt başlıq", value: "h2", style: { fontSize: 15, fontWeight: 600 } },
  ];

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          padding: "5px 10px",
          borderRadius: 6,
          border: "none",
          background: open ? "#E8F0FE" : "transparent",
          color: "#1A2535",
          fontSize: 13,
          fontWeight: 500,
          cursor: "pointer",
          minWidth: 100,
          justifyContent: "space-between",
        }}
        onMouseEnter={(e) => {
          if (!open)
            (e.currentTarget as HTMLElement).style.background = "#F0F5FF";
        }}
        onMouseLeave={(e) => {
          if (!open)
            (e.currentTarget as HTMLElement).style.background = "transparent";
        }}
      >
        <span>{label}</span>
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="currentColor"
          style={{ opacity: 0.5 }}
        >
          <path d="M1 3l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        </svg>
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            background: "#fff",
            border: "1px solid #E4EDF6",
            borderRadius: 10,
            boxShadow: "0 4px 20px rgba(0,0,0,0.10)",
            zIndex: 100,
            minWidth: 140,
            overflow: "hidden",
          }}
        >
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                setStyle(editor, opt.value);
                setOpen(false);
              }}
              style={{
                display: "block",
                width: "100%",
                padding: "10px 14px",
                border: "none",
                background:
                  label === opt.label ? "#F0F5FF" : "transparent",
                cursor: "pointer",
                textAlign: "left",
                color: "#1A2535",
                ...opt.style,
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
interface Props {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  onUpload?: (file: File) => Promise<string>;
}

export default function ArticleEditor({
  value,
  onChange,
  placeholder = "Məqaləni buraya yazın...",
  onUpload,
}: Props) {
  const imgInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<"image" | "video" | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ horizontalRule: false }),
      HorizontalRule,
      Underline,
      Link.configure({ openOnClick: false }),
      ImageExt.configure({
        HTMLAttributes: {
          style: "max-width:100%;border-radius:10px;margin:8px 0;display:block;",
        },
      }),
      VideoExtension,
      Placeholder.configure({ placeholder }),
    ],
    immediatelyRender: false,
    content: value,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        style:
          "min-height:420px;padding:20px 24px;outline:none;font-size:16px;line-height:1.85;color:#1A2535;",
      },
    },
  });

  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value || "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const handleImageUpload = useCallback(
    async (file: File) => {
      if (!editor) return;
      if (onUpload) {
        setUploading("image");
        try {
          const url = await onUpload(file);
          editor.chain().focus().setImage({ src: url }).run();
        } catch {
          alert("Şəkil yükləmə xətası");
        } finally {
          setUploading(null);
        }
      } else {
        // Fallback: read as data URL
        const reader = new FileReader();
        reader.onload = (e) => {
          const src = e.target?.result as string;
          if (src) editor.chain().focus().setImage({ src }).run();
        };
        reader.readAsDataURL(file);
      }
    },
    [editor, onUpload]
  );

  const handleVideoUpload = useCallback(
    async (file: File) => {
      if (!editor) return;
      if (onUpload) {
        setUploading("video");
        try {
          const url = await onUpload(file);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (editor.chain().focus() as any).setVideo({ src: url }).run();
        } catch {
          alert("Video yükləmə xətası");
        } finally {
          setUploading(null);
        }
      }
    },
    [editor, onUpload]
  );

  const addLink = useCallback(() => {
    if (!editor) return;
    if (editor.isActive("link")) {
      editor.chain().focus().unsetLink().run();
      return;
    }
    const url = prompt("Link URL-i:");
    if (url) editor.chain().focus().setLink({ href: url, target: "_blank" }).run();
  }, [editor]);

  if (!editor) return null;

  return (
    <div
      style={{
        border: "1.5px solid #C0D2E6",
        borderRadius: 12,
        background: "#fff",
        overflow: "clip",
      }}
    >
      {/* Hidden file inputs */}
      <input
        type="file"
        ref={imgInputRef}
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleImageUpload(f);
          e.target.value = "";
        }}
      />
      <input
        type="file"
        ref={videoInputRef}
        accept="video/*"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleVideoUpload(f);
          e.target.value = "";
        }}
      />

      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 1,
          padding: "6px 10px",
          borderBottom: "1px solid #E4EDF6",
          background: "#F8FAFD",
          position: "sticky",
          top: 56,
          zIndex: 10,
        }}
      >
        {/* Style dropdown */}
        <StyleDropdown editor={editor} />
        <Divider />

        {/* Text formatting */}
        <ToolbarBtn
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="Qalın (Ctrl+B)"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z" />
            <path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z" />
          </svg>
        </ToolbarBtn>
        <ToolbarBtn
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="Kursiv (Ctrl+I)"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          >
            <line x1="19" y1="4" x2="10" y2="4" />
            <line x1="14" y1="20" x2="5" y2="20" />
            <line x1="15" y1="4" x2="9" y2="20" />
          </svg>
        </ToolbarBtn>
        <ToolbarBtn
          active={editor.isActive("underline")}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          title="Altı xəttli (Ctrl+U)"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          >
            <path d="M6 3v7a6 6 0 0 0 6 6 6 6 0 0 0 6-6V3" />
            <line x1="4" y1="21" x2="20" y2="21" />
          </svg>
        </ToolbarBtn>
        <Divider />

        {/* Lists */}
        <ToolbarBtn
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          title="Nöqtəli siyahı"
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <line x1="9" y1="6" x2="20" y2="6" />
            <line x1="9" y1="12" x2="20" y2="12" />
            <line x1="9" y1="18" x2="20" y2="18" />
            <circle cx="4" cy="6" r="1.5" fill="currentColor" stroke="none" />
            <circle cx="4" cy="12" r="1.5" fill="currentColor" stroke="none" />
            <circle cx="4" cy="18" r="1.5" fill="currentColor" stroke="none" />
          </svg>
        </ToolbarBtn>
        <ToolbarBtn
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          title="Nömrəli siyahı"
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <line x1="10" y1="6" x2="21" y2="6" />
            <line x1="10" y1="12" x2="21" y2="12" />
            <line x1="10" y1="18" x2="21" y2="18" />
            <path d="M4 6h1v4" strokeLinejoin="round" fill="none" />
            <path d="M4 10h2" fill="none" />
            <path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1" strokeLinejoin="round" fill="none" />
          </svg>
        </ToolbarBtn>
        <Divider />

        {/* Blockquote */}
        <ToolbarBtn
          active={editor.isActive("blockquote")}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          title="Sitat"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
            <path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z" />
            <path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z" />
          </svg>
        </ToolbarBtn>

        {/* Horizontal rule */}
        <ToolbarBtn
          active={false}
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          title="Ayırıcı xətt"
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <line x1="3" y1="12" x2="21" y2="12" />
          </svg>
        </ToolbarBtn>
        <Divider />

        {/* Image upload */}
        <ToolbarBtn
          active={false}
          onClick={() => imgInputRef.current?.click()}
          title="Şəkil əlavə et"
        >
          {uploading === "image" ? (
            <span style={{ fontSize: 10 }}>...</span>
          ) : (
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
          )}
        </ToolbarBtn>

        {/* Video upload */}
        <ToolbarBtn
          active={false}
          onClick={() => videoInputRef.current?.click()}
          title="Video əlavə et"
        >
          {uploading === "video" ? (
            <span style={{ fontSize: 10 }}>...</span>
          ) : (
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="2" y="6" width="14" height="12" rx="2" />
              <path d="M22 8l-6 4 6 4V8z" />
            </svg>
          )}
        </ToolbarBtn>
        <Divider />

        {/* Link */}
        <ToolbarBtn
          active={editor.isActive("link")}
          onClick={addLink}
          title="Link əlavə et / sil"
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </svg>
        </ToolbarBtn>
        <Divider />

        {/* Undo / Redo */}
        <ToolbarBtn
          active={false}
          onClick={() => editor.chain().focus().undo().run()}
          title="Geri al (Ctrl+Z)"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9 14L4 9l5-5" />
            <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
          </svg>
        </ToolbarBtn>
        <ToolbarBtn
          active={false}
          onClick={() => editor.chain().focus().redo().run()}
          title="Yenidən et (Ctrl+Y)"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M15 14l5-5-5-5" />
            <path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13" />
          </svg>
        </ToolbarBtn>
      </div>

      {/* Editor content */}
      <EditorContent editor={editor} />
    </div>
  );
}
