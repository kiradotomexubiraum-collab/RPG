# Fluxo de Login via Personal Access Token (PAT)

## 1. Orientação para o jogador criar o token

Tela de instruções antes do campo de input (isso evita 90% das dúvidas de suporte):

```
1. Acesse: https://github.com/settings/personal-access-tokens/new
2. Nome do token: "Ficha RPG - [seu nome]"
3. Expiration: 90 dias (recomendado)
4. Repository access: "Only select repositories" → escolha "rpg-data"
5. Permissions:
   - Contents: Read and write
   - Issues: Read and write
   - Metadata: Read-only (obrigatório, já vem marcado)
6. Gere o token e cole abaixo.
   ⚠️ Ele só aparece uma vez — copie antes de sair da página.
```

Link direto pra facilitar (pode até vir pré-preenchido via query params do GitHub):
```
https://github.com/settings/personal-access-tokens/new?target_name=rpg-data
```

## 2. Armazenamento e contexto de autenticação

```typescript
// src/lib/github/auth.ts

const TOKEN_KEY = "rpg_gh_token";
const USER_CACHE_KEY = "rpg_gh_user";

export interface GithubUser {
  login: string;
  id: number;
  avatar_url: string;
  name: string | null;
}

export class AuthError extends Error {}

/** Valida o token chamando /user e retorna os dados do usuário. */
export async function validateAndStoreToken(token: string): Promise<GithubUser> {
  const res = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
    },
  });

  if (res.status === 401) {
    throw new AuthError("Token inválido ou expirado.");
  }
  if (!res.ok) {
    throw new AuthError(`Erro ao validar token (status ${res.status}).`);
  }

  const user: GithubUser = await res.json();

  // Confere se o token realmente tem acesso ao repo de dados
  const repoCheck = await fetch(
    "https://api.github.com/repos/SEU_ORG/rpg-data",
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!repoCheck.ok) {
    throw new AuthError(
      "Token válido, mas sem acesso ao repositório rpg-data. Confira o passo 4 do tutorial."
    );
  }

  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_CACHE_KEY, JSON.stringify(user));
  return user;
}

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser(): GithubUser | null {
  const raw = localStorage.getItem(USER_CACHE_KEY);
  return raw ? JSON.parse(raw) : null;
}

export function logout(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_CACHE_KEY);
}

/** Header pronto pra usar em qualquer chamada autenticada à API do GitHub. */
export function authHeaders(): HeadersInit {
  const token = getStoredToken();
  if (!token) throw new AuthError("Usuário não autenticado.");
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
  };
}
```

## 3. Tela de login (React)

```tsx
// src/routes/Login.tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { validateAndStoreToken, AuthError } from "../lib/github/auth";

export function Login() {
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const user = await validateAndStoreToken(token.trim());
      navigate("/campaigns");
    } catch (err) {
      setError(err instanceof AuthError ? err.message : "Erro inesperado.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto mt-16 p-6 border rounded-lg">
      <h1 className="text-xl font-bold mb-4">Entrar com GitHub Token</h1>

      <ol className="text-sm text-gray-600 list-decimal ml-4 mb-4 space-y-1">
        <li>
          Acesse{" "}
          <a
            className="underline"
            href="https://github.com/settings/personal-access-tokens/new?target_name=rpg-data"
            target="_blank"
            rel="noreferrer"
          >
            criar novo token
          </a>
        </li>
        <li>Repository access → apenas "rpg-data"</li>
        <li>Permissions → Contents e Issues: Read and write</li>
        <li>Cole o token gerado abaixo</li>
      </ol>

      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="password"
          placeholder="github_pat_..."
          value={token}
          onChange={(e) => setToken(e.target.value)}
          className="w-full border rounded px-3 py-2 font-mono text-sm"
          required
        />
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button
          type="submit"
          disabled={loading || !token}
          className="w-full bg-black text-white rounded py-2 disabled:opacity-50"
        >
          {loading ? "Validando..." : "Entrar"}
        </button>
      </form>
    </div>
  );
}
```

## 4. Guard de rota (protege páginas internas)

```tsx
// src/routes/RequireAuth.tsx
import { Navigate, Outlet } from "react-router-dom";
import { getStoredToken } from "../lib/github/auth";

export function RequireAuth() {
  const token = getStoredToken();
  if (!token) return <Navigate to="/login" replace />;
  return <Outlet />;
}
```

```tsx
// src/App.tsx (trecho de rotas)
<Routes>
  <Route path="/login" element={<Login />} />
  <Route element={<RequireAuth />}>
    <Route path="/campaigns" element={<CampaignList />} />
    <Route path="/campaigns/:slug" element={<CampaignDashboard />} />
    <Route path="/campaigns/:slug/characters/:id" element={<CharacterSheet />} />
  </Route>
</Routes>
```

## 5. Resolvendo o "papel" do usuário (GM ou jogador) após login

O token prova *quem* é (via `/user`), mas o **papel dentro da campanha** vem do `members.json` que já projetamos:

```typescript
// src/lib/permissions.ts
import { authHeaders } from "./github/auth";

export type Role = "gm" | "player" | "none";

interface Member {
  username: string;
  role: "gm" | "player";
}

export async function getRoleInCampaign(
  slug: string,
  githubLogin: string
): Promise<Role> {
  const res = await fetch(
    `https://api.github.com/repos/SEU_ORG/rpg-data/contents/campaigns/${slug}/members.json`,
    { headers: authHeaders() }
  );
  if (!res.ok) return "none";

  const data = await res.json();
  const content = atob(data.content); // GitHub retorna base64
  const members: Member[] = JSON.parse(content);

  const found = members.find(
    (m) => m.username.toLowerCase() === githubLogin.toLowerCase()
  );
  return found?.role ?? "none";
}
```

Esse `getRoleInCampaign` é chamado assim que a `CampaignDashboard` monta, e o resultado (`gm` / `player` / `none`) decide o que renderizar — inclusive bloqueando o acesso caso `none` (o token pode ter acesso de repo, mas não estar listado naquela campanha específica).

---

## Avisos importantes que a UI deve deixar claros pro jogador

- O token é armazenado em `localStorage` **sem criptografia** — qualquer script rodando na mesma origem (ex: uma extensão de navegador maliciosa) poderia lê-lo. Para o seu caso de uso (grupo fechado de amigos), o risco é baixo, mas vale um aviso na tela de login.
- Ao gerar o token, o jogador **deve** limitar a "Only select repositories" — nunca "All repositories" — isso é o que torna esse modelo aceitável.
- Adicione um botão "Sair" que chama `logout()` e limpa o `localStorage`, especialmente importante se o jogador usar computador compartilhado.

---

Próximos passos sugeridos: o hook de polling que usa esse `authHeaders()` para ler/escrever a ficha com tratamento de conflito de `sha`, ou a Action de validação "só o dono edita seu próprio arquivo". Qual prefere ver agora?
