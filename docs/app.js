const COPY = {
  en: {
    'nav.preview': 'Preview',
    'nav.modules': 'Modules',
    'nav.architecture': 'Architecture',
    'hero.eyebrow': 'Open-Source Antigravity Plugin · Zero Token Overhead',
    'hero.titleBright': 'Context visibility',
    'hero.titleMuted': 'engineered for Antigravity sessions.',
    'hero.lead':
      'Track exact token fill, prompt cache efficiency, context bloaters, and subagent usage locally without spending a single model token.',
    'hero.cta': 'Explore on GitHub',
    'hero.copy': 'Copy',
    'hero.copied': 'Copied',
    'kpi.fillLabel': 'Context Fill',
    'kpi.cacheLabel': 'Cache Hit',
    'kpi.overheadLabel': 'Monitor Overhead',
    'kpi.historyLabel': '7-Day Volume',
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
    'arch.titleBright': 'Local-first ingestion',
    'arch.titleMuted': 'with modular output layers.',
    'arch.leftKicker': 'DISK SOURCE',
    'arch.leftSub': 'Byte-offset incremental',
    'arch.rightKicker': 'SURFACES',
    'arch.rightSub': 'Zero background cost',
    'modules.m1Tag': 'OPTION 01 · DEFAULT ON',
    'modules.m1Title': 'Live Sidecar Web UI',
    'modules.m1Desc':
      'Watches transcripts incrementally via fs.watch and streams exact token counts, cache hit rates, subagents, and 7-day history over SSE.',
    'modules.m2Tag': 'OPTION 02 · TOGGLEABLE',
    'modules.m2Title': 'PostInvocation Hook',
    'modules.m2Desc':
      'Evaluates 70% warning and 85% critical thresholds after each turn and emits user-only markdown cards with empty systemMessage.',
    'modules.m3Tag': 'OPTION 03 · 3A + OPT-IN 3B',
    'modules.m3Title': 'Context Manager',
    'modules.m3Desc':
      'Top toolbar triggers Smart Handoff, Compact Checkpoint, and Markdown Report export. Optional MCP App stays off by default.',
    'metrics.u1': 'tok',
    'metrics.l1': 'Background monitoring token overhead',
    'metrics.u2': 'layers',
    'metrics.l2': 'Sidecar UI, PostInvocation hook, opt-in MCP',
    'metrics.u3': 'langs',
    'metrics.l3': 'Built-in English and Turkish UI & alerts',
    'metrics.l4': 'Local-first ingestion with zero network calls'
  },
  tr: {
    'nav.preview': 'Önizleme',
    'nav.modules': 'Modüller',
    'nav.architecture': 'Mimari',
    'hero.eyebrow': 'Açık Kaynak Antigravity Eklentisi · Sıfır Token Maliyeti',
    'hero.titleBright': 'Bağlam görünürlüğü',
    'hero.titleMuted': 'Antigravity oturumları için tasarlandı.',
    'hero.lead':
      'Gerçek token doluluğunu, Prompt Cache verimliliğini, bağlamı şişiren adımları ve alt ajan kullanımını tek bir model tokenı harcamadan yerelde izleyin.',
    'hero.cta': 'GitHub’da İncele',
    'hero.copy': 'Kopyala',
    'hero.copied': 'Kopyalandı',
    'kpi.fillLabel': 'Bağlam Doluluğu',
    'kpi.cacheLabel': 'Önbellek İsabeti',
    'kpi.overheadLabel': 'İzleme Maliyeti',
    'kpi.historyLabel': '7 Günlük Hacim',
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
    'arch.titleBright': 'Yerel öncelikli okuma',
    'arch.titleMuted': 've modüler çıktı katmanları.',
    'arch.leftKicker': 'DİSK KAYNAĞI',
    'arch.leftSub': 'Bayt konumuna göre artımlı',
    'arch.rightKicker': 'ARAYÜZLER',
    'arch.rightSub': 'Sıfır arka plan maliyeti',
    'modules.m1Tag': 'SEÇENEK 01 · VARSAYILAN AÇIK',
    'modules.m1Title': 'Canlı Sidecar Web Arayüzü',
    'modules.m1Desc':
      'transcript.jsonl dosyasını fs.watch ile artımlı izler; gerçek token doluluğunu, önbellek isabetini, alt ajanları ve 7 günlük geçmişi SSE ile aktarır.',
    'modules.m2Tag': 'SEÇENEK 02 · AÇ / KAPA',
    'modules.m2Title': 'PostInvocation Kancası',
    'modules.m2Desc':
      'Her tur sonrası %70 uyarı ve %85 kritik eşikleri denetler; boş systemMessage ile model bağlamına sıfır yük ekleyerek kullanıcıya kart gösterir.',
    'modules.m3Tag': 'SEÇENEK 03 · 3A + İSTEĞE BAĞLI 3B',
    'modules.m3Title': 'Bağlam Yöneticisi',
    'modules.m3Desc':
      'Üst araç çubuğu Akıllı Devir, Özet/Sıkıştır ve Markdown Raporu başlatır. İsteğe bağlı MCP App modülü varsayılan olarak kapalıdır.',
    'metrics.u1': 'tok',
    'metrics.l1': 'Arka plan izleme token maliyeti',
    'metrics.u2': 'katman',
    'metrics.l2': 'Sidecar UI, PostInvocation kancası, isteğe bağlı MCP',
    'metrics.u3': 'dil',
    'metrics.l3': 'Dahili İngilizce ve Türkçe arayüz ve uyarılar',
    'metrics.l4': 'Dış ağ çağrısı olmayan tamamen yerel okuma'
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

// Scroll-reveal for lower telemetry strip and diagram
const revealNodes = document.querySelectorAll('[data-reveal]');
if ('IntersectionObserver' in window && revealNodes.length > 0) {
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      }
    },
    { threshold: 0.12 }
  );
  for (const node of revealNodes) {
    observer.observe(node);
  }
} else {
  for (const node of revealNodes) {
    node.classList.add('is-visible');
  }
}

applyTranslations();
