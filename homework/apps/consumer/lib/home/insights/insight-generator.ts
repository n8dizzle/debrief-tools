/**
 * Generates contextual insights based on property data
 * Used to create "aha moments" during the reveal cascade
 */

import type { PropertyData } from "@/lib/property-data-client"

export type Insight = {
  type: "age" | "hvac" | "roof" | "systems" | "general"
  title: string
  body: string
  tone: "informative" | "noteworthy" | "positive"
}

/**
 * Generate insights based on property data
 * Returns array sorted by relevance
 */
export function generateInsights(data: PropertyData | null): Insight[] {
  if (!data) return []

  const insights: Insight[] = []
  const currentYear = new Date().getFullYear()

  // Age-based insights with pop culture references
  if (data.yearBuilt) {
    const popCultureRef = getPopCultureReference(data.yearBuilt)
    if (popCultureRef) {
      insights.push({
        type: "age",
        title: popCultureRef.title,
        body: popCultureRef.body,
        tone: "positive",
      })
    }
  }

  // Lot size insights with fun comparisons
  if (data.lotSizeSqft) {
    const lotComparison = getLotSizeComparison(data.lotSizeSqft)
    if (lotComparison) {
      insights.push({
        type: "general",
        title: lotComparison.title,
        body: lotComparison.body,
        tone: "positive",
      })
    }
  }

  // Square footage context with fun comparisons
  if (data.sqft) {
    const houseComparison = getHouseSizeComparison(data.sqft)
    if (houseComparison) {
      insights.push({
        type: "general",
        title: houseComparison.title,
        body: houseComparison.body,
        tone: "positive",
      })
    }
  }

  return insights
}

/**
 * Get the most relevant insight to display
 */
export function getPrimaryInsight(data: PropertyData | null): Insight | null {
  const insights = generateInsights(data)

  // Priority order: positive vibes first, then interesting facts, then informative
  const priority = ["general", "age", "hvac", "systems", "roof"]

  for (const type of priority) {
    const insight = insights.find((i) => i.type === type && i.tone === "positive")
    if (insight) return insight
  }

  for (const type of priority) {
    const insight = insights.find((i) => i.type === type)
    if (insight) return insight
  }

  return insights[0] ?? null
}

