// story-ui.js — Interface Story Map (rail lateral non bloquant)
//
// La carte reste lisible : aucun overlay plein ecran. L'interface tient
// dans un rail lateral retractable (320 px) et un caption flottant bas.

import { getStoryMap } from './story-chapters.js';
import { resolveIndicators, formatValue } from './story-metrics.js';
import { StoryMinimap } from './story-minimap.js';

export class StoryUI {
  constructor(storyEngine, indicatorEngine, stats, features, chain = null) {
    this.engine = storyEngine;
    this.indicators = indicatorEngine;
    this.stats = stats;
    this.features = features || [];
    this.chain = chain;
    this.container = null;
    this.rail = null;
    this.active = false;
    this.collapsed = false;
    this.tab = 'recit';
    this.timelineValue = null;
    this.minimap = null;
    this._lastMetrics = [];
    this.reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches || false;
  }

  init(map) {
    this.map = map;
    this.createUI();
    this.engine.onChapterChange = (index, chapter) => this.onChapterChange(index, chapter);
    this.engine.onCueChange = (cue, cueIndex) => this.onCueChange(cue, cueIndex);
    this.engine.onComplete = () => this.onComplete();
    this.engine.onFreeLook = (free) => this.onFreeLook(free);
    this.engine.onMetricsChange = (payload) => this.onMetricsChange(payload);
    this.engine.onInteractive = (chapter) => this.onInteractive(chapter);
    if (this.chain) {
      this.chain.init({
        chainHost: document.getElementById('story-panel-chaine'),
        diagnosticHost: document.getElementById('story-panel-diagnostic')
      });
    }
  }

  // ---------------------------------------------------------------- construction

