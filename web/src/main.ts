import './style.css'

const API_URL = 'http://localhost:3000/api';

// --- State ---
let lines: any[] = [];
let allParts: any[] = [];
let selectedWinner = 0;
let selectedFinish = 'SPIN';



// --- DOM Elements ---
const lineSelects = [
  document.getElementById('line-0') as HTMLSelectElement,
  document.getElementById('line-1') as HTMLSelectElement
];

const partsContainers = [
  document.getElementById('parts-0') as HTMLDivElement,
  document.getElementById('parts-1') as HTMLDivElement
];

const winnerBtns = document.querySelectorAll('.winner-btn');
const historyBtns = document.querySelectorAll('.history-btn');
const finishContainer = document.getElementById('finish-types') as HTMLDivElement;
const submitBtn = document.getElementById('submit-battle') as HTMLButtonElement;
const statusEl = document.getElementById('status') as HTMLDivElement;

// --- Initialization ---
async function init() {
  await Promise.all([fetchLines(), fetchParts()]);

  renderFinishTypes();
  setupEventListeners();

  // Initial render
  lineSelects.forEach((_, i) => updatePartsList(i));
}

async function fetchLines() {
  try {
    const res = await fetch(`${API_URL}/lines`);
    const data = await res.json();

    lines = data.sort((a: any, b: any) => a.name.localeCompare(b.name));

    lineSelects.forEach(select => {
      lines.forEach(line => {
        const opt = document.createElement('option');
        opt.value = line.id.toString();
        opt.textContent = line.name;

        if (line.name === 'BX') {
          opt.selected = true;
        }

        select.appendChild(opt);
      });
    });
  } catch (err) {
    showStatus('Failed to load lines', 'error');
  }
}

async function fetchParts() {
  try {
    const res = await fetch(`${API_URL}/parts`);
    allParts = await res.json();
  } catch (err) {
    showStatus('Failed to load parts', 'error');
  }
}

function renderFinishTypes() {
  const types = ['SPIN', 'OVER', 'BURST', 'XTREME'];
  types.forEach(type => {
    const btn = document.createElement('button');
    btn.className = `btn btn-outline ${type === selectedFinish ? 'active' : ''}`;
    btn.textContent = type;
    btn.onclick = () => {
      selectedFinish = type;
      renderFinishTypes(); // Re-render to update active class
    };
    finishContainer.appendChild(btn);
  });

  // Clear and re-render logic for simple state management
  finishContainer.innerHTML = '';
  types.forEach(type => {
    const btn = document.createElement('button');
    btn.className = `btn btn-outline ${type === selectedFinish ? 'active' : ''}`;
    btn.textContent = type;
    btn.onclick = () => {
      selectedFinish = type;
      renderFinishTypes();
    };
    finishContainer.appendChild(btn);
  });
}

function updatePartsList(playerIndex: number) {
  const lineId = parseInt(lineSelects[playerIndex].value);
  const container = partsContainers[playerIndex];
  container.innerHTML = '';

  const selectedLine = lines.find(l => l.id === lineId);
  if (!selectedLine) return;

  const config = selectedLine.metadata as any || { slots: ['BLADE', 'RATCHET', 'BIT'] };
  const slots = config.slots as string[];

  slots.forEach((slot: string) => {
    const field = document.createElement('div');
    field.className = 'field';

    const label = document.createElement('label');
    label.textContent = slot.replace('_', ' ');

    const select = document.createElement('select');
    select.className = `part-select-${playerIndex}`;
    select.dataset.slot = slot;

    // Filter parts belonging to this line and slot type
    const validParts = allParts.filter(p =>
      (p.lineId === lineId || p.lineId === null) &&
      p.partType.name.toUpperCase() === slot
    ).sort((a, b) => a.name.localeCompare(b.name));

    const defaultOpt = document.createElement('option');
    defaultOpt.value = '';
    defaultOpt.textContent = '-- Select --';
    select.appendChild(defaultOpt);

    validParts.forEach(part => {
      const opt = document.createElement('option');
      opt.value = part.id.toString();
      opt.textContent = part.name;
      select.appendChild(opt);
    });

    select.addEventListener('change', () => applyConstraints(playerIndex));

    field.appendChild(label);
    field.appendChild(select);
    container.appendChild(field);
  });

  applyConstraints(playerIndex);
}

