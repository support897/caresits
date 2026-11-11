import Foundation

// MARK: Allergy check. A port of the web app's lib/allergy.ts: same word groups, same statuses, same wording.
// It only ever helps a carer slow down. It never decides safety, and "no match" is never a guarantee.

enum AllergyStatus: Equatable { case contains, mayContain, unknownIngredient, noMatchFound }

struct AllergyCheck: Equatable {
    var status: AllergyStatus
    var reasons: [String]
    var crossContamination: [String]
}

enum AllergyChecker {
    static let safetyCopy = "No match found is not a safety guarantee. Check labels and ask the parent."

    static let groups: [String: [String]] = [
        "peanut": ["peanut", "peanuts", "groundnut", "groundnuts", "arachis", "peanut butter", "nut", "nuts", "mixed nuts"],
        "tree nut": ["tree nut", "tree nuts", "nut", "nuts", "mixed nuts", "almond", "almonds", "cashew", "cashews", "walnut", "walnuts", "pecan", "pecans", "pistachio", "pistachios", "hazelnut", "hazelnuts", "macadamia", "brazil nut", "pine nut", "praline", "marzipan", "nutella"],
        "dairy": ["dairy", "milk", "cheese", "butter", "cream", "yoghurt", "yogurt", "whey", "casein", "ghee", "custard", "ice cream", "lactose", "milk powder", "sour cream"],
        "egg": ["egg", "eggs", "mayonnaise", "mayo", "meringue", "albumin", "aioli"],
        "gluten": ["gluten", "wheat", "flour", "bread", "pasta", "noodle", "couscous", "semolina", "cracker", "biscuit", "cake", "barley", "rye", "durum", "malt"],
        "soy": ["soy", "soya", "tofu", "edamame", "miso", "tempeh", "soy sauce"],
        "sesame": ["sesame", "tahini", "hummus", "sesame oil"],
        "fish": ["fish", "salmon", "tuna", "cod", "anchovy", "sardine", "trout", "pollock", "fish sauce"],
        "shellfish": ["shellfish", "prawn", "prawns", "shrimp", "crab", "lobster", "oyster", "mussel", "scallop", "squid", "clam", "crayfish"]
    ]
    static let aliases: [String: [String]] = [
        "nuts": ["peanut", "tree nut"],
        "nut allergy": ["peanut", "tree nut"],
        "peanut allergy": ["peanut"],
        "tree nuts": ["tree nut"],
        "milk": ["dairy"],
        "milk allergy": ["dairy"],
        "dairy allergy": ["dairy"],
        "wheat": ["gluten"],
        "wheat allergy": ["gluten"],
        "gluten/wheat": ["gluten"],
        "gluten allergy": ["gluten"],
        "egg allergy": ["egg"],
        "soy allergy": ["soy"],
        "sesame allergy": ["sesame"],
        "fish allergy": ["fish"],
        "shellfish allergy": ["shellfish"]
    ]
    static let recognizedIngredients: [String] = ["rice", "apple", "banana", "carrot", "pear", "potato", "chicken", "beef", "lamb", "pumpkin", "pea", "broccoli", "water", "oat", "orange", "cucumber", "tomato", "corn", "lentil", "bean", "chickpea", "quinoa", "spinach", "onion", "garlic", "zucchini", "courgette", "sweet potato", "blueberry", "strawberry", "mango", "avocado", "lemon", "lime", "olive oil", "vegetable oil", "coconut", "coconut milk", "stock", "broth", "salt", "pepper", "herb", "spice", "cinnamon", "honey", "maple syrup", "watermelon", "melon", "grape", "peach", "plum", "apricot", "beet", "beetroot", "cauliflower", "cabbage", "celery", "mushroom", "pumpkin seed", "sunflower seed", "sesame", "tofu", "yogurt", "yoghurt", "cheese", "egg", "bread", "pasta", "flour", "oats", "noodle", "cocoa", "chocolate", "basil", "parsley", "dill", "ginger", "turmeric", "cumin", "paprika", "vanilla", "date", "raisin", "watercress", "lettuce", "pepperoni", "turkey", "pork", "fish", "salmon", "tuna", "shrimp", "prawn", "almond", "walnut", "peanut", "soy", "milk", "cream", "butter", "mayonnaise", "tahini", "miso", "edamame", "hummus", "sourdough", "cornmeal", "polenta", "rice paper", "rice vinegar", "baking powder", "baking soda", "yeast", "coconut oil", "flaxseed", "chia seed", "pumpkin puree", "tomato paste", "passata", "vegetable stock", "chicken stock", "apple sauce", "applesauce", "plain flour", "wholemeal flour", "brown rice", "white rice", "caster sugar", "sugar", "vanilla extract"]
    static let crossContactPatterns: [String] = [
        "may contain", "might contain", "traces? of", "shared equipment", "shared (?:kitchen|utensils|pan|board)",
        "cross[- ]contamination", "processed in (?:a|the same) facility", "made in (?:a|the same) facility"
    ]

