// ---------- Estado global ----------
let screen = "loading"; // loading | login | list | sheet
let character = null;
let currentPath = null;
let currentSha = null;
let saveStatus = ""; // "", "salvando", "salvo", "erro"
let saveError = "";
let saveTimer = null;
let listError = "";
let characterList = []; // [{ id, name, path }]
let loginError = "";
let loginLoading = false;

let campaignList = []; // [{ slug, name, role }]
let campaignsLoading = false;
let campaignsError = "";
let newCampaignName = "";

// Sub-aba da tela de campanhas: "mine" (as suas) ou "all" (todas, de todo mundo).
let campaignsSubTab = "mine";
let allCampaignsList = []; // [{ slug, name, gmUsername, description }]
let allCampaignsLoading = false;
let allCampaignsError = "";

let currentCampaignSlug = null;
let currentCampaign = null;   // { campaign, members, linked, membersSha, linkedSha }
let campaignDashError = "";
let linkOwnerInput = "";
let linkCharIdInput = "";
let campaignDescSaving = false;
let campaignDescSaved = false;

// Adição de monstros em massa no painel da campanha (só o mestre vê isso).
let showBulkMonsterAdd = false;
let bulkMonsterError = "";

// ---------- Bestiário global (aba "Monstros") ----------
// Independe de campanha: todos os monstros criados por todos os usuários ficam
// visíveis a todo mundo, mas só quem criou pode editar ou apagar o próprio monstro.
let bestiaryList = []; // [{ id, name, level, hp, mp, imageUrl, description, createdBy, createdAt }]
let bestiarySha = null;
let bestiaryLoading = false;
let bestiaryError = "";
let showNewMonsterForm = false;
let newMonsterFormError = "";
let editingMonsterId = null; // id do monstro do bestiário em edição (só o dono pode editar)
let editMonsterFormError = "";

let activeTab = "class";
let toast = null;
let classConfirm = false;
let showHistory = false;

// Controle de permissão de edição na ficha: true quando a pessoa está
// vendo o personagem de outro jogador (via campanha) e não é o mestre.
let sheetReadOnly = false;
// Slug da campanha de origem, quando a ficha foi aberta a partir de um
// painel de campanha (permite o botão "voltar para campanha").
let sheetCampaignSlug = null;

let showCampaignHistory = false;
let campaignHistoryLoading = false;
let campaignHistoryEntries = [];

let monsterFormError = "";

// ---------- Livro do sistema (arquivo único, upload livre por enquanto) ----------
let systemBookMeta = null;
let systemBookMetaSha = null;
let systemBookLoading = false;
let systemBookUploading = false;
let systemBookError = "";

