"use client";

import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { get, ref, serverTimestamp, set } from "firebase/database";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  type BilleteraState,
  dateToISO,
  formatMoney,
  listExpenseDates,
  parseAmount,
  parseISODate,
  startOfWeekMonday,
  todayISO,
} from "@/lib/billetera";
import { firebaseAuth, firebaseDb, initFirebaseAnalytics } from "@/lib/firebaseClient";
import { useBilleteraState } from "@/lib/useBilleteraState";
import { useFirebaseAuth } from "@/lib/useFirebaseAuth";

export default function Home() {
  const { state, totals, actions } = useBilleteraState();
  const { user, loading: authLoading } = useFirebaseAuth();

  const [cloudReady, setCloudReady] = useState(false);
  const cloudWriteTimerRef = useRef<number | null>(null);
  const lastCloudWriteRef = useRef<string>("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);

  const [incomeOpen, setIncomeOpen] = useState(false);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [actualOpen, setActualOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const [confirmConfig, setConfirmConfig] = useState<{ title: string; text: string; okText: string } | null>(null);
  const confirmResolverRef = useRef<((ok: boolean) => void) | null>(null);

  const [pendingActualId, setPendingActualId] = useState<string | null>(null);
  const [actualAmountInput, setActualAmountInput] = useState<string>("");
  const [actualNoteInput, setActualNoteInput] = useState<string>("");

  const [editingId, setEditingId] = useState<string | null>(null);

  const [incomeDate, setIncomeDate] = useState(() => todayISO());
  const [incomeAmount, setIncomeAmount] = useState("");
  const [incomeNote, setIncomeNote] = useState("");

  const [expenseDate, setExpenseDate] = useState(() => todayISO());
  const [expensePlanned, setExpensePlanned] = useState("");
  const [expenseCategory, setExpenseCategory] = useState("Comida");
  const [expenseNote, setExpenseNote] = useState("");

  const [editDate, setEditDate] = useState("");
  const [editPlanned, setEditPlanned] = useState("");
  const [editActual, setEditActual] = useState("");
  const [editStatus, setEditStatus] = useState<"pending" | "done">("pending");
  const [editCategory, setEditCategory] = useState("Comida");
  const [editNote, setEditNote] = useState("");

  const [planOpen, setPlanOpen] = useState(false);
  const [planCadence, setPlanCadence] = useState<"daily" | "weekly" | "monthly">("daily");
  const [planAmount, setPlanAmount] = useState("");
  const [planCategory, setPlanCategory] = useState("Comida");
  const [planDays, setPlanDays] = useState<number[]>([]);
  const [planBaseDate, setPlanBaseDate] = useState(() => todayISO());
  const [editingPlanRuleId, setEditingPlanRuleId] = useState<string | null>(null);

  const [rangeOpen, setRangeOpen] = useState(false);

  const [rangeStart, setRangeStart] = useState(() => todayISO());
  const [rangeEnd, setRangeEnd] = useState(() => todayISO());

  useEffect(() => {
    initFirebaseAnalytics();
  }, []);

  useEffect(() => {
    setCloudReady(false);
    if (!user) return;
    const load = async () => {
      try {
        const p = ref(firebaseDb, `users/${user.uid}/billeteraState`);
        const snap = await get(p);
        if (snap.exists()) {
          actions.setAll(snap.val() as BilleteraState);
        }
      } finally {
        setCloudReady(true);
      }
    };
    void load();
  }, [actions, user]);

  useEffect(() => {
    if (!user) return;
    if (!cloudReady) return;
    if (cloudWriteTimerRef.current) window.clearTimeout(cloudWriteTimerRef.current);
    cloudWriteTimerRef.current = window.setTimeout(() => {
      const payload = JSON.stringify(state);
      if (payload === lastCloudWriteRef.current) return;
      lastCloudWriteRef.current = payload;
      const p = ref(firebaseDb, `users/${user.uid}/billeteraState`);
      void set(p, state);
    }, 1000);

    return () => {
      if (cloudWriteTimerRef.current) window.clearTimeout(cloudWriteTimerRef.current);
    };
  }, [cloudReady, state, user]);

  useEffect(() => {
    if (!user) return;
    const p = ref(firebaseDb, `presence_global/${user.uid}`);
    set(p, { state: "online", lastChanged: serverTimestamp() });
  }, [user]);

  const onSubmitAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthBusy(true);
    try {
      const normalizedEmail = (email || "").trim();
      const normalizedPassword = password || "";
      if (authMode === "register") {
        await createUserWithEmailAndPassword(firebaseAuth, normalizedEmail, normalizedPassword);
      } else {
        await signInWithEmailAndPassword(firebaseAuth, normalizedEmail, normalizedPassword);
      }
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "Error de autenticación");
    } finally {
      setAuthBusy(false);
    }
  };

  const onPickImportFile = () => {
    fileInputRef.current?.click();
  };

  const onImportBackupFile: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    setAuthError(null);
    try {
      if (!user) {
        setAuthError("Debes iniciar sesión para importar.");
        return;
      }
      const file = e.target.files?.[0];
      if (!file) return;
      const text = await file.text();
      const parsed = JSON.parse(text) as { version?: unknown; state?: unknown };
      if (!parsed || typeof parsed !== "object") throw new Error("JSON inválido");
      if (!parsed.state || typeof parsed.state !== "object") throw new Error("El JSON no contiene 'state'");

      actions.setAll(parsed.state as BilleteraState);
      const p = ref(firebaseDb, `users/${user.uid}/billeteraState`);
      await set(p, parsed.state);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "Error importando JSON");
    } finally {
      if (e.target) e.target.value = "";
    }
  };

  const onLogout = async () => {
    setAuthError(null);
    setAuthBusy(true);
    try {
      setCloudReady(false);
      if (user) {
        const p = ref(firebaseDb, `presence_global/${user.uid}`);
        await set(p, { state: "offline", lastChanged: serverTimestamp() });
      }
      await signOut(firebaseAuth);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "Error al cerrar sesión");
    } finally {
      setAuthBusy(false);
    }
  };

  const expenses = useMemo(() => {
    const filterDate = (state.ui.filterDate || "").trim();
    return state.expenses
      .filter((x) => (filterDate ? x.date === filterDate : true))
      .slice()
      .sort((a, b) => {
        if (a.date !== b.date) return a.date < b.date ? 1 : -1;
        return (b.createdAt || 0) - (a.createdAt || 0);
      });
  }, [state.expenses, state.ui.filterDate]);

  const existingDates = useMemo(() => {
    return listExpenseDates(state);
  }, [state]);

  const checklistDate = (state.ui.filterDate || "").trim() || todayISO();
  const dailyChecklist = useMemo(() => {
    return state.expenses
      .filter((x) => x.date === checklistDate)
      .slice()
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }, [state.expenses, checklistDate]);

  const rangeSummary = useMemo(() => {
    const start = (rangeStart || "").trim();
    const end = (rangeEnd || "").trim();
    if (!start || !end) return null;
    const a = parseISODate(start);
    const b = parseISODate(end);
    const startIso = dateToISO(a <= b ? a : b);
    const endIso = dateToISO(a <= b ? b : a);
    const items = state.expenses.filter((x) => x.date >= startIso && x.date <= endIso);

    const planned = items.reduce((acc, x) => acc + Number(x.plannedAmount || 0), 0);
    const actual = items.filter((x) => x.done).reduce((acc, x) => acc + Number(x.actualAmount || 0), 0);
    const savings = items
      .filter((x) => x.done)
      .reduce((acc, x) => acc + (Number(x.plannedAmount || 0) - Number(x.actualAmount || 0)), 0);

    const byCategory = new Map<string, { planned: number; actual: number }>();
    for (const it of items) {
      const key = it.category || "Otros";
      const prev = byCategory.get(key) || { planned: 0, actual: 0 };
      prev.planned += Number(it.plannedAmount || 0);
      if (it.done) prev.actual += Number(it.actualAmount || 0);
      byCategory.set(key, prev);
    }

    const categories = Array.from(byCategory.entries())
      .map(([category, v]) => ({ category, planned: v.planned, actual: v.actual }))
      .sort((x, y) => y.actual - x.actual);

    return { startIso, endIso, count: items.length, planned, actual, savings, categories };
  }, [rangeStart, rangeEnd, state.expenses]);

  const openConfirm = (cfg: { title: string; text: string; okText?: string }) => {
    return new Promise<boolean>((resolve) => {
      setConfirmConfig({ title: cfg.title, text: cfg.text, okText: cfg.okText || "Sí" });
      confirmResolverRef.current = resolve;
      setConfirmOpen(true);
    });
  };

  const resetPlanForm = () => {
    setPlanCadence("daily");
    setPlanAmount("");
    setPlanCategory("Comida");
    setPlanDays([]);
    setEditingPlanRuleId(null);
  };

  const onEditPlanRule = (ruleId: string) => {
    const rule = state.planRules.find((x) => x.id === ruleId);
    if (!rule) return;
    setEditingPlanRuleId(rule.id);
    setPlanCadence(rule.cadence);
    setPlanAmount(String(rule.amount ?? ""));
    setPlanCategory(rule.category);
    setPlanDays(Array.isArray(rule.days) ? rule.days : []);
  };

  const setWeeklyPreset = (preset: "lv" | "all" | "weekend") => {
    if (preset === "lv") return setPlanDays([1, 2, 3, 4, 5]);
    if (preset === "weekend") return setPlanDays([0, 6]);
    return setPlanDays([0, 1, 2, 3, 4, 5, 6]);
  };

  const setMonthlyPreset = (preset: "first" | "fifteenth" | "firstAndFifteenth" | "allDays") => {
    if (preset === "first") return setPlanDays([1]);
    if (preset === "fifteenth") return setPlanDays([15]);
    if (preset === "firstAndFifteenth") return setPlanDays([1, 15]);
    return setPlanDays(Array.from({ length: 31 }, (_, i) => i + 1));
  };

  const onSubmitPlanRule = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseAmount(planAmount);
    const title = (planCategory || "").trim() || "Otros";
    const days = Array.isArray(planDays) ? planDays : [];

    if (amount <= 0) return;
    if (planCadence !== "daily" && (!Array.isArray(days) || days.length === 0)) return;

    if (editingPlanRuleId) {
      actions.updatePlanRule(editingPlanRuleId, { cadence: planCadence, amount, category: planCategory, title, days });
    } else {
      actions.addPlanRule({ cadence: planCadence, amount, category: planCategory, title, days });
    }
    resetPlanForm();
    setPlanOpen(false);
  };

  const onDeletePlanRule = async (ruleId: string) => {
    const rule = state.planRules.find((x) => x.id === ruleId);
    if (!rule) return;
    const ok = await openConfirm({
      title: "Borrar regla",
      text: `¿Borrar "${rule.title}"?`,
      okText: "Borrar",
    });
    if (!ok) return;
    actions.deletePlanRule(ruleId);
  };

  const generateForToday = () => {
    const base = (planBaseDate || "").trim() || todayISO();
    actions.generatePlannedForDate(base);
    actions.setFilterDate(base);
  };

  const generateForWeek = () => {
    const base = (planBaseDate || "").trim() || todayISO();
    actions.generatePlannedForWeek(base);
    actions.setFilterDate(base);
  };

  const generateForMonth = () => {
    const base = (planBaseDate || "").trim() || todayISO();
    actions.generatePlannedForMonth(base);
    actions.setFilterDate(base);
  };

  const closeConfirm = (ok: boolean) => {
    setConfirmOpen(false);
    const r = confirmResolverRef.current;
    confirmResolverRef.current = null;
    setConfirmConfig(null);
    r?.(ok);
  };

  const requestActualAmount = (expenseId: string) => {
    const exp = state.expenses.find((x) => x.id === expenseId);
    if (!exp) return;
    setPendingActualId(expenseId);
    setActualAmountInput(String(Number(exp.plannedAmount || 0)));
    setActualNoteInput(String(exp.note || ""));
    setActualOpen(true);
  };

  const onToggleDone = (expenseId: string, done: boolean) => {
    const exp = state.expenses.find((x) => x.id === expenseId);
    if (!exp) return;
    if (done) {
      if (!(Number(exp.actualAmount || 0) > 0)) {
        requestActualAmount(expenseId);
        return;
      }
      actions.markExpenseDone(expenseId, Number(exp.actualAmount || 0));
      return;
    }
    actions.markExpensePending(expenseId);
  };

  const onSubmitIncome = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseAmount(incomeAmount);
    if (!(amount > 0)) return;
    actions.addIncome({ date: incomeDate || todayISO(), amount, note: incomeNote });
    setIncomeAmount("");
    setIncomeNote("");
    setIncomeOpen(false);
  };

  const onSetInitialBalance = async () => {
    const amount = parseAmount(incomeAmount);
    if (!(amount >= 0)) return;
    const ok = await openConfirm({
      title: "Establecer saldo inicial",
      text: "Esto reemplaza el saldo inicial y borra la lista de ingresos (los gastos se mantienen). ¿Continuar?",
      okText: "Establecer",
    });
    if (!ok) return;
    actions.setInitialBalance(amount);
    setIncomeAmount("");
    setIncomeNote("");
    setIncomeOpen(false);
  };

  const onSubmitExpense = (e: React.FormEvent) => {
    e.preventDefault();
    const plannedAmount = parseAmount(expensePlanned);
    if (!(plannedAmount > 0)) return;
    actions.addExpense({
      date: expenseDate || todayISO(),
      plannedAmount,
      category: expenseCategory,
      title: (expenseCategory || "").trim() || "Otros",
      note: expenseNote,
    });
    setExpensePlanned("");
    setExpenseNote("");
    setExpenseOpen(false);
  };

  const onSubmitActual = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingActualId) return;
    const amount = parseAmount(actualAmountInput);
    const id = pendingActualId;
    const note = (actualNoteInput || "").trim();
    setPendingActualId(null);
    setActualOpen(false);
    actions.updateExpense(id, { note });
    actions.markExpenseDone(id, amount);
  };

  const onUsePlanForActual = () => {
    if (!pendingActualId) return;
    const exp = state.expenses.find((x) => x.id === pendingActualId);
    if (!exp) return;
    setActualAmountInput(String(Number(exp.plannedAmount || 0)));
  };

  const openEditExpense = (expenseId: string) => {
    const exp = state.expenses.find((x) => x.id === expenseId);
    if (!exp) return;
    setEditingId(expenseId);
    setEditDate(exp.date);
    setEditPlanned(String(Number(exp.plannedAmount || 0)));
    setEditActual(exp.done ? String(Number(exp.actualAmount || 0)) : "");
    setEditStatus(exp.done ? "done" : "pending");
    setEditCategory(exp.category);
    setEditNote(exp.note || "");
    setEditOpen(true);
  };

  const onSubmitEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId) return;

    const date = (editDate || "").trim();
    const plannedAmount = parseAmount(editPlanned);
    const actualAmount = editStatus === "done" ? parseAmount(editActual) : 0;
    const category = (editCategory || "").trim();
    const title = category || "Otros";
    const note = (editNote || "").trim();

    if (!date) return;
    if (!(plannedAmount > 0)) return;
    if (!category) return;

    actions.updateExpense(editingId, {
      date,
      plannedAmount,
      actualAmount: editStatus === "done" ? (actualAmount > 0 ? actualAmount : plannedAmount) : 0,
      category,
      title,
      note,
      done: editStatus === "done",
    });

    setEditOpen(false);
    setEditingId(null);
  };

  const onDeleteExpense = async (expenseId: string) => {
    const exp = state.expenses.find((x) => x.id === expenseId);
    if (!exp) return;
    const ok = await openConfirm({
      title: "Borrar gasto",
      text: `¿Borrar "${exp.title}" (${formatMoney(Number(exp.plannedAmount || 0))})?`,
      okText: "Borrar",
    });
    if (!ok) return;
    actions.deleteExpense(expenseId);
  };

  const onClearAll = async () => {
    const ok = await openConfirm({
      title: "Borrar todo",
      text: "Esto elimina saldo inicial, ingresos y gastos guardados en este navegador.",
      okText: "Borrar todo",
    });
    if (!ok) return;
    actions.clearAll();
    actions.setFilterDate("");
  };

  const filterToday = () => actions.setFilterDate(todayISO());
  const filterAll = () => actions.setFilterDate("");

  const setRangePresetWeek = () => {
    const base = parseISODate((rangeStart || "").trim() || todayISO());
    const start = startOfWeekMonday(base);
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
    setRangeStart(dateToISO(start));
    setRangeEnd(dateToISO(end));
  };

  const setRangePresetMonth = () => {
    const base = parseISODate((rangeStart || "").trim() || todayISO());
    const start = new Date(base.getFullYear(), base.getMonth(), 1);
    const end = new Date(base.getFullYear(), base.getMonth() + 1, 0);
    setRangeStart(dateToISO(start));
    setRangeEnd(dateToISO(end));
  };

  return (
    <div className="min-h-dvh bg-zinc-950 text-zinc-100">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(900px_circle_at_20%_10%,rgba(99,102,241,0.14),transparent_55%),radial-gradient(900px_circle_at_80%_20%,rgba(16,185,129,0.10),transparent_55%),radial-gradient(900px_circle_at_50%_100%,rgba(244,63,94,0.06),transparent_60%)]" />
      <main className="relative mx-auto flex w-full max-w-5xl flex-col gap-4 p-3 pb-24 sm:p-4 sm:pb-4">
        {!authLoading && !user ? (
          <section className="grid min-h-[70dvh] place-items-center">
            <div className="w-full max-w-md rounded-2xl border border-white/10 bg-zinc-900/60 p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur">
              <div className="text-sm font-medium">Acceso</div>
              <div className="mt-1 text-sm text-zinc-400">
                {authMode === "register" ? "Crea tu cuenta para guardar datos con seguridad." : "Inicia sesión para usar la app con seguridad."}
              </div>

              <form className="mt-4 grid gap-2" onSubmit={onSubmitAuth}>
                <input
                  type="email"
                  className="rounded-xl border border-white/10 bg-zinc-950/50 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:ring-2 focus:ring-indigo-500/50"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
                <input
                  type="password"
                  className="rounded-xl border border-white/10 bg-zinc-950/50 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:ring-2 focus:ring-indigo-500/50"
                  placeholder="Contraseña"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={authMode === "register" ? "new-password" : "current-password"}
                  required
                />

                {authError ? <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-sm text-rose-200">{authError}</div> : null}

                <button
                  type="submit"
                  className="rounded-xl bg-indigo-500 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-400 disabled:opacity-60"
                  disabled={authBusy}
                >
                  {authMode === "register" ? "Crear cuenta" : "Entrar"}
                </button>

                <button
                  type="button"
                  className="rounded-xl bg-zinc-950/40 px-3 py-2 text-sm font-semibold text-zinc-100 shadow-sm ring-1 ring-white/10 hover:bg-zinc-950/70"
                  onClick={() => {
                    setAuthMode((m) => (m === "login" ? "register" : "login"));
                    setAuthError(null);
                  }}
                  disabled={authBusy}
                >
                  {authMode === "register" ? "Ya tengo cuenta" : "Crear cuenta"}
                </button>
              </form>
            </div>
          </section>
        ) : null}

        {!authLoading && user ? (
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm text-zinc-400">Sesión: {user.email || user.uid}</div>
            <button
              type="button"
              className="rounded-xl bg-zinc-950/40 px-3 py-2 text-sm font-semibold text-zinc-100 shadow-sm ring-1 ring-white/10 hover:bg-zinc-950/70 disabled:opacity-60"
              onClick={onLogout}
              disabled={authBusy}
            >
              Cerrar sesión
            </button>
          </div>
        ) : null}

        {!authLoading && user ? (
          <div className="flex flex-wrap items-center gap-2">
            <input ref={fileInputRef} type="file" accept="application/json" className="hidden" onChange={onImportBackupFile} />
            <button
              type="button"
              className="rounded-xl bg-zinc-950/40 px-3 py-2 text-sm font-semibold text-zinc-100 shadow-sm ring-1 ring-white/10 hover:bg-zinc-950/70"
              onClick={onPickImportFile}
            >
              Importar JSON
            </button>
            <div className="text-xs text-zinc-400">
              {cloudReady ? "Sincronización Firebase: activa" : "Sincronización Firebase: cargando…"}
            </div>
          </div>
        ) : null}

        {authLoading ? <div className="text-sm text-zinc-400">Cargando sesión…</div> : null}

        {!authLoading && !user ? null : (
        <>
        <header className="grid gap-3 md:grid-cols-12">
          <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur md:col-span-5">
            <div className="text-sm text-zinc-400">Saldo</div>
            <div className="mt-1 text-3xl font-semibold tracking-tight">{formatMoney(totals.balance)}</div>
            <div className="mt-2 text-sm text-zinc-400">Ahorro (gastos hechos): {formatMoney(totals.savingsDone)}</div>
            <div className="mt-4 hidden flex-wrap gap-2 md:flex">
              <button
                type="button"
                className="rounded-xl bg-indigo-500 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-400"
                onClick={() => setIncomeOpen(true)}
              >
                + Ingreso / Saldo
              </button>
              <button
                type="button"
                className="rounded-xl bg-zinc-900/60 px-3 py-2 text-sm font-semibold text-zinc-100 shadow-sm ring-1 ring-white/10 hover:bg-zinc-900"
                onClick={() => setExpenseOpen(true)}
              >
                + Gasto
              </button>
              <button
                type="button"
                className="rounded-xl bg-zinc-900/60 px-3 py-2 text-sm font-semibold text-zinc-100 shadow-sm ring-1 ring-white/10 hover:bg-zinc-900"
                onClick={() => setHistoryOpen(true)}
              >
                Historial
              </button>
              <button
                type="button"
                className="rounded-xl bg-zinc-900/60 px-3 py-2 text-sm font-semibold text-zinc-100 shadow-sm ring-1 ring-white/10 hover:bg-zinc-900"
                onClick={() => setRangeOpen(true)}
              >
                Resumen
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 md:col-span-7 md:grid-cols-4">
            <div className="rounded-2xl border border-white/10 bg-zinc-900/40 p-4 shadow-sm">
              <div className="text-sm text-zinc-400">Ingresos</div>
              <div className="mt-1 text-xl font-semibold">{formatMoney(totals.incomesTotal)}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-zinc-900/40 p-4 shadow-sm">
              <div className="text-sm text-zinc-400">Gastos hechos</div>
              <div className="mt-1 text-xl font-semibold">{formatMoney(totals.expenseDone)}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-zinc-900/40 p-4 shadow-sm">
              <div className="text-sm text-zinc-400">Ahorro</div>
              <div className="mt-1 text-xl font-semibold">{formatMoney(totals.savingsDone)}</div>
            </div>
          </div>
        </header>

        <section className="grid gap-4">
          <div className="rounded-2xl border border-white/10 bg-zinc-900/50 p-4 shadow-sm backdrop-blur">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-sm font-medium">Gastos</div>
                <div className="text-sm text-zinc-400">Marca como hecho para registrar el monto real.</div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="date"
                  className="rounded-xl border border-white/10 bg-zinc-950/50 px-3 py-2 text-sm text-zinc-100 outline-none focus:ring-2 focus:ring-indigo-500/50"
                  value={state.ui.filterDate || ""}
                  onChange={(e) => actions.setFilterDate(e.target.value)}
                />
                <button
                  type="button"
                  className="rounded-xl bg-zinc-950/40 px-3 py-2 text-sm font-semibold text-zinc-100 shadow-sm ring-1 ring-white/10 hover:bg-zinc-950/70"
                  onClick={filterToday}
                >
                  Hoy
                </button>
                <button
                  type="button"
                  className="rounded-xl bg-zinc-950/40 px-3 py-2 text-sm font-semibold text-zinc-100 shadow-sm ring-1 ring-white/10 hover:bg-zinc-950/70"
                  onClick={filterAll}
                >
                  Todos
                </button>
              </div>
            </div>

            <div className="app-scroll mt-3 max-h-[420px] overflow-auto pr-1">
              {expenses.length === 0 ? (
                <div className="rounded-xl border border-white/10 bg-zinc-950/30 p-4 text-sm text-zinc-300">No hay gastos para este filtro.</div>
              ) : (
                <div className="flex flex-col gap-2">
                  {expenses.map((exp) => {
                    const saving = Number(exp.plannedAmount || 0) - Number(exp.actualAmount || 0);
                    return (
                      <div
                        key={exp.id}
                        className={`grid grid-cols-[28px_1fr_auto] items-start gap-3 rounded-2xl border p-3 ${
                          exp.done
                            ? "border-emerald-500/30 bg-emerald-500/10"
                            : "border-white/10 bg-zinc-950/20"
                        }`}
                      >
                        <div className="pt-1">
                          <input
                            type="checkbox"
                            checked={Boolean(exp.done)}
                            onChange={(e) => onToggleDone(exp.id, e.target.checked)}
                            className="h-4 w-4 accent-emerald-400"
                          />
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="font-semibold">{exp.category}</div>
                            <span className="rounded-full bg-white/5 px-2 py-0.5 text-xs text-zinc-200 ring-1 ring-white/10">
                              {exp.category}
                            </span>
                          </div>
                          <div className="mt-1 text-xs text-zinc-400">
                            {exp.date}
                            {exp.note ? ` · ${exp.note}` : ""}
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2 text-xs text-zinc-200">
                            <span className="rounded-lg bg-white/5 px-2 py-1 ring-1 ring-white/10">Plan: {formatMoney(Number(exp.plannedAmount || 0))}</span>
                            <span className="rounded-lg bg-white/5 px-2 py-1 ring-1 ring-white/10">Real: {formatMoney(Number(exp.actualAmount || 0))}</span>
                            {exp.done ? (
                              <span className="rounded-lg bg-white/5 px-2 py-1 ring-1 ring-white/10">Ahorro: {formatMoney(saving)}</span>
                            ) : null}
                          </div>
                        </div>
                        <div className="flex flex-col gap-2">
                          <div className="text-right text-sm font-semibold text-zinc-100">
                            -{formatMoney(Number(exp.plannedAmount || 0))}
                          </div>
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              className="rounded-xl bg-zinc-950/40 px-3 py-1.5 text-xs font-semibold text-zinc-100 shadow-sm ring-1 ring-white/10 hover:bg-zinc-950/70"
                              onClick={() => openEditExpense(exp.id)}
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              className="rounded-xl bg-zinc-950/40 px-3 py-1.5 text-xs font-semibold text-zinc-100 shadow-sm ring-1 ring-white/10 hover:bg-rose-500/15 hover:ring-rose-400/20"
                              onClick={() => onDeleteExpense(exp.id)}
                            >
                              Borrar
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="mt-4 flex items-center justify-between gap-3">
              <div className="text-sm text-zinc-400">Acciones</div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-xl bg-zinc-950/40 px-3 py-2 text-sm font-semibold text-zinc-100 shadow-sm ring-1 ring-white/10 hover:bg-zinc-950/70"
                  onClick={() => setPlanOpen(true)}
                >
                  Planificación
                </button>
                <button
                  type="button"
                  className="rounded-xl bg-rose-500 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-rose-400"
                  onClick={onClearAll}
                >
                  Borrar todo
                </button>
              </div>
            </div>
          </div>
        </section>
        </>
        )}
      </main>

      {!authLoading && user ? (
        <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-zinc-950/80 backdrop-blur md:hidden">
          <div className="mx-auto grid w-full max-w-5xl grid-cols-5 gap-2 p-2">
            <button
              type="button"
              className="rounded-xl bg-indigo-500 px-2 py-3 text-xs font-semibold text-white shadow-sm hover:bg-indigo-400"
              onClick={() => setIncomeOpen(true)}
            >
              Ingreso
            </button>
            <button
              type="button"
              className="rounded-xl bg-zinc-900/60 px-2 py-3 text-xs font-semibold text-zinc-100 shadow-sm ring-1 ring-white/10 hover:bg-zinc-900"
              onClick={() => setExpenseOpen(true)}
            >
              Gasto
            </button>
            <button
              type="button"
              className="rounded-xl bg-zinc-900/60 px-2 py-3 text-xs font-semibold text-zinc-100 shadow-sm ring-1 ring-white/10 hover:bg-zinc-900"
              onClick={() => setPlanOpen(true)}
            >
              Plan
            </button>
            <button
              type="button"
              className="rounded-xl bg-zinc-900/60 px-2 py-3 text-xs font-semibold text-zinc-100 shadow-sm ring-1 ring-white/10 hover:bg-zinc-900"
              onClick={() => setHistoryOpen(true)}
            >
              Historial
            </button>
            <button
              type="button"
              className="rounded-xl bg-zinc-900/60 px-2 py-3 text-xs font-semibold text-zinc-100 shadow-sm ring-1 ring-white/10 hover:bg-zinc-900"
              onClick={() => setRangeOpen(true)}
            >
              Resumen
            </button>
          </div>
        </nav>
      ) : null}

      {planOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-0 sm:p-4" onMouseDown={() => setPlanOpen(false)}>
          <div
            className="h-[100dvh] w-full overflow-auto rounded-none border border-white/10 bg-zinc-900/90 p-4 shadow-2xl backdrop-blur sm:h-auto sm:max-w-2xl sm:rounded-2xl"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-medium">Planificación</div>
                <div className="text-sm text-zinc-300">Crea reglas y genera gastos automáticamente.</div>
              </div>
              <button
                type="button"
                className="rounded-xl bg-zinc-950/40 px-3 py-2 text-sm font-semibold text-zinc-100 shadow-sm ring-1 ring-white/10 hover:bg-zinc-950/70"
                onClick={() => {
                  resetPlanForm();
                  setPlanOpen(false);
                }}
              >
                Cerrar
              </button>
            </div>

            <div className="mt-4 grid gap-4">
              <div className="rounded-2xl border border-white/10 bg-zinc-950/20 p-3">
                <div className="text-sm font-medium">Checklist</div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <input
                    type="date"
                    className="rounded-xl border border-white/10 bg-zinc-950/50 px-3 py-2 text-sm text-zinc-100 outline-none focus:ring-2 focus:ring-emerald-500/40"
                    value={checklistDate}
                    onChange={(e) => actions.setFilterDate(e.target.value)}
                  />
                  <button
                    type="button"
                    className="rounded-xl bg-emerald-500 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-400"
                    onClick={generateForToday}
                  >
                    Generar
                  </button>
                </div>
                <div className="app-scroll mt-3 max-h-[260px] overflow-auto pr-1">
                  {dailyChecklist.length === 0 ? (
                    <div className="rounded-xl border border-white/10 bg-zinc-950/20 p-3 text-sm text-zinc-300">No hay gastos.</div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {dailyChecklist.map((exp) => (
                        <div
                          key={exp.id}
                          className={`grid grid-cols-[28px_1fr_auto] items-center gap-3 rounded-2xl border p-3 ${
                            exp.done
                              ? "border-emerald-500/30 bg-emerald-500/10"
                              : "border-white/10 bg-zinc-950/20"
                          }`}
                        >
                          <div className="pt-1">
                            <input
                              type="checkbox"
                              checked={Boolean(exp.done)}
                              onChange={(e) => onToggleDone(exp.id, e.target.checked)}
                              className="h-4 w-4 accent-emerald-400"
                            />
                          </div>
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="font-semibold">{exp.category}</div>
                              <span className="rounded-full bg-white/5 px-2 py-0.5 text-xs text-zinc-200 ring-1 ring-white/10">
                                {exp.category}
                              </span>
                            </div>
                            <div className="mt-1 text-xs text-zinc-400">Plan: {formatMoney(Number(exp.plannedAmount || 0))}</div>
                          </div>
                          <div className="text-right text-sm font-semibold text-zinc-100">-{formatMoney(Number(exp.plannedAmount || 0))}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-zinc-950/20 p-3">
                <div className="text-sm font-medium">Generar</div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <input
                    type="date"
                    className="rounded-xl border border-white/10 bg-zinc-950/50 px-3 py-2 text-sm text-zinc-100 outline-none focus:ring-2 focus:ring-emerald-500/40"
                    value={planBaseDate}
                    onChange={(e) => setPlanBaseDate(e.target.value)}
                  />
                  <button
                    type="button"
                    className="rounded-xl bg-emerald-500 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-400"
                    onClick={generateForToday}
                  >
                    Hoy
                  </button>
                  <button
                    type="button"
                    className="rounded-xl bg-emerald-500 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-400"
                    onClick={generateForWeek}
                  >
                    Semana
                  </button>
                  <button
                    type="button"
                    className="rounded-xl bg-emerald-500 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-400"
                    onClick={generateForMonth}
                  >
                    Mes
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-zinc-950/20 p-3">
                <div className="text-sm font-medium">{editingPlanRuleId ? "Editar regla" : "Nueva regla"}</div>
                <form className="mt-3 grid gap-2" onSubmit={onSubmitPlanRule}>
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      className="rounded-xl border border-white/10 bg-zinc-950/50 px-3 py-2 text-sm text-zinc-100 outline-none focus:ring-2 focus:ring-indigo-500/50"
                      value={planCadence}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                        const next = e.target.value as ("daily" | "weekly" | "monthly");
                        setPlanCadence(next);
                        setPlanDays([]);
                      }}
                    >
                      <option value="daily">Diario</option>
                      <option value="weekly">Semanal</option>
                      <option value="monthly">Mensual</option>
                    </select>
                    <input
                      inputMode="decimal"
                      className="rounded-xl border border-white/10 bg-zinc-950/50 px-3 py-2 text-sm text-zinc-100 outline-none focus:ring-2 focus:ring-indigo-500/50"
                      placeholder="Monto"
                      value={planAmount}
                      onChange={(e) => setPlanAmount(e.target.value)}
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-2">
                    <select
                      className="rounded-xl border border-white/10 bg-zinc-950/50 px-3 py-2 text-sm text-zinc-100 outline-none focus:ring-2 focus:ring-indigo-500/50"
                      value={planCategory}
                      onChange={(e) => setPlanCategory(e.target.value)}
                    >
                      <option value="Comida">Comida</option>
                      <option value="Transporte">Transporte</option>
                      <option value="Casa">Casa</option>
                      <option value="Salud">Salud</option>
                      <option value="Otros">Otros</option>
                    </select>
                  </div>

                  {planCadence === "weekly" ? (
                    <div className="mt-1 flex flex-wrap gap-2">
                      <button
                        type="button"
                        className={`rounded-xl px-3 py-2 text-sm font-semibold shadow-sm ring-1 ring-white/10 hover:bg-zinc-950/70 ${
                          planDays.join(",") === "1,2,3,4,5" ? "bg-indigo-500 text-white" : "bg-zinc-950/40 text-zinc-100"
                        }`}
                        onClick={() => setWeeklyPreset("lv")}
                      >
                        L-V
                      </button>
                      <button
                        type="button"
                        className={`rounded-xl px-3 py-2 text-sm font-semibold shadow-sm ring-1 ring-white/10 hover:bg-zinc-950/70 ${
                          planDays.join(",") === "0,6" ? "bg-indigo-500 text-white" : "bg-zinc-950/40 text-zinc-100"
                        }`}
                        onClick={() => setWeeklyPreset("weekend")}
                      >
                        S-D
                      </button>
                      <button
                        type="button"
                        className={`rounded-xl px-3 py-2 text-sm font-semibold shadow-sm ring-1 ring-white/10 hover:bg-zinc-950/70 ${
                          planDays.length === 7 ? "bg-indigo-500 text-white" : "bg-zinc-950/40 text-zinc-100"
                        }`}
                        onClick={() => setWeeklyPreset("all")}
                      >
                        Todos
                      </button>
                      <div className="text-xs text-zinc-400 self-center">(Para semanal, elige un preset.)</div>
                    </div>
                  ) : null}

                  {planCadence === "monthly" ? (
                    <div className="mt-1 flex flex-wrap gap-2">
                      <button
                        type="button"
                        className={`rounded-xl px-3 py-2 text-sm font-semibold shadow-sm ring-1 ring-white/10 hover:bg-zinc-950/70 ${
                          planDays.join(",") === "1" ? "bg-indigo-500 text-white" : "bg-zinc-950/40 text-zinc-100"
                        }`}
                        onClick={() => setMonthlyPreset("first")}
                      >
                        Día 1
                      </button>
                      <button
                        type="button"
                        className={`rounded-xl px-3 py-2 text-sm font-semibold shadow-sm ring-1 ring-white/10 hover:bg-zinc-950/70 ${
                          planDays.join(",") === "15" ? "bg-indigo-500 text-white" : "bg-zinc-950/40 text-zinc-100"
                        }`}
                        onClick={() => setMonthlyPreset("fifteenth")}
                      >
                        Día 15
                      </button>
                      <button
                        type="button"
                        className={`rounded-xl px-3 py-2 text-sm font-semibold shadow-sm ring-1 ring-white/10 hover:bg-zinc-950/70 ${
                          planDays.join(",") === "1,15" ? "bg-indigo-500 text-white" : "bg-zinc-950/40 text-zinc-100"
                        }`}
                        onClick={() => setMonthlyPreset("firstAndFifteenth")}
                      >
                        1 y 15
                      </button>
                      <button
                        type="button"
                        className={`rounded-xl px-3 py-2 text-sm font-semibold shadow-sm ring-1 ring-white/10 hover:bg-zinc-950/70 ${
                          planDays.length === 31 ? "bg-indigo-500 text-white" : "bg-zinc-950/40 text-zinc-100"
                        }`}
                        onClick={() => setMonthlyPreset("allDays")}
                      >
                        Todos los días
                      </button>
                    </div>
                  ) : null}

                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      className="rounded-xl bg-zinc-950/40 px-3 py-2 text-sm font-semibold text-zinc-100 shadow-sm ring-1 ring-white/10 hover:bg-zinc-950/70"
                      onClick={() => {
                        resetPlanForm();
                        setPlanOpen(false);
                      }}
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="rounded-xl bg-indigo-500 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-400"
                    >
                      {editingPlanRuleId ? "Guardar cambios" : "Guardar regla"}
                    </button>
                  </div>
                </form>
              </div>

              <div className="rounded-2xl border border-white/10 bg-zinc-950/20 p-3">
                <div className="text-sm font-medium">Reglas</div>
                <div className="mt-3 grid gap-2">
                  {state.planRules.length === 0 ? (
                    <div className="rounded-xl border border-white/10 bg-zinc-950/20 p-3 text-sm text-zinc-300">Aún no hay reglas.</div>
                  ) : (
                    state.planRules.map((r) => (
                      <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/10 bg-zinc-950/20 p-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="font-semibold">{r.title}</div>
                            <span className="rounded-full bg-white/5 px-2 py-0.5 text-xs text-zinc-200 ring-1 ring-white/10">{r.category}</span>
                            <span className="rounded-full bg-white/5 px-2 py-0.5 text-xs text-zinc-200 ring-1 ring-white/10">{r.cadence}</span>
                          </div>
                          <div className="mt-1 text-xs text-zinc-400">Plan: {formatMoney(Number(r.amount || 0))}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            className="rounded-xl bg-zinc-950/40 px-3 py-2 text-sm font-semibold text-zinc-100 shadow-sm ring-1 ring-white/10 hover:bg-indigo-500/15 hover:ring-indigo-400/20"
                            onClick={() => onEditPlanRule(r.id)}
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            className="rounded-xl bg-zinc-950/40 px-3 py-2 text-sm font-semibold text-zinc-100 shadow-sm ring-1 ring-white/10 hover:bg-rose-500/15 hover:ring-rose-400/20"
                            onClick={() => onDeletePlanRule(r.id)}
                          >
                            Borrar
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {rangeOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-0 sm:p-4" onMouseDown={() => setRangeOpen(false)}>
          <div
            className="h-[100dvh] w-full overflow-auto rounded-none border border-white/10 bg-zinc-900/90 p-4 shadow-2xl backdrop-blur sm:h-auto sm:max-w-4xl sm:rounded-2xl"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-medium">Resumen por fechas</div>
                <div className="text-sm text-zinc-300">Elige un rango para ver plan vs real.</div>
              </div>
              <button
                type="button"
                className="rounded-xl bg-zinc-950/40 px-3 py-2 text-sm font-semibold text-zinc-100 shadow-sm ring-1 ring-white/10 hover:bg-zinc-950/70"
                onClick={() => setRangeOpen(false)}
              >
                Cerrar
              </button>
            </div>

            <datalist id="expense-dates-range">
              {existingDates.map((d) => (
                <option key={d} value={d} />
              ))}
            </datalist>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
              <div className="grid w-full gap-2 md:w-auto md:grid-cols-2">
                <input
                  type="date"
                  list="expense-dates-range"
                  className="rounded-xl border border-white/10 bg-zinc-950/50 px-3 py-2 text-sm text-zinc-100 outline-none focus:ring-2 focus:ring-indigo-500/50"
                  value={rangeStart}
                  onChange={(e) => setRangeStart(e.target.value)}
                />
                <input
                  type="date"
                  list="expense-dates-range"
                  className="rounded-xl border border-white/10 bg-zinc-950/50 px-3 py-2 text-sm text-zinc-100 outline-none focus:ring-2 focus:ring-indigo-500/50"
                  value={rangeEnd}
                  onChange={(e) => setRangeEnd(e.target.value)}
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-xl bg-zinc-950/40 px-3 py-2 text-sm font-semibold text-zinc-100 shadow-sm ring-1 ring-white/10 hover:bg-zinc-950/70"
                  onClick={setRangePresetWeek}
                >
                  Semana
                </button>
                <button
                  type="button"
                  className="rounded-xl bg-zinc-950/40 px-3 py-2 text-sm font-semibold text-zinc-100 shadow-sm ring-1 ring-white/10 hover:bg-zinc-950/70"
                  onClick={setRangePresetMonth}
                >
                  Mes
                </button>
              </div>
            </div>

            <div className="app-scroll mt-4 max-h-[70vh] overflow-auto pr-1">
              {rangeSummary ? (
                <div className="grid gap-3">
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    <div className="rounded-2xl border border-white/10 bg-zinc-950/20 p-3">
                      <div className="text-xs text-zinc-400">Rango</div>
                      <div className="mt-1 text-sm font-semibold">
                        {rangeSummary.startIso} → {rangeSummary.endIso}
                      </div>
                      <div className="mt-1 text-xs text-zinc-400">{rangeSummary.count} gastos</div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-zinc-950/20 p-3">
                      <div className="text-xs text-zinc-400">Plan</div>
                      <div className="mt-1 text-sm font-semibold">{formatMoney(rangeSummary.planned)}</div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-zinc-950/20 p-3">
                      <div className="text-xs text-zinc-400">Real (hechos)</div>
                      <div className="mt-1 text-sm font-semibold">{formatMoney(rangeSummary.actual)}</div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-zinc-950/20 p-3">
                      <div className="text-xs text-zinc-400">Ahorro</div>
                      <div className="mt-1 text-sm font-semibold">{formatMoney(rangeSummary.savings)}</div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-zinc-950/20 p-3">
                    <div className="text-sm font-medium">Por categoría</div>
                    <div className="mt-2 grid gap-2 md:grid-cols-2">
                      {rangeSummary.categories.length === 0 ? (
                        <div className="text-sm text-zinc-300">Sin datos.</div>
                      ) : (
                        rangeSummary.categories.map((c) => (
                          <div
                            key={c.category}
                            className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-zinc-950/20 px-3 py-2"
                          >
                            <div className="text-sm font-semibold">{c.category}</div>
                            <div className="text-xs text-zinc-300">
                              Real: {formatMoney(c.actual)} · Plan: {formatMoney(c.planned)}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-white/10 bg-zinc-950/20 p-3 text-sm text-zinc-300">Selecciona un rango válido.</div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {incomeOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-0 sm:p-4" onMouseDown={() => setIncomeOpen(false)}>
          <div
            className="h-[100dvh] w-full overflow-auto rounded-none border border-white/10 bg-zinc-900/90 p-4 shadow-2xl backdrop-blur sm:h-auto sm:max-w-lg sm:rounded-2xl"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="text-sm font-medium">Ingreso</div>
            <div className="mt-1 text-sm text-zinc-300">
              Saldo actual: {formatMoney(totals.balance)} · Puedes agregar un ingreso o establecer un saldo inicial.
            </div>
            <form className="mt-3 grid gap-2" onSubmit={onSubmitIncome}>
              <input
                type="date"
                className="rounded-xl border border-white/10 bg-zinc-950/50 px-3 py-2 text-sm text-zinc-100 outline-none focus:ring-2 focus:ring-indigo-500/50"
                value={incomeDate}
                onChange={(e) => setIncomeDate(e.target.value)}
              />
              <input
                inputMode="decimal"
                className="rounded-xl border border-white/10 bg-zinc-950/50 px-3 py-2 text-sm text-zinc-100 outline-none focus:ring-2 focus:ring-indigo-500/50"
                placeholder="Monto"
                value={incomeAmount}
                onChange={(e) => setIncomeAmount(e.target.value)}
              />
              <input
                className="rounded-xl border border-white/10 bg-zinc-950/50 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:ring-2 focus:ring-indigo-500/50"
                placeholder="Nota (opcional)"
                value={incomeNote}
                onChange={(e) => setIncomeNote(e.target.value)}
              />
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className="rounded-xl bg-zinc-950/40 px-3 py-2 text-sm font-semibold text-zinc-100 shadow-sm ring-1 ring-white/10 hover:bg-zinc-950/70"
                  onClick={() => setIncomeOpen(false)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-indigo-500 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-400"
                >
                  Guardar ingreso
                </button>
              </div>
              <button
                type="button"
                className="rounded-xl bg-zinc-950/40 px-3 py-2 text-sm font-semibold text-zinc-100 shadow-sm ring-1 ring-white/10 hover:bg-zinc-950/70"
                onClick={onSetInitialBalance}
              >
                Establecer saldo inicial
              </button>
            </form>
          </div>
        </div>
      ) : null}

      {expenseOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-0 sm:p-4" onMouseDown={() => setExpenseOpen(false)}>
          <div
            className="h-[100dvh] w-full overflow-auto rounded-none border border-white/10 bg-zinc-900/90 p-4 shadow-2xl backdrop-blur sm:h-auto sm:max-w-lg sm:rounded-2xl"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="text-sm font-medium">Gasto</div>
            <form className="mt-3 grid gap-2" onSubmit={onSubmitExpense}>
              <input
                type="date"
                className="rounded-xl border border-white/10 bg-zinc-950/50 px-3 py-2 text-sm text-zinc-100 outline-none focus:ring-2 focus:ring-indigo-500/50"
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
              />
              <input
                inputMode="decimal"
                className="rounded-xl border border-white/10 bg-zinc-950/50 px-3 py-2 text-sm text-zinc-100 outline-none focus:ring-2 focus:ring-indigo-500/50"
                placeholder="Monto planificado"
                value={expensePlanned}
                onChange={(e) => setExpensePlanned(e.target.value)}
              />
              <select
                className="rounded-xl border border-white/10 bg-zinc-950/50 px-3 py-2 text-sm text-zinc-100 outline-none focus:ring-2 focus:ring-indigo-500/50"
                value={expenseCategory}
                onChange={(e) => setExpenseCategory(e.target.value)}
              >
                <option value="Comida">Comida</option>
                <option value="Transporte">Transporte</option>
                <option value="Casa">Casa</option>
                <option value="Salud">Salud</option>
                <option value="Otros">Otros</option>
              </select>
              <input
                className="rounded-xl border border-white/10 bg-zinc-950/50 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:ring-2 focus:ring-indigo-500/50"
                placeholder="Nota (opcional)"
                value={expenseNote}
                onChange={(e) => setExpenseNote(e.target.value)}
              />
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className="rounded-xl bg-zinc-950/40 px-3 py-2 text-sm font-semibold text-zinc-100 shadow-sm ring-1 ring-white/10 hover:bg-zinc-950/70"
                  onClick={() => setExpenseOpen(false)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-emerald-500 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-400"
                >
                  Guardar gasto
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {historyOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-0 sm:p-4" onMouseDown={() => setHistoryOpen(false)}>
          <div
            className="h-[100dvh] w-full overflow-auto rounded-none border border-white/10 bg-zinc-900/90 p-4 shadow-2xl backdrop-blur sm:h-auto sm:max-w-4xl sm:rounded-2xl"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium">Historial</div>
                <div className="text-sm text-zinc-300">Lista de gastos con el filtro actual.</div>
              </div>
              <button
                type="button"
                className="rounded-xl bg-zinc-950/40 px-3 py-2 text-sm font-semibold text-zinc-100 shadow-sm ring-1 ring-white/10 hover:bg-zinc-950/70"
                onClick={() => setHistoryOpen(false)}
              >
                Cerrar
              </button>
            </div>
            <div className="app-scroll mt-3 max-h-[70vh] overflow-auto pr-1">
              {expenses.length === 0 ? (
                <div className="rounded-xl border border-white/10 bg-zinc-950/30 p-4 text-sm text-zinc-300">No hay gastos para este filtro.</div>
              ) : (
                <div className="flex flex-col gap-2">
                  {expenses.map((exp) => (
                    <div key={exp.id} className="rounded-2xl border border-white/10 bg-zinc-950/20 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="font-semibold">{exp.category}</div>
                          <span className="rounded-full bg-white/5 px-2 py-0.5 text-xs text-zinc-200 ring-1 ring-white/10">
                            {exp.category}
                          </span>
                          <span className="text-xs text-zinc-400">{exp.date}</span>
                        </div>
                        <div className="text-sm font-semibold">-{formatMoney(Number(exp.plannedAmount || 0))}</div>
                      </div>
                      <div className="mt-1 text-xs text-zinc-400">
                        Estado: {exp.done ? "Hecho" : "Pendiente"} · Real: {formatMoney(Number(exp.actualAmount || 0))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {actualOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-0 sm:p-4" onMouseDown={() => setActualOpen(false)}>
          <div
            className="h-[100dvh] w-full overflow-auto rounded-none border border-white/10 bg-zinc-900/90 p-4 shadow-2xl backdrop-blur sm:h-auto sm:max-w-lg sm:rounded-2xl"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="text-sm font-medium">Confirmar gasto</div>
            <div className="mt-1 text-sm text-zinc-300">
              {(() => {
                const exp = pendingActualId ? state.expenses.find((x) => x.id === pendingActualId) : null;
                if (!exp) return "";
                return `${exp.category} (${exp.date}) · Plan: ${formatMoney(Number(exp.plannedAmount || 0))}`;
              })()}
            </div>
            <form className="mt-3 grid gap-2" onSubmit={onSubmitActual}>
              <input
                inputMode="decimal"
                className="rounded-xl border border-white/10 bg-zinc-950/50 px-3 py-2 text-sm text-zinc-100 outline-none focus:ring-2 focus:ring-emerald-500/40"
                placeholder="Monto real"
                value={actualAmountInput}
                onChange={(e) => setActualAmountInput(e.target.value)}
              />
              <input
                className="rounded-xl border border-white/10 bg-zinc-950/50 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:ring-2 focus:ring-emerald-500/40"
                placeholder="Nota (opcional)"
                value={actualNoteInput}
                onChange={(e) => setActualNoteInput(e.target.value)}
              />
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className="rounded-xl bg-zinc-950/40 px-3 py-2 text-sm font-semibold text-zinc-100 shadow-sm ring-1 ring-white/10 hover:bg-zinc-950/70"
                  onClick={onUsePlanForActual}
                >
                  Usar plan
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-emerald-500 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-400"
                >
                  Confirmar
                </button>
              </div>
              <button
                type="button"
                className="rounded-xl bg-zinc-950/40 px-3 py-2 text-sm font-semibold text-zinc-100 shadow-sm ring-1 ring-white/10 hover:bg-zinc-950/70"
                onClick={() => {
                  setPendingActualId(null);
                  setActualOpen(false);
                }}
              >
                Cancelar
              </button>
            </form>
          </div>
        </div>
      ) : null}

      {editOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-0 sm:p-4" onMouseDown={() => setEditOpen(false)}>
          <div
            className="h-[100dvh] w-full overflow-auto rounded-none border border-white/10 bg-zinc-900/90 p-4 shadow-2xl backdrop-blur sm:h-auto sm:max-w-2xl sm:rounded-2xl"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="text-sm font-medium">Editar gasto</div>
            <form className="mt-3 grid gap-2" onSubmit={onSubmitEdit}>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  className="rounded-xl border border-white/10 bg-zinc-950/50 px-3 py-2 text-sm text-zinc-100 outline-none focus:ring-2 focus:ring-indigo-500/50"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                />
                <select
                  className="rounded-xl border border-white/10 bg-zinc-950/50 px-3 py-2 text-sm text-zinc-100 outline-none focus:ring-2 focus:ring-indigo-500/50"
                  value={editStatus}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                    setEditStatus(e.target.value as ("pending" | "done"))
                  }
                >
                  <option value="pending">Pendiente</option>
                  <option value="done">Hecho</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  inputMode="decimal"
                  className="rounded-xl border border-white/10 bg-zinc-950/50 px-3 py-2 text-sm text-zinc-100 outline-none focus:ring-2 focus:ring-indigo-500/50"
                  placeholder="Monto plan"
                  value={editPlanned}
                  onChange={(e) => setEditPlanned(e.target.value)}
                />
                <input
                  inputMode="decimal"
                  className="rounded-xl border border-white/10 bg-zinc-950/50 px-3 py-2 text-sm text-zinc-100 outline-none focus:ring-2 focus:ring-indigo-500/50"
                  placeholder="Monto real"
                  value={editActual}
                  onChange={(e) => setEditActual(e.target.value)}
                  disabled={editStatus !== "done"}
                />
              </div>
              <div className="grid grid-cols-1 gap-2">
                <select
                  className="rounded-xl border border-white/10 bg-zinc-950/50 px-3 py-2 text-sm text-zinc-100 outline-none focus:ring-2 focus:ring-indigo-500/50"
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                >
                  <option value="Comida">Comida</option>
                  <option value="Transporte">Transporte</option>
                  <option value="Casa">Casa</option>
                  <option value="Salud">Salud</option>
                  <option value="Otros">Otros</option>
                </select>
              </div>
              <input
                className="rounded-xl border border-white/10 bg-zinc-950/50 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:ring-2 focus:ring-indigo-500/50"
                placeholder="Nota"
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
              />
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className="rounded-xl bg-zinc-950/40 px-3 py-2 text-sm font-semibold text-zinc-100 shadow-sm ring-1 ring-white/10 hover:bg-zinc-950/70"
                  onClick={() => {
                    setEditOpen(false);
                    setEditingId(null);
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-indigo-500 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-400"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {confirmOpen && confirmConfig ? (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black/60 p-4" onMouseDown={() => closeConfirm(false)}>
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-zinc-900/90 p-4 shadow-2xl backdrop-blur" onMouseDown={(e) => e.stopPropagation()}>
            <div className="text-sm font-medium">{confirmConfig.title}</div>
            <div className="mt-2 text-sm text-zinc-300">{confirmConfig.text}</div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                className="rounded-xl bg-zinc-950/40 px-3 py-2 text-sm font-semibold text-zinc-100 shadow-sm ring-1 ring-white/10 hover:bg-zinc-950/70"
                onClick={() => closeConfirm(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="rounded-xl bg-indigo-500 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-400"
                onClick={() => closeConfirm(true)}
              >
                {confirmConfig.okText}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
