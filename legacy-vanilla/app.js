const STORAGE_KEY = "billetera.v1";

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatMoney(n) {
  const value = Number.isFinite(n) ? n : 0;
  try {
    return new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency: "PEN",
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    const sign = value < 0 ? "-" : "";
    return `${sign}$${Math.abs(value).toFixed(2)}`;
  }
}

function uid() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function parseISODate(iso) {
  const [y, m, d] = String(iso || "").split("-").map((x) => Number(x));
  return new Date(y, (m || 1) - 1, d || 1);
}

function dateToISO(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function startOfWeekMonday(base) {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  const day = d.getDay();
  const diff = (day + 6) % 7;
  d.setDate(d.getDate() - diff);
  return d;
}

function getSelectedBudgetDays(containerEl) {
  const days = [];
  if (!containerEl) return days;
  const inputs = containerEl.querySelectorAll('input[type="checkbox"]');
  for (const el of inputs) {
    if (el.checked) days.push(Number(el.value));
  }
  return days;
}

function parseAmount(raw) {
  const n = Number(raw);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return {
      initialBalance: 0,
      incomes: [],
      expenses: [],
      budgets: [],
      ui: {
        filterDate: "",
      },
    };
  }

  try {
    const parsed = JSON.parse(raw);
    return {
      initialBalance: Number(parsed.initialBalance || 0),
      incomes: Array.isArray(parsed.incomes) ? parsed.incomes : [],
      expenses: Array.isArray(parsed.expenses) ? parsed.expenses : [],
      budgets: Array.isArray(parsed.budgets) ? parsed.budgets : [],
      ui: {
        filterDate: parsed.ui && typeof parsed.ui.filterDate === "string" ? parsed.ui.filterDate : "",
      },
    };
  } catch {
    return {
      initialBalance: 0,
      incomes: [],
      expenses: [],
      budgets: [],
      ui: {
        filterDate: "",
      },
    };
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function computeTotals() {
  const incomesTotal = state.incomes.reduce((acc, x) => acc + Number(x.amount || 0), 0);
  const expenseDone = state.expenses
    .filter((x) => Boolean(x.done))
    .reduce((acc, x) => acc + Number(x.actualAmount || 0), 0);
  const expensePending = state.expenses
    .filter((x) => !x.done)
    .reduce((acc, x) => acc + Number(x.plannedAmount || 0), 0);
  const savingsDone = state.expenses
    .filter((x) => Boolean(x.done))
    .reduce((acc, x) => acc + (Number(x.plannedAmount || 0) - Number(x.actualAmount || 0)), 0);

  const balance = Number(state.initialBalance || 0) + incomesTotal - expenseDone;

  return {
    incomesTotal,
    expenseDone,
    expensePending,
    savingsDone,
    balance,
  };
}

function el(id) {
  return document.getElementById(id);
}

const ui = {
  balanceValue: el("balanceValue"),
  savingsValue: el("savingsValue"),
  incomeTotal: el("incomeTotal"),
  expenseDoneTotal: el("expenseDoneTotal"),
  expensePendingTotal: el("expensePendingTotal"),
  savingsTotal: el("savingsTotal"),

  openIncomeBtn: el("openIncomeBtn"),
  openExpenseBtn: el("openExpenseBtn"),
  openHistoryBtn: el("openHistoryBtn"),

  incomeForm: el("incomeForm"),
  incomeDialog: el("incomeDialog"),
  incomeBalanceText: el("incomeBalanceText"),
  incomeDate: el("incomeDate"),
  incomeAmount: el("incomeAmount"),
  incomeNote: el("incomeNote"),
  setInitialBalanceBtn: el("setInitialBalanceBtn"),
  incomeCancel: el("incomeCancel"),

  expenseForm: el("expenseForm"),
  expenseDialog: el("expenseDialog"),
  expenseDate: el("expenseDate"),
  expenseAmount: el("expenseAmount"),
  expenseCategory: el("expenseCategory"),
  expenseTitle: el("expenseTitle"),
  expenseNote: el("expenseNote"),
  expenseCancel: el("expenseCancel"),

  historyDialog: el("historyDialog"),
  historyCancel: el("historyCancel"),

  actualAmountDialog: el("actualAmountDialog"),
  actualAmountText: el("actualAmountText"),
  actualAmountForm: el("actualAmountForm"),
  actualAmountInput: el("actualAmountInput"),
  actualAmountCancel: el("actualAmountCancel"),
  actualAmountUsePlan: el("actualAmountUsePlan"),

  budgetForm: el("budgetForm"),
  budgetFrequency: el("budgetFrequency"),
  budgetAmount: el("budgetAmount"),
  budgetCategory: el("budgetCategory"),
  budgetTitle: el("budgetTitle"),
  budgetDays: el("budgetDays"),
  budgetBaseDate: el("budgetBaseDate"),
  generateWeekBtn: el("generateWeekBtn"),
  generateMonthBtn: el("generateMonthBtn"),
  budgetsList: el("budgetsList"),
  budgetsEmpty: el("budgetsEmpty"),

  filterDate: el("filterDate"),
  filterTodayBtn: el("filterTodayBtn"),
  filterAllBtn: el("filterAllBtn"),

  expensesList: el("expensesList"),
  emptyState: el("emptyState"),
  clearAllBtn: el("clearAllBtn"),

  confirmDialog: el("confirmDialog"),
  confirmTitle: el("confirmTitle"),
  confirmText: el("confirmText"),
  confirmCancel: el("confirmCancel"),
  confirmOk: el("confirmOk"),

  editDialog: el("editDialog"),
  editForm: el("editForm"),
  editDate: el("editDate"),
  editPlanned: el("editPlanned"),
  editActual: el("editActual"),
  editStatus: el("editStatus"),
  editCategory: el("editCategory"),
  editTitle: el("editTitle"),
  editNote: el("editNote"),
  editCancel: el("editCancel"),
};

let state = loadState();
let editingExpenseId = null;
let pendingActualExpenseId = null;

function openDialog(dlg) {
  if (!dlg) return;
  try {
    dlg.showModal();
  } catch {
    dlg.open = true;
  }
}

function closeDialog(dlg) {
  if (!dlg) return;
  try {
    dlg.close();
  } catch {
    dlg.open = false;
  }
}

function normalizeState() {
  let changed = false;

  if (!Array.isArray(state.budgets)) {
    state.budgets = [];
    changed = true;
  }

  if (Array.isArray(state.expenses)) {
    state.expenses = state.expenses.map((x) => {
      const hasPlanned = Object.prototype.hasOwnProperty.call(x, "plannedAmount");
      const hasActual = Object.prototype.hasOwnProperty.call(x, "actualAmount");
      const hasLegacyAmount = Object.prototype.hasOwnProperty.call(x, "amount");
      if (hasPlanned && hasActual) return x;

      const plannedAmount = hasPlanned ? Number(x.plannedAmount || 0) : Number(hasLegacyAmount ? x.amount || 0 : 0);
      const actualAmount = hasActual ? Number(x.actualAmount || 0) : (x.done ? plannedAmount : 0);

      const next = { ...x, plannedAmount, actualAmount };
      if (hasLegacyAmount) delete next.amount;
      changed = true;
      return next;
    });
  }

  if (changed) saveState();
}

function setDefaultDates() {
  const t = todayISO();
  if (!ui.incomeDate.value) ui.incomeDate.value = t;
  if (!ui.expenseDate.value) ui.expenseDate.value = t;
  if (ui.budgetBaseDate && !ui.budgetBaseDate.value) ui.budgetBaseDate.value = t;
  if (typeof state.ui.filterDate === "string" && state.ui.filterDate) {
    ui.filterDate.value = state.ui.filterDate;
  }
}

function render() {
  const totals = computeTotals();

  ui.balanceValue.textContent = formatMoney(totals.balance);
  if (ui.savingsValue) ui.savingsValue.textContent = formatMoney(totals.savingsDone);
  if (ui.incomeBalanceText) {
    ui.incomeBalanceText.textContent = `Saldo actual: ${formatMoney(totals.balance)} · Puedes agregar un ingreso o establecer un saldo inicial.`;
  }
  ui.incomeTotal.textContent = formatMoney(totals.incomesTotal);
  ui.expenseDoneTotal.textContent = formatMoney(totals.expenseDone);
  ui.expensePendingTotal.textContent = formatMoney(totals.expensePending);
  if (ui.savingsTotal) ui.savingsTotal.textContent = formatMoney(totals.savingsDone);

  const filterDate = ui.filterDate.value.trim();
  const expenses = state.expenses
    .filter((x) => (filterDate ? x.date === filterDate : true))
    .slice()
    .sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      return (b.createdAt || 0) - (a.createdAt || 0);
    });

  ui.expensesList.innerHTML = "";

  if (expenses.length === 0) {
    ui.emptyState.style.display = "block";
  } else {
    ui.emptyState.style.display = "none";
  }

  for (const exp of expenses) {
    ui.expensesList.appendChild(renderExpenseItem(exp));
  }

  renderBudgets();
}

