(function () {
  const data = window.COURSE_DATA;

  if (!data || !Array.isArray(data.units)) {
    return;
  }

  const page = document.body.dataset.page;
  const query = new URLSearchParams(window.location.search);
  let activeAudioButton = null;

  document.body.addEventListener("click", handleAudioClick);

  if (page === "home") {
    initHomePage();
  }

  if (page === "unit") {
    initUnitPage();
  }

  if (page === "flashcards") {
    initFlashcardsPage();
  }

  function initHomePage() {
    const unitGrid = document.getElementById("unit-grid");
    const readyUnitId = getReadyUnitId();

    unitGrid.innerHTML = data.units
      .map((unit) => {
        const morphemeCount = getUnitMorphemes(unit).length;
        const exampleCount = countExamples(unit);
        const isReady = unit.status === "ready";

        return [
          '<article class="unit-card">',
          '<div class="unit-card-top">',
          '<span class="status-chip',
          isReady ? " status-ready" : "",
          '">',
          isReady ? "可学习" : "整理中",
          "</span>",
          "<span>",
          unit.label,
          "</span>",
          "</div>",
          '<h3 class="card-title">',
          unit.title,
          "</h3>",
          '<p class="card-copy">',
          unit.summary,
          "</p>",
          '<div class="unit-card-meta">',
          '<span class="meta-chip">',
          morphemeCount,
          " 个词根词缀</span>",
          '<span class="meta-chip">',
          exampleCount,
          " 个例词</span>",
          "</div>",
          isReady
            ? '<div class="card-actions"><a class="button button-primary" href="' +
              buildUnitUrl(unit.id) +
              '">进入单元</a><a class="button button-secondary" href="' +
              buildFlashcardsUrl(unit.id) +
              '">抽认卡</a></div>'
            : '<div class="card-actions"><a class="button button-secondary" href="' +
              buildUnitUrl(readyUnitId) +
              '">先学已完成单元</a></div>',
          "</article>"
        ].join("");
      })
      .join("");
  }

  function initUnitPage() {
    const unit = getCurrentUnit();
    const rootsBody = document.getElementById("roots-body");
    const affixesBody = document.getElementById("affixes-body");
    const unitEmpty = document.getElementById("unit-empty");
    const unitContent = document.getElementById("unit-content");
    const detailPanel = document.getElementById("detail-panel");
    const affixSection = document.getElementById("affix-section");
    const allItems = getUnitMorphemes(unit);
    let selectedId = query.get("item") || (allItems[0] ? allItems[0].id : "");

    document.getElementById("breadcrumb-unit").textContent = unit.title;
    document.getElementById("unit-label").textContent = unit.label;
    document.getElementById("unit-title").textContent = unit.title;
    document.getElementById("unit-summary").textContent = unit.summary;
    document.getElementById("flashcards-link").href = buildFlashcardsUrl(unit.id);
    document.title = unit.title + " | 医学英语构词法学习站";

    if (unit.status !== "ready" || !allItems.length) {
      unitEmpty.hidden = false;
      unitContent.hidden = true;
      detailPanel.hidden = true;
      affixSection.hidden = true;
      return;
    }

    renderOverviewTables();
    renderDetail(selectedId, false);

    rootsBody.addEventListener("click", handleOverviewClick);
    affixesBody.addEventListener("click", handleOverviewClick);

    function handleOverviewClick(event) {
      const button = event.target.closest("[data-select-item]");

      if (!button) {
        return;
      }

      selectedId = button.dataset.selectItem;
      renderOverviewTables();
      renderDetail(selectedId, true);
      window.history.replaceState({}, "", buildUnitUrl(unit.id, selectedId));
    }

    function renderOverviewTables() {
      rootsBody.innerHTML = buildOverviewRows(unit.roots, selectedId);
      affixesBody.innerHTML = buildOverviewRows(unit.affixes, selectedId);
    }

    function renderDetail(itemId, shouldScroll) {
      const item = allItems.find((entry) => entry.id === itemId) || allItems[0];

      if (!item) {
        detailPanel.hidden = true;
        return;
      }

      detailPanel.hidden = false;
      document.getElementById("detail-type").textContent = item.type === "root" ? "Root" : "Affix";
      document.getElementById("detail-title").textContent = item.label;
      document.getElementById("detail-summary").textContent = item.meaningEn + " / " + item.meaningZh;
      document.getElementById("detail-origin").textContent = item.origin;
      document.getElementById("detail-why").textContent = item.why;
      document.getElementById("example-list").innerHTML = buildExampleCards(item.examples);

      if (shouldScroll) {
        detailPanel.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  }

  function initFlashcardsPage() {
    const unit = getCurrentUnit();
    const pool = buildFlashcardPool(unit);
    const breakdownNode = document.getElementById("flashcard-breakdown");
    const meaningNode = document.getElementById("flashcard-meaning");
    const revealButton = document.getElementById("reveal-answer");
    const nextButton = document.getElementById("next-card");
    const shell = document.getElementById("flashcard-shell");
    const empty = document.getElementById("flashcard-empty");

    document.getElementById("flashcard-breadcrumb").textContent = unit.title + " 抽认卡";
    document.getElementById("flashcard-unit-label").textContent = unit.label;
    document.getElementById("flashcard-page-title").textContent = unit.title + " 抽认卡";
    document.getElementById("flashcard-unit-link").href = buildUnitUrl(unit.id);
    document.title = unit.title + " 抽认卡 | 医学英语构词法学习站";

    if (!pool.length) {
      shell.hidden = true;
      empty.hidden = false;
      return;
    }

    let currentKey = pickRandomCard(pool, "");
    let revealed = false;

    renderCurrentCard();

    revealButton.addEventListener("click", () => {
      revealed = !revealed;
      renderCurrentCard();
    });

    nextButton.addEventListener("click", () => {
      currentKey = pickRandomCard(pool, currentKey);
      revealed = false;
      renderCurrentCard();
    });

    function renderCurrentCard() {
      const card = pool.find((item) => item.key === currentKey) || pool[0];

      document.getElementById("flashcard-count").textContent = "共 " + pool.length + " 张术语卡片";
      document.getElementById("flashcard-term").textContent = card.term;
      document.getElementById("flashcard-ipa").textContent = card.ipa;
      setAnswerText(breakdownNode, revealed ? card.breakdown : "");
      setAnswerText(meaningNode, revealed ? card.meaning : "");
      revealButton.textContent = revealed ? "隐藏答案" : "显示答案";
    }
  }

  function handleAudioClick(event) {
    const button = event.target.closest("[data-audio-text]");

    if (!button) {
      return;
    }

    event.preventDefault();
    playPronunciation(button);
  }

  function playPronunciation(button) {
    if (!("speechSynthesis" in window)) {
      return;
    }

    const text = button.dataset.audioText;

    if (activeAudioButton === button) {
      window.speechSynthesis.cancel();
      clearAudioState();
      return;
    }

    window.speechSynthesis.cancel();
    clearAudioState();
    activeAudioButton = button;
    activeAudioButton.classList.add("is-playing");

    const utterance = new SpeechSynthesisUtterance(text);
    const voice = pickEnglishVoice();
    utterance.lang = "en-US";
    utterance.rate = 0.9;
    utterance.pitch = 1;

    if (voice) {
      utterance.voice = voice;
    }

    utterance.onend = clearAudioState;
    utterance.onerror = clearAudioState;
    window.speechSynthesis.speak(utterance);
  }

  function clearAudioState() {
    if (!activeAudioButton) {
      return;
    }

    activeAudioButton.classList.remove("is-playing");
    activeAudioButton = null;
  }

  function pickEnglishVoice() {
    const voices = window.speechSynthesis.getVoices();
    const preferred = ["Samantha", "Alex", "Daniel", "Karen"];

    return (
      voices.find((voice) => preferred.includes(voice.name)) ||
      voices.find((voice) => voice.lang && voice.lang.toLowerCase().startsWith("en")) ||
      null
    );
  }

  function buildOverviewRows(items, selectedId) {
    if (!items.length) {
      return '<tr><td colspan="3" class="table-empty">本单元内容整理中</td></tr>';
    }

    return items
      .map((item) => {
        const isSelected = item.id === selectedId;

        return [
          "<tr>",
          '<td><button class="table-select',
          isSelected ? " is-selected" : "",
          '" type="button" data-select-item="',
          item.id,
          '" aria-pressed="',
          isSelected ? "true" : "false",
          '">',
          item.label,
          "</button></td>",
          "<td>",
          item.meaningEn,
          "</td>",
          "<td>",
          item.meaningZh,
          "</td>",
          "</tr>"
        ].join("");
      })
      .join("");
  }

  function buildExampleCards(examples) {
    return examples
      .map((example) => {
        return [
          '<article class="example-card">',
          '<div class="example-head">',
          '<div class="example-main">',
          '<h3 class="card-title">',
          example.term,
          "</h3>",
          '<p class="ipa-text">',
          example.ipa,
          "</p>",
          "</div>",
          '<button class="audio-button" type="button" data-audio-text="',
          example.audioText || example.term,
          '" aria-label="播放 ',
          example.term,
          ' 的发音">',
          audioIcon(),
          "</button>",
          "</div>",
          '<div class="example-grid">',
          '<div class="example-meta">',
          '<span class="meta-label">构词解析</span>',
          '<p class="meta-value">',
          example.breakdown,
          "</p>",
          "</div>",
          '<div class="example-meta">',
          '<span class="meta-label">中文释义</span>',
          '<p class="meta-value">',
          example.meaning,
          "</p>",
          "</div>",
          "</div>",
          "</article>"
        ].join("");
      })
      .join("");
  }

  function buildFlashcardPool(unit) {
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

  function setAnswerText(node, text) {
    const content = text || " ";
    node.textContent = content;
    node.classList.toggle("is-empty", !text);
  }

  function pickRandomCard(pool, currentKey) {
    if (pool.length === 1) {
      return pool[0].key;
    }

    const nextPool = pool.filter((item) => item.key !== currentKey);
    const nextIndex = Math.floor(Math.random() * nextPool.length);
    return nextPool[nextIndex].key;
  }

  function getCurrentUnit() {
    const requested = query.get("unit");
    return data.units.find((unit) => unit.id === requested) || data.units.find((unit) => unit.status === "ready") || data.units[0];
  }

  function getUnitMorphemes(unit) {
    return [...(unit.roots || []), ...(unit.affixes || [])];
  }

  function countExamples(unit) {
    return getUnitMorphemes(unit).reduce((total, morpheme) => total + morpheme.examples.length, 0);
  }

  function getReadyUnitId() {
    const readyUnit = data.units.find((unit) => unit.status === "ready");
    return readyUnit ? readyUnit.id : data.units[0].id;
  }

  function buildUnitUrl(unitId, itemId) {
    const params = new URLSearchParams();
    params.set("unit", unitId);

    if (itemId) {
      params.set("item", itemId);
    }

    return "unit.html?" + params.toString();
  }

  function buildFlashcardsUrl(unitId) {
    return "flashcards.html?unit=" + encodeURIComponent(unitId);
  }

  function slugify(text) {
    return text
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function audioIcon() {
    return [
      '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">',
      '<path d="M5 9v6h4l5 4V5l-5 4H5Z" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round"></path>',
      '<path d="M18 9.5a4.5 4.5 0 0 1 0 5" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"></path>',
      '<path d="M20.5 7a8 8 0 0 1 0 10" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"></path>',
      "</svg>"
    ].join("");
  }
})();
