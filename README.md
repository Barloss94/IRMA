# IRMA — Integrated Referee Management Assistent

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

## Profiel, dashboard en accountherstel

- `Profiel`: eigen naam opslaan, inlogadres bekijken en wachtwoord wijzigen
  met controle van het huidige wachtwoord.
- `Dashboard`: exacte aantallen komende wedstrijden en eigen aanstellingen;
  coördinatoren zien ook wedstrijden zonder aanstelling en gekoppelde personen.
  De eerstvolgende vijf wedstrijden worden weergegeven met datum en locatie.
- `Wachtwoord vergeten?` staat bij het inloggen. De herstelmail opent
  `/reset-password`, waar een nieuw wachtwoord tweemaal wordt ingevoerd.
- Recovery-events krijgen voorrang boven de normale navigatie. Refreshen van
  de herstelpagina behoudt de herstelmodus; ongeldige of verlopen links tonen
  een mogelijkheid om een nieuwe herstelmail aan te vragen.
- `supabase/tests/profile_access.sql` controleert eigen profielwijzigingen en
  blokkeert het wijzigen van een andere gebruiker; de testgegevens worden teruggedraaid.

### Supabase URL-instellingen voor herstelmails

Controleer bij Authentication → URL Configuration:

- Site URL: `https://barloss94.github.io/IRMA/`
- Redirect URL: `https://barloss94.github.io/IRMA/reset-password`

De redirect moet op de allowlist staan. De codewijziging configureert deze
projectinstelling niet. Voor lokaal testen kan de exacte lokale resetroute
ook toegevoegd worden. Herstelmail-aanvragen gebruiken de actuele app-origin
plus de Vite-basismap. De afhandeling via `public/404.html` bewaart de route
én het auth-fragment bij een directe terugkeer naar GitHub Pages.

## Clubkleuren

De actieve verenigingsomgeving gebruikt de kleuren uit `src/clubkleuren.txt`.
Navigatie, knoppen, badges en accenten wisselen mee met de vereniging.
Voor onbekende verenigingen, het inloggen en platformbeheer geldt het standaard
IRMA-thema. Clubnamen worden zonder onderscheid in hoofdletters en met
normalisatie van spaties vergeleken. Statuskleuren voor fouten en waarschuwingen
blijven herkenbaar. Voor de zes bekende clubs worden contrastverhoudingen voor
knoppen, navigatie en links gecontroleerd door `tests/club-theme.test.js`.