// Pop culture reference generator
function getPopCultureReference(year: number): { title: string; body: string } | null {
  const references: Record<number, { title: string; body: string }> = {
    // 2020s
    2024: { title: "Brand new (2024)", body: "Built the same year Taylor Swift broke Ticketmaster. Your home is basically still in the box." },
    2023: { title: "Fresh build (2023)", body: "Built when Barbenheimer broke the internet. Everything here is cutting-edge." },
    2022: { title: "Nearly new (2022)", body: "Built during the Everything Everywhere All at Once era. Your systems are still practically new." },
    2021: { title: "Built in 2021", body: "Same year we all learned about NFTs and the metaverse. Your home is practically brand new." },
    2020: { title: "Built in 2020", body: "Constructed during a historic year. Tiger King premiered, and so did this house." },
    
    // 2010s
    2019: { title: "Built in 2019", body: "Same year as the Game of Thrones finale. Let's hope this home has a better ending." },
    2018: { title: "Built in 2018", body: "Constructed when Black Panther was dominating theaters. Modern and built to last." },
    2017: { title: "Built in 2017", body: "Same year we met Baby Groot. Your home's still in its youth." },
    2016: { title: "Built in 2016", body: "Pokémon GO launched, and so did this house. Still plenty of life left." },
    2015: { title: "Built in 2015", body: "The year of Hamilton on Broadway. Your home's still hitting all the right notes." },
    2014: { title: "Built in 2014", body: "Let It Go was everywhere, and this home was just getting started." },
    2013: { title: "Built in 2013", body: "Same year as Vine and twerking. Your home has aged better than both." },
    2012: { title: "Built in 2012", body: "The year Gangnam Style broke records. Your home's still got style too." },
    2011: { title: "Built in 2011", body: "Built when Minecraft was taking over the world. Solid construction, just like those blocks." },
    2010: { title: "Built in 2010", body: "The year Instagram launched. Your home's been picture-perfect ever since." },
    
    // 2000s
    2009: { title: "Built in 2009", body: "Avatar premiered, and so did this house. Both still going strong." },
    2008: { title: "Built in 2008", body: "The year Iron Man kicked off the MCU. Your home's part of its own franchise." },
    2007: { title: "Built in 2007", body: "Same year as the first iPhone. Both are classics now." },
    2006: { title: "Built in 2006", body: "Pluto lost planet status, but this home gained homeowner status." },
    2005: { title: "Built in 2005", body: "YouTube launched, and so did this house. Both still relevant 20 years later." },
    2004: { title: "Built in 2004", body: "Facebook went live, and so did this home. One aged better than the other." },
    2003: { title: "Built in 2003", body: "The year of Finding Nemo and this home. Both are keepers." },
    2002: { title: "Built in 2002", body: "Spider-Man swung into theaters while this home was being built." },
    2001: { title: "Built in 2001", body: "The year of Harry Potter, iPods, and this house. Pure early 2000s magic." },
    2000: { title: "Y2K survivor (2000)", body: "Built the year we survived Y2K. This home's been solid from the start." },
    
    // 1990s
    1999: { title: "Built in 1999", body: "The Matrix premiered, and this house was constructed. Both are still here, red pill or blue pill." },
    1998: { title: "Built in 1998", body: "Titanic swept the Oscars. Your home's been sailing smoothly ever since." },
    1997: { title: "Built in 1997", body: "Tamagotchis and this home both needed care. One's still thriving." },
    1996: { title: "Built in 1996", body: "The Macarena ruled the airwaves. Your home has much better staying power." },
    1995: { title: "Built in 1995", body: "Toy Story changed animation forever. This home's been a story worth keeping." },
    1994: { title: "Built in 1994", body: "Friends premiered, and this house was built. Both became classics that decade." },
    1993: { title: "Built in 1993", body: "Jurassic Park hit theaters. Your home's from the same epic era." },
    1992: { title: "Built in 1992", body: "The year of Aladdin and the Dream Team. Your home's been making wishes come true since." },
    1991: { title: "Built in 1991", body: "Nirvana's Nevermind dropped. Your home rocks just as hard." },
    1990: { title: "Built in 1990", body: "Home Alone premiered. Ironically, you're very much home." },
    
    // 1980s
    1989: { title: "Built in 1989", body: "The Berlin Wall fell, and this house rose. What a year." },
    1988: { title: "Built in 1988", body: "Die Hard made action movies cool. This home's been solid ever since." },
    1987: { title: "Built in 1987", body: "The Princess Bride hit theaters. This home is just as inconceivable." },
    1986: { title: "Built in 1986", body: "Top Gun dominated. Your home's been in the danger zone for almost 40 years." },
    1985: { title: "Built in 1985", body: "Back to the Future came out. Your home's got that same retro charm." },
    1984: { title: "Built in 1984", body: "The year of Ghostbusters and the Macintosh. Your home's an 80s legend." },
    1983: { title: "Built in 1983", body: "Return of the Jedi premiered. This home has returned value ever since." },
    1982: { title: "Built in 1982", body: "E.T. phoned home. Good thing this one's worth calling home." },
    1981: { title: "Built in 1981", body: "Raiders of the Lost Ark premiered. Your home's a treasure from that era." },
    1980: { title: "Built in 1980", body: "The Empire Strikes Back and this home both arrived. Classics." },
    
    // 1970s
    1979: { title: "Built in 1979", body: "The year of Alien and disco's last stand. Your home survived both trends." },
    1978: { title: "Built in 1978", body: "Grease was the word. Your home's been smooth ever since." },
    1977: { title: "Built in 1977", body: "Star Wars changed cinema forever. This home's from the same legendary year." },
    1976: { title: "Built in 1976", body: "America's bicentennial year. Your home's a patriotic classic." },
    1975: { title: "Built in 1975", body: "Jaws made everyone afraid of the water. At least this home is safe on land." },
    1974: { title: "Built in 1974", body: "The year of Watergate and the Rubik's Cube patent. Your home's less complicated." },
    1973: { title: "Built in 1973", body: "The Exorcist terrified audiences. Your home has much better vibes." },
    1972: { title: "Built in 1972", body: "The Godfather premiered. Your home's been making offers ever since." },
    1971: { title: "Built in 1971", body: "Disney World opened. Your home's been magical since the same era." },
    1970: { title: "Built in 1970", body: "The Beatles broke up, but this home came together. Win some, lose some." },
  }

  // Get exact year or find the closest decade reference
  if (references[year]) {
    return references[year]
  }

  // Fallback for years not specifically listed
  const currentYear = new Date().getFullYear()
  const age = currentYear - year
  
  if (year >= 1960 && year < 1970) {
    return { title: `Built in ${year}`, body: "A groovy 60s build. Peace, love, and solid construction." }
  } else if (year >= 1950 && year < 1960) {
    return { title: `Built in ${year}`, body: "Rock 'n' roll was born, and so was this house. A true mid-century gem." }
  } else if (year < 1950) {
    return { title: `Built in ${year}`, body: `${age} years of history. They don't make them like this anymore.` }
  }

  return null
}

