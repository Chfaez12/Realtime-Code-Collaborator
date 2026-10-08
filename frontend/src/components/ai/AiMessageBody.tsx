import { useState, type CSSProperties, type ReactNode } from "react";

interface Block {
  kind: "text" | "code";
  lang: string;
  text: string;
}

// Splits an answer into text and fenced code blocks. A block still being written counts as code.
function splitBlocks(content: string): Block[] {
  const blocks: Block[] = [];
  let last = 0;
  for (const match of content.matchAll(/```([^\n`]*)\n?([\s\S]*?)(?:```|$)/g)) {
    const start = match.index ?? 0;
    if (start > last) blocks.push({ kind: "text", lang: "", text: content.slice(last, start) });
    blocks.push({ kind: "code", lang: match[1].trim(), text: match[2].replace(/\n$/, "") });
    last = start + match[0].length;
  }
  if (last < content.length) blocks.push({ kind: "text", lang: "", text: content.slice(last) });
  return blocks;
}

// Bold and inline code only. Everything is shown as plain text, never as HTML.
function inline(text: string): ReactNode[] {
  return text.split(/(`[^`\n]+`|\*\*[^*\n]+\*\*)/g).map((part, i) => {
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      return (
        <code key={i} style={{ background: "#2a2a2a", padding: "0 4px", borderRadius: "3px", fontSize: "12px" }}>
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

const smallButton: CSSProperties = {
  background: "transparent", border: "1px solid #444", color: "#aaa", borderRadius: "3px",
  padding: "0 6px", fontSize: "11px", cursor: "pointer",
};

function CodeBlock({ block, canInsert, onInsert }: { block: Block; canInsert: boolean; onInsert: (code: string) => void }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(block.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked */
    }
  };

  return (
    <div style={{ border: "1px solid #2f2f2f", borderRadius: "6px", overflow: "hidden", margin: "6px 0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "3px 8px", background: "#202020" }}>
        <span style={{ fontSize: "11px", color: "#888" }}>{block.lang || "code"}</span>
        <span style={{ display: "flex", gap: "6px" }}>
          <button onClick={copy} style={smallButton}>{copied ? "Copied" : "Copy"}</button>
          {canInsert && <button onClick={() => onInsert(block.text)} style={smallButton}>Insert</button>}
        </span>
      </div>
      <pre style={{ margin: 0, padding: "8px", overflowX: "auto", fontSize: "12px", fontFamily: "Consolas, 'Courier New', monospace", background: "#161616" }}>
        {block.text}
      </pre>
    </div>
  );
}

export default function AiMessageBody({
  content, canInsert, onInsert,
}: { content: string; canInsert: boolean; onInsert: (code: string) => void }) {
  return (
    <div style={{ fontSize: "13px", wordBreak: "break-word" }}>
      {splitBlocks(content).map((block, i) =>
        block.kind === "code" ? (
          <CodeBlock key={i} block={block} canInsert={canInsert} onInsert={onInsert} />
        ) : (
          <div key={i} style={{ whiteSpace: "pre-wrap" }}>{inline(block.text)}</div>
        )
      )}
    </div>
  );
}