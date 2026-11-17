// story-engine.js — Moteur de Story Map 3D à cues
//
// Principe : un chapitre est une suite de "cues". Chaque cue associe
//   - une phrase prononcee (la voix)
//   - une action visuelle (camera, couches, filtres, popup, indicateur)
// La phrase et l'action demarrent EN MEME TEMPS : la carte suit la voix.
//
// La camera n'est jamais imposee a l'utilisateur : toute interaction
// (glissement, molette, double-clic) libere la camera et bascule en
// "mode libre" ; la narration, elle, continue.

import { resolveIndicators, resolveMetric } from './story-metrics.js';

export class StoryEngine {
  constructor(map, layerManager, animationEngine, indicatorEngine) {
    this.map = map;
    this.layers = layerManager;
    this.anim = animationEngine;
    this.indicators = indicatorEngine;
    this.hotspots = null;

    this.currentStory = null;
    this.currentChapter = 0;
    this.currentCue = 0;
    this.playing = false;
    this.paused = false;
    this.speed = 1;
    this.audioEnabled = true;
    this.userControlled = false;
    this._lastInteraction = 0;

    this.narrator = null;
    this.onChapterChange = null;
    this.onCueChange = null;
    this.onComplete = null;
    this.onFreeLook = null;
    this.onMetricsChange = null;
    this.onInteractive = null;

    this._abort = false;
    this._interactionHandler = null;
    // Jeton d'exécution : invalide les boucles de chapitre encore en vol
    // lorsqu'on change de chapitre ou de story (évite les doubles lectures).
    this._runId = 0;
  }

  setNarrator(narrator) { this.narrator = narrator; }
  setHotspots(hotspots) { this.hotspots = hotspots; }

  // ---------------------------------------------------------------- cycle de vie

  loadStory(story) {
    this.currentStory = story;
    this.currentChapter = 0;
    this.currentCue = 0;
    this.playing = false;
    this.paused = false;
    this.userControlled = false;
    this._abort = true;
    this._runId++;
  }

  async play() {
    if (!this.currentStory) return;
    this._abort = false;
    this._runId++;
    this.playing = true;
    this.paused = false;
    this._bindInteraction();
    await this._runChapter(this.currentChapter, this._runId);
  }

  async _runChapter(index, runId = this._runId) {
    if (runId !== this._runId) return;
    if (this._abort || !this.currentStory) return;
    const chapters = this.currentStory.chapters;
    if (index >= chapters.length) {
      this.playing = false;
      this._unbindInteraction();
      if (this.onComplete) this.onComplete();
      return;
    }
    this.currentChapter = index;
    const chapter = chapters[index];
    this.currentCue = 0;

    if (this.onChapterChange) this.onChapterChange(index, chapter);
    this._applyChapterLayers(chapter);

    for (let c = 0; c < (chapter.cues || []).length; c++) {
      if (runId !== this._runId) return;
      if (this._abort || !this.playing) return;
      if (this.paused) {
        await this._waitWhilePaused();
        if (this._abort || runId !== this._runId) return;
      }
      this.currentCue = c;
      await this._runCue(chapter.cues[c], chapter, c);
      if (runId !== this._runId) return;
    }

    // Chapitre interactif : la narration s'arrête et l'expert prend la main.
    // Le chapitre suivant n'est pas enchaîné automatiquement.
    if (chapter.interactive && this.playing && !this._abort) {
      this.playing = false;
      this.paused = true;
      if (this.onInteractive) this.onInteractive(chapter);
      return;
    }

    if (this.playing && !this._abort && runId === this._runId) {
      await this._runChapter(index + 1, runId);
    }
  }

  async _runCue(cue, chapter, cueIndex) {
    if (this.onCueChange) this.onCueChange(cue, cueIndex, chapter);

    // 1. L'action visuelle part immediatement, en parallele de la voix.
    await this._applyAction(cue.action, chapter);

    // 2. La voix est lancee en parallele ; on attend sa fin (ou la duree estimee).
    const duration = (cue.duration || this._estimateDuration(cue.text)) / this.speed;
    if (this.audioEnabled && this.narrator && cue.text) {
      await this.narrator.speak(cue.text);
    } else {
      await this._wait(duration);
    }
  }

