import { useEffect, useRef } from 'react';
import { useAIStream } from '../../hooks/useAIStream';
import { useHistory } from '../../hooks/useHistory';
import { useAI } from '../../hooks/useAI';
import { AIOutputTabs } from './AIOutputTabs';

/**
 * AIToolPanel — drop-in replacement for the streaming output block in
 * every tool. Wraps AIOutputTabs (思考/结果 tabs) and auto-records the
 * generation to the history store on completion.
 *
 * The tool just passes the `useAIStream` hook value and a few metadata
 * fields. No more inline rendering of `stream.output` with copy buttons,
 * no more forgetting to record history — those are all centralized here.
 *
 * Usage
 * -----
 *   const stream = useAIStream();
 *   ...
 *   // Tool calls run() and passes stream here:
 *   <AIToolPanel
 *     stream={stream}
 *     toolId={10}
 *     toolName="文章摘要"
 *     prompt={input}                   // user input, recorded in history
 *   />
 */
export interface AIToolPanelProps {
  stream: ReturnType<typeof useAIStream>;
  toolId: number;
  toolName: string;
  /** The user input (or summary of inputs) that produced this generation. */
  prompt: string;
  /** Optional override of how to detect "has output". */
  hasOutput?: boolean;
  /** Optional duration tracker — by default we use stream.startTime if set
   *  by the caller. For now we just record `Date.now() - streamStart` if
   *  the tool tracked it; most tools don't bother so duration is omitted. */
  durationMs?: number;
}

export function AIToolPanel({
  stream, toolId, toolName, prompt, hasOutput, durationMs,
}: AIToolPanelProps) {
  const history = useHistory();
  const ai = useAI();
  // Record on the transition from streaming → idle. We key off the
  // streaming flag so re-renders during streaming don't spam entries.
  // Note: this is a "best effort" — if the component unmounts before
  // streaming finishes, the entry won't be recorded.
  const wasStreaming = usePrev(stream.streaming);
  useEffect(() => {
    if (wasStreaming && !stream.streaming && !stream.error && stream.text.length > 0) {
      history.add({
        toolId,
        toolName,
        prompt: prompt.slice(0, 500),
        result: stream.text,
        thinking: stream.thinking,
        provider: ai.activeProvider ?? undefined,
        durationMs,
      });
    }
  }, [stream.streaming]);

  const showOutput = hasOutput ?? (stream.text.length > 0 || stream.thinking.length > 0);

  if (!showOutput) {
    return null;
  }

  return (
    <AIOutputTabs
      text={stream.text}
      thinking={stream.thinking}
      streaming={stream.streaming}
      error={stream.error}
    />
  );
}

// Small `usePrevious` helper so the recording effect only fires on
// the streaming → idle transition (not on every text delta).
function usePrev<T>(value: T): T | undefined {
  const ref = useRef<T | undefined>(undefined);
  useEffect(() => { ref.current = value; }, [value]);
  return ref.current;
}
