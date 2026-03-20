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
    lines = await res.json();

    lineSelects.forEach(select => {
      lines.forEach(line => {
        const opt = document.createElement('option');
        opt.value = line.id.toString();
        opt.textContent = line.name;
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

  // Determine slots based on line (BX/UX vs CX)
  let slots = ['BLADE', 'RATCHET', 'BIT'];
  if (selectedLine.name === 'CX') {
    slots = ['LOCK_CHIP', 'MAIN_BLADE', 'ASSIST_BLADE', 'RATCHET', 'BIT'];
  }

  slots.forEach(slot => {
    const field = document.createElement('div');
    field.className = 'field';

    const label = document.createElement('label');
    label.textContent = slot.replace('_', ' ');

    const select = document.createElement('select');
    select.className = `part-select-${playerIndex}`;
    select.dataset.slot = slot;

    // Filtrar peças que pertencem a essa linha e esse tipo
    const validParts = allParts.filter(p =>
      (p.lineId === lineId || p.lineId === null) &&
      p.partType.name.toUpperCase() === slot
    );

    validParts.forEach(part => {
      const opt = document.createElement('option');
      opt.value = part.id.toString();
      opt.textContent = part.name;
      select.appendChild(opt);
    });

    field.appendChild(label);
    field.appendChild(select);
    container.appendChild(field);
  });
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

  submitBtn.onclick = submitBattle;
}

async function submitBattle() {
  submitBtn.disabled = true;
  submitBtn.textContent = 'Registering...';

  try {
    const entries = [0, 1].map(i => {
      const partSelects = document.querySelectorAll(`.part-select-${i}`) as NodeListOf<HTMLSelectElement>;
      return {
        lineId: parseInt(lineSelects[i].value),
        partsIds: Array.from(partSelects).map(s => parseInt(s.value))
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
