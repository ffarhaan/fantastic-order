/**
 * Shared personnel-name parsing for Shipment Error analytics.
 *
 * Used by both the server (`/api/tidb?action=personnel_stats`) and the client
 * (`components/returns/AnalisisView.tsx`) so the Personil tab and the Analisis tab
 * always count names exactly the same way.
 */

export const PERSON_EXCLUDE_WORDS = new Set([
  "REJECT", "-", "#N/A", "NONE", "NULL", "ADMIN",
  "KESALAHAN PAXEL", "PAXEL", "EXPEDISI", "EKSPEDISI",
  "TIKI", "JNE", "SICEPAT", "ANTERAJA", "GOSEND", "GRAB", "LALAMOVE",
  "QC SESUAI", "TIDAK ADA", "TIDAK DIKETAHUI", "UNKNOWN",
]);

// Smart Person Name Canonicalization (Merges nicknames/short names with official staff names)
export const PERSON_CANONICAL_MAP: Record<string, string> = {
  "BUDI": "BUDI SUSANTO",
  "BUDI SUSANTO": "BUDI SUSANTO",
  "ZAID": "ZAID AKMAL HUDA",
  "ZAID AKMAL HUDA": "ZAID AKMAL HUDA",
  "HASBI": "HASBIYAALLAH",
  "HASBIYALLAH": "HASBIYAALLAH",
  "HASBIYAALLAH": "HASBIYAALLAH",
  "KHASBIYA": "HASBIYAALLAH",
  "KHASBIYA RIZQI": "HASBIYAALLAH",
  "OGI": "OGI SAPUTRA",
  "OGIK": "OGI SAPUTRA",
  "OGI SAPUTRA": "OGI SAPUTRA",
  "DEFRI": "DEPRI",
  "DEPRI": "DEPRI",
  "SYUD": "MUHAMAD SYU'UD",
  "SYU'UD": "MUHAMAD SYU'UD",
  "WIBI": "WIBI ANDRIANSYAH",
  "WIBI ANDRIANSYAH": "WIBI ANDRIANSYAH",
  "AGUS": "AGUS SUROSO",
  "AGUS SUROSO": "AGUS SUROSO",
};

/**
 * Splits a raw `person` value (e.g. "RIPAL / ZAID", "AGUS/FAHRI/FATHUR", "wibi")
 * into canonical, upper-cased individual names. Returns [] when nothing valid remains.
 */
export function parsePersonNames(rawValue: string | null | undefined): string[] {
  let raw = String(rawValue || "").trim();
  if (!raw) return [];

  // Remove parenthetical annotations like (picker), (checker), (gudang)
  raw = raw.replace(/\([^)]*\)/g, " ");

  // Pre-clean legacy merged prefixes without separator (e.g. ARDRIDWAN -> ARDIN / RIDWAN)
  raw = raw.replace(/\bARD(ANDRE|IDAL|WIBI|HIMAWAN|ASWIN|FARIS|YONNO|TRI|BUDI|RIDWAN)\b/gi, "ARDIN / $1");
  raw = raw.replace(/\bARDN\//gi, "ARDIN / ");

  // Split by /, \, ,, +, &, " - ", " dan ", " and "
  const parts = raw.split(/[\/\\,+&]|\s+-\s+|\s+dan\s+|\s+and\s+/i);

  const result: string[] = [];
  const seen = new Set<string>();
  for (let p of parts) {
    p = p.replace(/^[.\\\/\s\-_]+|[.\\\/\s\-_]+$/g, "").replace(/\s+/g, " ").trim();
    if (!p) continue;
    const norm = p.toUpperCase();
    if (PERSON_EXCLUDE_WORDS.has(norm)) continue;
    if (norm.length <= 1) continue;
    const canonical = PERSON_CANONICAL_MAP[norm] || norm;
    if (seen.has(canonical)) continue;
    seen.add(canonical);
    result.push(canonical);
  }
  return result;
}
