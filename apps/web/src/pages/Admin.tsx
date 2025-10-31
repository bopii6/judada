import { FormEvent, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "../api/client";
import type { QuestionBank } from "../api/types";
import { questionBankSchema, parseJsonQuestions } from "@judada/shared";

const ADMIN_KEY_STORAGE = "judada:adminKey";

const fetchAdminBanks = async (): Promise<QuestionBank[]> => {
  const { data } = await api.get<{ banks: QuestionBank[] }>("/admin/banks");
  return data.banks;
};

export const Admin = () => {
  const queryClient = useQueryClient();
  const [adminKey, setAdminKey] = useState<string>(() => localStorage.getItem(ADMIN_KEY_STORAGE) ?? "");
  const [form, setForm] = useState({
    code: "",
    name: "",
    description: "",
    levelMin: 1,
    levelMax: 3,
    isPlacement: false
  });
  const [jsonPayload, setJsonPayload] = useState("");
  const [currentBankId, setCurrentBankId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (adminKey) {
      api.defaults.headers.common["x-admin-key"] = adminKey;
    } else {
      delete api.defaults.headers.common["x-admin-key"];
    }
  }, [adminKey]);

  const { data: banks } = useQuery({
    queryKey: ["admin-banks"],
    queryFn: fetchAdminBanks,
    enabled: Boolean(adminKey)
  });

  const createBank = useMutation({
    mutationFn: async () => {
      const payload = questionBankSchema.parse({
        code: form.code,
        name: form.name,
        description: form.description || undefined,
        levelMin: form.levelMin,
        levelMax: form.levelMax,
        isPlacement: form.isPlacement
      });
      await api.post("/admin/banks", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-banks"] });
      setForm({ code: "", name: "", description: "", levelMin: 1, levelMax: 3, isPlacement: false });
      setMessage("题库创建成功");
    },
    onError: error => {
      setMessage(`创建失败: ${(error as Error).message}`);
    }
  });

  const handleSubmitKey = (event: FormEvent) => {
    event.preventDefault();
    localStorage.setItem(ADMIN_KEY_STORAGE, adminKey.trim());
    setMessage("已保存 ADMIN_KEY");
    queryClient.invalidateQueries({ queryKey: ["admin-banks"] });
  };

  const handleImportJson = async () => {
    if (!currentBankId) {
      setMessage("请选择目标题库");
      return;
    }
    try {
      const parsed = parseJsonQuestions(JSON.parse(jsonPayload));
      await api.post(`/admin/banks/${currentBankId}/import-json`, parsed);
      setMessage(`成功导入 ${parsed.length} 条题目`);
      setJsonPayload("");
    } catch (error) {
      setMessage(`导入失败: ${(error as Error).message}`);
    }
  };

  const handleImportPdf = async (file: File) => {
    if (!currentBankId) {
      setMessage("请选择目标题库");
      return;
    }
    const formData = new FormData();
    formData.append("file", file);
    try {
      const { data } = await api.post(`/admin/banks/${currentBankId}/import-pdf`, formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      setMessage(`PDF 解析成功，新增 ${data.inserted} 条题目`);
    } catch (error) {
      setMessage(`PDF 导入失败: ${(error as Error).message}`);
    }
  };

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-3xl font-bold text-slate-900">管理后台</h1>
        <p className="mt-2 text-sm text-slate-500">输入 ADMIN_KEY 后维护课程题库。</p>
        <form className="mt-4 flex gap-3" onSubmit={handleSubmitKey}>
          <input
            className="w-64 rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={adminKey}
            onChange={event => setAdminKey(event.target.value)}
            placeholder="ADMIN_KEY"
          />
          <button type="submit" className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white">
            保存
          </button>
        </form>
      </section>

      {message && <div className="rounded-lg bg-amber-100 px-4 py-2 text-sm text-amber-800">{message}</div>}

      {adminKey ? (
        <>
          <section className="rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-800">新建题库</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <input
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                placeholder="代码"
                value={form.code}
                onChange={event => setForm(prev => ({ ...prev, code: event.target.value }))}
              />
              <input
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                placeholder="名称"
                value={form.name}
                onChange={event => setForm(prev => ({ ...prev, name: event.target.value }))}
              />
              <input
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                placeholder="最小等级"
                type="number"
                min={1}
                max={6}
                value={form.levelMin}
                onChange={event => setForm(prev => ({ ...prev, levelMin: Number(event.target.value) }))}
              />
              <input
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                placeholder="最大等级"
                type="number"
                min={1}
                max={6}
                value={form.levelMax}
                onChange={event => setForm(prev => ({ ...prev, levelMax: Number(event.target.value) }))}
              />
            </div>
            <textarea
              className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="简介"
              rows={3}
              value={form.description}
              onChange={event => setForm(prev => ({ ...prev, description: event.target.value }))}
            />
            <label className="mt-3 flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={form.isPlacement}
                onChange={event => setForm(prev => ({ ...prev, isPlacement: event.target.checked }))}
              />
              定位测题库
            </label>
            <button
              type="button"
              className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white"
              onClick={() => createBank.mutate()}
            >
              创建题库
            </button>
          </section>

          <section className="rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-800">题库列表</h2>
            <div className="mt-4 grid gap-3">
              {(banks ?? []).map(bank => (
                <button
                  key={bank.id}
                  type="button"
                  className={`flex items-center justify-between rounded-lg border px-4 py-3 text-left ${
                    currentBankId === bank.id ? 'border-primary bg-blue-50' : 'border-slate-200'
                  }`}
                  onClick={() => setCurrentBankId(bank.id)}
                >
                  <div>
                    <div className="text-sm font-semibold text-slate-800">{bank.name}</div>
                    <div className="text-xs text-slate-500">{bank.code} · Tier {bank.levelMin}-{bank.levelMax}</div>
                  </div>
                  {bank.questionCount !== undefined && (
                    <div className="text-xs text-slate-500">{bank.questionCount} 题</div>
                  )}
                </button>
              ))}
              {!banks?.length && <div className="text-sm text-slate-500">暂无题库。</div>}
            </div>
          </section>

          {currentBankId && (
            <section className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-800">导入题目</h2>
              <p className="mt-1 text-xs text-slate-500">支持 JSON（Question[]）或 PDF。</p>
              <textarea
                className="mt-3 h-48 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-mono"
                placeholder="粘贴 JSON 数组"
                value={jsonPayload}
                onChange={event => setJsonPayload(event.target.value)}
              />
              <div className="mt-3 flex gap-3">
                <button
                  type="button"
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white"
                  onClick={handleImportJson}
                >
                  导入 JSON
                </button>
                <label className="text-sm text-slate-600">
                  <span className="rounded-lg border border-slate-300 px-3 py-2 hover:bg-slate-100">上传 PDF</span>
                  <input
                    type="file"
                    accept="application/pdf"
                    className="hidden"
                    onChange={event => {
                      const file = event.target.files?.[0];
                      if (file) {
                        handleImportPdf(file);
                        event.target.value = '';
                      }
                    }}
                  />
                </label>
              </div>
            </section>
          )}
        </>
      ) : (
        <p className="text-sm text-slate-500">请输入 ADMIN_KEY 后继续。</p>
      )}
    </div>
  );
};
