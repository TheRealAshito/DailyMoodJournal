from datetime import date
import streamlit as st
from entry_crud import get_entry, list_user_entries, get_all_tags_for_user, delete_entry
from utils import extract_date_from_path
from config import MOOD_COLORS, MOOD_LABELS


def show_search():
    username = st.session_state["username"]
    user_key = st.session_state["user_key"]

    st.header("Search Entries")

    all_tags = get_all_tags_for_user(username)

    col1, col2 = st.columns(2)
    with col1:
        selected_tags = st.multiselect("Filter by tags", all_tags)
    with col2:
        date_range = st.date_input(
            "Date range",
            value=(date.today().replace(day=1), date.today()),
        )

    search_clicked = st.button("Search", use_container_width=True)

    if not search_clicked:
        st.info("Select filters and click Search.")
        return

    entries = list_user_entries(username)
    results = []

    for path in entries:
        try:
            entry = get_entry(path, user_key)
            if entry is None:
                continue

            dt = extract_date_from_path(path)
            if dt is None:
                continue
            entry_date = dt.date()

            if isinstance(date_range, tuple) and len(date_range) == 2:
                if entry_date < date_range[0] or entry_date > date_range[1]:
                    continue

            if selected_tags:
                entry_tags = entry.get("tags", [])
                if not any(tag in entry_tags for tag in selected_tags):
                    continue

            entry["path"] = path
            results.append(entry)

        except Exception:
            continue

    results.sort(key=lambda e: e.get("date", ""), reverse=True)

    if not results:
        st.info("No entries match your filters.")
        return

    st.subheader(f"Found {len(results)} entries")

    for entry in results:
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
                tags_display = ", ".join(entry.get("tags", []))
                if tags_display:
                    st.caption(f"Tags: {tags_display}")
            with col2:
                st.markdown(entry.get("body", ""))

            col_a, col_b = st.columns([1, 1])
            with col_a:
                if st.button("Edit", key=f"search_edit_{entry['path']}"):
                    st.session_state["editing_entry"] = entry["path"]
                    st.rerun()
            with col_b:
                if st.button("Delete", key=f"search_delete_{entry['path']}"):
                    delete_entry(entry["path"])
                    st.success("Entry deleted.")
                    st.rerun()
