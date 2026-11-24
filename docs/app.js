const COPY = {
  en: {
    'nav.github': 'GitHub',
    'hero.eyebrow': 'Google Antigravity Plugin · Zero Token Overhead',
    'hero.title':
      'See your exact context fill, prompt cache efficiency, and context bloaters in real time.',
    'hero.subtitle':
      'Local-first, zero-runtime-dependency Node ESM & React Sidecar plugin for Antigravity Desktop, IDE, and CLI.',
    'hero.copy': 'Copy',
    'hero.copied': 'Copied',
    'showcase.title': 'Live Interface Preview',
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
    'options.title': '3 Modular Options',
    'options.opt1Badge': 'Default ON · 0 Tokens',
    'options.opt1Title': '1. Live Sidecar Web UI',
    'options.opt1Desc':
      'Watches transcript.jsonl incrementally by byte offset and streams updates over SSE. Includes exact token fill, prompt cache hits, subagent tracking, and 7-day history.',
    'options.opt2Badge': 'Toggleable · 0 Model Tokens',
    'options.opt2Title': '2. PostInvocation Threshold Hook',
    'options.opt2Desc':
      'Checks configured warning (70%) and critical (85%) thresholds after each turn and emits a user-only markdown card without adding tokens to the model context.',
    'options.opt3Badge': 'Sidecar + Opt-in MCP',
    'options.opt3Title': '3. Interactive Context Manager',
    'options.opt3Desc':
      'Top toolbar Quick Actions trigger Smart Handoff, Compact Checkpoint, and Markdown Report export. Includes an optional opt-in MCP App (disabled by default).',
    'arch.title': 'How It Works (Zero Overhead)'
  },
  tr: {
    'nav.github': 'GitHub',
    'hero.eyebrow': 'Google Antigravity Eklentisi · Sıfır Token Maliyeti',
    'hero.title':
      'Bağlam doluluğunu, önbellek isabetini ve en çok yer kaplayan adımları canlı görün.',
    'hero.subtitle':
      'Antigravity Desktop, IDE ve CLI için yerel çalışan, harici bağımlılıksız Node ESM & React Sidecar eklentisi.',
    'hero.copy': 'Kopyala',
    'hero.copied': 'Kopyalandı',
    'showcase.title': 'Canlı Arayüz Önizlemesi',
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
    'options.title': '3 Modüler Seçenek',
    'options.opt1Badge': 'Varsayılan AÇIK · 0 Token',
    'options.opt1Title': '1. Canlı Sidecar Web Arayüzü',
    'options.opt1Desc':
      'transcript.jsonl dosyasını bayt konumuyla artımlı okur ve SSE ile anlık yayınlar. Gerçek doluluk, önbellek isabeti, alt ajanlar ve 7 günlük geçmişi gösterir.',
    'options.opt2Badge': 'Aç/Kapa · 0 Model Token',
    'options.opt2Title': '2. PostInvocation Eşik Kancası',
    'options.opt2Desc':
      'Her tur sonrası uyarı (%70) ve kritik (%85) eşiklerini denetler; model bağlamına tek bir token eklemeden yalnızca kullanıcıya markdown uyarı kartı gösterir.',
    'options.opt3Badge': 'Sidecar + İsteğe Bağlı MCP',
    'options.opt3Title': '3. Etkileşimli Bağlam Yöneticisi',
    'options.opt3Desc':
      'Üst araç çubuğundan tek tıkla Akıllı Devir, Özet/Sıkıştır ve Markdown Raporu başlatır. İsteğe bağlı MCP App modülü varsayılan olarak kapalıdır.',
    'arch.title': 'Nasıl Çalışır (Sıfır Yük)'
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
      copyBtn.textContent = COPY[currentLang]['hero.copied'];
      setTimeout(() => {
        copyBtn.textContent = COPY[currentLang]['hero.copy'];
      }, 2000);
    } catch {
      // Ignore clipboard permission denials
    }
  });
}

applyTranslations();