function applyConstraints(playerIndex: number) {
  const selects = Array.from(document.querySelectorAll(`.part-select-${playerIndex}`)) as HTMLSelectElement[];

  // 1. Reset all to enabled/shown
  selects.forEach(select => {
    select.disabled = false;
    Array.from(select.options).forEach(opt => {
      opt.disabled = false;
      opt.style.display = '';
    });
  });

  // 2. Gather selected parts data
  let selectedParts = selects
    .map(s => s.value ? allParts.find(p => p.id === parseInt(s.value)) : null)
    .filter(Boolean);

  let selectionChanged = false;
  const globallyConsumedSlots = new Set<string>();

  selects.forEach(select => {
    // 1. Check if options in this Select conflict with constraints from upper parts
    Array.from(select.options).forEach(opt => {
      if (!opt.value) return;
      const optPart = allParts.find(p => p.id === parseInt(opt.value));
      if (!optPart?.metadata) return;

      const optConsumes = optPart.metadata.consumesSlots || [];
      const conflictsWithHigher = optConsumes.some((slot: string) => globallyConsumedSlots.has(slot));
      const conflictsWithRestrictedRatchets = optConsumes.includes('RATCHET') && globallyConsumedSlots.has('RESTRICTED_RATCHETS');

      if (conflictsWithHigher || conflictsWithRestrictedRatchets) {
        opt.disabled = true;
        opt.style.display = 'none';

        if (select.value === opt.value) {
          select.value = '';
          selectionChanged = true;
        }
      }
    });

    // 2. Register slot constraints dictated by the currently selected part
    const effectivePart = select.value ? allParts.find(p => p.id === parseInt(select.value)) : null;
    if (effectivePart?.metadata) {
      if (effectivePart.metadata.consumesSlots) {
        effectivePart.metadata.consumesSlots.forEach((slot: string) => globallyConsumedSlots.add(slot));
      }
      if (effectivePart.metadata.allowedRatchetHeights?.length > 0) {
        globallyConsumedSlots.add('RESTRICTED_RATCHETS');
      }
    }
  });

  if (selectionChanged) {
    selectedParts = selects
      .map(s => s.value ? allParts.find(p => p.id === parseInt(s.value)) : null)
      .filter(Boolean);
  }

  // 3. Process Generic Constraints
  selectedParts.forEach(part => {
    const meta = part.metadata;
    if (!meta) return;

    // A. consumesSlots (e.g. Bits that consume Ratchets)
    if (meta.consumesSlots && Array.isArray(meta.consumesSlots)) {
      meta.consumesSlots.forEach((slotName: string) => {
        const targetSelect = selects.find(s => s.dataset.slot === slotName);
        if (targetSelect) {
          targetSelect.value = '';
          targetSelect.disabled = true;
        }
      });
    }

    // B. allowedRatchetHeights (e.g. ClockMirage only allows height 60)
    if (meta.allowedRatchetHeights && Array.isArray(meta.allowedRatchetHeights)) {
      const allowed = meta.allowedRatchetHeights.map(String);
      const targetSelect = selects.find(s => s.dataset.slot === 'RATCHET');

      if (targetSelect && !targetSelect.disabled) {
        Array.from(targetSelect.options).forEach(opt => {
          if (!opt.value) return;
          const rPart = allParts.find(p => p.id === parseInt(opt.value));
          if (rPart) {
            const parts = rPart.name.split('-');
            const height = parts.length > 1 ? parts[1] : '';

            const isAllowed = allowed.some((val: string) => height.endsWith(val));

            if (!isAllowed) {
              opt.disabled = true;
              opt.style.display = 'none';
              if (targetSelect.value === opt.value) {
                targetSelect.value = '';
              }
            }
          }
        });
      }
    }
  });

  checkFavoriteState(playerIndex);
}

