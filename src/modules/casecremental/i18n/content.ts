import type { CharmId } from "../sim/charms";
import type { PerkId } from "../sim/meta";
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
  mainframe: { en: "Mainframe", ru: "Мейнфрейм" },
  neon: { en: "Neon Nights", ru: "Ночной неон" },
  deepspace: { en: "Deep Space", ru: "Космос" },
  inferno: { en: "Inferno", ru: "Инферно" },
  vault1: { en: "Vault Case I", ru: "Сейф-кейс I" },
  vault2: { en: "Vault Case II", ru: "Сейф-кейс II" },
  vault3: { en: "Vault Case III", ru: "Сейф-кейс III" },
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
  vault1_legend: { en: "Event Horizon", ru: "Горизонт событий" },
  bc_knife: { en: "Field Marshal", ru: "Фельдмаршал" },
  mf_busline: { en: "Bus Line", ru: "Шина данных" },
  mf_heatsink: { en: "Heatsink", ru: "Радиатор" },
  mf_weave: { en: "Carbon Weave", ru: "Карбоновое плетение" },
  mf_board: { en: "Motherboard", ru: "Материнская плата" },
  mf_firewall: { en: "Firewall", ru: "Файрвол" },
  mf_overclock: { en: "Overclocked", ru: "Разгон" },
  mf_hexcore: { en: "Hex Core", ru: "Гекс-ядро" },
  mf_blackcarbon: { en: "Black Carbon", ru: "Чёрный карбон" },
  mf_panic: { en: "Kernel Panic", ru: "Паника ядра" },
  mf_lattice: { en: "Quantum Lattice", ru: "Квантовая решётка" },
  mf_root: { en: "Root Access", ru: "Root-доступ" },
  mf_zeroday: { en: "Zero Day", ru: "Нулевой день" },
  mf_knife: { en: "Blue Screen", ru: "Синий экран" },
  nn_drive: { en: "Night Drive", ru: "Ночная трасса" },
  nn_glow: { en: "Afterglow", ru: "Послесвечение" },
  nn_arcade: { en: "Arcade", ru: "Аркада" },
  nn_strip: { en: "Strip Light", ru: "Неоновая лента" },
  nn_retro: { en: "Retrowave", ru: "Ретровейв" },
  nn_sunset: { en: "Sunset Grid", ru: "Закатная сетка" },
  nn_lasertag: { en: "Laser Tag", ru: "Лазертаг" },
  nn_vapor: { en: "Vaporhaze", ru: "Вейпор-дымка" },
  nn_hotpink: { en: "Hot Pink", ru: "Ярко-розовый" },
  nn_outrun: { en: "Outrun", ru: "Аутран" },
  nn_demon: { en: "Neon Demon", ru: "Неоновый демон" },
  nn_racer: { en: "Midnight Racer", ru: "Полуночный гонщик" },
  nn_knife: { en: "Prism", ru: "Призма" },
  ds_stardust: { en: "Stardust", ru: "Звёздная пыль" },
  ds_darkmatter: { en: "Dark Matter", ru: "Тёмная материя" },
  ds_orbit: { en: "Orbit", ru: "Орбита" },
  ds_moonrock: { en: "Moonrock", ru: "Лунный камень" },
  ds_comet: { en: "Comet Tail", ru: "Хвост кометы" },
  ds_aurora: { en: "Aurora", ru: "Полярное сияние" },
  ds_pulsar: { en: "Pulsar", ru: "Пульсар" },
  ds_redgiant: { en: "Red Giant", ru: "Красный гигант" },
  ds_nebula: { en: "Nebula", ru: "Туманность" },
  ds_oilslick: { en: "Oil Slick", ru: "Нефтяная плёнка" },
  ds_cosmicray: { en: "Cosmic Ray", ru: "Космический луч" },
  ds_blackhole: { en: "Black Hole Sun", ru: "Солнце чёрной дыры" },
  ds_knife: { en: "Starforged", ru: "Звёздная ковка" },
  in_kindling: { en: "Kindling", ru: "Растопка" },
  in_cinder: { en: "Cinder", ru: "Пепел" },
  in_coals: { en: "Hot Coals", ru: "Горячие угли" },
  in_firebrand: { en: "Firebrand", ru: "Головня" },
  in_furnace: { en: "Furnace", ru: "Горн" },
  in_wildfire: { en: "Wildfire", ru: "Лесной пожар" },
  in_slag: { en: "Slag", ru: "Шлак" },
  in_brimstone: { en: "Brimstone", ru: "Сера" },
  in_hellfire: { en: "Hellfire", ru: "Адское пламя" },
  in_meltdown: { en: "Meltdown", ru: "Расплав" },
  in_phoenix: { en: "Phoenix", ru: "Феникс" },
  in_dragon: { en: "Dragon's Breath", ru: "Дыхание дракона" },
  in_knife: { en: "Forgeheart", ru: "Сердце горна" },
  vault2_legend: { en: "Overdrive", ru: "Овердрайв" },
  vault3_legend: { en: "Supernova", ru: "Сверхновая" },
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
  multiOpen: { name: { en: "Multi-open", ru: "Мультикейс" }, desc: { en: "BUY opens many cases", ru: "Несколько кейсов" } },
};

