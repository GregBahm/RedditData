import json
import re
from collections import Counter
from pathlib import Path


ROOT = Path(__file__).resolve().parent
DATA_PATH = ROOT / "viz" / "data.js"
OUTPUT_PATH = ROOT / "viz" / "topic-data.js"


TOPICS = [
    {
        "name": "Film & cinema",
        "description": "Movies, filmmaking, actors, directors, trailers, criticism, and the film business.",
        "terms": ["movie", "movies", "film", "cinema", "actor", "actress", "director", "trailer",
                  "box office", "screenplay", "hollywood", "oscar", "disney", "netflix", "spielberg"],
        "subs": ["movies", "moviecritic", "truefilm", "shittymoviedetails", "okbuddycinephile",
                 "marvelstudios", "dc_cinematic"],
    },
    {
        "name": "Programming & software engineering",
        "description": "Code, programming languages, developer culture, software design, and engineering work.",
        "terms": ["programming", "programmer", "developer", "software", "code", "coding", "github",
                  "javascript", "python", "golang", "java", "compiler", "database", "api", "open source",
                  "bug", "linux", "web development"],
        "subs": ["programming", "experienceddevs", "learnprogramming", "webdev", "cscareerquestions"],
    },
    {
        "name": "AI & generative media",
        "description": "Artificial intelligence, language models, image generation, deepfakes, and AI policy.",
        "terms": ["artificial intelligence", " ai ", "chatgpt", "openai", "llm", "language model",
                  "machine learning", "deep learning", "generative", "stable diffusion", "midjourney",
                  "deepfake", "comfyui", "ai art", "vibe coding"],
        "subs": ["isthisai", "chatgpt", "stablediffusion", "comfyui", "aiart", "generative"],
    },
    {
        "name": "US politics & elections",
        "description": "American elections, presidents, parties, campaigns, and domestic political conflict.",
        "terms": ["trump", "biden", "obama", "republican", "democrat", "gop", "election", "congress",
                  "senate", "white house", "president", "maga", "liberal", "conservative", "vote",
                  "voter", "campaign", "supreme court"],
        "subs": ["politics", "politicaldiscussion", "neutralpolitics", "asktrumpsupporters"],
    },
    {
        "name": "World affairs & geopolitics",
        "description": "Wars, international relations, borders, diplomacy, and conflicts outside US electoral politics.",
        "terms": ["ukraine", "russia", "israel", "palestine", "gaza", "hamas", "china", "taiwan",
                  "nato", "war", "invasion", "military", "geopolitics", "foreign policy", "refugee",
                  "colonial", "sanctions", "middle east"],
        "subs": ["worldnews", "geopolitics", "ukraine", "israel", "palestine"],
    },
    {
        "name": "Science, nature & medicine",
        "description": "Scientific findings, biology, physics, space, health, medicine, animals, and the natural world.",
        "terms": ["science", "scientist", "physics", "biology", "chemistry", "space", "planet", "nasa",
                  "evolution", "animal", "species", "climate", "medicine", "medical", "health",
                  "disease", "vaccine", "virus", "brain", "cancer", "research", "study"],
        "subs": ["science", "askscience", "space", "biology", "medicine", "health", "nature"],
    },
    {
        "name": "Technology & internet products",
        "description": "Consumer technology, platforms, privacy, hardware, product changes, and the web.",
        "terms": ["technology", "tech", "internet", "website", "app", "google", "microsoft", "apple",
                  "facebook", "meta", "amazon", "youtube", "privacy", "data breach", "computer",
                  "phone", "iphone", "android", "hardware", "gpu", "nvidia", "tesla"],
        "subs": ["technology", "tech", "gadgets", "pcmasterrace", "hardware", "privacy"],
    },
    {
        "name": "Data visualization & statistics",
        "description": "Charts, maps, quantitative comparisons, statistics, demographics, and data presentation.",
        "terms": ["data visualization", "data visualisation", "chart", "graph", "infographic", "statistics",
                  "statistical", "dataset", "population", "per capita", "survey", "map", "visualized",
                  "visualised", "oc data"],
        "subs": ["dataisbeautiful", "infographics", "mapporn"],
    },
    {
        "name": "History & notable facts",
        "description": "Historical people and events, surprising facts, archaeology, and cultural history.",
        "terms": ["history", "historical", "century", "ancient", "medieval", "roman", "world war",
                  "archaeology", "historian", "empire", "king", "queen", "museum", "til that",
                  "did you know"],
        "subs": ["todayilearned", "history", "askhistorians"],
    },
    {
        "name": "Economics, markets & business",
        "description": "Money, companies, labor, markets, investing, housing, and economic policy.",
        "terms": ["economy", "economic", "money", "stock", "market", "gamestop", "gme", "wall street",
                  "business", "company", "corporation", "tax", "inflation", "wealth", "income", "wage",
                  "salary", "job", "labor", "union", "housing", "rent", "debt", "bank", "finance"],
        "subs": ["wallstreetbets", "stocks", "economics", "finance", "personalfinance", "antiwork"],
    },
    {
        "name": "Games & interactive entertainment",
        "description": "Video games, tabletop games, game design, studios, platforms, and player culture.",
        "terms": ["video game", "gaming", "gameplay", "gamer", "steam", "xbox", "playstation", "nintendo",
                  "dungeons and dragons", " dnd ", "rpg", "overwatch", "total war", "game developer",
                  "game studio", "board game"],
        "subs": ["gaming", "games", "steam", "pcgaming", "dnd", "overwatch", "totalwar", "gwent"],
    },
    {
        "name": "TV, comics, anime & fictional worlds",
        "description": "Television, animation, comics, anime, characters, storytelling tropes, and fandom.",
        "terms": ["television", " tv ", "series", "episode", "season", "anime", "manga", "comic",
                  "superhero", "character", "trope", "fandom", "star wars", "marvel", "dc comics",
                  "game of thrones", "bojack"],
        "subs": ["topcharactertropes", "television", "anime", "manga", "comics", "marvel",
                 "bojackhorseman", "gameofthrones"],
    },
    {
        "name": "Internet culture, memes & social media",
        "description": "Online communities, memes, influencers, platform drama, viral discourse, and Reddit itself.",
        "terms": ["meme", "viral", "twitter", "tiktok", "reddit", "subreddit", "social media",
                  "influencer", "youtuber", "twitch", "discord", "online community", "internet culture",
                  "cancelled", "ratio"],
        "subs": ["memes", "programmerhumor", "peterexplainsthejoke", "internetisbeautiful",
                 "subredditdrama"],
    },
    {
        "name": "Law, crime & public safety",
        "description": "Crime, policing, courts, punishment, legal systems, accidents, and public safety.",
        "terms": ["crime", "criminal", "police", "court", "legal", "illegal", "law", "lawsuit", "judge",
                  "jury", "prison", "jail", "murder", "killed", "shooting", "gun", "fraud", "scam",
                  "accident", "disaster", "safety"],
        "subs": ["legaladvice", "crime", "catastrophicfailure", "publicfreakout"],
    },
    {
        "name": "Society, identity & social issues",
        "description": "Race, gender, inequality, education, immigration, identity, and social institutions.",
        "terms": ["racism", "racist", "race", "gender", "women", "men", "feminism", "transgender",
                  "gay", "lgbt", "identity", "inequality", "poverty", "immigration", "school",
                  "college", "education", "student", "social class", "discrimination"],
        "subs": ["socialjustice", "menslib", "feminism", "lgbt", "education"],
    },
    {
        "name": "Philosophy, religion & moral debate",
        "description": "Ethics, belief, religion, argument, ideology, and attempts to change or defend a view.",
        "terms": ["philosophy", "ethical", "ethics", "moral", "morality", "religion", "religious",
                  "god", "jesus", "christian", "atheist", "belief", "argument", "debate", "free will",
                  "meaning of life", "cmv"],
        "subs": ["changemyview", "philosophy", "debatereligion", "atheism", "christianity"],
    },
    {
        "name": "Relationships, family & everyday life",
        "description": "Dating, marriage, family, work life, personal habits, advice, and ordinary experiences.",
        "terms": ["relationship", "dating", "date", "marriage", "married", "wife", "husband", "girlfriend",
                  "boyfriend", "family", "parent", "child", "friend", "coworker", "workplace", "life advice",
                  "personal", "hobby", "food", "restaurant", "sleep"],
        "subs": ["relationships", "relationship_advice", "casualconversation", "nostupidquestions"],
    },
    {
        "name": "Humor, oddities & visual entertainment",
        "description": "Funny clips, unusual sights, absurd stories, jokes, images, and lightweight entertainment.",
        "terms": ["funny", "joke", "humor", "hilarious", "weird", "strange", "odd", "ridiculous",
                  "amazing", "interesting", "clip", "video", "watch", "photo", "picture"],
        "subs": ["videos", "funny", "mildlyinteresting", "interestingasfuck", "pics", "gifs",
                 "damnthatsinteresting", "showerthoughts"],
    },
    {
        "name": "How things work & explanatory questions",
        "description": "Mechanisms, definitions, practical explanations, and questions seeking a clear model of something.",
        "terms": ["eli5", "explain", "how does", "how do", "how can", "how come", "why does", "why do",
                  "what is the difference", "what does it mean", "mechanism", "work exactly"],
        "subs": ["explainlikeimfive", "askscience", "nostupidquestions"],
    },
    {
        "name": "Current events & general discussion",
        "description": "Breaking stories, context-seeking questions, broad discussion, and posts without a narrower dominant topic.",
        "terms": ["what is going on", "what's going on", "whats going on", "what is up with",
                  "what's up with", "whats up with", "out of the loop", "recently", "news"],
        "subs": ["outoftheloop", "askreddit", "news", "bestof"],
    },
]


