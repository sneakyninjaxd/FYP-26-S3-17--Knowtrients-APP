"""
Food search.

USDA names foods in a structured, comma-separated style — "Chicken, broilers
or fryers, breast, meat only, cooked, roasted" — while people type the way
they'd say it: "chicken breast", "roast chicken", "prawns". Matching the
whole query as one phrase finds none of those.

So a search here:

1. Splits the query into words, and requires every word to appear somewhere
   in the food's name, in any order.
2. Accepts plurals ("eggs" finds "Egg").
3. Accepts common Singaporean and British names for foods USDA files under
   American ones ("prawn" finds "Shrimp", "mince" finds "Ground").
4. Ranks results so the closest match comes first: names starting with the
   first word, then shorter names — "Banana, raw" ahead of "Banana bread".
"""

import re

from sqlalchemy import and_, case, func, or_

from . import models

# Words that carry no meaning in a food search.
_STOP_WORDS = {"a", "an", "and", "the", "with", "of", "in", "some", "my", "fresh"}

# Local and British names, and the words USDA uses for them.
#
# One-word synonyms are applied to individual words of the query. Kept to
# pairs that are unambiguous; anything doubtful is left out, since a wrong
# synonym returns confidently wrong results.
WORD_SYNONYMS = {
    "prawn": ["shrimp"],
    "prawns": ["shrimp"],
    "mince": ["ground"],
    "minced": ["ground"],
    "aubergine": ["eggplant"],
    "brinjal": ["eggplant"],
    "courgette": ["zucchini"],
    "capsicum": ["peppers", "pepper"],
    "coriander": ["cilantro", "coriander"],
    "yoghurt": ["yogurt"],
    "porridge": ["oatmeal", "oats"],
    "beancurd": ["tofu"],
    "crisps": ["chips"],
    "biscuit": ["cookie", "cracker"],
    "biscuits": ["cookies", "crackers"],
    "chilli": ["chili", "pepper"],
    "chillies": ["chili", "peppers"],
    "beetroot": ["beets"],
    "rocket": ["arugula"],
    "mangetout": ["snow peas", "peas, edible-podded"],
    "sweetcorn": ["corn"],
    "maize": ["corn"],
    "wholemeal": ["whole-wheat", "whole wheat"],
    "wholegrain": ["whole-grain", "whole grain"],
    "fizzy": ["carbonated"],
    "soda": ["carbonated"],
    "lolly": ["candy"],
    "sweets": ["candy"],
    "kopi": ["coffee"],
    "teh": ["tea"],
}

# Multi-word names, replaced as a phrase before the query is split.
PHRASE_SYNONYMS = {
    "spring onion": "scallions",
    "spring onions": "scallions",
    "ladies finger": "okra",
    "lady finger": "okra",
    "bee hoon": "rice noodles",
    "mee hoon": "rice noodles",
    "kway teow": "rice noodles",
    "rice vermicelli": "rice noodles",
    "bok choy": "cabbage, chinese (pak-choi)",
    "pak choi": "cabbage, chinese (pak-choi)",
    "chinese cabbage": "cabbage, chinese",
    "soy sauce": "soy sauce",
    "french fries": "potatoes, french fried",
    "chips potato": "potato chips",
    "ice cream": "ice creams",
    "peanut butter": "peanut butter",
}


def _words(text: str) -> list[str]:
    """Lower-cased words, without punctuation or stop words."""
    tokens = re.findall(r"[a-z0-9'-]+", text.lower())
    return [t for t in tokens if t not in _STOP_WORDS]


def _variants(word: str) -> list[str]:
    """
    Every spelling a word should match.

    Plurals are handled by also matching the singular — a substring match on
    "egg" finds both "Egg" and "Eggs", so the singular is enough.
    """
    forms = {word}
    if len(word) > 3 and word.endswith("es") and word[:-2] not in ("", "cheese"):
        forms.add(word[:-2])
    if len(word) > 3 and word.endswith("s") and not word.endswith("ss"):
        forms.add(word[:-1])
    for synonym in WORD_SYNONYMS.get(word, []):
        forms.add(synonym)
    return sorted(forms)


def _alternative_queries(query: str) -> list[str]:
    """The query as typed, plus versions with local phrases translated."""
    q = query.lower().strip()
    alternatives = [q]
    for phrase, replacement in PHRASE_SYNONYMS.items():
        if phrase in q and phrase != replacement:
            alternatives.append(q.replace(phrase, replacement))
    return alternatives


def build_filter(query: str):
    """
    A filter matching foods whose name contains every word of the query.

    Each alternative reading of the query (with local phrases translated) is
    tried, and a food matching any of them is included. Returns None for a
    query made only of stop words.
    """
    clauses = []
    for alternative in _alternative_queries(query):
        words = _words(alternative)
        if not words:
            continue
        per_word = [
            or_(*[models.Food.name.ilike(f"%{v}%") for v in _variants(w)])
            for w in words
        ]
        clauses.append(and_(*per_word))

    if not clauses:
        return None
    return or_(*clauses)


def ranking(query: str):
    """
    Sort order, most relevant first.

    1. Verified entries from the nutrition source before user-added ones
       (constraint C-06).
    2. Foods whose main name — the part before the first comma, in USDA's
       naming — is exactly the first word: "Bananas, raw" for "banana", ahead
       of "Banana bread".
    3. Names starting with the first word.
    4. Shorter names: the plain food rather than a dish containing it.
    """
    words = _words(query)
    if not words:
        return [models.Food.is_verified.desc(), models.Food.name]

    # The main name may be singular or plural in USDA's data — "Egg" but
    # "Bananas" and "Apples" — so match both.
    base = set(_variants(words[0]))
    variants = sorted(base | {f"{v}s" for v in base} | {f"{v}es" for v in base})
    exact_main_name = or_(
        *[models.Food.name.ilike(f"{v},%") for v in variants],
        *[models.Food.name.ilike(v) for v in variants],
    )
    starts_with = or_(*[models.Food.name.ilike(f"{v}%") for v in variants])

    relevance = case(
        (exact_main_name, 0),
        (starts_with, 1),
        else_=2,
    )
    return [
        models.Food.is_verified.desc(),
        relevance,
        func.length(models.Food.name),
        models.Food.name,
    ]