  _estimateDuration(text) {
    if (!text) return 3000;
    // ~14 caracteres/seconde en lecture francaise a vitesse 0.92
    return Math.max(2200, (text.length / 14) * 1000);
  }

  async _applyChapterLayers(chapter) {
    this.layers.hideAll();
    for (const layerId of (chapter.layers || [])) {
      this.layers.show(layerId);
    }
    this.anim.clearFilters?.();
    if (chapter.filters) {
      for (const [layerId, filter] of Object.entries(chapter.filters)) {
        if (filter) this.anim.applyFilter(layerId, filter);
      }
    }
  }

  // ---------------------------------------------------------------- actions

  async _applyAction(action, chapter) {
    if (!action) return;
    const type = action.type;

    switch (type) {
      case 'camera':
        await this._moveCamera(action.target || action);
        break;

      case 'cameraPath':
        await this._cameraPath(action.path || []);
        break;

      case 'show':
        this.layers.show(action.layer);
        if (action.opacity !== undefined) this.anim.setOpacity(action.layer, action.opacity);
        if (action.filter) this.anim.applyFilter(action.layer, action.filter);
        break;

      case 'hide':
        this.layers.hide(action.layer);
        break;

      case 'filter':
        this.anim.applyFilter(action.layer, action.filter);
        break;

      case 'clearFilter':
        this.anim.clearFilters?.();
        break;

      case 'staggered':
        await this.anim.staggeredAppear(action.layer, action.delay || 30, action.duration || 2000);
        break;

      case 'extrude':
        await this.anim.extrude(action.layer, action.heightField, action.factor || 1, action.duration || 2000);
        break;

      case 'drawProgressive':
        await this.anim.drawProgressive(action.layer, action.duration || 3000);
        break;

      case 'drawFlux':
        await this.anim.drawFlux(action.from, action.to, action.color || '#4CAF50', action.duration || 2000, action.label);
        break;

      case 'timeline':
        this._applyTimeline(action);
        break;

      case 'popup':
        this._applyPopup(action, chapter);
        break;

      case 'halo':
        this._applyHalo(action);
        break;

      case 'clearPopup':
        this.hotspots?.closePopup();
        break;

      case 'metric':
        this._applyMetric(action);
        break;

      case 'wait':
        await this._wait((action.duration || 1000) / this.speed);
        break;

      default:
        break;
    }
  }

  _applyTimeline(action) {
    const year = action.year;
    const layerId = action.layer || 'plantations-circle';
    if (year) {
      // Affiche les plantations de l'annee et les precedentes, en attenuees.
      this.anim.applyFilter(layerId, ['<=', ['get', '_annee'], year]);
    } else {
      this.anim.clearFilters?.();
    }
    if (this.onMetricsChange) {
      this.onMetricsChange({ type: 'timeline', year, filiere: action.filiere });
    }
  }

  _applyPopup(action, chapter) {
    if (!this.hotspots) return;
    const rows = this._resolveRows(action.rows || []);
    if (action.mode === 'summary') {
      this.hotspots.showSummaryPopup(action.coord, action.title || '', rows);
      this.hotspots.clearHalo();
      return;
    }
    const predicate = this._buildPredicate(action);
    const feature = this.hotspots.find(predicate, 1)[0];
    if (feature) {
      this.hotspots.setHalo([feature]);
      this.hotspots.showPopup(feature, rows);
    } else if (action.coord) {
      this.hotspots.clearHalo();
      this.hotspots.showSummaryPopup(action.coord, action.title || '', rows);
    }
  }

  /** Contexte partagé de résolution des indicateurs. */
  _context() {
    return {
      indicators: this.indicators?.getAllIndicators?.() || {},
      stats: this.indicators?.stats
    };
  }

