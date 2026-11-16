(() => {
  "use strict";
  // система комбо и критических кликов
  let clickCombo = 0;
  let lastClickTime = 0;
  let clickBoostUntil = 0;
  let boostDisplayTimer = null;

  const COMBO_REQUIRED = 40;
  const COMBO_CLICK_GAP = 700;
  const COMBO_DURATION = 10000;

  const CRIT_CHANCE = 0.05;
  const CRIT_MULTIPLIER = 3;
  const SAVE_KEY = "verity_tycoon_v2";
  const OFFLINE_LIMIT = 8 * 60 * 60 * 1000;

  const $ = id => document.getElementById(id);

  const format = value => {
    value = Math.floor(Number(value) || 0);

    if (value >= 1e12) return (value / 1e12).toFixed(2) + "T";
    if (value >= 1e9) return (value / 1e9).toFixed(2) + "B";
    if (value >= 1e6) return (value / 1e6).toFixed(2) + "M";
    if (value >= 1e3) return (value / 1e3).toFixed(1) + "K";

    return value.toLocaleString("ru-RU");
  };

  const clamp = (value, min, max) =>
    Math.max(min, Math.min(max, value));

  
const characters = [
  {
    id: "verity",
    name: "Verity",
    face: "☺",
    role: "Основатель фабрики",
    income: 1,
    price: 0,
    color: "#ffd84d",
    rebirthRequired: 0
  },
  {
    id: "falsity",
    name: "Falsity",
    face: "☻",
    role: "Специалист по производству",
    income: 5,
    price: 100,
    color: "#b99aff",
    rebirthRequired: 0
  },
  {
    id: "cruelty",
    name: "Cruelty",
    face: "♠",
    role: "Ускоряет производственные линии",
    income: 25,
    price: 750,
    color: "#ff7777",
    rebirthRequired: 1
  },
  {
    id: "lovity",
    name: "Lovity",
    face: "♥",
    role: "Заботится о благополучии фабрики",
    income: 120,
    price: 5000,
    color: "#ff91c8",
    rebirthRequired: 2
  },
  {
    id: "obesity",
    name: "Obesity",
    face: "●",
    role: "Отвечает за тяжёлое производство",
    income: 600,
    price: 35000,
    color: "#8bd5a7",
    rebirthRequired: 3
  },
  {
    id: "mogity",
    name: "Mogity",
    face: "猫",
    role: "Легенда промышленности",
    income: 3000,
    price: 250000,
    color: "#83cfff",
    rebirthRequired: 5
  }
];

  const veritySkins = [
    { id: "default", name: "Классический", source: "verity", background: "#ffd84d" },
    { id: "falsity", name: "Falsity", source: "falsity", background: "linear-gradient(135deg,#b99aff,#7550c9)" },
    { id: "cruelty", name: "Cruelty", source: "cruelty", background: "linear-gradient(135deg,#ff7777,#8f263e)" },
    { id: "lovity", name: "Lovity", source: "lovity", background: "linear-gradient(135deg,#ff91c8,#b94d83)" },
    { id: "obesity", name: "Obesity", source: "obesity", background: "linear-gradient(135deg,#8bd5a7,#368b65)" },
    { id: "mogity", name: "Mogity", source: "mogity", background: "linear-gradient(135deg,#83cfff,#357db5)" },
    { id: "drip", name: "Drip Verity", source: "shop", background: "linear-gradient(135deg,#b99aff,#ff91c8)" }
  ];

  const extraUpgradeDefinitions = [
    { id: "clickBoost", icon: "👆", name: "Усиленный палец", description: "+25% к силе клика за уровень.", base: 250, growth: 1.75, max: 30 },
    { id: "factoryBoost", icon: "⚙️", name: "Оптимизация линии", description: "+15% к производству за уровень.", base: 500, growth: 1.85, max: 30 },
    { id: "staffBoost", icon: "👥", name: "Обучение сотрудников", description: "+10% к доходу сотрудников за уровень.", base: 1200, growth: 1.9, max: 25 },
    { id: "offlineBoost", icon: "🌙", name: "Ночное дежурство", description: "+1 час к лимиту офлайн-дохода за уровень.", base: 2500, growth: 2, max: 12 }
  ];


  const shopItems = [
    {
      id: "boost5",
      icon: "⚡",
      name: "Ускорение",
      description: "Увеличивает производство в 2 раза на 5 минут.",
      price: 30,
      type: "boost",
      duration: 5 * 60 * 1000
    },
    {
      id: "boost30",
      icon: "🔥",
      name: "Сверхускорение",
      description: "Увеличивает производство в 3 раза на 30 минут.",
      price: 100,
      type: "boost",
      duration: 30 * 60 * 1000,
      multiplier: 3
    },
    {
      id: "offline",
      icon: "🌙",
      name: "Ночной режим",
      description: "Увеличивает лимит офлайн-производства до 12 часов.",
      price: 75,
      type: "offline"
    },
    {
      id: "skin",
      icon: "💜",
      name: "Drip Verity",
      description: "Открывает альтернативный внешний вид Verity.",
      price: 50,
      type: "skin"
    }
  ];

  const wheelPrizes = [
    { name: "5 000 ◈", type: "money", value: 5000, weight: 30 },
    { name: "20 000 ◈", type: "money", value: 20000, weight: 20 },
    { name: "75 000 ◈", type: "money", value: 75000, weight: 8 },
    { name: "15 Gems", type: "gems", value: 15, weight: 15 },
    { name: "50 Gems", type: "gems", value: 50, weight: 5 },
    { name: "Ускорение 5 минут", type: "boost", value: 5, weight: 15 },
    { name: "1 Rebirth Token", type: "token", value: 1, weight: 7 }
  ];

  const defaultState = {
    money: 0,
    gemBalance: 0,
    starterPackClaimed: false,
    clickLevel: 1,
    beltLevel: 0,
    employees: {
      verity: 1,
      falsity: 0,
      cruelty: 0,
      lovity: 0,
      obesity: 0,
      mogity: 0
    },
    totalEarned: 0,
    rebirths: 0,
    tokens: 0,
    permanent: {
      income: 0,
      click: 0,
      offline: 0
    },
    skins: ["default"],
    activeSkin: "default",
    extraUpgrades: { clickBoost: 0, factoryBoost: 0, staffBoost: 0, offlineBoost: 0 },
    boostUntil: 0,
    boostMultiplier: 1,
    lastFreeSpin: 0,
    totalSpins: 0,
    lastSave: Date.now()
  };

  let state = loadGame();
  let currentPage = "factoryPage";
  let toastTimeout = null;
  let lastTick = Date.now();

  function loadGame() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);

      if (!raw) return structuredClone(defaultState);

      const saved = JSON.parse(raw);

      return {
        ...structuredClone(defaultState),
        ...saved,
        employees: {
          ...defaultState.employees,
          ...(saved.employees || {})
        },
        permanent: {
          ...defaultState.permanent,
          ...(saved.permanent || {})
        },
        skins: Array.isArray(saved.skins) ? [...new Set(["default", ...saved.skins])] : ["default"],
        extraUpgrades: { ...defaultState.extraUpgrades, ...(saved.extraUpgrades || {}) },
        starterPackClaimed: typeof saved.starterPackClaimed === "boolean" ? saved.starterPackClaimed : true
      };
    } catch (error) {
      console.error("Ошибка загрузки сохранения:", error);
      return structuredClone(defaultState);
    }
  }
  function showClickBoost() {
    let indicator = document.getElementById("click-boost-indicator");

    if (!indicator) {
        indicator = document.createElement("div");
        indicator.id = "click-boost-indicator";

        indicator.style.cssText = `
            position: fixed;
            top: 90px;
            right: 20px;
            z-index: 2147483647;
            padding: 12px 20px;
            border-radius: 12px;
            background: linear-gradient(135deg, #ffdb45, #ff9200);
            color: #542900;
            font: 1000 20px Arial;
            box-shadow: 0 0 20px #ffae00;
            pointer-events: none;
        `;

        document.body.appendChild(indicator);
    }

    clearInterval(boostDisplayTimer);
function toggleBackgroundMusic() {
    musicEnabled = !musicEnabled;

    const button = $("musicToggle");

    if (musicEnabled) {
        if (button) button.textContent = "♫";

        backgroundMusic.volume = 0;
        startBackgroundMusic();
    } else {
        if (button) button.textContent = "🔇";

        backgroundMusic.pause();
        backgroundMusic.currentTime = 0;
        backgroundMusic.volume = 0;
        musicStarted = false;
    }
}

    function update() {
        const remaining = Math.max(0, clickBoostUntil - Date.now());

        if (remaining <= 0) {
            indicator.remove();
            clearInterval(boostDisplayTimer);
            boostDisplayTimer = null;
            return;
        }

        indicator.textContent = `⚡ КОМБО x2 · ${(remaining / 1000).toFixed(1)}с`;
    }

    update();
    boostDisplayTimer = setInterval(update, 100);
}
  function showCriticalNotice(x, y) {
    const notice = document.createElement("div");

    notice.textContent = "CRITICAL HIT!";

    notice.style.cssText = `
        position: fixed;
        left: ${x}px;
        top: ${y - 35}px;
        transform: translate(-50%, 0) scale(0.5);
        color: #ffec70;
        font: 1000 24px Arial;
        white-space: nowrap;
        text-shadow: 0 0 8px #ffae00, 0 0 20px #ff6600;
        pointer-events: none;
        z-index: 2147483647;
    `;

    document.body.appendChild(notice);

    const start = performance.now();

    function animate(now) {
        const p = Math.min((now - start) / 850, 1);
        const ease = 1 - Math.pow(1 - p, 3);

        notice.style.transform =
            `translate(-50%, ${-55 * ease}px) scale(${0.5 + ease * 0.7})`;

        notice.style.opacity = 1 - p;

        if (p < 1) {
            requestAnimationFrame(animate);
        } else {
            notice.remove();
        }
    }

    requestAnimationFrame(animate);
}
  function saveGame() {
    state.lastSave = Date.now();

    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    } catch (error) {
      console.error("Ошибка сохранения:", error);
    }
  }

  function notify(message) {
    const toast = $("toast");
    if (!toast) return;

    toast.textContent = message;
    toast.classList.add("show");

    clearTimeout(toastTimeout);

    toastTimeout = setTimeout(() => {
      toast.classList.remove("show");
    }, 2400);
  }

  function addMoney(amount) {
    amount = Math.max(0, amount);

    state.money += amount;
    state.totalEarned += amount;
  }

  function addGems(amount) {
    state.gemBalance += amount;
  }

  function getIncomeMultiplier() {
    return (
      (1 + state.rebirths * 0.2) *
      (1 + state.permanent.income * 0.25) *
      (1 + state.beltLevel * 0.25) *
      (1 + (state.extraUpgrades.factoryBoost || 0) * 0.15) *
      (1 + (state.extraUpgrades.staffBoost || 0) * 0.10)
    );
  }

  function getProduction() {
    let base = 0;

    characters.forEach(character => {
      base += character.income *
        (state.employees[character.id] || 0);
    });

    let multiplier = getIncomeMultiplier();

    if (state.boostUntil > Date.now()) {
      multiplier *= state.boostMultiplier || 2;
    }

    return base * multiplier;
  }

  function getClickPower() {
    return Math.max(
      1,
      Math.floor(
        state.clickLevel *
        (1 + state.permanent.click) *
        (1 + state.rebirths * 0.1) *
        (1 + (state.extraUpgrades.clickBoost || 0) * 0.25)
      )
    );
  }

  function getClickCost() {
    return Math.floor(25 * Math.pow(1.65, state.clickLevel - 1));
  }

  function getBeltCost() {
    return Math.floor(50 * Math.pow(1.8, state.beltLevel));
  }

  function getCharacterPrice(character) {
    const owned = state.employees[character.id] || 0;

    return Math.floor(
      character.price * Math.pow(1.18, owned) *
      Math.pow(1.5, state.rebirths)
    );
  }

  // --------------------------------------------------
  // СОЗДАНИЕ НЕДОСТАЮЩИХ СТРАНИЦ И НАВИГАЦИИ
  // --------------------------------------------------

  function ensureInterface() {
    const app = document.querySelector(".app");
    const navigation = document.querySelector(".navigation");

    if (!app || !navigation) {
      console.error("Не найдены .app или .navigation в HTML");
      return false;
    }

    const rebirthTab = navigation.querySelector('[data-page="rebirthPage"]');
    if (rebirthTab) rebirthTab.textContent = "ПЕРЕРОЖДЕНИЕ";

    if (!$("rebirthPage")) {
      const page = document.createElement("main");
      page.id = "rebirthPage";
      page.className = "page hidden";
      page.innerHTML = `
        <section class="panel">
          <div class="section-title">Перерождение</div>
          <p class="muted">
            Начни новую жизнь фабрики, чтобы получить постоянные бонусы.
          </p>

          <div class="rebirth-stats">
            <div class="upgrade-card">
              <div class="muted">Количество перерождений</div>
              <div class="section-title" id="rebirthCount">0</div>
            </div>
            <div class="upgrade-card">
              <div class="muted">Rebirth Tokens</div>
              <div class="section-title" id="tokenBalance">0</div>
            </div>
          </div>

          <div class="upgrade-card">
            <div class="section-title">Условия перерождения</div>
            <p class="muted" id="rebirthRequirement">Нужно накопить 100 000 ◈</p>
            <div class="progress-track">
              <div id="rebirthBar" class="progress-bar"></div>
            </div>
            <p class="muted" id="rebirthProgress">0 / 100 000 ◈</p>
            <p class="muted" id="rebirthBonus"></p>
            <button type="button" class="primary-btn" id="rebirthButton">
              ПЕРЕРОДИТЬСЯ
            </button>
          </div>
        </section>

        <section class="panel" style="margin-top:20px">
          <div class="section-title">Постоянные улучшения</div>
          <p class="muted">
            Покупаются за Rebirth Tokens и сохраняются после перерождения.
          </p>
          <div id="permanentUpgrades" class="upgrades"></div>
        </section>
      `;

      app.appendChild(page);
    }

   
        if (!$("burmaldaPage")) {
        const page = document.createElement("main");
        page.id = "burmaldaPage";
        page.className = "page hidden";

        page.innerHTML = `
            <section class="panel">
            <div class="section-title">Бурмалда</div>
            <p class="muted">
                Испытай удачу и попробуй получить редкие награды.
            </p>

            
              <div class="wheel-display">
                  <div class="wheel-symbol" id="wheelSymbol">🎰</div>

                  <div class="roulette-window">
                        <div class="roulette-pointer">▼</div>
                        <div class="roulette-track" id="rouletteTrack"></div>
                    </div>

                  <div class="section-title" id="wheelResult">
                      Рулетка ждёт тебя
                  </div>

                  <div class="muted" id="wheelPrizes"></div>
              </div>


            <div class="wheel-buttons">
                <button type="button" class="primary-btn" id="freeSpinButton">
                БЕСПЛАТНОЕ ВРАЩЕНИЕ
                </button>

                <button type="button" class="secondary-btn" id="paidSpinButton">
                КРУТИТЬ ЗА 25 GEMS
                </button>
            </div>

            <p class="muted" id="spinInfo"></p>
            </section>
        `;

        app.appendChild(page);
        }


    const clicker = document.querySelector("#factoryPage .clicker");
    if (clicker && !$("skinSelector")) {
      const skinBox = document.createElement("div");
      skinBox.id = "skinSelector";
      skinBox.className = "skin-selector";
      clicker.appendChild(skinBox);
    }

    const upgradesBox = document.querySelector("#factoryPage .upgrades");
    if (upgradesBox && !$("extraUpgradesWrap")) {
      const wrap = document.createElement("div");
      wrap.id = "extraUpgradesWrap";
      wrap.className = "extra-upgrades-wrap";
      wrap.innerHTML = `<div class="section-title" style="font-size:16px;margin:14px 0 10px">Дополнительные улучшения</div><p class="muted" style="margin-bottom:10px">Прокручивай список и развивай фабрику.</p><div id="extraUpgrades" class="extra-upgrades-list"></div>`;
      upgradesBox.after(wrap);
    }

    addDynamicStyles();

    return true;
  }

  function addDynamicStyles() {
    if ($("dynamicGameStyles")) return;

    const style = document.createElement("style");
    style.id = "dynamicGameStyles";

    style.textContent = `
      .rebirth-stats {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 20px;
        margin: 18px 0;
      }

      #rebirthButton {
        margin-top: 16px;
        width: 100%;
      }

      #permanentUpgrades {
        margin-top: 16px;
      }

      .wheel-display {
        margin: 25px 0;
        text-align: center;
        padding: 25px;
        background: #242032;
        border: 1px solid #373149;
        border-radius: 15px;
      }

      .wheel-symbol {
        font-size: 75px;
        margin-bottom: 15px;
      }

      .wheel-buttons {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 20px;
      }

      .wheel-buttons button {
        min-height: 48px;
      }

      #spinInfo {
        margin-top: 16px;
        text-align: center;
      }

      .permanent-card {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        flex-wrap: wrap;
      }

      .permanent-card button {
        white-space: nowrap;
      }

      @media(max-width:600px) {
        .navigation { flex-wrap: wrap; }
        .nav-btn { min-width: 40%; }
        .wheel-buttons { grid-template-columns: 1fr; }
      }
      .skin-selector { width:100%; margin-top:18px; text-align:left; }
      .skin-selector h3 { font-size:15px; margin-bottom:10px; }
      .skin-list { display:grid; grid-template-columns:repeat(auto-fit,minmax(95px,1fr)); gap:8px; }
      .skin-option { min-width:0; padding:9px 6px; border:1px solid #403951; border-radius:10px; background:#242032; color:#eeeaf7; }
      .skin-option.active { border-color:#ffd84d; box-shadow:0 0 0 1px #ffd84d55; }
      .skin-option:disabled { opacity:.45; }
      .skin-swatch { display:block; width:28px; height:28px; border-radius:50%; margin:0 auto 6px; border:2px solid #ffffff55; }
      .skin-option strong,.skin-option small { display:block; font-size:10px; overflow-wrap:anywhere; }
      .skin-option small { color:#aaa3b8; font-size:9px; margin-top:3px; }
      .mascot.skin-falsity { background:linear-gradient(135deg,#b99aff,#7550c9); box-shadow:0 12px 45px #b99aff50; }
      .mascot.skin-cruelty { background:linear-gradient(135deg,#ff7777,#8f263e); box-shadow:0 12px 45px #ff777750; }
      .mascot.skin-lovity { background:linear-gradient(135deg,#ff91c8,#b94d83); box-shadow:0 12px 45px #ff91c850; }
      .mascot.skin-obesity { background:linear-gradient(135deg,#8bd5a7,#368b65); box-shadow:0 12px 45px #8bd5a750; }
      .mascot.skin-mogity { background:linear-gradient(135deg,#83cfff,#357db5); box-shadow:0 12px 45px #83cfff50; }
      .mascot.skin-drip { background:linear-gradient(135deg,#b99aff,#ff91c8); box-shadow:0 12px 45px #b99aff50; }
      .extra-upgrades-wrap { margin-top:14px; }
      .extra-upgrades-list { display:flex; flex-direction:column; gap:10px; max-height:380px; overflow-y:auto; padding:2px 7px 2px 0; overscroll-behavior:contain; }
      .extra-upgrade-card { background:#242032; border:1px solid #373149; border-radius:12px; padding:13px; }
      .extra-upgrade-top { display:flex; align-items:center; gap:9px; }
      .extra-upgrade-icon { font-size:22px; }
      .extra-upgrade-content { flex:1; min-width:0; }
      .extra-upgrade-content strong { display:block; font-size:13px; }
      .extra-upgrade-content small { display:block; color:#9690a6; font-size:11px; line-height:1.4; margin-top:3px; }
      .extra-upgrade-bottom { display:flex; justify-content:space-between; align-items:center; gap:10px; margin-top:11px; }
      .extra-upgrade-bottom .primary-btn { white-space:nowrap; padding:9px 11px; font-size:11px; }
      @media(max-width:520px) {
        .skin-list { grid-template-columns:repeat(3,minmax(0,1fr)); }
        .extra-upgrades-list { max-height:340px; }
        .extra-upgrade-bottom { align-items:stretch; flex-direction:column; }
        .extra-upgrade-bottom .primary-btn { width:100%; }
      }
    `;

    document.head.appendChild(style);
  }

  // --------------------------------------------------
  // НАВИГАЦИЯ
  // --------------------------------------------------

  function openPage(pageId) {
    const page = $(pageId);

    if (!page) {
      console.warn("Страница не найдена:", pageId);
      return;
    }

    document.querySelectorAll(".app .page").forEach(item => {
      item.classList.toggle("hidden", item.id !== pageId);
    });

    document.querySelectorAll(".nav-btn").forEach(button => {
      button.classList.toggle(
        "active",
        button.dataset.page === pageId
      );
    });

    currentPage = pageId;

    if (pageId === "shopPage") renderShop();
    if (pageId === "rebirthPage") renderRebirth();
    if (pageId === "burmaldaPage") renderWheel();
  }

  // --------------------------------------------------
  // ОТРИСОВКА
  // --------------------------------------------------

  function setText(id, value) {
    const element = $(id);
    if (element) element.textContent = value;
  }

  function renderTop() {
    setText("money", format(state.money));
    setText("gemBalance", format(state.gemBalance));

    setText("factoryLevel", state.clickLevel + state.beltLevel);
    setText(
      "ownedCount",
      Object.values(state.employees).reduce((a, b) => a + b, 0)
    );

    setText("tapPower", format(getClickPower()));
    setText("clickLevel", "Ур. " + state.clickLevel);
    setText("beltLevel", "Ур. " + state.beltLevel);

    setText("clickCost", format(getClickCost()) + " ◈");
    setText("beltCost", format(getBeltCost()) + " ◈");

    const buyClick = $("buyClick");
    const buyBelt = $("buyBelt");

    if (buyClick) buyClick.disabled = state.money < getClickCost();
    if (buyBelt) buyBelt.disabled = state.money < getBeltCost();

    const production = getProduction();

    setText("productionText", `Производство: ${format(production)} ◈/сек`);

    const goal = 1000 * Math.pow(2, state.rebirths);
    const progress = clamp(state.money / goal * 100, 0, 100);

    setText("goalText", `${format(state.money)} / ${format(goal)} ◈`);

    if ($("goalBar")) {
      $("goalBar").style.width = progress + "%";
    }

    const mascot = $("verity");

    
if (mascot) {
    mascot.classList.remove(
        "drip",
        "skin-falsity",
        "skin-cruelty",
        "skin-lovity",
        "skin-obesity",
        "skin-mogity",
        "skin-drip"
    );

    if (state.activeSkin !== "default") {
        mascot.classList.add("skin-" + state.activeSkin);
    }

    // Не перезаписываем содержимое 3D-контейнера!
    if (!document.getElementById("verity-3d")) {
        mascot.textContent = state.activeSkin === "default"
            ? "☺"
            : (characters.find(character => character.id === state.activeSkin)?.face || "☺");
    }

    if (window.setVeritySkin) {
    window.setVeritySkin(state.activeSkin || "default");

    if (Date.now() < clickBoostUntil && window.setVerityHappy) {
        window.setVerityHappy(true);
    }
}
}

  }


    function renderSkinSelector() {
    const container = $("skinSelector");
    if (!container) return;

    characters.forEach(character => {
      if (character.id !== "verity" && (state.employees[character.id] || 0) > 0 &&
          !state.skins.includes(character.id)) state.skins.push(character.id);
    });

    container.innerHTML = `
      <h3>Внешний вид Verity</h3>
      <div class="skin-list">
        ${veritySkins.map(skin => {
          const unlocked = skin.id === "default" || state.skins.includes(skin.id);
          const active = state.activeSkin === skin.id;
          return `<button type="button" class="skin-option ${active ? "active" : ""}"
            data-action="select-skin" data-id="${skin.id}" ${!unlocked ? "disabled" : ""}>
            <span class="skin-swatch" style="background:${skin.background}"></span>
            <strong>${skin.name}</strong>
            <small>${active ? "Выбран" : unlocked ? "Выбрать" : skin.source === "shop" ? "Магазин" : "Найми " + skin.source}</small>
          </button>`;
        }).join("")}
      </div>`;
  }

  function renderExtraUpgrades() {
    const container = $("extraUpgrades");
    if (!container) return;
    container.innerHTML = extraUpgradeDefinitions.map(upgrade => {
      const level = state.extraUpgrades[upgrade.id] || 0;
      const price = Math.floor(upgrade.base * Math.pow(upgrade.growth, level));
      const maxed = level >= upgrade.max;
      return `<div class="extra-upgrade-card">
        <div class="extra-upgrade-top">
          <span class="extra-upgrade-icon">${upgrade.icon}</span>
          <div class="extra-upgrade-content"><strong>${upgrade.name}</strong><small>${upgrade.description}</small></div>
          <span class="upgrade-level">Ур. ${level}/${upgrade.max}</span>
        </div>
        <div class="extra-upgrade-bottom">
          <span class="gem-price">${maxed ? "Максимум" : format(price) + " ◈"}</span>
          <button type="button" class="primary-btn" data-action="buy-extra-upgrade" data-id="${upgrade.id}" ${maxed || state.money < price ? "disabled" : ""}>${maxed ? "МАКСИМУМ" : "УЛУЧШИТЬ"}</button>
        </div>
      </div>`;
    }).join("");
  }

  function buyExtraUpgrade(id) {
    const upgrade = extraUpgradeDefinitions.find(item => item.id === id);
    if (!upgrade) return;
    const level = state.extraUpgrades[id] || 0;
    if (level >= upgrade.max) return notify("Достигнут максимальный уровень!");
    const price = Math.floor(upgrade.base * Math.pow(upgrade.growth, level));
    if (state.money < price) return notify("Недостаточно ресурсов!");
    state.money -= price;
    state.extraUpgrades[id] = level + 1;
    saveGame();
    renderAll();
    notify("Улучшение приобретено!");
  }

  function selectSkin(id) {
    if (!veritySkins.some(skin => skin.id === id)) return;
    if (id !== "default" && !state.skins.includes(id)) return notify("Этот скин ещё не открыт!");
    state.activeSkin = id;
    if (window.setVeritySkin) window.setVeritySkin(id);
    saveGame();
    renderAll();
    notify("Скин Verity изменён!");
  }

  function renderCharacters() {
    const container = $("characters");
    if (!container) return;

    container.innerHTML = characters.map(character => {
        const owned = state.employees[character.id] || 0;
        const price = getCharacterPrice(character);

        const unlocked = state.rebirths >= character.rebirthRequired;
        const isStarter = character.id === "verity";

        let buttonHTML = "";

        if (isStarter) {
        buttonHTML = `
            <div class="muted" style="margin-top:12px">
            Стартовый персонаж
            </div>
        `;
        } else if (!unlocked) {
        buttonHTML = `
            <button class="secondary-btn" disabled style="width:100%">
            REBIRTH ${character.rebirthRequired}
            </button>
            <div class="muted" style="margin-top:8px;text-align:center">
            Откроется после ${character.rebirthRequired} перерождений
            </div>
        `;
        } else {
        buttonHTML = `
            <button
            type="button"
            class="primary-btn"
            data-action="buy-character"
            data-id="${character.id}"
            ${state.money < price ? "disabled" : ""}
            >
            ${owned ? "НАНЯТЬ ЕЩЁ" : "НАНЯТЬ"} · ${format(price)} ◈
            </button>
        `;
        }

        return `
        <div class="character-card" style="${!unlocked ? "opacity:.65" : ""}">
            <div
            class="character-face"
            style="background:${character.color}25;color:${character.color}"
            >${character.face}</div>

            <div class="character-name">${character.name}</div>
            <div class="character-role">${character.role}</div>

            <div class="character-income">
            +${format(character.income)} ◈/сек
            </div>

            <div class="muted" style="margin-bottom:10px">
            Нанято: ${owned}
            </div>

            ${buttonHTML}
        </div>
        `;
    }).join("");
    }


  function renderShop() {
    const container = $("shopItems");
    const packs = $("gemPacks");

    if (container) {
      container.innerHTML = shopItems.map(item => {
        const owned = item.type === "skin" &&
          state.skins.includes("drip");

        return `
          <div class="shop-card">
            <div class="shop-card-icon">${item.icon}</div>
            <h3>${item.name}</h3>
            <p>${item.description}</p>

            <div class="shop-card-bottom">
              <span class="gem-price">${item.price} Gems</span>

              <button
                type="button"
                class="primary-btn"
                data-action="buy-shop"
                data-id="${item.id}"
                ${owned || state.gemBalance < item.price ? "disabled" : ""}
              >
                ${owned ? "КУПЛЕНО" : "КУПИТЬ"}
              </button>
            </div>
          </div>
        `;
      }).join("");
    }

    if (packs) {
      const gemPackages = [
        { gems: 100, bonus: "Стартовый набор", starter: true },
        { gems: 500, bonus: "Средний набор", starter: false },
        { gems: 1500, bonus: "Большой набор", starter: false }
      ];
      packs.innerHTML = gemPackages.map((pack, index) => {
        const claimed = pack.starter && state.starterPackClaimed;
        return `<div class="gem-pack">
          <h3>${format(pack.gems)} Gems</h3><p>${pack.bonus}</p>
          <button type="button" class="primary-btn" data-action="buy-gems" data-index="${index}" ${claimed ? "disabled" : ""}>
            ${claimed ? "УЖЕ ПОЛУЧЕН" : pack.starter ? "ПОЛУЧИТЬ" : "ДЕМО"}
          </button>
        </div>`;
      }).join("");
    }
  }

  // --------------------------------------------------
  // REBIRTH
  // --------------------------------------------------

  function getRebirthRequirement() {
    return Math.floor(100000 * Math.pow(4, state.rebirths));
  }

  function getRebirthReward() {
    const requirement = getRebirthRequirement();

    return Math.max(
      1,
      Math.floor(1 + Math.sqrt(state.money / requirement))
    );
  }

  function renderRebirth() {
    const requirement = getRebirthRequirement();
    const progress = clamp(state.money / requirement * 100, 0, 100);

    setText("rebirthCount", state.rebirths);
    setText("tokenBalance", format(state.tokens));

    setText(
      "rebirthRequirement",
      `Для перерождения нужно ${format(requirement)} ◈`
    );

    setText(
      "rebirthProgress",
      `${format(state.money)} / ${format(requirement)} ◈`
    );

    setText(
      "rebirthBonus",
      `Награда: ${getRebirthReward()} Rebirth Token. Каждый Rebirth увеличивает производство на 20%.`
    );

    if ($("rebirthBar")) {
      $("rebirthBar").style.width = progress + "%";
    }

    const button = $("rebirthButton");
    if (button) button.disabled = state.money < requirement;

    renderPermanentUpgrades();
  }

  function renderPermanentUpgrades() {
    const container = $("permanentUpgrades");
    if (!container) return;

    const upgrades = [
      {
        id: "income",
        name: "Эффективность фабрики",
        description: "+25% к производству за уровень.",
        base: 1,
        max: 20
      },
      {
        id: "click",
        name: "Сила клика",
        description: "+100% к силе клика за уровень.",
        base: 2,
        max: 20
      },
      {
        id: "offline",
        name: "Офлайн-производство",
        description: "+1 час к лимиту офлайн-дохода за уровень.",
        base: 2,
        max: 8
      }
    ];

    container.innerHTML = upgrades.map(upgrade => {
      const level = state.permanent[upgrade.id] || 0;
      const price = upgrade.base * Math.pow(2, level);
      const maxed = level >= upgrade.max;

      return `
        <div class="upgrade-card permanent-card">
          <div>
            <div class="upgrade-name">${upgrade.name}</div>
            <div class="muted">${upgrade.description}</div>
            <div class="upgrade-level">
              Уровень ${level} / ${upgrade.max}
            </div>
          </div>

          <button
            type="button"
            class="primary-btn"
            data-action="buy-permanent"
            data-id="${upgrade.id}"
            ${maxed || state.tokens < price ? "disabled" : ""}
          >
            ${maxed ? "МАКСИМУМ" : `УЛУЧШИТЬ · ${price} T`}
          </button>
        </div>
      `;
    }).join("");
  }

  function doRebirth() {
    const requirement = getRebirthRequirement();

    if (state.money < requirement) {
      notify("Недостаточно ресурсов!");
      return;
    }

    const reward = getRebirthReward();

    const confirmed = confirm(
      `Переродиться?\n\nТы получишь ${reward} Rebirth Token.\nДеньги, сотрудники и обычные улучшения будут сброшены.`
    );

    if (!confirmed) return;

    state.tokens += reward;
    state.rebirths += 1;

    state.money = 0;
    state.totalEarned = 0;

    state.employees = {
      verity: 1,
      falsity: 0,
      cruelty: 0,
      lovity: 0,
      obesity: 0,
      mogity: 0
    };

    state.clickLevel = 1;
    state.beltLevel = 0;
    state.extraUpgrades = { clickBoost: 0, factoryBoost: 0, staffBoost: 0, offlineBoost: 0 };
    state.boostUntil = 0;
    state.boostMultiplier = 1;

    saveGame();
    renderAll();

    notify(`Перерождение! +${reward} Token`);
  }

  function buyPermanent(id) {
    const settings = {
      income: { base: 1, max: 20 },
      click: { base: 2, max: 20 },
      offline: { base: 2, max: 8 }
    };

    const upgrade = settings[id];
    if (!upgrade) return;

    const level = state.permanent[id] || 0;

    if (level >= upgrade.max) {
      notify("Достигнут максимальный уровень!");
      return;
    }

    const price = upgrade.base * Math.pow(2, level);

    if (state.tokens < price) {
      notify("Недостаточно Rebirth Tokens!");
      return;
    }

    state.tokens -= price;
    state.permanent[id] += 1;

    saveGame();
    renderAll();

    notify("Постоянное улучшение куплено!");
  }

  // --------------------------------------------------
  // БУРМАЛДА
  // --------------------------------------------------

  function canFreeSpin() {
    if (!state.lastFreeSpin) return true;

    return Date.now() - state.lastFreeSpin >= 24 * 60 * 60 * 1000;
  }


    function renderWheel() {
    const page = $("burmaldaPage");

    // Никаких элементов рулетки вне её собственной страницы.
    if (!page || currentPage !== "burmaldaPage") return;

    const prizeText = wheelPrizes
        .map(prize => prize.name)
        .join(" • ");

    setText("wheelPrizes", "Возможные награды: " + prizeText);

    const freeButton = $("freeSpinButton");
    const paidButton = $("paidSpinButton");

    if (freeButton) {
        freeButton.disabled = !canFreeSpin();

        freeButton.textContent = canFreeSpin()
        ? "БЕСПЛАТНОЕ ВРАЩЕНИЕ"
        : "БЕСПЛАТНОЕ ВРАЩЕНИЕ НЕДОСТУПНО";
    }

    if (paidButton) {
        paidButton.disabled = state.gemBalance < 25;
    }

    setText(
        "spinInfo",
        canFreeSpin()
        ? "У тебя доступно бесплатное вращение!"
        : "Бесплатное вращение обновится через 24 часа."
    );
    }


  function choosePrize() {
    const totalWeight = wheelPrizes.reduce(
      (sum, prize) => sum + prize.weight,
      0
    );

    let random = Math.random() * totalWeight;

    for (const prize of wheelPrizes) {
      random -= prize.weight;
      if (random <= 0) return prize;
    }

    return wheelPrizes[0];
  }

  