def load_data():
    raw = DATA_PATH.read_text(encoding="utf-8")
    prefix = "const REDDIT_DATA = "
    if not raw.startswith(prefix):
        raise ValueError("viz/data.js has an unexpected format")
    return json.loads(raw[len(prefix):].rstrip().removesuffix(";"))


def normalized(value):
    return re.sub(r"[^a-z0-9]+", "", (value or "").lower())


def term_score(text, term):
    term = term.strip().lower()
    if not term:
        return 0
    if " " in term:
        return min(3, text.count(term)) * 3
    return min(3, len(re.findall(rf"\b{re.escape(term)}\b", text)))


def classify(record):
    lead = " ".join([record.get("title", ""), record.get("thread", "")]).lower()
    body = record.get("body", "").lower()
    subreddit = normalized(record.get("sub", ""))
    scores = []
    for topic in TOPICS:
        score = 0
        if subreddit in {normalized(sub) for sub in topic["subs"]}:
            score += 8
        for term in topic["terms"]:
            score += term_score(lead, term) * 3
            score += term_score(body, term)
        scores.append(score)

    combined = lead + " " + body
    if re.search(r"\b(gamestop|gme|wall street|stock price|short selling|short squeeze)\b", combined):
        return next(index for index, topic in enumerate(TOPICS)
                    if topic["name"] == "Economics, markets & business"), 100

    best = max(range(len(scores)), key=lambda index: (scores[index], -index))
    if scores[best] == 0:
        best = len(TOPICS) - 1
    return best, scores[best]