  /**
   * Les lignes de popup peuvent référencer un indicateur (`metric`) au lieu
   * d'écrire un chiffre en dur : la valeur est résolue à l'exécution et reste
   * alignée sur le tableau de bord.
   */
  _resolveRows(rows) {
    return rows.map(row => {
      if (!row?.metric) return row;
      const m = resolveMetric(row.metric, this._context());
      return {
        label: row.label || m.label,
        value: m.value + (m.unit ? ' ' + m.unit : '')
      };
    });
  }

  _applyHalo(action) {
    if (!this.hotspots) return;
    const predicate = this._buildPredicate(action);
    const features = this.hotspots.find(predicate, action.limit || 3);
    this.hotspots.setHalo(features);
  }

  /** Traduit une description de cible en predicat sur les proprietes. */
  _buildPredicate(action) {
    const { source, name, nameContains, cat, filiere, formation, merType, layer, maxLongueur } = action;

    if (name) {
      return f => (f.properties?.name || '') === name;
    }
    if (nameContains) {
      return f => (f.properties?.name || '').toLowerCase().includes(String(nameContains).toLowerCase());
    }
    if (cat) {
      return f => f.properties?._category === cat;
    }
    if (source) {
      const map = {
        pfc: 'C7', uv: 'C6', mer: 'C8', mfr: 'C11', tamkin: 'C10',
        cooperative: 'C9', plantation: 'C1', ravin: 'C2', seuil: 'C3',
        piste: 'C5', sousBassin: 'C4', bassin: 'C15', perimetre: 'C14'
      };
      const c = map[source];
      if (c) return f => f.properties?._category === c;
    }
    if (layer) {
      const catByLayer = {
        'pfc-circle': 'C7', 'uv-circle': 'C6', 'mer-circle': 'C8',
        'mfr-circle': 'C11', 'tamkin-circle': 'C10', 'cooperatives-circle': 'C9',
        'plantations-circle': 'C1', 'ravins-circle': 'C2', 'seuils-line': 'C3',
        'pistes-line': 'C5', 'sous-bassins-fill': 'C4', 'bassins-fill': 'C15',
        'perimetres-fill': 'C14'
      };
      const c = catByLayer[layer];
      if (c) return f => f.properties?._category === c;
    }
    if (filiere) {
      return f => f.properties?._filiere === filiere;
    }
    if (formation) {
      return f => f.properties?._formation === formation;
    }
    if (merType) {
      return f => f.properties?._merType === merType;
    }
    if (maxLongueur) {
      return f => (f.properties?._longueurKm || 0) >= maxLongueur;
    }
    return () => false;
  }

  _applyMetric(action) {
    if (!this.onMetricsChange) return;
    const resolved = resolveIndicators(action.indicators || [], this._context());
    this.onMetricsChange({ type: 'metric', indicators: resolved, emphasize: action.emphasize });
  }

  // ---------------------------------------------------------------- camera

  async _moveCamera(target) {
    if (!target) return;
    if (this.userControlled) return; // l'utilisateur garde la main
    const duration = (target.duration || 1400) / this.speed;
    await new Promise(resolve => {
      try {
        this.map.easeTo({
          center: target.center,
          zoom: target.zoom,
          pitch: target.pitch,
          bearing: target.bearing,
          duration,
          essential: false,   // l'utilisateur peut interrompre
          easing: (t) => t * (2 - t)
        });
      } catch (_) { /* ignore */ }
      setTimeout(resolve, duration + 120);
    });
  }

  async _cameraPath(path) {
    for (const step of path) {
      if (this._abort) return;
      await this._moveCamera(step);
    }
  }

  _bindInteraction() {
    if (this._interactionHandler) return;
    this._interactionHandler = () => {
      this.userControlled = true;
      this._lastInteraction = Date.now();
      try { this.map.stop(); } catch (_) { /* ignore */ }
      if (this.onFreeLook) this.onFreeLook(true);
    };
    for (const evt of ['dragstart', 'wheel', 'touchstart', 'dblclick']) {
      this.map.on(evt, this._interactionHandler);
    }
  }