function renderHistory(playerIndex: number) {
  const dropdown = document.getElementById(`history-dropdown-${playerIndex}`) as HTMLDivElement;

  if (!dropdown.classList.contains('hidden')) {
    dropdown.classList.add('hidden');
    return;
  }

  document.getElementById(`history-dropdown-${playerIndex === 0 ? 1 : 0}`)?.classList.add('hidden');

  let history: any[] = [];
  try {
    history = JSON.parse(localStorage.getItem('comboHistory') || '[]');
  } catch (e) {
    history = [];
  }

  if (history.length === 0) {
    dropdown.innerHTML = '<div style="padding: 0.5rem; color: #94a3b8; font-size: 0.8rem; text-align: center;">Nada salvo ainda</div>';
    dropdown.classList.remove('hidden');
    return;
  }

  dropdown.innerHTML = '';

  history.forEach(combo => {
    const line = lines.find(l => l.id === combo.lineId);
    const lineName = line ? line.name : '??';

    const config = line?.metadata || { nameTemplate: '{BLADE} {RATCHET} {BIT}' };
    let comboNameStr = config.nameTemplate || '{BLADE} {RATCHET} {BIT}';

    const placeholders = comboNameStr.match(/\{([A_Z_]+)\}/g) || [];
    placeholders.forEach((placeholder: string) => {
      const slotName = placeholder.replace(/[{}]/g, '');
      const partId = combo.partsIds.find((id: number) => {
        const p = allParts.find((x: any) => x.id === id);
        return p && p.partType.name === slotName;
      });

      let displayVal = '';
      if (partId) {
        const part = allParts.find((p: any) => p.id === partId);
        displayVal = part ? (part.abbreviation || part.name) : '?';
      }

      comboNameStr = comboNameStr.replace(placeholder, displayVal);
    });

    comboNameStr = comboNameStr.replace(/\s{2,}/g, ' ').trim();

    const btn = document.createElement('button');
    btn.className = 'history-item';
    btn.textContent = `${lineName}: ${comboNameStr}`;

    btn.onclick = () => {
      lineSelects[playerIndex].value = combo.lineId.toString();
      updatePartsList(playerIndex);

      const partSelects = document.querySelectorAll(`.part-select-${playerIndex}`) as NodeListOf<HTMLSelectElement>;
      combo.partsIds.forEach((id: number, idx: number) => {
        if (partSelects[idx]) {
          partSelects[idx].value = id.toString();
        }
      });
      applyConstraints(playerIndex);
      dropdown.classList.add('hidden');
    };

    dropdown.appendChild(btn);
  });

  dropdown.classList.remove('hidden');
}

// --- Favorites System ---

function getComboObj(playerIndex: number) {
  const lineSelect = lineSelects[playerIndex];
  const partSelects = document.querySelectorAll(`.part-select-${playerIndex}`) as NodeListOf<HTMLSelectElement>;

  let hasMissing = false;
  partSelects.forEach(select => {
    if (!select.disabled && !select.value) hasMissing = true;
  });

  if (hasMissing || !lineSelect.value) return null;

  return {
    lineId: parseInt(lineSelect.value),
    partsIds: Array.from(partSelects).map(s => parseInt(s.value)).filter(id => !isNaN(id))
  };
}

function checkFavoriteState(playerIndex: number) {
  const comboObj = getComboObj(playerIndex);
  const btnIcon = document.querySelector(`.save-fav-btn[data-player="${playerIndex}"] .fav-star-icon`) as SVGSVGElement;
  if (!btnIcon) return;

  if (!comboObj) {
    btnIcon.setAttribute('fill', 'none');
    btnIcon.style.color = 'currentColor';
    return;
  }

  let favorites: any[] = [];
  try {
    favorites = JSON.parse(localStorage.getItem('favCombos') || '[]');
  } catch (e) {
    favorites = [];
  }

  const comboStr = JSON.stringify(comboObj);
  const exists = favorites.some((c: any) => JSON.stringify(c) === comboStr);

  if (exists) {
    const activeColor = playerIndex === 0 ? 'var(--accent-bx)' : 'var(--accent-ux)';
    btnIcon.setAttribute('fill', activeColor);
    btnIcon.style.color = activeColor;
  } else {
    btnIcon.setAttribute('fill', 'none');
    btnIcon.style.color = 'currentColor';
  }
}

