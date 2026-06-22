COGNITIVE_DISTORTIONS = {
    "catastrophizing": {
        "name": "Catastrophizing",
        "description": "Expecting the worst-case scenario to happen, even when there's little evidence. You blow things out of proportion and assume disaster is inevitable.",
        "example": '"I made a mistake in my presentation — my boss probably thinks I\'m incompetent and I\'ll get fired."',
    },
    "black_and_white": {
        "name": "Black-and-White Thinking",
        "description": "Seeing situations in only two categories instead of on a spectrum. Things are either perfect or a total failure, with nothing in between.",
        "example": '"If I don\'t get an A on this exam, I\'m a complete failure as a student."',
    },
    "overgeneralization": {
        "name": "Overgeneralization",
        "description": "Taking a single negative event and seeing it as a never-ending pattern of defeat. Words like \"always,\" \"never,\" and \"every time\" are red flags.",
        "example": '"I didn\'t get a reply to my text — nobody ever wants to talk to me."',
    },
    "mental_filter": {
        "name": "Mental Filtering",
        "description": "Dwelling exclusively on one negative detail while ignoring all the positive aspects of a situation.",
        "example": '"My performance review had nine positive comments and one suggestion — and I can\'t stop thinking about that one thing."',
    },
    "mind_reading": {
        "name": "Mind Reading",
        "description": "Assuming you know what others are thinking about you, usually negatively, without any real evidence.",
        "example": '"My friend didn\'t wave back — she must be angry with me."',
    },
    "fortune_telling": {
        "name": "Fortune Telling",
        "description": "Predicting a negative outcome will happen and treating that prediction as an established fact.",
        "example": '"I\'m going to embarrass myself at the party, so there\'s no point in going."',
    },
    "emotional_reasoning": {
        "name": "Emotional Reasoning",
        "description": "Believing that because you feel a certain way, it must be true. Feelings are treated as facts.",
        "example": '"I feel guilty, so I must have done something wrong."',
    },
    "labeling": {
        "name": "Labeling",
        "description": "Attaching a global, negative label to yourself or others based on a single event, instead of describing the specific behavior.",
        "example": '"I forgot to call my mom — I\'m a terrible son."',
    },
    "personalization": {
        "name": "Personalization",
        "description": "Taking responsibility for events that are not entirely under your control, or blaming yourself for external circumstances.",
        "example": '"My child is struggling in school — I must be a bad parent."',
    },
    "should_statements": {
        "name": '"Should" Statements',
        "description": "Holding yourself to rigid rules about how you or others \"should\" or \"must\" behave. These create guilt and frustration when reality doesn\'t match.",
        "example": '"I should be more productive. I must not waste any time today."',
    },
    "disqualifying_positive": {
        "name": "Disqualifying the Positive",
        "description": "Rejecting positive experiences by insisting they don't count. You maintain a negative belief despite evidence to the contrary.",
        "example": '"They only said they liked my work because they\'re being nice — they don\'t really mean it."',
    },
    "magnification_minimization": {
        "name": "Magnification & Minimization",
        "description": "Exaggerating the importance of negative events or your flaws (magnification) and shrinking the importance of positive events or your strengths (minimization).",
        "example": '"Getting one question wrong proves I\'m bad at math. Getting the other 19 right doesn\'t mean anything."',
    },
}

PROMPTS = {
    "distortions": [
        "Which cognitive distortion might be at play here?",
        "What would you say to a close friend who had this exact thought?",
        "What evidence contradicts this belief? List at least three things.",
        "Are you treating a feeling as if it were a fact? What are the actual facts?",
        "Are you using words like 'always,' 'never,' or 'everyone'? Is that literally true?",
        "What's the most balanced, realistic way to see this situation?",
        "Is there a less extreme way to view this? What's the middle ground?",
        "Are you taking more than your fair share of responsibility for this outcome?",
        "What would the situation look like from a neutral observer's perspective?",
        "If the worst actually happened, how would you cope? What resources do you have?",
    ],
    "gratitude": [
        "What is one thing that went well today, even if small?",
        "Who made a positive difference in your day today?",
        "What is something you're grateful for right now that you usually take for granted?",
        "What is a skill or strength you used today?",
        "What part of your day exceeded your expectations?",
        "What is one thing about this moment that you appreciate?",
        "What is something beautiful you noticed today?",
        "Who would you like to thank today, and for what?",
        "What challenge today taught you something valuable?",
        "What simple pleasure did you experience today?",
    ],
    "reframing": [
        "What is a more balanced or compassionate way to look at this?",
        "What could be the positive intention behind someone else's behavior?",
        "How might this situation look different a month from now? A year from now?",
        "What can you learn from this experience? What's the hidden opportunity?",
        "What strengths did you demonstrate in handling this situation?",
        "If this were a chapter in a book about your life, what would the chapter be titled?",
        "What assumption are you making that might not be true?",
        "What part of this situation is within your control, and what isn't?",
        "How have you grown from difficult situations in the past?",
        "What would your wisest, most compassionate self say about this?",
    ],
}

CBT_EDUCATION = """
### What are Cognitive Distortions?

Cognitive distortions are **exaggerated or irrational thought patterns** that can reinforce negative thinking and emotions. They were first identified by Dr. Aaron Beck and popularized by Dr. David Burns in the context of Cognitive Behavioral Therapy (CBT).

Everyone experiences them from time to time. The goal of this journal is not to eliminate them — it's to **notice them, name them, and challenge them**. By bringing awareness to your thinking patterns, you can gradually shift toward more balanced, realistic perspectives.

### The CBT Cycle

```
Thoughts -> Feelings -> Behaviors -> (reinforces) Thoughts
```

By interrupting the thought at the top of the cycle, you change everything downstream.

### How to Use This

When you toggle CBT prompts while writing an entry:
1. **Identify** — Read the distortion explanation shown. Does it resonate?
2. **Question** — Answer the prompts honestly. There are no right answers.
3. **Reframe** — Notice if your perspective shifts after writing.

It's a practice, not a test. Be patient and kind with yourself.
"""

import random


def get_random_distortion() -> dict:
    key = random.choice(list(COGNITIVE_DISTORTIONS.keys()))
    return COGNITIVE_DISTORTIONS[key]


def get_random_prompts(count: int = 2) -> list[tuple[str, str]]:
    prompts = []
    categories = list(PROMPTS.keys())
    random.shuffle(categories)
    for category in categories[:count]:
        prompt_text = random.choice(PROMPTS[category])
        prompts.append((category, prompt_text))
    return prompts


def get_all_distortion_names() -> list[str]:
    return [d["name"] for d in COGNITIVE_DISTORTIONS.values()]
