/* ============================================================
   GNASHBBL F.All Cup II — reference data (single source of truth)
   Edit values here; the public pages render from this file.
   Later this is replaced by reads from the Supabase `bb.*` schema.
   Source docs: "The Second GNASHBBL F.All Cup.docx",
                "GNASH ALL-STARS F All Cupp II.docx",
                "new mercs FAC2.pdf"
   ============================================================ */
window.FALLCUP = {

  meta: {
    name: "GNASHBBL F.All Cup II",
    established: "Aug 2026",
    ruleset: "Warhammer Blood Bowl — Official Rulebook, Season Edition (2025)",
    faqCutoff: "FAQ / editor's notes to May 2026, plus NAF-recommended FAQ & Teams of Legend",
  },

  // ---- key dates ----
  keyDates: [
    { d: "Sun 30 Aug 2026", l: "Round 1 random draw broadcast" },
    { d: "Oct–Nov 2026",    l: "Round Robin stage" },
    { d: "Two weeks prior",  l: "Quarter finals" },
    { d: "Two weeks prior",  l: "Semi finals" },
    { d: "1st week Dec 2026", l: "The Final" },
  ],

  // ---- team building constants ----
  build: {
    budget: 1150000,
    fansStart: 1,          // 1 free to start, not in CTV
    fansMax: 4,            // CREATION cap: start 1 + buy up to 3 more (5k each), pre-Game-1
    fansLeagueMax: 7,      // absolute cap once in the league (grows via play, not purchase)
    fansCostPerStep: 5000,   // BB2025: 5,000 gp per Dedicated Fan point
    sppPerPlayerCap: 6,
    secondarySkillCost: 12, // one player only; uses 10, forfeits 2
    chosenPrimaryCost: 6,   // 6 SPP buys one chosen Primary skill
    apothecaryCost: 50000,
    staffCost: 10000,       // assistant coach / cheerleader, each
    skillValue: { primary: 20000, secondary: 40000 }, // CTV value increments — verify vs BB2025
    tierSpp: { 1: 30, 2: 36, 3: 42, 4: 48 },
    reDraftedAllowed: false,
  },

  // ---- inducement matrix (from rules table) ----
  // NOTE: source table lists Star / Mega / GNASH Merc / Rulebook Merc.
  // Whether GNASH Stars share the "stars" allowance needs Pete's confirm.
  inducements: [
    { tiers: "Tiers 1, 2 & 3", stars: 1, twoStars: false, megaStars: 0, gnashMercs: 2, rulebookMercs: true },
    { tiers: "Tier 4",         stars: 2, twoStars: true,  megaStars: 0, gnashMercs: 2, rulebookMercs: true },
  ],

  // ---- banned mega-stars ----
  bannedStars: [
    "Grak and Crumbleberry",
    "H'thark the Unstoppable",
    "Skrog Snowpelt",
    "Zolcath the Zoat",
  ],

  // ---- GNASH Stars (custom / homebrew stars) ----
  // stats: MA / ST / AG / PA / AV ; cost = gp to induce
  // eligibleFor = exact catalogue league / special-rule tokens (used for matching);
  // playsFor is the human-readable version shown on the page.
  gnashStars: [
    { name: "Wind Breaker", ma:6, st:3, ag:"2+", pa:"4+", av:"9+", cost:160000,
      type:"Beastman, Runner",
      skills:"Block, Horns, Mighty Blow, Plague Ridden, Regeneration, Steady Footing, Thick Skull",
      playsFor:"Any team with the Favoured of… special rule",
      eligibleFor:["Favoured of..."] },
    { name: "Beatrix Kiddo", ma:7, st:3, ag:"2+", pa:"5+", av:"—", cost:180000,
      type:"Elf, Special",
      skills:"Block, Dodge, Frenzy, Jump Up, Loner (4+), Side Step",
      playsFor:"Any team in the Elven Kingdoms League or Halfling Thimble Cup",
      eligibleFor:["Elven Kingdoms League","Halfling Thimble Cup"],
      note:"AV missing in source doc — confirm value" },
    { name: "Henrich Elfhelm", ma:7, st:3, ag:"2+", pa:"5+", av:"9+", cost:250000,
      type:"Blitzer, Human",
      skills:"Block, Dodge, Loner (4+), Strip Ball",
      playsFor:"Any team in the Old World Classic or Halfling Thimble Cup",
      eligibleFor:["Old World Classic","Halfling Thimble Cup"] },
    { name: "Shyloh the Shanker", ma:7, st:3, ag:"2+", pa:"5+", av:"8+", cost:175000,
      type:"Elf, Special",
      skills:"Block, Dodge, Hit & Run, Loner (4+), Shadowing, Stab, Strip Ball",
      playsFor:"Any team in the Elven Kingdoms League or Halfling Thimble Cup",
      eligibleFor:["Elven Kingdoms League","Halfling Thimble Cup"] },
    { name: "Attenborough", ma:6, st:4, ag:"5+", pa:"6+", av:"10+", cost:185000,
      type:"Blocker, Lizardman",
      skills:"Block, Kick, Loner (4+), Mighty Blow +1",
      playsFor:"Any team in the Lustrian Superleague or Halfling Thimble Cup",
      eligibleFor:["Lustrian Superleague","Halfling Thimble Cup"] },
    { name: "Donald Trunk", ma:7, st:3, ag:"2+", pa:"4+", av:"8+", cost:160000,
      type:"Lineman, Elf",
      skills:"Block, Guard, Loner (4+)",
      playsFor:"Any team in the Elven Kingdoms League or Halfling Thimble Cup",
      eligibleFor:["Elven Kingdoms League","Halfling Thimble Cup"] },
    { name: "Light Brown", ma:2, st:6, ag:"5+", pa:"5+", av:"11+", cost:185000,
      type:"Big Guy, Treeman",
      skills:"Guard, Grab, Mighty Blow +1, Loner (4+), Stand Firm, Strong Arm, Take Root, Thick Skull, Throw Team-mate, Timmm-ber!",
      playsFor:"Any team in the Elven Kingdoms League, Old World Classic or Halfling Thimble Cup",
      eligibleFor:["Elven Kingdoms League","Old World Classic","Halfling Thimble Cup"] },
    { name: "Razerback", ma:8, st:3, ag:"3+", pa:"4+", av:"9+", cost:180000,
      type:"Blitzer, Undead, Werewolf",
      skills:"Block, Claws, Frenzy, Juggernaut, Loner (4+), Regeneration, Tackle",
      playsFor:"Any team in the Sylvanian Spotlight or with Masters of Undeath",
      eligibleFor:["Sylvanian Spotlight","Masters of Undeath"] },
  ],

  // ---- GNASH Mercs (the GNASHBBL Seven) ----
  gnashMercs: [
    { name: "Evenbit Hypegrot", ma:5, st:1, ag:"3+", pa:"4+", av:"6+", cost:35000,
      type:"Lineman, Snotling",
      skills:"Dodge, Loner (4+), Lethal Flight, Right Stuff, Really Stupid, Side Step, Stunty, Titchy" },
    { name: "Kryll Anklebreaker", ma:6, st:2, ag:"3+", pa:"4+", av:"8+", cost:60000,
      type:"Goblin, Lineman",
      skills:"Dodge, Lone Fouler, Loner (4+), Stunty" },
    { name: "Sir Chuck Launchpad", ma:6, st:3, ag:"3+", pa:"3+", av:"9+", cost:105000,
      type:"Human, Thrower",
      skills:"Accurate, Kick, Loner (4+), Pass" },
    { name: "Salvera Speedball", ma:7, st:2, ag:"2+", pa:"4+", av:"8+", cost:110000,
      type:"Catcher, Elf",
      skills:"Catch, Dodge, Loner (4+), Sprint" },
    { name: "Splinter Sackchop", ma:7, st:3, ag:"3+", pa:"4+", av:"8+", cost:110000,
      type:"Lineman, Skaven",
      skills:"Frenzy, Loner (4+), Tackle, Wrestle" },
    { name: "Badruk Edsplitter", ma:4, st:4, ag:"4+", pa:"5+", av:"10+", cost:110000,
      type:"Blocker, Orc",
      skills:"Brawler, Grab, Loner (4+), Stand Firm" },
    { name: "Gnarley Babkak", ma:4, st:5, ag:"5+", pa:"5+", av:"10+", cost:140000,
      type:"Big Guy, Troll",
      skills:"Always Hungry, Loner (4+), Guard, Mighty Blow, Projectile Vomit, Really Stupid, Regeneration, Throw Team-mate" },
  ],

  // ---- Kick-Off event table (2d6) — BB2025 ----
  // Verify full wording against the rulebook Kick-Off Table.
  kickoff: [
    { roll:2,  name:"Get the Ref",        desc:"Each team receives one free Bribe for the rest of the game." },
    { roll:3,  name:"Time-out",           desc:"The kicking team's turn marker moves back one if ahead on turns, otherwise forward one." },
    { roll:4,  name:"Solid Defence",      desc:"D3+3 of the kicking team's players may be repositioned (within the setup rules)." },
    { roll:5,  name:"High Kick",          desc:"One receiving player may move into the square the ball will land in." },
    { roll:6,  name:"Cheering Fans",      desc:"Roll for Prayers to Nuffle; the side with more Cheerleaders wins the roll-off." },
    { roll:7,  name:"Brilliant Coaching", desc:"Roll-off adding Assistant Coaches; the winner gets one extra team re-roll this drive." },
    { roll:8,  name:"Changing Weather",   desc:"Make a new Weather roll; if it's now Perfect Conditions the ball scatters." },
    { roll:9,  name:"Quick Snap",         desc:"The receiving team may move D3+3 open players one square each." },
    { roll:10, name:"Blitz",              desc:"The kicking team gets a free bonus 'Blitz' turn before the drive begins." },
    { roll:11, name:"Officious Ref",      desc:"Roll-off; the loser has a random player sent off (or Stunned) by the ref." },
    { roll:12, name:"Pitch Invasion",     desc:"Each coach's fans Stun D3 random players from the opposing team." },
  ],

  // ---- BB2025 (Season 3) skill categories — for the builder's skill picker ----
  // Access codes on positionals map here: G General, A Agility, S Strength,
  // P Passing, D Devious (new in 2025), M Mutation. (Extraordinary/Traits are
  // not chooseable skill-ups, so they're not listed.)
  skillCategories: {
    G: ["Block","Dauntless","Fend","Frenzy","Kick","Pro","Steady Footing","Strip Ball","Sure Hands","Tackle","Taunt","Wrestle"],
    A: ["Catch","Defensive","Diving Catch","Diving Tackle","Dodge","Hit and Run","Jump Up","Leap","Safe Pair of Hands","Sidestep","Sprint","Sure Feet"],
    S: ["Arm Bar","Brawler","Break Tackle","Bullseye","Grab","Guard","Juggernaut","Mighty Blow","Multiple Block","Stand Firm","Strong Arm","Thick Skull"],
    P: ["Accurate","Cannoneer","Cloud Burster","Dump-off","Give and Go","Hail Mary Pass","Leader","Nerves of Steel","On the Ball","Pass","Punt","Safe Pass"],
    D: ["Dirty Player","Eye Gouge","Fumblerooski","Lethal Flight","Lone Fouler","Pile Driver","Put the Boot In","Quick Foul","Saboteur","Shadowing","Sneaky Git","Violent Innovator"],
    M: ["Big Hand","Claws","Disturbing Presence","Extra Arms","Foul Appearance","Horns","Iron Hard Skin","Monstrous Mouth","Prehensile Tail","Tentacles","Two Heads","Very Long Legs"],
  },

  // ---- Generic inducements (BB2025). Costs per rulebook; some vary by team. ----
  genericInducements: [
    { name: "Part-time Assistant Coach", cost: 10000, note: "0-3, each" },
    { name: "Temp Agency Cheerleader", cost: 10000, note: "0-3, each" },
    { name: "Weather Mage", cost: 30000, note: "0-1" },
    { name: "Bloodweiser Keg", cost: 50000, note: "0-2, each" },
    { name: "Bribe", cost: 100000, note: "0-3 (0-6 & 50k for Bribery and Corruption)" },
    { name: "Wandering Apothecary", cost: 100000, note: "0-2, each (not for teams with no apothecary)" },
    { name: "Mortuary Assistant", cost: 100000, note: "0-1" },
    { name: "Plague Doctor", cost: 100000, note: "0-1" },
    { name: "Hireling Sports-Wizard", cost: 150000, note: "0-1" },
    { name: "Halfling Master Chef", cost: 300000, note: "0-1 (100k for Halfling teams)" },
    { name: "Mercenary player", cost: null, note: "player's base cost + 30k (+50k for a skill)" },
    { name: "Special Play cards", cost: null, note: "cost varies by deck" },
  ],

  // ---- BB2025 rulebook Star Players ----
  // plays = exact catalogue league / special-rule tokens the star can be hired by;
  // any:true = any team; anyExcept = any team not in those leagues. Mega-stars banned.
  // NB: "Favoured of..." is stored truncated in the catalogue, so Nurgle/Khorne/Hashut
  //     stars all match any Chaos-god team (can't distinguish until the source is fixed).
  starPlayers: [
    { name: "Akhorne the Squirrel", cost: 80000, any: true },
    { name: "Anqi Panqi", cost: 190000, plays: ["Lustrian Superleague"] },
    { name: "Barik Farblast", cost: 80000, plays: ["Old World Classic","Worlds Edge Superleague"] },
    { name: "Bilerot Vomitflesh", cost: 180000, plays: ["Favoured of..."] },
    { name: "Boa Kon'ssstriktr", cost: 180000, plays: ["Lustrian Superleague"] },
    { name: "Bomber Dribblesnot", cost: 80000, plays: ["Badlands Brawl","Underworld Challenge"] },
    { name: "Captain Karina von Riesz", cost: 230000, plays: ["Sylvanian Spotlight"] },
    { name: "Cindy Piewhistle", cost: 100000, plays: ["Halfling Thimble Cup","Old World Classic"] },
    { name: "Count Luthor Von Drakenborg", cost: 300000, plays: ["Sylvanian Spotlight"] },
    { name: "Deeproot Strongbranch", cost: 280000, plays: ["Woodland League"] },
    { name: "Dribl and Drull", cost: 230000, plays: ["Lustrian Superleague"] },
    { name: "Eldril Sidewinder", cost: 220000, plays: ["Elven Kingdoms League"] },
    { name: "Estelle la Veneaux", cost: 190000, plays: ["Lustrian Superleague"] },
    { name: "Fungus the Loon", cost: 80000, plays: ["Badlands Brawl","Underworld Challenge"] },
    { name: "Glart Smashrip", cost: 175000, plays: ["Underworld Challenge"] },
    { name: "Gloriel Summerbloom", cost: 150000, plays: ["Elven Kingdoms League"] },
    { name: "Glotl Stop", cost: 260000, plays: ["Lustrian Superleague"] },
    { name: "Grak and Crumbleberry", cost: 250000, banned: true, any: true },
    { name: "Grashnak Backhoof", cost: 240000, plays: ["Chaos Clash"] },
    { name: "Gretchen Wätcher", cost: 180000, plays: ["Sylvanian Spotlight"] },
    { name: "Griff Oberwald", cost: 300000, plays: ["Old World Classic"] },
    { name: "Grim Ironjaw", cost: 200000, plays: ["Worlds Edge Superleague"] },
    { name: "Grombrindal", cost: 170000, plays: ["Halfling Thimble Cup","Old World Classic","Worlds Edge Superleague"] },
    { name: "Guffle Pusmaw", cost: 150000, plays: ["Favoured of..."] },
    { name: "H'thark the Unstoppable", cost: 300000, banned: true, plays: ["Badlands Brawl","Favoured of..."] },
    { name: "Hakflem Skuttlespike", cost: 200000, plays: ["Underworld Challenge"] },
    { name: "Helmut Wulf", cost: 140000, plays: ["Old World Classic"] },
    { name: "Ivan 'The Animal' Deathshroud", cost: 210000, plays: ["Sylvanian Spotlight"] },
    { name: "Ivar Eriksson", cost: 215000, plays: ["Old World Classic"] },
    { name: "Jeremiah Kool", cost: 300000, plays: ["Elven Kingdoms League"] },
    { name: "Jordell Freshbreeze", cost: 280000, plays: ["Elven Kingdoms League","Woodland League"] },
    { name: "Josef Bugman", cost: 180000, plays: ["Old World Classic","Worlds Edge Superleague"] },
    { name: "Karla von Kill", cost: 210000, plays: ["Lustrian Superleague","Old World Classic"] },
    { name: "Kiroth Krakeneye", cost: 160000, plays: ["Elven Kingdoms League"] },
    { name: "Kreek Rustgouger", cost: 180000, plays: ["Underworld Challenge"] },
    { name: "Lord Borak the Despoiler", cost: 270000, plays: ["Chaos Clash"] },
    { name: "Maple Highgrove", cost: 210000, plays: ["Woodland League"] },
    { name: "Max Spleenripper", cost: 130000, plays: ["Favoured of..."] },
    { name: "Morg'n'Thorg", cost: 340000, anyExcept: ["Sylvanian Spotlight"] },
    { name: "Nobbla Blackwart", cost: 120000, plays: ["Badlands Brawl","Underworld Challenge"] },
    { name: "Puggy Baconbreath", cost: 120000, plays: ["Halfling Thimble Cup","Old World Classic"] },
    { name: "Rashnak Backstabber", cost: 130000, plays: ["Badlands Brawl"] },
    { name: "Ripper Bolgrot", cost: 250000, plays: ["Badlands Brawl","Underworld Challenge"] },
    { name: "Rodney Roachbait", cost: 70000, plays: ["Woodland League"] },
    { name: "Rowana Forestfoot", cost: 160000, plays: ["Woodland League"] },
    { name: "Roxanna Darknail", cost: 270000, plays: ["Elven Kingdoms League"] },
    { name: "Rumbelow Sheepskin", cost: 170000, plays: ["Halfling Thimble Cup"] },
    { name: "Scrappa Sorehead", cost: 120000, plays: ["Badlands Brawl","Underworld Challenge"] },
    { name: "Scyla Anfingrimm", cost: 200000, plays: ["Favoured of..."] },
    { name: "Skitter Stab-Stab", cost: 170000, plays: ["Underworld Challenge"] },
    { name: "Skrorg Snowpelt", cost: 240000, banned: true, plays: ["Old World Classic","Worlds Edge Superleague"] },
    { name: "Skrull Halfheight", cost: 150000, plays: ["Sylvanian Spotlight","Worlds Edge Superleague"] },
    { name: "Swiftvine Glimmershard", cost: 110000, plays: ["Woodland League"] },
    { name: "The Black Gobbo", cost: 210000, plays: ["Badlands Brawl","Underworld Challenge"] },
    { name: "The Mighty Zug", cost: 220000, plays: ["Lustrian Superleague","Old World Classic"] },
    { name: "The Swift Twins", cost: 300000, plays: ["Elven Kingdoms League"] },
    { name: "Thorsson Stoutmead", cost: 170000, plays: ["Old World Classic","Worlds Edge Superleague"] },
    { name: "Varag Ghoul-Chewer", cost: 260000, plays: ["Badlands Brawl"] },
    { name: "Wilhelm Chaney", cost: 220000, plays: ["Sylvanian Spotlight"] },
    { name: "Willow Rosebark", cost: 160000, plays: ["Woodland League"] },
    { name: "Withergrasp Doubledrool", cost: 170000, plays: ["Favoured of..."] },
    { name: "Zolcath the Zoat", cost: 220000, banned: true, plays: ["Elven Kingdoms League","Lustrian Superleague"] },
    { name: "Zzharg Madeye", cost: 130000, plays: ["Favoured of..."] },
  ],

};
