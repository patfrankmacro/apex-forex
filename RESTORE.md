# 🔄 RESTAURATION APEX-FOREX

## En cas de perte totale

### Option 1 — Depuis GitHub
git clone https://github.com/patfrankmacro/apex-forex.git
cd apex-forex
git checkout v1.0-stable
npm install
npm run dev

### Option 2 — Depuis l'archive ZIP
tar -xzf apex-forex-backup-YYYYMMDD.tar.gz
cd apex-forex
npm install

## Déploiement Vercel
npx vercel --prod

## Tags stables
- v1.0-stable : Version complete (ANALYSE + MACRO+COT + Nino + retail)

## URLs
- App : https://apex-forex.vercel.app
- GitHub : https://github.com/patfrankmacro/apex-forex

## Refresh auto
- CFTC : vendredi 20-23h UTC
- Myfxbook : toutes les 30 min
- Macro : Firebase temps reel
