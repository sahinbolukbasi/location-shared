"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { api } from "@/lib/api";

export default function RegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
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

  async function onRegister(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const tokens = await api.register({
        full_name: fullName,
        email,
        password
      });
      api.saveTokens(tokens);
      const next = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("next") || "/" : "/";
      router.push(next as never);
      router.refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Kayıt başarısız.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="open-page auth-modern-page">
      <section className="open-panel auth-page-panel auth-modern-shell">
        <aside className="auth-brand-pane">
          <span className="auth-brand-chip">Konum Paylaş</span>
          <h1>Yeni Hesap Oluştur</h1>
          <p className="muted">Saniyeler içinde hesap açıp konumlarını güvenli bir şekilde kaydetmeye başla.</p>
          <ul className="auth-feature-list">
            <li>Konumlarını tek profilde yönet</li>
            <li>Paylaşım işlemlerini hızlandır</li>
            <li>Üyelik avantajlarını anında kullan</li>
          </ul>
        </aside>

        <div className="auth-form-pane">
          <h2>Kayıt Ol</h2>
          <p className="muted">Bilgilerini girerek hesabını oluştur</p>

          <form className="open-form auth-modern-form" onSubmit={onRegister}>
            <label>
              Ad Soyad
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} required minLength={2} maxLength={120} />
            </label>
            <label>
              E-Posta
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </label>
            <label>
              Şifre
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
            </label>
            <button type="submit" disabled={loading}>
              {loading ? "Kayıt Oluşturuluyor..." : "Kayıt Ol"}
            </button>
          </form>

          {error ? <p className="toast-error">{error}</p> : null}

          <div className="auth-page-links">
            <Link href="/login">Zaten hesabın var mı? Giriş yap</Link>
            <Link href="/">Ana sayfaya dön</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