const CHARMS: Record<CharmId, { name: Pair; desc: Pair }> = {
  luckySeven: {
    name: { en: "Lucky Seven", ru: "Счастливая семёрка" },
    desc: { en: "Every 7th case: Classified+", ru: "Каждый 7-й: засекреч. и выше" },
  },
  rustBucket: {
    name: { en: "Rust Bucket", ru: "Ржавое ведро" },
    desc: { en: "Battle-Scarred pays like FN", ru: "Закалённое платит как новое" },
  },
  pityJar: {
    name: { en: "Pity Jar", ru: "Банка жалости" },
    desc: { en: "+1% Luck per Mil-Spec in a row", ru: "+1% удачи за армейское подряд" },
  },
  doubleTap: {
    name: { en: "Double Tap", ru: "Дабл-тап" },
    desc: { en: "StatTrak drops 3x as often", ru: "StatTrak в 3 раза чаще" },
  },
  ricochet: {
    name: { en: "Ricochet", ru: "Рикошет" },
    desc: { en: "A Covert gives a free case", ru: "Тайное даёт кейс бесплатно" },
  },
  goldRush: {
    name: { en: "Gold Rush", ru: "Золотая лихорадка" },
    desc: { en: "★ pays x10 + a golden hour", ru: "★ платит x10 + золотой час" },
  },
  insider: {
    name: { en: "Insider", ru: "Инсайдер" },
    desc: { en: "Cases cost 30% less", ru: "Кейсы на 30% дешевле" },
  },
  milSpecManiac: {
    name: { en: "Mil-Spec Maniac", ru: "Армейский маньяк" },
    desc: { en: "Mil-Spec x4, the rest x0.5", ru: "Армейское x4, прочее x0,5" },
  },
};

const PERKS: Record<PerkId, { name: Pair; desc: Pair }> = {
  startCash: {
    name: { en: "Starting Cash", ru: "Стартовый капитал" },
    desc: { en: "+$20 at the start of a run", ru: "+$20 в начале забега" },
  },
  luck: { name: { en: "Four-Leaf", ru: "Клевер" }, desc: { en: "+1 Luck level every run", ru: "+1 уровень удачи в забеге" } },
  charmSlot: { name: { en: "Charm Slot", ru: "Слот талисмана" }, desc: { en: "+1 charm slot", ru: "+1 слот талисмана" } },
  botAwake: { name: { en: "Early Bird", ru: "Ранняя пташка" }, desc: { en: "The bot starts awake", ru: "Бот просыпается сразу" } },
  biggerTray: { name: { en: "Bigger Tray", ru: "Большой лоток" }, desc: { en: "+4 claim tray slots", ru: "+4 места в лотке" } },
};

const STAGES: Pair[] = [
  { en: "Sober", ru: "Трезвый" },
  { en: "Buzzed", ru: "Навеселе" },
  { en: "High", ru: "Эйфория" },
  { en: "Tripping", ru: "Трип" },
  { en: "Unhinged", ru: "Без тормозов" },
];

export const caseName = (id: string): string => pick(CASES[id]);
export const weaponName = (w: WeaponId): string => pick(WEAPONS[w]);
export const skinName = (id: string): string => pick(SKINS[id]);
export const rarityName = (r: RarityId): string => pick(RARITIES[r]);
export const wearName = (w: WearId): string => pick(WEARS[w]);
export const upgradeName = (id: UpgradeId): string => pick(UPGRADES[id]?.name);
export const upgradeDesc = (id: UpgradeId): string => pick(UPGRADES[id]?.desc);
export const stageName = (stage: number): string => pick(STAGES[stage - 1]);
export const charmName = (id: CharmId): string => pick(CHARMS[id]?.name);
export const charmDesc = (id: CharmId): string => pick(CHARMS[id]?.desc);
export const perkName = (id: PerkId): string => pick(PERKS[id]?.name);
export const perkDesc = (id: PerkId): string => pick(PERKS[id]?.desc);

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
  for (const [k, c] of Object.entries(CHARMS)) {
    rows.push(["charm.name." + k, c.name.en, c.name.ru]);
    rows.push(["charm.desc." + k, c.desc.en, c.desc.ru]);
  }
  for (const [k, p] of Object.entries(PERKS)) {
    rows.push(["perk.name." + k, p.name.en, p.name.ru]);
    rows.push(["perk.desc." + k, p.desc.en, p.desc.ru]);
  }
  STAGES.forEach((p, i) => rows.push(["stage." + (i + 1), p.en, p.ru]));
  return rows;
}
