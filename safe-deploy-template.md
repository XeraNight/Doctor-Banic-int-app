# Antigravity Deployment Template (GitHub → CI → Hosting)

Tento dokument je **kompletný návod + checklist + template**, aby každý projekt z Antigravity:

- bol **bezpečný**
- bol **deploy-ready**
- fungoval na **GitHub Pages (acid test)**
- dal sa **jedným klikom napojiť na Vercel / Netlify / webhosting**

Cieľový princíp:

> **Ak to prejde GitHub Actions a GitHub Pages, pôjde to všade.**

---

## 1. Architektúra, ktorú vždy dodržuj

```
Antigravity (dev)
   ↓
GitHub repo (source code)
   ↓
GitHub Actions (CI build + test)
   ↓
GitHub Pages (statický test)
   ↓
Vercel / Netlify / Hosting (produkcia)
```

GitHub Pages NIE JE finálny hosting – je to **test správnosti architektúry**.

---

## 2. Template štruktúra repozitára

Toto je minimálny, ale správny základ:

```
my-project/
├─ src/
├─ public/
├─ index.html
├─ package.json
├─ vite.config.js
├─ .gitignore
├─ .github/
│  └─ workflows/
│     └─ deploy.yml
├─ github-deploy.md
└─ README.md
```

---

## 3. package.json – povinné skripty

```
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  }
}
```

❌ žiadne server skripty
❌ žiadne runtime buildy

---

## 4. Routing pravidlá (kritické)

### Povinné pre statický deploy

Použi **HashRouter** (React):

```
/#/about
/#/dashboard
```

Dôvod:

- GitHub Pages nemá fallback routing
- HashRouter je 100 % spoľahlivý

Alternatíva:

- SPA fallback cez `404.html`

---

## 5. Asset & path pravidlá

### Nikdy nepoužívaj:

```
/img/logo.png
```

### Vždy používaj:

```
./img/logo.png
```

Alebo asset importy cez bundler.

---

## 6. Vite config (base path)

Ak deployuješ na GitHub Pages:

```
export default {
  base: '/REPO_NAME/'
}
```

Bez tohto:

- JS / CSS sa nenačítajú

---

## 7. GitHub Actions – CI + Pages deploy

Tento workflow robí:

- build
- deploy na GitHub Pages
- automatický redeploy

```
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 18

      - run: npm install
      - run: npm run build

      - uses: peaceiris/actions-gh-pages@v4
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist
```

➡️ Toto je tvoj **automatický deploy motor**.

---

## 8. GitHub Pages nastavenie

Repo → Settings → Pages

- Source: **GitHub Actions**
- Žiadny branch deploy

---

## 9. Bezpečnostné pravidlá (minimálny štandard)

### Nikdy necommituj:

- `.env`
- API keys
- secrets

### Povolené:

- public API URLs
- build-time config

CI ti má build rozbiť, ak niečo chýba.

---

## 10. Antigravity – MASTER PROMPT (POUŽÍVAJ VŽDY)

```
This project must be deployment-ready.

Requirements:
- Must work on GitHub Pages (static hosting)
- No server-side features
- Hash-based routing or SPA fallback
- Correct base path handling
- All assets must load correctly
- Code must pass GitHub Actions CI build

Assume this project will later be deployed via repository URL to:
- Vercel
- Netlify
- standard web hosting

Explain all architectural decisions.
```

---

## 11. Ako ideš do produkcie (keď test prejde)

### Vercel

- Import GitHub repo
- Zero config

### Netlify

- Import repo
- Build command: `npm run build`
- Publish dir: `dist`

### Webhosting

- Upload `dist/` folder

Ak to prešlo GitHub Pages → **žiadny problém**.

---

## 12. Security hardening (POVINNÁ ČASŤ)

Táto sekcia definuje **minimálny, ale reálny security štandard** pre statické weby a SPA, aby:

- bol kód bezpečný už v repozitári
- si vedel **odstrániť zbytočné súbory z Antigravity projektu**
- deploy na GitHub / Vercel / Netlify bol bez rizika

---

### 12.1 .gitignore (kritické)

Používaj **striktný `.gitignore`**, aby si do GitHubu nikdy neposlal buildy, lokálne súbory ani interné dokumenty.

#### Odporúčaný `.gitignore` pre Antigravity + Vite/React

```
# Dependencies
node_modules/

# Build outputs
dist/
build/
.out/

# Environment variables
.env
.env.*

# Logs
npm-debug.log*
yarn-debug.log*
pnpm-debug.log*

# OS / Editor
.DS_Store
.idea/
.vscode/

# Temporary / cache
.cache/
.tmp/

# Documentation (neposielaj interné md súbory)
*_private.md
*_internal.md
notes.md

# Antigravity / local tooling
.antigravity/
local-preview/
```

➡️ **Pravidlo:** GitHub má obsahovať **len zdrojový kód + CI config**.

---

### 12.2 Environment variables – pravidlá

#### ❌ Nikdy do kódu:

- API keys
- secrets
- tokens

#### ✅ Povolené:

- public API URLs
- build-time config

V Antigravity:

- `.env` používaš LEN lokálne
- po deployi neexistuje

➡️ Ak app bez `.env` nefunguje → architektúra je zlá

---

### 12.3 Zmazateľné / nepotrebné súbory v Antigravity

Po nastavení tohto template **môžeš bezpečne vymazať**:

- lokálne deploy skripty
- custom preview servery
- staré build foldre
- testovacie `.env.example`, ak nie sú potrebné

Nechaj LEN:

- `src/`
- `public/`
- `package.json`
- `vite.config.js`
- `.github/workflows/`

---

### 12.4 Content Security Policy (CSP)

Do `index.html` pridaj základnú CSP:

```html
<meta
  http-equiv="Content-Security-Policy"
  content="default-src 'self';
           script-src 'self';
           style-src 'self' 'unsafe-inline';
           img-src 'self' data:;
           connect-src 'self' https:;"
/>
```

➡️ zabráni XSS a injekciám

---

### 12.5 Dependency bezpečnosť

Pred každým deployom:

```
npm audit --production
```

V CI (voliteľné, odporúčané):

```
- run: npm audit --audit-level=high
```

➡️ build zlyhá, ak máš vážne zraniteľnosti

---

### 12.6 GitHub repo ochrana

Zapni v repozitári:

- branch protection (main)
- required status checks (CI)
- dependabot alerts

➡️ nič sa nenasadí bez úspešného buildu

---

### 12.7 Hosting-level security (keď pôjdeš do produkcie)

Na Vercel / Netlify zapni:

- HTTPS only
- auto redirects HTTP → HTTPS
- basic security headers

GitHub Pages:

- HTTPS je automatické

---

### 12.8 Finálny security checklist

Pred každým verejným deployom:

- [ ] žiadne secrets v repozitári
- [ ] build ide bez `.env`
- [ ] CI prejde
- [ ] CSP aktívna
- [ ] assets len z povolených zdrojov

---

## 13. Mentálne pravidlo do budúcna

> Antigravity mi pomáha písať kód.
> GitHub Actions mi hovorí pravdu.
> Security nie je feature – je základ.

---

Autor: Kali
Účel: dlhodobý deployment-ready a secure štandard
