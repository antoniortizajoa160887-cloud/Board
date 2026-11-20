# Lucky Lagoon

An original game hall for Android, for personal, non-commercial use. Ollie the otter runs the place.
Everything is played with **play chips**: they have no money value, can't be bought and can't be cashed out.

## The hall

- **Casino**
  - **Slots**: Lagoon Slots, 5 reels and 9 lines, wild otter, and a progressive jackpot (five crowns on a line) that grows with every spin.
  - **Table games**: Blackjack 21 (3 to 2, dealer stands on 17, double, split) and single-zero Roulette. Baccarat and Craps are coming.
  - **Poker**: Video Poker (jacks or better, hold and draw). Hold'em is coming.
  - **Bingo & Keno**: Bingo with up to 4 cards (line, four corners, two lines, full card). Keno is coming.
- **Arcade**: Zip, a speedy otter platformer (coming).
- **Board & Cards**: Harbor Tycoon (property trading) and Crazy Colors (a color-matching card game with house rules) are coming.
- **Stats**: chips, biggest win, jackpot and a per-game record.

Shared across the hall: one chip balance, a daily bonus of 1,000 chips and a free refill when you drop under 100 (once an hour).

The game returns are set so the house keeps a small edge, like a real casino: slots pay back about 95%, bingo about 97%, and the card and table games follow their usual rules. Tests check these numbers.

## Develop

```bash
npm install
npm run dev        # play in the browser
npm test           # rules and payout tests
npm run build      # production web build in dist/
```

Code layout: `src/core/` holds the rules with no UI (cards, blackjack, poker, slots, roulette, bingo, wallet); `src/games/` the play screens; `src/ui/` the hall, top bar, dialogs and all art (drawn in code as SVG in the neon art-deco style); `src/audio.ts` the music and sound, made with Web Audio.

## Android

The Android app is the same web game wrapped with [Capacitor](https://capacitorjs.com/), set up like the Games and Mahjong projects.

- **Download:** every push to `main` or the working branch builds an APK in GitHub Actions and publishes it on the **apk-latest** release:
  `https://github.com/antoniortizajoa160887-cloud/Board/releases/download/apk-latest/lucky-lagoon.apk`.
  Allow installs from unknown sources the first time.
- **Updates:** the app checks that release when it starts, every 10 minutes and when it comes back to the front. When a newer build exists, a bar offers **Download**; Android then asks you to tap Install. Settings also has "Check for updates".
- The APK is signed with a fixed debug key committed in `android/app/luckylagoon-debug.keystore`, so each new APK installs over the old one and keeps your chips.
- **Build it yourself** (needs Android Studio): `npm run android:sync`, then `npm run android:open` and press Run.
- Launcher icons and splash screens are drawn from the game's art: `NODE_PATH=$(npm root -g) npm run icons` (needs Playwright).

## Credits

Fonts: Marcellus (Astigmatic) and Nunito (Vernon Adams, Cyreal, Jacques Le Bailly), SIL Open Font License. All characters, art, names and music are original to this project.