function addBudgetRule({ frequency, amount, category, title, days }) {
  const rule = {
    id: uid(),
    frequency,
    amount,
    category,
    title,
    days,
    createdAt: Date.now(),
  };
  state.budgets.unshift(rule);
  saveState();
  render();
}

function setExpenseDoneWithActual(expenseId, actualAmount) {
  const idx = state.expenses.findIndex((x) => x.id === expenseId);
  if (idx === -1) return;
  const current = state.expenses[idx];
  state.expenses[idx] = {
    ...current,
    done: true,
    actualAmount: Number(actualAmount || 0),
  };
  saveState();
  render();
}

function promptActualAmount(expenseId) {
  const exp = state.expenses.find((x) => x.id === expenseId);
  if (!exp) return;

  pendingActualExpenseId = expenseId;
  ui.actualAmountText.textContent = `${exp.title} (${exp.date}) · Plan: ${formatMoney(Number(exp.plannedAmount || 0))}`;
  ui.actualAmountInput.value = String(Number(exp.plannedAmount || 0));
  openDialog(ui.actualAmountDialog);
  ui.actualAmountInput.focus();
  ui.actualAmountInput.select?.();
}

function cancelActualAmountPrompt() {
  pendingActualExpenseId = null;
  closeDialog(ui.actualAmountDialog);
  render();
}

