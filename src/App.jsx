import { useEffect, useMemo, useState } from "react";
import Aurora from "./Aurora";
import "./App.css";

const TIME_ZONE = "America/Sao_Paulo";

const toDateString = (date) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);

const parseDateStringLocal = (value) => {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [, year, month, day] = match;
  return new Date(Number(year), Number(month) - 1, Number(day));
};

const formatDate = (value) => {
  const date = parseDateStringLocal(value) || new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const getYesterdayDate = () => {
  const tzNow = new Date(new Date().toLocaleString("en-US", { timeZone: TIME_ZONE }));
  tzNow.setDate(tzNow.getDate() - 1);
  return toDateString(tzNow);
};

function App() {
  const [payload, setPayload] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const skeletonCards = useMemo(() => new Array(3).fill(0), []);

  useEffect(() => {
    const loadDailyNews = async () => {
      const date = getYesterdayDate();
      try {
        const base = import.meta.env.BASE_URL;
        const response = await fetch(`${base}feeds/daily/${date}.json`);
        if (!response.ok) throw new Error("Falha ao carregar JSON");
        const data = await response.json();
        setPayload(data);
      } catch (error) {
        setPayload(null);
      } finally {
        setIsLoading(false);
      }
    };

    loadDailyNews();
  }, []);

  const summaryTitle = payload?.summary?.title || "Resumo do dia em Design";
  const summaryText = payload?.summary?.text || "";
  const summaryDate = payload?.date ? formatDate(payload.date) : "";
  const totalArticles = payload?.stats?.totalArticles || 0;
  const totalSources = payload?.stats?.sources || 0;
  const articles = payload?.articles || [];

  return (
    <div className="app-shell">
      <div className="aurora-layer" aria-hidden="true">
        <Aurora
          colorStops={["#4DA3FF", "#2B5BFF", "#1A2B6D"]}
          blend={0.45}
          amplitude={0.9}
          speed={1}
        />
      </div>

      <main className="page">
        <section className="content">
          <section className="hero">
            <div className="hero-meta">
              <span className="badge">Resumo</span>
              <span className="text text-sm">
                {summaryDate || (isLoading ? "Carregando..." : "Ontem")}
              </span>
            </div>
            <header className="page-header">
              <h1 className="heading-1 page-title" id="day-title">
                Yesterday in design
              </h1>
              <p className="text text-sm" id="day-subtitle">
                Simplesmente, o que aconteceu ontem
              </p>
              <p className="text hero-summary">
                {summaryText || (isLoading ? "Atualizando..." : "")}
              </p>
            </header>
          </section>

          <section className="news-section">
            <h2 className="heading-3">Noticias de ontem</h2>
            <div className="news-grid" id="news-list">
              {isLoading && skeletonCards.map((_, index) => (
                <article
                  className="card"
                  style={{ display: "grid", gap: "var(--space-4)" }}
                  key={`skeleton-${index}`}
                >
                  <div className="skeleton" style={{ height: 16, width: "60%" }} />
                  <div className="skeleton" style={{ height: 20, width: "90%" }} />
                  <div className="skeleton" style={{ height: 14, width: "80%" }} />
                </article>
              ))}

              {!isLoading &&
                articles.map((article) => (
                  <article className="card news-card" key={article.id}>
                    <span className="text text-sm">
                      {article.source} · {formatDate(article.publishedAt)}
                    </span>
                    <h3 className="heading-4">{article.title}</h3>
                    <p className="text text-sm">{article.excerpt}</p>
                    <a className="link" href={article.url} target="_blank" rel="noreferrer">
                      Continuar lendo
                    </a>
                  </article>
                ))}
            </div>
          </section>
        </section>
      </main>
    </div>
  );
}

export default App;
