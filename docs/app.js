const COPY = {
  en: {
    'nav.preview': 'Preview',
    'nav.features': 'Features',
    'nav.install': 'Install',
    'hero.eyebrow': 'Google Antigravity Plugin · Zero Token Overhead',
    'hero.title': 'Context visibility for Antigravity sessions.',
    'hero.subtitle':
      'Monitor exact token fill, prompt cache efficiency, top context bloaters, and subagent usage locally without spending a single model token.',
    'hero.ctaGithub': 'View on GitHub',
    'hero.ctaInstall': 'Quick Install',
    'showcase.tabEn': 'Overview (EN)',
    'showcase.tabTr': 'Overview (TR)',
    'showcase.tabHistory': '7-Day History',
    'showcase.tabSettings': 'Settings',
    'showcase.captionEn':
      'Dual-segment context fill meter, prompt cache efficiency, proportional breakdown (~estimate), and deduplicated top bloaters.',
    'showcase.captionTr':
      'Full Turkish localization across header controls, context meter, category pills, and tool call summaries.',
    'showcase.captionHistory':
      'Local 7-day token volume and prompt cache hit savings aggregated across Antigravity sessions.',
    'showcase.captionSettings':
      'Configurable PostInvocation warning thresholds, EN/TR switcher, real detected model limits, and opt-in MCP App guide.',
    'features.title': 'Three modular layers, zero background cost.',
    'features.subtitle':
      'Built directly on top of local transcript.jsonl logs with zero external runtime dependencies.',
    'features.f1Tag': 'Default ON · 0 Tokens',
    'features.f1Title': 'Live Sidecar Web UI',
    'features.f1Desc':
      'Incremental byte-offset reader streaming exact context fill, prompt cache hit rates, subagent summaries, and 7-day history over SSE.',
    'features.f2Tag': 'Toggleable · 0 Model Tokens',
    'features.f2Title': 'PostInvocation Hook',
    'features.f2Desc':
      'Checks configurable 70% warning and 85% critical thresholds after each turn and emits user-only markdown cards with empty systemMessage.',
    'features.f3Tag': 'Sidecar + Opt-in MCP',
    'features.f3Title': 'Interactive Context Manager',
    'features.f3Desc':
      'Top toolbar triggers Smart Handoff, Compact Checkpoint, and Markdown Report export. Optional MCP App stays off by default.',
    'specs.s1': 'Monitoring token overhead',
    'specs.s2': 'Local-first disk ingestion',
    'specs.s3': 'Built-in UI & hook alerts',
    'specs.s4': 'Zero runtime dependencies',
    'install.title': 'Quick Install',
    'install.subtitle':
      'Requires Node.js 22+. Links cleanly into ~/.gemini/config/plugins/agy-context-studio.',
    'install.copy': 'Copy',
    'install.copied': 'Copied'
  },
  tr: {
    'nav.preview': 'Önizleme',
    'nav.features': 'Özellikler',
    'nav.install': 'Kurulum',
    'hero.eyebrow': 'Google Antigravity Eklentisi · Sıfır Token Maliyeti',
    'hero.title': 'Antigravity oturumları için bağlam görünürlüğü.',
    'hero.subtitle':
      'Gerçek token doluluğunu, Prompt Cache verimliliğini, bağlamı şişiren adımları ve alt ajan kullanımını tek bir model tokenı harcamadan yerelde izleyin.',
    'hero.ctaGithub': 'GitHub’da İncele',
    'hero.ctaInstall': 'Hızlı Kurulum',
    'showcase.tabEn': 'Genel Bakış (EN)',
    'showcase.tabTr': 'Genel Bakış (TR)',
    'showcase.tabHistory': '7 Günlük Geçmiş',
    'showcase.tabSettings': 'Ayarlar',
    'showcase.captionEn':
      'Çift segmentli bağlam doluluk sayacı, önbellek isabet oranı, oransal dağılım (~tahmini) ve tekilleştirilmiş araç özetleri.',
    'showcase.captionTr':
      'Üst çubuk, bağlam sayacı, kategori filtre hapları ve araç çağrısı özetlerinde tam Türkçe yerelleştirme.',
    'showcase.captionHistory':
      'Yerel Antigravity oturumlarından derlenen 7 günlük token hacmi ve önbellek tasarruf özeti.',
    'showcase.captionSettings':
      'Ayarlanabilir PostInvocation eşikleri, EN/TR dil seçici, oturumlardan algılanan gerçek model limitleri ve isteğe bağlı MCP App rehberi.',
    'features.title': 'Üç modüler katman, sıfır arka plan maliyeti.',
    'features.subtitle':
      'Harici çalışma zamanı bağımlılığı olmadan doğrudan yerel transcript.jsonl kayıtları üzerinde çalışır.',
    'features.f1Tag': 'Varsayılan AÇIK · 0 Token',
    'features.f1Title': 'Canlı Sidecar Web Arayüzü',
    'features.f1Desc':
      'Bayt konumuna göre artımlı okuma ile gerçek doluluğu, önbellek isabetini, alt ajan özetlerini ve 7 günlük geçmişi SSE ile aktarır.',
    'features.f2Tag': 'Aç / Kapa · 0 Model Token',
    'features.f2Title': 'PostInvocation Kancası',
    'features.f2Desc':
      'Her tur sonrası %70 uyarı ve %85 kritik eşikleri denetler; boş systemMessage ile model bağlamına sıfır yük ekleyerek kullanıcıya kart gösterir.',
    'features.f3Tag': 'Sidecar + İsteğe Bağlı MCP',
    'features.f3Title': 'Etkileşimli Bağlam Yöneticisi',
    'features.f3Desc':
      'Üst araç çubuğu Akıllı Devir, Özet/Sıkıştır ve Markdown Raporu başlatır. İsteğe bağlı MCP App varsayılan olarak kapalıdır.',
    'specs.s1': 'İzleme token maliyeti',
    'specs.s2': 'Yerel öncelikli disk okuma',
    'specs.s3': 'Dahili arayüz ve uyarılar',
    'specs.s4': 'Sıfır harici bağımlılık',
    'install.title': 'Hızlı Kurulum',
    'install.subtitle':
      'Node.js 22+ gerektirir. ~/.gemini/config/plugins/agy-context-studio dizinine temizce bağlanır.',
    'install.copy': 'Kopyala',
    'install.copied': 'Kopyalandı'
  }
};