// Lot size comparison generator
function getLotSizeComparison(sqft: number): { title: string; body: string } | null {
  const acres = sqft / 43560

  // Tennis court = ~2,800 sq ft
  // Basketball court = ~4,700 sq ft
  // Football field = ~57,600 sq ft (1.32 acres)
  // Olympic swimming pool = ~13,500 sq ft

  if (sqft >= 217800) { // 5 acres
    return {
      title: "Five acres of freedom",
      body: "That's about 4 football fields. You could host your own music festival."
    }
  } else if (sqft >= 87120) { // 2 acres
    return {
      title: "Two-acre estate",
      body: "Enough space for a tennis court, pool, garden, and still have room left over."
    }
  } else if (sqft >= 43560) { // 1 acre
    return {
      title: "Full acre of land",
      body: "That's roughly a football field of space. Room for all your backyard dreams."
    }
  } else if (sqft >= 30000) { // ~0.69 acres
    return {
      title: "Generous lot size",
      body: `At ${(acres).toFixed(2)} acres, you could fit about 6 tennis courts out there.`
    }
  } else if (sqft >= 20000) { // ~0.46 acres
    return {
      title: "Half-acre paradise",
      body: "That's roughly 4 tennis courts or 15 parking spaces. Plenty of room to play with."
    }
  } else if (sqft >= 15000) { // ~0.34 acres
    return {
      title: "Nice-sized lot",
      body: `Your ${(acres).toFixed(2)}-acre lot is about the size of 3 tennis courts. Room to breathe.`
    }
  } else if (sqft >= 10000) { // ~0.23 acres
    return {
      title: "Quarter-acre lot",
      body: "That's about 2 tennis courts worth of outdoor space. Perfect for entertaining."
    }
  } else if (sqft >= 7000) { // ~0.16 acres
    return {
      title: "Solid outdoor space",
      body: `Your ${sqft.toLocaleString()} sq ft lot is bigger than most NBA basketball courts.`
    }
  } else if (sqft >= 5000) { // ~0.11 acres
    return {
      title: "Comfortable lot",
      body: "About the size of a basketball court. Just right for a yard without too much work."
    }
  }

  return null
}

// House size comparison generator
function getHouseSizeComparison(sqft: number): { title: string; body: string } | null {
  // Average 1-car garage = ~200 sq ft
  // Tennis court = ~2,800 sq ft
  // NBA basketball court = ~4,700 sq ft
  // Typical Starbucks = ~1,500 sq ft
  // Small house = ~1,000 sq ft
  // Average American home = ~2,300 sq ft

  if (sqft >= 6000) {
    return {
      title: "Seriously spacious",
      body: `At ${sqft.toLocaleString()} sq ft, your home is bigger than most retail stores. Room to roam.`
    }
  } else if (sqft >= 5000) {
    return {
      title: "Mansion territory",
      body: `${sqft.toLocaleString()} sq ft is about the size of an NBA basketball court. You're living large.`
    }
  } else if (sqft >= 4000) {
    return {
      title: "Plenty of space",
      body: `Your ${sqft.toLocaleString()} sq ft home is almost as big as a tennis court. Impressive.`
    }
  } else if (sqft >= 3500) {
    return {
      title: "Above average size",
      body: `At ${sqft.toLocaleString()} sq ft, you've got about 50% more space than the typical American home.`
    }
  } else if (sqft >= 3000) {
    return {
      title: "Spacious living",
      body: `${sqft.toLocaleString()} sq ft is roughly 2 Starbucks cafes worth of room. But way cozier.`
    }
  } else if (sqft >= 2500) {
    return {
      title: "Comfortable size",
      body: `Your ${sqft.toLocaleString()} sq ft home is right around the American average. The sweet spot.`
    }
  } else if (sqft >= 2000) {
    return {
      title: "Well-proportioned",
      body: `${sqft.toLocaleString()} sq ft is about 10 parking spaces of living area. Just right.`
    }
  } else if (sqft >= 1500) {
    return {
      title: "Efficient layout",
      body: `At ${sqft.toLocaleString()} sq ft, every square foot counts. Less to clean, more to enjoy.`
    }
  } else if (sqft >= 1000) {
    return {
      title: "Cozy footprint",
      body: `Your ${sqft.toLocaleString()} sq ft home is about the size of 5 parking spaces. Cozy can be perfect.`
    }
  } else if (sqft >= 600) {
    return {
      title: "Tiny but mighty",
      body: `${sqft.toLocaleString()} sq ft of smart living space. Minimalist goals.`
    }
  }

  return null
}
