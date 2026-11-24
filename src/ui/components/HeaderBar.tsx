import type { LanguageCode } from '../../core/types.js';
import type { TranslationDict } from '../i18n/en.js';
import type { ConversationListItem } from '../services/apiClient.js';
import { BrandLogoIcon, RefreshIcon } from '../utils/icons.js';

interface HeaderBarProps {
  t: TranslationDict;
  language: LanguageCode;
  conversations: ConversationListItem[];
  selectedConversationId: string;
  connected: boolean;
  isHidden: boolean;
  onSelectConversation: (conversationId: string) => void;
  onSetLanguage: (language: LanguageCode) => void;
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
  onSetLanguage,
  onRefresh
}: HeaderBarProps) {
  return (
    <header className="cs-header">
      <div className="cs-brand">
        <BrandLogoIcon className="cs-brand-icon" />
        <span className="cs-brand-title">{t.appTitle}</span>
        <span className={`cs-status-pill ${connected && !isHidden ? 'is-live' : ''}`}>
          <span className="cs-status-dot" />
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
        <div className="cs-lang-switch" role="group" aria-label={t.settings.language}>
          <button
            type="button"
            className={`cs-lang-btn ${language === 'en' ? 'is-active' : ''}`}
            onClick={() => onSetLanguage('en')}
          >
            EN
          </button>
          <button
            type="button"
            className={`cs-lang-btn ${language === 'tr' ? 'is-active' : ''}`}
            onClick={() => onSetLanguage('tr')}
          >
            TR
          </button>
        </div>
        <button
          type="button"
          className="cs-btn cs-btn-icon"
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
