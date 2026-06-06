import { useState, useRef, useCallback, useMemo } from 'react';
import { useAI } from './useAI';
import { chatParts } from '../lib/ai';

/**
 * useAIStream — calls the LLM and streams the result into two
 * separate buffers: one for the model's "thinking" (chain-of-thought)
 * and one for the final answer text.
 *
 * Backward-compat: `output` is still the concatenated string
 * (thinking + '\n\n' + text) for any consumer that hasn't migrated
 * to the new `parts` API yet.
 */
export function useAIStream() {
  const ai = useAI();
  const [streaming, setStreaming] = useState(false);
  const [thinking, setThinking] = useState('');
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const abortedRef = useRef(false);

  /**
   * `output` 是从 thinking + text **派生**出来的,不再是独立 state。
   *
   * 之前的实现在 `setText((prev) => { ... setOutput(...) ... return ... })`
   * 里嵌套调用 `setOutput` —— 这是 React 反模式。
   *
   * React 18 的 Strict Mode 在开发模式下会把 setState 的 updater 函数
   * **调用两次**,用来检测它是不是纯函数。updater 本身被双调没事(React
   * 只 commit 最后一次返回值),但嵌套在 updater 内部的 `setOutput` 副作用
   * 也会被执行两次。每次 `setOutput((cur) => cur + delta)` 都把 delta 又
   * append 一次,结果就是每个流式 chunk 被插入了两份 ——
   * 用户看到的就是「我能我能感受到感受到」这种结巴效果。
   *
   * 现在 `output` 直接由 thinking + text 通过 useMemo 派生,只有一处真理
   * 来源,从源头杜绝了这个同步问题。
   */
  const output = useMemo(() => {
    if (thinking && text) return thinking + '\n\n' + text;
    return thinking || text;
  }, [thinking, text]);

  const run = useCallback(async (opts: {
    systemPrompt?: string;
    userPrompt: string;
    temperature?: number;
    onDone?: (text: string) => void;
  }) => {
    if (!ai.isConfigured) {
      setError('未配置 API Key。请点击右上角 ⚙ 配置。');
      return;
    }
    setStreaming(true);
    setThinking('');
    setText('');
    setError(null);
    abortedRef.current = false;
    try {
      const result = await chatParts(
        {
          messages: [{ role: 'user', content: opts.userPrompt }],
          systemPrompt: opts.systemPrompt,
          temperature: opts.temperature ?? 0.7,
        },
        (delta, kind) => {
          if (abortedRef.current) return;
          // 纯 append,无嵌套副作用 —— strict mode 双调 updater 也安全。
          if (kind === 'thinking') {
            setThinking((prev) => prev + delta);
          } else {
            setText((prev) => prev + delta);
          }
        }
      );
      // 结束时把 thinking/text 对齐到 chatParts 返回的「权威」结果。
      // 流式过程中可能丢极少数 chunk,这里做一次最终校正。
      if (!abortedRef.current) {
        setThinking(result.thinking || '');
        setText(result.text || '');
        opts.onDone?.(result.text);
      }
    } catch (e: any) {
      setError(e.message || '调用失败');
    } finally {
      setStreaming(false);
    }
  }, [ai.isConfigured]);

  const stop = useCallback(() => { abortedRef.current = true; setStreaming(false); }, []);

  const reset = useCallback(() => {
    setText('');
    setThinking('');
    setError(null);
  }, []);

  return {
    streaming,
    output,    // legacy: thinking + '\n\n' + text(派生)
    thinking,  // live stream of just the thinking block
    text,      // live stream of just the final answer
    error,
    run,
    stop,
    reset,
    isConfigured: ai.isConfigured,
  };
}
