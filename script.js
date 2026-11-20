(() => {
  "use strict";
 // ===== YANDEX GAMES SDK =====

let ysdk = null;
let yandexSDKReady = false;
let payments = null;
let gemCatalog = [];
let player = null;
let rewardedAdActive = false;
let cloudSaveAvailable = false;
let cloudSaveQueue = Promise.resolve();
let clickSaveTimer = null;
let renderedActiveSkin = null;
async function saveCloudState(flush = false) {
  if (!player || !cloudSaveAvailable) {
    throw new Error("Облачное сохранение недоступно");
  }

  // Сериализуем записи, чтобы сохранения не перезаписывали друг друга.
  const saveTask = cloudSaveQueue.then(async () => {
    await player.setData(
      { gameSave: state },
      flush
    );
  });

  // Ошибка одной записи не должна навсегда блокировать очередь.
  cloudSaveQueue = saveTask.catch(error => {
    console.error("Ошибка очереди облачных сохранений:", error);
  });

  await saveTask;
}
async function loadCloudSave() {
  if (!player) return;

  try {
    const cloudData = await player.getData(["gameSave"]);
    const cloudState = cloudData.gameSave;

    if (!cloudState) {
      // Облачного сохранения ещё нет.
      // Загружаем туда текущее локальное.
      await player.setData(
        { gameSave: state },
        true
      );

      console.log("Создано первое облачное сохранение.");
      cloudSaveAvailable = true;
      return;
    }

    const localTime = Number(state.lastSave) || 0;
    const cloudTime = Number(cloudState.lastSave) || 0;

    if (cloudTime > localTime) {
      // Облако новее локального сохранения.
      state = {
        ...state,
        ...cloudState,

        employees: {
          ...state.employees,
          ...(cloudState.employees || {})
        },

        permanent: {
          ...state.permanent,
          ...(cloudState.permanent || {})
        },

        extraUpgrades: {
          ...state.extraUpgrades,
          ...(cloudState.extraUpgrades || {})
        },

        skins: Array.isArray(cloudState.skins)
          ? [...new Set(["default", ...cloudState.skins])]
          : ["default"],

        processedPurchases: Array.isArray(cloudState.processedPurchases)
          ? cloudState.processedPurchases
          : []
      };

      console.log("Загружено более новое облачное сохранение.");
    } else {
      // Локальное сохранение новее или равно облачному.
      await player.setData(
        { gameSave: state },
        true
      );

      console.log("Локальное сохранение синхронизировано с облаком.");
    }

    cloudSaveAvailable = true;

  } catch (error) {
    console.error("Ошибка загрузки облачного сохранения:", error);
    cloudSaveAvailable = false;
  }
}


async function initYandexSDK() {
  if (!window.YaGames) {
    console.warn("Yandex Games SDK не найден. Работаем в обычном режиме.");
    return;
  }

  try {
    ysdk = await YaGames.init();

    window.ysdk = ysdk;
    yandexSDKReady = true;
    // Получаем объект игрока Яндекса.
    player = await ysdk.getPlayer();

    // Загружаем облачное сохранение до запуска игры.
    await loadCloudSave();
    console.log("Yandex Games SDK успешно подключён!");

    try {
      payments = await ysdk.getPayments();

      console.log("Платежи Яндекс Игр подключены!");

      gemCatalog = await payments.getCatalog();

      console.log("Каталог покупок:", gemCatalog);

      renderAll();

      await restoreGemPurchases();

    } catch (paymentError) {
      console.error("Ошибка подключения платежей:", paymentError);
      notify("Магазин временно недоступен.");
    }

  } catch (error) {
    console.error("Ошибка инициализации Yandex SDK:", error);
  }
}
const yandexSDKPromise = initYandexSDK();
// ===== END YANDEX GAMES SDK =====
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
    name: "Верити",
    face: "☺",
    role: "Основатель фабрики",
    income: 1,
    price: 0,
    color: "#ffd84d",
    rebirthRequired: 0
  },
  {
    id: "falsity",
    name: "Фолсити",
    face: "☺",
    role: "Специалист по производству",
    income: 5,
    price: 100,
    color: "#b99aff",
    rebirthRequired: 0
  },
  {
    id: "cruelty",
    name: "Круэлти",
    face: "☺",
    role: "Ускоряет производственные линии",
    income: 25,
    price: 750,
    color: "#ff7777",
    rebirthRequired: 1
  },
  {
    id: "lovity",
    name: "Ловити",
    face: "☺",
    role: "Заботится о благополучии фабрики",
    income: 120,
    price: 5000,
    color: "#ff91c8",
    rebirthRequired: 2
  },
  {
    id: "obesity",
    name: "Обесити",
    face: "☺",
    role: "Отвечает за тяжёлое производство",
    income: 600,
    price: 35000,
    color: "#8bd5a7",
    rebirthRequired: 3
  },
  {
    id: "mogity",
    name: "Могсити",
    face: "☺",
    role: "Легенда промышленности",
    income: 3000,
    price: 250000,
    color: "#83cfff",
    rebirthRequired: 5
  }
];

  const veritySkins = [
    { id: "default", name: "Классический", source: "verity", background: "#ffd84d" },
    { id: "falsity", name: "Фолсити", source: "Фолсити", background: "linear-gradient(135deg,#b99aff,#7550c9)" },
    { id: "cruelty", name: "Круэлти", source: "Круэлти", background: "linear-gradient(135deg,#ff7777,#8f263e)" },
    { id: "lovity", name: "Ловити", source: "Ловити", background: "linear-gradient(135deg,#ff91c8,#b94d83)" },
    { id: "obesity", name: "Ларпити", source: "Ларпити", background: "linear-gradient(135deg,#7cff36,#20c900)" },
    { id: "mogity", name: "Могити", source: "Могити", background: "linear-gradient(135deg,#83cfff,#357db5)" },
    { id: "drip", name: "Дрип Верити", source: "остальных. Дрип Верити есть в магазине", background: "linear-gradient(135deg,#b99aff,#ff91c8)" }
  ];

  const extraUpgradeDefinitions = [
    {
        id: "clickBoost",
        icon: "👆",
        name: "Усиленный палец",
        description: "+20% к силе клика за уровень.",
        base: 500,
        growth: 1.8,
        max: 20
    },
    {
        id: "factoryBoost",
        icon: "⚙️",
        name: "Оптимизация линии",
        description: "+10% к производству за уровень.",
        base: 1000,
        growth: 1.9,
        max: 20
    },
    {
        id: "staffBoost",
        icon: "👥",
        name: "Обучение сотрудников",
        description: "+8% к доходу за уровень.",
        base: 2000,
        growth: 1.95,
        max: 20
    },
    {
        id: "offlineBoost",
        icon: "🌙",
        name: "Ночное дежурство",
        description: "+1 час к лимиту офлайн-дохода за уровень.",
        base: 3000,
        growth: 2,
        max: 8
    }
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
    {
        name: "500 ◈",
        type: "money",
        value: 500,
        weight: 30,
        image: "images/roulette/money-small.png"
    },
    {
        name: "2 500 ◈",
        type: "money",
        value: 2500,
        weight: 20,
        image: "images/roulette/money-medium.png"
    },
    {
        name: "10 000 ◈",
        type: "money",
        value: 10000,
        weight: 5,
        image: "images/roulette/money-large.png"
    },
    {
        name: "10 Гемов",
        type: "gems",
        value: 10,
        weight: 20,
        image: "images/roulette/gems-small.png"
    },
    {
        name: "30 Гемов",
        type: "gems",
        value: 30,
        weight: 8,
        image: "images/roulette/gems-large.png"
    },
    {
        name: "Ускорение 5 минут",
        type: "boost",
        value: 5,
        weight: 15,
        image: "images/roulette/boost.png"
    },
    {
        name: "1 Токен перерождения",
        type: "token",
        value: 1,
        weight: 2,
        image: "images/roulette/token.png"
    }
];


  const defaultState = {
    processedPurchases: [],
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
      skins: Array.isArray(saved.skins)
        ? [...new Set(["default", ...saved.skins])]
        : ["default"],
      extraUpgrades: {
        ...defaultState.extraUpgrades,
        ...(saved.extraUpgrades || {})
      },
      starterPackClaimed:
        typeof saved.starterPackClaimed === "boolean"
          ? saved.starterPackClaimed
          : true,

      // Защита от повторного начисления покупок.
      processedPurchases: Array.isArray(saved.processedPurchases)
        ? saved.processedPurchases
        : []
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
    console.error("Ошибка локального сохранения:", error);
    return;
  }

  // Обычное облачное сохранение без принудительного ожидания записи.
  if (player && cloudSaveAvailable) {
    saveCloudState(false).catch(error => {
      console.error("Не удалось сохранить прогресс в облаке:", error);
    });
  }
}

  // Клики не должны синхронно сериализовать всё состояние и писать его
  // в localStorage. Сохраняем после короткой паузы; периодическое и важное
  // сохранение через saveGame() остаётся без изменений.
  function scheduleClickSave() {
    if (clickSaveTimer !== null) clearTimeout(clickSaveTimer);
    clickSaveTimer = setTimeout(() => {
      clickSaveTimer = null;
      try {
        state.lastSave = Date.now();
        localStorage.setItem(SAVE_KEY, JSON.stringify(state));
      } catch (error) {
        console.error("Ошибка отложенного локального сохранения:", error);
      }
    }, 500);
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
        (1 + state.rebirths * 0.15) *
        (1 + state.permanent.income * 0.20) *
        (1 + state.beltLevel * 0.12) *
        (1 + (state.extraUpgrades.factoryBoost || 0) * 0.10) *
        (1 + (state.extraUpgrades.staffBoost || 0) * 0.08)
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
    return Math.floor(40 * Math.pow(1.55, state.clickLevel - 1));
}

