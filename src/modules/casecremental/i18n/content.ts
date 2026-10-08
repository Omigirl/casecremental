import type { RarityId, WeaponId, WearId } from "../sim/types";
import type { UpgradeId } from "../sim/upgrades";
import { getLang } from "./index";

// Player-visible names of game content in both languages. Parody names — never real CS names.
type Pair = { en: string; ru: string };
const pick = (p: Pair | undefined): string => (p ? p[getLang()] : "");

const CASES: Record<string, Pair> = {
  bootcamp: { en: "Boot Camp", ru: "Учебка" },
  wildwood: { en: "Wildwood", ru: "Дебри" },
  bedrock: { en: "Bedrock", ru: "Монолит" },
};

const WEAPONS: Record<WeaponId, Pair> = {
  rifle: { en: "AK-Pew", ru: "АК-Пиу" },
  sniper: { en: "Longshot", ru: "Дальнобой" },
  pistol: { en: "Peashooter", ru: "Пукалка" },
  heavyPistol: { en: "Desert Hawk", ru: "Пустынный ястреб" },
  smg: { en: "Buzzsaw", ru: "Циркулярка" },
  shotgun: { en: "Boomstick", ru: "Громобой" },
  mg: { en: "Lawnmower", ru: "Газонокосилка" },
  knife: { en: "★ Hookblade", ru: "★ Крюк-нож" },
};

const SKINS: Record<string, Pair> = {
  bc_woodland: { en: "Woodland Drill", ru: "Лесные учения" },
  bc_desert: { en: "Sandstorm", ru: "Песчаная буря" },
  bc_urban: { en: "Concrete Jungle", ru: "Бетонные джунгли" },
  bc_olive: { en: "Olive Drab", ru: "Оливковый" },
  bc_snow: { en: "Whiteout", ru: "Белая мгла" },
  bc_digital: { en: "Pixel Patrol", ru: "Пиксельный патруль" },
  bc_tiger: { en: "Jungle Cat", ru: "Кошка джунглей" },
  bc_navy: { en: "Deep Ops", ru: "Глубокая разведка" },
  bc_redalert: { en: "Red Alert", ru: "Красная тревога" },
  bc_hunter: { en: "Blaze Hunter", ru: "Огненный охотник" },
  bc_commander: { en: "Commander's Pride", ru: "Гордость командира" },
  bc_warlord: { en: "Warlord", ru: "Военачальник" },
  bc_knife: { en: "Field Marshal", ru: "Фельдмаршал" },
  ww_fern: { en: "Fernlight", ru: "Папоротник" },
  ww_bark: { en: "Old Bark", ru: "Старая кора" },
  ww_moss: { en: "Mossback", ru: "Мшистый" },
  ww_pine: { en: "Pine Needle", ru: "Хвоя" },
  ww_birch: { en: "Birchwood", ru: "Берёза" },
  ww_autumn: { en: "Autumn Fall", ru: "Листопад" },
  ww_lichen: { en: "Lichen", ru: "Лишайник" },
  ww_redwood: { en: "Redwood", ru: "Секвойя" },
  ww_glade: { en: "Emerald Glade", ru: "Изумрудная поляна" },
  ww_canopy: { en: "Canopy", ru: "Кроны" },
  ww_spirit: { en: "Forest Spirit", ru: "Лесной дух" },
  ww_elder: { en: "Elder Oak", ru: "Древний дуб" },
  ww_knife: { en: "Heartwood", ru: "Сердцевина" },
  br_granite: { en: "Granite", ru: "Гранит" },
  br_slate: { en: "Slate", ru: "Сланец" },
  br_sandstone: { en: "Sandstone", ru: "Песчаник" },
  br_basalt: { en: "Basalt", ru: "Базальт" },
  br_quarry: { en: "Quarry", ru: "Карьер" },
  br_marble: { en: "Carrara", ru: "Каррара" },
  br_amethyst: { en: "Amethyst", ru: "Аметист" },
  br_jade: { en: "Jade", ru: "Нефрит" },
  br_obsidian: { en: "Obsidian Edge", ru: "Обсидиановая грань" },
  br_sapphire: { en: "Sapphire Vein", ru: "Сапфировая жила" },
  br_magma: { en: "Magma Core", ru: "Ядро магмы" },
  br_diamond: { en: "Diamond Hands", ru: "Алмазные руки" },
  br_knife: { en: "Molten Crown", ru: "Расплавленная корона" },
};

const RARITIES: Record<RarityId, Pair> = {
  milspec: { en: "Mil-Spec", ru: "Армейское" },
  restricted: { en: "Restricted", ru: "Запрещённое" },
  classified: { en: "Classified", ru: "Засекреченное" },
  covert: { en: "Covert", ru: "Тайное" },
  gold: { en: "★ Rare Special", ru: "★ Редкий предмет" },
};

const WEARS: Record<WearId, Pair> = {
  FN: { en: "Factory New", ru: "С завода" },
  MW: { en: "Minimal Wear", ru: "Немного поношенное" },
  FT: { en: "Field-Tested", ru: "После испытаний" },
  WW: { en: "Well-Worn", ru: "Поношенное" },
  BS: { en: "Battle-Scarred", ru: "Закалённое в боях" },
};

const UPGRADES: Record<UpgradeId, { name: Pair; desc: Pair }> = {
  luck: { name: { en: "Luck", ru: "Удача" }, desc: { en: "Better rarities", ru: "Чаще редкие" } },
  appraiser: { name: { en: "Appraiser", ru: "Оценщик" }, desc: { en: "+25% sell value", ru: "+25% к продаже" } },
  quickHands: { name: { en: "Quick Hands", ru: "Ловкие руки" }, desc: { en: "Faster reel", ru: "Быстрее рулетка" } },
};

const STAGES: Pair[] = [
  { en: "Sober", ru: "Трезвый" },
  { en: "Buzzed", ru: "Навеселе" },
  { en: "High", ru: "Эйфория" },
  { en: "Tripping", ru: "Трип" },
  { en: "Cyberpsychosis", ru: "Киберпсихоз" },
];

export const caseName = (id: string): string => pick(CASES[id]);
export const weaponName = (w: WeaponId): string => pick(WEAPONS[w]);
export const skinName = (id: string): string => pick(SKINS[id]);
export const rarityName = (r: RarityId): string => pick(RARITIES[r]);
export const wearName = (w: WearId): string => pick(WEARS[w]);
export const upgradeName = (id: UpgradeId): string => pick(UPGRADES[id]?.name);
export const upgradeDesc = (id: UpgradeId): string => pick(UPGRADES[id]?.desc);
export const stageName = (stage: number): string => pick(STAGES[stage - 1]);

/** Every content name with its budget key, for the budget test. */
export function CONTENT_KEYS(): Array<[string, string, string]> {
  const rows: Array<[string, string, string]> = [];
  const add = (prefix: string, table: Record<string, Pair>) => {
    for (const [k, p] of Object.entries(table)) rows.push([prefix + k, p.en, p.ru]);
  };
  add("case.", CASES);
  add("weapon.", WEAPONS);
  add("skin.", SKINS);
  add("rarity.", RARITIES);
  add("wear.", WEARS);
  for (const [k, u] of Object.entries(UPGRADES)) {
    rows.push(["upgrade.name." + k, u.name.en, u.name.ru]);
    rows.push(["upgrade.desc." + k, u.desc.en, u.desc.ru]);
  }
  STAGES.forEach((p, i) => rows.push(["stage." + (i + 1), p.en, p.ru]));
  return rows;
}
