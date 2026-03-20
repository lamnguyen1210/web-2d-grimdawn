import { createGame } from "../engine/game";
import type { RuntimeStateSnapshot } from "../gameplay/types";
import { GameScene } from "../scenes/GameScene";

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
            <div id="game-menu-actions" class="game-menu-actions"></div>
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
      </section>
    </div>
  `;

  const game = createGame(root.querySelector<HTMLElement>("#game-root")!);
  const gameMenu = root.querySelector<HTMLElement>("#game-menu")!;
  const gameMenuTitle = root.querySelector<HTMLElement>("#game-menu-title")!;
  const gameMenuActions = root.querySelector<HTMLElement>("#game-menu-actions")!;
  const inventoryPopup = root.querySelector<HTMLElement>("#inventory-popup")!;
  const popupStats = root.querySelector<HTMLElement>("#popup-stats")!;
  const popupEquipment = root.querySelector<HTMLElement>("#popup-equipment")!;
  const popupInventory = root.querySelector<HTMLElement>("#popup-inventory")!;

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
                      <button class="button" data-action="equip" data-item-id="${item.id}">Equip</button>
                    </div>
                  </div>
                `,
              )
              .join("");
    }

    // Pause / death menu
    const dead = !snapshot.player.alive;
    const paused = scene.getIsPaused();
    if (dead || paused) {
      gameMenu.style.display = "flex";
      gameMenuTitle.textContent = dead ? "YOU DIED" : "PAUSED";
      gameMenuActions.innerHTML = dead
        ? `<button class="button" data-action="respawn">Respawn</button>
           <button class="button" data-action="load-save">Load Last Save</button>
           <button class="button" data-action="new-game">New Game</button>`
        : `<button class="button" data-action="resume">Resume</button>
           <button class="button" data-action="load-save">Load Last Save</button>
           <button class="button" data-action="new-game">New Game</button>`;
    } else {
      gameMenu.style.display = "none";
    }
  };

  root.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    const scene = game.scene.getScene("game") as GameScene;
    if (target.dataset.action === "equip" && target.dataset.itemId) {
      scene.equipItem(target.dataset.itemId);
    } else if (target.dataset.action === "resume") {
      scene.resumeGame();
    } else if (target.dataset.action === "respawn") {
      scene.respawnPlayer();
    } else if (target.dataset.action === "load-save") {
      scene.loadLastSaveState();
    } else if (target.dataset.action === "new-game") {
      scene.startNewGame();
    } else {
      return;
    }
    render();
  });

  game.events.on("ready", render);
  window.setInterval(render, 180);
};