  createUI() {
    const overlay = document.createElement('div');
    overlay.id = 'story-overlay';
    overlay.className = 'story-overlay';
    overlay.style.display = 'none';

    // --- Rail lateral ---
    const rail = document.createElement('div');
    rail.id = 'story-rail';
    rail.className = 'story-rail';
    rail.innerHTML = [
      '<div class="story-rail-top">',
      '  <button class="story-rail-toggle" id="story-collapse" title="Reduire le panneau">&laquo;</button>',
      '  <div class="story-brand">PRODER Taza</div>',
      '  <button class="story-rail-close" id="story-close" title="Quitter le mode Story">&times;</button>',
      '</div>',
      '<div class="story-map-select" id="story-map-select">',
      '  <button class="story-map-btn active" data-story="plantations">Plantations</button>',
      '  <button class="story-map-btn" data-story="apiculture">Apiculture</button>',
      '</div>',
      '<div class="story-tabs" id="story-tabs">',
      '  <button class="story-tab active" data-story-tab="recit">Récit</button>',
      '  <button class="story-tab" data-story-tab="chaine">Chaîne</button>',
      '  <button class="story-tab" data-story-tab="diagnostic">Diagnostic</button>',
      '</div>',
      '<div class="story-chapter-head">',
      '  <div class="story-chapter-num" id="story-chapter-num">1/7</div>',
      '  <div class="story-title" id="story-title"></div>',
      '</div>',
      '<div class="story-body">',
      '  <div class="story-panel" id="story-panel-recit">',
      '    <div class="story-keymessage" id="story-keymessage"></div>',
      '    <div class="story-indicators" id="story-indicators"></div>',
      '    <div class="story-metric-detail" id="story-metric-detail"></div>',
      '    <div class="story-timeline" id="story-timeline-box">',
      '      <label>Annee de plantation</label>',
      '      <input type="range" id="story-timeline" min="2021" max="2025" step="1" value="2021">',
      '      <span id="story-timeline-val">2021</span>',
      '    </div>',
      '  </div>',
      '  <div class="story-panel" id="story-panel-chaine" style="display:none;"></div>',
      '  <div class="story-panel" id="story-panel-diagnostic" style="display:none;"></div>',
      '</div>',
      '<div class="story-interactive-hint" id="story-interactive-hint" style="display:none;">',
      '  Chapitre interactif : cliquez un maillon, puis passez au chapitre suivant.',
      '</div>',
      '<div class="story-controls">',
      '  <button class="story-btn" id="story-prev" title="Chapitre precedent">&#9664;</button>',
      '  <button class="story-btn story-btn-play" id="story-play" title="Lire / Pause">&#9654;</button>',
      '  <button class="story-btn" id="story-pause" title="Pause">&#10073;&#10073;</button>',
      '  <button class="story-btn" id="story-next" title="Chapitre suivant">&#9654;</button>',
      '  <button class="story-btn" id="story-recenter" title="Recentrer la camera">&#9678;</button>',
      '</div>',
      '<div class="story-progress" id="story-progress"></div>',
      '<div class="story-audio">',
      '  <label><input type="checkbox" id="story-audio-toggle" checked> Audio</label>',
      '  <input type="range" id="story-speed" min="0.5" max="2" step="0.1" value="1" title="Vitesse">',
      '  <span id="story-speed-val">1.0x</span>',
      '</div>',
      '<div class="story-freelook" id="story-freelook" style="display:none;">',
      '  Mode libre &#128275; la narration continue',
      '  <button class="story-mini-btn" id="story-recenter-2">Recentrer</button>',
      '</div>'
    ].join('');
    overlay.appendChild(rail);
    this.rail = rail;

    // --- Caption flottant (phrase active) ---
    const caption = document.createElement('div');
    caption.id = 'story-caption';
    caption.className = 'story-caption';
    caption.innerHTML = '<span class="story-caption-icon">&#128266;</span><span id="story-caption-text"></span>';
    overlay.appendChild(caption);
    this.caption = caption;

    // --- Mini-carte ---
    const minimap = document.createElement('div');
    minimap.id = 'story-minimap';
    minimap.className = 'story-minimap';
    minimap.innerHTML = '<div class="story-minimap-label">Vue d\'ensemble</div><div id="story-minimap-canvas"></div>';
    overlay.appendChild(minimap);
    this.minimapEl = minimap;

    // --- Bouton flottant d'entree ---
    const toggleBtn = document.createElement('button');
    toggleBtn.id = 'btn-story-mode';
    toggleBtn.className = 'btn-floating story-toggle';
    toggleBtn.textContent = 'Story';
    toggleBtn.title = 'Mode Story Map';
    toggleBtn.addEventListener('click', () => this.toggle());
    document.body.appendChild(toggleBtn);

    document.body.appendChild(overlay);
    this.container = overlay;

    this._bind();
  }

