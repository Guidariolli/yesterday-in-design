import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const SOURCES_PATH = path.join(ROOT, "feeds", "sources.json");
const RAW_DIR = path.join(ROOT, "feeds", "raw");
const DAILY_DIR = path.join(ROOT, "feeds", "daily");
const APP_PUBLIC_DAILY_DIR = path.join(ROOT, "public", "feeds", "daily");

const MAX_ITEMS_PER_FEED = 30;
const TIME_ZONE = "America/Sao_Paulo";

const formatDateInTimeZone = (date) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);

const toDateString = (date) => formatDateInTimeZone(date);

const getTimeZoneOffset = (date, timeZone) => {
  const tzDate = new Date(date.toLocaleString("en-US", { timeZone }));
  return date.getTime() - tzDate.getTime();
};

const makeDateInTimeZone = (
  year,
  month,
  day,
  hours = 0,
  minutes = 0,
  seconds = 0,
  ms = 0
) => {
  const utcDate = new Date(
    Date.UTC(year, month - 1, day, hours, minutes, seconds, ms)
  );
  const offset = getTimeZoneOffset(utcDate, TIME_ZONE);
  return new Date(utcDate.getTime() + offset);
};

const getYesterdayRange = () => {
  const tzNow = new Date(new Date().toLocaleString("en-US", { timeZone: TIME_ZONE }));
  tzNow.setDate(tzNow.getDate() - 1);
  const year = tzNow.getFullYear();
  const month = tzNow.getMonth() + 1;
  const day = tzNow.getDate();

  const start = makeDateInTimeZone(year, month, day, 0, 0, 0, 0);
  const end = makeDateInTimeZone(year, month, day, 23, 59, 59, 999);
  return { start, end };
};

const isYesterday = (date) => {
  if (!date) return false;
  const { start, end } = getYesterdayRange();
  return date >= start && date <= end;
};

const parseDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const stripHtml = (html = "") =>
  html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const stripCdata = (value) =>
  value.replace(/^<!\[CDATA\[(.*)\]\]>$/s, "$1").trim();

const extractAllTags = (block, tag) => {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "gi");
  const matches = [];
  let match;
  while ((match = regex.exec(block))) {
    matches.push(stripCdata(match[1]));
  }
  return matches;
};

const extractFirstTag = (block, tag) => {
  const [value] = extractAllTags(block, tag);
  return value || "";
};

const extractTagNames = (block) => {
  const tags = new Set();
  extractAllTags(block, "category").forEach((value) => {
    if (value) tags.add(value.toLowerCase());
  });
  return Array.from(tags).slice(0, 6);
};

const slugify = (value) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

const normalizeItem = (block, sourceName) => {
  const title = extractFirstTag(block, "title");
  const link = extractFirstTag(block, "link");
  const pubDate =
    extractFirstTag(block, "pubDate") || extractFirstTag(block, "updated");
  const date = parseDate(pubDate);
  const description =
    extractFirstTag(block, "description") || extractFirstTag(block, "summary");

  if (!title || !link || !date) return null;
  if (!isYesterday(date)) return null;

  const id = `${slugify(sourceName)}-${slugify(title)}-${toDateString(date)}`;
  return {
    id,
    title,
    source: sourceName,
    publishedAt: toDateString(date),
    url: link,
    excerpt: stripHtml(description).slice(0, 220),
    tags: extractTagNames(block),
  };
};

const readSources = () => JSON.parse(fs.readFileSync(SOURCES_PATH, "utf-8"));

const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

const fetchFeed = async ({ name, url }) => {
  try {
    const response = await fetch(url);
    if (!response.ok) return { name, items: [], error: response.status };
    const xmlText = await response.text();
    const items = Array.from(xmlText.matchAll(/<item>([\s\S]*?)<\/item>/gi))
      .map((match) => normalizeItem(match[1], name))
      .filter(Boolean)
      .slice(0, MAX_ITEMS_PER_FEED);
    return { name, items };
  } catch (error) {
    return { name, items: [], error: error.message };
  }
};

const buildSummaryPlaceholder = (articles) => {
  if (!articles.length) {
    return {
      title: "Resumo do dia em Design",
      text: "Nao houve artigos relevantes publicados ontem.",
    };
  }

  const sources = Array.from(new Set(articles.map((a) => a.source)));
  return {
    title: "Resumo do dia em Design",
    text:
      "O dia trouxe atualizacoes relevantes em design, UX e produto. " +
      `As principais fontes foram ${sources.slice(0, 3).join(", ")}.` +
      " Este resumo sera aprimorado no pipeline diario.",
  };
};

const run = async () => {
  ensureDir(RAW_DIR);
  ensureDir(DAILY_DIR);
  ensureDir(APP_PUBLIC_DAILY_DIR);

  const sources = readSources();
  const results = await Promise.allSettled(sources.map(fetchFeed));
  const successful = results.map((result) =>
    result.status === "fulfilled" ? result.value : { items: [] }
  );

  const rawPath = path.join(RAW_DIR, `${toDateString(new Date())}.json`);
  fs.writeFileSync(rawPath, JSON.stringify(successful, null, 2));

  const articles = successful.flatMap((entry) => entry.items);
  const uniqueSources = new Set(articles.map((article) => article.source));

  const { start } = getYesterdayRange();
  const dailyPayload = {
    date: toDateString(start),
    summary: buildSummaryPlaceholder(articles),
    stats: {
      totalArticles: articles.length,
      sources: uniqueSources.size,
    },
    articles,
  };

  const dailyPath = path.join(DAILY_DIR, `${dailyPayload.date}.json`);
  fs.writeFileSync(dailyPath, JSON.stringify(dailyPayload, null, 2));

  const appDailyPath = path.join(
    APP_PUBLIC_DAILY_DIR,
    `${dailyPayload.date}.json`
  );
  fs.writeFileSync(appDailyPath, JSON.stringify(dailyPayload, null, 2));
};

run();