function spinWheel(free = false) {
    if (free) {
        if (!canFreeSpin()) {
            notify("Бесплатное вращение ещё недоступно!");
            return;
        }
        state.lastFreeSpin = Date.now();
    } else {
        if (state.gemBalance < 25) {
            notify("Недостаточно Gems!");
            return;
        }
        state.gemBalance -= 25;
    }

    const prize = choosePrize();
    const rouletteStartSound = new Audio("sounds/roulette-start.mp3");
    rouletteStartSound.volume = 0.6;
    rouletteStartSound.play().catch(() => {});
    state.totalSpins += 1;

    const track = $("rouletteTrack");
    if (!track) return;

    const windowElement = track.parentElement;

    const freeButton = $("freeSpinButton");
    const paidButton = $("paidSpinButton");

    if (freeButton) freeButton.disabled = true;
    if (paidButton) paidButton.disabled = true;

    setText("wheelSymbol", "🎰");
    setText("wheelResult", "Бурмалда крутится...");
    const rouletteSpinSound = new Audio("sounds/roulette-spin.mp3");
    rouletteSpinSound.volume = 0.35;
    rouletteSpinSound.loop = true;
    rouletteSpinSound.play().catch(() => {});
        
    track.innerHTML = "";

    const cardWidth = 130;
    const gap = 20;
    const step = cardWidth + gap;

    // Создаём случайные призы для ленты
    const items = [];

    for (let i = 0; i < 60; i++)  {
        items.push(wheelPrizes[
            Math.floor(Math.random() * wheelPrizes.length)
        ]);
    }

    // Гарантированно помещаем выигрыш в конец
    items.push(prize);
    for (let i = 0; i < 15; i++) {
        items.push(wheelPrizes[
            Math.floor(Math.random() * wheelPrizes.length)
        ]);
    }
    items.forEach(item => {
    const card = document.createElement("div");
    card.className = "roulette-card";

    const icon = document.createElement("div");
    icon.className = "roulette-card-icon";
    icon.textContent = item.icon || "🎁";

    const name = document.createElement("div");
    name.className = "roulette-card-name";
    name.textContent = item.name;

    card.appendChild(icon);
    card.appendChild(name);
    track.appendChild(card);
});

  track.style.cssText = `
    display: flex !important;
    flex-direction: row !important;
    flex-wrap: nowrap !important;
    align-items: center !important;
    gap: 12px !important;
    width: max-content !important;
    height: 100% !important;
`;

windowElement.style.webkitMaskImage = `
    linear-gradient(
        to right,
        transparent 0%,
        black 12%,
        black 88%,
        transparent 100%
    )
`;

windowElement.style.maskImage = `
    linear-gradient(
        to right,
        transparent 0%,
        black 12%,
        black 88%,
        transparent 100%
    )
`;

Array.from(track.children).forEach(card => {
    card.style.cssText = `
        display: flex !important;
        flex-direction: column !important;
        flex: 0 0 130px !important;
        width: 110px !important;
        height: 90px !important;
        min-width: 130px !important;
        box-sizing: border-box !important;
        margin-top: 12px !important;
        margin-bottom: 12px !important;

        align-items: center !important;
        justify-content: center !important;
        gap: 10px !important;
        padding: 10px !important;

        background: linear-gradient(145deg, #493064, #21152f) !important;
        border: 2px solid #9666d5 !important;
        border-radius: 15px !important;
        box-shadow:
            inset 0 2px 8px rgba(255,255,255,0.08),
            0 5px 12px rgba(0,0,0,0.4) !important;

        color: white !important;
        text-align: center !important;
        overflow: hidden !important;
    `;

    const icon = card.querySelector(".roulette-card-icon");
    const name = card.querySelector(".roulette-card-name");

    if (icon) {
        icon.style.cssText = `
            font-size: 36px;
            line-height: 1;
            filter: drop-shadow(0 3px 5px rgba(0,0,0,0.5));
        `;
    }

    if (name) {
        name.style.cssText = `
            color: #f0e5ff;
            font-size: 12px;
            font-weight: 700;
            line-height: 1.3;
            text-align: center;
            width: 100%;
        `;
    }
});

        // Находим выигрышную карточку
const winningCard = track.children[60];

// Сбрасываем предыдущую позицию
track.style.transition = "none";
track.style.transform = "translateX(0px)";

// Принудительно обновляем расположение
track.offsetHeight;

// Вычисляем расстояние до центра выигрышной карточки
const windowRect = windowElement.getBoundingClientRect();
const cardRect = winningCard.getBoundingClientRect();

const windowCenter = windowRect.left + windowRect.width / 2;
const cardCenter = cardRect.left + cardRect.width / 2;

const offset = cardCenter - windowCenter;

// Звуки прохождения карточек
const rouletteTickSound = new Audio("sounds/roulette-tick.mp3");
rouletteTickSound.volume = 0.5;

// Определяем ближайшую к указателю карточку
function getNearestCardIndex() {
    const pointerX =
        windowElement.getBoundingClientRect().left +
        windowElement.getBoundingClientRect().width / 2;

    let nearestIndex = 0;
    let minDistance = Infinity;

    Array.from(track.children).forEach((card, index) => {
        const rect = card.getBoundingClientRect();
        const cardCenter = rect.left + rect.width / 2;
        const distance = Math.abs(pointerX - cardCenter);

        if (distance < minDistance) {
            minDistance = distance;
            nearestIndex = index;
        }
    });

    return nearestIndex;
}

// Звуки прохождения карточек
rouletteTickSound.volume = 0.5;

let lastTickIndex = getNearestCardIndex();
const rouletteStartTime = performance.now();

function playRouletteTick() {
    rouletteTickSound.currentTime = 0;
    rouletteTickSound.play().catch(() => {});
}

// Определяем ближайшую карточку
function getNearestCardIndex() {
    const windowRect = windowElement.getBoundingClientRect();
    const pointerX = windowRect.left + windowRect.width / 2;

    let nearestIndex = 0;
    let minDistance = Infinity;

    Array.from(track.children).forEach((card, index) => {
        const rect = card.getBoundingClientRect();
        const cardCenter = rect.left + rect.width / 2;
        const distance = Math.abs(pointerX - cardCenter);

        if (distance < minDistance) {
            minDistance = distance;
            nearestIndex = index;
        }
    });

    return nearestIndex;
}

// Первые 2 секунды — быстрые линейные щелчки
let linearTickInterval = setInterval(() => {
    if (performance.now() - rouletteStartTime < 2200) {
        playRouletteTick();
    } else {
        clearInterval(linearTickInterval);
    }
}, 100);

// Запускаем анимацию
requestAnimationFrame(() => {
    track.style.transition =
        "transform 7s cubic-bezier(0.12, 0.75, 0.12, 1)";

    track.style.transform = `translateX(${-offset}px)`;

    function checkRouletteTick() {
        const elapsed = performance.now() - rouletteStartTime;

        if (elapsed >= 2000) {
            const currentIndex = getNearestCardIndex();

            if (currentIndex !== lastTickIndex) {
                lastTickIndex = currentIndex;
                playRouletteTick();
            }
        }

        if (elapsed < 7000) {
            requestAnimationFrame(checkRouletteTick);
        }
    }

    requestAnimationFrame(checkRouletteTick);
});

console.log("Рулетка:", track.children.length, "карточек");

    const center = windowElement.clientWidth / 2;

    // Последняя карточка — выигрышная
    
    // const winningCard = track.lastElementChild;

    setTimeout(() => {
    // Останавливаем звук прокручивания
    rouletteSpinSound.pause();
    rouletteSpinSound.currentTime = 0;

    // Звук победы
    const rouletteWinSound = new Audio("sounds/roulette-win.mp3");
    rouletteWinSound.volume = 0.7;
    rouletteWinSound.play().catch(() => {});

    // Выдаём награду после завершения прокрутки
    if (prize.type === "money") addMoney(prize.value);
    if (prize.type === "gems") addGems(prize.value);
    if (prize.type === "boost") {
        state.boostUntil = Date.now() + prize.value * 60 * 1000;
        state.boostMultiplier = 2;
    }
    if (prize.type === "token") state.tokens += prize.value;

    setText("wheelSymbol", "🎉");
    setText("wheelResult", "Твоя награда: " + prize.name);

    saveGame();
    renderAll();

    notify("Бурмалда: " + prize.name);
}, 7200);
}


  // --------------------------------------------------
  // ПОКУПКИ
  // --------------------------------------------------

  function buyCharacter(id) {
    const character = characters.find(item => item.id === id);
    if (!character) return;

    const price = getCharacterPrice(character);

    if (state.money < price) {
      notify("Недостаточно ресурсов!");
      return;
    }

    state.money -= price;
    state.employees[id] = (state.employees[id] || 0) + 1;
    if (!state.skins.includes(id)) state.skins.push(id);

    saveGame();
    renderAll();

    notify(`${character.name} присоединился к фабрике!`);
  }

  function buyClickUpgrade() {
    const price = getClickCost();

    if (state.money < price) {
      notify("Недостаточно ресурсов!");
      return;
    }

    state.money -= price;
    state.clickLevel += 1;

    saveGame();
    renderAll();

    notify("Сила клика увеличена!");
  }

  function buyBeltUpgrade() {
    const price = getBeltCost();

    if (state.money < price) {
      notify("Недостаточно ресурсов!");
      return;
    }

    state.money -= price;
    state.beltLevel += 1;

    saveGame();
    renderAll();

    notify("Конвейер улучшен!");
  }

  function buyShopItem(id) {
    const item = shopItems.find(entry => entry.id === id);
    if (!item) return;

    if (state.gemBalance < item.price) {
      notify("Недостаточно Gems!");
      return;
    }

    if (item.type === "skin" && state.skins.includes("drip")) {
      notify("Этот предмет уже куплен!");
      return;
    }

    state.gemBalance -= item.price;

    if (item.type === "boost") {
      state.boostUntil = Date.now() + item.duration;
      state.boostMultiplier = item.multiplier || 2;
    }

    if (item.type === "offline") {
      state.permanent.offline = Math.max(
        state.permanent.offline,
        4
      );
    }

    if (item.type === "skin") {
      state.skins.push("drip");
      state.activeSkin = "drip";
    }

    saveGame();
    renderAll();

    notify("Покупка успешно совершена!");
  }

  function buyGemPack(index) {
    if (index === 0) {
      if (state.starterPackClaimed) return notify("Стартовый набор уже был получен!");
      state.starterPackClaimed = true;
      addGems(100);
    } else {
      // Демонстрационные пакеты; реальные платежи подключаются через SDK Яндекс Игр.
      const amount = ({ 1: 500, 2: 1500 })[index];
      if (!amount) return;
      addGems(amount);
    }
    saveGame();
    renderAll();
    notify(index === 0 ? "Стартовый набор получен один раз!" : "Демо Gems начислены.");
  }

  // --------------------------------------------------
  // СБРОС ИГРЫ
  // --------------------------------------------------

  function resetGame() {
    const confirmed = confirm(
      "Ты действительно хочешь сбросить весь прогресс? Это действие нельзя отменить."
    );

    if (!confirmed) return;

    state = structuredClone(defaultState);

    saveGame();
    renderAll();
    openPage("factoryPage");

    notify("Прогресс сброшен.");
  }

  // --------------------------------------------------
  // ОФЛАЙН-ДОХОД
  // --------------------------------------------------

  function calculateOfflineIncome() {
    const previousSave = Number(state.lastSave) || Date.now();
    const elapsed = Math.max(0, Date.now() - previousSave);

    const hours = Math.min(
      elapsed,
      OFFLINE_LIMIT + (state.permanent.offline + (state.extraUpgrades.offlineBoost || 0)) * 60 * 60 * 1000
    );

    const seconds = Math.floor(hours / 1000);

    if (seconds < 10) return;

    const income = Math.floor(getProduction() * seconds);

    if (income <= 0) return;

    addMoney(income);

    setTimeout(() => {
      notify(`Пока тебя не было, фабрика заработала ${format(income)} ◈`);
    }, 700);
  }

  // --------------------------------------------------
  // ОБЩАЯ ОТРИСОВКА И ИГРОВОЙ ЦИКЛ
  // --------------------------------------------------

  function renderAll() {
    renderTop();
    renderCharacters();
    renderSkinSelector();
    renderExtraUpgrades();
    renderShop();
    renderRebirth();
    renderWheel();
  }

  function gameTick() {
    const now = Date.now();
    const delta = Math.min((now - lastTick) / 1000, 5);

    lastTick = now;

    if (delta > 0) {
      const income = getProduction() * delta;

      if (income > 0) addMoney(income);
    }

    renderTop();

    if (currentPage === "factoryPage") {
      renderCharacters();
      renderExtraUpgrades();
    }

    if (currentPage === "rebirthPage") {
      renderRebirth();
    }

    if (currentPage === "burmaldaPage") {
      renderWheel();
    }
  }
