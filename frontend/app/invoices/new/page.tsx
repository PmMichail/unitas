"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/context/AppContext";
import { invoicesApi } from "@/lib/api";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2, Save, Send, RefreshCw, AlertCircle } from "lucide-react";

interface InvoiceItem {
  name: string;
  quantity: number;
  price: number;
  total: number;
}

export default function NewInvoiceBuilder() {
  const router = useRouter();
  const { selectedProfile } = useApp();

  // Form states
  const [clientName, setClientName] = useState("");
  const [clientTaxId, setClientTaxId] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [vatRate, setVatRate] = useState<number | null>(null); // null = No VAT, 0 = 0%, 20 = 20%
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<InvoiceItem[]>([
    { name: "", quantity: 1, price: 0, total: 0 }
  ]);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleAddItem = () => {
    setItems((prev) => [...prev, { name: "", quantity: 1, price: 0, total: 0 }]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length === 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: keyof InvoiceItem, value: any) => {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        
        const updatedItem = { ...item, [field]: value };
        
        // Auto-calculate total
        if (field === "quantity" || field === "price") {
          const qty = field === "quantity" ? Number(value) : item.quantity;
          const price = field === "price" ? Number(value) : item.price;
          updatedItem.total = qty * price;
        }
        
        return updatedItem;
      })
    );
  };

  // Calculations
  const subtotal = items.reduce((acc, item) => acc + item.total, 0);
  const vatAmount = vatRate !== null && vatRate > 0 ? subtotal * (vatRate / 100) : 0;
  const total = subtotal + vatAmount;

  const handleSubmit = async (sendImmediately: boolean) => {
    if (!selectedProfile) return;
    setError("");

    // Simple validations
    if (!clientName.trim()) {
      setError("Будь ласка, введіть назву або ПІБ клієнта.");
      return;
    }
    if (!clientEmail.trim()) {
      setError("Будь ласка, введіть email клієнта.");
      return;
    }
    const emptyItem = items.some((it) => !it.name.trim() || it.price <= 0);
    if (emptyItem) {
      setError("Будь ласка, заповніть назву та ціну для всіх позицій рахунку.");
      return;
    }

    setIsLoading(true);
    try {
      const payload = {
        profile_id: selectedProfile.id,
        client_name: clientName.trim(),
        client_tax_id: clientTaxId.trim() || undefined,
        client_email: clientEmail.trim(),
        client_address: clientAddress.trim() || undefined,
        due_date: dueDate || undefined,
        vat_rate: vatRate,
        notes: notes.trim() || undefined,
        items: items.map((it) => ({
          name: it.name.trim(),
          quantity: Number(it.quantity),
          price: Number(it.price),
          total: Number(it.total)
        })),
        send_immediately: sendImmediately
      };

      await invoicesApi.create(payload);
      router.push("/invoices");
    } catch (err: any) {
      console.error("Failed to create invoice:", err);
      setError(err?.response?.data?.detail || "Помилка сервера під час збереження рахунку.");
    } finally {
      setIsLoading(false);
    }
  };

  if (!selectedProfile) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <ArrowLeft className="w-16 h-16 text-slate-600 mb-4 animate-pulse" />
        <h2 className="text-xl font-bold text-slate-300">Профіль не обрано</h2>
        <p className="text-sm text-slate-500 max-w-sm mt-2">
          Будь ласка, поверніться та оберіть активний профіль ТОВ або ФОП.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-16">
      <div className="flex items-center space-x-3">
        <Link href="/invoices" className="p-2 hover:bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 rounded-xl transition-all">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Новий рахунок-фактура</h1>
          <p className="text-sm text-slate-400 mt-0.5">Конструктор деталізованого рахунку для клієнта</p>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left main form details */}
        <div className="md:col-span-2 space-y-6">
          <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-6 space-y-4">
            <h3 className="text-sm font-bold text-slate-350 uppercase tracking-wider mb-2">1. Інформація про покупця</h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Назва або ПІБ клієнта *</label>
                <input
                  type="text"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  className="block w-full px-4 py-2.5 bg-slate-950/60 border border-slate-850 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-200 text-xs placeholder-slate-650"
                  placeholder="ТОВ 'Авангард' або Іванов І.І."
                  disabled={isLoading}
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">ЄДРПОУ / ІПН клієнта</label>
                <input
                  type="text"
                  value={clientTaxId}
                  onChange={(e) => setClientTaxId(e.target.value.replace(/\D/g, ""))}
                  className="block w-full px-4 py-2.5 bg-slate-950/60 border border-slate-850 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-200 text-xs placeholder-slate-650"
                  placeholder="12345678"
                  maxLength={10}
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Email клієнта (для надсилання) *</label>
                <input
                  type="email"
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                  className="block w-full px-4 py-2.5 bg-slate-950/60 border border-slate-850 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-200 text-xs placeholder-slate-650"
                  placeholder="client@company.com"
                  disabled={isLoading}
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Адреса клієнта</label>
                <input
                  type="text"
                  value={clientAddress}
                  onChange={(e) => setClientAddress(e.target.value)}
                  className="block w-full px-4 py-2.5 bg-slate-950/60 border border-slate-850 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-200 text-xs placeholder-slate-650"
                  placeholder="вул. Шевченка, 10, м. Львів, 79000"
                  disabled={isLoading}
                />
              </div>
            </div>
          </div>

          {/* Items constructor table */}
          <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-350 uppercase tracking-wider">2. Позиції рахунку</h3>
              <button
                type="button"
                onClick={handleAddItem}
                disabled={isLoading}
                className="inline-flex items-center px-3 py-1.5 bg-indigo-600/10 hover:bg-indigo-600/20 border border-indigo-500/20 text-indigo-400 text-[11px] font-bold rounded-xl transition-all gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                Додати рядок
              </button>
            </div>

            <div className="space-y-3">
              {items.map((item, idx) => (
                <div key={idx} className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center bg-slate-950/40 border border-slate-850 p-4 rounded-2xl relative">
                  <div className="flex-1">
                    <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1 sm:hidden">Товар або послуга</label>
                    <input
                      type="text"
                      value={item.name}
                      onChange={(e) => handleItemChange(idx, "name", e.target.value)}
                      className="block w-full px-3.5 py-2 bg-slate-950/60 border border-slate-850 rounded-lg focus:outline-none text-slate-200 text-xs placeholder-slate-700"
                      placeholder="Наприклад: Надання послуг з веб-розробки"
                      disabled={isLoading}
                    />
                  </div>

                  <div className="w-full sm:w-20">
                    <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1 sm:hidden">Кіл-ть</label>
                    <input
                      type="number"
                      min={1}
                      value={item.quantity}
                      onChange={(e) => handleItemChange(idx, "quantity", Math.max(1, Number(e.target.value)))}
                      className="block w-full px-3.5 py-2 bg-slate-950/60 border border-slate-850 rounded-lg focus:outline-none text-slate-200 text-xs text-center"
                      disabled={isLoading}
                    />
                  </div>

                  <div className="w-full sm:w-32">
                    <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1 sm:hidden">Ціна (грн)</label>
                    <input
                      type="number"
                      min={0}
                      value={item.price || ""}
                      onChange={(e) => handleItemChange(idx, "price", Math.max(0, Number(e.target.value)))}
                      className="block w-full px-3.5 py-2 bg-slate-950/60 border border-slate-850 rounded-lg focus:outline-none text-slate-200 text-xs text-right"
                      placeholder="0.00"
                      disabled={isLoading}
                    />
                  </div>

                  <div className="w-full sm:w-32 text-right font-bold text-slate-300 pr-1 text-xs">
                    <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1 sm:hidden">Сума</label>
                    {item.total.toLocaleString("uk-UA", { minimumFractionDigits: 2 })} ₴
                  </div>

                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(idx)}
                      disabled={isLoading}
                      className="absolute top-3 right-3 sm:relative sm:top-auto sm:right-auto p-1.5 hover:bg-rose-950/20 text-slate-500 hover:text-rose-400 rounded-lg transition-all"
                      title="Видалити"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right side summaries and actions */}
        <div className="space-y-6">
          <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-6 space-y-4">
            <h3 className="text-sm font-bold text-slate-350 uppercase tracking-wider mb-2">3. Параметри та Рахунок</h3>

            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Термін оплати</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="block w-full px-4 py-2.5 bg-slate-950/60 border border-slate-850 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-200 text-xs"
                disabled={isLoading}
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">ПДВ</label>
              <select
                value={vatRate === null ? "none" : String(vatRate)}
                onChange={(e) => {
                  const val = e.target.value;
                  setVatRate(val === "none" ? null : Number(val));
                }}
                className="block w-full px-4 py-2.5 bg-slate-950/60 border border-slate-850 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-200 text-xs font-semibold"
                disabled={isLoading}
              >
                <option value="none">Без ПДВ</option>
                <option value="0">0% ПДВ</option>
                <option value="20">20% ПДВ (додати зверху)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Нотатки / Примітки</label>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="block w-full px-4 py-2.5 bg-slate-950/60 border border-slate-850 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-200 text-xs placeholder-slate-700 resize-none"
                placeholder="Реквізити для оплати, умови доставки тощо..."
                disabled={isLoading}
              />
            </div>

            {/* Calculations widget */}
            <div className="border-t border-slate-800/80 pt-4 space-y-2.5 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Проміжний підсумок:</span>
                <span>{subtotal.toLocaleString("uk-UA", { minimumFractionDigits: 2 })} ₴</span>
              </div>
              
              {vatRate !== null && (
                <div className="flex justify-between text-slate-400">
                  <span>ПДВ ({vatRate}%):</span>
                  <span>{vatAmount.toLocaleString("uk-UA", { minimumFractionDigits: 2 })} ₴</span>
                </div>
              )}

              <div className="border-t border-slate-850 my-1 pt-2 flex justify-between font-extrabold text-sm text-slate-100">
                <span>Всього до сплати:</span>
                <span className="text-indigo-400">{total.toLocaleString("uk-UA", { minimumFractionDigits: 2 })} ₴</span>
              </div>
            </div>

            {/* Submit Actions */}
            <div className="space-y-3 pt-4 border-t border-slate-800/80">
              <button
                type="button"
                onClick={() => handleSubmit(true)}
                disabled={isLoading}
                className="w-full flex items-center justify-center py-3 bg-gradient-to-r from-indigo-650 to-violet-650 hover:from-indigo-600 hover:to-violet-600 active:scale-[0.98] text-white text-xs font-bold rounded-xl shadow-lg transition-all gap-1.5 disabled:opacity-50"
              >
                {isLoading ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                <span>Надіслати клієнту</span>
              </button>

              <button
                type="button"
                onClick={() => handleSubmit(false)}
                disabled={isLoading}
                className="w-full flex items-center justify-center py-3 bg-slate-950/60 hover:bg-slate-950 border border-slate-850 hover:border-slate-700 text-slate-350 text-xs font-bold rounded-xl transition-all gap-1.5 disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Зберегти як чернетку</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