  _bind() {
    document.getElementById('story-close').addEventListener('click', () => this.close());
    document.getElementById('story-collapse').addEventListener('click', () => this.toggleRail());
    document.querySelectorAll('.story-tab').forEach(btn => {
      btn.addEventListener('click', () => this.switchTab(btn.dataset.storyTab));
    });
    document.getElementById('story-prev').addEventListener('click', () => this.engine.prev());
    document.getElementById('story-next').addEventListener('click', () => this.engine.next());
    document.getElementById('story-play').addEventListener('click', () => this.engine.play());
    document.getElementById('story-pause').addEventListener('click', () => this.engine.pause());
    document.getElementById('story-recenter').addEventListener('click', () => this.engine.recenter());
    document.getElementById('story-recenter-2').addEventListener('click', () => this.engine.recenter());

    const speed = document.getElementById('story-speed');
    speed.addEventListener('input', (e) => {
      this.engine.setSpeed(parseFloat(e.target.value));
      document.getElementById('story-speed-val').textContent = parseFloat(e.target.value).toFixed(1) + 'x';
    });

    const audio = document.getElementById('story-audio-toggle');
    audio.addEventListener('change', (e) => this.engine.setAudioEnabled(e.target.checked));

    const timeline = document.getElementById('story-timeline');
    timeline.addEventListener('input', (e) => {
      const year = parseInt(e.target.value);
      this.timelineValue = year;
      document.getElementById('story-timeline-val').textContent = year;
      this.engine.anim.applyFilter('plantations-circle', ['<=', ['get', '_annee'], year]);
    });

    document.querySelectorAll('.story-map-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.story-map-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.switchTab('recit');
        this.chain?.setMode(btn.dataset.story === 'apiculture' ? 'apiculture' : 'plantations');
        this.engine.loadStory(getStoryMap(btn.dataset.story));
        this.engine.play();
      });
    });

    // Navigation clavier
    this._keyHandler = (e) => {
      if (!this.active) return;
      if (e.target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === ' ') { e.preventDefault(); this.engine.playing ? this.engine.pause() : this.engine.play(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); this.engine.next(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); this.engine.prev(); }
      else if (e.key === 'Escape') { this.close(); }
      else if (e.key === 'r' || e.key === 'R') { this.engine.recenter(); }
      else if (/^[1-9]$/.test(e.key)) { this.engine.goTo(parseInt(e.key) - 1); }
    };
    window.addEventListener('keydown', this._keyHandler);
  }

  // ---------------------------------------------------------------- onglets

  switchTab(name) {
    if (!['recit', 'chaine', 'diagnostic'].includes(name)) return;
    this.tab = name;
    document.querySelectorAll('.story-tab').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.storyTab === name);
    });
    for (const tab of ['recit', 'chaine', 'diagnostic']) {
      const panel = document.getElementById('story-panel-' + tab);
      if (panel) panel.style.display = tab === name ? 'block' : 'none';
    }
    const head = document.querySelector('.story-chapter-head');
    if (head) head.style.display = name === 'recit' ? 'block' : 'none';

    if (name !== 'diagnostic') this.chain?.setDiagnosticVisible(false);
    if (name === 'chaine') this.chain?.refresh();
    if (name === 'diagnostic' && this.chain) {
      if (this.chain.model?.hasResults) this.chain.setDiagnosticVisible(true);
      else this.chain.runDiagnostic();
    }
    if (this.map) setTimeout(() => this.map.resize(), 60);
  }

  // ---------------------------------------------------------------- affichage

  open() {
    this.active = true;
    this.container.style.display = 'block';
    this.setRailVisible(false);
    const hint = document.getElementById('story-interactive-hint');
    if (hint) hint.style.display = 'none';
    this.switchTab('recit');
    this._initMinimap();
    if (this.map) this.map.resize();
  }

  close() {
    this.active = false;
    this.chain?.setDiagnosticVisible(false);
    this.engine.stop();
    this.container.style.display = 'none';
    const cp = document.getElementById('control-panel');
    if (cp) cp.style.removeProperty('display');
    const sb = document.getElementById('btn-show-dashboard');
    if (sb) sb.style.removeProperty('display');
    const bs = document.getElementById('btn-story-mode');
    if (bs) bs.style.display = 'flex';
    if (this.map) this.map.resize();
  }

  toggle() {
    if (this.active) this.close();
    else this.open();
  }

  setRailVisible(visible) {
    const cp = document.getElementById('control-panel');
    if (cp) {
      if (visible) cp.style.removeProperty('display');
      else cp.style.setProperty('display', 'none');
    }
    const db = document.getElementById('dashboard');
    if (db) {
      if (visible) db.style.removeProperty('display');
      else db.style.setProperty('display', 'none');
    }
    const sb = document.getElementById('btn-show-dashboard');
    if (sb) {
      if (visible) sb.style.removeProperty('display');
      else sb.style.setProperty('display', 'none');
    }
    const bs = document.getElementById('btn-story-mode');
    if (bs) bs.style.display = visible ? 'flex' : 'none';
  }

  toggleRail() {
    this.collapsed = !this.collapsed;
    this.rail.classList.toggle('collapsed', this.collapsed);
    const btn = document.getElementById('story-collapse');
    if (btn) btn.innerHTML = this.collapsed ? '&raquo;' : '&laquo;';
    if (this.map) setTimeout(() => this.map.resize(), 260);
  }

  onChapterChange(index, chapter) {
    this.switchTab('recit');
    document.getElementById('story-metric-detail')?.classList.remove('visible');
    const hint = document.getElementById('story-interactive-hint');
    if (hint) hint.style.display = 'none';
    const num = document.getElementById('story-chapter-num');
    const title = document.getElementById('story-title');
    if (num) num.textContent = (index + 1) + '/' + this.engine.currentStory.chapters.length;
    if (title) title.textContent = chapter.title;

    // Message cle du chapitre
    const msg = document.getElementById('story-keymessage');
    if (msg) {
      msg.textContent = chapter.message || '';
      msg.style.display = chapter.message ? 'block' : 'none';
    }

    // Indicateurs du chapitre
    this._renderIndicators(chapter.indicators || []);

    // Timeline : bornes issues des donnees
    this._syncTimeline();

    // Progression
    const progress = document.getElementById('story-progress');
    if (progress) {
      const total = this.engine.currentStory.chapters.length;
      progress.innerHTML = Array.from({ length: total }, (_, i) => {
        const cls = i < index ? 'done' : i === index ? 'active' : '';
        return '<button class="story-progress-dot ' + cls + '" data-index="' + i + '" title="Chapitre ' + (i + 1) + '"></button>';
      }).join('');
      progress.querySelectorAll('.story-progress-dot').forEach(dot => {
        dot.addEventListener('click', () => this.engine.goTo(parseInt(dot.dataset.index)));
      });
    }
  }

  onCueChange(cue, cueIndex) {
    const text = document.getElementById('story-caption-text');
    if (text) text.textContent = cue.text || '';
    this.caption.classList.remove('pulse');
    void this.caption.offsetWidth;
    this.caption.classList.add('pulse');
    this._updateCueDots(cueIndex);
  }

  _updateCueDots(cueIndex) {
    const box = document.getElementById('story-cue-dots');
    if (!box) return;
    const cues = this.engine.getCurrentChapter()?.cues || [];
    box.innerHTML = cues.map((_, i) =>
      '<span class="story-cue-dot ' + (i < cueIndex ? 'done' : i === cueIndex ? 'active' : '') + '"></span>'
    ).join('');
  }

  _renderIndicators(descriptors) {
    const container = document.getElementById('story-indicators');
    if (!container) return;
    const context = {
      indicators: this.indicators?.getAllIndicators?.() || {},
      stats: this.stats
    };
    const resolved = resolveIndicators(descriptors, context);
    this._lastMetrics = resolved;
    container.innerHTML = resolved.map((m, index) =>
      '<div class="story-metric" data-index="' + index + '" tabindex="0" role="button" title="' + this._tooltip(m) + '">' +
      '  <div class="story-metric-value"><span class="metric-number">' + m.value + '</span>' +
      '    <span class="story-metric-unit">' + m.unit + '</span></div>' +
      '  <div class="story-metric-label">' + m.label + '</div>' +
      '  <span class="story-metric-level ' + m.className + '">' +
      (m.level === 1 ? 'Observé' : m.level === 2 ? 'Estimé' : 'À renseigner') + '</span>' +
      '</div>'
    ).join('');

    container.querySelectorAll('.story-metric').forEach(card => {
      const index = parseInt(card.dataset.index, 10);
      card.addEventListener('click', () => this.showMetricDetail(index));
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.showMetricDetail(index); }
      });
    });

    // Compteurs animés : la valeur monte vers son niveau réel.
    container.querySelectorAll('.metric-number').forEach((el, i) => {
      const m = resolved[i];
      if (!m) return;
      if (m.numeric !== null && m.numeric !== undefined && m.format !== 'text') {
        this._animateNumber(el, m.numeric, m.format);
      }
    });
  }

  _animateNumber(el, target, format) {
    if (this.reduceMotion || !Number.isFinite(target)) {
      el.textContent = formatValue(target, format);
      return;
    }
    const duration = 700;
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = formatValue(target * eased, format);
      if (t < 1) requestAnimationFrame(tick);
      else el.textContent = formatValue(target, format);
    };
    requestAnimationFrame(tick);
  }

  showMetricDetail(index) {
    const box = document.getElementById('story-metric-detail');
    const m = this._lastMetrics?.[index];
    if (!box || !m) return;
    if (box.dataset.index === String(index) && box.classList.contains('visible')) {
      box.classList.remove('visible');
      return;
    }
    box.dataset.index = String(index);
    box.innerHTML = [
      '<div class="smd-head"><span>' + m.label + '</span>',
      '  <button class="smd-close" id="smd-close" title="Fermer">×</button></div>',
      '<div class="smd-value">' + m.value + ' <small>' + m.unit + '</small></div>',
      '<div class="smd-row"><span>Niveau de preuve</span><strong class="' + m.className + '">' + m.levelLabel + '</strong></div>',
      m.formula ? '<div class="smd-row"><span>Formule</span><code>' + m.formula + '</code></div>' : '',
      m.ref ? '<div class="smd-row"><span>Référence</span><strong>' + m.ref + '</strong></div>' : '',
      '<p class="smd-note">Cliquez à nouveau la carte pour fermer.</p>'
    ].join('');
    box.classList.add('visible');
    document.getElementById('smd-close')?.addEventListener('click', (e) => {
      e.stopPropagation();
      box.classList.remove('visible');
    });
  }

  _tooltip(m) {
    const parts = [m.levelLabel];
    if (m.formula) parts.push('Formule : ' + m.formula);
    if (m.ref) parts.push('Référence : ' + m.ref);
    return parts.join(' | ');
  }

  onMetricsChange(payload) {
    if (payload.type === 'metric' && payload.indicators?.length) {
      this._renderIndicators(payload.indicators);
      if (payload.emphasize) {
        const first = document.querySelector('.story-metric');
        if (first) {
          first.classList.remove('pulse');
          void first.offsetWidth;
          first.classList.add('pulse');
        }
      }
    }
    if (payload.type === 'timeline' && payload.year) {
      const slider = document.getElementById('story-timeline');
      const label = document.getElementById('story-timeline-val');
      if (slider) slider.value = payload.year;
      if (label) label.textContent = payload.year;
    }
  }

  onFreeLook(free) {
    const badge = document.getElementById('story-freelook');
    if (badge) badge.style.display = free ? 'flex' : 'none';
  }

  /** Reflète l'onglet actif pour les tests et l'accessibilité. */
  get activeTab() { return this.tab; }

  onComplete() {
    const text = document.getElementById('story-caption-text');
    if (text) text.textContent = 'Story Map terminée. Cliquez un chapitre pour revoir.';
  }

  /** Chapitre interactif : on cède la main à l'expert. */
  onInteractive(chapter) {
    this.switchTab('chaine');
    const hint = document.getElementById('story-interactive-hint');
    if (hint) hint.style.display = 'flex';
    const mode = chapter.chainMode || (this.engine.currentStory?.id === 'apiculture' ? 'apiculture' : 'both');
    this.chain?.setMode(mode);
    const text = document.getElementById('story-caption-text');
    if (text) {
      text.textContent = chapter.hint ||
        'À vous de jouer : cliquez un maillon de la chaîne pour voir ce qu\'il rend possible.';
    }
  }

  // ---------------------------------------------------------------- mini-carte

  _initMinimap() {
    if (this.minimap || !this.map) return;
    const host = document.getElementById('story-minimap-canvas');
    if (!host) return;
    try {
      this.minimap = new StoryMinimap(this.map, this.features, host);
      this.minimap.init();
    } catch (e) {
      console.warn('Mini-carte indisponible:', e);
    }
  }

  _syncTimeline() {
    const box = document.getElementById('story-timeline-box');
    if (box) box.style.display = this.engine.currentStory?.id === 'plantations' ? 'block' : 'none';
    const slider = document.getElementById('story-timeline');
    if (!slider) return;
    const byYear = this.indicators?.getAllIndicators?.().byYear || [];
    if (byYear.length) {
      const years = byYear.map(y => y.annee);
      slider.min = Math.min(...years);
      slider.max = Math.max(...years);
    }
  }
}
