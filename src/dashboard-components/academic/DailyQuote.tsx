import {useState} from "react";
import {Quote, RefreshCcw} from "lucide-react";

const QUOTES = [
  {text: "Well done is better than well said.", author: "Benjamin Franklin"},
  {text: "Lost time is never found again.", author: "Benjamin Franklin"},
  {text: "An investment in knowledge pays the best interest.", author: "Benjamin Franklin"},
  {text: "Nothing great was ever achieved without enthusiasm.", author: "Ralph Waldo Emerson"},
  {text: "Genius is one percent inspiration and ninety-nine percent perspiration.", author: "Thomas Edison"},
];

function dailyIndex() {
  const date = new Date();
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000) % QUOTES.length;
}

/** Bundled quotes keep the dashboard available without a network connection. */
export function DailyQuote() {
  const [index, setIndex] = useState(dailyIndex);
  const quote = QUOTES[index];

  return (
    <div className="mb-4 flex items-start gap-3 rounded-lg border bg-muted p-3">
      <span className="grid size-8 shrink-0 place-items-center rounded-md highlight-purple">
        <Quote className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-5">“{quote.text}”</p>
        <p className="mt-1 text-xs text-muted-foreground">— {quote.author} · Daily inspiration</p>
      </div>
      <button
        type="button"
        onClick={() => setIndex((current) => (current + 1) % QUOTES.length)}
        className="grid size-8 shrink-0 place-items-center rounded-md border bg-background text-muted-foreground hover:bg-accent"
        aria-label="Get another inspirational quote"
        title="Get another quote"
      >
        <RefreshCcw className="size-3.5" />
      </button>
    </div>
  );
}
