# GitHub Pages Deploy Guide for Antigravity Projects

Tento dokument slúži ako **referenčný checklist a návod**, aby aplikácia vytvorená alebo upravovaná v **Antigravity** fungovala **správne po deployi na GitHub Pages**.

Cieľ: overiť, že aplikácia je **100 % statická, portable a bez závislosti na serveri**.

---

## 1. Základný mentálny model

- Antigravity = **dev / preview prostredie** (odpúšťa chyby)
- GitHub Pages = **čistý statický hosting** (nič neodpustí)

Ak aplikácia funguje na GitHub Pages:

- bude fungovať na S3, Cloudflare Pages, Netlify, CDN
- architektúra je správna

---

## 2. Povolené a zakázané veci

### ✅ Povolené

- SPA (React / Vue / Vanilla)
- Client-side routing
- Static assets (JS, CSS, images)
- External APIs (fetch na verejné API)

### ❌ Zakázané (pre GitHub Pages test)

- Server-side rendering (SSR)
- API routes
- Middleware / rewrites
- Server actions
- Environment variables, ktoré nie sú build-time

---

## 3. Routing (kritická časť)

GitHub Pages **nepodporuje history-based routing**.

### Odporúčané riešenie (najspoľahlivejšie)

Použiť **HashRouter**:

```
/#/about
/#/dashboard
```

#### React Router príklad

```js
import { HashRouter } from "react-router-dom";

<HashRouter>
  <App />
</HashRouter>;
```

Výhody:

- funguje bez server fallbacku
- refresh nikdy nespôsobí 404

---

## 4. Base path / homepage (povinné)

Ak deployuješ do:

```
https://username.github.io/REPO_NAME/
```

musíš nastaviť base path.

### Vite

```js
export default {
  base: "/REPO_NAME/",
};
```

### CRA (React)

```json
"homepage": "https://username.github.io/REPO_NAME"
```

Bez tohto:

- JS a CSS sa nenačítajú
- aplikácia zlyhá

---

## 5. Build output (čo MUSÍ existovať)

Po build-e musíš mať:

```
dist/
  index.html
  assets/
    *.js
    *.css
```

Žiadne:

- server configy
- rewrite rules
- .env runtime závislosti

---

## 6. 404 fallback (voliteľné, ale odporúčané)

Ak **nepoužívaš HashRouter**, musíš pridať `404.html`.

### 404.html

```html
<script>
  const path = window.location.pathname;
  window.location.replace("/#" + path);
</script>
```

GitHub Pages:

- pri neexistujúcej route načíta 404.html
- presmeruje späť do SPA

---

## 7. Asset paths (častý problém)

Všetky assets musia byť:

- relatívne
- alebo rešpektovať base path

❌ Zlé:

```
/img/logo.png
```

✅ Správne:

```
./img/logo.png
```

---

## 8. Deploy postup (odporúčaný)

1. `npm run build`
2. Skontroluj `dist/` lokálne
3. Pushni `dist/` do `gh-pages` branch alebo `/docs`
4. Nastav GitHub Pages source
5. Otvor URL
6. Otestuj:
   - refresh
   - deep link
   - hard reload

---

## 9. Test checklist (skúška úspešná, ak platí)

- [ ] App sa načíta
- [ ] CSS a JS fungujú
- [ ] Refresh nespôsobí 404
- [ ] Deep link funguje
- [ ] Neexistuje server dependency

Ak všetko prejde → **kód je production-ready**.

---

## 10. Odporúčaný Antigravity prompt

```
This project must be fully compatible with GitHub Pages static hosting.

Please:
- Use HashRouter or add a proper SPA fallback
- Configure correct base path for /REPO_NAME/
- Ensure all assets work on GitHub Pages
- Avoid any server-side features
- Explain all changes made
```

---

## 11. Záver

GitHub Pages používaj ako:

> "acid test" architektúry

Ak to funguje tu, funguje to **všade**.

---

Autor: Kali
Účel: real-world deploy verification
