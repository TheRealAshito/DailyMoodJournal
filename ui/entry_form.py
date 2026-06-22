from datetime import datetime, date
import streamlit as st
from entry_crud import create_entry, get_entry, update_entry
from utils import build_entry_path, validate_entry_data
from config import MOOD_COLORS, MOOD_LABELS
from prompts.cbt_prompts import get_random_distortion, get_random_prompts


def show_entry_form():
    username = st.session_state["username"]
    user_key = st.session_state["user_key"]
    editing_path = st.session_state.get("editing_entry")

    if editing_path:
        try:
            existing = get_entry(editing_path, user_key)
        except Exception:
            st.error("Failed to load entry for editing.")
            existing = None
        st.header("Edit Entry")
    else:
        existing = None
        st.header("New Entry")

    with st.form("entry_form", clear_on_submit=(editing_path is None)):
        title = st.text_input(
            "Title",
            value=existing.get("title", "") if existing else "",
            placeholder="What's on your mind?",
        )

        col1, col2 = st.columns([3, 2])
        with col1:
            entry_date = st.date_input(
                "Date",
                value=date.today() if not existing else (
                    datetime.fromisoformat(existing["date"]).date()
                    if isinstance(existing.get("date"), str) else existing.get("date", date.today())
                ),
            )
            entry_time = st.time_input(
                "Time",
                value=datetime.now().time() if not existing else (
                    datetime.fromisoformat(existing["date"]).time()
                    if isinstance(existing.get("date"), str) else datetime.now().time()
                ),
            )
        with col2:
            mood = st.select_slider(
                "Mood",
                options=list(range(7)),
                value=existing.get("mood", 3) if existing else 3,
                format_func=lambda v: MOOD_LABELS[v],
            )

        tags_input = st.text_input(
            "Tags (comma-separated)",
            value=", ".join(existing.get("tags", [])) if existing else "",
            placeholder="work, reflection, gratitude",
        )

        include_cbt = st.checkbox("Include CBT prompts", value=False)

        if include_cbt:
            st.markdown("---")
            distortion = get_random_distortion()
            st.info(
                f"**Cognitive Distortion — {distortion['name']}**\n\n"
                f"{distortion['description']}\n\n"
                f"*Example: \"{distortion['example']}\"* "
            )

            selected_prompts = get_random_prompts(2)
            responses = {}
            for category, prompt_text in selected_prompts:
                responses[prompt_text] = st.text_area(
                    f"**{prompt_text}**",
                    placeholder="Write your response here...",
                    key=f"prompt_{hash(prompt_text)}",
                )

        body = st.text_area(
            "Entry",
            value=existing.get("body", "") if existing else "",
            height=250,
            placeholder="Write your thoughts here...",
        )

        submitted = st.form_submit_button("Save Entry", use_container_width=True)

        if submitted:
            if not title.strip():
                st.error("Please enter a title.")
                return

            tags = [t.strip() for t in tags_input.split(",") if t.strip()]

            dt = datetime.combine(entry_date, entry_time)

            full_body_parts = [body]

            if include_cbt:
                full_body_parts.insert(0, "")
                full_body_parts.insert(0, "---")
                for prompt_text, response in responses.items():
                    full_body_parts.insert(0, f"**Response**: {response}\n\n**Prompt**: {prompt_text}")
                full_body_parts.insert(0, f"**Distortion**: {distortion['name']}")
                full_body_parts.insert(0, "## CBT Reflection")

            entry_data = {
                "title": title.strip(),
                "date": dt,
                "mood": mood,
                "tags": tags,
                "body": "\n".join(full_body_parts),
                "author": username,
            }

            errors = validate_entry_data(entry_data)
            if errors:
                for err in errors:
                    st.error(err)
                return

            if editing_path:
                update_entry(editing_path, entry_data, user_key)
                st.session_state["editing_entry"] = None
                st.session_state["page"] = "journal"
            else:
                path = create_entry(username, entry_data, user_key)
                st.session_state["page"] = "journal"

            st.rerun()

    if editing_path and st.button("Cancel editing"):
        st.session_state["editing_entry"] = None
        st.rerun()
