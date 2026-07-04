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
    resources: { level: 1, hpCurrent: 20, hpMax: 20, mpCurrent: 20, mpMax: 20 },
    skills: [{ id: uid(), name: "Investigação", bonus: 2, dice: "1d20" }],
    abilities: [],
    items: [],
    attacks: [{ id: uid(), name: "Faca de Combate", dice: "1d6+1", critRange: "20" }],
  };
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

function doRoll(dice, bonus, label) {
  const base = rollDice(dice);
  if (!base) {
    toast = { label: "Erro", roll: `Notação inválida: "${dice}"`, total: null };
    render();
    setTimeout(() => { toast = null; render(); }, 3000);
    return;
  }
  const result = bonus ? { ...base, mod: base.mod + bonus, total: base.total + bonus } : base;
  toast = {
    label,
    roll: `${result.notation} → [${result.rolls.join(", ")}] ${result.mod >= 0 ? "+" : ""}${result.mod}`,
    total: result.total,
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
      <button class="char-list-item" data-action="open-character" data-path="${esc(c.path)}">
        <span>${esc(c.name)}</span>
        <span class="char-list-arrow">→</span>
      </button>`
    )
    .join("");

  return `
    <div class="center-box">
      <div class="login-card" style="max-width:480px;">
        <div class="eyebrow">Conectado como ${esc(user?.login || "")}</div>
        ${renderNavTabs("characters")}
        <h1 class="char-name" style="margin-bottom:1rem;">Meus Personagens</h1>
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
      <button class="char-list-item" data-action="open-campaign" data-slug="${esc(c.slug)}">
        <span>${esc(c.name)} <span class="role-tag">${c.role === "gm" ? "mestre" : "jogador"}</span></span>
        <span class="char-list-arrow">→</span>
      </button>`
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
        ${isGm ? `<button class="btn-link danger" data-action="unlink-character" data-owner="${esc(entry.characterOwner)}" data-id="${esc(entry.characterId)}">remover</button>` : ""}
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
    <button class="btn-link" data-action="class-add-field">+ campo</button>
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
      
