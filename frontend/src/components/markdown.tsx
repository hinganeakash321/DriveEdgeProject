import { Fragment, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Minimal, dependency-free Markdown renderer for AI chat responses.
 *
 * Supports the subset the assistants actually emit: **bold**, *italic*,
 * `inline code`, unordered lists (`-`/`*`), ordered lists (`1.`), and
 * paragraphs/line breaks. It builds React elements directly (never raw HTML),
 * so untrusted model output cannot inject markup.
 */

type Token = { type: "ul" | "ol" | "p"; lines: string[] };

function tokenize(src: string): Token[] {
  const tokens: Token[] = [];
  const lines = src.replace(/\r\n/g, "\n").split("\n");
  let para: string[] = [];

  const flushPara = () => {
    if (para.length) {
      tokens.push({ type: "p", lines: para });
      para = [];
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const bullet = /^\s*[-*]\s+(.*)$/.exec(line);
    const ordered = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (bullet) {
      flushPara();
      const last = tokens[tokens.length - 1];
      if (last && last.type === "ul") last.lines.push(bullet[1]);
      else tokens.push({ type: "ul", lines: [bullet[1]] });
    } else if (ordered) {
      flushPara();
      const last = tokens[tokens.length - 1];
      if (last && last.type === "ol") last.lines.push(ordered[1]);
      else tokens.push({ type: "ol", lines: [ordered[1]] });
    } else if (line.trim() === "") {
      flushPara();
    } else {
      para.push(line.trim());
    }
  }
  flushPara();
  return tokens;
}

/** Render inline **bold**, *italic*, and `code` within a single text run. */
function renderInline(text: string, keyPrefix: string): ReactNode[] {
  // Split on the supported inline markers while keeping the delimiters.
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g).filter(Boolean);
  return parts.map((part, i) => {
    const key = `${keyPrefix}-${i}`;
    if (/^\*\*[^*]+\*\*$/.test(part)) {
      return <strong key={key} className="font-semibold text-navy">{part.slice(2, -2)}</strong>;
    }
    if (/^\*[^*]+\*$/.test(part)) {
      return <em key={key}>{part.slice(1, -1)}</em>;
    }
    if (/^`[^`]+`$/.test(part)) {
      return <code key={key} className="rounded bg-soft px-1 py-0.5 text-[0.85em]">{part.slice(1, -1)}</code>;
    }
    return <Fragment key={key}>{part}</Fragment>;
  });
}

export function Markdown({ children, className }: { children: string; className?: string }) {
  const tokens = tokenize(children ?? "");
  return (
    <div className={cn("space-y-2", className)}>
      {tokens.map((t, i) => {
        if (t.type === "ul") {
          return (
            <ul key={i} className="list-disc space-y-1 pl-5">
              {t.lines.map((l, j) => <li key={j}>{renderInline(l, `${i}-${j}`)}</li>)}
            </ul>
          );
        }
        if (t.type === "ol") {
          return (
            <ol key={i} className="list-decimal space-y-1 pl-5">
              {t.lines.map((l, j) => <li key={j}>{renderInline(l, `${i}-${j}`)}</li>)}
            </ol>
          );
        }
        return (
          <p key={i} className="leading-relaxed">
            {t.lines.map((l, j) => (
              <Fragment key={j}>
                {renderInline(l, `${i}-${j}`)}
                {j < t.lines.length - 1 ? <br /> : null}
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}
