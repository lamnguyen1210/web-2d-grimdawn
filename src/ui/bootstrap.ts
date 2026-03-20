import { createGame } from "../engine/game";
import type { RuntimeStateSnapshot } from "../gameplay/types";
import { GameScene } from "../scenes/GameScene";

type GameMenuTab = "menu" | "controls";

const controlSections: Array<{ title: string; items: Array<[string, string]> }> = [
  {
    title: "Mouse",
    items: [
      ["Left Click", "Move to ground or attack an enemy"],
      ["Right Click", "Cast Fire Bomb"],
    ],
  },
  {
    title: "Keyboard",
    items: [
      ["W A S D", "Move"],
      ["1", "Cleave Shot"],
      ["2", "Fire Bomb"],
      ["3", "Frost Nova"],
      ["4", "Venom Shot"],
      ["I", "Open or close inventory"],
      ["Space", "Drink potion"],
      ["Esc", "Pause or resume"],
    ],
  },
];

const formatModifierList = (snapshot: RuntimeStateSnapshot): string[] => {
  const weapon = snapshot.inventory.equipped.weapon;
  const chest = snapshot.inventory.equipped.chest;
  const ring = snapshot.inventory.equipped.ring;
  return [
    weapon ? `${weapon.name}: +${weapon.stats.physicalDamageMin ?? 0}-${weapon.stats.physicalDamageMax ?? 0} phys` : "Weapon slot empty",
    chest ? `${chest.name}: +${chest.stats.armor ?? 0} armor` : "Chest slot empty",
    ring ? `${ring.name}: +${ring.stats.fireDamageMin ?? 0}-${ring.stats.fireDamageMax ?? 0} fire` : "Ring slot empty",
  ];
};

const formatStats = (snapshot: RuntimeStateSnapshot): Array<[string, string]> => [
  ["Level", `${snapshot.level}`],
  ["XP", `${snapshot.xp} / ${snapshot.nextLevelXp}`],
  ["Health", `${Math.round(snapshot.player.health)} / ${snapshot.player.stats.maxHealth}`],
  ["Energy", `${Math.round(snapshot.player.energy)} / ${snapshot.player.stats.maxEnergy}`],
  ["Armor", `${snapshot.player.stats.armor}`],
  ["Move", `${snapshot.player.stats.moveSpeed}`],
  ["Physical", `${snapshot.player.stats.physicalDamageMin}-${snapshot.player.stats.physicalDamageMax}`],
  ["Fire", `${snapshot.player.stats.fireDamageMin}-${snapshot.player.stats.fireDamageMax}`],
  ["Crit", `${Math.round(snapshot.player.stats.critChance * 100)}%`],
  ["Resist", `P${Math.round(snapshot.player.stats.physicalResistance * 100)}% F${Math.round(snapshot.player.stats.fireResistance * 100)}% V${Math.round(snapshot.player.stats.poisonResistance * 100)}%`],
  ["Gold", `${snapshot.inventory.gold}`],
];

const rarityClass = (rarity: string): string => `rarity-${rarity}`;

