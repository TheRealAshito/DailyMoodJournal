import calendar
from datetime import datetime, date, timedelta
import pandas as pd
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.patches import FancyBboxPatch
import numpy as np
import streamlit as st
from entry_crud import get_entry, get_entries_for_date, list_user_entries, delete_entry
from utils import extract_date_from_path
from config import MOOD_COLORS, MOOD_LABELS


def _get_month_mood_data(username: str, year: int, month: int) -> dict:
    entries = list_user_entries(username)
    mood_by_day = {}
    for path in entries:
        dt = extract_date_from_path(path)
        if dt and dt.year == year and dt.month == month:
            day = dt.day
            user_key = st.session_state.get("user_key")
            if not user_key:
                continue
            try:
                entry = get_entry(path, user_key)
                if entry and "mood" in entry:
                    if day not in mood_by_day:
                        mood_by_day[day] = []
                    mood_by_day[day].append(entry["mood"])
            except Exception:
                pass
    return mood_by_day


def render_calendar_heatmap(username: str):
    today = date.today()

    if "cal_year" not in st.session_state:
        st.session_state["cal_year"] = today.year
    if "cal_month" not in st.session_state:
        st.session_state["cal_month"] = today.month

    cal = calendar.monthcalendar(st.session_state["cal_year"], st.session_state["cal_month"])
    month_name = calendar.month_name[st.session_state["cal_month"]]

    col1, col2, col3 = st.columns([1, 3, 1])
    with col1:
        if st.button("Prev", key="prev_month"):
            if st.session_state["cal_month"] == 1:
                st.session_state["cal_month"] = 12
                st.session_state["cal_year"] -= 1
            else:
                st.session_state["cal_month"] -= 1
            st.rerun()
    with col2:
        st.markdown(f"<h3 style='text-align:center'>{month_name} {st.session_state['cal_year']}</h3>", unsafe_allow_html=True)
    with col3:
        if st.button("Next", key="next_month"):
            if st.session_state["cal_month"] == 12:
                st.session_state["cal_month"] = 1
                st.session_state["cal_year"] += 1
            else:
                st.session_state["cal_month"] += 1
            st.rerun()

    mood_by_day = _get_month_mood_data(
        username, st.session_state["cal_year"], st.session_state["cal_month"]
    )

    fig, ax = plt.subplots(figsize=(8, 5))

    theme = st.session_state.get("theme", "light")
    bg_color = "#1a1a1a" if theme == "dark" else "#ffffff"
    text_color = "#ffffff" if theme == "dark" else "#333333"
    empty_color = "#333333" if theme == "dark" else "#e0e0e0"

    fig.patch.set_facecolor(bg_color)
    ax.set_facecolor(bg_color)

    ax.set_xlim(-0.5, 6.5)
    ax.set_ylim(-0.5, len(cal) - 0.5)
    ax.invert_yaxis()
    ax.set_aspect("equal")
    ax.axis("off")

    days_header = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    for i, day_name in enumerate(days_header):
        ax.text(i, -0.8, day_name, ha="center", va="center", fontsize=9, fontweight="bold", color=text_color)

    for week_idx, week in enumerate(cal):
        for day_idx, day in enumerate(week):
            if day == 0:
                continue
            color = empty_color
            avg_mood = None
            if day in mood_by_day:
                avg_mood = sum(mood_by_day[day]) / len(mood_by_day[day])
                color = MOOD_COLORS.get(int(round(avg_mood)), MOOD_COLORS[3])

            rect = FancyBboxPatch(
                (day_idx - 0.4, week_idx - 0.4), 0.8, 0.8,
                boxstyle="round,pad=0.05",
                facecolor=color, edgecolor="none", alpha=0.9
            )
            ax.add_patch(rect)

            day_color = "#ffffff" if theme == "dark" else "#333333"
            ax.text(day_idx, week_idx, str(day), ha="center", va="center", fontsize=10, color=day_color)

    plt.tight_layout()
    st.pyplot(fig)
    plt.close(fig)

    legend_html = "<div style='display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:16px'>"
    for mood_val in range(7):
        color = MOOD_COLORS[mood_val]
        legend_html += f"<span style='background:{color};color:white;padding:2px 8px;border-radius:4px;font-size:12px'>{MOOD_LABELS[mood_val]}</span>"
    legend_html += "</div>"
    st.markdown(legend_html, unsafe_allow_html=True)


def show_calendar_view():
    username = st.session_state["username"]
    user_key = st.session_state["user_key"]

    st.header("Journal")

    render_calendar_heatmap(username)

    st.markdown("---")

    selected_date = st.date_input("Select a date", value=st.session_state.get("selected_date", date.today()))
    st.session_state["selected_date"] = selected_date

    st.subheader(f"Entries for {selected_date.strftime('%B %d, %Y')}")

    day_entries = get_entries_for_date(username, selected_date)

    if not day_entries:
        st.info("No entries for this day. Write one!")
        return

    for entry_meta in day_entries:
        path = entry_meta["path"]
        try:
            entry = get_entry(path, user_key)
        except Exception:
            continue

        if entry is None:
            continue

        mood_val = entry.get("mood", 3)
        mood_color = MOOD_COLORS.get(mood_val, MOOD_COLORS[3])
        mood_label = MOOD_LABELS.get(mood_val, "Unknown")

        with st.expander(f"{entry.get('title', 'Untitled')} — {entry.get('date', '')}", expanded=False):
            col1, col2 = st.columns([1, 3])
            with col1:
                st.markdown(
                    f"<div style='background:{mood_color};color:white;padding:4px 12px;"
                    f"border-radius:12px;text-align:center;font-weight:bold'>{mood_label} ({mood_val})</div>",
                    unsafe_allow_html=True,
                )
                st.caption(f"Tags: {', '.join(entry.get('tags', []))}")
            with col2:
                st.markdown(entry.get("body", ""))

            col_a, col_b, col_c = st.columns([1, 1, 1])
            with col_a:
                if st.button("Edit", key=f"edit_{path}"):
                    st.session_state["editing_entry"] = path
                    st.rerun()
            with col_b:
                if st.button("Delete", key=f"delete_{path}"):
                    delete_entry(path)
                    st.success("Entry deleted.")
                    st.rerun()
