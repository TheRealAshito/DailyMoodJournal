from datetime import date, timedelta, datetime
from collections import defaultdict
import matplotlib.pyplot as plt
import numpy as np
import streamlit as st
from entry_crud import get_entry, list_user_entries
from utils import extract_date_from_path
from config import MOOD_COLORS, MOOD_LABELS


def show_stats():
    username = st.session_state["username"]
    user_key = st.session_state["user_key"]
    entries = list_user_entries(username)

    if not entries:
        st.info("No entries yet. Start journaling to see your stats!")
        return

    by_date = defaultdict(lambda: {"moods": [], "count": 0})
    for path in entries:
        try:
            entry = get_entry(path, user_key)
            if entry is None:
                continue

            dt = extract_date_from_path(path)
            if dt is None:
                continue

            date_key = dt.date()
            by_date[date_key]["moods"].append(entry.get("mood", 3))
            by_date[date_key]["count"] += 1
        except Exception:
            continue

    if not by_date:
        st.info("Could not parse any entries.")
        return

    dates = sorted(by_date.keys())

    total_entries = sum(d["count"] for d in by_date.values())
    avg_mood = round(np.mean([m for d in by_date.values() for m in d["moods"]]), 1)

    current_streak = _calculate_streak(dates)
    longest_streak = _calculate_longest_streak(dates)

    col1, col2, col3, col4 = st.columns(4)
    col1.metric("Total Entries", total_entries)
    col2.metric("Average Mood", f"{avg_mood}/6")
    col3.metric("Current Streak", f"{current_streak} days")
    col4.metric("Longest Streak", f"{longest_streak} days")

    st.markdown("---")

    period = st.selectbox("Show mood for", ["Last 7 days", "Last 30 days", "Last 90 days", "All time"])

    if period == "Last 7 days":
        cutoff = date.today() - timedelta(days=7)
    elif period == "Last 30 days":
        cutoff = date.today() - timedelta(days=30)
    elif period == "Last 90 days":
        cutoff = date.today() - timedelta(days=90)
    else:
        cutoff = date.min

    recent_dates = [d for d in dates if d >= cutoff]
    recent_avg_moods = []
    recent_date_labels = []

    for d in recent_dates:
        moods = by_date[d]["moods"]
        recent_avg_moods.append(sum(moods) / len(moods))
        recent_date_labels.append(d.strftime("%b %d"))

    if recent_avg_moods:
        _render_mood_bar_chart(recent_date_labels, recent_avg_moods)

    st.markdown("---")
    st.subheader("Mood Distribution")
    _render_mood_histogram(by_date)


def _calculate_streak(dates: list) -> int:
    if not dates:
        return 0
    today = date.today()
    streak = 0
    check_date = today
    while True:
        if check_date in dates:
            streak += 1
            check_date -= timedelta(days=1)
        else:
            if check_date != today:
                break
            check_date -= timedelta(days=1)
    return streak


def _calculate_longest_streak(dates: list) -> int:
    if not dates:
        return 0
    sorted_dates = sorted(dates)
    longest = 1
    current = 1
    for i in range(1, len(sorted_dates)):
        if (sorted_dates[i] - sorted_dates[i - 1]).days == 1:
            current += 1
            longest = max(longest, current)
        else:
            current = 1
    return longest


def _render_mood_bar_chart(labels: list[str], moods: list[float]):
    fig, ax = plt.subplots(figsize=(10, 4))

    theme = st.session_state.get("theme", "light")
    bg_color = "#1a1a1a" if theme == "dark" else "#ffffff"
    text_color = "#ffffff" if theme == "dark" else "#333333"

    fig.patch.set_facecolor(bg_color)
    ax.set_facecolor(bg_color)

    colors = [MOOD_COLORS.get(int(round(m)), MOOD_COLORS[3]) for m in moods]

    bars = ax.bar(range(len(labels)), moods, color=colors, edgecolor="none", width=0.7)

    ax.set_xticks(range(len(labels)))
    ax.set_xticklabels(labels, rotation=45, ha="right", fontsize=9, color=text_color)
    ax.set_ylim(0, 6.5)
    ax.set_ylabel("Mood", color=text_color, fontsize=11)
    ax.tick_params(axis="y", colors=text_color)

    y_ticks = [0, 1, 2, 3, 4, 5, 6]
    ax.set_yticks(y_ticks)
    ax.set_yticklabels([MOOD_LABELS[t] for t in y_ticks])

    for spine in ax.spines.values():
        spine.set_visible(False)
    ax.grid(axis="y", alpha=0.2, color=text_color)

    plt.tight_layout()
    st.pyplot(fig)
    plt.close(fig)


def _render_mood_histogram(by_date: dict):
    all_moods = [m for d in by_date.values() for m in d["moods"]]

    fig, ax = plt.subplots(figsize=(8, 3))

    theme = st.session_state.get("theme", "light")
    bg_color = "#1a1a1a" if theme == "dark" else "#ffffff"
    text_color = "#ffffff" if theme == "dark" else "#333333"

    fig.patch.set_facecolor(bg_color)
    ax.set_facecolor(bg_color)

    bins = [-0.5, 0.5, 1.5, 2.5, 3.5, 4.5, 5.5, 6.5]
    n, bins_out, patches = ax.hist(all_moods, bins=bins, edgecolor="white", linewidth=1)

    for i, patch in enumerate(patches):
        mood_val = i
        patch.set_facecolor(MOOD_COLORS.get(mood_val, MOOD_COLORS[3]))

    ax.set_xticks(range(7))
    ax.set_xticklabels([MOOD_LABELS[i] for i in range(7)], fontsize=8, color=text_color)
    ax.set_ylabel("Count", color=text_color, fontsize=10)
    ax.tick_params(axis="y", colors=text_color)

    for spine in ax.spines.values():
        spine.set_color(text_color)
        spine.set_alpha(0.2)

    plt.tight_layout()
    st.pyplot(fig)
    plt.close(fig)
