# Arquivo da Ordem — Ficha de Campo (conectada ao GitHub)

Ficha de personagem com salvamento automático real, usando o GitHub como banco de dados.
Sem build, sem npm — só HTML, CSS e JS puro.

## Como funciona

- Cada personagem vira um arquivo `users/{seu-usuario-github}/characters/{id}.json` dentro de um repositório de dados.
- Login é feito colando um token de acesso pessoal do GitHub (não existe conta/senha própria do site).
- Toda edição é salva automaticamente (com um pequeno atraso de ~1,2s após parar de digitar) via commit direto nesse repositório.

## Passo 1 — Criar o repositório de dados

1. Crie um repositório novo no GitHub, por exemplo `rpg-data`. Pode ser **privado** (recomendado, já que vai guardar suas fichas).
2. Não precisa colocar nada dentro dele — pode ficar vazio.

## Passo 2 — Editar `config.js`

Abra o arquivo `config.js` e troque os valores:

```js
const GITHUB_CONFIG = {
  owner: "seu-usuario-github",
  repo: "rpg-data",
};
```

## Passo 3 — Publicar o site

1. Crie (ou use) outro repositório para o **site** (pode ser o mesmo repo de dados também, se preferir manter tudo junto — nesse caso, coloque os arquivos do site numa pasta como `/docs` e configure o Pages pra servir a partir dela).
2. Suba `index.html`, `style.css`, `config.js`, `auth.js`, `github-api.js`, `app.js`.
3. Vá em **Settings → Pages** → Source: **Deploy from a branch** → `main` → `/ (root)` → Save.
4. Espere ~1 minuto e acesse o link gerado.

## Passo 4 — Criar seu token de acesso

1. Acesse: https://github.com/settings/personal-access-tokens/new
2. Repository access → **Only select repositories** → escolha o repositório de dados (`rpg-data`)
3. Permissions → **Contents: Read and write**
4. Generate token e copie (só aparece uma vez)
5. Cole na tela de login do site

⚠️ Use sempre um **fine-grained token** limitado só ao repositório de dados — nunca o token clássico com acesso a "todos os repositórios".

## O que já funciona de ponta a ponta

- Login com token, validado contra o repositório configurado.
- Lista de personagens da sua conta (lidos diretamente do repositório).
- Criar personagem novo → já salva no GitHub na hora.
- Abrir personagem existente → carrega os dados reais do repositório.
- Editar qualquer campo → salva automaticamente (indicador "Salvando..." / "Salvo ✓" no topo da ficha).
- Perícias, itens e ataques com rolagem de dados funcionando.
- Botão "Subir Nível" (+10 HP, +20 MP).
- Classe: criar campos livres ou pular a etapa.
- **Campanhas**: criar campanha (você vira o mestre automaticamente), listar campanhas em que você é membro (mestre ou jogador).
- **Vincular/desvincular personagem**: no painel da campanha, o mestre vincula um personagem informando o username do dono + o ID do personagem. O personagem continua existindo na conta do dono independentemente do vínculo — desvincular só remove a referência, nunca apaga a ficha.

## Como o mestre descobre o "ID do personagem" de um jogador

Hoje o ID não aparece em lugar nenhum da tela — é só o nome do arquivo. Enquanto isso não vira uma funcionalidade própria, combine com o grupo: o jogador pode abrir o DevTools do navegador (F12 → aba Network, clicar em qualquer personagem) e ver o `path` do arquivo, ou você mesmo, como dono do repositório, pode olhar a pasta `users/{usuario}/characters/` diretamente no GitHub.

## Limitações conhecidas (por design, nesta versão)

- **Vínculo não muda permissão de escrita de verdade.** Qualquer pessoa com o token configurado (todo mundo que usa este site) já tem acesso de escrita ao repositório inteiro — o "só mestre e dono editam" discutido anteriormente exigiria branch protection + CODEOWNERS + Pull Requests + uma Action de aprovação automática, o que não está implementado aqui. Nesta versão, isso é uma convenção de uso (o painel só mostra os controles de vincular/desvincular pro mestre), não uma trava técnica.
- **Sem tratamento de conflito visível na tela** — se você editar o mesmo personagem em duas abas/dispositivos ao mesmo tempo, o segundo salvamento pode falhar (o app tenta recarregar o `sha` mais recente automaticamente, mas não te avisa com um botão de "recarregar" ainda).
- **Listar campanhas é lento com muitas campanhas** — o app lê o `campaign.json` e `members.json` de cada campanha existente no repositório pra descobrir se você é membro. Com poucas campanhas (uso normal de um grupo) isso é instantâneo; com centenas, ficaria perceptível.
- **Botão "← voltar" na ficha sempre volta pra "Meus Personagens"**, mesmo se você abriu a ficha a partir de um painel de campanha (ainda não existe abertura de ficha a partir da campanha).
- **Rate limit da API do GitHub**: 5.000 requisições por hora por token. Uso normal (uma pessoa editando uma ficha) fica bem longe disso.
- Token fica em `localStorage`, sem criptografia — aceitável para uso pessoal/grupo de confiança, mas não cole um token com escopo maior do que o necessário.
