import { fetchDiscoveryProducts } from "@/services/discoveryService";
import type { BrowseCategory, DiscoveredProduct } from "@/types/discovery";
import { useEffect, useMemo, useRef, useState } from "react";

/**
 * Live search for the home screen.
 *
 * WHY A HOOK AND NOT AN EFFECT IN home.tsx
 *
 * The dropdown needs three things an inline effect gets wrong: it must not fire on
 * mount, it must not fire on every keystroke, and it must ignore a slow response
 * that arrives after a newer query has already been typed. All three are about
 * request lifetime rather than rendering, so they live here where the sequencing
 * can be tested by reading one file.
 *
 * Everything it returns comes from customer_products through
 * discoveryService -- there is no local list to fall back on, so a suggestion is
 * only ever shown when the database has a matching live listing.
 */

/** How long typing has to pause before a request goes out. */
const DEBOUNCE_MS = 250;

/** How many products the dropdown shows. */
const PRODUCT_LIMIT = 6;

/** How many categories the dropdown shows. */
const CATEGORY_LIMIT = 4;

export type HomeSearchResults = {
  /** The term the results below describe. */
  query: string;
  products: DiscoveredProduct[];
  categories: BrowseCategory[];
  /** A request is in flight. */
  loading: boolean;
  /** The query failed. Suggestions close rather than showing a stale list. */
  error: string;
  /** True once a query has resolved and found nothing. */
  empty: boolean;
  /** A completed query with at least one thing to show. */
  hasResults: boolean;
};

const IDLE: HomeSearchResults = {
  query: "",
  products: [],
  categories: [],
  loading: false,
  error: "",
  empty: false,
  hasResults: false,
};

/**
 * Categories are matched here rather than in SQL.
 *
 * listBrowseCategories reads one column for every active listing, which is one
 * request and already cached by the screen that owns the rail. Folding the term
 * over that is free, and it keeps the dropdown consistent with the rail -- the
 * same label is what the shopper is shown in both places.
 */
function matchCategories(
  all: BrowseCategory[],
  term: string,
): BrowseCategory[] {
  const needle = term.trim().toLowerCase();
  if (!needle) return [];

  return all
    .filter((entry) => entry.name.toLowerCase().includes(needle))
    .slice(0, CATEGORY_LIMIT);
}

export function useHomeSearch(
  /** The categories the home rail already holds, reused instead of refetched. */
  knownCategories: BrowseCategory[],
): HomeSearchResults & {
  setQuery: (value: string) => void;
  clear: () => void;
} {
  const [results, setResults] = useState<HomeSearchResults>(IDLE);

  // The categories live in a ref so a rail refresh cannot restart the query. The
  // list is only ever read inside the async callback below, never during render,
  // which is what writing it here would be.
  const categoriesRef = useRef(knownCategories);

  useEffect(() => {
    categoriesRef.current = knownCategories;
  }, [knownCategories]);

  // Incremented per query. A response whose number is behind the current one is
  // discarded, which is what stops a slow request for "m" overwriting the
  // results for "milk" typed a moment later.
  const requestId = useRef(0);

  useEffect(() => {
    const term = results.query.trim();

    // Nothing typed: no request. The dropdown reads as empty on the term alone --
    // see the returned `open` flag -- so there is no state to reset here, and no
    // setState in this effect body for a case that renders identically either way.
    if (!term) return;

    const current = ++requestId.current;

    // The spinner is set inside the debounce rather than here, so a keystroke
    // that is immediately superseded by another does not flash a loading state
    // for a request that was never sent. It also keeps this effect body free of a
    // synchronous setState, which cascades a render before the timer is even armed.
    const timer = setTimeout(() => {
      setResults((previous) => ({ ...previous, loading: true, error: "" }));
      fetchDiscoveryProducts({ query: term, limit: PRODUCT_LIMIT })
        .then((products) => {
          if (current !== requestId.current) return;

          const categories = matchCategories(categoriesRef.current, term);

          setResults({
            query: term,
            products,
            categories,
            loading: false,
            error: "",
            empty: products.length === 0 && categories.length === 0,
            hasResults: products.length > 0 || categories.length > 0,
          });
        })
        .catch(() => {
          if (current !== requestId.current) return;

          // No stale suggestions: a list that does not match what is in the box is
          // worse than none, so the dropdown closes and says why.
          setResults({
            query: term,
            products: [],
            categories: [],
            loading: false,
            error: "Search is unavailable right now.",
            empty: false,
            hasResults: false,
          });
        });
    }, DEBOUNCE_MS);

    // Clearing the timer on every change is what makes it a debounce rather than
    // a delay: a second keystroke cancels the first request before it is sent.
    return () => clearTimeout(timer);
  }, [results.query]);

  /**
   * What the dropdown should render right now.
   *
   * Derived rather than stored: an empty box shows IDLE no matter what the last
   * query returned, so the consumer never has to clear anything when the field is
   * emptied, and there is no stale result flash behind a cleared input.
   */
  const visible = useMemo(
    () => (results.query.trim() ? results : IDLE),
    [results],
  );

  return {
    ...visible,
    setQuery: (value: string) =>
      setResults((previous) => ({ ...previous, query: value })),
    clear: () => {
      // Invalidate any response still in flight, so clearing mid-request cannot
      // leave results on screen for a term the box no longer holds.
      ++requestId.current;
      setResults(IDLE);
    },
  };
}