function getBeltCost() {
    return Math.floor(150 * Math.pow(1.7, state.beltLevel));
}

  function getCharacterPrice(character) {
    const owned = state.employees[character.id] || 0;

    return Math.floor(
        character.price *
        Math.pow(1.30, owned) *
        Math.pow(1.45, state.rebirths)
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
              <div class="muted">Токены перерождения</div>
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
            Покупаются за Токены перерождения и сохраняются после перерождения.
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
                КРУТИТЬ ЗА 25 ГЕМОВ
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
    if (element && element.textContent !== String(value)) {
      element.textContent = value;
    }
  }

  // Пересобирает DOM только если разметка реально изменилась: раз в секунду
  // игра перерисовывала все списки целиком, даже когда ничего не поменялось.
  function setHTML(element, html) {
    if (element.__lastHTML === html) return;
    element.__lastHTML = html;
    element.innerHTML = html;
  }

  // Лёгкое обновление интерфейса после клика: не трогаем скины,
  // 3D-текстуры и остальные элементы, которые не меняются от нажатия.
  function renderClickHud() {
    setText("money", format(state.money));

    const goal = getRebirthRequirement();
    const progress = clamp(state.money / goal * 100, 0, 100);
    setText("goalText", `${format(state.money)} / ${format(goal)} ◈`);

    const goalBar = $("goalBar");
    if (goalBar) goalBar.style.width = progress + "%";

    const buyClick = $("buyClick");
    const buyBelt = $("buyBelt");
    if (buyClick) buyClick.disabled = state.money < getClickCost();
    if (buyBelt) buyBelt.disabled = state.money < getBeltCost();
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

    const goal = getRebirthRequirement();
      const progress = clamp(state.money / goal * 100, 0, 100);

      setText("goalText", `${format(state.money)} / ${format(goal)} ◈`);

      if ($("goalBar")) {
        $("goalBar").style.width = progress + "%";
      }

    const mascot = $("verity");

    
if (mascot) {
    if (mascot.__skinClass !== state.activeSkin) {
    mascot.__skinClass = state.activeSkin;
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
}

    // Не перезаписываем содержимое 3D-контейнера!
    const verityMount = document.getElementById("verity-3d");

      if (!verityMount && mascot) {
          console.warn("Контейнер 3D Верити не найден. Текстовый fallback отключён.");
      }

    if (window.setVeritySkin) {
    const activeSkin = state.activeSkin || "default";
    if (renderedActiveSkin !== activeSkin) {
        renderedActiveSkin = activeSkin;
        window.setVeritySkin(activeSkin);
    }

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
    setHTML(container, extraUpgradeDefinitions.map(upgrade => {
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
    }).join(""));
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

    setHTML(container, characters.map(character => {
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
            ПЕРЕРОЖДЕНИЕ ${character.rebirthRequired}
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
    }).join(""));
    }

    const GEM_PRODUCTS = {
      gems_250: 250,
      gems_600: 600,
      gems_1500: 1500,
      gems_3500: 3500
    };

    const GEM_PACKAGE_IDS = {
      1: "gems_250",
      2: "gems_600",
      3: "gems_1500",
      4: "gems_3500"
    };

  
function renderShop() {
  const container = $("shopItems");
  const packs = $("gemPacks");

  if (container) {
    setHTML(container, shopItems.map(item => {
      const owned = item.type === "skin" &&
        state.skins.includes("drip");

      return `
        <div class="shop-card">
          <div class="shop-card-icon">${item.icon}</div>
          <h3>${item.name}</h3>
          <p>${item.description}</p>

          <div class="shop-card-bottom">
            <span class="gem-price">${item.price} ГЕМОВ</span>

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
    }).join(""));
  }

  if (packs) {
    const gemPackages = [
      { gems: 100, bonus: "Стартовый набор", starter: true },
      { gems: 250, bonus: "Маленький набор", price: 49 },
      { gems: 600, bonus: "Средний набор", price: 99 },
      { gems: 1500, bonus: "Большой набор", price: 199 },
      { gems: 3500, bonus: "Огромный набор", price: 399 }
    ];

    packs.innerHTML = gemPackages.map((pack, index) => {
      const claimed = pack.starter && state.starterPackClaimed;

      const productId = GEM_PACKAGE_IDS[index];

      const catalogProduct = productId
        ? gemCatalog.find(item => item.id === productId)
        : null;

      const displayPrice = catalogProduct
        ? catalogProduct.price
        : `${pack.price} ₽`;

      return `
        <div class="gem-pack">
          <h3>${format(pack.gems)} ГЕМОВ</h3>
          <p>${pack.bonus}</p>

          <button
            type="button"
            class="primary-btn"
            data-action="buy-gems"
            data-index="${index}"
            ${claimed ? "disabled" : ""}
          >
            ${
              claimed
                ? "УЖЕ ПОЛУЧЕН"
                : pack.starter
                  ? "ПОЛУЧИТЬ"
                  : displayPrice
            }
          </button>
        </div>
      `;
    }).join("");

    packs.innerHTML += `
      <div class="gem-pack ad-gem-pack">
        <h3>+20 ГЕМОВ</h3>
        <p>Награда за просмотр рекламы</p>
        <button
          type="button"
          class="primary-btn"
          data-action="watch-gem-ad"
        >
          СМОТРЕТЬ РЕКЛАМУ
        </button>
      </div>
    `;
  }
}


  // --------------------------------------------------
  // REBIRTH
  // --------------------------------------------------

  function getRebirthRequirement() {
    return Math.floor(250000 * Math.pow(3.5, state.rebirths));
}

function getRebirthReward() {
    const requirement = getRebirthRequirement();

    return Math.max(
        1,
        Math.floor(Math.sqrt(state.money / requirement))
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
      `Награда: ${getRebirthReward()} Токенов перерождения. Каждое перерождение увеличивает производство на 20%.`
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

    setHTML(container, upgrades.map(upgrade => {
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
    }).join(""));
  }

  
function doRebirth() {
    const requirement = getRebirthRequirement();

    if (state.money < requirement) {
        notify("Недостаточно ресурсов!");
        return;
    }

    const reward = getRebirthReward();

    confirmAction(
        "Перерождение",
        `Ты получишь ${reward} Токенов перерождения. Деньги, сотрудники и обычные улучшения будут сброшены. Продолжить?`,
        () => {
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

            state.extraUpgrades = {
                clickBoost: 0,
                factoryBoost: 0,
                staffBoost: 0,
                offlineBoost: 0
            };

            state.boostUntil = 0;
            state.boostMultiplier = 1;

            saveGame();
            renderAll();

            notify(`Перерождение! +${reward} Token`);
        }
    );
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
      notify("Недостаточно Токенов перерождения!");
      return;
    }

    state.tokens -= price;
    state.permanent[id] += 1;

    saveGame();
    renderAll();

    notify("Постоянное улучшение куплено!");
  }

  // --------------------------------------------------
  // РУЛЕТКА
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
    renderRouletteWheel();
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

  
function showRouletteWinEffects() {
    const track = $("rouletteTrack");
    if (!track) return;

    const windowElement = track.parentElement;
    if (!windowElement) return;

    // Контейнер эффектов
    const overlay = document.createElement("div");

    overlay.style.cssText = `
        position: absolute !important;
        inset: 0 !important;
        z-index: 30 !important;
        overflow: hidden !important;
        border-radius: 50% !important;
        pointer-events: none !important;
    `;

    windowElement.appendChild(overlay);

    // Золотая вспышка
    const flash = document.createElement("div");

    flash.style.cssText = `
        position: absolute !important;
        inset: 0 !important;
        border-radius: 50% !important;
        background: radial-gradient(
            circle,
            rgba(255, 238, 170, 0.75) 0%,
            rgba(255, 190, 70, 0.25) 35%,
            transparent 72%
        ) !important;
        opacity: 0 !important;
    `;

    overlay.appendChild(flash);

    flash.animate(
        [
            { opacity: 0 },
            { opacity: 1, offset: 0.25 },
            { opacity: 0 }
        ],
        {
            duration: 1100,
            easing: "ease-out"
        }
    );

    // Конфетти
    const confettiColors = [
        "#ffe08a",
        "#ffffff",
        "#c084fc",
        "#facc15",
        "#fb7185",
        "#67e8f9"
    ];

    for (let i = 0; i < 55; i++) {
        const piece = document.createElement("div");

        const size = 5 + Math.random() * 8;
        const startX = 50 + (Math.random() - 0.5) * 55;
        const startY = 45 + (Math.random() - 0.5) * 30;

        piece.style.cssText = `
            position: absolute !important;
            left: ${startX}% !important;
            top: ${startY}% !important;
            width: ${size}px !important;
            height: ${size * (1 + Math.random())}px !important;
            border-radius: ${Math.random() > 0.5 ? "50%" : "2px"} !important;
            background: ${confettiColors[
                Math.floor(Math.random() * confettiColors.length)
            ]} !important;
            box-shadow: 0 0 7px rgba(255, 220, 130, 0.7) !important;
        `;

        overlay.appendChild(piece);

        const driftX = (Math.random() - 0.5) * 380;
        const fallY = 180 + Math.random() * 350;
        const rotation = Math.random() * 1000 - 500;

        piece.animate(
            [
                {
                    transform: "translate(0, 0) rotate(0deg) scale(0.5)",
                    opacity: 0
                },
                {
                    transform: `translate(${driftX * 0.25}px, -35px) rotate(${rotation * 0.3}deg) scale(1)`,
                    opacity: 1,
                    offset: 0.2
                },
                {
                    transform: `translate(${driftX}px, ${fallY}px) rotate(${rotation}deg) scale(0.7)`,
                    opacity: 0
                }
            ],
            {
                duration: 1300 + Math.random() * 900,
                easing: "cubic-bezier(0.15, 0.7, 0.3, 1)",
                fill: "forwards"
            }
        );
    }

    // Золотое свечение по краю
    const glow = document.createElement("div");

    glow.style.cssText = `
        position: absolute !important;
        inset: 7px !important;
        border: 5px solid #ffe08a !important;
        border-radius: 50% !important;
        box-shadow:
            0 0 15px #ffd66b,
            0 0 35px rgba(255, 190, 60, 0.9),
            inset 0 0 25px rgba(255, 220, 120, 0.55) !important;
        opacity: 0 !important;
    `;

    overlay.appendChild(glow);

    glow.animate(
        [
            { opacity: 0, transform: "scale(0.96)" },
            { opacity: 1, transform: "scale(1)" },
            { opacity: 0, transform: "scale(1.04)" }
        ],
        {
            duration: 1500,
            easing: "ease-out"
        }
    );

    // Убираем эффекты после анимации
    setTimeout(() => {
        overlay.remove();
    }, 2400);
}

function renderRouletteWheel() {
    const track = $("rouletteTrack");
    if (!track) return;

    // Если колесо уже создано, повторно не строим
    if (track.dataset.initialized === "true") return;

    const sectorCount = 16;
    const sectorSize = 360 / sectorCount;

    const wheelSize = Math.min(650, window.innerWidth * 0.92);
    const windowElement = track.parentElement;

    track.innerHTML = "";

    windowElement.style.cssText = `
        position: relative !important;
        display: block !important;
        width: ${wheelSize}px !important;
        height: ${wheelSize}px !important;
        min-width: 0 !important;
        max-width: 92vw !important;
        margin: 35px auto 25px !important;
        padding: 8px !important;
        overflow: hidden !important;
        border: 5px solid #d9ad65 !important;
        border-radius: 50% !important;
        box-sizing: border-box !important;
        background: radial-gradient(circle, #49305f, #170e25) !important;
        box-shadow:
            0 0 0 4px #38234e,
            0 0 0 7px #b98745,
            0 0 28px rgba(170, 100, 255, 0.45),
            inset 0 0 22px rgba(0, 0, 0, 0.8) !important;
    `;

    track.style.cssText = `
        position: absolute !important;
        display: block !important;
        left: 0 !important;
        top: 0 !important;
        width: 100% !important;
        height: 100% !important;
        padding: 0 !important;
        margin: 0 !important;
        border-radius: 50% !important;
        box-sizing: border-box !important;
        overflow: hidden !important;
        transform-origin: center center !important;
        transform: rotate(0deg) !important;
        transition: none !important;
    `;

    const items = [];

    for (let i = 0; i < sectorCount; i++) {
        items.push(
            wheelPrizes[Math.floor(Math.random() * wheelPrizes.length)]
        );
    }

    const colors = [
        "#493064",
        "#302044",
        "#62408a",
        "#39254f"
    ];

    const gradient = items.map((item, index) => {
        const start = index * sectorSize;
        const end = (index + 1) * sectorSize;
        return `${colors[index % colors.length]} ${start}deg ${end}deg`;
    }).join(", ");

    track.style.background = `
        repeating-conic-gradient(
            from 0deg,
            transparent 0deg ${sectorSize - 0.7}deg,
            rgba(255, 226, 170, 0.8) ${sectorSize - 0.7}deg ${sectorSize}deg
        ),
        conic-gradient(from 0deg, ${gradient})
    `;

    track.style.boxShadow = `
        inset 0 0 0 3px rgba(255, 220, 160, 0.45),
        inset 0 0 35px rgba(0, 0, 0, 0.45)
    `;

    const radius = (wheelSize - 10) * 0.34;

    items.forEach((item, index) => {
        const card = document.createElement("div");
const angle = index * sectorSize + sectorSize / 2;

card.style.cssText = `
    position: absolute !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    left: 50% !important;
    top: 50% !important;
    width: 76px !important;
    height: 88px !important;
    padding: 0 !important;
    margin: 0 !important;
    border-radius: 12px !important;
    
    box-sizing: border-box !important;
    overflow: hidden !important;
    background-clip: padding-box !important;
    transform:
        translate(-50%, -50%)
        rotate(${angle}deg)
        translateY(-${radius}px)
        rotate(${-angle}deg) !important;
`;

const content = document.createElement("div");
content.className = "roulette-card-content";

content.style.cssText = `
    width: 100% !important;
    height: 100% !important;
    display: flex !important;
    flex-direction: column !important;
    align-items: center !important;
    justify-content: center !important;
    gap: 5px !important;
    padding: 5px !important;
    box-sizing: border-box !important;
    transform: rotate(0deg);
    transform-origin: center center !important;
`;

const icon = document.createElement("img");
icon.src = item.image;
icon.alt = item.name;

icon.style.cssText = `
    width: 43px !important;
    height: 43px !important;
    object-fit: contain !important;
    flex-shrink: 0 !important;
    background: transparent !important;
    border: none !important;
    box-shadow: none !important;
    filter: drop-shadow(0 3px 5px rgba(0, 0, 0, 0.65)) !important;
`;

const name = document.createElement("div");
name.className = "roulette-prize-name";
name.textContent = item.name;

name.style.cssText = `
    width: 100% !important;
    color: #fff4dc !important;
    font-size: 10px !important;
    font-weight: 900 !important;
    line-height: 1.15 !important;
    text-align: center !important;
    overflow-wrap: anywhere !important;
    background: transparent !important;
    border: none !important;
    box-shadow: none !important;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.9) !important;
`;

content.appendChild(icon);
content.appendChild(name);
card.appendChild(content);
track.appendChild(card);
    });

    const hub = document.createElement("div");

    hub.style.cssText = `
        position: absolute !important;
        left: 50% !important;
        top: 50% !important;
        width: ${wheelSize * 0.17}px !important;
        height: ${wheelSize * 0.17}px !important;
        transform: translate(-50%, -50%) !important;
        border-radius: 50% !important;
        z-index: 15 !important;
        pointer-events: none !important;
        background: radial-gradient(circle at 35% 30%,
            #fff1bd 0%, #e9bd6d 25%, #a96c2f 65%, #573019 100%
        ) !important;
        border: 4px solid #ffe3a1 !important;
        box-shadow:
            0 0 0 4px #58356e,
            0 0 0 7px #d5a45c,
            0 5px 15px rgba(0, 0, 0, 0.6),
            inset 0 2px 5px rgba(255, 255, 255, 0.6) !important;
    `;

    const hubDot = document.createElement("div");
    hubDot.style.cssText = `
        position: absolute !important;
        width: 28% !important;
        height: 28% !important;
        left: 50% !important;
        top: 50% !important;
        transform: translate(-50%, -50%) !important;
        border-radius: 50% !important;
        background: radial-gradient(circle at 35% 30%, #fff8d8, #d49a4d) !important;
    `;

    hub.appendChild(hubDot);
    windowElement.appendChild(hub);

    const pointer = windowElement.querySelector(".roulette-pointer");

    if (pointer) {
        pointer.style.cssText = `
            position: absolute !important;
            top: -3px !important;
            left: 50% !important;
            transform: translateX(-50%) !important;
            z-index: 25 !important;
            font-size: 38px !important;
            line-height: 1 !important;
            color: #ffe08a !important;
            -webkit-text-stroke: 1px #8a5526 !important;
            filter: drop-shadow(0 3px 4px rgba(0, 0, 0, 0.8)) !important;
            pointer-events: none !important;
        `;
    }

    track.dataset.initialized = "true";
}

function spinWheel(free = false) {
    const track = $("rouletteTrack");
    if (!track) return;

    if (free) {
        if (!canFreeSpin()) {
            notify("Бесплатное вращение ещё недоступно!");
            return;
        }
    } else {
        if (state.gemBalance < 25) {
            notify("Недостаточно гемов!");
            return;
        }
    }

    const freeButton = $("freeSpinButton");
    const paidButton = $("paidSpinButton");

    if (freeButton) freeButton.disabled = true;
    if (paidButton) paidButton.disabled = true;

    // Оплачиваем вращение
    if (free) {
        state.lastFreeSpin = Date.now();
    } else {
        state.gemBalance -= 25;
    }

    const prize = choosePrize();

    playSound("rouletteStart", 0.6);

    // Отдельного файла roulette-spin.mp3 в проекте нет, поэтому
    // не запускаем отсутствующий аудиоресурс.

    state.totalSpins += 1;

    setText("wheelSymbol", "🎰");
    setText("wheelResult", "Бурмалда крутится...");

//     // Подготавливаем статичное колесо
renderRouletteWheel();

// Настройки
const sectorCount = 16;
const sectorSize = 360 / sectorCount;
const winningIndex = 8;

const winningAngle =
    winningIndex * sectorSize + sectorSize / 2;

const fullRotations = 6;

const finalRotation =
    fullRotations * 360 + (360 - winningAngle);

// Пересобираем только содержимое секторов под текущий выигрыш
const items = [];

for (let i = 0; i < sectorCount; i++) {
    items.push(
        wheelPrizes[Math.floor(Math.random() * wheelPrizes.length)]
    );
}

items[winningIndex] = prize;

// Обновляем визуальные награды
const cards = track.querySelectorAll(":scope > div");

cards.forEach((card, index) => {
    if (index >= sectorCount) return;

    const item = items[index];
    const icon = card.querySelector("img");
    const name = card.querySelector(".roulette-prize-name");
    const content = card.querySelector(".roulette-card-content");

    if (icon) {
        icon.src = item.image;
        icon.alt = item.name;
    }

    if (name) {
        name.textContent = item.name;
    }

    // Компенсируем вращение колеса,
    // чтобы содержимое секторов оставалось ровным
    if (content) {
        content.style.transition = "none";
        content.style.transform = "rotate(0deg)";
    }
});
// Вращаем содержимое карточек в обратную сторону
cards.forEach(card => {
    const content = card.querySelector(".roulette-card-content");
    if (!content) return;

    content.style.transition =
        "transform 7s cubic-bezier(0.12, 0.75, 0.12, 1)";

    content.style.transform = `rotate(${-finalRotation}deg)`;
});
// Возвращаем колесо в исходное положение
track.style.setProperty("transition", "none", "important");
track.style.setProperty("transform", "rotate(0deg)", "important");

void track.offsetWidth;

    // Звук щелчков
    function playRouletteTick() {
        playSound("rouletteTick", 0.5);
    }

    // Отслеживание секторов
    let lastTickIndex = -1;

    const rouletteStartTime = performance.now();

    function checkRouletteTick() {
        const elapsed = performance.now() - rouletteStartTime;

        const matrix = getComputedStyle(track).transform;

        if (matrix && matrix !== "none") {
           const values = matrix.match(/matrix\(([^)]+)\)/);

            if (values) {
                const parts = values[1].split(",").map(Number);

                const rotation = (
                    Math.atan2(parts[1], parts[0]) *
                    180 / Math.PI + 360
                ) % 360;

                const angle = (360 - rotation) % 360;

                const currentIndex =
                    Math.floor(angle / sectorSize) % sectorCount;

                if (currentIndex !== lastTickIndex) {
                    lastTickIndex = currentIndex;
                    playRouletteTick();
                }
            }
        }

        if (elapsed < 7000) {
            requestAnimationFrame(checkRouletteTick);
        }
    }

    // Сбрасываем предыдущую позицию
    track.style.setProperty("transition", "none", "important");
    track.style.setProperty("transform", "rotate(0deg)", "important");

    void track.offsetWidth;

    // Запускаем вращение
    requestAnimationFrame(() => {
        track.style.setProperty(
            "transition",
            "transform 7s cubic-bezier(0.12, 0.75, 0.12, 1)",
            "important"
        );

        track.style.setProperty(
            "transform",
            `rotate(${finalRotation}deg)`,
            "important"
        );

        requestAnimationFrame(checkRouletteTick);
    });

    console.log("Бурмалда: выигрыш", prize.name);

    // Начисление награды
    setTimeout(() => {
      showRouletteWinEffects();
        const winningCard = track.children[winningIndex];
        const winningImage = winningCard?.querySelector("img");

        if (winningImage) {
            winningImage.animate(
                [
                    {
                        filter: "brightness(1) drop-shadow(0 0 0px gold)",
                        transform: "scale(1)"
                    },
                    {
                        filter: "brightness(1.8) drop-shadow(0 0 12px gold)",
                        transform: "scale(1.2)"
                    },
                    {
                        filter: "brightness(1.4) drop-shadow(0 0 8px gold)",
                        transform: "scale(1.1)"
                    }
                ],
                {
                    duration: 1200,
                    easing: "ease-out",
                    fill: "forwards"
                }
            );
        }
        playSound("rouletteWin", 0.7);

        switch (prize.type) {
            case "money":
                addMoney(prize.value);
                break;

            case "gems":
                addGems(prize.value);
                break;

            case "boost":
                state.boostUntil =
                    Date.now() + prize.value * 60 * 1000;

                state.boostMultiplier = 2;
                break;

            case "token":
                state.tokens += prize.value;
                break;

            default:
                console.error("Неизвестный тип награды:", prize);
                notify("Ошибка: неизвестный тип награды!");
                break;
        }

        console.log("Приз начислен:", prize);

        setText("wheelSymbol", "🎉");
        setText("wheelResult", "Твоя награда: " + prize.name);

        saveGame();
        renderAll();
        renderRouletteWheel();

        notify("Бурмалда: " + prize.name);

        // Разблокировка кнопок
        if (freeButton) freeButton.disabled = false;
        if (paidButton) paidButton.disabled = false;

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

    playSound("purchase", 0.6);

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

    playSound("purchase", 0.6);

    saveGame();
    renderAll();

    notify("Конвейер улучшен!");
}
  function buyShopItem(id) {
    const item = shopItems.find(entry => entry.id === id);
    if (!item) return;

    if (state.gemBalance < item.price) {
      notify("Недостаточно гемов!");
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
function watchGemAd() {
  if (!yandexSDKReady || !ysdk) {
    return notify("Реклама доступна только на платформе Яндекс Игр!");
  }

  if (rewardedAdActive) {
    return notify("Реклама уже запущена!");
  }

  rewardedAdActive = true;

  let rewardReceived = false;
  let gameplayStopped = false;

  function resumeGame() {
    if (!gameplayStopped) return;

    gameplayStopped = false;
    ysdk.features?.GameplayAPI?.start();
  }

  try {
    ysdk.adv.showRewardedVideo({
      callbacks: {
        onOpen: () => {
          console.log("Rewarded-реклама запущена.");

          gameplayStopped = true;
          ysdk.features?.GameplayAPI?.stop();
        },

        onRewarded: () => {
          if (rewardReceived) return;

          rewardReceived = true;

          addGems(20);
          saveGame();
          renderAll();

          notify("Ты получил 20 гемов за просмотр рекламы!");
        },

        onClose: (wasShown) => {
          console.log("Реклама закрыта:", wasShown);

          rewardedAdActive = false;
          resumeGame();

          if (!rewardReceived) {
            notify("Реклама завершена без награды.");
          }
        },

        onError: (error) => {
          console.error("Ошибка rewarded-рекламы:", error);

          rewardedAdActive = false;
          resumeGame();

          notify("Не удалось загрузить рекламу. Попробуй позже.");
        }
      }
    });
  } catch (error) {
    console.error("Ошибка запуска рекламы:", error);

    rewardedAdActive = false;
    resumeGame();

    notify("Не удалось запустить рекламу.");
  }
}
  async function buyGemPack(index) {
  // Бесплатный стартовый набор.
  if (index === 0) {
    if (state.starterPackClaimed) {
      return notify("Стартовый набор уже был получен!");
    }

    state.starterPackClaimed = true;
    addGems(100);

    saveGame();
    renderAll();

    notify("Стартовые 100 гемов получены!");
    return;
  }

  if (!yandexSDKReady || !payments) {
    return notify("Платежи доступны только на платформе Яндекс Игр.");
  }

  const productId = GEM_PACKAGE_IDS[index];

  if (!productId) {
    return notify("Неизвестный набор гемов.");
  }

  try {
    const purchase = await payments.purchase({
      id: productId
    });

    await handleGemPurchase(purchase);

  } catch (error) {
    console.error("Ошибка покупки:", error);
    notify("Покупка не завершена. Попробуй ещё раз.");
  }
}
  async function savePurchaseState() {
  state.lastSave = Date.now();

  try {
    // Сначала локальная запись.
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));

    // Затем обязательная запись в облако.
    await saveCloudState(true);

    console.log("Покупка сохранена локально и в облаке.");
    return true;

  } catch (error) {
    console.error("Ошибка сохранения покупки:", error);
    return false;
  }
}

async function handleGemPurchase(purchase) {
  if (!purchase || !purchase.purchaseToken) {
    throw new Error("Некорректные данные покупки");
  }

  const productId = purchase.productID;
  const gemAmount = GEM_PRODUCTS[productId];
  const token = purchase.purchaseToken;

  if (!gemAmount) {
    console.error("Неизвестный товар:", productId);
    throw new Error("Неизвестный товар покупки");
  }

  if (!state.processedPurchases.includes(token)) {
    const previousBalance = state.gemBalance;

    // Начисляем гемы и отмечаем покупку обработанной.
    addGems(gemAmount);
    state.processedPurchases.push(token);

    // Сначала сохраняем покупку локально и в облаке.
    if (!(await savePurchaseState())) {
      // Если сохранение не удалось — отменяем начисление.
      state.gemBalance = previousBalance;

      state.processedPurchases =
        state.processedPurchases.filter(item => item !== token);

      // Записываем откат в локальное сохранение.
      try {
        localStorage.setItem(SAVE_KEY, JSON.stringify(state));
      } catch (error) {
        console.error("Не удалось сохранить откат покупки:", error);
      }

      throw new Error("Не удалось сохранить покупку");
    }

    renderAll();
    notify(`Получено ${format(gemAmount)} гемов!`);
  }

  // Поглощаем покупку только после успешного сохранения.
  await payments.consumePurchase(token);

  console.log("Покупка успешно обработана:", productId);
}

async function restoreGemPurchases() {
  if (!payments) return;

  try {
    const purchases = await payments.getPurchases();

    console.log("Найдено необработанных покупок:", purchases.length);

    for (const purchase of purchases) {
      try {
        await handleGemPurchase(purchase);
      } catch (error) {
        console.error(
          "Ошибка восстановления покупки:",
          purchase.productID,
          error
        );
      }
    }

  } catch (error) {
    console.error("Ошибка проверки покупок:", error);
  }
}
    
function confirmAction(title, message, onConfirm) {
    // создаём стили автоматически
    if (!document.getElementById("customConfirmStyles")) {
        const style = document.createElement("style");
        style.id = "customConfirmStyles";

        style.textContent = `
            .custom-confirm-overlay {
                position: fixed;
                inset: 0;
                background: rgba(0, 0, 0, 0.8);
                backdrop-filter: blur(6px);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 999999;
                animation: confirmFadeIn 0.2s ease;
                padding: 20px;
            }

            .custom-confirm {
                width: 100%;
                max-width: 400px;
                padding: 28px;
                background: linear-gradient(145deg, #252535, #171721);
                border: 1px solid rgba(255,255,255,0.12);
                border-radius: 20px;
                text-align: center;
                color: white;
                box-shadow: 0 20px 60px rgba(0,0,0,0.6);
                animation: confirmScaleIn 0.25s ease;
            }

            .custom-confirm h2 {
                margin: 0 0 14px;
                font-size: 23px;
                color: #fff;
            }

            .custom-confirm p {
                color: #aaa;
                line-height: 1.6;
                margin-bottom: 26px;
                font-size: 14px;
            }

            .confirm-buttons {
                display: flex;
                gap: 12px;
            }

            .confirm-buttons button {
                flex: 1;
                padding: 13px 10px;
                border: none;
                border-radius: 11px;
                cursor: pointer;
                font-weight: bold;
                font-size: 14px;
                transition: 0.2s;
            }

            .confirm-cancel {
                background: #393947;
                color: white;
            }

            .confirm-accept {
                background: linear-gradient(135deg, #e04444, #a92323);
                color: white;
                box-shadow: 0 4px 15px rgba(220,50,50,0.25);
            }

            .confirm-buttons button:hover {
                filter: brightness(1.2);
                transform: translateY(-2px);
            }

            @keyframes confirmFadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }

            @keyframes confirmScaleIn {
                from {
                    opacity: 0;
                    transform: scale(0.9);
                }
                to {
                    opacity: 1;
                    transform: scale(1);
                }
            }
        `;

        document.head.appendChild(style);
    }

    // создаём окно
    const modal = document.createElement("div");
    modal.className = "custom-confirm-overlay";

    modal.innerHTML = `
        <div class="custom-confirm">
            <h2>${title}</h2>
            <p>${message}</p>

            <div class="confirm-buttons">
                <button class="confirm-cancel">Отмена</button>
                <button class="confirm-accept">Подтвердить</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector(".confirm-cancel").onclick = () => {
        modal.remove();
    };

    modal.querySelector(".confirm-accept").onclick = () => {
        modal.remove();
        onConfirm();
    };

    // закрытие по клику вне окна
    modal.onclick = (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    };
}

  // --------------------------------------------------
  // СБРОС ИГРЫ
  // --------------------------------------------------

function resetGame() {
    confirmAction(
        "Сброс прогресса",
        "Ты действительно хочешь сбросить весь прогресс? Это действие нельзя отменить.",
        () => {
            state = structuredClone(defaultState);

            saveGame();
            renderAll();
            openPage("factoryPage");

            notify("Прогресс сброшен.");
        }
    );
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
    if (rewardedAdActive) return;
    const now = Date.now();
    const delta = Math.min((now - lastTick) / 1000, 5);

    lastTick = now;

    if (delta > 0) {
      const income = getProduction() * delta;

      if (income > 0) addMoney(income);
    }

    // Пока вкладка скрыта, интерфейс не перерисовываем
    if (document.hidden) return;

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
// СИСТЕМА ЗВУКОВ (Web Audio API)
// ===============================
// Раньше каждый звук был <audio>, а на iOS Safari это сильно лагает вместе
// с WebGL: каждый play()/currentTime=0 заново дёргает аппаратный декодер
// mp3 и основной поток. Теперь все звуки один раз декодируются в память
// (AudioBuffer) и проигрываются через AudioContext без декодирования.

const SOUND_FILES = {
    click: "sounds/click.mp3",
    coin: "sounds/coin.mp3",
    gem: "sounds/gem.mp3",
    critical: "sounds/critical.mp3",
    comboStart: "sounds/combo-start.mp3",
    comboEnd: "sounds/combo-end.mp3",
    purchase: "sounds/purchase.mp3",
    rouletteStart: "sounds/roulette-start.mp3",
    rouletteTick: "sounds/roulette-tick.mp3",
    rouletteWin: "sounds/roulette-win.mp3"
};
const MUSIC_FILE = "sounds/background.mp3";
const MUSIC_VOLUME = 0.35;
const MAX_SIMULTANEOUS_SOUNDS = 8;

let soundEnabled = true;
let musicEnabled = true;
let musicStarted = false;

// На iOS не перехватывать аудиосессию и не прерывать другую музыку
try {
    if (navigator.audioSession) navigator.audioSession.type = "ambient";
} catch (e) {}

let audioCtx = null;
let sfxGain = null;
let musicGain = null;
const soundBuffers = {};
let musicBuffer = null;
let musicSource = null;
let soundsLoading = null;
const activeSounds = new Set();

function getAudioContext() {
    if (audioCtx) return audioCtx;

    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;

    try {
        audioCtx = new Ctx({ latencyHint: "interactive" });
    } catch (e) {
        audioCtx = new Ctx();
    }

    sfxGain = audioCtx.createGain();
    sfxGain.connect(audioCtx.destination);

    musicGain = audioCtx.createGain();
    musicGain.gain.value = MUSIC_VOLUME;
    musicGain.connect(audioCtx.destination);

    return audioCtx;
}

function decodeBuffer(ctx, arrayBuffer) {
    return new Promise((resolve, reject) => {
        // callback-форма работает и в старых Safari
        ctx.decodeAudioData(arrayBuffer, resolve, reject);
    });
}

async function loadAudioBuffer(ctx, url) {
    const response = await fetch(url);
    const data = await response.arrayBuffer();
    return decodeBuffer(ctx, data);
}

function loadAllSounds() {
    if (soundsLoading) return soundsLoading;

    const ctx = getAudioContext();
    if (!ctx) return Promise.resolve();

    // Сначала короткие эффекты, потом (в фоне) музыка
    soundsLoading = Promise.all(
        Object.entries(SOUND_FILES).map(([name, url]) =>
            loadAudioBuffer(ctx, url)
                .then(buffer => { soundBuffers[name] = buffer; })
                .catch(() => {})
        )
    ).then(() =>
        loadAudioBuffer(ctx, MUSIC_FILE)
            .then(buffer => { musicBuffer = buffer; })
            .catch(() => {})
    ).then(() => {
        if (musicEnabled && musicStarted) startMusicSource();
    });

    return soundsLoading;
}

// Вызывается из жеста пользователя: создаёт и "размораживает" контекст на iOS
function unlockAudio() {
    const ctx = getAudioContext();
    if (!ctx) return;

    if (ctx.state !== "running") {
        const resumed = ctx.resume();
        if (resumed && resumed.catch) resumed.catch(() => {});
    }

    loadAllSounds();
}

function playSound(name, volume = 0.5) {
    if (!soundEnabled || !audioCtx || audioCtx.state !== "running") return null;

    const buffer = soundBuffers[name];
    if (!buffer) return null;

    // Не даём накопиться десяткам голосов при быстрых кликах
    if (activeSounds.size >= MAX_SIMULTANEOUS_SOUNDS && name !== "rouletteWin") {
        return null;
    }

    const source = audioCtx.createBufferSource();
    source.buffer = buffer;

    const gain = audioCtx.createGain();
    gain.gain.value = volume;

    source.connect(gain);
    gain.connect(sfxGain);

    const entry = { source, gain };
    activeSounds.add(entry);

    source.onended = () => {
        activeSounds.delete(entry);
        try { source.disconnect(); gain.disconnect(); } catch (e) {}
    };

    source.start(0);
    return entry;
}

function stopSoundEntry(entry) {
    if (!entry) return;
    try { entry.source.stop(0); } catch (e) {}
    activeSounds.delete(entry);
}

function toggleGameSounds() {
    soundEnabled = !soundEnabled;

    const button = $("soundToggle");

    if (button) {
        button.textContent = soundEnabled ? "🔊" : "🔇";
    }

    if (!soundEnabled) {
        activeSounds.forEach(entry => {
            try { entry.source.stop(0); } catch (e) {}
        });
        activeSounds.clear();
    }
}

function startMusicSource() {
    if (!audioCtx || !musicBuffer || musicSource) return;

    const source = audioCtx.createBufferSource();
    source.buffer = musicBuffer;
    source.loop = true;
    source.connect(musicGain);
    source.start(0);
    musicSource = source;
}

function stopMusicSource() {
    if (!musicSource) return;
    try { musicSource.stop(0); } catch (e) {}
    try { musicSource.disconnect(); } catch (e) {}
    musicSource = null;
}

function startBackgroundMusic() {
    if (!musicEnabled) return;

    unlockAudio();
    musicStarted = true;

    // если музыка ещё декодируется - она запустится сама после загрузки
    startMusicSource();
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
        stopMusicSource();
        musicStarted = false;
    }
}

// Safari глушит контекст при сворачивании вкладки / звонке - будим его
document.addEventListener("visibilitychange", () => {
    if (!audioCtx) return;

    if (document.hidden) {
        if (audioCtx.state === "running") audioCtx.suspend().catch(() => {});
    } else {
        audioCtx.resume().catch(() => {});
    }
});


  // --------------------------------------------------
  // ОБРАБОТЧИКИ СОБЫТИЙ
  // --------------------------------------------------

  
  function bindEvents() {
    // iOS разрешает запуск звука только из жеста: ждём первое касание
    const firstGesture = event => {
        if (event.target.closest && event.target.closest("#musicToggle")) return;
        startBackgroundMusic();
        if (audioCtx && audioCtx.state === "running") {
            document.removeEventListener("pointerdown", firstGesture, true);
            document.removeEventListener("touchend", firstGesture, true);
        }
    };
    document.addEventListener("pointerdown", firstGesture, true);
    document.addEventListener("touchend", firstGesture, true);
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
        
        if (action === "watch-gem-ad") {
        watchGemAd();
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

    // Чем чаще клики, тем плотнее частицы по краям персонажа.
    const clickSpeed = now < clickBoostUntil
        ? 9
        : Math.max(1, Math.min(6, 1 + clickCombo / 4));
    if (window.spawnVerityEffects) window.spawnVerityEffects(clickSpeed, false);

    // активация бонуса
    
if (clickCombo >= COMBO_REQUIRED) {
    clickBoostUntil = now + COMBO_DURATION;
    playSound("comboStart", 0.7);
    clickCombo = 0;

    showClickBoost();
    if (window.spawnVerityEffects) window.spawnVerityEffects(1, true);
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

    renderClickHud();
    scheduleClickSave();
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


async function init() {
    await yandexSDKPromise;

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

    // Сохраняем при сворачивании - на iOS страницу могут выгрузить без предупреждения
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) saveGame();
    });
    window.addEventListener("pagehide", saveGame);

    saveGame();

    console.log("Verity Tycoon запущен. Все страницы подключены.");
}


  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
  



let activeCoinEffects = 0;
function showCoinEffect(amount, x, y) {
    const container = document.createElement("div");

    const drift = (Math.random() - 0.5) * 100;
    const rotation = (Math.random() - 0.5) * 20;
    const duration = 1400;

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
            0 0 8px #ffb900,
            0 0 18px #ff9900;
        transform: translate(-50%, 0);
        will-change: transform, opacity;
    `;

    container.appendChild(effect);

    // При очень частых кликах частицы пропускаем, оставляем только число
    const particleCount = activeCoinEffects > 6 ? 0 : 9;
    const particleAnimations = [];

    for (let i = 0; i < particleCount; i++) {
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
            box-shadow: 0 0 6px #ffb900;
            will-change: transform, opacity;
        `;

        container.appendChild(particle);

        const dx = Math.cos(angle) * distance;
        const dy = Math.sin(angle) * distance;
        const spin = Math.random() * 360;

        particleAnimations.push(particle.animate([
            { transform: "translate(0,0) rotate(0deg)", opacity: 1 },
            { transform: `translate(${dx}px,${dy - 20}px) rotate(${spin}deg)`, opacity: 0 }
        ], { duration, easing: "cubic-bezier(.2,.7,.3,1)", fill: "forwards" }));
    }

    document.body.appendChild(container);
    activeCoinEffects++;

    const anim = effect.animate([
        { transform: "translate(-50%,0) scale(.5) rotate(0deg)", opacity: 0, offset: 0 },
        { transform: `translate(calc(-50% + ${drift * .3}px),-35px) scale(1.3) rotate(${rotation * .3}deg)`, opacity: 1, offset: .15 },
        { transform: `translate(calc(-50% + ${drift}px),-110px) scale(1.05) rotate(${rotation}deg)`, opacity: 0, offset: 1 }
    ], { duration, easing: "ease-out", fill: "forwards" });

    anim.onfinish = () => {
        activeCoinEffects = Math.max(0, activeCoinEffects - 1);
        container.remove();
    };
}

})();
