/* colour-schemes.js — the dice colour palettes offered under "Customise Dice",
   plus which palette pairs with each tray theme by default. Depends on
   nothing; TRAY_THEMES (tray-themes.js) and applyTrayTheme() read
   TRAY_DEFAULT_SCHEME and currentScheme from here. */

/* =========================================================================
   COLOUR SCHEMES
   Each scheme defines:
     body:        fill colour for the cream/primary die
     bodyDark:    fill colour for the dark/inverted die (advantage/disadvantage)
     numeral:     numeral colour on a cream/primary die
     numeralDark: numeral colour on the dark/inverted die
     stroke:      edge line colour on a cream/primary die
     strokeDark:  edge line colour on the dark/inverted die
   ========================================================================= */
const COLOUR_SCHEMES = {
  ivory: {
    // Ivory & Jet — pairs with green felt (#0e451c dark green)
    body:        '#f0e6cc',   // warm ivory — bright on dark green
    bodyDark:    '#1a1a1a',   // jet black — distinct from green, cream numeral reads
    numeral:     '#1a1a1a',   // jet on ivory
    numeralDark: '#f0e6cc',   // ivory on jet
    stroke:      '#1a1a1a73',
    strokeDark:  '#f0e6cc73',
  },
  scarlet: {
    // Scarlet & Gold — pairs with ivory marble (#ddd6c8 pale stone)
    body:        '#63001a',   // deep scarlet — dark on pale stone
    bodyDark:    '#d4a017',   // dark gold — different warm dark on pale stone
    numeral:     '#EAE86F',   // bright gold on scarlet
    numeralDark: '#63001a',   // pale cream on gold
    stroke:      '#EAE86F73',
    strokeDark:  '#63001a',
  },
  cobalt: {
    // Cobalt & Amber — pairs with parchment (#e0bf77 warm amber)
    body:        '#1a2e60',   // deep cobalt — dark on amber, cool contrast
    bodyDark:    '#e89b02',   // burnt sienna — dark on amber, warm contrast
    numeral:     '#e8d898',   // pale gold on cobalt
    numeralDark: '#1a2e60',   // same pale gold on sienna — unified parchment palette
    stroke:      '#e8d89873',
    strokeDark:  '#1a2e60',
  },
  amethyst: {
    // Amethyst & Silver — pairs with midnight velvet (#2a1733 dark purple)
    body:        '#e8e8f0',   // pale amethyst — luminous on dark purple
    bodyDark:    '#ba3cd6',   // cool silver-white — bright on dark purple
    numeral:     '#ae30db',   // near-black violet on pale amethyst
    numeralDark: '#ddd7de',   // deep purple on silver
    stroke:      '#2a105073',
    strokeDark:  '#ddd7de',
  },
  ember: {
    // Ember & Frost — pairs with weathered slate (#141820 near-black blue-grey)
    body:        '#e8641e',   // vivid ember-orange — warm and bright on near-black
    bodyDark:    '#c8d8e8',   // cool silver-blue frost — bright and cold on near-black
    numeral:     '#0e0c0a',   // near-black on orange
    numeralDark: '#02968d',   // dark slate on frost
    stroke:      '#0e0c0a73',
    strokeDark:  '#1c243073',
  },
  obsidian: {
    // Obsidian & Jade — pairs with ivory marble (#ddd6c8 pale stone)
    body:        '#0a0c0a',   // obsidian black — stark on pale stone
    bodyDark:    '#02e39c',   // deep malachite — also reads on pale stone
    numeral:     '#02e39c',   // vivid jade on black
    numeralDark: '#000000',   // pale jade on deep malachite
    stroke:      '#48c89073',
    strokeDark:  '#000000',
  },
  copper: {
    // Copper & Verdigris — pairs with weathered slate (#141820 near-black)
    body:        '#ff9f29',   // burnished copper — warm bright on near-black
    bodyDark:    '#4ab8a0',   // verdigris — cool bright on near-black
    numeral:     '#100800',   // near-black on copper
    numeralDark: '#a15a03',   // near-black on verdigris
    stroke:      '#10080073',
    strokeDark:  '#0a1a1473',
  },
  wine: {
    // Wine & Bone — pairs with green felt (#0e451c dark green)
    body:        '#500a20',   // deep wine — warm dark on dark green
    bodyDark:    '#e0d4b8',   // aged bone — bright on dark green
    numeral:     '#e0d4b8',   // bone on wine
    numeralDark: '#500a20',   // wine on bone
    stroke:      '#e0d4b873',
    strokeDark:  '#500a2073',
  },
  midnight: {
    // Midnight & Dawn — pairs with midnight velvet (#2a1733 dark purple)
    body:        '#102050',   // warm dawn-peach — light and warm on dark purple
    bodyDark:    '#02a3c7',   // deep midnight navy — distinct dark from purple
    numeral:     '#e8c8a0',   // navy on dawn
    numeralDark: '#e8c8a0',   // dawn on navy
    stroke:      '#e8c8a073',
    strokeDark:  '#d4760473',
  },
  parchment: {
    // Parchment & Ink — pairs with parchment (#e0bf77 warm amber)
    body:        '#e8d898',   // dark ink-brown — deep warm dark on amber
    bodyDark:    '#1a2840',   // dark ink-blue — cool dark on amber
    numeral:     '#016131',   // pale script-gold on brown
    numeralDark: '#e8d898',   // same pale script-gold on blue
    stroke:      '#1a284073',
    strokeDark:  '#e8d89873',
  },
};

let currentScheme = 'ivory';
let schemeCustomised = false;

// Paired dice colour scheme for each tray (used when dice haven't been customised)
const TRAY_DEFAULT_SCHEME = {
  'green-felt':      'ivory',       // ivory & jet
  'ivory-marble':    'scarlet',     // scarlet & gold
  'parchment':       'midnight',      // midnight & dawn
  'midnight-velvet': 'amethyst',    // amethyst & silver
  'weathered-slate': 'wine',       // wine & bone
};

function getDieColors(die) {
  const scheme = COLOUR_SCHEMES[currentScheme] || COLOUR_SCHEMES.ivory;
  const isDark = die.colorScheme === 'dark';
  return {
    body:    isDark ? scheme.bodyDark    : scheme.body,
    numeral: isDark ? scheme.numeralDark : scheme.numeral,
    stroke:  isDark ? scheme.strokeDark  : scheme.stroke,
  };
}