function formatFileSize(bytes) {
  if (bytes === undefined || bytes === null) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function uid() {
  return Math.random().toString(36).slice(2, 8);
}

// Paleta usada para diferenciar visualmente cada personagem (histórico da
// campanha, cartões de personagens vinculados etc.). A cor é derivada de
// forma determinística do dono+id, então o mesmo personagem sempre usa a
// mesma cor, mesmo em sessões diferentes.
const CHAR_COLOR_PALETTE = [
  "#8b5cf6", "#00c2b8", "#f0b429", "#ff6b9d", "#4dd0e1",
  "#ff9f43", "#5c7cfa", "#e64980", "#20c997", "#fab005",
];
function colorForCharacter(owner, characterId) {
  const str = `${owner}/${characterId}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  return CHAR_COLOR_PALETTE[hash % CHAR_COLOR_PALETTE.length];
}

// Lista oficial de perícias de Ordem Paranormal + "Magia" (perícia extra desta ficha,
// usada pra testes de ataque mágico). Luta, Pontaria e Magia são as únicas usadas nos
// testes de ataque e por isso não podem ser removidas da ficha.
const OFFICIAL_SKILLS = [
  "Adestramento", "Atletismo", "Ciências", "Crime",
  "Diplomacia", "Enganação", "Fortitude", "Furtividade", "Iniciativa", "Intimidação",
  "Intuição", "Investigação", "Luta", "Medicina", "Percepção", "Pilotagem",
  "Pontaria", "Reflexos", "Sobrevivência", "Tecnologia",
  "Vontade", "Magia",
];
const MANDATORY_SKILLS = ["Luta", "Pontaria", "Magia"];

// Treinamento: Destreinado (+0), Treinado (+5), Veterano (+10), Expert (+15).
const TRAINING_LEVELS = [
  { value: 0, label: "Destreinado" },
  { value: 5, label: "Treinado" },
  { value: 10, label: "Veterano" },
  { value: 15, label: "Expert" },
];

function skillBonus(skill) {
  return Number(skill.training || 0) + Number(skill.buff || 0);
}

function emptyCharacter() {
  const skills = OFFICIAL_SKILLS.map((name) => ({
    id: uid(),
    name,
    training: 0,
    buff: 0,
    mandatory: MANDATORY_SKILLS.includes(name),
  }));
  const lutaId = skills.find((s) => s.name === "Luta").id;
  return {
    basic: { name: "Investigador Sem Nome", photoUrl: "", age: "", weight: "", height: "", financialStatus: "Estável" },
    classInfo: { skipped: false, name: "", fields: [], notes: "" },
    resources: { level: 1, hpCurrent: 20, hpMax: 20, mpCurrent: 20, mpMax: 20, xp: 0, gold: 0 },
    skills,
    abilities: [],
    items: [],
    attacks: [{ id: uid(), name: "Faca de Combate", dice: "1d6+1", critRange: "20", critMultiplier: "2", skillId: lutaId }],
    rollHistory: [],
  };
}

// Garante que todas as perícias oficiais existam (com treinamento/buff), que Luta,
// Pontaria e Magia estejam marcadas como obrigatórias, e migra fichas antigas que
// ainda usavam o modelo { bonus, dice } por perícia — tudo isso pra fichas criadas
// antes desses recursos existirem não quebrarem quando abertas.
function normalizeCharacter(character) {
  if (!character.skills) character.skills = [];

  character.skills.forEach((s) => {
    if (s.training === undefined) {
      // Perícia do modelo antigo: usa o bônus livre existente como "buff" pra não perder o valor.
      s.training = 0;
      s.buff = s.bonus || 0;
    }
    if (s.buff === undefined) s.buff = 0;
    delete s.dice;
    delete s.bonus;
  });

  OFFICIAL_SKILLS.forEach((name) => {
    const existing = character.skills.find((s) => s.name === name);
    if (existing) existing.mandatory = MANDATORY_SKILLS.includes(name) ? true : existing.mandatory;
    else character.skills.push({ id: uid(), name, training: 0, buff: 0, mandatory: MANDATORY_SKILLS.includes(name) });
  });

  if (!character.attacks) character.attacks = [];
  character.attacks.forEach((a) => {
    if (a.skillId === undefined) a.skillId = null;
  });

  if (!character.rollHistory) character.rollHistory = [];

  if (!character.classInfo) character.classInfo = { skipped: false, name: "", fields: [], notes: "" };
  if (character.classInfo.notes === undefined) character.classInfo.notes = "";

  return character;
}

// XP necessário pra subir de CADA nível (índice 0 = do nível 1 pro 2, etc).
// Depois do último valor da lista, cada nível seguinte soma mais 5000.
const XP_TABLE = [100, 500, 2500, 5000, 10000];

function xpNeededForLevel(level) {
  const index = level - 1;
  if (index < XP_TABLE.length) return XP_TABLE[index];
  return XP_TABLE[XP_TABLE.length - 1] + (index - XP_TABLE.length + 1) * 5000;
}

const MAX_LEVEL = 100;
const MAX_XP_PER_ADD = 2000;

// Aplica XP ganho, subindo quantos níveis forem necessários e mantendo o restante.
// Respeita o nível máximo (100): ao atingi-lo, o personagem para de subir e o
// excedente de XP simplesmente não é mais consumido.
function applyXpGain(character, amount) {
  const clampedAmount = Math.max(0, Math.min(amount, MAX_XP_PER_ADD));
  let xp = character.resources.xp + clampedAmount;
  let level = character.resources.level;
  let levelsGained = 0;
  while (level < MAX_LEVEL && xp >= xpNeededForLevel(level)) {
    xp -= xpNeededForLevel(level);
    level += 1;
    levelsGained += 1;
  }
  if (level >= MAX_LEVEL) {
    level = MAX_LEVEL;
  }
  character.resources.level = level;
  character.resources.xp = xp;
  for (let i = 0; i < levelsGained; i++) {
    character.resources.hpMax += 10;
    character.resources.hpCurrent += 10;
    character.resources.mpMax += 20;
    character.resources.mpCurrent += 20;
  }
  return levelsGained;
}

function slugify(name) {
  return (
    name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "campanha"
  );
}

// Lista todas as campanhas em que o usuário atual é membro (GM ou jogador).
async function loadCampaignsForUser(username) {
  const dirs = await listDirectory("campaigns");
  const slugs = dirs.filter((d) => d.type === "dir").map((d) => d.name);

  const results = await Promise.all(
    slugs.map(async (slug) => {
      try {
        const campaignRes = await readJsonFile(`campaigns/${slug}/campaign.json`);
        const membersRes = await readJsonFile(`campaigns/${slug}/members.json`);
        if (!campaignRes || !membersRes) return null;
        const member = membersRes.data.find((m) => m.username === username);
        if (!member) return null;
        return { slug, name: campaignRes.data.name, role: member.role };
      } catch {
        return null;
      }
    })
  );
  return results.filter(Boolean);
}

// Lista TODAS as campanhas existentes no repositório, de qualquer usuário —
// usada na sub-aba "Todas as Campanhas", pra dar pra ver (só ver) campanhas
// de outras pessoas mesmo sem ser membro delas.
async function loadAllCampaigns() {
  const dirs = await listDirectory("campaigns");
  const slugs = dirs.filter((d) => d.type === "dir").map((d) => d.name);

  const results = await Promise.all(
    slugs.map(async (slug) => {
      try {
        const campaignRes = await readJsonFile(`campaigns/${slug}/campaign.json`);
        if (!campaignRes) return null;
        return {
          slug,
          name: campaignRes.data.name,
          gmUsername: campaignRes.data.gmUsername,
          description: campaignRes.data.description || "",
        };
      } catch {
        return null;
      }
    })
  );
  return results.filter(Boolean);
}

async function createCampaign(name, gmUsername) {
  const slug = slugify(name) + "-" + uid();
  const campaign = { name, gmUsername, description: "", createdAt: new Date().toISOString() };
  const members = [{ username: gmUsername, role: "gm" }];
  const linked = [];
  const monsters = [];

  await writeJsonFile(`campaigns/${slug}/campaign.json`, campaign, null, `feat: cria campanha "${name}"`);
  await writeJsonFile(`campaigns/${slug}/members.json`, members, null, `feat: membros iniciais de "${name}"`);
  await writeJsonFile(`campaigns/${slug}/linked_characters.json`, linked, null, `feat: vínculos iniciais de "${name}"`);
  await writeJsonFile(`campaigns/${slug}/monsters.json`, monsters, null, `feat: monstros iniciais de "${name}"`);

  return slug;
}

// Busca dados resumidos (nome, foto, classe, HP/MP, XP) de cada personagem
// vinculado, pra exibir no painel da campanha sem precisar abrir a ficha.
async function hydrateLinkedCharacters(linked) {
  return Promise.all(
    linked.map(async (entry) => {
      const color = colorForCharacter(entry.characterOwner, entry.characterId);
      try {
        const res = await readJsonFile(`users/${entry.characterOwner}/characters/${entry.characterId}.json`);
        if (!res) return { ...entry, color, missing: true };
        const c = res.data;
        return {
          ...entry,
          color,
          name: c.basic?.name || entry.characterId,
          photoUrl: c.basic?.photoUrl || "",
          className: c.classInfo && !c.classInfo.skipped ? (c.classInfo.name || "") : "",
          level: c.resources?.level ?? 1,
          hpCurrent: c.resources?.hpCurrent ?? 0,
          hpMax: c.resources?.hpMax ?? 0,
          mpCurrent: c.resources?.mpCurrent ?? 0,
          mpMax: c.resources?.mpMax ?? 0,
          xp: c.resources?.xp ?? 0,
          xpNeeded: xpNeededForLevel(c.resources?.level ?? 1),
        };
      } catch {
        return { ...entry, color, missing: true };
      }
    })
  );
}

async function loadCampaignDashboard(slug) {
  const campaignRes = await readJsonFile(`campaigns/${slug}/campaign.json`);
  const membersRes = await readJsonFile(`campaigns/${slug}/members.json`);
  const linkedRes = await readJsonFile(`campaigns/${slug}/linked_characters.json`);
  const monstersRes = await readJsonFile(`campaigns/${slug}/monsters.json`);
  const linkedHydrated = await hydrateLinkedCharacters(linkedRes.data);
  return {
    campaign: campaignRes.data,
    campaignSha: campaignRes.sha,
    members: membersRes.data,
    membersSha: membersRes.sha,
    linked: linkedRes.data,
    linkedSha: linkedRes.sha,
    linkedHydrated,
    monsters: monstersRes ? monstersRes.data : [],
    monstersSha: monstersRes ? monstersRes.sha : null,
  };
}

// Salva a descrição da campanha. Só o mestre edita (a interface já esconde o
// campo de edição de quem não é mestre), mas a checagem de sha continua
// protegendo contra sobrescrever uma edição concorrente.
async function saveCampaignDescription(slug, description, knownSha) {
  const res = await readJsonFile(`campaigns/${slug}/campaign.json`);
  const sha = res ? res.sha : knownSha;
  const campaign = res ? res.data : {};
  campaign.description = description;
  const newSha = await writeJsonFile(`campaigns/${slug}/campaign.json`, campaign, sha, `chore: atualiza descrição da campanha`);
  return newSha;
}

// Junta o histórico de rolagens de todos os personagens vinculados à
// campanha, marcado com a cor/foto de cada um, pra um painel único visível
// a todos os membros (mestre e jogadores).
async function loadCampaignRollHistory(slug, linked) {
  const perCharacter = await Promise.all(
    linked.map(async (entry) => {
      const color = colorForCharacter(entry.characterOwner, entry.characterId);
      try {
        const res = await readJsonFile(`users/${entry.characterOwner}/characters/${entry.characterId}.json`);
        if (!res) return [];
        const c = res.data;
        const name = c.basic?.name || entry.characterId;
        const photoUrl = c.basic?.photoUrl || "";
        return (c.rollHistory || []).map((h) => ({ ...h, charName: name, charPhoto: photoUrl, color }));
      } catch {
        return [];
      }
    })
  );
  const all = perCharacter.flat();
  all.sort((a, b) => new Date(b.time) - new Date(a.time));
  return all.slice(0, 60);
}

async function addMonster(slug, monster) {
  const res = await readJsonFile(`campaigns/${slug}/monsters.json`);
  const list = res ? res.data : [];
  const sha = res ? res.sha : null;
  const updated = [...list, { id: uid(), ...monster }];
  await writeJsonFile(`campaigns/${slug}/monsters.json`, updated, sha, `feat: adiciona monstro "${monster.name}"`);
}

async function removeMonster(slug, monsterId) {
  const res = await readJsonFile(`campaigns/${slug}/monsters.json`);
  if (!res) return;
  const updated = res.data.filter((m) => m.id !== monsterId);
  await writeJsonFile(`campaigns/${slug}/monsters.json`, updated, res.sha, `chore: remove monstro`);
}

// Cria vários monstros de uma vez (só o mestre usa isso), num único commit.
async function addMonstersBulk(slug, monsters) {
  const res = await readJsonFile(`campaigns/${slug}/monsters.json`);
  const list = res ? res.data : [];
  const sha = res ? res.sha : null;
  const updated = [...list, ...monsters.map((m) => ({ id: uid(), ...m }))];
  await writeJsonFile(`campaigns/${slug}/monsters.json`, updated, sha, `feat: adiciona ${monsters.length} monstro(s) em massa`);
}

// Parseia o texto colado no campo de adição em massa. Uma linha por monstro,
// campos separados por vírgula: Nome, Nível, HP, MP (nível/HP/MP são opcionais).
function parseBulkMonsterText(text) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(",").map((p) => p.trim());
      const [name, level, hp, mp] = parts;
      return {
        name: name || "Monstro sem nome",
        level: level && !isNaN(Number(level)) ? Number(level) : 1,
        hp: hp && !isNaN(Number(hp)) ? Number(hp) : 0,
        mp: mp && !isNaN(Number(mp)) ? Number(mp) : 0,
      };
    });
}

// ---------- Bestiário global (independente de campanha) ----------
// Fica salvo em bestiary/monsters.json, um único arquivo compartilhado por
// todo mundo: qualquer pessoa vê todos os monstros, mas só quem criou (campo
// createdBy) pode editar ou apagar o próprio monstro.
async function loadBestiary() {
  const res = await readJsonFile("bestiary/monsters.json");
  return { data: res ? res.data : [], sha: res ? res.sha : null };
}

async function createBestiaryMonster(monster, ownerUsername) {
  const res = await readJsonFile("bestiary/monsters.json");
  const list = res ? res.data : [];
  const sha = res ? res.sha : null;
  const entry = {
    id: uid(),
    name: monster.name,
    level: monster.level,
    hp: monster.hp,
    mp: monster.mp,
    imageUrl: monster.imageUrl || "",
    description: monster.description || "",
    createdBy: ownerUsername,
    createdAt: new Date().toISOString(),
  };
  const updated = [...list, entry];
  await writeJsonFile("bestiary/monsters.json", updated, sha, `feat: adiciona monstro "${monster.name}" ao bestiário`);
  return entry;
}

async function updateBestiaryMonster(monsterId, updates, ownerUsername) {
  const res = await readJsonFile("bestiary/monsters.json");
  if (!res) throw new Error("Bestiário vazio.");
  const monster = res.data.find((m) => m.id === monsterId);
  if (!monster) throw new Error("Monstro não encontrado.");
  if (monster.createdBy !== ownerUsername) throw new Error("Só quem criou este monstro pode editá-lo.");
  Object.assign(monster, updates);
  await writeJsonFile("bestiary/monsters.json", res.data, res.sha, `chore: edita monstro "${monster.name}" do bestiário`);
}

async function deleteBestiaryMonster(monsterId, ownerUsername) {
  const res = await readJsonFile("bestiary/monsters.json");
  if (!res) return;
  const monster = res.data.find((m) => m.id === monsterId);
  if (!monster) return;
  if (monster.createdBy !== ownerUsername) throw new Error("Só quem criou este monstro pode apagá-lo.");
  const updated = res.data.filter((m) => m.id !== monsterId);
  await writeJsonFile("bestiary/monsters.json", updated, res.sha, `chore: remove monstro do bestiário`);
}

async function linkCharacterToCampaign(slug, ownerUsername, characterId) {
  const linkedRes = await readJsonFile(`campaigns/${slug}/linked_characters.json`);
  const already = linkedRes.data.some((e) => e.characterOwner === ownerUsername && e.characterId === characterId);
  if (already) throw new Error("Esse personagem já está vinculado a esta campanha.");

  const charCheck = await readJsonFile(`users/${ownerUsername}/characters/${characterId}.json`);
  if (!charCheck) throw new Error("Não foi encontrado nenhum personagem com esse usuário/ID.");

  const updated = [...linkedRes.data, { characterOwner: ownerUsername, characterId, linkedAt: new Date().toISOString() }];
  await writeJsonFile(`campaigns/${slug}/linked_characters.json`, updated, linkedRes.sha, `chore: vincula ${ownerUsername}/${characterId}`);
}

async function unlinkCharacterFromCampaign(slug, ownerUsername, characterId) {
  const linkedRes = await readJsonFile(`campaigns/${slug}/linked_characters.json`);
  const updated = linkedRes.data.filter((e) => !(e.characterOwner === ownerUsername && e.characterId === characterId));
  await writeJsonFile(`campaigns/${slug}/linked_characters.json`, updated, linkedRes.sha, `chore: desvincula ${ownerUsername}/${characterId}`);
}

const TABS = [
  { id: "class", label: "Classe", icon: "layers" },
  { id: "abilities", label: "Habilidades", icon: "wand" },
  { id: "items", label: "Itens", icon: "backpack" },
  { id: "attacks", label: "Ataques", icon: "swords" },
];

const ICONS = {
  user: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 4-6 8-6s8 2 8 6"/></svg>',
  layers: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>',
  heart: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/></svg>',
  sparkles: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8"/></svg>',
  wand: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 4V2M15 16v-2M8 9h2M20 9h2M17.8 11.8L19 13M17.8 6.2L19 5M3 21l9-9M12.2 6.2L11 5"/></svg>',
  backpack: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 8a6 6 0 0 1 12 0v11a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1z"/><path d="M9 8V6a3 3 0 0 1 6 0v2M9 13h6M10 22v-4h4v4"/></svg>',
  swords: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.5 17.5L3 6V3h3l11.5 11.5M13 19l6-6M16 16l4 4M19 21l2-2"/></svg>',
  dice: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1" fill="currentColor"/><circle cx="16" cy="8" r="1" fill="currentColor"/><circle cx="8" cy="16" r="1" fill="currentColor"/><circle cx="16" cy="16" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/></svg>',
  trash: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>',
  plus: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>',
  image: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>',
};

// ---------- Rolagem de dados ----------
function rollDice(notation) {
  const m = notation.trim().replace(/\s/g, "").match(/^(\d+)d(\d+)([+-]\d+)?$/i);
  if (!m) return null;
  const count = parseInt(m[1], 10);
  const sides = parseInt(m[2], 10);
  const mod = m[3] ? parseInt(m[3], 10) : 0;
  if (count < 1 || count > 100 || sides < 2) return null;
  const rolls = Array.from({ length: count }, () => Math.floor(Math.random() * sides) + 1);
  const total = rolls.reduce((a, b) => a + b, 0) + mod;
  return { notation, rolls, mod, total, count, sides };
}

// Falha crítica: só se aplica a testes de 1d20 puro (perícias e testes de
// ataque), quando o dado sai 1 natural.
function isNat1D20(rollResult) {
  return !!rollResult && rollResult.count === 1 && rollResult.sides === 20 && rollResult.rolls[0] === 1;
}

function parseCritThreshold(critRange) {
  if (!critRange) return null;
  const parts = critRange
    .split("-")
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !isNaN(n));
  if (parts.length === 0) return null;
  return Math.min(...parts);
}

function doRoll(dice, bonus, label, critRange, critMultiplier) {
  const base = rollDice(dice);
  if (!base) {
    toast = { label: "Erro", roll: `Notação inválida: "${dice}"`, total: null };
    render();
    setTimeout(() => { toast = null; render(); }, 3000);
    return;
  }
  const result = bonus ? { ...base, mod: base.mod + bonus, total: base.total + bonus } : base;

  const threshold = parseCritThreshold(critRange);
  const multiplier = parseFloat(critMultiplier) || 1;
  const isCrit = threshold !== null && result.rolls.some((r) => r >= threshold);
  const isFumble = !isCrit && isNat1D20(base);

  let finalTotal = result.total;
  let critNote = "";
  if (isCrit && multiplier > 1) {
    const diceSum = result.rolls.reduce((a, b) => a + b, 0);
    finalTotal = diceSum * multiplier + result.mod;
    critNote = ` — CRÍTICO ×${multiplier}!`;
  } else if (isCrit) {
    critNote = " — CRÍTICO!";
  } else if (isFumble) {
    critNote = " — FALHA CRÍTICA!";
  }

  const finalToast = {
    label: label + critNote,
    roll: `${result.notation} → [${result.rolls.join(", ")}] ${result.mod >= 0 ? "+" : ""}${result.mod}`,
    total: finalTotal,
    crit: isCrit,
    fumble: isFumble,
  };
  animateRoll(label, base.sides, base.count, finalToast);
}

// Anima a rolagem (números "girando" por um instante, só na tela de quem rolou)
// antes de revelar o resultado final — inclusive o flash de crítico/falha crítica.
function animateRoll(baseLabel, sides, diceCount, finalToast) {
  let spins = 0;
  const maxSpins = 7;
  const step = () => {
    spins++;
    if (spins > maxSpins) {
      toast = finalToast;
      pushRollHistory(finalToast);
      render();
      setTimeout(() => { toast = null; render(); }, 4500);
      return;
    }
    const fake = Array.from({ length: diceCount || 1 }, () => 1 + Math.floor(Math.random() * (sides || 20)));
    toast = { rolling: true, label: baseLabel, roll: `[${fake.join(", ")}]`, total: null };
    render();
    setTimeout(step, 70);
  };
  step();
}

// Guarda as últimas rolagens na própria ficha (persistida no GitHub junto com o resto),
// assim tanto o jogador quanto o mestre (quando abre a ficha vinculada na campanha)
// enxergam o mesmo histórico.
function pushRollHistory(entry) {
  if (!character.rollHistory) character.rollHistory = [];
  character.rollHistory.unshift({
    time: new Date().toISOString(),
    label: entry.label,
    roll: entry.roll,
    total: entry.total,
    crit: !!entry.crit,
    fumble: !!entry.fumble,
  });
  if (character.rollHistory.length > 30) character.rollHistory.length = 30;
  scheduleSave();
}

// Teste de ataque: rola a perícia escolhida (com o bônus dela), checa crítico
// nessa rolagem e só então rola o dado de dano — multiplicando o dano se crítico.
function doAttackTest(attack) {
  const skill = character.skills.find((s) => s.id === attack.skillId);
  if (!skill) {
    toast = { label: "Erro", roll: "Escolha uma perícia para este ataque antes de testar.", total: null };
    render();
    setTimeout(() => { toast = null; render(); }, 3000);
    return;
  }

  const testRoll = rollDice("1d20");
  const testBonus = skillBonus(skill);
  const testTotal = testRoll.total + testBonus;

  const dmgRoll = rollDice(attack.dice);
  if (!dmgRoll) {
    toast = { label: "Erro", roll: `Notação de dano inválida: "${attack.dice}"`, total: null };
    render();
    setTimeout(() => { toast = null; render(); }, 3000);
    return;
  }

  const threshold = parseCritThreshold(attack.critRange);
  const multiplier = parseFloat(attack.critMultiplier) || 1;
  const isCrit = threshold !== null && testRoll.rolls.some((r) => r >= threshold);
  const isFumble = !isCrit && isNat1D20(testRoll);

  let dmgTotal = dmgRoll.total;
  let critNote = "";
  if (isCrit && multiplier > 1) {
    const diceSum = dmgRoll.rolls.reduce((a, b) => a + b, 0);
    dmgTotal = diceSum * multiplier + dmgRoll.mod;
    critNote = ` — CRÍTICO ×${multiplier}!`;
  } else if (isCrit) {
    critNote = " — CRÍTICO!";
  } else if (isFumble) {
    critNote = " — FALHA CRÍTICA!";
    dmgTotal = 0;
  }

  const finalToast = {
    label: `Ataque: ${attack.name}${critNote}`,
    roll: `Teste (${skill.name}): 1d20 → [${testRoll.rolls.join(", ")}] ${testBonus >= 0 ? "+" : ""}${testBonus} = ${testTotal}  |  Dano: ${dmgRoll.notation} → [${dmgRoll.rolls.join(", ")}]`,
    total: dmgTotal,
    crit: isCrit,
    fumble: isFumble,
  };
  animateRoll(`Ataque: ${attack.name}`, 20, 1, finalToast);
}

// Campo reutilizável de "anexar imagem" por upload de arquivo (em vez de colar
// uma URL) — usado nos formulários de monstro. idPrefix vira o id do input
// escondido que guarda o data URL; os handlers ficam em attachEvents().
function renderImageUploadField(idPrefix, currentUrl) {
  return `
    <div class="image-upload-row">
      <label class="image-upload-preview" for="${idPrefix}-file">
        ${currentUrl ? `<img src="${esc(currentUrl)}" alt="">` : ICONS.image}
      </label>
      <input type="file" accept="image/*" id="${idPrefix}-file" data-image-target="${idPrefix}" hidden />
      <input type="hidden" id="${idPrefix}" value="${esc(currentUrl || "")}" />
      <label for="${idPrefix}-file" class="btn-link image-upload-label">${currentUrl ? "trocar imagem" : "escolher imagem"}</label>
    </div>`;
}

function esc(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

// Lê um arquivo de imagem escolhido pelo usuário e devolve como data URL —
// método mais acessível que pedir pra colar uma URL (não exige hospedar a
// imagem em outro site antes). Fica salvo como texto dentro do próprio JSON.
function readImageFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file) return resolve("");
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Não foi possível ler a imagem."));
    reader.readAsDataURL(file);
  });
}

// ---------- Salvamento automático ----------
function scheduleSave() {
  if (sheetReadOnly) return;
  saveStatus = "editando";
  clearTimeout(saveTimer);
  saveTimer = setTimeout(performSave, 1200);
  updateSaveIndicator();
}

async function performSave() {
  if (!currentPath) return;
  saveStatus = "salvando";
  updateSaveIndicator();
  try {
    const newSha = await writeJsonFile(currentPath, character, currentSha, `chore: atualiza ${character.basic.name}`);
    currentSha = newSha;
    saveStatus = "salvo";
  } catch (err) {
    saveStatus = "erro";
    saveError = err.message || String(err);
    if (err instanceof ConflictError) {
      try {
        const fresh = await readJsonFile(currentPath);
        if (fresh) {
          currentSha = fresh.sha;
          saveError += " Recarregando dados mais recentes...";
        }
      } catch (_) {}
    }
  }
  updateSaveIndicator();
}

function updateSaveIndicator() {
  const el = document.getElementById("save-indicator");
  if (!el) return;
  const map = {
    editando: "Editando...",
    salvando: "Salvando no GitHub...",
    salvo: "Salvo ✓",
    erro: `Erro ao salvar: ${esc(saveError)}`,
    "": "",
  };
  el.textContent = map[saveStatus] || "";
  el.className = "save-indicator " + (saveStatus === "erro" ? "save-error" : "");
}

// ---------- Telas ----------
function renderLoading() {
  return `<div class="center-box"><p>Carregando...</p></div>`;
}

function renderLogin() {
  return `
    <div class="center-box login-screen">
      <div class="login-card">
        <div class="eyebrow">Arquivo da Ordem</div>
        <h1 class="char-name" style="margin-bottom:1rem;">Acesso Restrito</h1>
        <ol class="login-steps">
          <li>Acesse <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noreferrer">criar novo token</a></li>
          <li>Repository access → apenas o repositório de dados (ex: <code>${esc(GITHUB_CONFIG.owner)}/${esc(GITHUB_CONFIG.repo)}</code>)</li>
          <li>Permissions → Contents: <strong>Read and write</strong></li>
          <li>Cole o token abaixo</li>
        </ol>
        <input type="password" id="token-input" placeholder="github_pat_..." class="token-input" />
        ${loginError ? `<p class="login-error">${esc(loginError)}</p>` : ""}
        <button class="btn btn-stamp" id="login-btn" ${loginLoading ? "disabled" : ""} style="width:100%;margin-top:10px;">
          ${loginLoading ? "Validando..." : "Entrar"}
        </button>
        <p class="helper-text" style="margin-top:14px;font-size:12px;">
          O token fica salvo só no seu navegador (localStorage), nunca é enviado a nenhum servidor além do GitHub.
        </p>
      </div>
    </div>`;
}

function renderNavTabs(active) {
  return `
    <div class="nav-tabs">
      <button class="nav-tab ${active === "characters" ? "active" : ""}" data-action="nav-characters">Meus Personagens</button>
      <button class="nav-tab ${active === "campaigns" ? "active" : ""}" data-action="nav-campaigns">Campanhas</button>
      <button class="nav-tab ${active === "monsters" ? "active" : ""}" data-action="nav-monsters">Monstros</button>
      <button class="nav-tab ${active === "system" ? "active" : ""}" data-action="nav-system">Livro do Sistema</button>
    </div>`;
}

function renderList() {
  const user = getStoredUser();
  const items = characterList
    .map(
      (c) => `
      <div class="char-list-item">
        <button class="char-list-open" data-action="open-character" data-path="${esc(c.path)}">
          <span>${esc(c.name)}</span>
          <span class="char-list-arrow">→</span>
        </button>
        <button class="btn-copy-id" data-action="copy-id" data-id="${esc(c.id)}">ID: ${esc(c.id)} (copiar)</button>
      </div>`
    )
    .join("");

  return `
    <div class="center-box">
      <div class="login-card" style="max-width:480px;">
        <div class="eyebrow">Conectado como ${esc(user?.login || "")}</div>
        ${renderNavTabs("characters")}
        <h1 class="char-name" style="margin-bottom:1rem;">Meus Personagens</h1>
        <p class="helper-text" style="margin-bottom:10px;">
          Pra vincular um personagem a uma campanha, o mestre vai pedir seu username do GitHub e o ID mostrado abaixo de cada ficha.
        </p>
        ${listError ? `<p class="login-error">${esc(listError)}</p>` : ""}
        ${items || `<p class="helper-text">Nenhum personagem ainda.</p>`}
        <button class="btn btn-teal" data-action="new-character" style="width:100%;margin-top:14px;">
          + Criar novo personagem
        </button>
        <button class="btn btn-teal" data-action="logout" style="margin-top:14px;display:block;">Sair</button>
      </div>
    </div>`;
}

function renderCampaigns() {
  const user = getStoredUser();
  const mineItems = campaignList
    .map(
      (c) => `
      <div class="char-list-item">
        <button class="char-list-open" data-action="open-campaign" data-slug="${esc(c.slug)}">
          <span>${esc(c.name)} <span class="role-tag">${c.role === "gm" ? "mestre" : "jogador"}</span></span>
          <span class="char-list-arrow">→</span>
        </button>
      </div>`
    )
    .join("");

  const allItems = allCampaignsList
    .map(
      (c) => `
      <div class="char-list-item">
        <button class="char-list-open" data-action="open-campaign" data-slug="${esc(c.slug)}">
          <span>
            ${esc(c.name)} <span class="role-tag">mestre: ${esc(c.gmUsername)}</span>
            ${c.description ? `<div class="campaign-preview-desc">${esc(c.description)}</div>` : ""}
          </span>
          <span class="char-list-arrow">→</span>
        </button>
      </div>`
    )
    .join("");

  const isMine = campaignsSubTab === "mine";

  return `
    <div class="center-box">
      <div class="login-card" style="max-width:480px;">
        <div class="eyebrow">Conectado como ${esc(user?.login || "")}</div>
        ${renderNavTabs("campaigns")}
        <h1 class="char-name" style="margin-bottom:1rem;">Campanhas</h1>

        <div class="sub-tabs">
          <button class="sub-tab ${isMine ? "active" : ""}" data-action="campaigns-subtab-mine">Minhas Campanhas</button>
          <button class="sub-tab ${!isMine ? "active" : ""}" data-action="campaigns-subtab-all">Todas as Campanhas</button>
        </div>

        ${
          isMine
            ? `
          ${campaignsError ? `<p class="login-error">${esc(campaignsError)}</p>` : ""}
          ${campaignsLoading ? `<p class="helper-text">Carregando...</p>` : mineItems || `<p class="helper-text">Nenhuma campanha ainda.</p>`}
          <div style="margin-top:14px;display:flex;gap:8px;">
            <input type="text" id="new-campaign-name" placeholder="Nome da nova campanha" value="${esc(newCampaignName)}" />
            <button class="btn btn-stamp" data-action="create-campaign">Criar</button>
          </div>`
            : `
          <p class="helper-text" style="margin-bottom:10px;">Todas as campanhas do repositório, de qualquer mestre — dá pra abrir e ver, mas só o mestre e os donos dos personagens vinculados podem editar.</p>
          ${allCampaignsError ? `<p class="login-error">${esc(allCampaignsError)}</p>` : ""}
          ${allCampaignsLoading ? `<p class="helper-text">Carregando...</p>` : allItems || `<p class="helper-text">Nenhuma campanha encontrada.</p>`}`
        }

        <button class="btn btn-teal" data-action="logout" style="margin-top:14px;display:block;">Sair</button>
      </div>
    </div>`;
}

function miniBar(current, max, color) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (current / max) * 100)) : 0;
  return `<div class="mini-bar-track"><div class="mini-bar-fill" style="width:${pct}%;background:${color};"></div></div>`;
}

function renderCampaignDashboard() {
  const user = getStoredUser();
  const cd = currentCampaign;
  if (!cd) return `<div class="center-box"><p>Carregando campanha...</p></div>`;

  const isGm = cd.members.some((m) => m.username === user.login && m.role === "gm");
  const hydrated = cd.linkedHydrated || [];

  const linkedItems = hydrated
    .map((entry) => {
      if (entry.missing) {
        return `
        <li class="char-card" style="border-color:${entry.color};">
          <div class="char-card-top">
            <span><strong>${esc(entry.characterOwner)}</strong> — ${esc(entry.characterId)} <span class="helper-text">(não encontrado)</span></span>
            ${isGm ? `<button class="btn-link danger" data-action="unlink-character" data-owner="${esc(entry.characterOwner)}" data-id="${esc(entry.characterId)}">remover</button>` : ""}
          </div>
        </li>`;
      }
      const xpPct = entry.xpNeeded > 0 ? Math.max(0, Math.min(100, (entry.xp / entry.xpNeeded) * 100)) : 0;
      return `
      <li class="char-card" style="border-color:${entry.color};">
        <div class="char-card-top">
          <div class="char-card-identity">
            <div class="char-card-avatar" style="border-color:${entry.color};">
              ${entry.photoUrl ? `<img src="${esc(entry.photoUrl)}" alt="">` : ICONS.user}
            </div>
            <div>
              <div class="char-card-name">${esc(entry.name)}</div>
              <div class="char-card-meta">
                Nv. ${entry.level}${entry.className ? ` · ${esc(entry.className)}` : ""} · dono: ${esc(entry.characterOwner)}
              </div>
            </div>
          </div>
          <div style="display:flex;gap:10px;align-items:center;">
            <button class="btn btn-teal" data-action="open-linked-character" data-owner="${esc(entry.characterOwner)}" data-id="${esc(entry.characterId)}">abrir ficha</button>
            ${isGm ? `<button class="btn danger" data-action="unlink-character" data-owner="${esc(entry.characterOwner)}" data-id="${esc(entry.characterId)}">remover</button>` : ""}
          </div>
        </div>
        <div class="char-card-bars">
          <div class="char-card-bar-row">
            <span class="hp-value">HP ${entry.hpCurrent}/${entry.hpMax}</span>
            ${miniBar(entry.hpCurrent, entry.hpMax, "var(--stamp)")}
          </div>
          <div class="char-card-bar-row">
            <span>MP ${entry.mpCurrent}/${entry.mpMax}</span>
            ${miniBar(entry.mpCurrent, entry.mpMax, "var(--teal)")}
          </div>
          <div class="char-card-bar-row">
            <span>XP ${entry.xp}/${entry.xpNeeded}</span>
            ${miniBar(entry.xp, entry.xpNeeded, "var(--violet)")}
          </div>
        </div>
      </li>`;
    })
    .join("");

  const membersItems = cd.members
    .map((m) => `<li>${esc(m.username)} — <span class="helper-text" style="display:inline;">${m.role === "gm" ? "Mestre" : "Jogador"}</span></li>`)
    .join("");

  const monsterItems = (cd.monsters || [])
    .map(
      (m) => `
      <li class="monster-item ${m.imageUrl || m.description ? "monster-item-rich" : ""}">
        ${m.imageUrl ? `<div class="monster-thumb"><img src="${esc(m.imageUrl)}" alt=""></div>` : ""}
        <div class="monster-item-body">
          <div class="monster-item-top">
            <span class="monster-name">${esc(m.name)}</span>
            <span class="monster-stats">Nv. ${esc(String(m.level))} · <span class="hp-value">HP ${esc(String(m.hp))}</span> · MP ${esc(String(m.mp))}</span>
          </div>
          ${m.description ? `<p class="monster-desc">${esc(m.description)}</p>` : ""}
        </div>
        ${isGm ? `<button class="btn-link danger" data-action="remove-monster" data-id="${esc(m.id)}">remover</button>` : ""}
      </li>`
    )
    .join("");

  const description = cd.campaign.description || "";

  return `
    <div class="center-box">
      <div class="login-card" style="max-width:640px;">
        <button class="btn-back" data-action="back-to-campaigns" style="margin-bottom:10px;display:block;">← campanhas</button>
        <div class="eyebrow">Painel da Campanha</div>
        <h1 class="char-name" style="margin-bottom:1rem;">${esc(cd.campaign.name)}</h1>
        ${campaignDashError ? `<p class="login-error">${esc(campaignDashError)}</p>` : ""}

        <h2 class="section-title">Descrição</h2>
        ${
          isGm
            ? `
        <textarea rows="4" id="campaign-desc-input" class="campaign-desc-textarea" placeholder="Conte do que se trata a campanha, tom, ambientação, avisos aos jogadores...">${esc(description)}</textarea>
        <div style="display:flex;align-items:center;gap:10px;margin-top:6px;">
          <button class="btn btn-teal" data-action="save-campaign-description" ${campaignDescSaving ? "disabled" : ""}>${campaignDescSaving ? "Salvando..." : "Salvar descrição"}</button>
          ${campaignDescSaved ? `<span class="confirm-msg" style="margin:0;">✓ Salvo</span>` : ""}
        </div>`
            : description
              ? `<p class="campaign-desc-view">${esc(description)}</p>`
              : `<p class="helper-text">O mestre ainda não escreveu uma descrição.</p>`
        }

        <button class="btn btn-teal" data-action="toggle-campaign-history" style="margin:14px 0 10px;display:block;">histórico de rolagens da campanha</button>

        <h2 class="section-title">Personagens Vinculados</h2>
        <ul class="linked-list">${linkedItems || `<li class="helper-text">Nenhum personagem vinculado ainda.</li>`}</ul>

        ${
          isGm
            ? `
        <h2 class="section-title">Vincular Novo Personagem</h2>
        <p class="helper-text" style="margin-bottom:8px;">Peça ao jogador o username do GitHub e o ID do personagem (visível na tela "Meus Personagens" dele, ou você pode pedir para ele copiar o ID da URL/arquivo).</p>
        <div style="display:flex;gap:8px;margin-bottom:8px;">
          <input type="text" id="link-owner-input" placeholder="username do jogador" value="${esc(linkOwnerInput)}" />
          <input type="text" id="link-charid-input" placeholder="ID do personagem" value="${esc(linkCharIdInput)}" style="width:140px;" />
        </div>
        <button class="btn btn-teal" data-action="do-link-character">Vincular</button>
        `
            : ""
        }

        <h2 class="section-title" style="margin-top:1.5rem;">Monstros</h2>
        <ul class="monster-list">${monsterItems || `<li class="helper-text">Nenhum monstro criado.</li>`}</ul>
        ${
          isGm
            ? `
        <p class="helper-text" style="margin:8px 0;">Só o mestre pode adicionar monstros à campanha.</p>
        ${monsterFormError ? `<p class="login-error">${esc(monsterFormError)}</p>` : ""}
        <div class="monster-form">
          <input type="text" id="monster-name-input" placeholder="Nome" />
          <input type="number" id="monster-level-input" placeholder="Nível" style="width:80px;" />
          <input type="number" id="monster-hp-input" placeholder="HP" style="width:80px;" />
          <input type="number" id="monster-mp-input" placeholder="MP" style="width:80px;" />
        </div>
        ${renderImageUploadField("monster-image-input", "")}
        <textarea rows="2" id="monster-desc-input" placeholder="Descrição (aparência, comportamento, fraquezas...) — opcional"></textarea>
        <button class="btn btn-teal" data-action="do-add-monster" style="margin-top:6px;">+ criar monstro</button>
        <button class="btn-add" data-action="toggle-bulk-monster-add" style="margin-top:8px;">${ICONS.plus} adicionar em massa</button>
        ${
          showBulkMonsterAdd
            ? `
        <div class="bulk-monster-box">
          <p class="helper-text" style="margin-bottom:6px;">Um monstro por linha: <code>Nome, Nível, HP, MP</code> (nível/HP/MP são opcionais).</p>
          ${bulkMonsterError ? `<p class="login-error">${esc(bulkMonsterError)}</p>` : ""}
          <textarea rows="5" id="bulk-monster-textarea" placeholder="Cultista, 2, 15, 5
Sombra Rastejante, 4, 30, 10
Aberração Menor"></textarea>
          <button class="btn btn-stamp" data-action="do-add-monsters-bulk" style="margin-top:6px;">criar todos</button>
        </div>`
            : ""
        }
        `
            : ""
        }

        <h2 class="section-title" style="margin-top:1.5rem;">Membros</h2>
        <ul class="members-list">${membersItems}</ul>
      </div>
    </div>`;
}

// Painel de histórico de rolagens agregando todos os personagens vinculados
// à campanha — visível a todos os membros (mestre e jogadores).
function renderCampaignHistoryPanel() {
  if (!showCampaignHistory) return "";
  const body = campaignHistoryLoading
    ? `<p class="helper-text">Carregando...</p>`
    : (campaignHistoryEntries
        .map((h) => {
          const time = new Date(h.time).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
          const stateClass = h.crit ? "is-crit" : h.fumble ? "is-fumble" : "";
          return `
          <div class="history-entry ${stateClass}">
            <div class="history-entry-top">
              <span class="history-entry-char" style="color:${h.color};">
                <span class="history-avatar" style="border-color:${h.color};">
                  ${h.charPhoto ? `<img src="${esc(h.charPhoto)}" alt="">` : ICONS.user}
                </span>
                ${esc(h.charName)}
              </span>
              <span class="history-time">${esc(time)}</span>
            </div>
            <div class="history-label">${esc(h.label)}</div>
            <div class="history-roll">${esc(h.roll)}</div>
            ${h.total !== null && h.total !== undefined ? `<div class="history-total">${esc(String(h.total))}</div>` : ""}
          </div>`;
        })
        .join("") || `<p class="helper-text">Nenhuma rolagem ainda.</p>`);

  return `
    <div class="history-overlay" data-action="close-campaign-history-bg">
      <div class="history-panel">
        <div class="history-panel-header">
          <span>Histórico de Rolagens da Campanha</span>
          <button class="btn btn-teal" data-action="toggle-campaign-history">fechar ✕</button>
        </div>
        <div class="history-list">${body}</div>
      </div>
    </div>`;
}

// ---------- Bestiário global (aba "Monstros") ----------
function renderBestiary() {
  const user = getStoredUser();

  const cards = bestiaryList
    .map((m) => {
      const isOwner = user && m.createdBy === user.login;
      if (editingMonsterId === m.id) {
        return `
        <div class="monster-card monster-card-editing" data-id="${esc(m.id)}">
          <div class="monster-card-form">
            <input type="text" id="edit-monster-name-${m.id}" placeholder="Nome" value="${esc(m.name)}" />
            <div class="grid-3">
              <input type="number" id="edit-monster-level-${m.id}" placeholder="Nível" value="${esc(String(m.level ?? 1))}" />
              <input type="number" id="edit-monster-hp-${m.id}" placeholder="HP" value="${esc(String(m.hp ?? 0))}" />
              <input type="number" id="edit-monster-mp-${m.id}" placeholder="MP" value="${esc(String(m.mp ?? 0))}" />
            </div>
            ${renderImageUploadField(`edit-monster-image-${m.id}`, m.imageUrl || "")}
            <textarea rows="3" id="edit-monster-desc-${m.id}" placeholder="Descrição...">${esc(m.description || "")}</textarea>
            ${editMonsterFormError ? `<p class="login-error">${esc(editMonsterFormError)}</p>` : ""}
            <div style="display:flex;gap:8px;margin-top:6px;">
              <button class="btn btn-teal" data-action="do-save-monster-edit" data-id="${esc(m.id)}">salvar</button>
              <button class="btn-back" data-action="cancel-monster-edit">cancelar</button>
            </div>
          </div>
        </div>`;
      }
      return `
      <div class="monster-card" data-id="${esc(m.id)}">
        <div class="monster-card-image">
          ${m.imageUrl ? `<img src="${esc(m.imageUrl)}" alt="">` : `<span class="monster-card-placeholder">${ICONS.swords}</span>`}
        </div>
        <div class="monster-card-body">
          <div class="monster-card-top">
            <span class="monster-card-name">${esc(m.name)}</span>
            <span class="monster-card-stats">Nv. ${esc(String(m.level ?? 1))}</span>
          </div>
          <div class="monster-card-bars-mini">
            <span class="hp-value">HP ${esc(String(m.hp ?? 0))}</span>
            <span>MP ${esc(String(m.mp ?? 0))}</span>
          </div>
          ${m.description ? `<p class="monster-card-desc">${esc(m.description)}</p>` : `<p class="monster-card-desc helper-text">Sem descrição.</p>`}
          <div class="monster-card-footer">
            <span class="monster-card-owner">criado por ${esc(m.createdBy || "?")}</span>
            ${
              isOwner
                ? `
              <span class="monster-card-owner-actions">
                <button class="btn-link" data-action="edit-monster" data-id="${esc(m.id)}">editar</button>
                <button class="btn-link danger" data-action="do-delete-monster" data-id="${esc(m.id)}">apagar</button>
              </span>`
                : ""
            }
          </div>
        </div>
      </div>`;
    })
    .join("");

  return `
    <div class="center-box">
      <div class="login-card" style="max-width:720px;">
        <div class="eyebrow">Conectado como ${esc(user?.login || "")}</div>
        ${renderNavTabs("monsters")}
        <h1 class="char-name" style="margin-bottom:0.4rem;">Bestiário</h1>
        <p class="helper-text" style="margin-bottom:14px;">
          Monstros criados por qualquer pessoa aparecem aqui pra todo mundo ver. Só quem criou um monstro pode
          editá-lo ou apagá-lo. Isso é separado dos monstros de cada campanha.
        </p>
        ${bestiaryError ? `<p class="login-error">${esc(bestiaryError)}</p>` : ""}

        ${!showNewMonsterForm ? `<button class="btn btn-teal" data-action="toggle-new-monster-form">+ Novo Monstro</button>` : ""}
        ${
          showNewMonsterForm
            ? `
        <div class="monster-card-form new-monster-form">
          <input type="text" id="new-monster-name" placeholder="Nome" />
          <div class="grid-3">
            <input type="number" id="new-monster-level" placeholder="Nível" />
            <input type="number" id="new-monster-hp" placeholder="HP" />
            <input type="number" id="new-monster-mp" placeholder="MP" />
          </div>
          ${renderImageUploadField("new-monster-image", "")}
          <textarea rows="3" id="new-monster-desc" placeholder="Descrição (aparência, comportamento, fraquezas...)"></textarea>
          ${newMonsterFormError ? `<p class="login-error">${esc(newMonsterFormError)}</p>` : ""}
          <div style="display:flex;gap:8px;margin-top:6px;">
            <button class="btn btn-stamp" data-action="do-create-monster">criar monstro</button>
            <button class="btn-back" data-action="toggle-new-monster-form">cancelar</button>
          </div>
        </div>`
            : ""
        }

        <div class="bestiary-grid" style="margin-top:16px;">
          ${bestiaryLoading ? `<p class="helper-text">Carregando...</p>` : cards || `<p class="helper-text">Nenhum monstro cadastrado ainda.</p>`}
        </div>

        <button class="btn btn-teal" data-action="logout" style="margin-top:18px;display:block;">Sair</button>
      </div>
    </div>`;
}

// ---------- Livro do sistema (aba "Livro do Sistema") ----------
// Por enquanto só guarda o arquivo em si (PDF, imagem etc.); o conteúdo/uso
// dentro da ficha (referências, busca etc.) fica pra depois.
function renderSystemBook() {
  const user = getStoredUser();
  const b = systemBookMeta;

  return `
    <div class="center-box">
      <div class="login-card" style="max-width:560px;">
        <div class="eyebrow">Conectado como ${esc(user?.login || "")}</div>
        ${renderNavTabs("system")}
        <h1 class="char-name" style="margin-bottom:0.4rem;">Livro do Sistema</h1>
        <p class="helper-text" style="margin-bottom:14px;">
          Suba aqui o arquivo do manual/livro de regras do sistema (PDF, imagem etc.) pra ficar
          disponível pra todo mundo que usa esta ficha. Existe só um arquivo atual — enviar um novo
          substitui o anterior. O conteúdo em si (texto pesquisável, referências dentro da ficha etc.)
          é uma etapa futura; por enquanto isso só guarda e disponibiliza o arquivo.
        </p>
        ${systemBookError ? `<p class="login-error">${esc(systemBookError)}</p>` : ""}

        ${
          systemBookLoading
            ? `<p class="helper-text">Carregando...</p>`
            : b
            ? `
          <div class="monster-item">
            <span class="monster-name">${esc(b.fileName)}</span>
            <span class="monster-stats">${esc(formatFileSize(b.sizeBytes))} · enviado por ${esc(b.uploadedBy)} em ${esc(new Date(b.uploadedAt).toLocaleDateString("pt-BR"))}</span>
          </div>
          <div style="display:flex;gap:16px;align-items:center;margin:14px 0;">
            <button class="btn btn-teal" data-action="system-book-download">baixar arquivo</button>
            <button class="btn-link danger" data-action="system-book-remove">remover</button>
          </div>`
            : `<p class="helper-text" style="margin-bottom:14px;">Nenhum arquivo enviado ainda.</p>`
        }

        <label class="btn btn-teal" style="display:inline-block;cursor:pointer;">
          ${systemBookUploading ? "enviando..." : b ? "substituir arquivo" : "+ enviar arquivo"}
          <input type="file" data-action="system-book-upload" hidden ${systemBookUploading ? "disabled" : ""} />
        </label>

        <button class="btn btn-teal" data-action="logout" style="margin-top:18px;display:block;">Sair</button>
      </div>
    </div>`;
}

// ---------- Conteúdo das abas (idêntico ao protótipo anterior) ----------
function renderBasic() {
  const b = character.basic;
  const idMatch = currentPath ? currentPath.match(/characters\/(.+)\.json$/) : null;
  const shortId = idMatch ? idMatch[1] : "";
  return `
    <div class="avatar-row">
      <div style="display:flex;flex-direction:column;align-items:center;gap:6px;flex-shrink:0;">
        <label class="avatar avatar-upload" title="Clique para escolher uma foto do seu dispositivo">
          ${b.photoUrl ? `<img src="${esc(b.photoUrl)}" alt="">` : ICONS.user}
          <input type="file" accept="image/*" data-photo-bind="basic.photoUrl" hidden />
        </label>
        ${b.photoUrl ? `<button class="btn-link danger" type="button" data-action="clear-avatar-photo">remover foto</button>` : ""}
      </div>
      <label class="field" style="flex:1;">
        <span class="field-label">Nome do personagem</span>
        <input type="text" data-bind="basic.name" value="${esc(b.name)}" />
      </label>
    </div>
    <div class="grid-2">
      <label class="field">
        <span class="field-label">Idade</span>
        <input type="text" data-bind="basic.age" value="${esc(b.age)}" />
      </label>
      <label class="field">
        <span class="field-label">Status financeiro</span>
        <input type="text" data-bind="basic.financialStatus" value="${esc(b.financialStatus)}" />
      </label>
      <label class="field">
        <span class="field-label">Peso</span>
        <input type="text" data-bind="basic.weight" value="${esc(b.weight)}" placeholder="ex: 70kg" />
      </label>
      <label class="field">
        <span class="field-label">Altura</span>
        <input type="text" data-bind="basic.height" value="${esc(b.height)}" placeholder="ex: 1,75m" />
      </label>
    </div>
    ${shortId ? `<button class="btn-copy-id" data-action="copy-id" data-id="${esc(shortId)}">ID: ${esc(shortId)} (copiar)</button>` : ""}`;
}

function renderClass() {
  const cl = character.classInfo;
  const fieldsHtml = (cl.fields || [])
    .map(
      (f, i) => `
      <div class="class-fields-row">
        <input type="text" placeholder="Campo" data-class-field="${i}" data-class-field-part="0" value="${esc(f[0])}" />
        <input type="text" placeholder="Valor" data-class-field="${i}" data-class-field-part="1" value="${esc(f[1])}" />
      </div>`
    )
    .join("");
  return `
    <label class="field">
      <span class="field-label">Nome da classe</span>
      <input type="text" data-bind="classInfo.name" value="${esc(cl.name)}" placeholder="ex: Ocultista de Campo" />
    </label>
    <span class="field-label" style="display:block;margin-bottom:8px;">Campos livres</span>
    ${fieldsHtml}
    <button class="btn-add" data-action="class-add-field">${ICONS.plus} campo</button>

    <label class="field" style="margin-top:14px;">
      <span class="field-label">Informações adicionais</span>
      <textarea rows="4" data-bind="classInfo.notes" placeholder="Descrição da classe, habilidades passivas, história, observações...">${esc(cl.notes || "")}</textarea>
    </label>

    <div style="margin-top:14px;">
      <button class="btn btn-stamp" data-action="class-confirm">Concluir criação da classe</button>
    </div>
    ${classConfirm ? `<div class="confirm-msg">✓ Classe "${esc(cl.name || "sem nome")}" salva.</div>` : ""}`;
}

function renderResources() {
  const r = character.resources;
  function bar(label, currentKey, maxKey, color, textClass) {
    const current = r[currentKey];
    const max = r[maxKey];
    const pct = max > 0 ? Math.max(0, Math.min(100, (current / max) * 100)) : 0;
    const tc = textClass || "";
    return `
      <div class="bar-block bar-block-compact bar-block-${currentKey}">
        <div class="bar-top">
          <span class="field-label ${tc}" style="margin:0;">${label}</span>
          <span class="${tc}" style="font-family:'Special Elite',monospace;font-size:13px;">${current} / ${max}</span>
        </div>
        <div class="bar-track bar-track-compact"><div class="bar-fill" style="width:${pct}%;background:${color};"></div></div>
        <div class="bar-inputs">
          <span>atual</span>
          <input type="number" class="${tc}" data-bind="resources.${currentKey}" data-numeric="true" value="${current}" />
          <span>máx.</span>
          <input type="number" class="${tc}" data-bind="resources.${maxKey}" data-numeric="true" value="${max}" />
        </div>
      </div>`;
  }

  const xpNeeded = xpNeededForLevel(r.level);
  const xpPct = Math.max(0, Math.min(100, (r.xp / xpNeeded) * 100));
  const isMaxLevel = r.level >= MAX_LEVEL;

  return `
    <div class="level-row-compact">
      <div>
        <span class="field-label" style="display:block;">Nível ${isMaxLevel ? '<span class="max-tag">MÁX.</span>' : ""}</span>
        <div class="level-number-compact">${r.level}</div>
      </div>
      <label class="gold-inline">
        <span class="field-label gold-value" style="margin:0;">Gold</span>
        <input type="number" class="gold-value" data-bind="resources.gold" data-numeric="true" value="${r.gold || 0}" />
      </label>
      <button class="btn btn-stamp btn-compact" data-action="level-down" ${r.level <= 1 ? "disabled" : ""}>Reduzir</button>
    </div>

    <div class="bar-block bar-block-compact">
      <div class="bar-top">
        <span class="field-label" style="margin:0;">XP</span>
        <span style="font-family:'Special Elite',monospace;font-size:13px;">${r.xp} / ${xpNeeded}</span>
      </div>
      <div class="bar-track bar-track-compact"><div class="bar-fill" style="width:${xpPct}%;background:#3b6fd6;"></div></div>
      <div class="bar-inputs">
        <input type="number" id="xp-gain-input" placeholder="qtd." max="${MAX_XP_PER_ADD}" min="1" style="width:80px;" ${isMaxLevel ? "disabled" : ""} />
        <button class="btn btn-teal btn-compact" data-action="add-xp" ${isMaxLevel ? "disabled" : ""}>+ XP</button>
      </div>
    </div>

    ${bar("HP", "hpCurrent", "hpMax", "var(--stamp)", "hp-value")}
    ${bar("MP", "mpCurrent", "mpMax", "var(--teal)")}

    <p class="helper-text" style="font-size:11px;margin-top:2px;">
      Máx. ${MAX_XP_PER_ADD} XP por vez · nível máximo ${MAX_LEVEL}.
    </p>`;
}

function renderSkills() {
  const rows = character.skills
    .map((s) => {
      const trainingOptions = TRAINING_LEVELS
        .map((t) => `<option value="${t.value}" ${Number(s.training || 0) === t.value ? "selected" : ""}>${t.label}</option>`)
        .join("");
      const atExpert = Number(s.training || 0) >= 15;
      return `
      <div class="skill-row" data-id="${s.id}">
        <input type="text" class="skill-name" data-list="skills" data-id="${s.id}" data-field="name" value="${esc(s.name)}" ${s.mandatory ? "readonly title='Perícia usada nos testes de ataque'" : ""} />
        <div class="skill-row-controls">
          <select class="training-select" data-list="skills" data-id="${s.id}" data-field="training" data-select="true" data-numeric="true" title="Treinamento">${trainingOptions}</select>
          <button class="promote-btn" data-action="promote-training" data-id="${s.id}" title="Sobe uma patente de treinamento" ${atExpert ? "disabled" : ""}>▲</button>
          <input type="number" class="buff" data-list="skills" data-id="${s.id}" data-field="buff" data-numeric="true" value="${s.buff || 0}" title="Buff / bônus situacional" placeholder="buff" />
          <button class="dice-btn" data-action="roll-skill" data-id="${s.id}" title="Rolar 1d20">${ICONS.dice}</button>
          ${s.mandatory ? "" : `<button class="trash-btn" data-action="remove" data-list="skills" data-id="${s.id}">${ICONS.trash}</button>`}
        </div>
      </div>`;
    })
    .join("");
  return `
    <p class="helper-text" style="margin-bottom:10px;">
      Toda perícia rola sempre 1d20 + treinamento + buff. Luta, Pontaria e Magia não podem ser removidas.
      Use ▲ pra subir uma patente (Destreinado → Treinado → Veterano → Expert).
    </p>
    ${rows}<button class="btn-add" data-action="add-skill">${ICONS.plus} adicionar perícia</button>`;
}

function renderAbilities() {
  const cards = character.abilities
    .map(
      (a) => `
      <div class="card-box" data-id="${a.id}">
        <div class="card-box-header">
          <input type="text" data-list="abilities" data-id="${a.id}" data-field="name" value="${esc(a.name)}" />
          <button class="trash-btn" data-action="remove" data-list="abilities" data-id="${a.id}">${ICONS.trash}</button>
        </div>
        <textarea rows="2" data-list="abilities" data-id="${a.id}" data-field="description" placeholder="Descrição da habilidade...">${esc(a.description)}</textarea>
        <div class="item-attack-row">
          <input type="text" data-list="abilities" data-id="${a.id}" data-field="dice" placeholder="Dado de dano/efeito (ex: 2d6, opcional)" value="${esc(a.dice || "")}" />
          ${a.dice ? `<button class="dice-btn" data-action="roll-ability" data-id="${a.id}" title="Rolar">${ICONS.dice}</button>` : ""}
        </div>
      </div>`
    )
    .join("");
  return `${cards}<button class="btn-add" data-action="add-ability">${ICONS.plus} adicionar habilidade</button>`;
}

function renderItems() {
  const cards = character.items
    .map(
      (it) => `
      <div class="card-box" data-id="${it.id}">
        <div class="card-box-header">
          <input type="text" data-list="items" data-id="${it.id}" data-field="name" value="${esc(it.name)}" />
          <button class="trash-btn" data-action="remove" data-list="items" data-id="${it.id}">${ICONS.trash}</button>
        </div>
        <textarea rows="2" data-list="items" data-id="${it.id}" data-field="description" placeholder="Descrição do item...">${esc(it.description)}</textarea>
        <div class="item-attack-row">
          <input type="text" data-list="items" data-id="${it.id}" data-field="attackRoll" placeholder="Rolagem de ataque (ex: 1d8+2)" value="${esc(it.attackRoll)}" />
          <input type="text" class="crit" data-list="items" data-id="${it.id}" data-field="critRange" placeholder="Crítico (ex: 20 ou 19-20)" value="${esc(it.critRange)}" />
          <input type="text" data-list="items" data-id="${it.id}" data-field="critMultiplier" placeholder="×2" value="${esc(it.critMultiplier || "")}" style="width:52px;text-align:center;" title="Multiplicador de dano no crítico" />
          ${it.attackRoll ? `<button class="dice-btn" data-action="roll-item" data-id="${it.id}" title="Rolar">${ICONS.dice}</button>` : ""}
        </div>
      </div>`
    )
    .join("");
  return `${cards}<button class="btn-add" data-action="add-item">${ICONS.plus} adicionar item</button>`;
}

function renderAttacks() {
  const attackSkills = character.skills.filter((s) => s.mandatory);
  const rows = character.attacks
    .map((a) => {
      const options = attackSkills
        .map((s) => `<option value="${s.id}" ${a.skillId === s.id ? "selected" : ""}>${esc(s.name)}</option>`)
        .join("");
      return `
      <div class="attack-row" data-id="${a.id}">
        <input type="text" data-list="attacks" data-id="${a.id}" data-field="name" value="${esc(a.name)}" style="flex:1;font-weight:600;" />
        <select class="attack-skill-select" data-list="attacks" data-id="${a.id}" data-field="skillId" data-select="true" title="Perícia usada no teste de ataque">${options}</select>
        <input type="text" class="dice" data-list="attacks" data-id="${a.id}" data-field="dice" value="${esc(a.dice)}" title="Dado de dano" />
        <input type="text" data-list="attacks" data-id="${a.id}" data-field="critRange" value="${esc(a.critRange)}" style="width:56px;text-align:center;" title="Faixa de crítico do teste de ataque (ex: 20 ou 19-20)" />
        <input type="text" data-list="attacks" data-id="${a.id}" data-field="critMultiplier" value="${esc(a.critMultiplier || "")}" style="width:44px;text-align:center;" placeholder="×2" title="Multiplicador de dano no crítico" />
        <button class="dice-btn" data-action="roll-attack-test" data-id="${a.id}" title="Testar ataque">${ICONS.dice}</button>
        <button class="trash-btn" data-action="remove" data-list="attacks" data-id="${a.id}">${ICONS.trash}</button>
      </div>`;
    })
    .join("");
  return `
    <p class="helper-text" style="margin-bottom:10px;">
      O teste de ataque usa a perícia escolhida (Luta, Pontaria ou Magia). O dado configurado aqui é o dano,
      aplicado só se o teste acertar; o crítico (faixa + multiplicador) é checado no <strong>teste</strong> e multiplica o <strong>dano</strong>.
    </p>
    ${rows}<button class="btn-add" data-action="add-attack">${ICONS.plus} adicionar ataque</button>`;
}

function renderTabContent() {
  switch (activeTab) {
    case "class": return renderClass();
    case "abilities": return renderAbilities();
    case "items": return renderItems();
    case "attacks": return renderAttacks();
    default: return "";
  }
}

function renderSheet() {
  const tabsHtml = TABS.map(
    (t) => `
    <button class="tab-btn ${activeTab === t.id ? "active" : ""}" data-tab="${t.id}">
      ${ICONS[t.icon]} ${t.label}
    </button>`
  ).join("");

  return `
    <div class="sheet">
      <div class="sheet-topbar">
        <div class="sheet-topbar-left">
          <span class="eyebrow">Arquivo da Ordem</span>
          <span id="save-indicator" class="save-indicator"></span>
        </div>
        <div class="sheet-topbar-right">
          <span class="stamp">confidencial</span>
          <button class="btn-link" data-action="toggle-history">histórico de rolagens</button>
          ${sheetCampaignSlug ? `<button class="btn-back" data-action="back-to-campaign">← voltar para campanha</button>` : ""}
          <button class="btn-back" data-action="back-to-list">← meus personagens</button>
        </div>
      </div>
      ${sheetReadOnly ? `<div class="readonly-banner">👁 Somente leitura — você não tem permissão para editar a ficha deste personagem.</div>` : ""}
      <div class="sheet-body ${sheetReadOnly ? "readonly-lock" : ""}">
        <aside class="sheet-col sheet-col-left">
          <div class="sidebar-section">${renderBasic()}</div>
          <div class="sidebar-divider"></div>
          <div class="sidebar-section">${renderResources()}</div>
        </aside>
        <div class="sheet-col sheet-col-mid">
          <h2 class="col-title">${ICONS.sparkles} Perícias</h2>
          ${renderSkills()}
        </div>
        <div class="sheet-col sheet-col-right">
          <div class="tabs tabs-inline">${tabsHtml}</div>
          <div class="tab-content">${renderTabContent()}</div>
        </div>
      </div>
    </div>`;
}

// Painel de histórico de rolagens: fica salvo na própria ficha, então tanto o jogador
// quanto o mestre (ao abrir a ficha vinculada pela campanha) veem as mesmas entradas.
function renderHistoryPanel() {
  if (!showHistory) return "";
  const photoUrl = character.basic?.photoUrl || "";
  const entries = (character.rollHistory || [])
    .map((h) => {
      const time = new Date(h.time).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      const stateClass = h.crit ? "is-crit" : h.fumble ? "is-fumble" : "";
      return `
      <div class="history-entry ${stateClass}">
        <div class="history-entry-top">
          <span class="history-entry-char">
            <span class="history-avatar">${photoUrl ? `<img src="${esc(photoUrl)}" alt="">` : ICONS.user}</span>
            ${esc(character.basic?.name || "")}
          </span>
          <span class="history-time">${esc(time)}</span>
        </div>
        <div class="history-label">${esc(h.label)}</div>
        <div class="history-roll">${esc(h.roll)}</div>
        ${h.total !== null && h.total !== undefined ? `<div class="history-total">${esc(String(h.total))}</div>` : ""}
      </div>`;
    })
    .join("");

  return `
    <div class="history-overlay" data-action="close-history-bg">
      <div class="history-panel">
        <div class="history-panel-header">
          <span>Histórico de Rolagens</span>
          <button class="btn btn-teal" data-action="toggle-history">fechar ✕</button>
        </div>
        <div class="history-list">${entries || `<p class="helper-text">Nenhuma rolagem ainda.</p>`}</div>
      </div>
    </div>`;
}

function renderToast() {
  if (!toast) return "";
  if (toast.rolling) {
    return `
      <div class="toast rolling">
        <div class="toast-label"><span class="dice-spin">🎲</span> ${esc(toast.label)}</div>
        <div class="toast-roll">${esc(toast.roll)}</div>
      </div>`;
  }
  const flashClass = toast.crit ? "crit-flash" : toast.fumble ? "fumble-flash" : "";
  const toastClass = toast.crit ? "toast-crit" : toast.fumble ? "toast-fumble" : "";
  return `
    ${flashClass ? `<div class="${flashClass}"></div>` : ""}
    <div class="toast ${toastClass}">
      <div class="toast-label">${esc(toast.label)}</div>
      <div class="toast-roll">${esc(toast.roll)}</div>
      ${toast.total !== null ? `<div class="toast-total">${toast.total}</div>` : ""}
    </div>`;
}

// ---------- Render principal ----------
function render() {
  const app = document.getElementById("app");
  let html = "";
  if (screen === "loading") html = renderLoading();
  else if (screen === "login") html = renderLogin();
  else if (screen === "list") html = renderList();
  else if (screen === "campaigns") html = renderCampaigns();
  else if (screen === "campaign-dashboard") html = renderCampaignDashboard();
  else if (screen === "bestiary") html = renderBestiary();
  else if (screen === "system") html = renderSystemBook();
  else if (screen === "sheet") html = renderSheet();

  app.innerHTML =
    html +
    renderToast() +
    (screen === "sheet" ? renderHistoryPanel() : "") +
    (screen === "campaign-dashboard" ? renderCampaignHistoryPanel() : "");
  attachEvents();
  if (screen === "sheet") updateSaveIndicator();
}

// ---------- Ações de tela ----------
async function goToList() {
  screen = "list";
  listError = "";
  render();
  try {
    const user = getStoredUser();
    const files = await listDirectory(`users/${user.login}/characters`);
    const jsonFiles = files.filter((f) => f.name.endsWith(".json"));
    const withNames = await Promise.all(
      jsonFiles.map(async (f) => {
        try {
          const result = await readJsonFile(f.path);
          return { id: f.name.replace(".json", ""), name: result?.data?.basic?.name || f.name, path: f.path };
        } catch {
          return { id: f.name.replace(".json", ""), name: f.name, path: f.path };
        }
      })
    );
    characterList = withNames;
  } catch (err) {
    listError = "Não foi possível carregar seus personagens: " + (err.message || err);
  }
  render();
}

async function goToCampaigns() {
  screen = "campaigns";
  campaignsSubTab = "mine";
  campaignsError = "";
  campaignsLoading = true;
  render();
  try {
    const user = getStoredUser();
    campaignList = await loadCampaignsForUser(user.login);
  } catch (err) {
    campaignsError = "Não foi possível carregar campanhas: " + (err.message || err);
  }
  campaignsLoading = false;
  render();
}

async function goToCampaignsSubTab(tab) {
  campaignsSubTab = tab;
  if (tab === "all" && allCampaignsList.length === 0 && !allCampaignsLoading) {
    allCampaignsLoading = true;
    allCampaignsError = "";
    render();
    try {
      allCampaignsList = await loadAllCampaigns();
    } catch (err) {
      allCampaignsError = "Não foi possível carregar todas as campanhas: " + (err.message || err);
    }
    allCampaignsLoading = false;
  }
  render();
}

async function goToBestiary() {
  screen = "bestiary";
  bestiaryError = "";
  bestiaryLoading = true;
  showNewMonsterForm = false;
  newMonsterFormError = "";
  editingMonsterId = null;
  editMonsterFormError = "";
  render();
  try {
    const res = await loadBestiary();
    bestiaryList = res.data;
    bestiarySha = res.sha;
  } catch (err) {
    bestiaryError = "Não foi possível carregar o bestiário: " + (err.message || err);
  }
  bestiaryLoading = false;
  render();
}

async function goToSystemBook() {
  screen = "system";
  systemBookError = "";
  systemBookLoading = true;
  render();
  try {
    const res = await readJsonFile("system/rulebook_meta.json");
    systemBookMeta = res ? res.data : null;
    systemBookMetaSha = res ? res.sha : null;
  } catch (err) {
    systemBookError = "Não foi possível carregar o livro do sistema: " + (err.message || err);
  }
  systemBookLoading = false;
  render();
}

async function handleCreateCampaign() {
  const input = document.getElementById("new-campaign-name");
  const name = input ? input.value.trim() : "";
  if (!name) return;
  const user = getStoredUser();
  try {
    const slug = await createCampaign(name, user.login);
    newCampaignName = "";
    await openCampaignDashboardScreen(slug);
  } catch (err) {
    campaignsError = "Falha ao criar campanha: " + (err.message || err);
    render();
  }
}

async function openCampaignDashboardScreen(slug) {
  currentCampaignSlug = slug;
  screen = "campaign-dashboard";
  campaignDashError = "";
  currentCampaign = null;
  showCampaignHistory = false;
  campaignHistoryEntries = [];
  monsterFormError = "";
  showBulkMonsterAdd = false;
  bulkMonsterError = "";
  campaignDescSaving = false;
  campaignDescSaved = false;
  render();
  try {
    currentCampaign = await loadCampaignDashboard(slug);
  } catch (err) {
    campaignDashError = "Falha ao carregar campanha: " + (err.message || err);
  }
  render();
}

async function handleLinkCharacter() {
  const ownerInput = document.getElementById("link-owner-input");
  const idInput = document.getElementById("link-charid-input");
  const owner = ownerInput ? ownerInput.value.trim() : "";
  const characterId = idInput ? idInput.value.trim() : "";
  if (!owner || !characterId) return;
  try {
    await linkCharacterToCampaign(currentCampaignSlug, owner, characterId);
    linkOwnerInput = "";
    linkCharIdInput = "";
    currentCampaign = await loadCampaignDashboard(currentCampaignSlug);
    campaignDashError = "";
  } catch (err) {
    campaignDashError = err.message || String(err);
  }
  render();
}

async function handleUnlinkCharacter(owner, characterId) {
  try {
    await unlinkCharacterFromCampaign(currentCampaignSlug, owner, characterId);
    currentCampaign = await loadCampaignDashboard(currentCampaignSlug);
  } catch (err) {
    campaignDashError = "Falha ao remover vínculo: " + (err.message || err);
  }
  render();
}

async function createNewCharacter() {
  const user = getStoredUser();
  const id = uid();
  const path = `users/${user.login}/characters/${id}.json`;
  const newChar = emptyCharacter();
  sheetReadOnly = false;
  sheetCampaignSlug = null;
  try {
    await writeJsonFile(path, newChar, null, `feat: cria personagem "${newChar.basic.name}"`);
    character = newChar;
    currentPath = path;
    currentSha = null;
    const fresh = await readJsonFile(path);
    if (fresh) currentSha = fresh.sha;
    activeTab = "class";
    screen = "sheet";
    saveStatus = "";
    render();
  } catch (err) {
    listError = "Falha ao criar personagem: " + (err.message || err);
    render();
  }
}

async function openCharacterCore(path) {
  try {
    const result = await readJsonFile(path);
    if (!result) throw new Error("Arquivo não encontrado");
    character = normalizeCharacter(result.data);
    currentSha = result.sha;
    currentPath = path;
    activeTab = "class";
    screen = "sheet";
    saveStatus = "";
    render();
  } catch (err) {
    listError = "Falha ao abrir personagem: " + (err.message || err);
    render();
  }
}

// Abertura a partir de "Meus Personagens": sempre edição total, sem vínculo
// de campanha (não mostra o botão "voltar para campanha").
async function openCharacter(path) {
  sheetReadOnly = false;
  sheetCampaignSlug = null;
  await openCharacterCore(path);
}

// Abertura a partir de um painel de campanha: só o dono do personagem ou o
// mestre da campanha podem editar; qualquer outro membro vê em modo leitura.
async function openLinkedCharacter(owner, characterId, slug) {
  const user = getStoredUser();
  const isSelf = owner === user.login;
  const isGm = !!(currentCampaign && currentCampaign.members.some((m) => m.username === user.login && m.role === "gm"));
  sheetReadOnly = !(isSelf || isGm);
  sheetCampaignSlug = slug;
  await openCharacterCore(`users/${owner}/characters/${characterId}.json`);
}

// ---------- Eventos ----------
function attachEvents() {
  const loginBtn = document.getElementById("login-btn");
  if (loginBtn) {
    loginBtn.addEventListener("click", async () => {
      const input = document.getElementById("token-input");
      const token = input.value.trim();
      if (!token) return;
      loginLoading = true;
      loginError = "";
      render();
      const result = await validateAndStoreToken(token);
      loginLoading = false;
      if (result.ok) {
        goToList();
      } else {
        loginError = result.error;
        render();
      }
    });
  }

  document.querySelectorAll("[data-action='logout']").forEach((btn) => {
    btn.addEventListener("click", () => {
      clearAuth();
      screen = "login";
      loginError = "";
      render();
    });
  });

  document.querySelectorAll("[data-action='new-character']").forEach((btn) => {
    btn.addEventListener("click", createNewCharacter);
  });

  document.querySelectorAll("[data-action='open-character']").forEach((btn) => {
    btn.addEventListener("click", () => openCharacter(btn.dataset.path));
  });

  document.querySelectorAll("[data-action='nav-characters']").forEach((btn) => {
    btn.addEventListener("click", goToList);
  });
  document.querySelectorAll("[data-action='nav-campaigns']").forEach((btn) => {
    btn.addEventListener("click", goToCampaigns);
  });
  document.querySelectorAll("[data-action='nav-monsters']").forEach((btn) => {
    btn.addEventListener("click", goToBestiary);
  });

  document.querySelectorAll("[data-action='nav-system']").forEach((btn) => {
    btn.addEventListener("click", goToSystemBook);
  });

  document.querySelectorAll("[data-action='system-book-upload']").forEach((input) => {
    input.addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      systemBookUploading = true;
      systemBookError = "";
      render();
      try {
        const dataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = () => reject(new Error("Falha ao ler o arquivo."));
          reader.readAsDataURL(file);
        });
        const base64 = dataUrl.split(",")[1];
        const user = getStoredUser();
        const existingDataSha = systemBookMeta ? systemBookMeta.dataSha : null;
        const dataSha = await writeRawFile(
          "system/rulebook_data",
          base64,
          existingDataSha,
          `feat: atualiza o livro do sistema (${file.name})`
        );
        const meta = {
          fileName: file.name,
          mimeType: file.type || "application/octet-stream",
          sizeBytes: file.size,
          uploadedAt: new Date().toISOString(),
          uploadedBy: user.login,
          dataSha,
        };
        await writeJsonFile(
          "system/rulebook_meta.json",
          meta,
          systemBookMetaSha,
          `feat: atualiza metadados do livro do sistema (${file.name})`
        );
        systemBookMeta = meta;
        const fresh = await readJsonFile("system/rulebook_meta.json");
        if (fresh) systemBookMetaSha = fresh.sha;
      } catch (err) {
        systemBookError = "Falha ao enviar arquivo: " + (err.message || err);
      }
      systemBookUploading = false;
      render();
    });
  });

  document.querySelectorAll("[data-action='system-book-download']").forEach((btn) => {
    btn.addEventListener("click", async () => {
      try {
        const raw = await readRawFile("system/rulebook_data");
        if (!raw) return;
        const byteChars = atob(raw.base64);
        const byteNumbers = new Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i);
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: (systemBookMeta && systemBookMeta.mimeType) || "application/octet-stream" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = (systemBookMeta && systemBookMeta.fileName) || "livro-do-sistema";
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      } catch (err) {
        systemBookError = "Falha ao baixar arquivo: " + (err.message || err);
        render();
      }
    });
  });

  document.querySelectorAll("[data-action='system-book-remove']").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm("Remover o arquivo atual do livro do sistema?")) return;
      try {
        if (systemBookMeta && systemBookMeta.dataSha) {
          await deleteFile("system/rulebook_data", systemBookMeta.dataSha, "chore: remove o livro do sistema");
        }
        if (systemBookMetaSha) {
          await deleteFile("system/rulebook_meta.json", systemBookMetaSha, "chore: remove metadados do livro do sistema");
        }
        systemBookMeta = null;
        systemBookMetaSha = null;
      } catch (err) {
        systemBookError = "Falha ao remover: " + (err.message || err);
      }
      render();
    });
  });

  document.querySelectorAll("[data-action='campaigns-subtab-mine']").forEach((btn) => {
    btn.addEventListener("click", () => goToCampaignsSubTab("mine"));
  });
  document.querySelectorAll("[data-action='campaigns-subtab-all']").forEach((btn) => {
    btn.addEventListener("click", () => goToCampaignsSubTab("all"));
  });

  document.querySelectorAll("[data-action='create-campaign']").forEach((btn) => {
    btn.addEventListener("click", handleCreateCampaign);
  });
  const newCampaignInput = document.getElementById("new-campaign-name");
  if (newCampaignInput) {
    newCampaignInput.addEventListener("input", (e) => { newCampaignName = e.target.value; });
    newCampaignInput.addEventListener("keydown", (e) => { if (e.key === "Enter") handleCreateCampaign(); });
  }

  document.querySelectorAll("[data-action='open-campaign']").forEach((btn) => {
    btn.addEventListener("click", () => openCampaignDashboardScreen(btn.dataset.slug));
  });

  document.querySelectorAll("[data-action='back-to-campaigns']").forEach((btn) => {
    btn.addEventListener("click", goToCampaigns);
  });

  document.querySelectorAll("[data-action='do-link-character']").forEach((btn) => {
    btn.addEventListener("click", handleLinkCharacter);
  });
  const linkOwnerEl = document.getElementById("link-owner-input");
  if (linkOwnerEl) linkOwnerEl.addEventListener("input", (e) => { linkOwnerInput = e.target.value; });
  const linkCharIdEl = document.getElementById("link-charid-input");
  if (linkCharIdEl) linkCharIdEl.addEventListener("input", (e) => { linkCharIdInput = e.target.value; });

  document.querySelectorAll("[data-action='unlink-character']").forEach((btn) => {
    btn.addEventListener("click", () => handleUnlinkCharacter(btn.dataset.owner, btn.dataset.id));
  });

  document.querySelectorAll("[data-action='back-to-list']").forEach((btn) => {
    btn.addEventListener("click", () => {
      clearTimeout(saveTimer);
      goToList();
    });
  });

  document.querySelectorAll("[data-action='back-to-campaign']").forEach((btn) => {
    btn.addEventListener("click", () => {
      clearTimeout(saveTimer);
      if (sheetCampaignSlug) openCampaignDashboardScreen(sheetCampaignSlug);
    });
  });

  document.querySelectorAll("[data-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      activeTab = btn.dataset.tab;
      classConfirm = false;
      render();
    });
  });

  document.querySelectorAll("[data-bind]").forEach((input) => {
    input.addEventListener("input", () => {
      const path = input.dataset.bind.split(".");
      let obj = character;
      for (let i = 0; i < path.length - 1; i++) obj = obj[path[i]];
      const key = path[path.length - 1];
      obj[key] = input.dataset.numeric ? Number(input.value || 0) : input.value;
      if (input.dataset.bind.startsWith("resources.")) updateResourceBarsInPlace();
      if (input.dataset.bind === "basic.name") {
        document.querySelector(".char-name").textContent = character.basic.name;
      }
      scheduleSave();
    });
  });

  document.querySelectorAll("[data-photo-bind]").forEach((fileInput) => {
    fileInput.addEventListener("change", async () => {
      const file = fileInput.files[0];
      if (!file) return;
      let dataUrl;
      try {
        dataUrl = await readImageFileAsDataUrl(file);
      } catch (err) {
        return;
      }
      const path = fileInput.dataset.photoBind.split(".");
      let obj = character;
      for (let i = 0; i < path.length - 1; i++) obj = obj[path[i]];
      obj[path[path.length - 1]] = dataUrl;
      scheduleSave();
      render();
    });
  });

  document.querySelectorAll("[data-action='clear-avatar-photo']").forEach((btn) => {
    btn.addEventListener("click", () => {
      character.basic.photoUrl = "";
      scheduleSave();
      render();
    });
  });

  document.querySelectorAll("[data-image-target]").forEach((fileInput) => {
    fileInput.addEventListener("change", async () => {
      const file = fileInput.files[0];
      if (!file) return;
      let dataUrl;
      try {
        dataUrl = await readImageFileAsDataUrl(file);
      } catch (err) {
        return;
      }
      const targetId = fileInput.dataset.imageTarget;
      const hiddenInput = document.getElementById(targetId);
      if (hiddenInput) hiddenInput.value = dataUrl;
      const preview = document.querySelector(`label.image-upload-preview[for="${fileInput.id}"]`);
      if (preview) preview.innerHTML = `<img src="${dataUrl}" alt="">`;
      const label = fileInput.parentElement ? fileInput.parentElement.querySelector(".image-upload-label") : null;
      if (label) label.textContent = "trocar imagem";
    });
  });

  document.querySelectorAll("[data-list]").forEach((input) => {
    const eventName = input.dataset.select === "true" ? "change" : "input";
    input.addEventListener(eventName, () => {
      const list = character[input.dataset.list];
      const item = list.find((x) => x.id === input.dataset.id);
      if (!item) return;
      item[input.dataset.field] = input.dataset.numeric ? Number(input.value || 0) : input.value;
      scheduleSave();
    });
  });

  document.querySelectorAll("[data-action='remove']").forEach((btn) => {
    btn.addEventListener("click", () => {
      character[btn.dataset.list] = character[btn.dataset.list].filter((x) => x.id !== btn.dataset.id);
      render();
      scheduleSave();
    });
  });

  bindAction("add-skill", () => character.skills.push({ id: uid(), name: "Nova Perícia", training: 0, buff: 0 }));
  bindAction("add-ability", () => character.abilities.push({ id: uid(), name: "Nova Habilidade", description: "" }));
  bindAction("add-item", () => character.items.push({ id: uid(), name: "Novo Item", description: "", attackRoll: "", critRange: "", critMultiplier: "2" }));
  bindAction("add-attack", () => character.attacks.push({ id: uid(), name: "Novo Ataque", dice: "1d6", critRange: "20", critMultiplier: "2" }));

  bindAction("level-down", () => {
    if (character.resources.level <= 1) return;
    character.resources.level -= 1;
    character.resources.hpMax = Math.max(10, character.resources.hpMax - 10);
    character.resources.hpCurrent = Math.min(character.resources.hpCurrent, character.resources.hpMax);
    character.resources.mpMax = Math.max(0, character.resources.mpMax - 20);
    character.resources.mpCurrent = Math.min(character.resources.mpCurrent, character.resources.mpMax);
  });

  document.querySelectorAll("[data-action='add-xp']").forEach((btn) => {
    btn.addEventListener("click", () => {
      const input = document.getElementById("xp-gain-input");
      const amount = input ? parseInt(input.value, 10) : 0;
      if (!amount || amount <= 0) return;
      applyXpGain(character, amount);
      render();
      scheduleSave();
    });
  });

  document.querySelectorAll("[data-action='copy-id']").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id;
      try {
        await navigator.clipboard.writeText(id);
        btn.textContent = "Copiado ✓";
        setTimeout(() => { btn.textContent = `ID: ${id} (copiar)`; }, 1500);
      } catch {
        alert(`ID do personagem: ${id}`);
      }
    });
  });

  document.querySelectorAll("[data-action='open-linked-character']").forEach((btn) => {
    btn.addEventListener("click", () => openLinkedCharacter(btn.dataset.owner, btn.dataset.id, currentCampaignSlug));
  });

  document.querySelectorAll("[data-action='roll-ability']").forEach((btn) => {
    btn.addEventListener("click", () => {
      const ab = character.abilities.find((x) => x.id === btn.dataset.id);
      doRoll(ab.dice, 0, `Habilidade: ${ab.name}`);
    });
  });

  bindAction("class-add-field", () => { character.classInfo.fields.push(["", ""]); });
  bindAction("class-confirm", () => { classConfirm = true; });

  document.querySelectorAll("[data-class-field]").forEach((input) => {
    input.addEventListener("input", () => {
      const i = Number(input.dataset.classField);
      const part = Number(input.dataset.classFieldPart);
      character.classInfo.fields[i][part] = input.value;
      scheduleSave();
    });
  });

  document.querySelectorAll("[data-action='toggle-history']").forEach((btn) => {
    btn.addEventListener("click", () => {
      showHistory = !showHistory;
      render();
    });
  });

  document.querySelectorAll("[data-action='close-history-bg']").forEach((el) => {
    el.addEventListener("click", (e) => {
      if (e.target === el) {
        showHistory = false;
        render();
      }
    });
  });

  document.querySelectorAll("[data-action='toggle-campaign-history']").forEach((btn) => {
    btn.addEventListener("click", async () => {
      showCampaignHistory = !showCampaignHistory;
      if (showCampaignHistory && currentCampaign) {
        campaignHistoryLoading = true;
        render();
        try {
          campaignHistoryEntries = await loadCampaignRollHistory(currentCampaignSlug, currentCampaign.linked);
        } catch {
          campaignHistoryEntries = [];
        }
        campaignHistoryLoading = false;
      }
      render();
    });
  });

  document.querySelectorAll("[data-action='close-campaign-history-bg']").forEach((el) => {
    el.addEventListener("click", (e) => {
      if (e.target === el) {
        showCampaignHistory = false;
        render();
      }
    });
  });

  document.querySelectorAll("[data-action='promote-training']").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (sheetReadOnly) return;
      const s = character.skills.find((x) => x.id === btn.dataset.id);
      if (!s) return;
      const levels = TRAINING_LEVELS.map((t) => t.value);
      const idx = levels.indexOf(Number(s.training || 0));
      if (idx >= 0 && idx < levels.length - 1) s.training = levels[idx + 1];
      render();
      scheduleSave();
    });
  });

  document.querySelectorAll("[data-action='save-campaign-description']").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const input = document.getElementById("campaign-desc-input");
      const description = input ? input.value : "";
      campaignDescSaving = true;
      campaignDescSaved = false;
      render();
      try {
        await saveCampaignDescription(currentCampaignSlug, description, currentCampaign?.campaignSha);
        currentCampaign = await loadCampaignDashboard(currentCampaignSlug);
        campaignDescSaved = true;
        campaignDashError = "";
      } catch (err) {
        campaignDashError = "Falha ao salvar descrição: " + (err.message || err);
      }
      campaignDescSaving = false;
      render();
      setTimeout(() => { campaignDescSaved = false; render(); }, 2500);
    });
  });

  document.querySelectorAll("[data-action='toggle-bulk-monster-add']").forEach((btn) => {
    btn.addEventListener("click", () => {
      showBulkMonsterAdd = !showBulkMonsterAdd;
      bulkMonsterError = "";
      render();
    });
  });

  document.querySelectorAll("[data-action='do-add-monsters-bulk']").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const textarea = document.getElementById("bulk-monster-textarea");
      const text = textarea ? textarea.value : "";
      const monsters = parseBulkMonsterText(text);
      if (monsters.length === 0) {
        bulkMonsterError = "Escreva pelo menos um monstro, um por linha.";
        render();
        return;
      }
      try {
        await addMonstersBulk(currentCampaignSlug, monsters);
        bulkMonsterError = "";
        showBulkMonsterAdd = false;
        currentCampaign = await loadCampaignDashboard(currentCampaignSlug);
      } catch (err) {
        bulkMonsterError = "Falha ao criar monstros: " + (err.message || err);
      }
      render();
    });
  });

  document.querySelectorAll("[data-action='toggle-new-monster-form']").forEach((btn) => {
    btn.addEventListener("click", () => {
      showNewMonsterForm = !showNewMonsterForm;
      newMonsterFormError = "";
      render();
    });
  });

  document.querySelectorAll("[data-action='do-create-monster']").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const user = getStoredUser();
      const nameEl = document.getElementById("new-monster-name");
      const levelEl = document.getElementById("new-monster-level");
      const hpEl = document.getElementById("new-monster-hp");
      const mpEl = document.getElementById("new-monster-mp");
      const imageEl = document.getElementById("new-monster-image");
      const descEl = document.getElementById("new-monster-desc");
      const name = nameEl ? nameEl.value.trim() : "";
      if (!name) {
        newMonsterFormError = "Dê um nome ao monstro.";
        render();
        return;
      }
      const monster = {
        name,
        level: levelEl && levelEl.value ? Number(levelEl.value) : 1,
        hp: hpEl && hpEl.value ? Number(hpEl.value) : 0,
        mp: mpEl && mpEl.value ? Number(mpEl.value) : 0,
        imageUrl: imageEl ? imageEl.value.trim() : "",
        description: descEl ? descEl.value.trim() : "",
      };
      try {
        await createBestiaryMonster(monster, user.login);
        newMonsterFormError = "";
        showNewMonsterForm = false;
        const res = await loadBestiary();
        bestiaryList = res.data;
        bestiarySha = res.sha;
      } catch (err) {
        newMonsterFormError = "Falha ao criar monstro: " + (err.message || err);
      }
      render();
    });
  });

  document.querySelectorAll("[data-action='edit-monster']").forEach((btn) => {
    btn.addEventListener("click", () => {
      editingMonsterId = btn.dataset.id;
      editMonsterFormError = "";
      render();
    });
  });

  document.querySelectorAll("[data-action='cancel-monster-edit']").forEach((btn) => {
    btn.addEventListener("click", () => {
      editingMonsterId = null;
      editMonsterFormError = "";
      render();
    });
  });

  document.querySelectorAll("[data-action='do-save-monster-edit']").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const user = getStoredUser();
      const id = btn.dataset.id;
      const nameEl = document.getElementById(`edit-monster-name-${id}`);
      const levelEl = document.getElementById(`edit-monster-level-${id}`);
      const hpEl = document.getElementById(`edit-monster-hp-${id}`);
      const mpEl = document.getElementById(`edit-monster-mp-${id}`);
      const imageEl = document.getElementById(`edit-monster-image-${id}`);
      const descEl = document.getElementById(`edit-monster-desc-${id}`);
      const name = nameEl ? nameEl.value.trim() : "";
      if (!name) {
        editMonsterFormError = "Dê um nome ao monstro.";
        render();
        return;
      }
      const updates = {
        name,
        level: levelEl && levelEl.value ? Number(levelEl.value) : 1,
        hp: hpEl && hpEl.value ? Number(hpEl.value) : 0,
        mp: mpEl && mpEl.value ? Number(mpEl.value) : 0,
        imageUrl: imageEl ? imageEl.value.trim() : "",
        description: descEl ? descEl.value.trim() : "",
      };
      try {
        await updateBestiaryMonster(id, updates, user.login);
        editingMonsterId = null;
        editMonsterFormError = "";
        const res = await loadBestiary();
        bestiaryList = res.data;
        bestiarySha = res.sha;
      } catch (err) {
        editMonsterFormError = "Falha ao salvar: " + (err.message || err);
      }
      render();
    });
  });

  document.querySelectorAll("[data-action='do-delete-monster']").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const user = getStoredUser();
      if (!confirm("Apagar este monstro do bestiário? Isso não afeta cópias já adicionadas em campanhas.")) return;
      try {
        await deleteBestiaryMonster(btn.dataset.id, user.login);
        const res = await loadBestiary();
        bestiaryList = res.data;
        bestiarySha = res.sha;
      } catch (err) {
        bestiaryError = "Falha ao apagar monstro: " + (err.message || err);
      }
      render();
    });
  });

  document.querySelectorAll("[data-action='do-add-monster']").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const nameEl = document.getElementById("monster-name-input");
      const levelEl = document.getElementById("monster-level-input");
      const hpEl = document.getElementById("monster-hp-input");
      const mpEl = document.getElementById("monster-mp-input");
      const imageEl = document.getElementById("monster-image-input");
      const descEl = document.getElementById("monster-desc-input");
      const name = nameEl ? nameEl.value.trim() : "";
      if (!name) {
        monsterFormError = "Dê um nome ao monstro.";
        render();
        return;
      }
      const monster = {
        name,
        level: levelEl && levelEl.value ? Number(levelEl.value) : 1,
        hp: hpEl && hpEl.value ? Number(hpEl.value) : 0,
        mp: mpEl && mpEl.value ? Number(mpEl.value) : 0,
        imageUrl: imageEl ? imageEl.value.trim() : "",
        description: descEl ? descEl.value.trim() : "",
      };
      try {
        await addMonster(currentCampaignSlug, monster);
        monsterFormError = "";
        currentCampaign = await loadCampaignDashboard(currentCampaignSlug);
      } catch (err) {
        monsterFormError = "Falha ao criar monstro: " + (err.message || err);
      }
      render();
    });
  });

  document.querySelectorAll("[data-action='remove-monster']").forEach((btn) => {
    btn.addEventListener("click", async () => {
      try {
        await removeMonster(currentCampaignSlug, btn.dataset.id);
        currentCampaign = await loadCampaignDashboard(currentCampaignSlug);
      } catch (err) {
        campaignDashError = "Falha ao remover monstro: " + (err.message || err);
      }
      render();
    });
  });

  document.querySelectorAll("[data-action='roll-skill']").forEach((btn) => {
    btn.addEventListener("click", () => {
      const s = character.skills.find((x) => x.id === btn.dataset.id);
      doRoll("1d20", skillBonus(s), `Perícia: ${s.name}`);
    });
  });
  document.querySelectorAll("[data-action='roll-item']").forEach((btn) => {
    btn.addEventListener("click", () => {
      const it = character.items.find((x) => x.id === btn.dataset.id);
      doRoll(it.attackRoll, 0, `Item: ${it.name}`, it.critRange, it.critMultiplier);
    });
  });
  document.querySelectorAll("[data-action='roll-attack-test']").forEach((btn) => {
    btn.addEventListener("click", () => {
      const a = character.attacks.find((x) => x.id === btn.dataset.id);
      doAttackTest(a);
    });
  });
}

function bindAction(name, handler) {
  document.querySelectorAll(`[data-action='${name}']`).forEach((btn) => {
    btn.addEventListener("click", () => {
      handler();
      render();
      scheduleSave();
    });
  });
}

function updateResourceBarsInPlace() {
  const r = character.resources;
  [
    { selector: ".bar-block-hpCurrent", current: r.hpCurrent, max: r.hpMax },
    { selector: ".bar-block-mpCurrent", current: r.mpCurrent, max: r.mpMax },
  ].forEach((cfg) => {
    const block = document.querySelector(cfg.selector);
    if (!block) return;
    const pct = cfg.max > 0 ? Math.max(0, Math.min(100, (cfg.current / cfg.max) * 100)) : 0;
    block.querySelector(".bar-fill").style.width = pct + "%";
    block.querySelector(".bar-top span:last-child").textContent = `${cfg.current} / ${cfg.max}`;
  });
}

// ---------- Inicialização ----------
async function init() {
  const token = getStoredToken();
  if (!token) {
    screen = "login";
    render();
    return;
  }
  const result = await validateAndStoreToken(token);
  if (result.ok) {
    goToList();
  } else {
    clearAuth();
    screen = "login";
    loginError = "Sua sessão expirou. Faça login novamente.";
    render();
  }
}

init();
