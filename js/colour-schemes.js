/* colour-schemes.js — the dice colour palettes offered under "Customise Dice",
   plus which palette pairs with each tray theme by default. Depends on
   nothing; TRAY_THEMES (tray-themes.js) and applyTrayTheme() read
   TRAY_DEFAULT_SCHEME and currentScheme from here.

   Design rules for every scheme (see getDieColors() for how they're read):
     - Every scheme targets one specific tray (its `tray` key) and both
       dice must read clearly against that tray's background.
     - primary and secondary sit on the SAME side of the tray's lightness —
       both bright bodies on a dark tray, both deep bodies on a light tray —
       and are told apart by hue/character, never by inverting light/dark.
       secondary is its own theme, not primary's mirror image.
     - The one exception is `ivory` ("Ivory & Jet"), the default pairing for
       green felt: a deliberate cream/jet inversion, and protected — never
       remove or restyle it. Every other scheme is fair game to add, rename,
       or retune.
   Values were checked against WCAG contrast (numeral vs its own body ≥4.5:1,
   body vs its tray ≥3:1 except ivory's protected jet secondary, primary body
   vs secondary body ≥1.8:1 so the pair reads as two colours, not one). */

/* =========================================================================
   COLOUR SCHEMES
   Each scheme has a `tray` (the theme it's designed for), a `label` (shown
   in the dropdown), and two roles — `primary` and `secondary` — the two
   dice colours used in Advantage/Disadvantage rolls (see die.colorRole in
   state.js/roll.js). Each role defines:
     body:    fill colour for the die
     numeral: numeral colour on that body
     stroke:  edge line colour on that body (always the numeral colour at
              ~45% alpha, i.e. hex + "73")
   ========================================================================= */
const COLOUR_SCHEMES = {
  ivory: {
    tray: 'green-felt',
    label: 'Ivory & Jet',
    // Protected default — cream vs jet, the one deliberate inversion.
    primary:   { body: '#f0e6cc', numeral: '#1a1a1a', stroke: '#1a1a1a73' },
    secondary: { body: '#1a1a1a', numeral: '#f0e6cc', stroke: '#f0e6cc73' },
  },
  heraldic: {
    tray: 'green-felt',
    label: 'Gold & Flame',
    primary:   { body: '#e3b23c', numeral: '#3a2000', stroke: '#3a200073' },
    secondary: { body: '#e35a3f', numeral: '#3a0a00', stroke: '#3a0a0073' },
  },
  pearl: {
    tray: 'green-felt',
    label: 'Pearl & Teal',
    primary:   { body: '#ece6da', numeral: '#1a2420', stroke: '#1a242073' },
    secondary: { body: '#46b5a8', numeral: '#062420', stroke: '#06242073' },
  },

  amethyst: {
    tray: 'midnight-velvet',
    label: 'Amethyst & Gold',
    primary:   { body: '#b070e8', numeral: '#2a0a3a', stroke: '#2a0a3a73' },
    secondary: { body: '#f0c860', numeral: '#3a2400', stroke: '#3a240073' },
  },
  starlight: {
    tray: 'midnight-velvet',
    label: 'Starlight & Nebula',
    primary:   { body: '#ffe9a8', numeral: '#3a2a00', stroke: '#3a2a0073' },
    secondary: { body: '#2aa8ba', numeral: '#00343a', stroke: '#00343a73' },
  },
  spectre: {
    tray: 'midnight-velvet',
    label: 'Bone & Spectral Green',
    primary:   { body: '#e8e0d0', numeral: '#22201a', stroke: '#22201a73' },
    secondary: { body: '#2fbc42', numeral: '#062008', stroke: '#06200873' },
  },

  ember: {
    tray: 'weathered-slate',
    label: 'Ember & Frost',
    primary:   { body: '#e8641e', numeral: '#1a0a00', stroke: '#1a0a0073' },
    secondary: { body: '#c8d8e8', numeral: '#101c28', stroke: '#101c2873' },
  },
  copper: {
    tray: 'weathered-slate',
    label: 'Copper & Verdigris',
    primary:   { body: '#d08039', numeral: '#241000', stroke: '#24100073' },
    secondary: { body: '#267363', numeral: '#ffffff', stroke: '#ffffff73' },
  },
  signal: {
    tray: 'weathered-slate',
    label: 'Steel & Signal Red',
    primary:   { body: '#b9c6d4', numeral: '#141c24', stroke: '#141c2473' },
    secondary: { body: '#f0170f', numeral: '#1a0000', stroke: '#1a000073' },
  },

  manuscript: {
    tray: 'parchment',
    label: 'Ink & Vermilion',
    primary:   { body: '#1e2a44', numeral: '#e8d898', stroke: '#e8d89873' },
    secondary: { body: '#a8321e', numeral: '#fce8d4', stroke: '#fce8d473' },
  },
  oxblood: {
    tray: 'parchment',
    label: 'Oxblood & Moss',
    primary:   { body: '#5a1a20', numeral: '#eddac0', stroke: '#eddac073' },
    secondary: { body: '#456a30', numeral: '#e4ecd4', stroke: '#e4ecd473' },
  },
  sepia: {
    tray: 'parchment',
    label: 'Umber & Indigo',
    primary:   { body: '#4a3018', numeral: '#ecd8a8', stroke: '#ecd8a873' },
    secondary: { body: '#4a5ab0', numeral: '#dce0f4', stroke: '#dce0f473' },
  },

  imperial: {
    tray: 'ivory-marble',
    label: 'Crimson & Cobalt',
    primary:   { body: '#7a0f22', numeral: '#f4e4c8', stroke: '#f4e4c873' },
    secondary: { body: '#4666ae', numeral: '#e0e8f8', stroke: '#e0e8f873' },
  },
  obsidian: {
    tray: 'ivory-marble',
    label: 'Obsidian & Jade',
    primary:   { body: '#14181a', numeral: '#5be0a8', stroke: '#5be0a873' },
    secondary: { body: '#14503c', numeral: '#a8f0cc', stroke: '#a8f0cc73' },
  },
  porphyry: {
    tray: 'ivory-marble',
    label: 'Porphyry & Bronze',
    primary:   { body: '#5c2233', numeral: '#f0d8c0', stroke: '#f0d8c073' },
    secondary: { body: '#7a5624', numeral: '#f4e8c8', stroke: '#f4e8c873' },
  },
};

let currentScheme = 'ivory';
let schemeCustomised = false;

// Paired dice colour scheme for each tray (used when dice haven't been customised)
const TRAY_DEFAULT_SCHEME = {
  'green-felt':      'ivory',       // Ivory & Jet
  'ivory-marble':    'imperial',    // Crimson & Cobalt
  'parchment':       'manuscript',  // Ink & Vermilion
  'midnight-velvet': 'amethyst',    // Amethyst & Gold
  'weathered-slate': 'ember',       // Ember & Frost
};

function getDieColors(die) {
  const scheme = COLOUR_SCHEMES[currentScheme] || COLOUR_SCHEMES.ivory;
  return die.colorRole === 'secondary' ? scheme.secondary : scheme.primary;
}
