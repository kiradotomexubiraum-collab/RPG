const GH_API = `https://api.github.com/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}`;

class ConflictError extends Error {
  constructor() {
    super("O arquivo foi alterado por outra pessoa ou aba enquanto você editava. Recarregue e tente novamente.");
  }
}

function b64EncodeUnicode(str) {
  return btoa(unescape(encodeURIComponent(str)));
}

function b64DecodeUnicode(str) {
  return decodeURIComponent(escape(atob(str.replace(/\n/g, ""))));
}

// Lê um arquivo JSON. Retorna { data, sha } ou null se não existir (404).
async function readJsonFile(path) {
  const res = await fetch(`${GH_API}/contents/${path}`, {
    headers: authHeaders(),
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Falha ao ler ${path}: status ${res.status}`);
  const json = await res.json();
  return { data: JSON.parse(b64DecodeUnicode(json.content)), sha: json.sha };
}

// Lista os arquivos de um diretório. Retorna [] se o diretório não existir.
async function listDirectory(path) {
  const res = await fetch(`${GH_API}/contents/${path}`, { headers: authHeaders(), cache: "no-store" });
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`Falha ao listar ${path}: status ${res.status}`);
  const json = await res.json();
  return Array.isArray(json) ? json : [];
}

// Lê um arquivo qualquer (não necessariamente JSON), devolvendo o conteúdo
// exatamente como o GitHub guarda (base64) + o sha. Útil pra arquivos binários
// como PDF, imagens etc. Retorna null se não existir (404).
async function readRawFile(path) {
  const res = await fetch(`${GH_API}/contents/${path}`, {
    headers: authHeaders(),
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Falha ao ler ${path}: status ${res.status}`);
  const json = await res.json();
  return { base64: json.content.replace(/\n/g, ""), sha: json.sha };
}

// Cria ou substitui um arquivo a partir de conteúdo já em base64 (sem
// reencodar como JSON) — pra arquivos binários como PDF, imagens etc.
async function writeRawFile(path, base64Content, knownSha, commitMessage) {
  const body = { message: commitMessage, content: base64Content };
  if (knownSha) body.sha = knownSha;

  const res = await fetch(`${GH_API}/contents/${path}`, {
    method: "PUT",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (res.status === 409) throw new ConflictError();
  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Falha ao salvar ${path}: status ${res.status} — ${errBody}`);
  }

  const json = await res.json();
  return json.content.sha;
}

// Apaga um arquivo do repositório (precisa do sha atual).
async function deleteFile(path, knownSha, commitMessage) {
  const res = await fetch(`${GH_API}/contents/${path}`, {
    method: "DELETE",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ message: commitMessage, sha: knownSha }),
  });
  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Falha ao apagar ${path}: status ${res.status} — ${errBody}`);
  }
}
// Cria ou atualiza um arquivo JSON. Se knownSha for null, tenta criar (falha se já existir
// e você não passou o sha certo). Retorna o novo sha.
async function writeJsonFile(path, data, knownSha, commitMessage) {
  const content = b64EncodeUnicode(JSON.stringify(data, null, 2));
  const body = { message: commitMessage, content };
  if (knownSha) body.sha = knownSha;

  const res = await fetch(`${GH_API}/contents/${path}`, {
    method: "PUT",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (res.status === 409) throw new ConflictError();
  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Falha ao salvar ${path}: status ${res.status} — ${errBody}`);
  }

  const json = await res.json();
  return json.content.sha;
}
