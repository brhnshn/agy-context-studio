import { useState } from 'react';
import type { ContextSnapshot, LanguageCode } from '../../core/types.js';
import type { TranslationDict } from '../i18n/en.js';
import { copyText, sendAgentMessage } from '../services/sidecarBridge.js';
import {
  buildCompactCheckpointPrompt,
  buildMarkdownReport,
  buildSmartHandoffPrompt
} from '../utils/format.js';
import { CheckIcon, CopyIcon, SendIcon } from '../utils/icons.js';

interface ActionsBarProps {
  t: TranslationDict;
  language: LanguageCode;
  snapshot: ContextSnapshot | null;
}

export function ActionsBar({ t, language, snapshot }: ActionsBarProps) {
  const [feedback, setFeedback] = useState<string | null>(null);

  const notify = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 2600);
  };

  const handleAgentPrompt = async (prompt: string) => {
    const result = await sendAgentMessage(prompt);
    if (result.ok) {
      notify(result.mode === 'sidecar' ? t.actions.sentToAgent : t.actions.copiedFallback);
    }
  };

  const handleCopyReport = async () => {
    if (!snapshot) {
      return;
    }
    const ok = await copyText(buildMarkdownReport(snapshot, language));
    if (ok) {
      notify(t.actions.reportCopied);
    }
  };

  return (
    <section className="cs-quickbar" aria-label={t.actions.title}>
      <div className="cs-quickbar-actions">
        <button
          type="button"
          className="cs-btn cs-btn-compact cs-btn-primary"
          onClick={() => void handleAgentPrompt(buildSmartHandoffPrompt(language))}
        >
          <SendIcon />
          {t.actions.smartHandoff}
        </button>
        <button
          type="button"
          className="cs-btn cs-btn-compact"
          onClick={() => void handleAgentPrompt(buildCompactCheckpointPrompt(language))}
        >
          <SendIcon />
          {t.actions.compactCheckpoint}
        </button>
        <button
          type="button"
          className="cs-btn cs-btn-compact"
          disabled={!snapshot}
          onClick={() => void handleCopyReport()}
        >
          <CopyIcon />
          {t.actions.copyReport}
        </button>
      </div>
      {feedback && (
        <span className="cs-feedback">
          <CheckIcon />
          {feedback}
        </span>
      )}
    </section>
  );
}
