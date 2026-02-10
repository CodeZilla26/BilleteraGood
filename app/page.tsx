"use client";

import { useMemo, useRef, useState } from "react";
import {
  formatMoney,
  parseAmount,
  todayISO,
} from "@/lib/billetera";
import { useBilleteraState } from "@/lib/useBilleteraState";

export default function Home() {
  const { state, totals, actions } = useBilleteraState();

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

  const [editingId, setEditingId] = useState<string | null>(null);

  const [incomeDate, setIncomeDate] = useState(() => todayISO());
  const [incomeAmount, setIncomeAmount] = useState("");
  const [incomeNote, setIncomeNote] = useState("");

  const [expenseDate, setExpenseDate] = useState(() => todayISO());
  const [expensePlanned, setExpensePlanned] = useState("");
  const [expenseCategory, setExpenseCategory] = useState("Comida");
  const [expenseTitle, setExpenseTitle] = useState("");
  const [expenseNote, setExpenseNote] = useState("");

  const [editDate, setEditDate] = useState("");
  const [editPlanned, setEditPlanned] = useState("");
  const [editActual, setEditActual] = useState("");
  const [editStatus, setEditStatus] = useState<"pending" | "done">("pending");
  const [editCategory, setEditCategory] = useState("Comida");
  const [editTitle, setEditTitle] = useState("");
  const [editNote, setEditNote] = useState("");

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

  const openConfirm = (cfg: { title: string; text: string; okText?: string }) => {
    return new Promise<boolean>((resolve) => {
      setConfirmConfig({ title: cfg.title, text: cfg.text, okText: cfg.okText || "Sí" });
      confirmResolverRef.current = resolve;
      setConfirmOpen(true);
    });
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
    if (!expenseTitle.trim()) return;
    if (!(plannedAmount > 0)) return;
    actions.addExpense({
      date: expenseDate || todayISO(),
      plannedAmount,
      category: expenseCategory,
      title: expenseTitle.trim(),
      note: expenseNote,
    });
    setExpensePlanned("");
    setExpenseTitle("");
    setExpenseNote("");
    setExpenseOpen(false);
  };

  const onSubmitActual = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingActualId) return;
    const amount = parseAmount(actualAmountInput);
    const id = pendingActualId;
    setPendingActualId(null);
    setActualOpen(false);
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
    setEditTitle(exp.title);
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
    const title = (editTitle || "").trim();
    const note = (editNote || "").trim();

    if (!date) return;
    if (!(plannedAmount > 0)) return;
    if (!title) return;
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

  return (
    <div className="min-h-dvh bg-zinc-950 text-zinc-100">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(900px_circle_at_20%_10%,rgba(99,102,241,0.14),transparent_55%),radial-gradient(900px_circle_at_80%_20%,rgba(16,185,129,0.10),transparent_55%),radial-gradient(900px_circle_at_50%_100%,rgba(244,63,94,0.06),transparent_60%)]" />
      <main className="relative mx-auto flex w-full max-w-5xl flex-col gap-4 p-4">
        <header className="grid gap-3 md:grid-cols-12">
          <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur md:col-span-5">
            <div className="text-sm text-zinc-400">Saldo</div>
            <div className="mt-1 text-3xl font-semibold tracking-tight">{formatMoney(totals.balance)}</div>
            <div className="mt-2 text-sm text-zinc-400">Ahorro (gastos hechos): {formatMoney(totals.savingsDone)}</div>
            <div className="mt-4 flex flex-wrap gap-2">
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

            <div className="mt-3 max-h-[420px] overflow-auto pr-1">
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
                            <div className="font-semibold">{exp.title}</div>
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
              <button
                type="button"
                className="rounded-xl bg-rose-500 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-rose-400"
                onClick={onClearAll}
              >
                Borrar todo
              </button>
            </div>
          </div>
        </section>
      </main>

      {incomeOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onMouseDown={() => setIncomeOpen(false)}>
          <div
            className="w-full max-w-lg rounded-2xl border border-white/10 bg-zinc-900/90 p-4 shadow-2xl backdrop-blur"
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
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onMouseDown={() => setExpenseOpen(false)}>
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-zinc-900/90 p-4 shadow-2xl backdrop-blur" onMouseDown={(e) => e.stopPropagation()}>
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
                placeholder="Título"
                value={expenseTitle}
                onChange={(e) => setExpenseTitle(e.target.value)}
              />
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
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onMouseDown={() => setHistoryOpen(false)}>
          <div
            className="w-full max-w-4xl rounded-2xl border border-white/10 bg-zinc-900/90 p-4 shadow-2xl backdrop-blur"
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
            <div className="mt-3 max-h-[70vh] overflow-auto pr-1">
              {expenses.length === 0 ? (
                <div className="rounded-xl border border-white/10 bg-zinc-950/30 p-4 text-sm text-zinc-300">No hay gastos para este filtro.</div>
              ) : (
                <div className="flex flex-col gap-2">
                  {expenses.map((exp) => (
                    <div key={exp.id} className="rounded-2xl border border-white/10 bg-zinc-950/20 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="font-semibold">{exp.title}</div>
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
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onMouseDown={() => setActualOpen(false)}>
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-zinc-900/90 p-4 shadow-2xl backdrop-blur" onMouseDown={(e) => e.stopPropagation()}>
            <div className="text-sm font-medium">Confirmar gasto</div>
            <div className="mt-1 text-sm text-zinc-300">
              {(() => {
                const exp = pendingActualId ? state.expenses.find((x) => x.id === pendingActualId) : null;
                if (!exp) return "";
                return `${exp.title} (${exp.date}) · Plan: ${formatMoney(Number(exp.plannedAmount || 0))}`;
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
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onMouseDown={() => setEditOpen(false)}>
          <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-zinc-900/90 p-4 shadow-2xl backdrop-blur" onMouseDown={(e) => e.stopPropagation()}>
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
              <div className="grid grid-cols-2 gap-2">
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
                <input
                  className="rounded-xl border border-white/10 bg-zinc-950/50 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:ring-2 focus:ring-indigo-500/50"
                  placeholder="Título"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                />
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
