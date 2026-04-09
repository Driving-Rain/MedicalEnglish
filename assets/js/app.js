(function () {
  const courseData = window.COURSE_DATA;

  if (!courseData || !Array.isArray(courseData.units)) {
    return;
  }

  const state = {
    activeUnitId: pickInitialUnitId(courseData.units),
    filter: "all",
    search: "",
    selectedMorphemeId: null,
    reviewKey: "",
    reviewAnswerVisible: false
  };

  const elements = {
    unitTabs: document.getElementById("unit-tabs"),
    overviewMeta: document.getElementById("overview-meta"),
    overviewDescription: document.getElementById("overview-description"),
    rootsCount: document.getElementById("roots-count"),
    affixesCount: document.getElementById("affixes-count"),
    rootsSummaryBody: document.getElementById("roots-summary-body"),
    affixesSummaryBody: document.getElementById("affixes-summary-body"),
    morphemeGrid: document.getElementById("morpheme-grid"),
    detailPanel: document.getElementById("detail-panel"),
    emptyState: document.getElementById("empty-state"),
    resultCount: document.getElementById("result-count"),
    searchInput: document.getElementById("search-input"),
    filterButtons: Array.from(document.querySelectorAll("[data-filter]")),
    roadmapGrid: document.getElementById("roadmap-grid"),
    revealButton: document.getElementById("reveal-answer"),
    nextButton: document.getElementById("next-card"),
    flashcardTerm: document.getElementById("flashcard-term"),
    flashcardIpa: document.getElementById("flashcard-ipa"),
    flashcardAnswer: document.getElementById("flashcard-answer"),
    flashcardBreakdown: document.getElementById("flashcard-breakdown"),
    flashcardMeaning: document.getElementById("flashcard-meaning"),
    heroStats: {
      units: document.querySelector("[data-stat='units']"),
      morphemes: document.querySelector("[data-stat='morphemes']"),
      examples: document.querySelector("[data-stat='examples']")
    },
    sharedAudio: document.getElementById("shared-audio")
  };

  let activeAudioButton = null;
  let activeUtterance = null;

  renderHeroStats();
  renderUnitTabs();
  renderRoadmap();
  syncSelection();
  render();
  bindEvents();

  function pickInitialUnitId(units) {
    const readyUnit = units.find((unit) => unit.status === "ready");
    return readyUnit ? readyUnit.id : units[0].id;
  }

  function getActiveUnit() {
    return courseData.units.find((unit) => unit.id === state.activeUnitId) || courseData.units[0];
  }

  function getUnitMorphemes(unit) {
    return [...(unit.roots || []), ...(unit.affixes || [])];
  }

  function slugify(text) {
    return text
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function audioPathFor(text) {
    return "assets/audio/terms/" + slugify(text) + ".wav";
  }

  function bindEvents() {
    elements.searchInput.addEventListener("input", (event) => {
      state.search = event.target.value.trim().toLowerCase();
      syncSelection();
      render();
    });

    elements.filterButtons.forEach((button) => {
      button.addEventListener("click", () => {
        state.filter = button.dataset.filter || "all";
        syncSelection();
        renderCards();
        renderDetailPanel();
        renderFilters();
      });
    });

    elements.unitTabs.addEventListener("click", (event) => {
      const button = event.target.closest("[data-unit-id]");

      if (!button) {
        return;
      }

      state.activeUnitId = button.dataset.unitId;
      state.search = "";
      elements.searchInput.value = "";
      state.filter = "all";
      state.reviewKey = "";
      state.reviewAnswerVisible = false;
      pauseAudio();
      syncSelection();
      render();
    });

    elements.morphemeGrid.addEventListener("click", (event) => {
      const card = event.target.closest("[data-morpheme-id]");

      if (!card) {
        return;
      }

      state.selectedMorphemeId = card.dataset.morphemeId;
      renderCards();
      renderDetailPanel();
    });

    elements.rootsSummaryBody.addEventListener("click", handleSummaryClick);
    elements.affixesSummaryBody.addEventListener("click", handleSummaryClick);
    elements.roadmapGrid.addEventListener("click", handleRoadmapClick);
    elements.detailPanel.addEventListener("click", handleDetailPanelClick);

    elements.revealButton.addEventListener("click", () => {
      state.reviewAnswerVisible = true;
      renderFlashcard();
    });

    elements.nextButton.addEventListener("click", () => {
      const pool = buildReviewPool(getActiveUnit());
      state.reviewKey = nextReviewKey(pool, state.reviewKey);
      state.reviewAnswerVisible = false;
      renderFlashcard();
    });

    elements.sharedAudio.addEventListener("ended", clearActiveAudioButton);
    elements.sharedAudio.addEventListener("pause", clearActiveAudioButton);
  }

  function handleSummaryClick(event) {
    const button = event.target.closest("[data-select-morpheme]");

    if (!button) {
      return;
    }

    state.selectedMorphemeId = button.dataset.selectMorpheme;
    renderCards();
    renderDetailPanel();
    document.getElementById("study").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function handleRoadmapClick(event) {
    const button = event.target.closest("[data-roadmap-unit]");

    if (!button) {
      return;
    }

    state.activeUnitId = button.dataset.roadmapUnit;
    state.search = "";
    elements.searchInput.value = "";
    state.filter = "all";
    state.reviewKey = "";
    state.reviewAnswerVisible = false;
    pauseAudio();
    syncSelection();
    render();
    document.getElementById("unit-overview").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function handleDetailPanelClick(event) {
    const audioButton = event.target.closest("[data-audio-text]");

    if (!audioButton) {
      return;
    }

    playAudio(audioButton);
  }

  function playAudio(button) {
    const audioText = button.dataset.audioText;

    if (activeAudioButton === button) {
      pauseAudio();
      return;
    }

    pauseAudio();
    activeAudioButton = button;
    activeAudioButton.classList.add("is-playing");

    if ("speechSynthesis" in window) {
      speakText(audioText);
      return;
    }

    const sourcePath = audioPathFor(audioText);

    if (elements.sharedAudio.getAttribute("src") !== sourcePath) {
      elements.sharedAudio.setAttribute("src", sourcePath);
    }

    elements.sharedAudio.currentTime = 0;
    elements.sharedAudio.play().catch(() => {
      activeAudioButton.classList.remove("is-playing");
      activeAudioButton = null;
    });
  }

  function speakText(text) {
    const utterance = new SpeechSynthesisUtterance(text);
    const preferredVoice = pickEnglishVoice();

    utterance.lang = "en-US";
    utterance.rate = 0.9;
    utterance.pitch = 1;

    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    utterance.onend = clearActiveAudioButton;
    utterance.onerror = clearActiveAudioButton;
    activeUtterance = utterance;

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }

  function pickEnglishVoice() {
    const voices = window.speechSynthesis.getVoices();
    const preferredNames = ["Samantha", "Alex", "Daniel", "Karen"];

    return (
      voices.find((voice) => preferredNames.includes(voice.name)) ||
      voices.find((voice) => voice.lang && voice.lang.toLowerCase().startsWith("en")) ||
      null
    );
  }

  function pauseAudio() {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      activeUtterance = null;
    }

    elements.sharedAudio.pause();
    elements.sharedAudio.currentTime = 0;
    clearActiveAudioButton();
  }

  function clearActiveAudioButton() {
    activeUtterance = null;

    if (!activeAudioButton) {
      return;
    }

    activeAudioButton.classList.remove("is-playing");
    activeAudioButton = null;
  }

  function render() {
    renderUnitTabs();
    renderOverview();
    renderFilters();
    renderCards();
    renderDetailPanel();
    renderFlashcard();
    renderRoadmap();
  }

  function renderHeroStats() {
    const readyUnits = courseData.units.filter((unit) => unit.status === "ready");
    const morphemeCount = readyUnits.reduce((total, unit) => total + getUnitMorphemes(unit).length, 0);
    const exampleCount = readyUnits.reduce((total, unit) => {
      return total + getUnitMorphemes(unit).reduce((sum, morpheme) => sum + morpheme.examples.length, 0);
    }, 0);

    elements.heroStats.units.textContent = String(courseData.units.length);
    elements.heroStats.morphemes.textContent = String(morphemeCount);
    elements.heroStats.examples.textContent = String(exampleCount);
  }

  function renderUnitTabs() {
    const html = courseData.units
      .map((unit) => {
        const isActive = unit.id === state.activeUnitId;
        const count = getUnitMorphemes(unit).length;

        return [
          '<button class="unit-tab',
          isActive ? " is-active" : "",
          '" type="button" role="tab" aria-selected="',
          isActive ? "true" : "false",
          '" data-unit-id="',
          unit.id,
          '">',
          '<span class="unit-tab-label">',
          unit.label,
          "</span>",
          '<strong class="unit-tab-title">',
          unit.title.replace(/^第[一二三四五六七八]单元：?/, ""),
          "</strong>",
          '<span class="unit-tab-meta">',
          unit.status === "ready" ? count + " 个词根词缀" : "待补充",
          "</span>",
          "</button>"
        ].join("");
      })
      .join("");

    elements.unitTabs.innerHTML = html;
  }

  function renderOverview() {
    const unit = getActiveUnit();
    const rootCount = (unit.roots || []).length;
    const affixCount = (unit.affixes || []).length;

    elements.overviewDescription.textContent = unit.summary;
    elements.rootsCount.textContent = rootCount + " 项";
    elements.affixesCount.textContent = affixCount + " 项";
    elements.overviewMeta.innerHTML = [
      buildMetaPill(unit.label),
      buildMetaPill(unit.status === "ready" ? "已录入" : "待补充"),
      buildMetaPill(rootCount + " 个词根"),
      buildMetaPill(affixCount + " 个词缀")
    ].join("");

    elements.rootsSummaryBody.innerHTML = buildSummaryRows(unit.roots || []);
    elements.affixesSummaryBody.innerHTML = buildSummaryRows(unit.affixes || []);
  }

  function buildMetaPill(text) {
    return '<span class="meta-pill">' + text + "</span>";
  }

  function buildSummaryRows(items) {
    if (!items.length) {
      return '<tr><td colspan="2" class="table-empty">本单元内容待补充</td></tr>';
    }

    return items
      .map((item) => {
        return [
          "<tr>",
          '<td><button class="summary-link" type="button" data-select-morpheme="',
          item.id,
          '">',
          item.label,
          "</button></td>",
          "<td>",
          item.meaningEn,
          " / ",
          item.meaningZh,
          "</td>",
          "</tr>"
        ].join("");
      })
      .join("");
  }

  function renderFilters() {
    elements.filterButtons.forEach((button) => {
      const isActive = button.dataset.filter === state.filter;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-pressed", isActive ? "true" : "false");
    });
  }

  function renderCards() {
    const filtered = getFilteredMorphemes();

    elements.resultCount.textContent = filtered.length + " 张卡片";
    elements.emptyState.hidden = filtered.length > 0;
    elements.morphemeGrid.hidden = filtered.length === 0;

    if (!filtered.length) {
      elements.morphemeGrid.innerHTML = "";
      return;
    }

    elements.morphemeGrid.innerHTML = filtered
      .map((morpheme) => {
        const isSelected = morpheme.id === state.selectedMorphemeId;
        const previewTerms = morpheme.examples.slice(0, 2).map((example) => example.term).join(" · ");

        return [
          '<button class="morpheme-card tone-',
          morpheme.accent,
          isSelected ? " is-selected" : "",
          '" type="button" aria-pressed="',
          isSelected ? "true" : "false",
          '" data-morpheme-id="',
          morpheme.id,
          '">',
          '<span class="morpheme-type">',
          morpheme.type === "root" ? "词根" : "词缀",
          "</span>",
          '<div class="morpheme-card-top">',
          '<span class="morpheme-icon" aria-hidden="true">',
          morpheme.icon,
          "</span>",
          '<strong class="morpheme-label">',
          morpheme.label,
          "</strong>",
          "</div>",
          '<p class="morpheme-meaning">',
          morpheme.meaningEn,
          " / ",
          morpheme.meaningZh,
          "</p>",
          '<p class="morpheme-preview">',
          previewTerms,
          "</p>",
          '<span class="morpheme-count">',
          morpheme.examples.length,
          " 个例词</span>",
          "</button>"
        ].join("");
      })
      .join("");
  }

  function renderDetailPanel() {
    const unit = getActiveUnit();
    const morphemes = getUnitMorphemes(unit);
    const morpheme = morphemes.find((item) => item.id === state.selectedMorphemeId);

    if (!morpheme) {
      elements.detailPanel.innerHTML = [
        '<div class="detail-placeholder">',
        "<h3>",
        unit.status === "ready" ? "先选择左侧卡片" : "这个单元还没有录入内容",
        "</h3>",
        "<p>",
        unit.status === "ready"
          ? "你可以点任意词根或词缀，查看例词、音标、构词解析和音频。"
          : "我已经把结构搭好了，后续只要继续补数据文件，这里就会自动显示完整内容。",
        "</p>",
        "</div>"
      ].join("");
      return;
    }

    const examplesHtml = morpheme.examples
      .map((example) => {
        return [
          '<article class="example-card">',
          '<div class="example-term-row">',
          '<div class="example-term-group">',
          '<strong class="example-term">',
          example.term,
          "</strong>",
          '<span class="ipa-chip">',
          example.ipa,
          "</span>",
          "</div>",
          '<button class="audio-button" type="button" data-audio-text="',
          example.audioText,
          '" aria-label="播放 ',
          example.term,
          ' 的发音">',
          audioIcon(),
          "</button>",
          "</div>",
          '<div class="example-meta-grid">',
          '<div class="meta-cell">',
          '<span class="meta-cell-label">构词解析</span>',
          '<p class="meta-cell-value">',
          example.breakdown,
          "</p>",
          "</div>",
          '<div class="meta-cell">',
          '<span class="meta-cell-label">中文释义</span>',
          '<p class="meta-cell-value">',
          example.meaning,
          "</p>",
          "</div>",
          "</div>",
          "</article>"
        ].join("");
      })
      .join("");

    elements.detailPanel.innerHTML = [
      '<div class="detail-header tone-',
      morpheme.accent,
      '">',
      '<div class="detail-badge-row">',
      '<span class="detail-kind">',
      morpheme.type === "root" ? "Root" : "Affix",
      "</span>",
      '<span class="detail-icon" aria-hidden="true">',
      morpheme.icon,
      "</span>",
      "</div>",
      '<h3 class="detail-title">',
      morpheme.label,
      "</h3>",
      '<p class="detail-subtitle">',
      morpheme.meaningEn,
      " / ",
      morpheme.meaningZh,
      "</p>",
      "</div>",
      '<div class="detail-body">',
      '<div class="callout callout-origin">',
      '<span class="callout-label">词源</span>',
      '<p>',
      morpheme.origin,
      "</p>",
      "</div>",
      '<div class="callout callout-why">',
      '<span class="callout-label">课堂提示</span>',
      '<p>',
      morpheme.why,
      "</p>",
      "</div>",
      '<div class="detail-section-title-row">',
      '<h4>课堂例词</h4>',
      '<span class="detail-example-count">',
      morpheme.examples.length,
      " 个</span>",
      "</div>",
      '<div class="example-list">',
      examplesHtml,
      "</div>",
      "</div>"
    ].join("");
  }

  function renderFlashcard() {
    const pool = buildReviewPool(getActiveUnit());

    if (!pool.length) {
      elements.flashcardTerm.textContent = "本单元待补充";
      elements.flashcardIpa.textContent = "";
      elements.flashcardAnswer.hidden = true;
      elements.revealButton.disabled = true;
      elements.nextButton.disabled = true;
      return;
    }

    if (!state.reviewKey || !pool.find((item) => item.key === state.reviewKey)) {
      state.reviewKey = nextReviewKey(pool, "");
      state.reviewAnswerVisible = false;
    }

    const current = pool.find((item) => item.key === state.reviewKey) || pool[0];

    elements.flashcardTerm.textContent = current.term;
    elements.flashcardIpa.textContent = current.ipa;
    elements.flashcardBreakdown.textContent = current.breakdown;
    elements.flashcardMeaning.textContent = current.meaning;
    elements.flashcardAnswer.hidden = !state.reviewAnswerVisible;
    elements.revealButton.disabled = false;
    elements.nextButton.disabled = false;
    elements.revealButton.textContent = state.reviewAnswerVisible ? "已显示答案" : "显示答案";
  }

  function buildReviewPool(unit) {
    const seen = new Set();

    return getUnitMorphemes(unit).flatMap((morpheme) => {
      return morpheme.examples
        .filter((example) => {
          const key = slugify(example.term);

          if (seen.has(key)) {
            return false;
          }

          seen.add(key);
          return true;
        })
        .map((example) => ({
          key: slugify(example.term),
          term: example.term,
          ipa: example.ipa,
          breakdown: example.breakdown,
          meaning: example.meaning
        }));
    });
  }

  function nextReviewKey(pool, currentKey) {
    if (!pool.length) {
      return "";
    }

    if (pool.length === 1) {
      return pool[0].key;
    }

    const alternatives = pool.filter((item) => item.key !== currentKey);
    const next = alternatives[Math.floor(Math.random() * alternatives.length)];
    return next.key;
  }

  function renderRoadmap() {
    const activeUnitId = state.activeUnitId;

    elements.roadmapGrid.innerHTML = courseData.units
      .map((unit) => {
        const morphemes = getUnitMorphemes(unit);
        const exampleCount = morphemes.reduce((sum, morpheme) => sum + morpheme.examples.length, 0);

        return [
          '<button class="roadmap-card',
          activeUnitId === unit.id ? " is-current" : "",
          '" type="button" aria-pressed="',
          activeUnitId === unit.id ? "true" : "false",
          '" data-roadmap-unit="',
          unit.id,
          '">',
          '<span class="roadmap-unit-label">',
          unit.label,
          "</span>",
          '<strong class="roadmap-title">',
          unit.title,
          "</strong>",
          '<p class="roadmap-summary">',
          unit.summary,
          "</p>",
          '<div class="roadmap-meta">',
          '<span class="meta-pill">',
          unit.status === "ready" ? "已录入" : "待补充",
          "</span>",
          '<span class="meta-pill">',
          morphemes.length,
          " 个词根词缀</span>",
          '<span class="meta-pill">',
          exampleCount,
          " 个例词</span>",
          "</div>",
          "</button>"
        ].join("");
      })
      .join("");
  }

  function getFilteredMorphemes() {
    const unit = getActiveUnit();
    const morphemes = getUnitMorphemes(unit);

    return morphemes.filter((morpheme) => {
      const matchesType = state.filter === "all" || morpheme.type === state.filter;
      const matchesSearch = !state.search || buildSearchText(morpheme).includes(state.search);
      return matchesType && matchesSearch;
    });
  }

  function buildSearchText(morpheme) {
    return [
      morpheme.label,
      morpheme.meaningEn,
      morpheme.meaningZh,
      morpheme.origin,
      morpheme.why,
      ...morpheme.examples.flatMap((example) => [
        example.term,
        example.ipa,
        example.breakdown,
        example.meaning
      ])
    ]
      .join(" ")
      .toLowerCase();
  }

  function syncSelection() {
    const filtered = getFilteredMorphemes();
    const unit = getActiveUnit();
    const unitMorphemeIds = new Set(getUnitMorphemes(unit).map((item) => item.id));

    if (!unitMorphemeIds.has(state.selectedMorphemeId)) {
      state.selectedMorphemeId = filtered[0] ? filtered[0].id : "";
      return;
    }

    if (filtered.length && !filtered.find((item) => item.id === state.selectedMorphemeId)) {
      state.selectedMorphemeId = filtered[0].id;
      return;
    }

    if (!filtered.length) {
      state.selectedMorphemeId = "";
    }
  }

  function audioIcon() {
    return [
      '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">',
      '<path d="M5 9v6h4l5 4V5l-5 4H5Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"></path>',
      '<path d="M18 9.5a4.5 4.5 0 0 1 0 5" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path>',
      '<path d="M20.5 7a8 8 0 0 1 0 10" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path>',
      "</svg>"
    ].join("");
  }
})();