function toggleFavorite(playerIndex: number) {
  const comboObj = getComboObj(playerIndex);

  if (!comboObj) {
    showStatus('Complete the combo visually before saving it!', 'error');
    return;
  }

  let favorites: any[] = [];
  try {
    favorites = JSON.parse(localStorage.getItem('favCombos') || '[]');
  } catch (e) {
    favorites = [];
  }

  const comboStr = JSON.stringify(comboObj);
  const existingIndex = favorites.findIndex((c: any) => JSON.stringify(c) === comboStr);

  if (existingIndex !== -1) {
    favorites.splice(existingIndex, 1);
    showStatus('Combo removed from favorites!', 'success');
  } else {
    favorites.unshift(comboObj);
    if (favorites.length > 30) {
      favorites.pop();
    }
    showStatus('Combo saved to favorites!', 'success');
  }

  localStorage.setItem('favCombos', JSON.stringify(favorites));
  checkFavoriteState(playerIndex);
  
  // Refresh dropdown if it's currently open
  const dropdown = document.getElementById(`fav-dropdown-${playerIndex}`);
  if (dropdown && !dropdown.classList.contains('hidden')) {
    dropdown.classList.add('hidden'); 
    renderFavorites(playerIndex);
  }
}

function renderFavorites(playerIndex: number) {
  const dropdown = document.getElementById(`fav-dropdown-${playerIndex}`) as HTMLDivElement;

  if (!dropdown.classList.contains('hidden')) {
    dropdown.classList.add('hidden');
    return;
  }

  // Close other dropdowns
  document.getElementById(`history-dropdown-${playerIndex}`)?.classList.add('hidden');
  document.getElementById(`history-dropdown-${playerIndex === 0 ? 1 : 0}`)?.classList.add('hidden');
  document.getElementById(`fav-dropdown-${playerIndex === 0 ? 1 : 0}`)?.classList.add('hidden');

  let favorites: any[] = [];
  try {
    favorites = JSON.parse(localStorage.getItem('favCombos') || '[]');
  } catch (e) {
    favorites = [];
  }

  if (favorites.length === 0) {
    dropdown.innerHTML = '<div style="padding: 0.5rem; color: #94a3b8; font-size: 0.8rem; text-align: center;">No favorites saved</div>';
    dropdown.classList.remove('hidden');
    return;
  }

  dropdown.innerHTML = '';

  favorites.forEach((combo) => {
    const line = lines.find(l => l.id === combo.lineId);
    const lineName = line ? line.name : '??';

    const config = line?.metadata || { nameTemplate: '{BLADE} {RATCHET} {BIT}' };
    let comboNameStr = config.nameTemplate || '{BLADE} {RATCHET} {BIT}';

    const placeholders = comboNameStr.match(/\{([A_Z_]+)\}/g) || [];
    placeholders.forEach((placeholder: string) => {
      const slotName = placeholder.replace(/[{}]/g, '');
      const partId = combo.partsIds.find((id: number) => {
        const p = allParts.find((x: any) => x.id === id);
        return p && p.partType.name === slotName;
      });

      let displayVal = '';
      if (partId) {
        const part = allParts.find((p: any) => p.id === partId);
        displayVal = part ? (part.abbreviation || part.name) : '?';
      }

      comboNameStr = comboNameStr.replace(placeholder, displayVal);
    });

    comboNameStr = comboNameStr.replace(/\s{2,}/g, ' ').trim();

    const btn = document.createElement('button');
    btn.className = 'history-item';
    btn.textContent = `${lineName}: ${comboNameStr}`;

    btn.onclick = () => {
      lineSelects[playerIndex].value = combo.lineId.toString();
      updatePartsList(playerIndex);

      const pSelects = document.querySelectorAll(`.part-select-${playerIndex}`) as NodeListOf<HTMLSelectElement>;
      combo.partsIds.forEach((id: number, idx: number) => {
        if (pSelects[idx]) {
          pSelects[idx].value = id.toString();
        }
      });
      applyConstraints(playerIndex);
      dropdown.classList.add('hidden');
    };

    dropdown.appendChild(btn);
  });

  dropdown.classList.remove('hidden');
}

