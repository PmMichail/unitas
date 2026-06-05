"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useApp } from "@/context/AppContext";
import { certificatesApi } from "@/lib/api";
import {
  Shield,
  Upload,
  Lock,
  Key,
  Calendar,
  CheckCircle,
  AlertCircle,
  FileText,
  User,
  Plus,
  RefreshCw,
  Building
} from "lucide-react";

export default function CertificatesPage() {
  const { selectedProfile } = useApp();
  const [certificates, setCertificates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  
  // Notification states
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchCertificates = useCallback(async () => {
    if (!selectedProfile) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await certificatesApi.list(selectedProfile.id);
      setCertificates(data);
    } catch (err) {
      console.error("Failed to load certificates:", err);
      setErrorMsg("Не вдалося завантажити список сертифікатів.");
    } finally {
      setLoading(false);
    }
  }, [selectedProfile]);

  useEffect(() => {
    fetchCertificates();
  }, [fetchCertificates]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProfile) return;
    if (!file) {
      setErrorMsg("Будь ласка, оберіть файл ключа (сертифіката).");
      return;
    }
    if (!password) {
      setErrorMsg("Будь ласка, введіть пароль для розшифрування сертифіката.");
      return;
    }

    setUploading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      await certificatesApi.upload(selectedProfile.id, file, password);
      setSuccessMsg("Сертифікат успішно завантажено та збережено!");
      setFile(null);
      setPassword("");
      // Clear file input manually
      const fileInput = document.getElementById("cert-file-input") as HTMLInputElement;
      if (fileInput) fileInput.value = "";
      
      fetchCertificates();
    } catch (err: any) {
      console.error("Upload failed:", err);
      setErrorMsg(err.response?.data?.detail || "Помилка завантаження. Перевірте правильність паролю та файлу.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
            <Shield className="w-8 h-8 text-indigo-500" />
            Електронний підпис (КЕП)
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">
            Завантажуйте ключі та сертифікати КЕП (.p12, .pfx, .dat, .jks тощо) для підписання рахунків та актів виконаних робіт.
          </p>
        </div>
        <button
          onClick={fetchCertificates}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-700/80 text-slate-700 dark:text-slate-200 transition-colors border border-slate-200 dark:border-slate-700/60"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Оновити
        </button>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-xl flex items-center gap-3">
          <CheckCircle className="w-5 h-5 flex-shrink-0" />
          <p className="font-medium text-sm">{successMsg}</p>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 rounded-xl flex items-center gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="font-medium text-sm">{errorMsg}</p>
        </div>
      )}

      {/* Profile Check */}
      {!selectedProfile ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900/30 backdrop-blur-md rounded-2xl border border-slate-200 dark:border-slate-800/50 shadow-sm">
          <Building className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">Не обрано профіль</h3>
          <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-2">
            Будь ласка, оберіть компанію або ФОП у верхньому меню, щоб керувати сертифікатами підпису.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
          {/* Upload Card */}
          <div className="md:col-span-2 space-y-6">
            <div className="p-6 bg-white dark:bg-slate-900/30 backdrop-blur-md rounded-2xl border border-slate-200 dark:border-slate-800/50 shadow-sm space-y-4">
              <h3 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <Upload className="w-5 h-5 text-indigo-500" />
                Завантажити сертифікат
              </h3>
              
              <form onSubmit={handleUpload} className="space-y-4 pt-2">
                <div className="space-y-1.5">
                  <label className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-bold block">
                    Файл ключа / підпису (.p12, .pfx, .dat, .jks тощо)
                  </label>
                  <div className="relative border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl p-4 text-center cursor-pointer hover:border-indigo-500/50 transition-colors">
                    <input
                      type="file"
                      id="cert-file-input"
                      accept=".p12,.pfx,.dat,.jks,.zs2,.bin,.key"
                      onChange={handleFileChange}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <Key className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 block truncate">
                      {file ? file.name : "Оберіть файл ключа"}
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-bold block">
                    Пароль від сертифіката
                  </label>
                  <div className="relative">
                    <input
                      type="password"
                      placeholder="Введіть пароль ключа"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800/80 rounded-xl text-sm focus:outline-none focus:border-indigo-500 transition-colors pl-10"
                    />
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={uploading}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/15 hover:shadow-indigo-600/25 transition-all text-sm flex items-center justify-center gap-2"
                >
                  {uploading ? "Завантаження..." : "Завантажити ключ"}
                </button>
              </form>
            </div>
            
            {/* Info Security block */}
            <div className="p-4 bg-indigo-500/5 border border-indigo-500/10 rounded-xl space-y-2">
              <h4 className="text-xs font-bold text-indigo-500 dark:text-indigo-400 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5" />
                Безпека КЕП
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                Ми турбуємось про безпеку ваших даних. Ваш закритий ключ шифрується найнадійнішим стандартом AES-256 за допомогою унікального ключа середовища та ніколи не передається третім особам.
              </p>
            </div>
          </div>

          {/* Certificates List */}
          <div className="md:col-span-3 space-y-4">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">Ваші активні сертифікати</h3>

            {loading ? (
              <div className="p-12 text-center text-slate-400">Завантаження...</div>
            ) : certificates.length === 0 ? (
              <div className="p-12 text-center bg-slate-50 dark:bg-slate-900/10 border border-slate-200 dark:border-slate-800/40 rounded-2xl">
                <Key className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-4" />
                <h4 className="text-base font-bold text-slate-800 dark:text-slate-200">Немає завантажених КЕП</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs mx-auto">
                  Завантажте ваш цифровий підпис (.p12, .pfx, .dat, .jks тощо), щоб отримати можливість підписувати первинні документи.
                </p>
              </div>
            ) : (
              <div className="grid gap-4">
                {certificates.map((cert) => (
                  <div
                    key={cert.id}
                    className="p-5 bg-white dark:bg-slate-900/30 backdrop-blur-md rounded-2xl border border-slate-200 dark:border-slate-800/50 shadow-sm flex flex-col justify-between gap-4 hover:border-slate-300 dark:hover:border-slate-700/60 transition-colors"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                          АКТИВНИЙ КЕП
                        </span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                          SN: {cert.cert_serial.slice(0, 16)}...
                        </span>
                      </div>
                      
                      <h4 className="font-bold text-slate-800 dark:text-slate-200 mt-3 flex items-center gap-1.5">
                        <User className="w-4 h-4 text-indigo-500" />
                        {cert.cert_owner_name}
                      </h4>
                      
                      <div className="mt-2 space-y-1 text-xs text-slate-500 dark:text-slate-400 leading-normal">
                        <p><strong>Видавник:</strong> {cert.cert_issuer}</p>
                        <p className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>Дійсний до: {new Date(cert.valid_to).toLocaleDateString("uk-UA")}</span>
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