const SHOT_CAPTION_KEYS = {
  'overview-en': 'showcase.captionEn',
  'overview-tr': 'showcase.captionTr',
  history: 'showcase.captionHistory',
  settings: 'showcase.captionSettings'
};

let currentLang = 'en';
let currentShot = 'overview-en';

function applyTranslations() {
  const dict = COPY[currentLang];
  document.documentElement.lang = currentLang;

  for (const el of document.querySelectorAll('[data-i18n]')) {
    const key = el.getAttribute('data-i18n');
    if (key && dict[key]) {
      el.textContent = dict[key];
    }
  }

  const captionEl = document.getElementById('showcase-caption');
  const captionKey = SHOT_CAPTION_KEYS[currentShot];
  if (captionEl && captionKey && dict[captionKey]) {
    captionEl.textContent = dict[captionKey];
  }
}

function setLanguage(lang) {
  currentLang = lang === 'tr' ? 'tr' : 'en';
  for (const btn of document.querySelectorAll('.lang-btn')) {
    btn.classList.toggle('is-active', btn.getAttribute('data-lang') === currentLang);
  }
  applyTranslations();
}

function setShot(shot) {
  currentShot = shot;
  const img = document.getElementById('showcase-img');
  if (img) {
    img.setAttribute('src', `./screenshots/${shot}.png`);
  }
  for (const tab of document.querySelectorAll('.shot-tab')) {
    tab.classList.toggle('is-active', tab.getAttribute('data-shot') === shot);
  }
  applyTranslations();
}

for (const btn of document.querySelectorAll('.lang-btn')) {
  btn.addEventListener('click', () => {
    setLanguage(btn.getAttribute('data-lang') || 'en');
  });
}

for (const tab of document.querySelectorAll('.shot-tab')) {
  tab.addEventListener('click', () => {
    setShot(tab.getAttribute('data-shot') || 'overview-en');
  });
}

const copyBtn = document.getElementById('copy-install');
const installCmd = document.getElementById('install-cmd');
if (copyBtn && installCmd) {
  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(installCmd.textContent || '');
      copyBtn.textContent = COPY[currentLang]['install.copied'];
      setTimeout(() => {
        copyBtn.textContent = COPY[currentLang]['install.copy'];
      }, 2000);
    } catch {
      // Ignore clipboard permission denials
    }
  });
}

applyTranslations();
