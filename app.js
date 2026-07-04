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

let currentCampaignSlug = null;
let currentCampaign = null;   // { campaign, members, linked, membersSha, linkedSha }
let campaignDashError = "";
let linkOwnerInput = "";
let linkCharIdInput = "";

let activeTab = "basic";
let toast = null;
let classConfirm = false;

function uid() {
  return Math.random().toString(36).slice(2, 8);
}

function emptyCharacter() {
  return {
    basic: { name: "Investigador Sem Nome", photoUrl: "", age: "", weight: "", height: "", financialStatus: "Estável" },
    classInfo: { skipped: true, name: "", fields: [] },
    resources: { level: 1, hpCurrent: 20, hpMax: 20, mpCurrent: 20, mpMax: 20, xp: 0, gold: 0 },
    skills: [{ id: uid(), name: "Investigação", bonus: 2, dice: "1d20" }],
    abilities: [],
    items: [],
    attacks: [{ id: uid(), name: "Faca de Combate", dice: "1d6+1", critRange: "20", critMultiplier: "2" }],
  };
}

// XP necessário pra subir de CADA nível (índice 0 = do nível 1 pro 2, etc).
// Depois do último valor da lista, cada nível seguinte soma mais 5000.
const XP_TABLE = [100, 500, 2500, 5000, 10000];

function xpNeededForLevel(level) {
  const index = level - 1;
  if (index < XP_TABLE.length) return XP_TABLE[index];
  return XP_TABLE[XP_TABLE.length - 1] + (index - XP_TABLE.length + 1) * 5000;
}