    static func normalize(_ value: String) -> String {
        let folded = value.lowercased().folding(options: .diacriticInsensitive, locale: Locale(identifier: "en"))
        var out = ""
        var lastSpace = true
        for ch in folded {
            if ch.isASCII && (ch.isLetter || ch.isNumber) { out.append(ch); lastSpace = false }
            else if !lastSpace { out.append(" "); lastSpace = true }
        }
        return out.trimmingCharacters(in: .whitespaces)
    }

    static func hasTerm(_ text: String, _ term: String) -> Bool {
        let t = normalize(term)
        if t.isEmpty { return false }
        let plural = (t.last?.isLetter == true || t.last?.isNumber == true) && !t.hasSuffix("s") ? "s?" : ""
        let pattern = "\\b" + NSRegularExpression.escapedPattern(for: t) + plural + "\\b"
        return text.range(of: pattern, options: [.regularExpression, .caseInsensitive]) != nil
    }

    static func removeCrossContactPhrases(_ text: String) -> String {
        var s = text
        let patterns = [
            "\\b(?:may|might) contain\\b[^,;\\n]*", "\\btraces? of\\b[^,;\\n]*",
            "\\b(?:made|processed) on shared equipment\\b(?:\\s+with\\b[^,;\\n]*)?",
            "\\bshared (?:equipment|kitchen|utensils|pan|board)\\b(?:\\s+with\\b[^,;\\n]*)?",
            "\\b(?:processed|made) in (?:a|the same) facility\\b[^,;\\n]*", "\\bcross[- ]contamination\\b[^,;\\n]*"
        ]
        for p in patterns { s = s.replacingOccurrences(of: p, with: " ", options: [.regularExpression, .caseInsensitive]) }
        return s
    }

    static func allergyGroups(_ allergies: [String]) -> [String] {
        var found: [String] = []
        func add(_ g: String) { if !found.contains(g) { found.append(g) } }
        for input in allergies {
            let name = normalize(input)
            if let canon = aliases[name] { canon.forEach(add) } else if groups[name] != nil { add(name) }
            for (group, terms) in groups where terms.contains(where: { normalize($0) == name }) { add(group) }
            if name == "nut" || name == "nuts" { add("peanut"); add("tree nut") }
        }
        return found.sorted()
    }

    static func splitIngredients(_ text: String) -> [String] {
        var s = text.lowercased()
        s = s.replacingOccurrences(of: "\\([^)]*\\)", with: " ", options: .regularExpression)
        s = s.replacingOccurrences(of: "[,;\\n]+|\\band\\b|\\bwith\\b|\\bplus\\b", with: "|", options: .regularExpression)
        let noise = "\\b(?:organic|fresh|frozen|dried|cooked|uncooked|chopped|sliced|grated|optional|to taste|small|large|finely|roughly|pinch of|a little|some)\\b"
        return s.split(separator: "|").map { part in
            String(part).replacingOccurrences(of: noise, with: " ", options: .regularExpression)
                .replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression)
                .trimmingCharacters(in: .whitespaces)
        }.filter { !$0.isEmpty }
    }

    static func recognized(_ part: String) -> Bool {
        let n = normalize(part)
        if n.isEmpty { return true }
        if groups.values.contains(where: { $0.contains(where: { hasTerm(n, $0) }) }) { return true }
        return recognizedIngredients.contains(where: { hasTerm(n, $0) })
    }

    static func check(_ ingredientText: String, allergies: [String]) -> AllergyCheck {
        let text = ingredientText.lowercased()
        let gs = allergyGroups(allergies)
        let hasCross = crossContactPatterns.contains { text.range(of: $0, options: [.regularExpression, .caseInsensitive]) != nil }
        let ingredientsText = removeCrossContactPhrases(text)
        let matchingText = normalize(ingredientsText.replacingOccurrences(of: "coconut milk", with: "coconut beverage", options: .caseInsensitive))
        let ingredients = text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? ["No ingredients were entered"] : splitIngredients(ingredientsText)
        var hits: [String] = []
        for g in gs {
            if let matched = (groups[g] ?? []).first(where: { hasTerm(matchingText, $0) }) {
                hits.append("Ingredient match: \(matched) may relate to the listed \(g) allergy.")
            }
        }
        var cross: [String] = gs.isEmpty ? [] : ["Check for cross-contamination from shared pans, boards, utensils, and label statements."]
        if hasCross && !gs.isEmpty { cross.append("The ingredient text mentions possible cross-contact. Ask the parent before serving.") }
        let unknown = ingredients.filter { !recognized($0) }
        var reasons = hits
        if hasCross && !gs.isEmpty { reasons.append("Possible cross-contact wording was found. Ask the parent before serving.") }
        if !unknown.isEmpty { reasons.append("Unknown ingredient: \(unknown.joined(separator: ", ")). Check the full label with the parent.") }
        if hits.isEmpty && !hasCross && unknown.isEmpty { reasons.append("No listed ingredient matched a known allergy term.") }
        reasons.append(safetyCopy)
        let status: AllergyStatus = !hits.isEmpty ? .contains : (hasCross && !gs.isEmpty ? .mayContain : (!unknown.isEmpty ? .unknownIngredient : .noMatchFound))
        return AllergyCheck(status: status, reasons: reasons, crossContamination: cross)
    }
}
