"use client";

import Link from "next/link";
import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { api } from "@/lib/api";
import { PaymentHistoryItem, Profile } from "@/lib/types";

type Notice = { type: "ok" | "error"; text: string } | null;

export default function AccountPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [payments, setPayments] = useState<PaymentHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<Notice>(null);

  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [imageData, setImageData] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [startingCheckout, setStartingCheckout] = useState(false);

  const reachedFreeLimit = useMemo(() => {
    if (!profile) return false;
    return profile.plan === "free" && profile.location_limit <= 5;
  }, [profile]);

  const avatarSource = imageData ?? profile?.profile_image_data ?? null;

  const profileInitials = useMemo(() => {
    const source = fullName.trim() || profile?.email || "K";
    const parts = source.split(" ").filter(Boolean);
    if (parts.length === 1) {
      return parts[0].slice(0, 2).toUpperCase();
    }
    return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
  }, [fullName, profile?.email]);

  useEffect(() => {
    function applyTheme(): void {
      const isLight = localStorage.getItem("app_theme") === "light";
      document.documentElement.setAttribute("data-theme", isLight ? "light" : "dark");
    }

    applyTheme();
    window.addEventListener("storage", applyTheme);
    return () => window.removeEventListener("storage", applyTheme);
  }, []);

  useEffect(() => {
    async function load(): Promise<void> {
      try {
        const me = await api.getProfile();
        const list = await api.listPayments();
        setProfile(me);
        setPayments(list);
        setFullName(me.full_name);
        setUsername(me.username ?? "");
        setImageData(me.profile_image_data ?? null);
      } catch {
        router.push("/login?next=/account");
      } finally {
        setLoading(false);
      }
    }

    load().catch(() => {
      router.push("/login?next=/account");
    });
  }, [router]);

  async function onProfileImageChange(e: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : null;
      setImageData(result);
    };
    reader.readAsDataURL(file);
  }

  async function onSaveProfile(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setNotice(null);
    setSavingProfile(true);

    try {
      const updated = await api.updateProfile({
        full_name: fullName,
        username: username.trim() ? username.trim() : null,
        profile_image_data: imageData
      });
      setProfile(updated);
      setNotice({ type: "ok", text: "Profil güncellendi." });
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "Profil güncellenemedi." });
    } finally {
      setSavingProfile(false);
    }
  }

  async function onChangePassword(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setNotice(null);

    if (newPassword !== confirmPassword) {
      setNotice({ type: "error", text: "Yeni şifre ve tekrar şifre aynı olmalı." });
      return;
    }

    setSavingPassword(true);
    try {
      await api.changePassword({
        current_password: currentPassword || null,
        new_password: newPassword
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setNotice({ type: "ok", text: "Şifre güncellendi." });
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "Şifre güncellenemedi." });
    } finally {
      setSavingPassword(false);
    }
  }

  async function onStartCheckout(): Promise<void> {
    setNotice(null);
    setStartingCheckout(true);
    try {
      const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
      const response = await api.createCheckoutSession({
        success_url: `${origin}/account?checkout=success`,
        cancel_url: `${origin}/account?checkout=cancel`
      });
      window.location.href = response.checkout_url;
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "Ödeme sayfası açılamadı." });
      setStartingCheckout(false);
    }
  }

  function onLogout(): void {
    api.clearTokens();
    router.push("/login");
  }

  if (loading) {
    return (
      <main className="open-page">
        <section className="open-panel">
          <p className="muted">Yükleniyor...</p>
        </section>
      </main>
    );
  }

  return (
    <main className="open-page account-page-bg">
      <section className="open-panel account-page-panel account-shell">
        <header className="account-hero">
          <div className="account-identity">
            <div className="account-avatar" aria-hidden="true">
              {avatarSource ? <img src={avatarSource} alt="Profil" className="profile-preview" /> : <span>{profileInitials}</span>}
            </div>
            <div className="account-identity-text">
              <h1>Hesabım</h1>
              <p className="muted">{profile?.email}</p>
            </div>
          </div>
          <div className="btn-row compact account-head-buttons">
            <Link href="/" className="link-button link-button-secondary">
              Ana Sayfa
            </Link>
            <button className="btn-secondary" type="button" onClick={onLogout}>
              Çıkış
            </button>
          </div>
        </header>

        {notice ? <p className={notice.type === "ok" ? "toast-ok" : "toast-error"}>{notice.text}</p> : null}

        <section className="account-layout">
          <aside className="account-section account-sidebar-card">
            <div className="account-avatar account-avatar-large" aria-hidden="true">
              {avatarSource ? <img src={avatarSource} alt="Profil" className="profile-preview" /> : <span>{profileInitials}</span>}
            </div>

            <div className="account-sidebar-meta">
              <h2>{fullName || "Hesap Sahibi"}</h2>
              <p className="muted">{profile?.email}</p>
            </div>

            <div className="account-kpis" aria-label="Hesap özeti">
              <article className="account-kpi">
                <span>Plan</span>
                <strong>{profile?.plan?.toUpperCase()}</strong>
              </article>
              <article className="account-kpi">
                <span>Durum</span>
                <strong>{profile?.subscription_status}</strong>
              </article>
              <article className="account-kpi">
                <span>Kayıt Limiti</span>
                <strong>{profile?.location_limit === 1000000 ? "Sınırsız" : profile?.location_limit}</strong>
              </article>
            </div>

            {profile?.plan !== "pro" || profile?.subscription_status !== "active" ? (
              <button type="button" onClick={onStartCheckout} disabled={startingCheckout}>
                {startingCheckout ? "Yönlendiriliyor..." : "Stripe ile Pro'ya Geç ($1/ay)"}
              </button>
            ) : (
              <p className="toast-ok">Pro üyeliğin aktif.</p>
            )}

            {reachedFreeLimit ? (
              <p className="toast-error">5 kayıt sınırına ulaştığında yeni kayıt için ödeme gerekli.</p>
            ) : null}
          </aside>

          <div className="account-main-stack">
            <article className="account-section account-card">
              <h2>Profil Bilgileri</h2>
              <form className="open-form account-form" onSubmit={onSaveProfile}>
                <div className="account-field-grid">
                  <label>
                    Ad Soyad
                    <input value={fullName} onChange={(e) => setFullName(e.target.value)} required minLength={2} maxLength={120} />
                  </label>
                  <label>
                    Kullanıcı Adı
                    <input value={username} onChange={(e) => setUsername(e.target.value)} minLength={3} maxLength={60} />
                  </label>
                </div>
                <label>
                  Profil Resmi
                  <input type="file" accept="image/*" onChange={onProfileImageChange} />
                </label>
                <button type="submit" disabled={savingProfile}>
                  {savingProfile ? "Kaydediliyor..." : "Profili Kaydet"}
                </button>
              </form>
            </article>

            <article className="account-section account-card">
              <h2>Şifre Değiştir</h2>
              <form className="open-form" onSubmit={onChangePassword}>
                <label>
                  Mevcut Şifre
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Google ile kayıt olduysan boş bırak"
                  />
                </label>
                <label>
                  Yeni Şifre
                  <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={8} />
                </label>
                <label>
                  Yeni Şifre (Tekrar)
                  <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={8} />
                </label>
                <button type="submit" disabled={savingPassword}>
                  {savingPassword ? "Güncelleniyor..." : "Şifreyi Güncelle"}
                </button>
              </form>
            </article>

            <article className="account-section account-card">
              <h2>Ödeme Geçmişi</h2>
              {!payments.length ? <p className="muted">Henüz ödeme kaydı yok.</p> : null}
              <div className="payment-list">
                {payments.map((payment) => (
                  <article className="resolved-box" key={payment.id}>
                    <p>
                      {(payment.amount_cents / 100).toFixed(2)} {payment.currency.toUpperCase()} • {payment.status}
                    </p>
                    <p className="muted">{new Date(payment.created_at).toLocaleString()}</p>
                  </article>
                ))}
              </div>
            </article>
          </div>
        </section>
      </section>
    </main>
  );
}