function setupEventListeners() {
  lineSelects.forEach((select, i) => {
    select.onchange = () => updatePartsList(i);
  });

  winnerBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      winnerBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedWinner = parseInt((btn as HTMLElement).dataset.index!);
    });
  });

  historyBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const playerIndex = parseInt((btn as HTMLElement).dataset.player!);
      document.getElementById(`fav-dropdown-0`)?.classList.add('hidden');
      document.getElementById(`fav-dropdown-1`)?.classList.add('hidden');
      renderHistory(playerIndex);
    });
  });

  const saveFavBtns = document.querySelectorAll('.save-fav-btn');
  saveFavBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const playerIndex = parseInt((btn as HTMLElement).dataset.player!);
      toggleFavorite(playerIndex);
    });
  });

  const loadFavBtns = document.querySelectorAll('.load-fav-btn');
  loadFavBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const playerIndex = parseInt((btn as HTMLElement).dataset.player!);
      renderFavorites(playerIndex);
    });
  });

  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (!target.closest('.history-dropdown') && !target.closest('.action-buttons')) {
      document.getElementById('history-dropdown-0')?.classList.add('hidden');
      document.getElementById('history-dropdown-1')?.classList.add('hidden');
      document.getElementById('fav-dropdown-0')?.classList.add('hidden');
      document.getElementById('fav-dropdown-1')?.classList.add('hidden');
    }
  });

  submitBtn.onclick = submitBattle;
}

async function submitBattle() {
  submitBtn.disabled = true;
  submitBtn.textContent = 'Registering...';

  // Require all active dropdowns to be filled
  let missingParts = false;
  [0, 1].forEach(i => {
    const partSelects = document.querySelectorAll(`.part-select-${i}`) as NodeListOf<HTMLSelectElement>;
    partSelects.forEach(select => {
      if (!select.disabled && !select.value) {
        missingParts = true;
        select.style.borderColor = 'var(--error)';
        setTimeout(() => select.style.borderColor = '', 3000);
      }
    });
  });

  if (missingParts) {
    showStatus('Please select all required parts for both players!', 'error');
    submitBtn.disabled = false;
    submitBtn.textContent = 'Register Battle';
    return;
  }

  try {
    const entries = [0, 1].map(i => {
      const partSelects = document.querySelectorAll(`.part-select-${i}`) as NodeListOf<HTMLSelectElement>;
      return {
        lineId: parseInt(lineSelects[i].value),
        partsIds: Array.from(partSelects)
          .map(s => parseInt(s.value))
          .filter(id => !isNaN(id))
      };
    });

    const payload = {
      finishType: selectedFinish,
      winner: selectedWinner,
      entries
    };

    const res = await fetch(`${API_URL}/battles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (res.ok) {
      showStatus('Battle successfully registered!', 'success');

      let history: any[] = [];
      try {
        history = JSON.parse(localStorage.getItem('comboHistory') || '[]');
      } catch (e) {
        history = [];
      }

      entries.forEach((entry: any) => {
        const entryStr = JSON.stringify(entry);

        history = history.filter((combo: any) => JSON.stringify(combo) !== entryStr);

        history.unshift(entry);
        if (history.length > 20) {
          history.pop();
        }

      });

      localStorage.setItem('comboHistory', JSON.stringify(history));

    } else {
      showStatus(data.error || 'Validation error', 'error');
    }
  } catch (err) {
    showStatus('Network error', 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Register Battle';
  }
}

function showStatus(msg: string, type: 'success' | 'error') {
  statusEl.textContent = msg;
  statusEl.style.display = 'block';
  statusEl.style.background = type === 'success' ? 'var(--success)' : 'var(--error)';
  statusEl.style.color = '#0f172a';

  setTimeout(() => {
    statusEl.style.display = 'none';
  }, 4000);
}

init();