function deleteBudgetRule(ruleId) {
  state.budgets = state.budgets.filter((x) => x.id !== ruleId);
  saveState();
  render();
}

function renderBudgets() {
  if (!ui.budgetsList || !ui.budgetsEmpty) return;
  ui.budgetsList.innerHTML = "";
  if (!state.budgets || state.budgets.length === 0) {
    ui.budgetsEmpty.style.display = "block";
    return;
  }
  ui.budgetsEmpty.style.display = "none";

  const daysLabel = (days) => {
    const map = { 1: "L", 2: "M", 3: "X", 4: "J", 5: "V", 6: "S", 0: "D" };
    return (days || []).map((d) => map[d]).join(" ") || "-";
  };

  for (const rule of state.budgets) {
    const row = document.createElement("div");
    row.className = "item";

    const left = document.createElement("div");
    left.textContent = "";

    const main = document.createElement("div");
    const t = document.createElement("div");
    t.className = "item__title";

    const name = document.createElement("div");
    name.textContent = rule.title;
    name.style.fontWeight = "750";

    const badge = document.createElement("span");
    badge.className = "badge";
    badge.textContent = `${rule.frequency === "weekly" ? "Semanal" : "Mensual"} · ${rule.category}`;

    t.appendChild(name);
    t.appendChild(badge);

    const meta = document.createElement("div");
    meta.className = "item__meta";
    const d = document.createElement("span");
    d.textContent = `Días: ${daysLabel(rule.days)}`;
    const a = document.createElement("span");
    a.textContent = `Plan: ${formatMoney(Number(rule.amount || 0))}`;
    meta.appendChild(d);
    meta.appendChild(a);

    main.appendChild(t);
    main.appendChild(meta);

    const right = document.createElement("div");
    const actions = document.createElement("div");
    actions.className = "item__actions";

    const delBtn = document.createElement("button");
    delBtn.className = "iconbtn";
    delBtn.type = "button";
    delBtn.textContent = "Borrar";
    delBtn.addEventListener("click", async () => {
      const ok = await openConfirm({
        title: "Borrar regla",
        text: `¿Borrar la regla "${rule.title}"?`,
        okText: "Borrar",
      });
      if (!ok) return;
      deleteBudgetRule(rule.id);
    });

    actions.appendChild(delBtn);
    right.appendChild(actions);

    row.appendChild(left);
    row.appendChild(main);
    row.appendChild(right);

    ui.budgetsList.appendChild(row);
  }
}