// Aplica XP ganho, subindo quantos níveis forem necessários e mantendo o restante.
function applyXpGain(character, amount) {
  let xp = character.resources.xp + amount;
  let level = character.resources.level;
  let levelsGained = 0;
  while (xp >= xpNeededForLevel(level)) {
    xp -= xpNeededForLevel(level);
    level += 1;
    levelsGained += 1;
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

async function createCampaign(name, gmUsername) {
  const slug = slugify(name) + "-" + uid();
  const campaign = { name, gmUsername, createdAt: new Date().toISOString() };
  const members = [{ username: gmUsername, role: "gm" }];
  const linked = [];

  await writeJsonFile(`campaigns/${slug}/campaign.json`, campaign, null, `feat: cria campanha "${name}"`);
  await writeJsonFile(`campaigns/${slug}/members.json`, members, null, `feat: membros iniciais de "${name}"`);
  await writeJsonFile(`campaigns/${slug}/linked_characters.json`, linked, null, `feat: vínculos iniciais de "${name}"`);

  return slug;
}

async function loadCampaignDashboard(slug) {
  const campaignRes = await readJsonFile(`campaigns/${slug}/campaign.json`);
  const membersRes = await readJsonFile(`campaigns/${slug}/members.json`);
  const linkedRes = await readJsonFile(`campaigns/${slug}/linked_characters.json`);
  return {
    campaign: campaignRes.data,
    members: membersRes.data,
    membersSha: membersRes.sha,
    linked: linkedRes.data,
    linkedSha: linkedRes.sha,
  };
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
  { id: "basic", label: "Básico", icon: "user" },
  { id: "class", label: "Classe", icon: "layers" },
  { id: "resources", label: "Recursos", icon: "heart" },
  { id: "skills", label: "Perícias", icon: "sparkles" },
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
  return { notation, rolls, mod, total };
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

  let finalTotal = result.total;
  let critNote = "";
  if (isCrit && multiplier > 1) {
    const diceSum = result.rolls.reduce((a, b) => a + b, 0);
    finalTotal = diceSum * multiplier + result.mod;
    critNote = ` — CRÍTICO ×${multiplier}!`;
  } else if (isCrit) {
    critNote = " — CRÍTICO!";
  }

  toast = {
    label: label + critNote,
    roll: `${result.notation} → [${result.rolls.join(", ")}] ${result.mod >= 0 ? "+" : ""}${result.mod}`,
    total: finalTotal,
  };
  render();
  setTimeout(() => { toast = null; render(); }, 4500);
}

function esc(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

// ---------- Salvamento automático ----------
function scheduleSave() {
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
    <div class="center-box">
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
      <button class="nav-tab ${active === "campaigns" ? "active" : ""}" data-action="nav-campaigns">Minhas Campanhas</button>
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
        <button class="btn-link" data-action="logout" style="margin-top:14px;display:block;">Sair</button>
      </div>
    </div>`;
}

function renderCampaigns() {
  const user = getStoredUser();
  const items = campaignList
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

  return `
    <div class="center-box">
      <div class="login-card" style="max-width:480px;">
        <div class="eyebrow">Conectado como ${esc(user?.login || "")}</div>
        ${renderNavTabs("campaigns")}
        <h1 class="char-name" style="margin-bottom:1rem;">Minhas Campanhas</h1>
        ${campaignsError ? `<p class="login-error">${esc(campaignsError)}</p>` : ""}
        ${campaignsLoading ? `<p class="helper-text">Carregando...</p>` : items || `<p class="helper-text">Nenhuma campanha ainda.</p>`}
        <div style="margin-top:14px;display:flex;gap:8px;">
          <input type="text" id="new-campaign-name" placeholder="Nome da nova campanha" value="${esc(newCampaignName)}" />
          <button class="btn btn-stamp" data-action="create-campaign">Criar</button>
        </div>
        <button class="btn-link" data-action="logout" style="margin-top:14px;display:block;">Sair</button>
      </div>
    </div>`;
}

function renderCampaignDashboard() {
  const user = getStoredUser();
  const cd = currentCampaign;
  if (!cd) return `<div class="center-box"><p>Carregando campanha...</p></div>`;

  const isGm = cd.members.some((m) => m.username === user.login && m.role === "gm");

  const linkedItems = cd.linked
    .map(
      (entry) => `
      <li class="linked-item">
        <span><strong>${esc(entry.characterOwner)}</strong> — ${esc(entry.characterId)}</span>
        <span style="display:flex;gap:10px;align-items:center;">
          <button class="btn-link" data-action="open-linked-character" data-owner="${esc(entry.characterOwner)}" data-id="${esc(entry.characterId)}">abrir ficha</button>
          ${isGm ? `<button class="btn-link danger" data-action="unlink-character" data-owner="${esc(entry.characterOwner)}" data-id="${esc(entry.characterId)}">remover</button>` : ""}
        </span>
      </li>`
    )
    .join("");

  const membersItems = cd.members
    .map((m) => `<li>${esc(m.username)} — <span class="helper-text" style="display:inline;">${m.role === "gm" ? "Mestre" : "Jogador"}</span></li>`)
    .join("");

  return `
    <div class="center-box">
      <div class="login-card" style="max-width:560px;">
        <button class="btn-link" data-action="back-to-campaigns" style="margin-bottom:10px;display:block;">← minhas campanhas</button>
        <div class="eyebrow">Painel da Campanha</div>
        <h1 class="char-name" style="margin-bottom:1rem;">${esc(cd.campaign.name)}</h1>
        ${campaignDashError ? `<p class="login-error">${esc(campaignDashError)}</p>` : ""}

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

        <h2 class="section-title" style="margin-top:1.5rem;">Membros</h2>
        <ul class="members-list">${membersItems}</ul>
      </div>
    </div>`;
}

// ---------- Conteúdo das abas (idêntico ao protótipo anterior) ----------
function renderBasic() {
  const b = character.basic;
  return `
    <div class="avatar-row">
      <div class="avatar">${b.photoUrl ? `<img src="${esc(b.photoUrl)}" alt="">` : ICONS.user}</div>
      <div style="flex:1">
        <label class="field">
          <span class="field-label">Nome do personagem</span>
          <input type="text" data-bind="basic.name" value="${esc(b.name)}" />
        </label>
      </div>
    </div>
    <label class="field">
      <span class="field-label">URL da foto</span>
      <input type="text" data-bind="basic.photoUrl" value="${esc(b.photoUrl)}" placeholder="https://..." />
    </label>
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
    </div>`;
}

function renderClass() {
  const cl = character.classInfo;
  if (cl.skipped) {
    return `
      <span class="stamp">etapa pulada</span>
      <p class="helper-text">Nenhuma classe definida. Você pode preencher isso a qualquer momento.</p>
      <button class="btn btn-teal" data-action="class-start">Definir uma classe</button>`;
  }
  const fieldsHtml = cl.fields
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
    <div style="margin-top:14px;display:flex;gap:16px;align-items:center;">
      <button class="btn btn-stamp" data-action="class-confirm">Concluir criação da classe</button>
      <button class="btn-link danger" data-action="class-skip">pular esta etapa</button>
    </div>
    ${classConfirm ? `<div class="confirm-msg">✓ Classe "${esc(cl.name || "sem nome")}" salva.</div>` : ""}`;
}

function renderResources() {
  const r = character.resources;
  function bar(label, currentKey, maxKey, color) {
    const current = r[currentKey];
    const max = r[maxKey];
    const pct = max > 0 ? Math.max(0, Math.min(100, (current / max) * 100)) : 0;
    return `
      <div class="bar-block">
        <div class="bar-top">
          <span class="field-label" style="margin:0;">${label}</span>
          <span style="font-family:'Special Elite',monospace;font-size:13px;">${current} / ${max}</span>
        </div>
        <div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:${color};"></div></div>
        <div class="bar-inputs">
          <span>atual</span>
          <input type="number" data-bind="resources.${currentKey}" data-numeric="true" value="${current}" />
          <span>máx.</span>
          <input type="number" data-bind="resources.${maxKey}" data-numeric="true" value="${max}" />
        </div>
      </div>`;
  }

  const xpNeeded = xpNeededForLevel(r.level);
  const xpPct = Math.max(0, Math.min(100, (r.xp / xpNeeded) * 100));

  return `
    <div class="level-row">
      <div>
        <span class="field-label" style="display:block;">Nível</span>
        <div class="level-number">${r.level}</div>
      </div>
      <button class="btn btn-stamp" data-action="level-down" ${r.level <= 1 ? "disabled" : ""}>Reduzir Nível</button>
    </div>

    <div class="bar-block">
      <div class="bar-top">
        <span class="field-label" style="margin:0;">XP</span>
        <span style="font-family:'Special Elite',monospace;font-size:13px;">${r.xp} / ${xpNeeded}</span>
      </div>
      <div class="bar-track"><div class="bar-fill" style="width:${xpPct}%;background:#3b6fd6;"></div></div>
      <div class="bar-inputs">
        <input type="number" id="xp-gain-input" placeholder="quantidade" style="width:110px;" />
        <button class="btn btn-teal" data-action="add-xp" style="padding:6px 12px;font-size:12px;">+ adicionar XP</button>
      </div>
      <p class="helper-text" style="font-size:12px;margin-top:6px;">
        Some XP livremente; o personagem sobe quantos níveis forem necessários e mantém o restante automaticamente.
      </p>
    </div>

    <div class="bar-block">
      <div class="bar-top">
        <span class="field-label" style="margin:0;">Gold</span>
      </div>
      <input type="number" data-bind="resources.gold" data-numeric="true" value="${r.gold || 0}" />
    </div>

    ${bar("HP", "hpCurrent", "hpMax", "var(--stamp)")}
    ${bar("MP", "mpCurrent", "mpMax", "var(--teal)")}`;
}

function renderSkills() {
  const rows = character.skills
    .map(
      (s) => `
      <div class="skill-row" data-id="${s.id}">
        <input type="text" data-list="skills" data-id="${s.id}" data-field="name" value="${esc(s.name)}" />
        <input type="number" class="bonus" data-list="skills" data-id="${s.id}" data-field="bonus" data-numeric="true" value="${s.bonus}" />
        <input type="text" class="dice" data-list="skills" data-id="${s.id}" data-field="dice" value="${esc(s.dice)}" />
        <button class="dice-btn" data-action="roll-skill" data-id="${s.id}" title="Rolar">${ICONS.dice}</button>
        <button class="trash-btn" data-action="remove" data-list="skills" data-id="${s.id}">${ICONS.trash}</button>
      </div>`
    )
    .join("");
  return `${rows}<button class="btn-add" data-action="add-skill">${ICONS.plus} adicionar perícia</button>`;
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
  const rows = character.attacks
    .map(
      (a) => `
      <div class="attack-row" data-id="${a.id}">
        <input type="text" data-list="attacks" data-id="${a.id}" data-field="name" value="${esc(a.name)}" style="flex:1;font-weight:600;" />
        <input type="text" class="dice" data-list="attacks" data-id="${a.id}" data-field="dice" value="${esc(a.dice)}" title="Dado de dano" />
        <input type="text" data-list="attacks" data-id="${a.id}" data-field="critRange" value="${esc(a.critRange)}" style="width:56px;text-align:center;" title="Faixa de crítico (ex: 20 ou 19-20)" />
        <input type="text" data-list="attacks" data-id="${a.id}" data-field="critMultiplier" value="${esc(a.critMultiplier || "")}" style="width:44px;text-align:center;" placeholder="×2" title="Multiplicador de dano no crítico" />
        <button class="dice-btn" data-action="roll-attack" data-id="${a.id}" title="Rolar">${ICONS.dice}</button>
        <button class="trash-btn" data-action="remove" data-list="attacks" data-id="${a.id}">${ICONS.trash}</button>
      </div>`
    )
    .join("");
  return `${rows}<button class="btn-add" data-action="add-attack">${ICONS.plus} adicionar ataque</button>`;
}

function renderTabContent() {
  switch (activeTab) {
    case "basic": return renderBasic();
    case "class": return renderClass();
    case "resources": return renderResources();
    case "skills": return renderSkills();
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

  const idMatch = currentPath ? currentPath.match(/characters\/(.+)\.json$/) : null;
  const shortId = idMatch ? idMatch[1] : "";

  return `
    <div class="sheet">
      <div class="sheet-header">
        <div>
          <div class="eyebrow">Arquivo da Ordem — Ficha de Campo</div>
          <h1 class="char-name">${esc(character.basic.name)}</h1>
          <div id="save-indicator" class="save-indicator"></div>
          ${shortId ? `<button class="btn-copy-id" data-action="copy-id" data-id="${esc(shortId)}" style="margin-top:4px;">ID: ${esc(shortId)} (copiar)</button>` : ""}
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px;">
          <span class="stamp">confidencial</span>
          <button class="btn-link" data-action="back-to-list">← meus personagens</button>
        </div>
      </div>
      <div class="tabs">${tabsHtml}</div>
      <div class="tab-content">${renderTabContent()}</div>
    </div>`;
}

function renderToast() {
  if (!toast) return "";
  return `
    <div class="toast">
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
  else if (screen === "sheet") html = renderSheet();

  app.innerHTML = html + renderToast();
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
  try {
    await writeJsonFile(path, newChar, null, `feat: cria personagem "${newChar.basic.name}"`);
    character = newChar;
    currentPath = path;
    currentSha = null;
    const fresh = await readJsonFile(path);
    if (fresh) currentSha = fresh.sha;
    activeTab = "basic";
    screen = "sheet";
    saveStatus = "";
    render();
  } catch (err) {
    listError = "Falha ao criar personagem: " + (err.message || err);
    render();
  }
}

async function openCharacter(path) {
  try {
    const result = await readJsonFile(path);
    if (!result) throw new Error("Arquivo não encontrado");
    character = result.data;
    currentSha = result.sha;
    currentPath = path;
    activeTab = "basic";
    screen = "sheet";
    saveStatus = "";
    render();
  } catch (err) {
    listError = "Falha ao abrir personagem: " + (err.message || err);
    render();
  }
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
      if (activeTab === "resources") updateResourceBarsInPlace();
      if (activeTab === "basic" && input.dataset.bind === "basic.name") {
        document.querySelector(".char-name").textContent = character.basic.name;
      }
      scheduleSave();
    });
  });

  document.querySelectorAll("[data-list]").forEach((input) => {
    input.addEventListener("input", () => {
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

  bindAction("add-skill", () => character.skills.push({ id: uid(), name: "Nova Perícia", bonus: 0, dice: "1d20" }));
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
    btn.addEventListener("click", () => openCharacter(`users/${btn.dataset.owner}/characters/${btn.dataset.id}.json`));
  });

  document.querySelectorAll("[data-action='roll-ability']").forEach((btn) => {
    btn.addEventListener("click", () => {
      const ab = character.abilities.find((x) => x.id === btn.dataset.id);
      doRoll(ab.dice, 0, `Habilidade: ${ab.name}`);
    });
  });

  bindAction("class-start", () => { character.classInfo = { skipped: false, name: "", fields: [] }; });
  bindAction("class-add-field", () => { character.classInfo.fields.push(["", ""]); });
  bindAction("class-skip", () => { character.classInfo = { skipped: true, name: "", fields: [] }; classConfirm = false; });
  bindAction("class-confirm", () => { classConfirm = true; });

  document.querySelectorAll("[data-class-field]").forEach((input) => {
    input.addEventListener("input", () => {
      const i = Number(input.dataset.classField);
      const part = Number(input.dataset.classFieldPart);
      character.classInfo.fields[i][part] = input.value;
      scheduleSave();
    });
  });

  document.querySelectorAll("[data-action='roll-skill']").forEach((btn) => {
    btn.addEventListener("click", () => {
      const s = character.skills.find((x) => x.id === btn.dataset.id);
      doRoll(s.dice, s.bonus, `Perícia: ${s.name}`);
    });
  });
  document.querySelectorAll("[data-action='roll-item']").forEach((btn) => {
    btn.addEventListener("click", () => {
      const it = character.items.find((x) => x.id === btn.dataset.id);
      doRoll(it.attackRoll, 0, `Item: ${it.name}`, it.critRange, it.critMultiplier);
    });
  });
  document.querySelectorAll("[data-action='roll-attack']").forEach((btn) => {
    btn.addEventListener("click", () => {
      const a = character.attacks.find((x) => x.id === btn.dataset.id);
      doRoll(a.dice, 0, `Ataque: ${a.name}`, a.critRange, a.critMultiplier);
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
  const blocks = document.querySelectorAll(".bar-block");
  const configs = [
    { current: r.hpCurrent, max: r.hpMax },
    { current: r.mpCurrent, max: r.mpMax },
  ];
  blocks.forEach((block, i) => {
    const cfg = configs[i];
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
