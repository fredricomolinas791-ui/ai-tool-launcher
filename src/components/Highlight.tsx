/** Renders `text` with the parts matching `query` wrapped in a <mark> span.
 *  Case-insensitive; multi-word query matches any segment (OR semantics). */
export function Highlight({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;
  const needles = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (needles.length === 0) return <>{text}</>;

  // Walk the text, advancing a window to find the next match without
  // depending on the (stateful) `lastIndex` of a global RegExp.
  const lower = text.toLowerCase();
  const out: React.ReactNode[] = [];
  let i = 0;
  let seq = 0;
  while (i < text.length) {
    let foundIdx = -1;
    let foundLen = 0;
    for (let j = i; j <= text.length; j++) {
      for (const n of needles) {
        if (j + n.length <= lower.length && lower.slice(j, j + n.length) === n) {
          if (n.length > foundLen) {
            foundIdx = j;
            foundLen = n.length;
          }
        }
      }
    }
    if (foundIdx === -1) {
      out.push(<span key={`t${seq}`}>{text.slice(i)}</span>);
      break;
    }
    if (foundIdx > i) {
      out.push(<span key={`t${seq}`}>{text.slice(i, foundIdx)}</span>);
      seq += 1;
    }
    out.push(
      <mark
        key={`m${seq}`}
        className="rounded px-0.5"
        style={{
          background: 'var(--color-accent-glow)',
          color: 'var(--color-accent)',
        }}
      >
        {text.slice(foundIdx, foundIdx + foundLen)}
      </mark>
    );
    seq += 1;
    i = foundIdx + foundLen;
  }

  return <>{out}</>;
}
