/* roll.js — the top-level roll/advantage/disadvantage flows: locking the
   UI, running the animations from roll-animation.js, scoring the result,
   and recording it to history. Depends on state.js, ui.js, layout.js,
   render.js, roll-animation.js, and modifier.js (getModifierValue,
   setModifierDisabled, formatModifier). main.js wires the roll/advantage/
   disadvantage buttons to roll()/rollAdvantage(). */

function rollDice(diceToRoll, onSettled) {
  if (rolling || diceToRoll.length === 0) return;
  rolling = true;
  const rollBtn = document.getElementById('roll-btn');
  rollBtn.textContent = 'Rolling…';
  rollBtn.disabled = true;
  refreshPickerDisabled();
  refreshAdvantageButtons();
  setGroupChipsDisabled(true);
  setModifierDisabled(true);
  const modifier = getModifierValue();
  const totalElStart = document.getElementById('roll-total');
  totalElStart.innerHTML = '<span class="total-number is-placeholder">&mdash;</span><span class="total-caption">rolling…</span>';

  animateTumbleAndSettle(diceToRoll, () => {
    // Score and display the total as soon as dice have settled.
    if (onSettled) onSettled();
    scoreAndRecordRoll(modifier);
    // After a short pause, rotate each die to face the viewer, then unlock.
    setTimeout(() => {
      alignDiceToViewer(diceToRoll, 350, () => {
        rolling = false;
        rollBtn.textContent = 'Roll the tray';
        rollBtn.disabled = false;
        refreshPickerDisabled();
        refreshAdvantageButtons();
        setGroupChipsDisabled(false);
        setModifierDisabled(false);
      });
    }, 380);
  });
}

function roll() {
  rollDice(dice);
}

function buildAdvantageGroups() {
  const doubledDice = [];
  const groups = [];
  let pairCounter = 1000000;

  const schemeFor = (role) => (role === advCreamRole ? 'cream' : 'dark');

  dice.forEach((die) => {
    if (die.isPercentileUnit) return;

    die.advRole = 'original';
    die.colorScheme = schemeFor('original');

    if (die.sides === 100) {
      die.unitDie.advRole = 'original';
      die.unitDie.colorScheme = schemeFor('original');

      const dupTens = buildFreshDie(100);
      const dupUnits = buildFreshDie(10, true);
      const newPairId = pairCounter++;
      dupTens.pairId = newPairId;
      dupUnits.pairId = newPairId;
      dupUnits.isPercentileUnit = true;
      dupTens.unitDie = dupUnits;
      dupTens.advRole = 'duplicate';
      dupUnits.advRole = 'duplicate';
      dupTens.colorScheme = schemeFor('duplicate');
      dupUnits.colorScheme = schemeFor('duplicate');

      doubledDice.push(die, die.unitDie, dupTens, dupUnits);
      groups.push({
        kind: 'percentile',
        original: { tens: die, units: die.unitDie },
        duplicate: { tens: dupTens, units: dupUnits },
      });
    } else {
      const duplicate = buildFreshDie(die.sides);
      duplicate.advRole = 'duplicate';
      duplicate.colorScheme = schemeFor('duplicate');
      doubledDice.push(die, duplicate);
      groups.push({ kind: 'single', original: die, duplicate });
    }
  });

  return { doubledDice, groups };
}

