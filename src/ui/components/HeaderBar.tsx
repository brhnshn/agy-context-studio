import type { LanguageCode } from '../../core/types.js';
import type { TranslationDict } from '../i18n/en.js';
import type { ConversationListItem } from '../services/apiClient.js';
import { RefreshIcon } from '../utils/icons.js';

interface HeaderBarProps {
  t: TranslationDict;
  language: LanguageCode;
  conversations: ConversationListItem[];
  selectedConversationId: string;
  connected: boolean;
  isHidden: boolean;
  onSelectConversation: (conversationId: string) => void;
  onToggleLanguage: () => void;
  onRefresh: () => void;
}

export function HeaderBar({
  t,
  language,
  conversations,
  selectedConversationId,
  connected,
  isHidden,
  onSelectConversation,
  onToggleLanguage,
  onRefresh
}: HeaderBarProps) {
  return (
    <header className="cs-header">
      <div className="cs-brand">
        <span className="cs-brand-title">{t.appTitle}</span>
        <span className={`cs-badge ${connected ? 'cs-badge-ok' : ''}`}>
          {isHidden ? t.header.pausedHidden : t.header.liveConnected}
        </span>
      </div>
      <div className="cs-header-controls">
        {conversations.length > 0 && (
          <select
            className="cs-select cs-select-conv"
            aria-label="Conversation"
            value={selectedConversationId}
            onChange={(e) => onSelectConversation(e.target.value)}
          >
            {conversations.map((item) => (
              <option key={item.conversationId} value={item.conversationId}>
                {item.conversationId.slice(0, 8)}
              </option>
            ))}
          </select>
        )}
        <button
          type="button"
          className="cs-btn"
          onClick={onToggleLanguage}
          title="Toggle language"
        >
          {language.toUpperCase()}
        </button>
        <button
          type="button"
          className="cs-btn"
          onClick={onRefresh}
          title={t.header.refresh}
          aria-label={t.header.refresh}
        >
          <RefreshIcon />
        </button>
      </div>
    </header>
  );
}
