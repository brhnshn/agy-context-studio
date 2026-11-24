import type { TranslationDict } from './en.js';

export const tr: {
  [K in keyof TranslationDict]: TranslationDict[K] extends string
    ? string
    : {
        [SK in keyof TranslationDict[K]]: TranslationDict[K][SK] extends string
          ? string
          : Record<keyof TranslationDict[K][SK], string>;
      };
} = {
  appTitle: 'Context Studio',
  tabs: {
    overview: 'Genel Bakış',
    subagents: 'Alt Ajanlar',
    history: '7 Günlük Geçmiş',
    settings: 'Ayarlar'
  },
  header: {
    refresh: 'Yenile',
    sessionPlaceholder: 'Son oturum',
    liveConnected: 'Canlı',
    pausedHidden: 'Duraklatıldı'
  },
  meter: {
    title: 'Bağlam Penceresi',
    unknownModel: 'Limit bilinmiyor',
    compactionMarker: 'Sıkıştırma ~',
    turnCacheHit: 'Tur Önbellek İsabeti',
    sessionCacheHit: 'Oturum Önbellek İsabeti',
    outputTokens: 'Çıktı (Tur)',
    velocity: 'Hız',
    compactions: 'Sıkıştırma',
    turns: 'Tur',
    tokensPerTurn: '/tur',
    noSession: 'Henüz aktif bir oturum kaydı bulunamadı.'
  },
  breakdown: {
    title: 'Oransal Dağılım (~tahmini)',
    estimateNote: 'Adım yükü bayt ağırlıklarından oransal olarak tahmin edilir',
    bloatersTitle: 'En Çok Yer Kaplayan Adımlar',
    noSteps: 'Henüz adım verisi kaydedilmedi.',
    categories: {
      user: 'Kullanıcı',
      assistant: 'Asistan',
      thinking: 'Düşünme',
      tools: 'Araçlar',
      system: 'Sistem'
    }
  },
  actions: {
    title: 'Hızlı İşlemler (0 Arka Plan Token)',
    smartHandoff: 'Akıllı Devir',
    compactCheckpoint: 'Özet / Sıkıştır',
    copyReport: 'Markdown Raporu Kopyala',
    sentToAgent: 'İstem aktif ajana gönderildi.',
    copiedFallback: 'Köprü kapalı — istem panoya kopyalandı.',
    reportCopied: 'Markdown raporu panoya kopyalandı.'
  },
  subagents: {
    title: 'Başlatılan Alt Ajanlar',
    empty: 'Bu oturumda alt ajan başlatılmadı.',
    statusActive: 'Aktif',
    statusMissing: 'Bulunamadı',
    turns: 'tur',
    cacheHit: 'önbellek'
  },
  history: {
    title: 'Son 7 Gün',
    sessions: 'Oturum',
    turns: 'Tur',
    totalInput: 'Toplam Girdi',
    cacheSavings: 'Önbellek İsabeti',
    date: 'Tarih',
    loading: '7 günlük geçmiş yükleniyor...',
    empty: 'Seçilen aralıkta kullanım geçmişi yok.'
  },
  settings: {
    title: 'Eklenti Ayarları',
    language: 'Dil',
    hookEnabled: 'PostInvocation Eşik Uyarıları (0 Model Token)',
    warningPct: 'Uyarı Eşiği (%)',
    criticalPct: 'Kritik Eşik (%)',
    save: 'Ayarları Kaydet',
    saved: 'Ayarlar kaydedildi.',
    overridesTitle: 'Model Bağlam Limiti Geçersiz Kılmaları',
    modelPattern: 'Model kimliği veya ön eki',
    contextLimit: 'Bağlam limiti (token)',
    addOverride: 'Ekle',
    remove: 'Sil',
    noOverrides: 'Özel model limiti tanımlanmadı.',
    mcpTitle: 'İsteğe Bağlı MCP App (Katman 3B)',
    mcpDescription:
      'Sıfır token maliyeti için varsayılan olarak kapalıdır. Etkinleştirildiğinde get_context_health aracını (~350 şema token/tur) ve sohbet içi ui:// kartını açar.',
    copyMcpConfig: 'mcp_config.json örneğini kopyala',
    mcpCopied: 'MCP yapılandırma örneği kopyalandı.'
  }
};
