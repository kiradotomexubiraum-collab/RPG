const AUTH_TOKEN_KEY = "rpg_gh_token";
const AUTH_USER_KEY = "rpg_gh_user";

function getStoredToken() {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

function getStoredUser() {
  const raw = localStorage.getItem(AUTH_USER_KEY);
  return raw ? JSON.parse(raw) : null;
}

function clearAuth() {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(AUTH_USER_KEY);
}

function authHeaders() {
  const token = getStoredToken();
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
  };
}

// Valida o token chamando /user e confere acesso ao repositório configurado.
// Retorna { ok: true, user } ou { ok: false, error }.
async function validateAndStoreToken(token) {
  let userRes;
  try {
    userRes = await fetch("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
    });
  } catch (e) {
    return { ok: false, error: "Não foi possível conectar ao GitHub. Confira sua internet." };
  }

  if (userRes.status === 401) {
    return { ok: false, error: "Token inválido ou expirado." };
  }
  if (!userRes.ok) {
    return { ok: false, error: `Erro ao validar token (status ${userRes.status}).` };
  }

  const user = await userRes.json();

  const repoRes = await fetch(
    `https://api.github.com/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!repoRes.ok) {
    return {
      ok: false,
      error: `Token válido, mas sem acesso ao repositório "${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}". Confira o nome em config.js e a permissão do token.`,
    };
  }

  localStorage.setItem(AUTH_TOKEN_KEY, token);
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify({ login: user.login, avatar_url: user.avatar_url }));
  return { ok: true, user };
        }
