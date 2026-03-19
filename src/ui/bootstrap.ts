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
      </section>
      <aside class="sidebar">
        <section class="panel">
          <h2>Field Report</h2>
          <div id="stats-grid" class="stat-grid"></div>
          <p class="hint">Controls: left click move/attack, right click Fire Bomb, WASD override, 1 Cleave Shot, 2 Fire Bomb, 3 Frost Nova, 4 Venom Shot, I inventory, Space potion, F1 debug, F5 test loot.</p>
        </section>
        <section class="panel">
          <h3>Equipment</h3>
          <div id="equipment-list" class="equipment-list"></div>
          <div id="equipment-summary" class="controls-list"></div>
        </section>
        <section class="panel">
          <h3>Inventory</h3>
          <div id="inventory-list" class="inventory-list"></div>
        </section>
        <section class="panel">
          <h3>Combat Log</h3>
          <div id="log-list" class="log-list"></div>
        </section>
      </aside>
    </div>
  `;

  const game = createGame(root.querySelector<HTMLElement>("#game-root")!);
  const statsGrid = root.querySelector<HTMLDivElement>("#stats-grid")!;
  const inventoryList = root.querySelector<HTMLDivElement>("#inventory-list")!;
  const equipmentList = root.querySelector<HTMLDivElement>("#equipment-list")!;
  const equipmentSummary = root.querySelector<HTMLDivElement>("#equipment-summary")!;
  const logList = root.querySelector<HTMLDivElement>("#log-list")!;

  const render = (): void => {
    const scene = game.scene.getScene("game") as GameScene;
    const snapshot = scene.getSnapshot();
    if (!snapshot) {
      return;
    }

    statsGrid.innerHTML = formatStats(snapshot)
      .map(
        ([label, value]) => `
          <div class="stat">
            <span class="stat-label">${label}</span>
            <span class="stat-value">${value}</span>
          </div>
        `,
      )
      .join("");

    equipmentList.innerHTML = (["weapon", "chest", "ring"] as const)
      .map((slot) => {
        const item = snapshot.inventory.equipped[slot];
        return `
          <div class="equip-card">
            <div class="equip-top">
              <span class="equip-name">${slot.toUpperCase()}</span>
              <span class="equip-meta">${item ? item.rarity : "empty"}</span>
            </div>
            <div class="${item ? rarityClass(item.rarity) : ""}">${item?.name ?? "Empty slot"}</div>
          </div>
        `;
      })
      .join("");

    equipmentSummary.innerHTML = formatModifierList(snapshot)
      .map((line) => `<div class="log-entry">${line}</div>`)
      .join("");

    inventoryList.innerHTML =
      snapshot.inventory.items.length === 0
        ? `<div class="log-entry">Inventory empty. Kill packs and open the chest in the crossroads.</div>`
        : snapshot.inventory.items
            .map(
              (item) => `
                <div class="item-card">
                  <div class="item-top">
                    <span class="item-name ${rarityClass(item.rarity)}">${item.name}</span>
                    <span class="item-meta">${item.slot}</span>
                  </div>
                  <div class="item-meta">${Object.entries(item.stats)
                    .filter(([, value]) => typeof value === "number" && value !== 0)
                    .map(([key, value]) => `${key}: ${Number(value).toFixed(key.includes("Resistance") || key.includes("Chance") ? 2 : 0)}`)
                    .join(" | ")}</div>
                  <div class="item-actions">
                    <button class="button" data-action="equip" data-item-id="${item.id}">Equip</button>
                  </div>
                </div>
              `,
            )
            .join("");

    logList.innerHTML = snapshot.player.alive
      ? scene
          .getCombatLog()
          .slice(-8)
          .reverse()
          .map((entry) => `<div class="log-entry">${entry}</div>`)
          .join("")
      : `
          <div class="log-entry">The soldier has fallen.</div>
          <div class="item-actions">
            <button class="button" data-action="respawn">Respawn</button>
            <button class="button" data-action="load-save">Load Last Save</button>
            <button class="button" data-action="new-game">New Game</button>
          </div>
        `;
  };

  root.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    const scene = game.scene.getScene("game") as GameScene;
    if (target.dataset.action === "equip" && target.dataset.itemId) {
      scene.equipItem(target.dataset.itemId);
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
