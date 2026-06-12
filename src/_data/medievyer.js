// Korsprodukt av språk × medietyper – driver undersidorna /innehall/<kategori>/
import locales from "./locales.json" with { type: "json" };
import medietyper from "./medietyper.json" with { type: "json" };

export default locales.flatMap((loc) => medietyper.map((kat) => ({ loc, kat })));
