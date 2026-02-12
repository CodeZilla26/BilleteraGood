export const STORAGE_KEY = "billetera.v1";

export type Frequency = "weekly" | "monthly";

export type PlanCadence = "daily" | "weekly" | "monthly";

export type Income = {
  id: string;
  date: string;
  amount: number;
  note: string;
  createdAt: number;
};

export type Expense = {
  id: string;
  date: string;
  plannedAmount: number;
  actualAmount: number;
  category: string;
  title: string;
  note: string;
  done: boolean;
  sourceBudgetId: string | null;
  createdAt: number;
};

export type BudgetRule = {
  id: string;
  frequency: Frequency;
  amount: number;
  category: string;
  title: string;
  days: number[];
  createdAt: number;
};

export type PlanRule = {
  id: string;
  cadence: PlanCadence;
  amount: number;
  category: string;
  title: string;
  days: number[];
  createdAt: number;
};

export type TransportEventType = "recharge" | "trip";

export type TransportEvent = {
  id: string;
  type: TransportEventType;
  date: string;
  amount: number;
  note: string;
  createdAt: number;
};

export type TransportState = {
  balance: number;
  events: TransportEvent[];
};

export type BilleteraState = {
  initialBalance: number;
  incomes: Income[];
  expenses: Expense[];
  budgets: BudgetRule[];
  planRules: PlanRule[];
  transport: TransportState;
  ui: {
    filterDate: string;
  };
};

export type Totals = {
  incomesTotal: number;
  expenseDone: number;
  expensePending: number;
  savingsDone: number;
  balance: number;
};

export function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function uid() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function parseISODate(iso: string) {
  const [y, m, d] = String(iso || "")
    .split("-")
    .map((x) => Number(x));
  return new Date(y, (m || 1) - 1, d || 1);
}

export function dateToISO(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function startOfWeekMonday(base: Date) {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  const day = d.getDay();
  const diff = (day + 6) % 7;
  d.setDate(d.getDate() - diff);
  return d;
}

export function formatMoney(n: number) {
  const value = Number.isFinite(n) ? n : 0;
  try {
    return new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency: "PEN",
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    const sign = value < 0 ? "-" : "";
    return `${sign}S/${Math.abs(value).toFixed(2)}`;
  }
}

export function parseAmount(raw: unknown) {
  const n = Number(raw);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

export function defaultState(): BilleteraState {
  return {
    initialBalance: 0,
    incomes: [],
    expenses: [],
    budgets: [],
    planRules: [],
    transport: {
      balance: 0,
      events: [],
    },
    ui: { filterDate: "" },
  };
}

export function normalizeState(input: BilleteraState): { state: BilleteraState; changed: boolean } {
  let changed = false;

  const transportRaw = (input as unknown as { transport?: unknown }).transport;
  const transportObj = transportRaw && typeof transportRaw === "object" ? (transportRaw as Record<string, unknown>) : null;
  const transportEventsRaw = transportObj && Array.isArray(transportObj.events) ? (transportObj.events as unknown[]) : [];
  const transportBalanceRaw = transportObj ? Number(transportObj.balance || 0) : 0;

  const next: BilleteraState = {
    ...defaultState(),
    ...input,
    initialBalance: Number(input.initialBalance || 0),
    incomes: Array.isArray(input.incomes) ? input.incomes : [],
    expenses: Array.isArray(input.expenses) ? input.expenses : [],
    budgets: Array.isArray(input.budgets) ? input.budgets : [],
    planRules: Array.isArray((input as unknown as { planRules?: unknown }).planRules)
      ? ((input as unknown as { planRules: PlanRule[] }).planRules as PlanRule[])
      : [],
    transport: {
      balance: transportBalanceRaw,
      events: transportEventsRaw as TransportEvent[],
    },
    ui: {
      filterDate: input.ui && typeof input.ui.filterDate === "string" ? input.ui.filterDate : "",
    },
  };

  next.expenses = next.expenses.map((x) => {
    const rec = (x && typeof x === "object" ? (x as Record<string, unknown>) : {}) as Record<string, unknown>;
    const hasPlanned = Object.prototype.hasOwnProperty.call(rec, "plannedAmount");
    const hasActual = Object.prototype.hasOwnProperty.call(rec, "actualAmount");
    const hasLegacyAmount = Object.prototype.hasOwnProperty.call(rec, "amount");
    if (hasPlanned && hasActual) return x;

    const plannedAmount = hasPlanned
      ? Number((rec.plannedAmount as unknown) || 0)
      : Number(hasLegacyAmount ? (rec.amount as unknown) || 0 : 0);
    const actualAmount = hasActual ? Number((rec.actualAmount as unknown) || 0) : (Boolean((rec.done as unknown) || false) ? plannedAmount : 0);

    const migrated: Record<string, unknown> = {
      ...rec,
      plannedAmount,
      actualAmount,
    };
    if (hasLegacyAmount) delete migrated.amount;
    changed = true;
    return migrated as unknown as Expense;
  });

  if (!Array.isArray(input.budgets)) changed = true;
  if (!Array.isArray((input as unknown as { planRules?: unknown }).planRules)) changed = true;
  if (!Array.isArray(input.incomes)) changed = true;
  if (!Array.isArray(input.expenses)) changed = true;
  if (!(transportRaw && typeof transportRaw === "object")) changed = true;

  return { state: next, changed };
}

export function addTransportRecharge(
  state: BilleteraState,
  input: { date: string; amount: number; note?: string }
): BilleteraState {
  const amount = Number(input.amount || 0);
  const date = input.date;

  const nextState = addExpense(state, {
    date,
    plannedAmount: amount,
    actualAmount: amount,
    done: true,
    category: "Transporte",
    title: "Transporte",
    note: input.note ? String(input.note).trim() : "",
    sourceBudgetId: null,
  });

  const ev: TransportEvent = {
    id: uid(),
    type: "recharge",
    date,
    amount,
    note: input.note ? String(input.note).trim() : "",
    createdAt: Date.now(),
  };

  return {
    ...nextState,
    transport: {
      balance: Number(nextState.transport.balance || 0) + amount,
      events: [ev, ...(Array.isArray(nextState.transport.events) ? nextState.transport.events : [])],
    },
  };
}

export function addTransportTrip(
  state: BilleteraState,
  input: { date: string; amount: number; note?: string }
): BilleteraState {
  const amount = Number(input.amount || 0);
  const date = input.date;
  const prevBal = Number(state.transport?.balance || 0);

  const ev: TransportEvent = {
    id: uid(),
    type: "trip",
    date,
    amount,
    note: input.note ? String(input.note).trim() : "",
    createdAt: Date.now(),
  };

  return {
    ...state,
    transport: {
      balance: prevBal - amount,
      events: [ev, ...(Array.isArray(state.transport?.events) ? state.transport.events : [])],
    },
  };
}

export function loadStateFromStorage(storageKey = STORAGE_KEY): BilleteraState {
  if (typeof window === "undefined") return defaultState();
  const raw = window.localStorage.getItem(storageKey);
  if (!raw) return defaultState();

  try {
    const parsed = JSON.parse(raw) as BilleteraState;
    const { state } = normalizeState(parsed);
    return state;
  } catch {
    return defaultState();
  }
}

export function saveStateToStorage(state: BilleteraState, storageKey = STORAGE_KEY) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey, JSON.stringify(state));
}

