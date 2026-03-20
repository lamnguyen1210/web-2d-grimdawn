# Items and Loot — Equipment, Affixes, and the Inventory

---

## Two item representations

Like enemies, items exist in two layers:

| Layer | Type | Purpose |
|-------|------|---------|
| `ItemDefinition` | Static data in `src/content/items.ts` | The "blueprint" — base stats, rarity tier |
| `ItemInstance` | Runtime object | An actual item with a unique ID, final stats, and generated name |

An `ItemInstance` is what sits in your inventory and gets equipped.

---

## Item definitions

**File: `src/content/items.ts`**

Ten items are defined across three slots and three rarity tiers:

| Name | Slot | Rarity | Req Level | Key stat |
|------|------|--------|-----------|---------|
| Rusted Rifle | weapon | common | 1 | +6–10 phys damage |
| Brigand Jacket | chest | common | 1 | +12 armor, +18 health |
| Charred Band | ring | common | 1 | +1–2 fire damage |
| Watchman Carbine | weapon | magic | 2 | +10–14 phys, +5% crit |
| Warden's Coat | chest | magic | 2 | +18 armor, +26 health, +5% fire res |
| Pyre Loop | ring | magic | 2 | +14 energy, +3–5 fire damage |
| Militia Repeater | weapon | magic | 2 | +8–12 phys, +15% attack speed |
| Blighted Musket | weapon | rare | 3 | +14–20 phys, +6% poison res, +4% crit |
| Hollow Guardian Plate | chest | rare | 3 | +26 armor, +40 health, resistances |
| Frostfire Signet | ring | rare | 3 | +4–7 fire damage, +18 energy, +6% crit |

There are three equipment slots: **weapon**, **chest**, **ring**. Only one item can be equipped per slot.

---

## Item rarity

| Rarity | Colour | Affixes | Description |
|--------|--------|---------|-------------|
| `common` | White | 0 | Base stats only — what you find at the start |
| `magic` | Blue | 1 (prefix) | One random modifier on top of base stats |
| `rare` | Orange | 2 (prefix + suffix) | Two random modifiers |

---

## Affixes — the random modifiers

**File: `src/content/affixes.ts`**

Affixes are bonus stats added to magic and rare items. They come in two families:

**Prefixes** (added before the item name):

| Name | Stat bonus |
|------|-----------|
| Sturdy | +6 armor |
| Swift | +14 move speed |
| Tempered | +2–4 physical damage |
| Ember | +2–4 fire damage |
| Venomous | +8% poison resistance |
| Frozen | +1–3 physical damage |

**Suffixes** (added after the item name):

| Name | Stat bonus |
|------|-----------|
| of Health | +20 max health |
| of Quickness | +18% attack speed |
| of Sparks | +0.9 energy regen/sec |
| of Cinders | +8% fire resistance |
| of Warding | +6% poison res, +4% fire res |
| of Fortitude | +30 max health, +0.6 health regen/sec |

A magic item gets one random prefix. A rare item gets one random prefix AND one random suffix.

### Generated item names

The name is assembled from parts:

```typescript
const name = [prefix, base.name, suffix].filter(Boolean).join(" ");
```

Examples:
- Common "Rusted Rifle" → `"Rusted Rifle"`
- Magic with Ember prefix → `"Ember Rusted Rifle"`
- Rare with Swift + of Health → `"Swift Rusted Rifle of Health"`

---

## How items are created

**File: `src/systems/LootSystem.ts`, `createItemInstance()`**

```typescript
createItemInstance(base: ItemDefinition, forcedRarity?) {
  const rarity = forcedRarity ?? base.rarity;
  const affixCount = rarity === "common" ? 0 : rarity === "magic" ? 1 : 2;

  const selectedAffixes = [];
  if (affixCount >= 1) selectedAffixes.push(randomFrom(prefixPool));
  if (affixCount >= 2) selectedAffixes.push(randomFrom(suffixPool));

  const finalStats = addStats(base.baseStats, ...selectedAffixes.map(a => a.stats));

  return {
    id: uuid(),
    baseId: base.id,
    name: [prefix, base.name, suffix].join(" "),
    slot: base.slot,
    rarity,
    stats: finalStats,
    affixIds: selectedAffixes.map(a => a.id),
    requiredLevel: base.requiredLevel,
  };
}
```

Each `ItemInstance` has a unique UUID so the inventory can track and equip specific items.

---

## How loot drops

**File: `src/systems/LootSystem.ts`, `dropRewards()`**

When an enemy dies:

1. **Gold always drops:**
   ```
   Warden: 22–40 gold
   Others: 6–18 gold
   ```

2. **Potion drops randomly:**
   ```
   Warden: 100% chance
   Others: 20% chance
   ```

3. **Item drops randomly:**
   ```
   Warden:  100% chance, always rare
   Bruiser: 48% chance, 45% magic / 55% common
   Others:  28% chance, 45% magic / 55% common
   ```

All drops spawn as world pickups near the enemy's death position. The player walks over them to collect automatically (within 56 pixels).

---

## Pickups — world items

**File: `src/gameplay/types.ts`**

```typescript
interface PickupState {
  id: string;
  kind: "gold" | "potion" | "item" | "chest";
  x: number;
  y: number;
  value?: number;  // for gold and potions
  item?: ItemInstance;  // for item pickups
  encounterId?: string;  // for chests
  label: string;
}
```

**Auto-collection** runs every frame in `LootSystem.updatePickups()`:

```typescript
for each pickup:
  if distance(player, pickup) > 56: continue

  if gold:   inventory.gold += value
  if potion: inventory.potions += value
  if item:   inventory.items.push(item)
  if chest:  openChest(pickup)  // see below

  destroyPickup(id)
```

---

## Chests

Chests appear in zones that have encounters with `chest: true`. They sit at a fixed position and are collected by walking into them. Opening a chest gives:

- 24–44 gold
- 1 potion
- 1 random magic item
- Marks the encounter as cleared (the chest won't reappear)

---

## Equipping items

**File: `src/scenes/GameScene.ts`, `equipItem()`**

```typescript
equipItem(itemId) {
  const item = inventory.items.find((i) => i.id === itemId);
  if (ctx.level < item.requiredLevel) {
    log("Cannot equip — requires higher level.");
    return;
  }

  // Swap: put the currently equipped item (if any) back into the bag
  const previous = inventory.equipped[item.slot];
  if (previous) inventory.items.push(previous);

  // Equip the new item
  inventory.equipped[item.slot] = item;
  inventory.items.splice(indexOf(item), 1);

  // Immediately recalculate all player stats
  combat.recalculatePlayerStats();
  autosave();
}
```

After equipping, `recalculatePlayerStats()` rebuilds the player's entire stat block from scratch using `buildPlayerStats()`. Stats are always computed, never incrementally patched.

---

## The inventory screen (press I)

The inventory screen shows:

1. **Field Report** — all current player stats (health, energy, armor, damage, resistances, etc.)
2. **Equipment** — the three equipped slots (weapon/chest/ring)
3. **Inventory** — all items in the bag with stats and an Equip button

The Equip button is greyed out and disabled if the item's required level is above the player's current level. This is enforced both in the UI (visual feedback) and in `equipItem()` (hard block).

---

## Starting inventory

On a new game:

```typescript
inventory = {
  gold: 18,
  potions: 3,
  items: [
    createItemInstance(itemDefinitions[0]),  // Rusted Rifle (common)
    createItemInstance(itemDefinitions[1]),  // Brigand Jacket (common)
  ],
  equipped: {},
}
```

The player starts with two items in the bag but must manually equip them (open the inventory with `I`, click Equip).