function generateForRange(startDate, endDate) {
  const rules = Array.isArray(state.budgets) ? state.budgets : [];
  const existingKeys = new Set(
    state.expenses
      .filter((x) => x.sourceBudgetId)
      .map((x) => `${x.sourceBudgetId}|${x.date}`)
  );

  const created = [];
  const cursor = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  while (cursor <= endDate) {
    const dow = cursor.getDay();
    const iso = dateToISO(cursor);

    for (const r of rules) {
      if (!Array.isArray(r.days) || r.days.length === 0) continue;
      if (!r.days.includes(dow)) continue;

      const key = `${r.id}|${iso}`;
      if (existingKeys.has(key)) continue;

      created.push({
        date: iso,
        plannedAmount: Number(r.amount || 0),
        category: r.category,
        title: r.title,
        note: "",
        actualAmount: 0,
        done: false,
        sourceBudgetId: r.id,
      });

      existingKeys.add(key);
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  if (created.length === 0) return;
  for (const e of created.reverse()) {
    addExpense(e);
  }
}

function renderExpenseItem(exp) {
  const row = document.createElement("div");
  row.className = `item${exp.done ? " item--done" : ""}`;

  const checkWrap = document.createElement("div");
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.className = "checkbox";
  checkbox.checked = Boolean(exp.done);
  checkbox.addEventListener("change", () => {
    toggleExpenseDone(exp.id, checkbox.checked);
  });
  checkWrap.appendChild(checkbox);

  const main = document.createElement("div");
  const title = document.createElement("div");
  title.className = "item__title";

  const name = document.createElement("div");
  name.textContent = exp.title;
  name.style.fontWeight = "750";

  const badge = document.createElement("span");
  badge.className = "badge";
  badge.textContent = exp.category;

  title.appendChild(name);
  title.appendChild(badge);

  const meta = document.createElement("div");
  meta.className = "item__meta";
  const date = document.createElement("span");
  date.textContent = exp.date;
  meta.appendChild(date);

  if (exp.note) {
    const note = document.createElement("span");
    note.textContent = exp.note;
    meta.appendChild(note);
  }

  main.appendChild(title);
  main.appendChild(meta);

  const right = document.createElement("div");

  const amount = document.createElement("div");
  amount.className = "item__amount item__amount--neg";
  amount.textContent = `-${formatMoney(Number(exp.plannedAmount || 0))}`;

  const mini = document.createElement("div");
  mini.className = "mini";

  const kpiPlan = document.createElement("span");
  kpiPlan.className = "mini__kpi";
  kpiPlan.textContent = `Plan: ${formatMoney(Number(exp.plannedAmount || 0))}`;

  const kpiReal = document.createElement("span");
  kpiReal.className = "mini__kpi";
  kpiReal.textContent = `Real: ${formatMoney(Number(exp.actualAmount || 0))}`;

  const saving = Number(exp.plannedAmount || 0) - Number(exp.actualAmount || 0);
  const kpiSave = document.createElement("span");
  kpiSave.className = "mini__kpi";
  kpiSave.textContent = `Ahorro: ${formatMoney(saving)}`;

  mini.appendChild(kpiPlan);
  mini.appendChild(kpiReal);
  if (exp.done) mini.appendChild(kpiSave);

  const actions = document.createElement("div");
  actions.className = "item__actions";

  const editBtn = document.createElement("button");
  editBtn.className = "iconbtn";
  editBtn.type = "button";
  editBtn.textContent = "Editar";
  editBtn.addEventListener("click", () => editExpense(exp.id));

  const delBtn = document.createElement("button");
  delBtn.className = "iconbtn";
  delBtn.type = "button";
  delBtn.textContent = "Borrar";
  delBtn.addEventListener("click", () => confirmDeleteExpense(exp.id));

  actions.appendChild(editBtn);
  actions.appendChild(delBtn);

  right.appendChild(amount);
  right.appendChild(mini);
  right.appendChild(actions);

  row.appendChild(checkWrap);
  row.appendChild(main);
  row.appendChild(right);

  return row;
}

function addIncome({ date, amount, note }) {
  const entry = {
    id: uid(),
    date,
    amount,
    note: note ? String(note).trim() : "",
    createdAt: Date.now(),
  };
  state.incomes.unshift(entry);
  saveState();
  render();
}

function setInitialBalance(amount) {
  state.initialBalance = amount;
  state.incomes = [];
  saveState();
  render();
}

function addExpense({ date, plannedAmount, category, title, note, actualAmount, done, sourceBudgetId }) {
  const entry = {
    id: uid(),
    date,
    plannedAmount,
    actualAmount: Number(actualAmount || 0),
    category,
    title,
    note: note ? String(note).trim() : "",
    done: Boolean(done),
    sourceBudgetId: sourceBudgetId || null,
    createdAt: Date.now(),
  };
  state.expenses.unshift(entry);
  saveState();
  render();
}

function toggleExpenseDone(expenseId, done) {
  const idx = state.expenses.findIndex((x) => x.id === expenseId);
  if (idx === -1) return;

  const current = state.expenses[idx];
  const next = { ...current, done: Boolean(done) };
  if (next.done) {
    if (!(Number(next.actualAmount || 0) > 0)) {
      promptActualAmount(expenseId);
      return;
    }
  } else {
    next.actualAmount = 0;
  }

  state.expenses[idx] = next;
  saveState();
  render();
}

function editExpense(expenseId) {
  const exp = state.expenses.find((x) => x.id === expenseId);
  if (!exp) return;

  editingExpenseId = expenseId;

  ui.editDate.value = exp.date;
  ui.editPlanned.value = String(Number(exp.plannedAmount || 0));
  ui.editActual.value = exp.done ? String(Number(exp.actualAmount || 0)) : "";
  ui.editStatus.value = exp.done ? "done" : "pending";
  ui.editCategory.value = exp.category;
  ui.editTitle.value = exp.title;
  ui.editNote.value = exp.note || "";

  try {
    ui.editDialog.showModal();
  } catch {
    ui.editDialog.open = true;
  }
}

function closeEditDialog() {
  editingExpenseId = null;
  try {
    ui.editDialog.close();
  } catch {
    ui.editDialog.open = false;
  }
}

function saveEditFromDialog() {
  if (!editingExpenseId) return;
  const idx = state.expenses.findIndex((x) => x.id === editingExpenseId);
  if (idx === -1) {
    closeEditDialog();
    return;
  }

  const current = state.expenses[idx];

  const date = (ui.editDate.value || "").trim();
  const plannedAmount = parseAmount(ui.editPlanned.value);
  const status = ui.editStatus.value;
  const actualAmount = status === "done" ? parseAmount(ui.editActual.value) : 0;
  const category = (ui.editCategory.value || "").trim();
  const title = (ui.editTitle.value || "").trim();
  const note = (ui.editNote.value || "").trim();

  if (!date) return;
  if (!(plannedAmount > 0)) return;
  if (status === "done" && !(actualAmount >= 0)) return;
  if (!title) return;
  if (!category) return;

  state.expenses[idx] = {
    ...current,
    date,
    plannedAmount,
    actualAmount: status === "done" ? (actualAmount > 0 ? actualAmount : plannedAmount) : 0,
    category,
    title,
    note,
    done: status === "done",
  };

  saveState();
  closeEditDialog();
  render();
}

function deleteExpense(expenseId) {
  state.expenses = state.expenses.filter((x) => x.id !== expenseId);
  saveState();
  render();
}

function openConfirm({ title, text, okText }) {
  return new Promise((resolve) => {
    ui.confirmTitle.textContent = title;
    ui.confirmText.textContent = text;
    ui.confirmOk.textContent = okText || "Sí";

    const onCancel = () => {
      cleanup();
      resolve(false);
    };

    const onOk = () => {
      cleanup();
      resolve(true);
    };

    const cleanup = () => {
      ui.confirmCancel.removeEventListener("click", onCancel);
      ui.confirmOk.removeEventListener("click", onOk);
      ui.confirmDialog.removeEventListener("cancel", onCancel);
      try {
        ui.confirmDialog.close();
      } catch {
        ui.confirmDialog.open = false;
      }
    };

    ui.confirmCancel.addEventListener("click", onCancel);
    ui.confirmOk.addEventListener("click", onOk);
    ui.confirmDialog.addEventListener("cancel", onCancel);

    try {
      ui.confirmDialog.showModal();
    } catch {
      ui.confirmDialog.open = true;
    }
  });
}

async function confirmDeleteExpense(expenseId) {
  const exp = state.expenses.find((x) => x.id === expenseId);
  if (!exp) return;
  const ok = await openConfirm({
    title: "Borrar gasto",
    text: `¿Borrar "${exp.title}" (${formatMoney(exp.amount)})?`,
    okText: "Borrar",
  });
  if (!ok) return;
  deleteExpense(expenseId);
}

async function clearAll() {
  const ok = await openConfirm({
    title: "Borrar todo",
    text: "Esto elimina saldo inicial, ingresos y gastos guardados en este navegador.",
    okText: "Borrar todo",
  });
  if (!ok) return;
  state = {
    initialBalance: 0,
    incomes: [],
    expenses: [],
    budgets: [],
    ui: { filterDate: "" },
  };
  saveState();
  ui.filterDate.value = "";
  setDefaultDates();
  render();
}

function wireEvents() {
  ui.openIncomeBtn.addEventListener("click", () => {
    openDialog(ui.incomeDialog);
    ui.incomeAmount.focus();
  });

  ui.openExpenseBtn.addEventListener("click", () => {
    openDialog(ui.expenseDialog);
    ui.expenseTitle.focus();
  });

  ui.openHistoryBtn.addEventListener("click", () => {
    openDialog(ui.historyDialog);
  });

  ui.incomeCancel.addEventListener("click", () => {
    closeDialog(ui.incomeDialog);
  });

  ui.expenseCancel.addEventListener("click", () => {
    closeDialog(ui.expenseDialog);
  });

  ui.historyCancel.addEventListener("click", () => {
    closeDialog(ui.historyDialog);
  });

  ui.incomeDialog.addEventListener("cancel", (e) => {
    e.preventDefault();
    closeDialog(ui.incomeDialog);
  });

  ui.expenseDialog.addEventListener("cancel", (e) => {
    e.preventDefault();
    closeDialog(ui.expenseDialog);
  });

  ui.historyDialog.addEventListener("cancel", (e) => {
    e.preventDefault();
    closeDialog(ui.historyDialog);
  });

  ui.actualAmountCancel.addEventListener("click", () => {
    cancelActualAmountPrompt();
  });

  ui.actualAmountUsePlan.addEventListener("click", () => {
    if (!pendingActualExpenseId) return;
    const exp = state.expenses.find((x) => x.id === pendingActualExpenseId);
    if (!exp) return;
    ui.actualAmountInput.value = String(Number(exp.plannedAmount || 0));
    ui.actualAmountForm.requestSubmit();
  });

  ui.actualAmountDialog.addEventListener("cancel", (e) => {
    e.preventDefault();
    cancelActualAmountPrompt();
  });

  ui.actualAmountForm.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!pendingActualExpenseId) return;
    const amount = parseAmount(ui.actualAmountInput.value);
    const id = pendingActualExpenseId;
    pendingActualExpenseId = null;
    closeDialog(ui.actualAmountDialog);
    setExpenseDoneWithActual(id, amount);
  });

  ui.incomeForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const date = ui.incomeDate.value || todayISO();
    const amount = parseAmount(ui.incomeAmount.value);
    const note = ui.incomeNote.value;

    if (!(amount > 0)) return;

    addIncome({ date, amount, note });

    ui.incomeAmount.value = "";
    ui.incomeNote.value = "";
    ui.incomeAmount.focus();

    closeDialog(ui.incomeDialog);
  });

  ui.setInitialBalanceBtn.addEventListener("click", async () => {
    const amount = parseAmount(ui.incomeAmount.value);
    if (!(amount >= 0)) return;

    const ok = await openConfirm({
      title: "Establecer saldo inicial",
      text: "Esto reemplaza el saldo inicial y borra la lista de ingresos (los gastos se mantienen). ¿Continuar?",
      okText: "Establecer",
    });
    if (!ok) return;

    setInitialBalance(amount);
    ui.incomeAmount.value = "";
    ui.incomeNote.value = "";

    closeDialog(ui.incomeDialog);
  });

  ui.expenseForm.addEventListener("submit", (e) => {
    e.preventDefault();

    const date = ui.expenseDate.value || todayISO();
    const plannedAmount = parseAmount(ui.expenseAmount.value);
    const category = ui.expenseCategory.value;
    const title = ui.expenseTitle.value.trim();
    const note = ui.expenseNote.value;

    if (!title) return;
    if (!(plannedAmount > 0)) return;

    addExpense({ date, plannedAmount, category, title, note, actualAmount: 0, done: false, sourceBudgetId: null });

    ui.expenseAmount.value = "";
    ui.expenseTitle.value = "";
    ui.expenseNote.value = "";
    ui.expenseTitle.focus();

    closeDialog(ui.expenseDialog);
  });

  ui.budgetForm.addEventListener("submit", (e) => {
    e.preventDefault();

    const frequency = ui.budgetFrequency.value;
    const amount = parseAmount(ui.budgetAmount.value);
    const category = ui.budgetCategory.value;
    const title = ui.budgetTitle.value.trim();
    const days = getSelectedBudgetDays(ui.budgetDays);

    if (!title) return;
    if (!(amount > 0)) return;
    if (days.length === 0) return;

    addBudgetRule({ frequency, amount, category, title, days });

    ui.budgetAmount.value = "";
    ui.budgetTitle.value = "";
    ui.budgetTitle.focus();
  });

  ui.generateWeekBtn.addEventListener("click", () => {
    const base = parseISODate(ui.budgetBaseDate.value || todayISO());
    const start = startOfWeekMonday(base);
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
    generateForRange(start, end);
  });

  ui.generateMonthBtn.addEventListener("click", () => {
    const base = parseISODate(ui.budgetBaseDate.value || todayISO());
    const start = new Date(base.getFullYear(), base.getMonth(), 1);
    const end = new Date(base.getFullYear(), base.getMonth() + 1, 0);
    generateForRange(start, end);
  });

  ui.filterDate.addEventListener("change", () => {
    state.ui.filterDate = ui.filterDate.value || "";
    saveState();
    render();
  });

  ui.filterTodayBtn.addEventListener("click", () => {
    ui.filterDate.value = todayISO();
    state.ui.filterDate = ui.filterDate.value;
    saveState();
    render();
  });

  ui.filterAllBtn.addEventListener("click", () => {
    ui.filterDate.value = "";
    state.ui.filterDate = "";
    saveState();
    render();
  });

  ui.clearAllBtn.addEventListener("click", () => {
    clearAll();
  });

  ui.editCancel.addEventListener("click", () => {
    closeEditDialog();
  });

  ui.editDialog.addEventListener("cancel", (e) => {
    e.preventDefault();
    closeEditDialog();
  });

  ui.editForm.addEventListener("submit", (e) => {
    e.preventDefault();
    saveEditFromDialog();
  });
}

normalizeState();
setDefaultDates();
wireEvents();
render();