// ===============================
// СИСТЕМА ЗВУКОВ
// ===============================

const gameSounds = {
    click: new Audio("sounds/click.mp3"),
    coin: new Audio("sounds/coin.mp3"),
    gem: new Audio("sounds/gem.mp3"),
    critical: new Audio("sounds/critical.mp3"),
    comboStart: new Audio("sounds/combo-start.mp3"),
    comboEnd: new Audio("sounds/combo-end.mp3"),
    purchase: new Audio("sounds/purchase.mp3")
};
// ===============================
// ФОНОВАЯ МУЗЫКА
// ===============================

const backgroundMusic = new Audio("sounds/background.mp3");

backgroundMusic.loop = true;
backgroundMusic.volume = 0;

// ===============================
// ОБЩЕЕ УПРАВЛЕНИЕ ЗВУКАМИ
// ===============================

let soundEnabled = true;
let musicEnabled = true;
let musicStarted = false;

const activeSounds = [];

function playSound(name, volume = 0.5) {
    if (!soundEnabled) return;

    const sound = gameSounds[name];
    if (!sound) return;

    sound.volume = volume;
    sound.currentTime = 0;
    sound.play().catch(() => {});
}

function toggleGameSounds() {
    soundEnabled = !soundEnabled;

    const button = $("soundToggle");

    if (button) {
        button.textContent = soundEnabled ? "🔊" : "🔇";
    }

    if (!soundEnabled) {
        Object.values(gameSounds).forEach(sound => {
            sound.pause();
            sound.currentTime = 0;
        });

        activeSounds.forEach(sound => {
            sound.pause();
            sound.currentTime = 0;
        });
    }
}

