import { useEffect, useState } from 'react';
import { aiStore, type KeyConfig, type Provider, chat, testConnection, type ChatRequest } from '../lib/ai';

export function useAI() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const unsub = aiStore.subscribe(() => setTick((n) => n + 1));
    return () => { unsub(); };
  }, []);

  const isConfigured = !!aiStore.getActiveKey();
  const activeProvider = aiStore.getActiveKey()?.provider || null;
  const keys = aiStore.getKeys();

  return {
    isConfigured,
    activeProvider,
    keys,
    setKey: (provider: Provider, cfg: Omit<KeyConfig, 'provider'>) => aiStore.setKey(provider, cfg),
    removeKey: (provider: Provider) => aiStore.removeKey(provider),
    setActiveProvider: (p: Provider) => aiStore.setActiveProvider(p),
    chat: (req: ChatRequest, opts?: { onDelta?: (text: string) => void }) => chat(req, opts),
    testConnection,
  };
}
