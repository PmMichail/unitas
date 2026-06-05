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
    setError(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (emp: any) => {
    setEditingEmployee(emp);
    setEmpName(emp.name);
    setEmpTaxId(emp.tax_id || "");
    setEmpSalary(emp.salary || 10000);
    setEmpIsMainJob(emp.is_main_job !== false);
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
      is_main_job: empIsMainJob
    };

    try {
      if (editingEmployee) {
        await api.updateEmployee(editingEmployee.id, {
          name: empName,
          tax_id: empTaxId,
          salary: Number(empSalary),
          is_main_job: empIsMainJob
        });
      } else {
        await api.createEmployee(payload);
      }
      await fetchEmployees();
      setIsModalOpen(false);
      setEmpName("");
      setEmpTaxId("");
      setEmpSalary(10000);
      setEmpIsMainJob(true);
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
  const totalSalaries = employees.reduce((sum, emp) => sum + (emp.salary || 0), 0);
  const totalEsv = employees.reduce((sum, emp) => {
    const isMain = emp.is_main_job !== false;
    const base = isMain ? Math.max(emp.salary || 0, 8647.0) : (emp.salary || 0);
    return sum + (base * 0.22);
  }, 0);
  const totalPit = totalSalaries * 0.18;
  const totalMil = totalSalaries * 0.05; // 5% military tax for LLC salary in 2026
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

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-bold"
          />
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
          <h3 className="text-3xl font-bold mt-2">{employees.length} осіб</h3>
          <p className="text-[10px] text-slate-400 mt-1">Зареєстровано в базі</p>
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
                  <th className="px-6 py-4">Працівник / РНОКПП</th>
                  <th className="px-6 py-4">Тип</th>
                  <th className="px-6 py-4">Зарплата</th>
                  <th className="px-6 py-4">ЄСВ (22%)</th>
                  <th className="px-6 py-4">ПДФО (18%)</th>
                  <th className="px-6 py-4">Військовий збір (5%)</th>
                  <th className="px-6 py-4">До виплати</th>
                  <th className="px-6 py-4">Статус</th>
                  <th className="px-6 py-4 text-right">Дії</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((emp) => {
                  const salary = emp.salary || 0;
                  const isMain = emp.is_main_job !== false;
                  const esvBase = isMain ? Math.max(salary, 8647.0) : salary;
                  const esv = esvBase * 0.22;
                  const pit = salary * 0.18;
                  const mil = salary * 0.05; // 5% military tax
                  const net = salary - pit - mil;

                  return (
                    <tr key={emp.id} className="border-b border-slate-200 dark:border-slate-800/40 bg-slate-900/5 hover:bg-slate-900/10 transition-colors">
                      <td className="px-6 py-4 font-semibold text-slate-900 dark:text-white">
                        <div>{emp.name}</div>
                        <div className="text-[10px] text-slate-400 font-bold tracking-wider">{emp.tax_id}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${isMain ? "bg-indigo-950 text-indigo-300 border border-indigo-500/20" : "bg-slate-950 text-slate-450 border border-slate-800"}`}>
                          {isMain ? "Основне" : "Сумісництво"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-700 dark:text-slate-300 font-semibold">
                        {salary.toLocaleString("uk-UA")} грн
                      </td>
                      <td className="px-6 py-4 text-slate-600 dark:text-slate-400 font-semibold">
                        {esv.toLocaleString("uk-UA")} грн
                        {isMain && salary < 8647.0 && (
                          <span className="block text-[9px] text-amber-500 font-bold leading-tight">(з доплатою)</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-slate-600 dark:text-slate-400">
                        {pit.toLocaleString("uk-UA")} грн
                      </td>
                      <td className="px-6 py-4 text-slate-600 dark:text-slate-400">
                        {mil.toLocaleString("uk-UA")} грн
                      </td>
                      <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">
                        {net.toLocaleString("uk-UA")} грн
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-950 text-emerald-300 border border-emerald-500/20">
                          <CheckCircle className="w-3 h-3" /> Нараховано
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleOpenEdit(emp)}
                            className="px-2.5 py-1 text-xs font-bold text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 rounded-lg transition-all"
                          >
                            Змінити
                          </button>
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
          <div className="w-full max-w-md bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                  {editingEmployee ? "Редагувати дані працівника" : "Додати працівника"}
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  {editingEmployee ? "Оновіть зарплатні та інші дані працівника." : "Введіть дані найманого працівника для зарплатного відома."}
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
              <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-xs font-bold text-red-500 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
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

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-850 text-xs text-slate-500 space-y-2">
                <div className="flex justify-between items-start">
                  <span>ЄСВ (22% сплачує ТОВ):</span>
                  <div className="text-right">
                    <span className="font-bold text-slate-700 dark:text-slate-300">
                      {(empIsMainJob ? Math.max(empSalary, 8647) * 0.22 : empSalary * 0.22).toFixed(2)} грн
                    </span>
                    {empIsMainJob && empSalary < 8647 && (
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
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-all shadow-lg disabled:opacity-50 glow-button"
              >
                {submitting ? "Збереження..." : (editingEmployee ? "Зберегти зміни" : "Додати працівника")}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