function startBackgroundMusic() {
    if (!musicEnabled || musicStarted) return;

    backgroundMusic.play().then(() => {
        musicStarted = true;
        backgroundMusic.volume = 0.35;
    }).catch(() => {
        musicStarted = false;
    });
}

function toggleBackgroundMusic() {
    musicEnabled = !musicEnabled;

    const button = $("musicToggle");

    if (button) {
        button.textContent = musicEnabled ? "♫" : "🔇";
    }

    if (musicEnabled) {
        startBackgroundMusic();
    } else {
        backgroundMusic.pause();
        backgroundMusic.currentTime = 0;
        musicStarted = false;
    }
}

  // --------------------------------------------------
  // ОБРАБОТЧИКИ СОБЫТИЙ
  // --------------------------------------------------

  
  function bindEvents() {
    document.addEventListener("pointerdown", event => {
    if (event.target.closest("#musicToggle")) return;

    startBackgroundMusic();
}, { once: true });
    document.addEventListener("click", event => {
      const musicButton = event.target.closest("#musicToggle");
          if (musicButton) {
              toggleBackgroundMusic();
              return;
          }

          const soundButton = event.target.closest("#soundToggle");
          if (soundButton) {
              toggleGameSounds();
              return;
          }
      const navButton = event.target.closest(".nav-btn");

      if (navButton) {
        openPage(navButton.dataset.page);
        return;
      }

      const actionButton = event.target.closest("[data-action]");

if (actionButton) {
    const action = actionButton.dataset.action;
    const id = actionButton.dataset.id;

    if (action === "select-skin") {
        selectSkin(id);
        return;
    }

    if (action === "buy-character") {
        buyCharacter(id);
        playSound("purchase", 0.6);
    }

      if (action === "buy-shop") {
          buyShopItem(id);
          playSound("purchase", 0.6);
      }

      if (action === "buy-permanent") {
          buyPermanent(id);
          playSound("purchase", 0.6);
      }

      if (action === "buy-extra-upgrade") {
          buyExtraUpgrade(id);
          playSound("purchase", 0.6);
      }

        if (action === "buy-gems") {
          buyGemPack(Number(actionButton.dataset.index));
        }

        return;
      }

      if (event.target.closest("#verity")) {
        playSound("click", 0.35);
    const now = Date.now();
    window.verityClickUntil = performance.now() + 180;

    // подсчёт комбо
    if (now - lastClickTime > COMBO_CLICK_GAP) {
        clickCombo = 1;
    } else {
        clickCombo++;
    }

    lastClickTime = now;

    // активация бонуса
    
if (clickCombo >= COMBO_REQUIRED) {
    clickBoostUntil = now + COMBO_DURATION;
    playSound("comboStart", 0.7);
    clickCombo = 0;

    showClickBoost();
    if (window.setVerityAura) {
    window.setVerityAura(true);
}
    if (window.setVerityHappy) {
        window.setVerityHappy(true);
    }

    setTimeout(() => {
        if (Date.now() >= clickBoostUntil) {
            if (window.setVerityHappy) {
                window.setVerityHappy(false);
            }
        }
        if (Date.now() >= clickBoostUntil) {
    if (window.setVerityHappy) {
        playSound("comboEnd", 0.65);
        window.setVerityHappy(false);
    }

    if (window.setVerityAura) {
        window.setVerityAura(false);
    }
}
    }, COMBO_DURATION);
}


    // проверка критического клика
    const isCritical = Math.random() < CRIT_CHANCE;

    // расчёт награды
    let multiplier = 1;

    if (isCritical) {
    multiplier *= CRIT_MULTIPLIER;
    showCriticalNotice(event.clientX, event.clientY);

    playSound("critical", 0.65);
}

    if (now < clickBoostUntil) {
        multiplier *= 2;
    }

    const amount = Math.round(getClickPower() * multiplier);

    addMoney(amount);
    showCoinEffect(amount, event.clientX, event.clientY);

    renderTop();
    saveGame();
    return;
}

      if (event.target.closest("#buyClick")) {
        buyClickUpgrade();
        return;
      }

      if (event.target.closest("#buyBelt")) {
        buyBeltUpgrade();
        return;
      }

      if (event.target.closest("#reset")) {
        resetGame();
        return;
      }

      if (event.target.closest("#rebirthButton")) {
        doRebirth();
        return;
      }

      if (event.target.closest("#freeSpinButton")) {
        spinWheel(true);
        return;
      }

      if (event.target.closest("#paidSpinButton")) {
        spinWheel(false);
      }
      
    });
// Оформление кнопок музыки и звуков
function styleAudioButtons() {
    const controls = document.querySelector(".audio-controls");
    const buttons = document.querySelectorAll(".audio-btn");

    if (controls) {
        controls.style.cssText = `
            display: flex;
            align-items: center;
            gap: 8px;
            margin-left: 12px;
        `;
    }

    buttons.forEach(button => {
        button.style.cssText = `
            display: flex;
            align-items: center;
            justify-content: center;
            width: 38px;
            height: 38px;
            padding: 0;
            border: 1px solid #9666d5;
            border-radius: 10px;
            background: linear-gradient(145deg, #493064, #21152f);
            color: #f0e5ff;
            font-size: 20px;
            cursor: pointer;
            transition: 0.2s;
        `;

        button.onmouseenter = () => {
            button.style.background =
                "linear-gradient(145deg, #68418a, #352044)";
            button.style.transform = "translateY(-2px)";
        };

        button.onmouseleave = () => {
            button.style.background =
                "linear-gradient(145deg, #493064, #21152f)";
            button.style.transform = "translateY(0)";
        };

        button.onmousedown = () => {
            button.style.transform = "scale(0.94)";
        };

        button.onmouseup = () => {
            button.style.transform = "translateY(-2px)";
        };
    });
}

styleAudioButtons();
    window.addEventListener("beforeunload", saveGame);
  }

  // --------------------------------------------------
  // ЗАПУСК
  // --------------------------------------------------


