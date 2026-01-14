# Databázový Setup - Inštrukcie

## Krok 1: Vytvorenie databázovej schémy

1. **Otvorte súbor**: `supabase/migrations/20251216113303_remix_migration_from_pg_dump.sql`
2. **Skopírujte CELÝ obsah** tohto súboru (všetkých 1115 riadkov)
3. **Prejdite do Supabase SQL Editor**
4. **Vložte** celý SQL kód do editora
5. **Kliknite na "Run"** (alebo Ctrl+Enter)
   - Tento príkaz vytvorí všetky tabuľky, typy, funkcie a polícy
   - Trvá to pár sekúnd

## Krok 2: Vytvorenie admin účtu

Po úspešnom spustení migrácie:

1. **Otvorte súbor**: `setup_admin.sql`  
2. **Skopírujte obsah** do SQL Editora
3. **Kliknite na "Run"**
4. **Overenie**: V results by ste mali vidieť riadok s:
   - Email: jakubkalina05@gmail.com
   - Full Name: Jakub Kalina
   - Role: admin

## Krok 3: Test prihlásenia

1. **Prejdite na aplikáciu**: http://localhost:8080/auth
2. **Prihláste sa** s:
   - Email: jakubkalina05@gmail.com
   - Heslo: EDITHironman1#
3. **Po prihlásení** by ste mali vidieť dashboard s admin oprávneniami

---

**Poznámka**: Ak dostanete nejaké chyby pri spustení migrácie, dajte mi vedieť - možno bude potrebné vyčistiť existujúce objekty alebo spustiť migráciu po častiach.
