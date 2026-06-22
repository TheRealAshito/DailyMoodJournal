import streamlit as st
from config import ensure_directories, is_first_run, apply_theme
from auth import require_auth
from ui.calendar import show_calendar_view
from ui.entry_form import show_entry_form
from ui.stats import show_stats
from ui.search import show_search
from ui.settings import show_settings
from prompts.cbt_prompts import CBT_EDUCATION, COGNITIVE_DISTORTIONS, get_random_prompts


def init_session():
    defaults = {
        "authenticated": False,
        "username": None,
        "user_key": None,
        "theme": "light",
        "page": "journal",
        "selected_date": None,
        "editing_entry": None,
    }
    for key, value in defaults.items():
        if key not in st.session_state:
            st.session_state[key] = value


def render_sidebar():
    nav_options = ["Journal", "New Entry", "Search", "Stats", "About CBT", "Settings"]
    page_map = {
        "Journal": "journal",
        "New Entry": "new_entry",
        "Search": "search",
        "Stats": "stats",
        "About CBT": "cbt",
        "Settings": "settings",
    }
    rev_map = {v: k for k, v in page_map.items()}
    current_page = st.session_state.get("page", "journal")
    default_idx = nav_options.index(rev_map.get(current_page, "Journal"))

    with st.sidebar:
        st.title("DailyMood")
        st.caption(f"Logged in as **{st.session_state['username']}**")

        st.markdown("---")

        nav = st.radio(
            "Navigation",
            nav_options,
            index=default_idx,
            label_visibility="collapsed",
        )

        if nav != rev_map.get(current_page, "Journal"):
            st.session_state["page"] = page_map[nav]
            st.rerun()

        if st.button("**Logout**", use_container_width=True):
            for key in list(st.session_state.keys()):
                del st.session_state[key]
            st.rerun()

        return page_map[nav]


def show_cbt_page():
    st.header("About Cognitive Behavioral Therapy")

    st.markdown(CBT_EDUCATION)

    st.markdown("---")
    st.subheader("The 12 Common Cognitive Distortions")

    for key, dist in COGNITIVE_DISTORTIONS.items():
        with st.expander(f"**{dist['name']}**"):
            st.markdown(f"*{dist['description']}*")
            st.markdown(f"**Example**: _{dist['example']}_")

    st.markdown("---")
    st.subheader("Try a Prompt")
    if st.button("Give me a random CBT prompt"):
        prompts = get_random_prompts(1)
        if prompts:
            cat, text = prompts[0]
            st.info(f"**({cat})** {text}")


def main():
    st.set_page_config(
        page_title="DailyMood",
        page_icon="",
        layout="wide",
        initial_sidebar_state="expanded",
    )

    init_session()
    ensure_directories()

    if not require_auth():
        return

    page = render_sidebar()

    if page == "journal":
        if st.session_state.get("editing_entry"):
            show_entry_form()
        else:
            show_calendar_view()
    elif page == "new_entry":
        show_entry_form()
    elif page == "search":
        show_search()
    elif page == "stats":
        show_stats()
    elif page == "cbt":
        show_cbt_page()
    elif page == "settings":
        show_settings()


if __name__ == "__main__":
    main()