function init() {
    if (!ensureInterface()) return;

    calculateOfflineIncome();

    bindEvents();
    renderAll();
    openPage("factoryPage");

    lastTick = Date.now();

    // Загружаем сохранённый скин в 3D-модель
    if (window.setVeritySkin) {
        window.setVeritySkin(state.activeSkin || "default");
    }

    setInterval(gameTick, 1000);
    setInterval(saveGame, 10000);

    saveGame();

    console.log("Verity Tycoon запущен. Все страницы подключены.");
}


  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
  



function showCoinEffect(amount, x, y) {
    const container = document.createElement("div");

    const drift = (Math.random() - 0.5) * 100;
    const rotation = (Math.random() - 0.5) * 20;
    const duration = 1400;
    const start = performance.now();

    container.style.cssText = `
        position: fixed;
        left: ${x}px;
        top: ${y}px;
        z-index: 2147483647;
        pointer-events: none;
    `;

    // Основная надпись
    const effect = document.createElement("div");
    effect.textContent = `+${Number(amount).toLocaleString("ru-RU")}`;

    effect.style.cssText = `
        position: absolute;
        left: 0;
        top: 0;
        white-space: nowrap;
        font-family: Arial, sans-serif;
        font-size: 29px;
        font-weight: 1000;
        color: #fff0a0;
        text-shadow:
            0 2px 2px #754000,
            0 0 5px #ffb900,
            0 0 12px #ffcc33,
            0 0 24px #ff9900;
        transform: translate(-50%, 0);
    `;

    container.appendChild(effect);

    // Искры и маленькие монетки
    const particles = [];

    for (let i = 0; i < 9; i++) {
        const particle = document.createElement("div");
        const angle = Math.random() * Math.PI * 2;
        const distance = 30 + Math.random() * 65;
        const isCoin = i % 3 === 0;

        particle.style.cssText = `
            position: absolute;
            left: 0;
            top: 0;
            width: ${isCoin ? 7 : 4}px;
            height: ${isCoin ? 7 : 4}px;
            border-radius: ${isCoin ? "50%" : "2px"};
            background: ${isCoin ? "#ffbd24" : "#fff1a0"};
            box-shadow: 0 0 8px #ffb900;
        `;

        container.appendChild(particle);

        particles.push({
            element: particle,
            dx: Math.cos(angle) * distance,
            dy: Math.sin(angle) * distance,
            spin: Math.random() * 360
        });
    }

    document.body.appendChild(container);

    function animate(now) {
        const progress = Math.min((now - start) / duration, 1);
        const ease = 1 - Math.pow(1 - progress, 3);

        const moveX = drift * ease;
        const moveY = -110 * ease;

        const scale = progress < 0.15
            ? 0.5 + (progress / 0.15) * 0.8
            : 1.3 - (progress - 0.15) * 0.35;

        const opacity = progress < 0.15
            ? progress / 0.15
            : 1 - Math.pow((progress - 0.15) / 0.85, 2);

        effect.style.transform = `
            translate(calc(-50% + ${moveX}px), ${moveY}px)
            scale(${scale})
            rotate(${rotation * ease}deg)
        `;

        effect.style.opacity = opacity;

        particles.forEach(p => {
            p.element.style.transform = `
                translate(
                    ${p.dx * ease}px,
                    ${p.dy * ease - progress * 20}px
                )
                rotate(${p.spin * progress}deg)
            `;

            p.element.style.opacity = 1 - progress;
        });

        if (progress < 1) {
            requestAnimationFrame(animate);
        } else {
            container.remove();
        }
    }

    requestAnimationFrame(animate);
}


})();