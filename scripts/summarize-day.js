import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const DAILY_DIR = path.join(ROOT, "feeds", "daily");

const TIME_ZONE = "America/Sao_Paulo";

const toDateString = (date) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);

const getTargetDate = () => {
  const arg = process.argv[2];
  if (arg) return arg;
  const tzNow = new Date(new Date().toLocaleString("en-US", { timeZone: TIME_ZONE }));
  tzNow.setDate(tzNow.getDate() - 1);
  return toDateString(tzNow);
};

const buildSummary = (articles) => {
  if (!articles.length) {
    return {
      title: "Resumo do dia em Design",
      text: "Nao houve artigos relevantes publicados ontem.",
    };
  }

  const sources = Array.from(new Set(articles.map((a) => a.source)));
  const total = articles.length;
  const topSources = sources.slice(0, 3).join(", ");

  return {
    title: "Resumo do dia em Design",
    text:
      `Foram publicados ${total} artigos ontem, com foco em design, UX e produto. ` +
      `As fontes mais presentes incluem ${topSources}. ` +
      "O resumo final sera refinado no pipeline diario.",
  };
};

const run = () => {
  const date = getTargetDate();
  const dailyPath = path.join(DAILY_DIR, `${date}.json`);
  if (!fs.existsSync(dailyPath)) {
    console.error(`Arquivo diario nao encontrado: ${dailyPath}`);
    process.exit(1);
  }

  const dailyPayload = JSON.parse(fs.readFileSync(dailyPath, "utf-8"));
  dailyPayload.summary = buildSummary(dailyPayload.articles || []);

  fs.writeFileSync(dailyPath, JSON.stringify(dailyPayload, null, 2));
};

run();
