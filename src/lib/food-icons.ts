// Best-effort colour icon for a food search result — an emoji, not a photo,
// matched by keyword against the food's name. This is deliberately the
// fallback tier: log-food.tsx always prefers a food's own imageUrl (a real
// product photo, only ever present for OFF-sourced branded foods) first and
// only reaches for this when there isn't one — i.e. every Common food, every
// user-authored Custom food, and any Branded food OFF has no photo for.
//
// Rules are ordered most-specific-phrase first (checked in order, first
// match wins) so a longer, more distinctive phrase like "protein shake"
// is caught before a shorter generic word like "milk" that might also
// appear in the same name. Keywords are plain substrings matched against
// the lowercased food name — good enough for a name like "Fairlife Whole
// Milk Ultra-Filtered By Fairlife" or "Core Power 26g Complete Protein
// Shake - Vanilla" to resolve sensibly without any per-brand mapping.
const FOOD_ICON_RULES: { keywords: string[]; icon: string }[] = [
  // Prepared dishes (checked first — e.g. "chicken caesar salad" should
  // read as a salad, not fall through to the generic "chicken" rule below)
  { keywords: ["stir-fry", "stir fry"], icon: "🥘" },
  { keywords: ["caesar salad", "salad"], icon: "🥗" },
  { keywords: ["bolognese", "spaghetti"], icon: "🍝" },
  { keywords: ["chili con carne", "chili"], icon: "🌶️" },
  { keywords: ["soup"], icon: "🍲" },
  { keywords: ["sushi"], icon: "🍣" },
  { keywords: ["pizza"], icon: "🍕" },
  { keywords: ["burrito", "tortilla wrap"], icon: "🌯" },
  { keywords: ["curry"], icon: "🍛" },

  // Shakes / bars / snacks (before generic milk/chocolate/nut rules)
  { keywords: ["protein shake", "protein powder", "whey protein", "meal replacement"], icon: "🥤" },
  { keywords: ["protein bar", "energy bar", "granola bar", "cereal bar"], icon: "🍫" },
  { keywords: ["trail mix"], icon: "🥜" },
  { keywords: ["hummus"], icon: "🫘" },
  { keywords: ["rice cake", "cracker"], icon: "🍘" },
  { keywords: ["pretzel"], icon: "🥨" },
  { keywords: ["popcorn"], icon: "🍿" },
  { keywords: ["chip", "crisps"], icon: "🍟" },
  { keywords: ["dark chocolate", "milk chocolate", "chocolate"], icon: "🍫" },
  { keywords: ["cookie", "biscuit"], icon: "🍪" },
  { keywords: ["cake"], icon: "🍰" },
  { keywords: ["ice cream"], icon: "🍦" },
  { keywords: ["donut", "doughnut"], icon: "🍩" },

  // Breakfast / grains
  { keywords: ["overnight oats", "porridge", "oatmeal", "oats"], icon: "🥣" },
  { keywords: ["granola", "muesli", "bran flakes", "cornflakes", "cereal"], icon: "🥣" },
  { keywords: ["pancake"], icon: "🥞" },
  { keywords: ["waffle"], icon: "🧇" },
  { keywords: ["bagel"], icon: "🥯" },
  { keywords: ["english muffin", "toast", "bread"], icon: "🍞" },
  { keywords: ["corn tortilla", "flour tortilla", "tortilla"], icon: "🫓" },
  { keywords: ["brown rice", "white rice", "rice"], icon: "🍚" },
  { keywords: ["pasta", "couscous"], icon: "🍝" },
  { keywords: ["quinoa", "barley"], icon: "🌾" },

  // Fruits
  { keywords: ["banana"], icon: "🍌" },
  { keywords: ["apple"], icon: "🍎" },
  { keywords: ["orange", "clementine", "mandarin"], icon: "🍊" },
  { keywords: ["strawberr"], icon: "🍓" },
  { keywords: ["blueberr"], icon: "🫐" },
  { keywords: ["raspberr", "blackberr", "berries", "berry"], icon: "🫐" },
  { keywords: ["grape"], icon: "🍇" },
  { keywords: ["pineapple"], icon: "🍍" },
  { keywords: ["mango"], icon: "🥭" },
  { keywords: ["watermelon"], icon: "🍉" },
  { keywords: ["honeydew", "melon"], icon: "🍈" },
  { keywords: ["kiwi"], icon: "🥝" },
  { keywords: ["pear"], icon: "🍐" },
  { keywords: ["peach"], icon: "🍑" },
  { keywords: ["cherries", "cherry"], icon: "🍒" },
  { keywords: ["avocado"], icon: "🥑" },
  { keywords: ["lemon", "lime"], icon: "🍋" },
  { keywords: ["coconut"], icon: "🥥" },
  { keywords: ["raisin", "date", "apricot", "prune"], icon: "🍇" },

  // Vegetables
  { keywords: ["broccoli", "cauliflower"], icon: "🥦" },
  { keywords: ["spinach", "kale", "lettuce"], icon: "🥬" },
  { keywords: ["carrot"], icon: "🥕" },
  { keywords: ["bell pepper", "pepper"], icon: "🫑" },
  { keywords: ["cucumber", "zucchini", "celery", "asparagus", "green beans"], icon: "🥒" },
  { keywords: ["tomato"], icon: "🍅" },
  { keywords: ["onion"], icon: "🧅" },
  { keywords: ["garlic"], icon: "🧄" },
  { keywords: ["sweet potato"], icon: "🍠" },
  { keywords: ["potato"], icon: "🥔" },
  { keywords: ["mushroom"], icon: "🍄" },
  { keywords: ["corn"], icon: "🌽" },

  // Proteins — diet-neutral: plant proteins never fall through to a meat
  // icon, and each animal protein gets its own icon rather than one
  // generic "meat" symbol standing in for everything.
  { keywords: ["tofu", "tempeh", "seitan", "edamame", "pea protein"], icon: "🌱" },
  { keywords: ["egg white", "egg"], icon: "🥚" },
  { keywords: ["chicken"], icon: "🍗" },
  { keywords: ["turkey"], icon: "🦃" },
  { keywords: ["duck"], icon: "🦆" },
  { keywords: ["bacon"], icon: "🥓" },
  { keywords: ["ham", "sausage", "pork"], icon: "🍖" },
  { keywords: ["beef", "steak", "lamb"], icon: "🥩" },
  { keywords: ["salmon", "cod", "tuna", "fish"], icon: "🐟" },
  { keywords: ["shrimp", "prawn"], icon: "🍤" },
  { keywords: ["crab"], icon: "🦀" },
  { keywords: ["mussel", "shellfish", "oyster"], icon: "🦪" },

  // Dairy & fats
  { keywords: ["almond milk", "oat milk", "soy milk"], icon: "🥛" },
  { keywords: ["yogurt", "yoghurt"], icon: "🥛" },
  { keywords: ["cottage cheese", "cream cheese", "mozzarella", "parmesan", "feta", "cheddar", "cheese"], icon: "🧀" },
  { keywords: ["butter"], icon: "🧈" },
  { keywords: ["milk"], icon: "🥛" },
  { keywords: ["olive oil", "coconut oil", "oil"], icon: "🫒" },
  { keywords: ["peanut butter", "peanut", "almond", "cashew", "walnut", "nuts"], icon: "🥜" },
  { keywords: ["chia seed", "flaxseed", "seeds"], icon: "🌰" },

  // Legumes
  { keywords: ["black bean", "kidney bean", "chickpea", "lentil", "split pea", "beans"], icon: "🫘" },

  // Beverages
  { keywords: ["coffee"], icon: "☕" },
  { keywords: ["tea"], icon: "🍵" },
  { keywords: ["orange juice", "juice"], icon: "🧃" },
  { keywords: ["smoothie"], icon: "🥤" },
  { keywords: ["soda", "cola", "soft drink"], icon: "🥤" },
  { keywords: ["water"], icon: "💧" },
];

const DEFAULT_FOOD_ICON = "🍽️";

export function iconForFood(name: string): string {
  const n = name.toLowerCase();
  for (const rule of FOOD_ICON_RULES) {
    if (rule.keywords.some((k) => n.includes(k))) return rule.icon;
  }
  return DEFAULT_FOOD_ICON;
}
