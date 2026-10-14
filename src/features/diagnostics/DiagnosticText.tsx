import { useState } from "react";
/** Bound diagnostic output without hiding any part of the retained evidence. */
export function DiagnosticText({
  text,
  label,
}: {
  text: string;
  label: string;
}) {
  const [page, setPage] = useState(0);
  const lines = text.split("\n");
  const count = Math.max(1, Math.ceil(lines.length / 10));
  const current = Math.min(page, count - 1);
  return (
    <div>
      <pre>{lines.slice(current * 10, current * 10 + 10).join("\n")}</pre>
      {count > 1 && (
        <div className="buttons">
          <button disabled={!current} onClick={() => setPage(current - 1)}>
            Previous {label}
          </button>
          <span>
            {current + 1} / {count}
          </span>
          <button
            disabled={current + 1 === count}
            onClick={() => setPage(current + 1)}
          >
            Next {label}
          </button>
        </div>
      )}
    </div>
  );
}
