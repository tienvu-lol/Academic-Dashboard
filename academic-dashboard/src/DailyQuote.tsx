import {useCallback, useEffect, useState} from "react";
import {Quote, RefreshCcw} from "lucide-react";
import {cn} from "@/lib/cn";

type DailyQuoteValue = {
  text: string;
  author: string;
  date: string;
};

const CACHE_KEY = "university-command-center-daily-quote";
const HISTORICAL_AUTHORS = [
  "marcus-aurelius",
  "seneca",
  "epictetus",
  "benjamin-franklin",
  "ralph-waldo-emerson",
  "thomas-edison",
  "abraham-lincoln",
  "frederick-douglass",
  "booker-t-washington",
  "helen-keller",
  "confucius",
  "aristotle",
  "plato",
].join("|");

const FALLBACK_QUOTES = [
  {text: "Well done is better than well said.", author: "Benjamin Franklin"},
  {text: "Lost time is never found again.", author: "Benjamin Franklin"},
  {text: "An investment in knowledge pays the best interest.", author: "Benjamin Franklin"},
  {text: "Nothing great was ever achieved without enthusiasm.", author: "Ralph Waldo Emerson"},
  {text: "Genius is one percent inspiration and ninety-nine percent perspiration.", author: "Thomas Edison"},
];

function localDateKey() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function fallbackQuote(offset = 0): DailyQuoteValue {
  const date = localDateKey();
  const seed = [...date].reduce((total, character) => total + character.charCodeAt(0), 0);
  const quote = FALLBACK_QUOTES[(seed + offset) % FALLBACK_QUOTES.length];
  return {...quote, date};
}

function readCachedQuote(): DailyQuoteValue | null {
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) ?? "null") as DailyQuoteValue | null;
    return cached?.date === localDateKey() && cached.text && cached.author ? cached : null;
  } catch {
    return null;
  }
}

async function fetchHistoricalQuote(): Promise<DailyQuoteValue> {
  const query = new URLSearchParams({
    author: HISTORICAL_AUTHORS,
    maxLength: "160",
    limit: "1",
  });
  const response = await fetch(`https://api.quotable.io/quotes/random?${query.toString()}`, {
    headers: {Accept: "application/json"},
  });
  if (!response.ok) throw new Error(`Quote service returned ${response.status}`);
  const data = await response.json() as Array<{content?: string; author?: string}>;
  const result = data[0];
  if (!result?.content || !result.author || result.content.trim().split(/\s+/).length > 25) {
    throw new Error("Quote service returned an unsupported quote");
  }
  return {text: result.content, author: result.author, date: localDateKey()};
}

export function DailyQuote() {
  const [quote, setQuote] = useState<DailyQuoteValue>(() => readCachedQuote() ?? fallbackQuote());
  const [isLoading, setIsLoading] = useState(false);
  const [refreshCount, setRefreshCount] = useState(0);

  const refresh = useCallback(async (manual = false) => {
    const cached = readCachedQuote();
    if (!manual && cached) {
      setQuote(cached);
      return;
    }
    setIsLoading(true);
    try {
      const next = await fetchHistoricalQuote();
      localStorage.setItem(CACHE_KEY, JSON.stringify(next));
      setQuote(next);
    } catch {
      const next = fallbackQuote(manual ? refreshCount + 1 : 0);
      localStorage.setItem(CACHE_KEY, JSON.stringify(next));
      setQuote(next);
    } finally {
      setIsLoading(false);
      if (manual) setRefreshCount((count) => count + 1);
    }
  }, [refreshCount]);

  useEffect(() => {
    if (!readCachedQuote()) void refresh(false);
  }, [refresh]);

  return (
    <div className="mb-4 flex items-start gap-3 rounded-lg border bg-muted p-3">
      <span className="grid size-8 shrink-0 place-items-center rounded-md highlight-purple">
        <Quote className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-5">“{quote.text}”</p>
        <p className="mt-1 text-xs text-muted-foreground">— {quote.author} · refreshed daily</p>
      </div>
      <button
        type="button"
        onClick={() => void refresh(true)}
        disabled={isLoading}
        className="grid size-8 shrink-0 place-items-center rounded-md border bg-background text-muted-foreground hover:bg-accent disabled:cursor-wait disabled:opacity-60"
        aria-label="Get another inspirational quote"
        title="Get another quote"
      >
        <RefreshCcw className={cn("size-3.5", isLoading && "animate-spin")} />
      </button>
    </div>
  );
}
