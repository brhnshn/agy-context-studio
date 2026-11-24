const COPY = {
  en: {
    'nav.preview': 'Preview',
    'nav.capabilities': 'Capabilities',
    'nav.install': 'Install',
    'hero.title': 'See every token before your context fills.',
    'hero.copy':
      'A local context window monitor, prompt cache inspector, and threshold alert plugin for Google Antigravity with zero token overhead.',
    'hero.cta': 'Install for Antigravity',
    'showcase.tabEn': 'Overview (EN)',
    'showcase.tabTr': 'Overview (TR)',
    'showcase.tabHistory': '7-Day History',
    'showcase.tabSettings': 'Settings',
    'showcase.captionEn':
      'Dual-segment context meter showing cached vs. uncached tokens, prompt cache hit rate, proportional breakdown, and deduplicated tool summaries.',
    'showcase.captionTr':
      'Full Turkish localization across header controls, context meter, category filters, and tool call summaries.',
    'showcase.captionHistory':
      'Local 7-day token volume and prompt cache savings aggregated directly from Antigravity sessions.',
    'showcase.captionSettings':
      'Configurable warning thresholds, language switcher, real detected model limits, and opt-in MCP App guide.',
    'cap.title': 'Built to observe without consuming context.',
    'cap.intro':
      "Every metric is read incrementally from Antigravity's local transcript logs on disk. No external network calls, no background prompts, and no runtime dependencies.",
    'cap.r1Title': 'Live sidecar monitor',
    'cap.r1Desc':
      'Watches transcript.jsonl by byte offset and streams exact token fill, prompt cache efficiency, subagent summaries, and 7-day history over SSE.',
    'cap.r2Title': 'Silent threshold alerts',
    'cap.r2Desc':
      'A toggleable PostInvocation hook checks configurable warning and critical thresholds after each turn and shows a user-only markdown notice with an empty system message.',
    'cap.r3Title': 'One-click handoff and opt-in MCP',
    'cap.r3Desc':
      'Trigger Smart Handoff, Compact Checkpoint, or Markdown Report export directly from the top toolbar. An optional MCP App module remains disabled by default.',
    'install.title': 'Install in under a minute.',
    'install.desc':
      'Requires Node.js 22 or newer. The link script connects the built plugin into your Antigravity plugins folder without modifying global config.json.',
    'install.terminalLabel': 'Terminal',
    'install.copy': 'Copy commands',
    'install.copied': 'Copied'
  },
  tr: {
    'nav.preview': 'Önizleme',
    'nav.capabilities': 'Özellikler',
    'nav.install': 'Kurulum',
    'hero.title': 'Bağlam dolmadan her tokenı görün.',
    'hero.copy':
      'Google Antigravity için sıfır token maliyetli yerel bağlam izleyicisi, önbellek analizi ve eşik uyarı eklentisi.',
    'hero.cta': 'Antigravity için Kur',
    'showcase.tabEn': 'Genel Bakış (EN)',
    'showcase.tabTr': 'Genel Bakış (TR)',
    'showcase.tabHistory': '7 Günlük Geçmiş',
    'showcase.tabSettings': 'Ayarlar',
    'showcase.captionEn':
      'Önbellek ve yeni token ayrımını gösteren çift segmentli sayaç, önbellek isabet oranı, oransal dağılım ve tekilleştirilmiş araç özetleri.',
    'showcase.captionTr':
      'Üst çubuk, bağlam sayacı, kategori filtreleri ve araç çağrısı özetlerinde tam Türkçe yerelleştirme.',
    'showcase.captionHistory':
      'Yerel Antigravity oturumlarından derlenen 7 günlük token hacmi ve önbellek tasarruf özeti.',
    'showcase.captionSettings':
      'Ayarlanabilir uyarı eşikleri, dil anahtarı, oturumlardan algılanan gerçek model limitleri ve isteğe bağlı MCP App rehberi.',
    'cap.title': 'Bağlam tüketmeden izlemek için tasarlandı.',
    'cap.intro':
      'Tüm metrikler Antigravity yerel oturum kayıtlarından artımlı okunur. Dış ağ çağrısı, arka plan istemi ve harici bağımlılık yoktur.',
    'cap.r1Title': 'Canlı sidecar izleyicisi',
    'cap.r1Desc':
      'transcript.jsonl dosyasını bayt konumuna göre izler; gerçek token doluluğunu, önbellek verimliliğini, alt ajanları ve 7 günlük geçmişi SSE ile aktarır.',
    'cap.r2Title': 'Sessiz eşik uyarıları',
    'cap.r2Desc':
      'Açılıp kapatılabilen PostInvocation kancası her tur sonrası uyarı ve kritik eşikleri denetler; boş sistem mesajıyla yalnızca kullanıcıya kart gösterir.',
    'cap.r3Title': 'Tek tık devir ve isteğe bağlı MCP',
    'cap.r3Desc':
      'Üst araç çubuğundan Akıllı Devir, Özet / Sıkıştır veya Markdown Raporu başlatın. İsteğe bağlı MCP App modülü varsayılan olarak kapalı kalır.',
    'install.title': 'Bir dakikadan kısa sürede kurun.',
    'install.desc':
      'Node.js 22 veya üzeri gerektirir. Bağlama betiği derlenmiş eklentiyi genel config.json dosyasına dokunmadan Antigravity eklenti klasörüne ekler.',
    'install.terminalLabel': 'Terminal',
    'install.copy': 'Komutları kopyala',
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
  for (const btn of document.querySelectorAll('.lang-option')) {
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
  for (const tab of document.querySelectorAll('.seg-tab')) {
    const active = tab.getAttribute('data-shot') === shot;
    tab.classList.toggle('is-active', active);
    tab.setAttribute('aria-selected', String(active));
  }
  applyTranslations();
}

for (const btn of document.querySelectorAll('.lang-option')) {
  btn.addEventListener('click', () => {
    setLanguage(btn.getAttribute('data-lang') || 'en');
  });
}

for (const tab of document.querySelectorAll('.seg-tab')) {
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

const headerEl = document.getElementById('site-header');
if (headerEl) {
  const onScroll = () => {
    headerEl.classList.toggle('is-scrolled', window.scrollY > 12);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

applyTranslations();
