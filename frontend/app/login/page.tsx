"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { api } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    function applyTheme(): void {
      const isLight = localStorage.getItem("app_theme") === "light";
      document.documentElement.setAttribute("data-theme", isLight ? "light" : "dark");
    }

    applyTheme();
    window.addEventListener("storage", applyTheme);
    return () => window.removeEventListener("storage", applyTheme);
  }, []);

  async function onLogin(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const tokens = await api.login({ email, password });
      api.saveTokens(tokens);
      const next = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("next") || "/" : "/";
      router.push(next as never);
      router.refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Giriş başarısız.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="open-page auth-modern-page">
      <section className="open-panel auth-page-panel auth-modern-shell">
        <aside className="auth-brand-pane">
          <span className="auth-brand-chip">Konum Paylaş</span>
          <h1>Hesabına Güvenli Şekilde Giriş Yap</h1>
          <p className="muted">Konumlarını yönet, paylaşım kodlarını üret ve üyelik durumunu tek ekrandan kontrol et.</p>
          <ul className="auth-feature-list">
            <li>Kayıtlı konumlarını her zaman erişilebilir tut</li>
            <li>Pro plan ile sınırları kaldır</li>
            <li>Paylaşım ve hesap yönetimini tek merkezde topla</li>
          </ul>
        </aside>

        <div className="auth-form-pane">
          <h2>Giriş Yap</h2>
          <p className="muted">Hesabınla devam et</p>

          <form className="open-form auth-modern-form" onSubmit={onLogin}>
            <label>
              E-Posta
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </label>
            <label>
              Şifre
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
            </label>
            <button type="submit" disabled={loading}>
              {loading ? "Giriş Yapılıyor..." : "Giriş Yap"}
            </button>
          </form>

          {error ? <p className="toast-error">{error}</p> : null}

          <div className="auth-page-links">
            <Link href="/register">Hesabın yok mu? Kayıt ol</Link>
            <Link href="/">Ana sayfaya dön</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
