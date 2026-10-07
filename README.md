# IRMA — Integrated Referee Management App

React/Vite frontend met Supabase Auth en gegevens per vereniging.

## Functies

- Verenigingselectie, platformbeheer en personenbeheer.
- Wedstrijden toevoegen, wijzigen en verwijderen door coördinatoren.
- Eén of meer gekoppelde personen aanstellen als scheidsrechter; aanstellingen verwijderen.
- Persoonlijk overzicht met alleen eigen aanstellingen.
- Zoeken op team/locatie en filteren op komende, afgelopen of alle wedstrijden.
- Wedstrijdtijden worden ingevoerd en weergegeven in Europe/Amsterdam.

## Lokaal starten

Installeer dependencies met `npm ci`. Zet `VITE_SUPABASE_URL` en
`VITE_SUPABASE_PUBLISHABLE_KEY` (of `VITE_SUPABASE_ANON_KEY`) in `.env.local`.
Gebruik uitsluitend een publieke frontend-key. Start met `npm run dev`.

## Controle

- `npm run lint`
- `npm test`: interfaceflow, opslagfouten, persoonlijk overzicht en Nederlandse tijdconversie.
- `npm run build`
- `supabase/tests/matches_access.sql`: database- en rechtentests in een transactie
  die alle testgegevens terugdraait. Uitvoeren met beheerdersrechten in een testdatabase.

## Database

De wedstrijdmodule gebruikt de bestaande tabellen `matches`, `assignments`,
`memberships` en `profiles`. De migration in `supabase/migrations` voegt
verwijderpolicies, indexen en controles op verenigingconsistentie toe.
Deze migration is toegepast op het huidige IRMA-project. Niet opnieuw los uitvoeren
als hij al in de migrationgeschiedenis staat.

De database staat wijzigingen alleen toe aan coördinatoren van de betreffende
vereniging. Een aanstelling vereist lidmaatschap van dezelfde vereniging als de
wedstrijd. Verwijderen van een wedstrijd verwijdert de aanstellingen automatisch.
De frontend haalt de actieve verenigingsrol uit Supabase.

## Publicatie

Een push naar `main` start `.github/workflows/deploy.yml` voor GitHub Pages.
De workflow gebruikt repository secrets voor de Supabase-URL en anon-key.
