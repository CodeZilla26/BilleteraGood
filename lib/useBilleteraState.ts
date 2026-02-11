"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  BilleteraState,
  Expense,
  PlanCadence,
  STORAGE_KEY,
  Totals,
  addExpense,
  addIncome,
  addPlanRule,
  computeTotals,
  defaultState,
  deletePlanRule,
  deleteExpense,
  updatePlanRule,
  generateFromPlanForDate,
  generateFromPlanForRange,
  loadStateFromStorage,
  normalizeState,
  parseISODate,
  saveStateToStorage,
  setExpenseDoneWithActual,
  setExpensePending,
  startOfWeekMonday,
  updateExpense,
} from "@/lib/billetera";

export type BilleteraActions = {
  setAll: (next: BilleteraState) => void;
  clearAll: () => void;
  setInitialBalance: (amount: number) => void;
  setFilterDate: (iso: string) => void;

  addIncome: (input: { date: string; amount: number; note?: string }) => void;
  addExpense: (input: {
    date: string;
    plannedAmount: number;
    category: string;
    title: string;
    note?: string;
  }) => void;
  deleteExpense: (expenseId: string) => void;
  updateExpense: (expenseId: string, patch: Partial<Expense>) => void;
  markExpenseDone: (expenseId: string, actualAmount: number) => void;
  markExpensePending: (expenseId: string) => void;

  addPlanRule: (input: { cadence: PlanCadence; amount: number; category: string; title: string; days: number[] }) => void;
  deletePlanRule: (ruleId: string) => void;
  updatePlanRule: (
    ruleId: string,
    patch: Partial<{ cadence: PlanCadence; amount: number; category: string; title: string; days: number[] }>
  ) => void;
  generatePlannedForDate: (isoDate: string) => void;
  generatePlannedForWeek: (baseISO: string) => void;
  generatePlannedForMonth: (baseISO: string) => void;
};

export function useBilleteraState(storageKey = STORAGE_KEY): {
  state: BilleteraState;
  setState: React.Dispatch<React.SetStateAction<BilleteraState>>;
  totals: Totals;
  actions: BilleteraActions;
} {
  const [state, setState] = useState<BilleteraState>(() => {
    return loadStateFromStorage(storageKey);
  });
  const didMountRef = useRef(false);

  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    saveStateToStorage(state, storageKey);
  }, [state, storageKey]);

  const totals = useMemo(() => computeTotals(state), [state]);

  const actions = useMemo(() => {
    return {
      setAll(next: BilleteraState) {
        const normalized = normalizeState(next);
        setState(normalized.state);
      },
      clearAll() {
        setState(defaultState());
      },
      setInitialBalance(amount: number) {
        setState((prev) => ({
          ...prev,
          initialBalance: Number(amount || 0),
          incomes: [],
        }));
      },
      setFilterDate(iso: string) {
        setState((prev) => ({
          ...prev,
          ui: {
            ...prev.ui,
            filterDate: String(iso || ""),
          },
        }));
      },

      addIncome(input: { date: string; amount: number; note?: string }) {
        setState((prev) => addIncome(prev, input));
      },
      addExpense(input: { date: string; plannedAmount: number; category: string; title: string; note?: string }) {
        setState((prev) =>
          addExpense(prev, {
            date: input.date,
            plannedAmount: input.plannedAmount,
            category: input.category,
            title: input.title,
            note: input.note,
            actualAmount: 0,
            done: false,
            sourceBudgetId: null,
          })
        );
      },
      deleteExpense(expenseId: string) {
        setState((prev) => deleteExpense(prev, expenseId));
      },
      updateExpense(expenseId: string, patch: Partial<Expense>) {
        setState((prev) => updateExpense(prev, expenseId, patch));
      },
      markExpenseDone(expenseId: string, actualAmount: number) {
        setState((prev) => setExpenseDoneWithActual(prev, expenseId, actualAmount));
      },
      markExpensePending(expenseId: string) {
        setState((prev) => setExpensePending(prev, expenseId));
      },

      addPlanRule(input: { cadence: PlanCadence; amount: number; category: string; title: string; days: number[] }) {
        setState((prev) => addPlanRule(prev, input));
      },
      deletePlanRule(ruleId: string) {
        setState((prev) => deletePlanRule(prev, ruleId));
      },
      updatePlanRule(ruleId: string, patch: Partial<{ cadence: PlanCadence; amount: number; category: string; title: string; days: number[] }>) {
        setState((prev) => updatePlanRule(prev, ruleId, patch));
      },
      generatePlannedForDate(isoDate: string) {
        setState((prev) => generateFromPlanForDate(prev, isoDate));
      },
      generatePlannedForWeek(baseISO: string) {
        const base = parseISODate(baseISO);
        const start = startOfWeekMonday(base);
        const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
        setState((prev) => generateFromPlanForRange(prev, start, end));
      },
      generatePlannedForMonth(baseISO: string) {
        const base = parseISODate(baseISO);
        const start = new Date(base.getFullYear(), base.getMonth(), 1);
        const end = new Date(base.getFullYear(), base.getMonth() + 1, 0);
        setState((prev) => generateFromPlanForRange(prev, start, end));
      },
    };
  }, []);

  return {
    state,
    setState,
    totals,
    actions,
  };
}