function rollAdvantage(keepHigh) {
  if (rolling || dice.length === 0) return;
  rolling = true;
  const rollBtn = document.getElementById('roll-btn');
  const advBtn = document.getElementById('advantage-btn');
  const disadvBtn = document.getElementById('disadvantage-btn');
  rollBtn.disabled = true;
  advBtn.disabled = true;
  disadvBtn.disabled = true;
  refreshPickerDisabled();
  setGroupChipsDisabled(true);
  setModifierDisabled(true);
  const modifier = getModifierValue();
  const totalElStart = document.getElementById('roll-total');
  totalElStart.innerHTML = '<span class="total-number is-placeholder">&mdash;</span><span class="total-caption">rolling…</span>';

  const { doubledDice, groups } = buildAdvantageGroups();
  dice = doubledDice;
  layoutDoubledGrid(groups);
  renderDiceCanvas();

  animateTumbleAndSettle(dice, () => {
    const PAUSE_MS = 650;
    setTimeout(() => {
      const groupValue = (member) => {
        const v = member.tens !== undefined ? percentileValueOf(member.tens, member.units) : member.value;
        return v === null ? 0 : v;
      };

      let originalTotal = 0;
      let duplicateTotal = 0;
      groups.forEach((group) => {
        originalTotal += groupValue(group.original);
        duplicateTotal += groupValue(group.duplicate);
      });

      const originalWins = keepHigh ? originalTotal >= duplicateTotal : originalTotal <= duplicateTotal;
      const winningRole = originalWins ? 'original' : 'duplicate';

      const winners = [];
      const losers = [];
      groups.forEach((group) => {
        const winnerMember = originalWins ? group.original : group.duplicate;
        const loserMember = originalWins ? group.duplicate : group.original;
        if (group.kind === 'percentile') {
          winners.push(winnerMember.tens, winnerMember.units);
          losers.push(loserMember.tens, loserMember.units);
        } else {
          winners.push(winnerMember);
          losers.push(loserMember);
        }
      });

      advCreamRole = winningRole;

      // Score using the winners' values (scoreAndRecordRoll reads from dice,
      // so temporarily point dice at winners just for scoring, then restore
      // the full doubled set so the render loop keeps losers visible).
      const savedDice = dice;
      dice = winners;
      scoreAndRecordRoll(modifier);
      dice = savedDice;

      // Update picker icons immediately to reflect the winning die's colour.
      // We read colorScheme directly from the winner rather than going through
      // advCreamRole, which can become out of sync across multiple rolls.
      const winnerScheme = winners.find((d) => !d.isPercentileUnit);
      const altIsWinning = winnerScheme && winnerScheme.colorScheme === 'dark';
      const pickerScheme = COLOUR_SCHEMES[currentScheme] || COLOUR_SCHEMES.ivory;
      const pickerRoot = document.documentElement;
      pickerRoot.style.setProperty('--color-picker-icon', altIsWinning ? pickerScheme.bodyDark  : pickerScheme.body);
      pickerRoot.style.setProperty('--color-die-stroke',  altIsWinning ? pickerScheme.strokeDark : pickerScheme.stroke);

      renderDiceCanvas();

      // Pause, then align BOTH winners and losers to face the viewer so the
      // player can read every result before the losing group is removed.
      setTimeout(() => {
        alignDiceToViewer(dice, 350, () => {
          // Brief pause so the player can read both results, then collapse.
          setTimeout(() => {
            // Now switch to winners-only so runCollapseAnimation's start
            // positions are correct and layoutDiceGrid snaps cleanly after.
            dice = winners;
            const COLLAPSE_MS = 650;
            runCollapseAnimation(winners, losers, COLLAPSE_MS, () => {
              layoutDiceGrid();
              renderDiceCanvas();

              rolling = false;
              rollBtn.disabled = false;
              advBtn.disabled = false;
              disadvBtn.disabled = false;
              refreshPickerDisabled();
              refreshAdvantageButtons();
              setGroupChipsDisabled(false);
              setModifierDisabled(false);
              updatePickerIconColors();
            });
          }, 600);
        });
      }, 380);
    }, PAUSE_MS);
  });
}

function percentileValueOf(tensDie, unitsDie) {
  if (unitsDie.value === null) return null;
  const combined = tensDie.value + unitsDie.value;
  return combined === 0 ? 100 : combined;
}

function scoreAndRecordRoll(modifier) {
  const rolledDice = dice.filter((d) => !d.isPercentileUnit && d.value !== null);
  const valueOf = (d) => (d.sides === 100 ? percentileValueOf(d, d.unitDie) : d.value);
  const scored = rolledDice.filter((d) => valueOf(d) !== null);

  const bySides = {};
  scored.forEach((d) => {
    bySides[d.sides] = bySides[d.sides] || [];
    bySides[d.sides].push(valueOf(d));
  });
  const diceTotal = scored.reduce((sum, d) => sum + valueOf(d), 0);
  const total = diceTotal + modifier;
  const summary = DIE_TYPES.filter((s) => bySides[s]).map((s) => `d${s}: ${bySides[s].join(', ')}`).join('   ');

  history.unshift({ summary, total, n: scored.length, modifier });
  history = history.slice(0, 6);
  renderHistory();

  const captionExtra = modifier !== 0 ? ` (${diceTotal} ${formatModifier(modifier)})` : '';
  const totalEl = document.getElementById('roll-total');
  totalEl.innerHTML = `<span class="total-number">${total}</span><span class="total-caption">total across ${scored.length} ${scored.length === 1 ? 'die' : 'dice'}${captionExtra}</span>`;
}

function rerollDie(die) {
  if (die.pairId !== undefined) {
    const owner = die.isPercentileUnit
      ? dice.find((d) => d.pairId === die.pairId && !d.isPercentileUnit)
      : die;
    rollDice([owner, owner.unitDie]);
    return;
  }
  rollDice([die]);
}

function renderHistory() {
  const wrap = document.getElementById('history');
  const rows = document.getElementById('history-rows');
  if (history.length === 0) { wrap.style.display = 'none'; return; }
  wrap.style.display = 'block';
  rows.innerHTML = '';
  history.forEach((h) => {
    const row = document.createElement('div');
    row.className = 'history-row';
    const modPart = h.modifier ? `   mod ${formatModifier(h.modifier)}` : '';
    row.innerHTML = `<span class="h-summary">${h.summary}${modPart}</span><span class="h-total">= ${h.total}</span>`;
    rows.appendChild(row);
  });
}
