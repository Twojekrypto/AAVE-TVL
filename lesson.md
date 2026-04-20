# AAVE TVL / Supply Dashboard - lessons

## Co zapamietac o tej stronie

- Repo: `https://github.com/Twojekrypto/AAVE-TVL`
- Live: `https://twojekrypto.github.io/AAVE-TVL/`
- Projekt jest statyczny: `index.html`, `styles.css`, `script.js`
- Dashboard ma byc wizualnie zblizony do sekcji `TVL` / `Supply Over Time` z `vedolo-dashboard`

## Jak sa liczone dane

### Aave

- `current supply` bierze sie z oficjalnego Aave API:
  - `https://api.v3.aave.com/graphql`
- Uzywana logika:
  - `Supply = totalMarketSize`
  - `Available Liquidity = totalAvailableLiquidity`
  - `Borrowed = Supply - Available Liquidity`
- `Supply by Chain` tez liczy sie z oficjalnego Aave API
- Historia Aave na wykresie `Supply Over Time` jest na razie backfillem z legacy serii:
  - `https://api.llama.fi/protocol/aave`
  - i jest normalizowana do oficjalnego currenta z Aave API

### Dolomite

- Current Dolomite bierze sie z lepszego zrodla projektowego:
  - `https://twojekrypto.github.io/vedolo-dashboard/dolomite_tvl.json`
- Historia Dolomite:
  - `https://twojekrypto.github.io/vedolo-dashboard/defillama_data.json`
- Historia jest dopasowywana do official current, zeby wykres byl spojny

## Ważne zasady

- Dla Aave nie wracac do prostego `TVL only`, jesli celem jest `Supply`
- Dla Aave current ma byc traktowany jako bardziej wiarygodny z oficjalnego API niz z DefiLlama
- Dla Dolomite nie polegac tylko na DefiLlama, bo user ma lepsze dane z wlasnej strony
- Jesli zmieniamy metodologie, trzeba jasno opisac to w UI, nie tylko w kodzie

## Pliki pomocnicze / fallbacki

- `aave_data.json` - legacy history snapshot
- `aave_current.json` - official current snapshot dla Aave
- `dolomite_data.json` - Dolomite history snapshot
- `dolomite_current.json` - Dolomite current snapshot

## Co warto jeszcze dodac

1. Prawdziwe oficjalne `Aave supply history`
   - najlepiej zapis dziennych snapshotow z oficjalnego Aave API do lokalnego pliku JSON
   - wtedy usuniemy dependence na legacy history

2. GitHub Action do automatycznego odswiezania snapshotow
   - np. raz dziennie aktualizowac:
   - `aave_current.json`
   - `aave_data.json` albo nowy oficjalny history file
   - `dolomite_current.json`

3. Toggle porownania:
   - `absolute`
   - `normalized to 100`
   - to da lepsze porownanie tempa wzrostu Aave vs Dolomite

4. Filtry chainow dla Aave
   - pokazanie tylko wybranych chainow
   - opcja `Core only` vs `All markets`

5. Lepszy opis zakresu historii
   - np. adnotacja:
   - `official current + legacy normalized history`

6. Export / share
   - PNG chart
   - copy link do aktualnego range

## Najblizszy sensowny krok

Najlepszy kolejny upgrade:

- zbudowac wlasny dzienny `aave_supply_history.json` z oficjalnego Aave API
- i potem przelaczyc `Supply Over Time` z legacy backfill na w pelni oficjalna historie
