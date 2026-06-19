"use client";

import React, { useState, useEffect } from "react";
import { useApp } from "@/context/AppContext";
import { api } from "@/lib/api";
import { useParams, useRouter } from "next/navigation";
import {
  Users,
  Plus,
  ArrowLeft,
  Briefcase,
  AlertTriangle,
  CheckCircle,
  HelpCircle,
  TrendingUp,
  DollarSign,
  Calendar,
  Info
} from "lucide-react";

export default function Employees() {
  const params = useParams();
  const router = useRouter();
  const { profiles, selectedProfile, setSelectedProfile } = useApp();

  const ukrMonthsList = [
    { value: "01", label: "Січень" },
    { value: "02", label: "Лютий" },
    { value: "03", label: "Березень" },
    { value: "04", label: "Квітень" },
    { value: "05", label: "Травень" },
    { value: "06", label: "Червень" },
    { value: "07", label: "Липень" },
    { value: "08", label: "Серпень" },
    { value: "09", label: "Вересень" },
    { value: "10", label: "Жовтень" },
    { value: "11", label: "Листопад" },
    { value: "12", label: "Грудень" }
  ];

  const yearsList = ["2024", "2025", "2026", "2027", "2028"];

  const profileId = Number(params.id);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
 
  // Form Fields
  const [editingEmployee, setEditingEmployee] = useState<any | null>(null);
  const [empName, setEmpName] = useState("");
  const [empTaxId, setEmpTaxId] = useState("");
  const [empSalary, setEmpSalary] = useState(10000);
  const [empIsMainJob, setEmpIsMainJob] = useState(true);
  const [empContractType, setEmpContractType] = useState("permanent");
  const [empEsvPaidByOther, setEmpEsvPaidByOther] = useState(false);
  const [empIsArchived, setEmpIsArchived] = useState(false);
  const [empStartDate, setEmpStartDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  });
  const [empEndDate, setEmpEndDate] = useState("");
  const [empActiveMonths, setEmpActiveMonths] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
 
  // Monthly Filter
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
 
  // Fetch employees
  const fetchEmployees = async () => {
    if (!profileId) return;
    setLoading(true);
    try {
      const data = await api.getEmployees(profileId);
      setEmployees(data);
    } catch (err) {
      console.error("Failed to fetch employees:", err);
    } finally {
      setLoading(false);
    }
  };
 
  useEffect(() => {
    fetchEmployees();
  }, [profileId]);
 
  const handleOpenCreate = () => {
    setEditingEmployee(null);
    setEmpName("");
    setEmpTaxId("");
    setEmpSalary(10000);
    setEmpIsMainJob(true);
    setEmpContractType("permanent");
    setEmpEsvPaidByOther(false);
    setEmpIsArchived(false);
    const d = new Date();
    setEmpStartDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`);
    setEmpEndDate("");
    
    const year = selectedMonth.split("-")[0] || new Date().getFullYear().toString();
    const initialMonths: Record<string, boolean> = {};
    for (let m = 1; m <= 12; m++) {
      const mStr = `${year}-${String(m).padStart(2, "0")}`;
      initialMonths[mStr] = true;
    }
    setEmpActiveMonths(initialMonths);

    setError(null);
    setIsModalOpen(true);
  };
 
  const handleOpenEdit = (emp: any) => {
    setEditingEmployee(emp);
    setEmpName(emp.name);
    setEmpTaxId(emp.tax_id || "");
    setEmpSalary(emp.salary || 10000);
    setEmpIsMainJob(emp.is_main_job !== false);
    setEmpContractType(emp.contract_type || "permanent");
    setEmpEsvPaidByOther(emp.esv_paid_by_other === true);
    setEmpIsArchived(emp.is_archived === true);
    setEmpStartDate(emp.start_date ? emp.start_date.split("T")[0] : "");
    setEmpEndDate(emp.end_date ? emp.end_date.split("T")[0] : "");
    
    let parsedActiveMonths: Record<string, boolean> = {};
    if (emp.active_months_json) {
      try {
        parsedActiveMonths = JSON.parse(emp.active_months_json);
      } catch (e) {}
    } else {
      const year = selectedMonth.split("-")[0] || new Date().getFullYear().toString();
      for (let m = 1; m <= 12; m++) {
        const mStr = `${year}-${String(m).padStart(2, "0")}`;
        parsedActiveMonths[mStr] = isEmployeeActiveInSelectedMonth(emp, mStr);
      }
    }
    setEmpActiveMonths(parsedActiveMonths);

    setError(null);
    setIsModalOpen(true);
  };
 
  const handleDelete = async (employeeId: number) => {
    if (!confirm("Ви впевнені, що хочете видалити цього працівника?")) return;
    try {
      await api.deleteEmployee(employeeId);
      await fetchEmployees();
    } catch (err) {
      console.error("Failed to delete employee:", err);
      alert("Не вдалося видалити працівника");
    }
  };
 
  // Helper to determine if employee is active in selectedMonth
  const isEmployeeActiveInSelectedMonth = (emp: any, monthStr: string) => {
    if (!emp) return false;
    
    // Check manual override in active_months_json first
    if (emp.active_months_json) {
      try {
        const overrides = JSON.parse(emp.active_months_json);
        if (overrides[monthStr] !== undefined) {
          return !!overrides[monthStr];
        }
      } catch (e) {}
    }
    
    // Check start and end dates
    const [year, month] = monthStr.split("-").map(Number);
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0);
    
    if (emp.start_date) {
      const start = new Date(emp.start_date);
      if (start > monthEnd) return false;
    }
    
    if (emp.end_date) {
      const end = new Date(emp.end_date);
      if (end < monthStart) return false;
    }
    
    // If archived and no end date, assume archived from current month onwards
    if (emp.is_archived && !emp.end_date) {
      const today = new Date();
      const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      if (monthStart >= currentMonthStart) return false;
    }
    
    return true;
  };

  const handleToggleMonthDirectly = async (emp: any, monthKey: string) => {
    let currentOverrides: Record<string, boolean> = {};
    if (emp.active_months_json) {
      try {
        currentOverrides = JSON.parse(emp.active_months_json);
      } catch (e) {}
    } else {
      const year = monthKey.split("-")[0];
      for (let m = 1; m <= 12; m++) {
        const mStr = `${year}-${String(m).padStart(2, "0")}`;
        currentOverrides[mStr] = isEmployeeActiveInSelectedMonth(emp, mStr);
      }
    }
    
    currentOverrides[monthKey] = !currentOverrides[monthKey];
    
    try {
      await api.updateEmployee(emp.id, {
        active_months_json: JSON.stringify(currentOverrides)
      });
      await fetchEmployees();
    } catch (err) {
      console.error("Failed to update active months:", err);
    }
  };

  const handleDismissEmployee = async (emp: any) => {
    if (!confirm(`Зафіксувати звільнення працівника ${emp.name}? Його буде перенесено в архів.`)) return;
    
    const [year, month] = selectedMonth.split("-").map(Number);
    const lastDay = new Date(year, month, 0).getDate();
    const endDateStr = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    
    try {
      await api.updateEmployee(emp.id, {
        is_archived: true,
        end_date: endDateStr
      });
      await fetchEmployees();
    } catch (err) {
      console.error("Failed to dismiss employee:", err);
      alert("Не вдалося зафіксувати звільнення");
    }
  };
 
  // Handle Form Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empName.trim()) {
      setError("Введіть ПІБ працівника");
      return;
    }
    if (empTaxId.length !== 10) {
      setError("РНОКПП має складатися рівно з 10 цифр");
      return;
    }
 
    setSubmitting(true);
    setError(null);
 
    const payload = {
      profile_id: profileId,
      name: empName,
      tax_id: empTaxId,
      salary: Number(empSalary),
      is_main_job: empIsMainJob,
      contract_type: empContractType,
      esv_paid_by_other: empEsvPaidByOther,
      is_archived: empIsArchived,
      start_date: empStartDate || null,
      end_date: empEndDate || null,
      active_months_json: JSON.stringify(empActiveMonths)
    };
 
    try {
      if (editingEmployee) {
        await api.updateEmployee(editingEmployee.id, {
          name: empName,
          tax_id: empTaxId,
          salary: Number(empSalary),
          is_main_job: empIsMainJob,
          contract_type: empContractType,
          esv_paid_by_other: empEsvPaidByOther,
          is_archived: empIsArchived,
          start_date: empStartDate || null,
          end_date: empEndDate || null,
          active_months_json: JSON.stringify(empActiveMonths)
        });
      } else {
        await api.createEmployee(payload);
      }
      await fetchEmployees();
      setIsModalOpen(false);
      setEditingEmployee(null);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Помилка при збереженні працівника");
    } finally {
      setSubmitting(false);
    }
  };
 
  // Find profile details
  const profile = profiles.find((p) => p.id === profileId) || selectedProfile;
 
  if (profile && profile.type !== "company" && !profile.has_employees) {
    return (
      <div className="py-12 text-center max-w-md mx-auto">
        <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
        <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200">Доступ обмежено</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
          Розділ "Працівники" доступний лише для профілів типу ТОВ / Юридична особа або ФОП з увімкненою опцією найманих працівників.
        </p>
        <button
          onClick={() => router.push("/dashboard")}
          className="mt-6 px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl"
        >
          Повернутися на Дашборд
        </button>
      </div>
    );
  }
 
  // Summary calculations
  const activeEmployees = employees.filter(emp => isEmployeeActiveInSelectedMonth(emp, selectedMonth));
 
  const totalSalaries = activeEmployees.reduce((sum, emp) => {
    if (emp.contract_type === "fop") return sum;
    return sum + (emp.salary || 0);
  }, 0);
 
  const totalEsv = activeEmployees.reduce((sum, emp) => {
    if (emp.contract_type === "fop" || emp.esv_paid_by_other === true) return sum;
    if (emp.contract_type === "cph") {
      return sum + ((emp.salary || 0) * 0.22);
    }
    const isMain = emp.is_main_job !== false;
    const base = isMain ? Math.max(emp.salary || 0, 8647.0) : (emp.salary || 0);
    return sum + (base * 0.22);
  }, 0);
 
  const totalPit = activeEmployees.reduce((sum, emp) => {
    if (emp.contract_type === "fop") return sum;
    return sum + ((emp.salary || 0) * 0.18);
  }, 0);
 
  const totalMil = activeEmployees.reduce((sum, emp) => {
    if (emp.contract_type === "fop") return sum;
    return sum + ((emp.salary || 0) * 0.05);
  }, 0);
 
  const totalTaxes = totalEsv + totalPit + totalMil;
 
  return (
    <div className="space-y-8">
      {/* Navigation & Title */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="space-y-1">
          <button
            onClick={() => router.push("/profiles")}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 font-bold transition-all mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Назад до профілів
          </button>
          <h2 className="text-3xl font-extrabold bg-gradient-to-r from-slate-900 via-slate-700 to-indigo-600 dark:from-white dark:via-slate-200 dark:to-indigo-400 bg-clip-text text-transparent">
            Працівники: {profile?.name}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Зарплатні відомості, розрахунок податків (ЄСВ, ПДФО, ВЗ) та контроль за сплатою.
          </p>
        </div>
 
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={selectedMonth.split("-")[1]}
            onChange={(e) => setSelectedMonth(`${selectedMonth.split("-")[0]}-${e.target.value}`)}
            className="px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-bold focus:outline-none focus:border-indigo-500 transition-all text-slate-800 dark:text-slate-100"
          >
            {ukrMonthsList.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
          <select
            value={selectedMonth.split("-")[0]}
            onChange={(e) => setSelectedMonth(`${e.target.value}-${selectedMonth.split("-")[1]}`)}
            className="px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-bold focus:outline-none focus:border-indigo-500 transition-all text-slate-800 dark:text-slate-100"
          >
            {yearsList.map((y) => (
              <option key={y} value={y}>{y} рік</option>
            ))}
          </select>
          <button
            onClick={handleOpenCreate}
            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-all glow-button flex items-center gap-1.5 shrink-0"
          >
            <Plus className="w-4 h-4" />
            Додати працівника
          </button>
        </div>
      </div>
 
      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="p-6 rounded-2xl glass-panel">
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Штат працівників</p>
          <h3 className="text-3xl font-bold mt-2">{activeEmployees.length} осіб</h3>
          <p className="text-[10px] text-slate-400 mt-1">Активних у цьому місяці (всього: {employees.length})</p>
        </div>
        <div className="p-6 rounded-2xl glass-panel">
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Фонд оплати праці (ФОП)</p>
          <h3 className="text-3xl font-bold mt-2">{totalSalaries.toLocaleString("uk-UA")} грн</h3>
          <p className="text-[10px] text-slate-400 mt-1">Сукупна брутто зарплата</p>
        </div>
        <div className="p-6 rounded-2xl glass-panel">
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider font-bold text-indigo-400">Податки до сплати</p>
          <h3 className="text-3xl font-bold mt-2 text-indigo-500 dark:text-indigo-400">{totalTaxes.toLocaleString("uk-UA")} грн</h3>
          <p className="text-[10px] text-slate-400 mt-1">ЄСВ + ПДФО + Військовий збір</p>
        </div>
        <div className="p-6 rounded-2xl glass-panel">
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Статус сплати за місяць</p>
          <div className="flex items-center gap-2 mt-3">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            <span className="text-sm font-bold text-emerald-400">Очікує звітності</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">Подача 1ДФ в кінці кварталу</p>
        </div>
      </div>
 
      {/* Employees table */}
      <div className="p-6 rounded-2xl glass-panel overflow-hidden">
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
          <Users className="w-5 h-5 text-indigo-400" />
          Зарплатна відомість за {selectedMonth}
        </h3>
 
        {loading ? (
          <div className="py-12 text-center">
            <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-500"></div>
          </div>
        ) : employees.length > 0 ? (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-sm text-left text-slate-400">
              <thead className="text-xs text-slate-400 uppercase bg-slate-950/20 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-3 py-3 min-w-[340px]">Працівник / РНОКПП</th>
                  <th className="px-3 py-3">Тип договору</th>
                  <th className="px-3 py-3">Зарплата</th>
                  <th className="px-3 py-3">Податки (ЄСВ / ПДФО / ВЗ)</th>
                  <th className="px-3 py-3">До виплати / Статус</th>
                  <th className="px-3 py-3 text-right">Дії</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((emp) => {
                  const isActive = isEmployeeActiveInSelectedMonth(emp, selectedMonth);
                  const salary = emp.salary || 0;
                  const cType = emp.contract_type || "permanent";
                  const isMain = emp.is_main_job !== false;
 
                  let esv = 0;
                  let pit = 0;
                  let mil = 0;
                  let net = 0;
 
                  if (isActive && cType !== "fop") {
                    pit = salary * 0.18;
                    mil = salary * 0.05;
                    net = salary - pit - mil;
 
                    if (emp.esv_paid_by_other !== true) {
                      if (cType === "cph") {
                        esv = salary * 0.22;
                      } else {
                        const esvBase = isMain ? Math.max(salary, 8647.0) : salary;
                        esv = esvBase * 0.22;
                      }
                    }
                  } else if (isActive && cType === "fop") {
                    net = salary;
                  }
 
                  return (
                    <tr key={emp.id} className={`border-b border-slate-200 dark:border-slate-800/40 bg-slate-900/5 hover:bg-slate-900/10 transition-colors ${!isActive ? "opacity-40" : ""}`}>
                      <td className="px-3 py-3 font-semibold text-slate-900 dark:text-white min-w-[340px]">
                        <div className="flex items-center gap-2">
                          <span>{emp.name}</span>
                          {emp.is_archived && (
                            <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-red-950 text-red-400 border border-red-800/20">АРХІВ</span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400 font-bold tracking-wider">{emp.tax_id}</div>
                        {/* 12 months checkable circles directly under the name */}
                        <div className="flex flex-nowrap items-center gap-0.5 mt-2">
                          {ukrMonthsList.map((m) => {
                            const monthKey = `${selectedMonth.split("-")[0]}-${m.value}`;
                            const isMonthActive = isEmployeeActiveInSelectedMonth(emp, monthKey);
                            return (
                              <button
                                key={m.value}
                                type="button"
                                title={`${m.label} ${selectedMonth.split("-")[0]}: ${isMonthActive ? "Працював" : "Не працював"}`}
                                onClick={() => handleToggleMonthDirectly(emp, monthKey)}
                                className={`w-6 h-6 rounded-full text-[8px] font-black flex items-center justify-center transition-all border ${
                                  isMonthActive
                                    ? "bg-indigo-600 text-white border-indigo-500 hover:bg-indigo-500 cursor-pointer shadow-sm shadow-indigo-650/15"
                                    : "bg-slate-950/20 text-slate-500 border-slate-800/80 hover:border-slate-700/60 cursor-pointer"
                                }`}
                              >
                                {m.label.substring(0, 3)}
                              </button>
                            );
                          })}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="space-y-1">
                          <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            cType === "fop" 
                              ? "bg-amber-950 text-amber-300 border border-amber-500/20" 
                              : cType === "cph"
                                ? "bg-emerald-950 text-emerald-300 border border-emerald-500/20"
                                : "bg-indigo-950 text-indigo-300 border border-indigo-500/20"
                          }`}>
                            {cType === "fop" ? "Договір ФОП" : cType === "cph" ? "ЦПХ" : "Штатний"}
                          </span>
                          {cType === "permanent" && (
                            <span className="block text-[9px] text-slate-400 font-bold">
                              {isMain ? "Основне" : "Сумісництво"}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-slate-700 dark:text-slate-300 font-semibold">
                        {salary.toLocaleString("uk-UA")} грн
                      </td>
                      <td className="px-3 py-3 text-slate-600 dark:text-slate-400">
                        {isActive && cType !== "fop" ? (
                          <>
                            <div className="font-bold text-slate-900 dark:text-white">
                              {(esv + pit + mil).toLocaleString("uk-UA")} грн
                            </div>
                            <div className="text-[10px] text-slate-400 mt-1 space-y-0.5">
                              <div>ЄСВ (22%): {emp.esv_paid_by_other ? <span className="text-indigo-400">Сплачує інший</span> : `${esv.toLocaleString("uk-UA")} грн`}</div>
                              <div>ПДФО (18%): {pit.toLocaleString("uk-UA")} грн</div>
                              <div>ВЗ (5%): {mil.toLocaleString("uk-UA")} грн</div>
                            </div>
                          </>
                        ) : (
                          <span className="text-slate-500">-</span>
                        )}
                      </td>
                      <td className="px-3 py-3 font-bold text-slate-900 dark:text-white">
                        <div>{net.toLocaleString("uk-UA")} грн</div>
                        <div className="mt-1.5">
                          {!isActive ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-slate-950 text-slate-400 border border-slate-800">
                              Неактивний
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-emerald-950 text-emerald-300 border border-emerald-500/20">
                              <CheckCircle className="w-3 h-3" /> Нараховано
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <div className="flex justify-end gap-1.5 flex-wrap">
                          <button
                            onClick={() => handleOpenEdit(emp)}
                            className="px-2.5 py-1 text-xs font-bold text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 rounded-lg transition-all"
                          >
                            Змінити
                          </button>
                          {!emp.is_archived && (
                            <button
                              onClick={() => handleDismissEmployee(emp)}
                              className="px-2.5 py-1 text-xs font-bold text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 rounded-lg transition-all"
                            >
                              Звільнити
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(emp.id)}
                            className="px-2.5 py-1 text-xs font-bold text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-all"
                          >
                            Видалити
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-12 text-center text-slate-500">
            Працівників не знайдено. Додайте першого працівника для розрахунку податків.
          </div>
        )}
      </div>

      {/* Add / Edit Employee Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden space-y-4">
            <div className="flex justify-between items-start shrink-0">
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                  {editingEmployee ? "Редагувати дані працівника" : "Додати працівника"}
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  {editingEmployee ? "Оновіть дані працівника." : "Введіть дані найманого працівника."}
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm font-semibold"
              >
                Закрити
              </button>
            </div>
 
            {error && (
              <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-xs font-bold text-red-500 flex items-start gap-2 shrink-0">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
 
            <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden space-y-4">
              <div className="flex-1 overflow-y-auto pr-1.5 space-y-4 custom-scrollbar">
                <div>
                  <label className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-bold mb-1.5 block">
                    ПІБ Працівника
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Коваленко Дмитро Петрович"
                    value={empName}
                    onChange={(e) => setEmpName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-sm focus:outline-none focus:border-indigo-500 transition-all font-semibold"
                  />
                </div>
 
                <div>
                  <label className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-bold mb-1.5 block">
                    РНОКПП (ІПН - 10 цифр)
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={10}
                    placeholder="3012345678"
                    value={empTaxId}
                    onChange={(e) => setEmpTaxId(e.target.value.replace(/\D/g, ""))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-sm focus:outline-none focus:border-indigo-500 transition-all font-semibold"
                  />
                </div>
 
                <div>
                  <label className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-bold mb-1.5 block">
                    Оклад (Зарплата брутто, грн)
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={empSalary}
                    onChange={(e) => setEmpSalary(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-sm focus:outline-none focus:border-indigo-500 transition-all font-semibold"
                  />
                </div>
 
                <div>
                  <label className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-bold mb-1.5 block">
                    Тип договору
                  </label>
                  <select
                    value={empContractType}
                    onChange={(e) => {
                      setEmpContractType(e.target.value);
                      if (e.target.value !== "permanent") {
                        setEmpIsMainJob(false);
                        setEmpEsvPaidByOther(false);
                      } else {
                        setEmpIsMainJob(true);
                      }
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-sm focus:outline-none focus:border-indigo-500 transition-all font-semibold"
                  >
                    <option value="permanent">Штатний працівник (Трудовий договір)</option>
                    <option value="cph">Договір ЦПХ (Цивільно-правовий)</option>
                    <option value="fop">Договір з ФОП (Контрагент)</option>
                  </select>
                </div>
 
                {empContractType === "permanent" && (
                  <>
                    <div className="flex items-center gap-2 py-1 cursor-pointer">
                      <input
                        type="checkbox"
                        id="empIsMainJob"
                        checked={empIsMainJob}
                        onChange={(e) => setEmpIsMainJob(e.target.checked)}
                        className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 bg-slate-50 dark:bg-slate-900 dark:border-slate-800"
                      />
                      <label htmlFor="empIsMainJob" className="text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                        Основне місце роботи (сплата ЄСВ не менше мін. внеску)
                      </label>
                    </div>
 
                    <div className="flex items-center gap-2 py-1 cursor-pointer">
                      <input
                        type="checkbox"
                        id="empEsvPaidByOther"
                        checked={empEsvPaidByOther}
                        onChange={(e) => setEmpEsvPaidByOther(e.target.checked)}
                        className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 bg-slate-50 dark:bg-slate-900 dark:border-slate-800"
                      />
                      <label htmlFor="empEsvPaidByOther" className="text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                        ЄСВ сплачує інше підприємство (звільнення від сплати тут)
                      </label>
                    </div>
                  </>
                )}
 
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-bold mb-1.5 block">
                      Дата початку роботи
                    </label>
                    <input
                      type="date"
                      required
                      value={empStartDate}
                      onChange={(e) => setEmpStartDate(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-sm focus:outline-none focus:border-indigo-500 transition-all font-semibold"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-bold mb-1.5 block">
                      Дата звільнення (якщо є)
                    </label>
                    <input
                      type="date"
                      value={empEndDate}
                      onChange={(e) => setEmpEndDate(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-sm focus:outline-none focus:border-indigo-500 transition-all font-semibold"
                    />
                  </div>
                </div>
 
                <div>
                  <label className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-bold mb-2 block">
                    Місяці роботи у {selectedMonth.split("-")[0]} році (позначте активні)
                  </label>
                  <div className="grid grid-cols-12 gap-1 bg-slate-50 dark:bg-slate-900/60 p-2 rounded-2xl border border-slate-200 dark:border-slate-800/80">
                    {ukrMonthsList.map((m) => {
                      const monthKey = `${selectedMonth.split("-")[0]}-${m.value}`;
                      const isChecked = !!empActiveMonths[monthKey];
                      return (
                        <label 
                          key={m.value} 
                          className={`flex flex-col items-center justify-center p-1 rounded-xl border cursor-pointer select-none transition-all ${
                            isChecked 
                              ? "border-indigo-500/35 bg-indigo-500/5 text-indigo-400 font-bold" 
                              : "border-slate-100 dark:border-slate-850 bg-transparent text-slate-500"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              setEmpActiveMonths(prev => ({
                                ...prev,
                                [monthKey]: e.target.checked
                              }));
                            }}
                            className="w-3.5 h-3.5 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                          />
                          <span className="text-[9px] mt-1">{m.label.substring(0, 3)}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
 
                {editingEmployee && (
                  <div className="flex items-center gap-2 py-1 cursor-pointer">
                    <input
                      type="checkbox"
                      id="empIsArchived"
                      checked={empIsArchived}
                      onChange={(e) => setEmpIsArchived(e.target.checked)}
                      className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 bg-slate-50 dark:bg-slate-900 dark:border-slate-800"
                    />
                    <label htmlFor="empIsArchived" className="text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                      Архівувати працівника (перенести в архів)
                    </label>
                  </div>
                )}
              </div>
 
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 shrink-0 space-y-4">
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-850 text-xs text-slate-500 space-y-2">
                  {empContractType === "fop" ? (
                    <div className="text-center py-2 text-slate-400 font-medium">
                      Для підрядника ФОП податки не утримуються підприємством. ФОП сплачує податки за себе самостійно.
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between items-start">
                        <span>ЄСВ (22% сплачує ТОВ):</span>
                        <div className="text-right">
                          <span className="font-bold text-slate-700 dark:text-slate-300">
                            {empEsvPaidByOther 
                              ? "0.00 грн (сплачує інший)" 
                              : `${(empContractType === "cph" 
                                  ? empSalary * 0.22 
                                  : (empIsMainJob ? Math.max(empSalary, 8647) * 0.22 : empSalary * 0.22)
                                ).toFixed(2)} грн`
                            }
                          </span>
                          {!empEsvPaidByOther && empContractType === "permanent" && empIsMainJob && empSalary < 8647 && (
                            <span className="block text-[9px] text-amber-500 font-semibold">(включаючи доплату ЄСВ)</span>
                          )}
                        </div>
                      </div>
                      <div className="flex justify-between">
                        <span>ПДФО (18% утримується):</span>
                        <span className="font-bold text-slate-700 dark:text-slate-300">{(empSalary * 0.18).toFixed(2)} грн</span>
                      </div>
                      <div className="flex justify-between">
                        <span>ВЗ (5% утримується):</span>
                        <span className="font-bold text-slate-700 dark:text-slate-300">{(empSalary * 0.05).toFixed(2)} грн</span>
                      </div>
                      <div className="border-t border-slate-200 dark:border-slate-800 my-1 pt-1 flex justify-between font-bold text-slate-700 dark:text-slate-200">
                        <span>До виплати працівнику:</span>
                        <span>{(empSalary * 0.77).toFixed(2)} грн</span>
                      </div>
                    </>
                  )}
                </div>
 
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-all shadow-lg disabled:opacity-50 glow-button"
                >
                  {submitting ? "Збереження..." : (editingEmployee ? "Зберегти зміни" : "Додати працівника")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
