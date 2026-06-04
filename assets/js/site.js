(function () {
  const data = window.COURSE_DATA;
  const finalPracticeData = window.FINAL_PRACTICE_DATA;

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

  if (page === "final-practice") {
    initFinalPracticePage();
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

    renderUnitSwitcher(document.getElementById("unit-switcher"), unit.id, buildUnitUrl);
    document.getElementById("breadcrumb-unit").textContent = unit.title;
    document.getElementById("unit-label").textContent = unit.label;
    document.getElementById("unit-title").textContent = unit.title;
    document.getElementById("unit-summary").textContent = unit.summary;
    document.getElementById("flashcards-link").href = buildFlashcardsUrl(unit.id);
    document.title = unit.title + " | 医学英语学习站";
    document.querySelector('.site-nav a[href^="unit.html"]').href = buildUnitUrl(unit.id);
    document.querySelector('.site-nav a[href^="flashcards.html"]').href = buildFlashcardsUrl(unit.id);

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

    renderUnitSwitcher(document.getElementById("unit-switcher"), unit.id, buildFlashcardsUrl);
    document.getElementById("flashcard-breadcrumb").textContent = unit.title + " 抽认卡";
    document.getElementById("flashcard-unit-label").textContent = unit.label;
    document.getElementById("flashcard-page-title").textContent = unit.title + " 抽认卡";
    document.getElementById("flashcard-unit-link").href = buildUnitUrl(unit.id);
    document.title = unit.title + " 抽认卡 | 医学英语学习站";
    document.querySelector('.site-nav a[href^="unit.html"]').href = buildUnitUrl(unit.id);
    document.querySelector('.site-nav a[href^="flashcards.html"]').href = buildFlashcardsUrl(unit.id);

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

  function initFinalPracticePage() {
    if (!finalPracticeData) {
      return;
    }

    const pageNode = document.getElementById("final-practice-page");
    const answerSections = Array.from(document.querySelectorAll("[data-answer-section]"));
    const showAllButton = document.getElementById("final-show-all");
    const rootPool = buildMorphemePracticePool("root");
    const affixPool = buildMorphemePracticePool("affix");
    const termPool = buildDocumentMatchingPool();
    const fillPool = finalPracticeData.fillBlanks || [];
    const vocabularyPool = buildVocabularyPracticePool();
    const fillAnswerPool = uniqueValues(fillPool.map((item) => item.answer));

    document.getElementById("final-new-set").addEventListener("click", renderPracticeSet);
    showAllButton.addEventListener("click", () => {
      const shouldShow = !answerSections.every((section) => section.classList.contains("answers-visible"));
      setAllAnswersVisible(shouldShow);
    });

    document.querySelectorAll("[data-toggle-section-answer]").forEach((button) => {
      button.addEventListener("click", () => {
        const section = button.closest("[data-answer-section]");

        if (!section) {
          return;
        }

        const shouldShow = !section.classList.contains("answers-visible");
        section.classList.toggle("answers-visible", shouldShow);
        updateSectionAnswerButton(section);
        updateAllAnswerButton();
        updateResponseStates(section);
      });
    });

    pageNode.addEventListener("change", (event) => {
      const control = event.target.closest("[data-answer-control]");

      if (!control) {
        return;
      }

      updateAnswerCardState(control.closest("[data-answer-card]"));
    });

    renderPracticeSet();

    function renderPracticeSet() {
      const rootItems = sampleItems(rootPool, 20);
      const affixItems = sampleItems(affixPool, 20);
      const termItems = sampleItems(termPool, 10);
      const fillItems = sampleItems(fillPool, 10);
      const fillAnswers = uniqueValues(fillItems.map((item) => item.answer));
      const fillDistractors = sampleItems(
        fillAnswerPool.filter((answer) => !fillAnswers.includes(answer)),
        3
      );
      const fillWordBank = shuffleItems([...fillAnswers, ...fillDistractors]);
      const vocabularyItems = buildVocabularyQuestions(sampleItems(vocabularyPool, 10));
      const translationItems = (finalPracticeData.sentenceTranslations || []).map((source) => {
        const sentence = sampleItems(source.sentences || [], 1)[0];
        return { source: source.source, title: source.title, sentence };
      });
      const shortAnswerItems = (finalPracticeData.shortAnswers || []).map((topic) => {
        const question = sampleItems(topic.questions || [], 1)[0];
        return { topic, question };
      });

      renderMatchingList(document.getElementById("root-match-list"), rootItems, "root");
      renderMatchingList(document.getElementById("affix-match-list"), affixItems, "affix");
      renderMatchingList(document.getElementById("term-match-list"), termItems, "term");
      renderFillBlankList(fillItems, fillWordBank);
      renderVocabularyList(vocabularyItems);
      renderTranslationList(translationItems);
      renderShortAnswerList(shortAnswerItems);
      setAllAnswersVisible(false);
    }

    function renderMatchingList(container, items, prefix) {
      const options = shuffleItems(items);

      container.innerHTML = items
        .map((item, index) => {
          const selectId = prefix + "-match-" + index;

          return [
            '<article class="practice-card" data-answer-card>',
            '<div class="practice-card-head">',
            '<span class="question-number">',
            index + 1,
            "</span>",
            "<div>",
            '<p class="meta-label">',
            escapeHtml(item.unit),
            "</p>",
            '<h3 class="card-title">',
            escapeHtml(item.term),
            "</h3>",
            "</div>",
            "</div>",
            '<label class="field-label" for="',
            selectId,
            '">英文释义</label>',
            '<select id="',
            selectId,
            '" data-answer-control data-answer="',
            escapeHtml(item.key),
            '">',
            '<option value="">选择英文释义</option>',
            options
              .map((option) => {
                return [
                  '<option value="',
                  escapeHtml(option.key),
                  '">',
                  escapeHtml(option.definition),
                  "</option>"
                ].join("");
              })
              .join(""),
            "</select>",
            '<div class="answer-reveal">',
            '<span class="answer-label">答案</span>',
            '<p class="answer-copy">',
            escapeHtml(item.definition),
            "</p>",
            '<p class="answer-copy answer-zh">',
            escapeHtml(item.meaningZh),
            "</p>",
            "</div>",
            "</article>"
          ].join("");
        })
        .join("");
    }

    function renderFillBlankList(items, wordBank) {
      document.getElementById("fill-word-bank").innerHTML = wordBank
        .map((word) => '<span class="meta-chip">' + escapeHtml(word) + "</span>")
        .join("");

      document.getElementById("fill-blank-list").innerHTML = items
        .map((item, index) => {
          const selectId = "fill-blank-" + index;

          return [
            '<article class="practice-card" data-answer-card>',
            '<div class="practice-card-head">',
            '<span class="question-number">',
            index + 1,
            "</span>",
            "<div>",
            '<p class="meta-label">',
            escapeHtml(item.unit),
            "</p>",
            '<p class="question-text">',
            formatBlankSentence(item.sentence),
            "</p>",
            "</div>",
            "</div>",
            '<label class="field-label" for="',
            selectId,
            '">选择单词</label>',
            '<select id="',
            selectId,
            '" data-answer-control data-answer="',
            escapeHtml(item.answer),
            '">',
            '<option value="">选择备选词</option>',
            wordBank
              .map((word) => {
                return [
                  '<option value="',
                  escapeHtml(word),
                  '">',
                  escapeHtml(word),
                  "</option>"
                ].join("");
              })
              .join(""),
            "</select>",
            '<div class="answer-reveal">',
            '<span class="answer-label">答案</span>',
            '<p class="answer-copy">',
            escapeHtml(item.answer),
            "</p>",
            "</div>",
            "</article>"
          ].join("");
        })
        .join("");
    }

    function renderVocabularyList(items) {
      document.getElementById("vocabulary-list").innerHTML = items
        .map((item, index) => {
          const radioName = "vocabulary-" + index;

          return [
            '<article class="practice-card vocabulary-card" data-answer-card>',
            '<div class="practice-card-head">',
            '<span class="question-number">',
            index + 1,
            "</span>",
            "<div>",
            '<p class="meta-label">',
            escapeHtml(item.unit),
            "</p>",
            '<h3 class="card-title">',
            escapeHtml(item.term),
            "</h3>",
            '<p class="ipa-text">',
            escapeHtml(item.breakdown),
            "</p>",
            "</div>",
            "</div>",
            '<div class="choice-list" role="radiogroup" aria-label="',
            escapeHtml(item.term),
            ' 的英文释义选项">',
            item.options
              .map((option) => {
                return [
                  '<label class="choice-option">',
                  '<input type="radio" name="',
                  radioName,
                  '" value="',
                  escapeHtml(option.key),
                  '" data-answer-control data-answer="',
                  escapeHtml(item.key),
                  '" />',
                  "<span>",
                  escapeHtml(option.definition),
                  "</span>",
                  "</label>"
                ].join("");
              })
              .join(""),
            "</div>",
            '<label class="field-label" for="vocabulary-zh-',
            index,
            '">中文含义</label>',
            '<input id="vocabulary-zh-',
            index,
            '" class="text-input" type="text" placeholder="写出中文含义" />',
            '<div class="answer-reveal">',
            '<span class="answer-label">答案</span>',
            '<p class="answer-copy">',
            escapeHtml(item.definition),
            "</p>",
            '<p class="answer-copy answer-zh">',
            escapeHtml(item.meaningZh),
            "</p>",
            "</div>",
            "</article>"
          ].join("");
        })
        .join("");
    }

    function renderTranslationList(items) {
      document.getElementById("translation-list").innerHTML = items
        .filter((item) => item.sentence)
        .map((item, index) => {
          return [
            '<article class="practice-card translation-card">',
            '<div class="practice-card-head">',
            '<span class="question-number">',
            index + 1,
            "</span>",
            "<div>",
            '<p class="meta-label">',
            escapeHtml(item.source),
            "</p>",
            '<h3 class="card-title">',
            escapeHtml(item.title),
            "</h3>",
            "</div>",
            "</div>",
            '<p class="question-text question-text-en">',
            escapeHtml(item.sentence.en),
            "</p>",
            '<textarea class="text-area" rows="4" placeholder="写出中文翻译"></textarea>',
            '<div class="answer-reveal">',
            '<span class="answer-label">参考译文</span>',
            '<p class="answer-copy">',
            escapeHtml(item.sentence.zh),
            "</p>",
            "</div>",
            "</article>"
          ].join("");
        })
        .join("");
    }

    function renderShortAnswerList(items) {
      document.getElementById("short-answer-list").innerHTML = items
        .filter((item) => item.question)
        .map((item, index) => {
          return [
            '<article class="practice-card short-answer-card">',
            '<div class="practice-card-head">',
            '<span class="question-number">',
            index + 1,
            "</span>",
            "<div>",
            '<p class="meta-label">',
            escapeHtml(item.topic.unit),
            "</p>",
            '<h3 class="card-title">',
            escapeHtml(item.topic.title),
            "</h3>",
            "</div>",
            "</div>",
            '<div class="short-answer-layout">',
            '<figure class="practice-figure">',
            '<img src="',
            escapeHtml(item.topic.image),
            '" alt="',
            escapeHtml(item.topic.title),
            '" loading="lazy" />',
            "</figure>",
            '<div class="short-answer-workspace">',
            '<p class="question-text question-text-en">',
            escapeHtml(item.question.question),
            "</p>",
            '<textarea class="text-area" rows="5" placeholder="结合图片写出英文回答"></textarea>',
            '<div class="answer-reveal">',
            '<span class="answer-label">参考答案</span>',
            '<p class="answer-copy">',
            escapeHtml(item.question.answer),
            "</p>",
            "</div>",
            "</div>",
            "</div>",
            "</article>"
          ].join("");
        })
        .join("");
    }

    function buildVocabularyQuestions(items) {
      return items.map((item) => {
        const distractors = sampleItems(
          vocabularyPool.filter((option) => option.key !== item.key && option.definition !== item.definition),
          3
        );

        return {
          ...item,
          options: shuffleItems([item, ...distractors])
        };
      });
    }

    function setAllAnswersVisible(shouldShow) {
      answerSections.forEach((section) => {
        section.classList.toggle("answers-visible", shouldShow);
        updateSectionAnswerButton(section);
      });
      updateAllAnswerButton();
      updateResponseStates(pageNode);
    }

    function updateAllAnswerButton() {
      const allVisible = answerSections.every((section) => section.classList.contains("answers-visible"));
      showAllButton.textContent = allVisible ? "隐藏全部答案" : "显示全部答案";
    }

    function updateSectionAnswerButton(section) {
      const button = section.querySelector("[data-toggle-section-answer]");

      if (button) {
        button.textContent = section.classList.contains("answers-visible") ? "隐藏本题型答案" : "显示本题型答案";
      }
    }
  }

  function buildMorphemePracticePool(type) {
    const field = type === "root" ? "roots" : "affixes";

    return getFinalPracticeUnits().flatMap((unit) => {
      return (unit[field] || []).map((item) => ({
        key: unit.id + "-" + item.id,
        unit: unit.label,
        term: item.label,
        definition: item.meaningEn,
        meaningZh: item.meaningZh
      }));
    });
  }

  function buildDocumentMatchingPool() {
    return (finalPracticeData.matchingTerms || []).map((item) => ({
      key: "document-" + slugify(item.term),
      unit: item.unit,
      term: item.term,
      definition: item.definition,
      meaningZh: item.meaningZh
    }));
  }

  function buildVocabularyPracticePool() {
    const lookup = buildMorphemeMeaningLookup();
    const seen = new Set();

    return getFinalPracticeUnits().flatMap((unit) => {
      return getUnitMorphemes(unit).flatMap((morpheme) => {
        return (morpheme.examples || []).flatMap((example) => {
          const key = slugify(example.term);

          if (!key || seen.has(key)) {
            return [];
          }

          seen.add(key);

          return [
            {
              key,
              unit: unit.label,
              term: example.term,
              breakdown: example.breakdown,
              meaningZh: example.meaning,
              definition: buildVocabularyDefinition(example, morpheme, lookup)
            }
          ];
        });
      });
    });
  }

  function buildMorphemeMeaningLookup() {
    const lookup = {};

    getFinalPracticeUnits().forEach((unit) => {
      getUnitMorphemes(unit).forEach((morpheme) => {
        String(morpheme.label)
          .split(",")
          .map((part) => part.trim())
          .filter(Boolean)
          .forEach((label) => {
            lookup[normalizeMorphemeToken(label)] = morpheme.meaningEn;
          });
      });
    });

    return lookup;
  }

  function buildVocabularyDefinition(example, morpheme, lookup) {
    const breakdown = String(example.breakdown || "").toLowerCase();
    const target = formatMeaningList(collectCoreMorphemeMeanings(example.breakdown, morpheme, lookup));

    if (breakdown.includes("-logist")) {
      return "a specialist who studies or treats conditions involving " + target;
    }

    if (breakdown.includes("-logy")) {
      return "the study of " + target;
    }

    if (breakdown.includes("-itis")) {
      return "inflammation of " + target;
    }

    if (breakdown.includes("-ectomy")) {
      return "surgical removal of " + target;
    }

    if (breakdown.includes("-otomy")) {
      return "a surgical incision into " + target;
    }

    if (breakdown.includes("-plasty")) {
      return "surgical repair or reshaping of " + target;
    }

    if (breakdown.includes("-graphy")) {
      return "the process of recording or imaging " + target;
    }

    if (breakdown.includes("-gram")) {
      return "a record or image of " + target;
    }

    if (breakdown.includes("-scopy")) {
      return "visual examination of " + target;
    }

    if (breakdown.includes("-scope")) {
      return "an instrument used to view " + target;
    }

    if (breakdown.includes("-metry")) {
      return "measurement of " + target;
    }

    if (breakdown.includes("-meter")) {
      return "an instrument used to measure " + target;
    }

    if (breakdown.includes("-megaly")) {
      return "enlargement of " + target;
    }

    if (breakdown.includes("-oma")) {
      return "a tumor or mass involving " + target;
    }

    if (breakdown.includes("-pathy")) {
      return "a disease or disorder of " + target;
    }

    if (breakdown.includes("-algia")) {
      return "pain involving " + target;
    }

    if (breakdown.includes("-osis")) {
      return "an abnormal condition involving " + target;
    }

    if (breakdown.includes("-genesis")) {
      return "the formation or production of " + target;
    }

    if (breakdown.includes("-cyte")) {
      return "a cell related to " + target;
    }

    if (breakdown.includes("-blast")) {
      return "an immature cell related to " + target;
    }

    if (breakdown.includes("-emia")) {
      return "a blood condition involving " + target;
    }

    if (breakdown.includes("-uria")) {
      return "a urinary condition involving " + target;
    }

    if (breakdown.includes("-therapy")) {
      return "treatment involving " + target;
    }

    if (breakdown.includes("anti-")) {
      return "something that works against " + target;
    }

    if (
      breakdown.includes("-ary") ||
      breakdown.includes("-ic") ||
      breakdown.includes("-al") ||
      breakdown.includes("-tic") ||
      breakdown.includes("-ous")
    ) {
      return "pertaining to " + target;
    }

    return "a medical term related to " + target;
  }

  function collectCoreMorphemeMeanings(breakdown, morpheme, lookup) {
    const meanings = String(breakdown || "")
      .split("+")
      .map((token) => token.trim())
      .filter(Boolean)
      .filter((token) => !token.startsWith("-") && !token.endsWith("-"))
      .map((token) => lookup[normalizeMorphemeToken(token)])
      .filter(Boolean);

    if (!meanings.length && morpheme.meaningEn) {
      meanings.push(morpheme.meaningEn);
    }

    return uniqueValues(meanings).slice(0, 3);
  }

  function normalizeMorphemeToken(token) {
    return String(token).toLowerCase().replace(/\s+/g, "");
  }

  function formatMeaningList(meanings) {
    const cleaned = uniqueValues(meanings.map(cleanMeaning).filter(Boolean));

    if (!cleaned.length) {
      return "the listed medical concept";
    }

    if (cleaned.length === 1) {
      return cleaned[0];
    }

    if (cleaned.length === 2) {
      return cleaned[0] + " and " + cleaned[1];
    }

    return cleaned.slice(0, -1).join(", ") + ", and " + cleaned[cleaned.length - 1];
  }

  function cleanMeaning(meaning) {
    return String(meaning)
      .replace(/\s*\([^)]*\)/g, "")
      .split(";")[0]
      .trim();
  }

  function formatBlankSentence(sentence) {
    return escapeHtml(sentence).replace(/_{4,}/g, '<span class="blank-slot">__________</span>');
  }

  function updateResponseStates(root) {
    root.querySelectorAll("[data-answer-card]").forEach(updateAnswerCardState);
  }

  function updateAnswerCardState(card) {
    if (!card) {
      return;
    }

    const isVisible = Boolean(card.closest(".answers-visible"));
    const controls = Array.from(card.querySelectorAll("[data-answer-control]"));

    card.classList.remove("is-correct", "is-incorrect");
    card.querySelectorAll(".choice-option").forEach((option) => {
      option.classList.remove("is-correct-choice", "is-selected-incorrect");
    });

    if (!isVisible || !controls.length) {
      return;
    }

    const correctValue = controls[0].dataset.answer;
    const selectedControl =
      controls[0].type === "radio" ? controls.find((control) => control.checked) : controls[0];

    if (!selectedControl || !selectedControl.value) {
      return;
    }

    const isCorrect = selectedControl.value === correctValue;
    card.classList.toggle("is-correct", isCorrect);
    card.classList.toggle("is-incorrect", !isCorrect);

    if (controls[0].type === "radio") {
      controls.forEach((control) => {
        const option = control.closest(".choice-option");

        if (!option) {
          return;
        }

        option.classList.toggle("is-correct-choice", control.value === correctValue);
        option.classList.toggle("is-selected-incorrect", control.checked && control.value !== correctValue);
      });
    }
  }

  function sampleItems(items, count) {
    return shuffleItems(items).slice(0, Math.min(count, items.length));
  }

  function shuffleItems(items) {
    const shuffled = items.filter(Boolean).slice();

    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      const current = shuffled[index];
      shuffled[index] = shuffled[swapIndex];
      shuffled[swapIndex] = current;
    }

    return shuffled;
  }

  function uniqueValues(values) {
    return Array.from(new Set(values.filter(Boolean)));
  }

  function getFinalPracticeUnits() {
    return getReadyUnits().slice(0, 6);
  }

  function escapeHtml(value) {
    return String(value || "").replace(/[&<>"']/g, (character) => {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
      }[character];
    });
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

  function renderUnitSwitcher(container, currentUnitId, hrefBuilder) {
    if (!container) {
      return;
    }

    container.innerHTML = getReadyUnits()
      .map((unit) => {
        return [
          '<a class="unit-switcher-chip',
          unit.id === currentUnitId ? " is-current" : "",
          '" href="',
          hrefBuilder(unit.id),
          '">',
          unit.label,
          "</a>"
        ].join("");
      })
      .join("");
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
    const readyUnit = getReadyUnits()[0];
    return readyUnit ? readyUnit.id : data.units[0].id;
  }

  function getReadyUnits() {
    return data.units.filter((unit) => unit.status === "ready");
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