  _unbindInteraction() {
    if (!this._interactionHandler) return;
    for (const evt of ['dragstart', 'wheel', 'touchstart', 'dblclick']) {
      this.map.off(evt, this._interactionHandler);
    }
    this._interactionHandler = null;
  }

  /** Recentrer la camera sur la cible du cue courant (apres mode libre). */
  recenter() {
    const chapter = this.getCurrentChapter();
    if (!chapter) return;
    const cue = chapter.cues?.[this.currentCue];
    const action = cue?.action;
    if (action?.type === 'cameraPath') {
      this.userControlled = false;
      this._cameraPath(action.path || []);
    } else if (action?.type === 'camera') {
      this.userControlled = false;
      this._moveCamera(action.target || action);
    }
  }

  // ---------------------------------------------------------------- controle

  async _wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async _waitWhilePaused() {
    while (this.paused && !this._abort) {
      await this._wait(120);
    }
  }

  pause() {
    this.paused = true;
    if (this.narrator) this.narrator.stop();
  }

  resume() {
    if (!this.playing) return;
    this.paused = false;
  }

  stop() {
    this._abort = true;
    this._runId++;
    this.playing = false;
    this.paused = false;
    this.userControlled = false;
    if (this.narrator) this.narrator.stop();
    this._unbindInteraction();
    this.hotspots?.closePopup();
    this.hotspots?.clearHalo();
    this.anim.clearFluxLayers?.();
    this.layers.hideAll();
    // Restauration de l'ensemble du jeu de couches ACTIF au chargement
    // (communes + périmètres + MER…) — la liste durcie ne restaurait que 4
    // couches et LAISSAIT LES MER ÉTEINTS après la story (bug du 25/10).
    for (const id of this.layers.initialVisible) this.layers.show(id);
  }

  next() {
    if (!this.currentStory) return;
    if (this.currentChapter < this.currentStory.chapters.length - 1) {
      this._launchChapter(this.currentChapter + 1);
    }
  }

  prev() {
    if (!this.currentStory) return;
    if (this.currentChapter > 0) {
      this._launchChapter(this.currentChapter - 1);
    }
  }

  goTo(index) {
    if (!this.currentStory) return;
    if (index >= 0 && index < this.currentStory.chapters.length) {
      this._launchChapter(index);
    }
  }

  /**
   * Reoriente l'ecution vers un autre chapitre.
   * _abort sert a interrompre le chapitre en cours ; il est donc rearme
   * juste avant le lancement du nouveau chapitre, sinon _runChapter sort
   * immediatement.
   */
  _launchChapter(index) {
    this._abort = true;          // stoppe le chapitre courant
    this._runId++;
    const runId = this._runId;
    this.playing = true;
    this.paused = false;
    setTimeout(() => {
      if (runId !== this._runId) return;
      this._abort = false;       // rearme pour le nouveau chapitre
      this._runChapter(index, runId);
    }, 40);
  }

  setSpeed(s) { this.speed = Math.max(0.5, Math.min(2, s)); }
  setAudioEnabled(v) {
    this.audioEnabled = !!v;
    if (this.narrator?.setEnabled) this.narrator.setEnabled(v);
    if (!v) this.narrator?.stop();
  }

  getCurrentChapter() {
    if (!this.currentStory) return null;
    return this.currentStory.chapters[this.currentChapter];
  }

  getProgress() {
    if (!this.currentStory) return { current: 0, total: 0, cue: 0, cues: 0 };
    const ch = this.currentStory.chapters[this.currentChapter];
    return {
      current: this.currentChapter + 1,
      total: this.currentStory.chapters.length,
      cue: this.currentCue + 1,
      cues: (ch?.cues || []).length
    };
  }
}