export function computeTotals(state: BilleteraState): Totals {
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

export function isBrowser() {
  return typeof window !== "undefined";
}

export function addIncome(state: BilleteraState, input: { date: string; amount: number; note?: string }): BilleteraState {
  const entry: Income = {
    id: uid(),
    date: input.date,
    amount: Number(input.amount || 0),
    note: input.note ? String(input.note).trim() : "",
    createdAt: Date.now(),
  };
  return {
    ...state,
    incomes: [entry, ...state.incomes],
  };
}

export function addExpense(
  state: BilleteraState,
  input: {
    date: string;
    plannedAmount: number;
    category: string;
    title: string;
    note?: string;
    actualAmount?: number;
    done?: boolean;
    sourceBudgetId?: string | null;
  }
): BilleteraState {
  const entry: Expense = {
    id: uid(),
    date: input.date,
    plannedAmount: Number(input.plannedAmount || 0),
    actualAmount: Number(input.actualAmount || 0),
    category: input.category,
    title: input.title,
    note: input.note ? String(input.note).trim() : "",
    done: Boolean(input.done),
    sourceBudgetId: input.sourceBudgetId ?? null,
    createdAt: Date.now(),
  };
  return {
    ...state,
    expenses: [entry, ...state.expenses],
  };
}

export function deleteExpense(state: BilleteraState, expenseId: string): BilleteraState {
  return {
    ...state,
    expenses: state.expenses.filter((x) => x.id !== expenseId),
  };
}

export function updateExpense(state: BilleteraState, expenseId: string, patch: Partial<Expense>): BilleteraState {
  const idx = state.expenses.findIndex((x) => x.id === expenseId);
  if (idx === -1) return state;
  const next = state.expenses.slice();
  next[idx] = {
    ...next[idx],
    ...patch,
  };
  return {
    ...state,
    expenses: next,
  };
}

export function setExpenseDoneWithActual(state: BilleteraState, expenseId: string, actualAmount: number): BilleteraState {
  return updateExpense(state, expenseId, { done: true, actualAmount: Number(actualAmount || 0) });
}

export function setExpensePending(state: BilleteraState, expenseId: string): BilleteraState {
  return updateExpense(state, expenseId, { done: false, actualAmount: 0 });
}

export function addPlanRule(
  state: BilleteraState,
  input: { cadence: PlanCadence; amount: number; category: string; title: string; days: number[] }
): BilleteraState {
  const rule: PlanRule = {
    id: uid(),
    cadence: input.cadence,
    amount: Number(input.amount || 0),
    category: input.category,
    title: input.title,
    days: Array.isArray(input.days) ? input.days : [],
    createdAt: Date.now(),
  };
  return {
    ...state,
    planRules: [rule, ...state.planRules],
  };
}

export function deletePlanRule(state: BilleteraState, ruleId: string): BilleteraState {
  return {
    ...state,
    planRules: state.planRules.filter((x) => x.id !== ruleId),
  };
}

export function updatePlanRule(
  state: BilleteraState,
  ruleId: string,
  patch: Partial<Pick<PlanRule, "cadence" | "amount" | "category" | "title" | "days">>
): BilleteraState {
  const idx = state.planRules.findIndex((x) => x.id === ruleId);
  if (idx === -1) return state;

  const next = state.planRules.slice();
  const prev = next[idx];
  const cadence = patch.cadence ?? prev.cadence;
  const days = Array.isArray(patch.days) ? patch.days : prev.days;

  next[idx] = {
    ...prev,
    cadence,
    amount: patch.amount !== undefined ? Number(patch.amount || 0) : prev.amount,
    category: patch.category !== undefined ? patch.category : prev.category,
    title: patch.title !== undefined ? patch.title : prev.title,
    days: cadence === "daily" ? [] : days,
  };

  return {
    ...state,
    planRules: next,
  };
}

function shouldGenerateForDate(rule: PlanRule, date: Date) {
  if (rule.cadence === "daily") return true;
  if (!Array.isArray(rule.days) || rule.days.length === 0) return false;
  if (rule.cadence === "weekly") {
    return rule.days.includes(date.getDay());
  }
  const dom = date.getDate();
  return rule.days.includes(dom);
}

export function generateFromPlanForRange(state: BilleteraState, startDate: Date, endDate: Date): BilleteraState {
  const rules = Array.isArray(state.planRules) ? state.planRules : [];
  const existingKeys = new Set(
    state.expenses
      .filter((x) => x.sourceBudgetId)
      .map((x) => `${x.sourceBudgetId}|${x.date}`)
  );

  let nextState = state;
  const cursor = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  while (cursor <= endDate) {
    const iso = dateToISO(cursor);
    for (const r of rules) {
      if (!shouldGenerateForDate(r, cursor)) continue;
      const key = `${r.id}|${iso}`;
      if (existingKeys.has(key)) continue;
      existingKeys.add(key);
      nextState = addExpense(nextState, {
        date: iso,
        plannedAmount: Number(r.amount || 0),
        category: r.category,
        title: r.title,
        note: "",
        actualAmount: 0,
        done: false,
        sourceBudgetId: r.id,
      });
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return nextState;
}

export function generateFromPlanForDate(state: BilleteraState, isoDate: string): BilleteraState {
  const d = parseISODate(isoDate);
  return generateFromPlanForRange(state, d, d);
}

export function listExpenseDates(state: BilleteraState): string[] {
  const set = new Set(state.expenses.map((x) => x.date).filter(Boolean));
  return Array.from(set).sort((a, b) => (a < b ? 1 : -1));
}

export function addBudgetRule(
  state: BilleteraState,
  input: { frequency: Frequency; amount: number; category: string; title: string; days: number[] }
): BilleteraState {
  const rule: BudgetRule = {
    id: uid(),
    frequency: input.frequency,
    amount: Number(input.amount || 0),
    category: input.category,
    title: input.title,
    days: Array.isArray(input.days) ? input.days : [],
    createdAt: Date.now(),
  };
  return {
    ...state,
    budgets: [rule, ...state.budgets],
  };
}

export function deleteBudgetRule(state: BilleteraState, ruleId: string): BilleteraState {
  return {
    ...state,
    budgets: state.budgets.filter((x) => x.id !== ruleId),
  };
}

export function generateForRange(state: BilleteraState, startDate: Date, endDate: Date): BilleteraState {
  const rules = Array.isArray(state.budgets) ? state.budgets : [];
  const existingKeys = new Set(
    state.expenses
      .filter((x) => x.sourceBudgetId)
      .map((x) => `${x.sourceBudgetId}|${x.date}`)
  );

  let nextState = state;
  const cursor = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  while (cursor <= endDate) {
    const dow = cursor.getDay();
    const iso = dateToISO(cursor);

    for (const r of rules) {
      if (!Array.isArray(r.days) || r.days.length === 0) continue;
      if (!r.days.includes(dow)) continue;

      const key = `${r.id}|${iso}`;
      if (existingKeys.has(key)) continue;

      existingKeys.add(key);
      nextState = addExpense(nextState, {
        date: iso,
        plannedAmount: Number(r.amount || 0),
        category: r.category,
        title: r.title,
        note: "",
        actualAmount: 0,
        done: false,
        sourceBudgetId: r.id,
      });
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  return nextState;
}