export const bootstrapApp = (root: HTMLDivElement | null): void => {
  if (!root) {
    throw new Error("App root not found");
  }

  root.innerHTML = `
    <div class="shell">
      <section class="viewport">
        <div id="game-root" class="game-root"></div>
        <div id="game-menu" class="game-menu" style="display:none">
          <div class="game-menu-panel">
            <h2 id="game-menu-title" class="game-menu-title">PAUSED</h2>
            <div id="game-menu-tabs" class="game-menu-tabs" style="display:none"></div>
            <div id="game-menu-content" class="game-menu-content"></div>
          </div>
        </div>
        <div id="inventory-popup" class="inventory-popup" style="display:none">
          <div class="inventory-popup-panel">
            <div class="inventory-popup-col">
              <h2 class="inventory-popup-title">Field Report</h2>
              <div id="popup-stats" class="popup-stats"></div>
              <h2 class="inventory-popup-title">Equipment</h2>
              <div id="popup-equipment" class="popup-equipment"></div>
              <p class="popup-hint">I — close inventory</p>
            </div>
            <div class="inventory-popup-col">
              <h2 class="inventory-popup-title">Inventory</h2>
              <div id="popup-inventory" class="popup-inventory"></div>
            </div>
          </div>
        </div>
        <div id="quest-tracker" class="quest-tracker"></div>
        <div id="shop-popup" class="shop-popup" style="display:none">
          <div class="shop-popup-panel">
            <h2 class="shop-popup-title">Merchant Aldric</h2>
            <div id="shop-gold" class="shop-gold"></div>
            <div class="shop-items">
              <div class="shop-item">
                <span class="shop-item-name">Health Tonic</span>
                <span class="shop-item-cost">5g</span>
                <button class="button" data-action="buy-tonic">Buy</button>
              </div>
              <div class="shop-item">
                <span class="shop-item-name">Magic Item (random)</span>
                <span class="shop-item-cost">25g</span>
                <button class="button" data-action="buy-item">Buy</button>
              </div>
            </div>
            <button class="button" data-action="close-shop" style="margin-top:12px">Close (E)</button>
          </div>
        </div>
      </section>
    </div>
  `;

  const game = createGame(root.querySelector<HTMLElement>("#game-root")!);
  const gameMenu = root.querySelector<HTMLElement>("#game-menu")!;
  const gameMenuTitle = root.querySelector<HTMLElement>("#game-menu-title")!;
  const gameMenuTabs = root.querySelector<HTMLElement>("#game-menu-tabs")!;
  const gameMenuContent = root.querySelector<HTMLElement>("#game-menu-content")!;
  const inventoryPopup = root.querySelector<HTMLElement>("#inventory-popup")!;
  const popupStats = root.querySelector<HTMLElement>("#popup-stats")!;
  const popupEquipment = root.querySelector<HTMLElement>("#popup-equipment")!;
  const popupInventory = root.querySelector<HTMLElement>("#popup-inventory")!;
  const questTracker = root.querySelector<HTMLElement>("#quest-tracker")!;
  const shopPopup = root.querySelector<HTMLElement>("#shop-popup")!;
  const shopGold = root.querySelector<HTMLElement>("#shop-gold")!;
  let activeMenuTab: GameMenuTab = "menu";
  let wasMenuVisible = false;

  const render = (): void => {
    const scene = game.scene.getScene("game") as GameScene;
    const snapshot = scene.getSnapshot();
    if (!snapshot) {
      return;
    }

    // Inventory popup
    const inventoryVisible = scene.getIsInventoryVisible();
    inventoryPopup.style.display = inventoryVisible ? "flex" : "none";

    if (inventoryVisible) {
      popupStats.innerHTML = formatStats(snapshot)
        .map(
          ([label, value]) => `
            <div class="popup-stat">
              <span class="popup-stat-label">${label}</span>
              <span class="popup-stat-value">${value}</span>
            </div>
          `,
        )
        .join("");

      popupEquipment.innerHTML = (["weapon", "chest", "ring"] as const)
        .map((slot) => {
          const item = snapshot.inventory.equipped[slot];
          return `
            <div class="popup-equip-card">
              <div class="popup-equip-top">
                <span class="popup-equip-slot">${slot.toUpperCase()}</span>
                <span class="popup-equip-rarity">${item ? item.rarity : "empty"}</span>
              </div>
              <div class="popup-equip-name ${item ? rarityClass(item.rarity) : ""}">${item?.name ?? "Empty slot"}</div>
            </div>
          `;
        })
        .join("");

      popupInventory.innerHTML =
        snapshot.inventory.items.length === 0
          ? `<div style="font-size:0.82rem;color:#7a6d60">Inventory empty. Kill packs and open chests.</div>`
          : snapshot.inventory.items
              .map(
                (item) => `
                  <div class="popup-item-card">
                    <div class="popup-item-top">
                      <span class="popup-item-name ${rarityClass(item.rarity)}">${item.name}</span>
                      <span class="popup-item-slot">${item.slot}</span>
                    </div>
                    <div class="popup-item-stats">${Object.entries(item.stats)
                      .filter(([, value]) => typeof value === "number" && value !== 0)
                      .map(([key, value]) => `${key}: ${Number(value).toFixed(key.includes("Resistance") || key.includes("Chance") ? 2 : 0)}`)
                      .join(" | ")}</div>
                    <div class="popup-item-actions">
                      <button class="button" data-action="equip" data-item-id="${item.id}"
                        ${(item.requiredLevel ?? 1) > snapshot.level ? 'disabled style="opacity:0.4;cursor:default"' : ""}>
                        ${(item.requiredLevel ?? 1) > snapshot.level ? `Req Lvl ${item.requiredLevel}` : "Equip"}
                      </button>
                    </div>
                  </div>
                `,
              )
              .join("");
    }

    // Quest tracker
    const activeQuest = scene.getActiveQuestForUi();
    if (activeQuest) {
      questTracker.innerHTML = `
        <div class="quest-title">${activeQuest.title}</div>
        ${activeQuest.objectives.map((obj) =>
          `<div class="quest-obj${obj.done ? " is-done" : ""}">
            <span class="quest-check">${obj.done ? "✓" : "○"}</span>
            <span>${obj.description}</span>
          </div>`
        ).join("")}
      `;
    } else {
      questTracker.innerHTML = `<div class="quest-title">All quests complete!</div>`;
    }

    // Shop popup
    const shopVisible = scene.getIsShopVisible();
    shopPopup.style.display = shopVisible ? "flex" : "none";
    if (shopVisible) {
      shopGold.textContent = `Gold: ${snapshot.inventory.gold}g`;
    }

    // Pause / death menu
    const dead = !snapshot.player.alive;
    const paused = scene.getIsPaused();
    const menuVisible = dead || paused;
    if (menuVisible && !wasMenuVisible) {
      activeMenuTab = "menu";
    }
    wasMenuVisible = menuVisible;

    if (menuVisible) {
      gameMenu.style.display = "flex";
      gameMenuTitle.textContent = dead ? "YOU DIED" : "PAUSED";
      gameMenuTabs.style.display = dead ? "none" : "grid";
      gameMenuTabs.innerHTML = dead
        ? ""
        : `<button class="game-menu-tab${activeMenuTab === "menu" ? " is-active" : ""}" data-menu-tab="menu">Menu</button>
           <button class="game-menu-tab${activeMenuTab === "controls" ? " is-active" : ""}" data-menu-tab="controls">Controls</button>`;
      gameMenuContent.innerHTML =
        dead || activeMenuTab === "menu"
          ? `<div class="game-menu-actions">
               ${dead ? '<button class="button" data-action="respawn">Respawn</button>' : '<button class="button" data-action="resume">Resume</button>'}
               <button class="button" data-action="load-save">Load Last Save</button>
               <button class="button" data-action="new-game">New Game</button>
             </div>`
          : `<div class="controls-guide">
               ${controlSections
                 .map(
                   (section) => `
                     <section class="controls-guide-section">
                       <h3 class="controls-guide-title">${section.title}</h3>
                       <div class="controls-guide-list">
                         ${section.items
                           .map(
                             ([label, description]) => `
                               <div class="controls-guide-item">
                                 <span class="controls-guide-key">${label}</span>
                                 <span class="controls-guide-description">${description}</span>
                               </div>
                             `,
                           )
                           .join("")}
                       </div>
                     </section>
                   `,
                 )
                 .join("")}
             </div>`;
    } else {
      gameMenu.style.display = "none";
      activeMenuTab = "menu";
    }
  };

  root.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) {
      return;
    }
    const target = event.target as HTMLElement;
    const control = target.closest<HTMLElement>("[data-action], [data-menu-tab]");
    if (!control) {
      return;
    }
    event.preventDefault();
    const scene = game.scene.getScene("game") as GameScene;
    if (control.dataset.menuTab === "menu" || control.dataset.menuTab === "controls") {
      activeMenuTab = control.dataset.menuTab;
      render();
      return;
    }
    if (control.dataset.action === "equip" && control.dataset.itemId) {
      scene.equipItem(control.dataset.itemId);
    } else if (control.dataset.action === "resume") {
      scene.resumeGame();
    } else if (control.dataset.action === "respawn") {
      scene.respawnPlayer();
    } else if (control.dataset.action === "load-save") {
      scene.loadLastSaveState();
    } else if (control.dataset.action === "new-game") {
      scene.startNewGame();
    } else if (control.dataset.action === "buy-tonic") {
      scene.buyTonic();
    } else if (control.dataset.action === "buy-item") {
      scene.buyItem();
    } else if (control.dataset.action === "close-shop") {
      scene.closeShop();
    } else {
      return;
    }
    render();
  });

  game.events.on("ready", render);
  window.setInterval(render, 180);
};
