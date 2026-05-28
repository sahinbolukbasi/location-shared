"use client";

import { FormEvent, useState } from "react";
import { api } from "@/lib/api";
import { ShareCode } from "@/lib/types";

export default function OpenByCodePage() {
  const [code, setCode] = useState("");
  const [resolved, setResolved] = useState<ShareCode | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onResolve(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setError(null);
    setResolved(null);

    try {
      const result = await api.resolveShareCode(code);
      setResolved(result);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Code lookup failed");
    }
  }

  return (
    <main className="open-page">
      <section className="open-panel">
        <h1>Kod ile Konum Bul</h1>
        <p className="muted">Paylaşılmış konumu açmak için 6 haneli kodu gir.</p>

        <form className="open-form" onSubmit={onResolve}>
          <label>
            Paylaşım Kodu
            <input value={code} onChange={(e) => setCode(e.target.value)} maxLength={6} minLength={6} required />
          </label>
          <button type="submit">Konumu Çöz</button>
        </form>

        {error ? <p className="toast-error">{error}</p> : null}

        {resolved ? (
          <div className="resolved-box">
            <h2>{resolved.location_name}</h2>
            <p className="muted">
              {resolved.latitude}, {resolved.longitude}
            </p>
            <p className="muted">Süre Sonu: {new Date(resolved.expires_at).toLocaleString()}</p>
          </div>
        ) : null}
      </section>
    </main>
  );
}