def representative_text(record):
    return (record.get("title") or record.get("thread") or record.get("body") or "(untitled)").strip()


def build():
    records = load_data()
    assigned = [[] for _ in TOPICS]
    for record in records:
        topic_index, confidence = classify(record)
        assigned[topic_index].append((record, confidence))

    topics = []
    palette = [
        "#396AB1", "#DA7C30", "#3E9651", "#CC2529", "#6B4C9A",
        "#922428", "#948B3D", "#535154", "#E68310", "#008695",
        "#7A99AC", "#C6A664", "#7B4F4B", "#5F9E6E", "#A95AA1",
        "#4E79A7", "#F28E2B", "#59A14F", "#E15759", "#B07AA1",
    ]
    for index, topic in enumerate(TOPICS):
        rows = assigned[index]
        subreddits = Counter(record.get("sub", "(unknown)") for record, _ in rows)
        examples = []
        seen = set()
        ranked = sorted(rows, key=lambda pair: (pair[1], abs(pair[0].get("score") or 0)), reverse=True)
        for record, _ in ranked:
            text = representative_text(record)
            key = re.sub(r"\s+", " ", text.lower())[:180]
            if key in seen:
                continue
            seen.add(key)
            examples.append({
                "text": re.sub(r"\s+", " ", text)[:280],
                "sub": record.get("sub", ""),
                "type": record.get("type", ""),
                "link": record.get("link", ""),
            })
            if len(examples) == 5:
                break

        topics.append({
            "name": topic["name"],
            "description": topic["description"],
            "color": palette[index],
            "count": len(rows),
            "share": len(rows) / len(records),
            "subreddits": [{"name": name, "count": count} for name, count in subreddits.most_common(5)],
            "examples": examples,
        })

    topics.sort(key=lambda topic: topic["count"], reverse=True)
    payload = {
        "total": len(records),
        "posts": sum(record.get("type") == "post" for record in records),
        "comments": sum(record.get("type") == "comment" for record in records),
        "topics": topics,
    }
    OUTPUT_PATH.write_text(
        "const REDDIT_TOPICS = " + json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + ";\n",
        encoding="utf-8",
    )

    for topic in topics:
        print(f"{topic['share'] * 100:5.1f}%  {topic['count']:5d}  {topic['name']}")


if __name__ == "__main__":
    build()
