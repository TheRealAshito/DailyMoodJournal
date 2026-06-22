import streamlit as st
from datetime import datetime
from base64 import b64encode, b64decode
from crypto import (
    generate_user_key,
    generate_salt,
    derive_kek,
    wrap_user_key,
    unwrap_user_key,
    hash_password,
    verify_password,
)
from config import load_users, save_users, is_first_run, ensure_directories


def show_login_page():
    st.title("DailyMood")
    st.subheader("Log in")

    username = st.text_input("Username")
    password = st.text_input("Password", type="password")

    col1, col2 = st.columns(2)

    with col1:
        if st.button("Log in", use_container_width=True):
            users = load_users()
            if username not in users:
                st.error("User not found.")
            elif not verify_password(password, users[username]["salt"], users[username]["password_hash"]):
                st.error("Invalid password.")
            else:
                user_data = users[username]
                kek = derive_kek(password, b64decode(user_data["entry_key_salt_pwd"].encode()))
                user_key = unwrap_user_key(user_data["entry_key_encrypted_with_pwd"], kek)
                if user_key is None:
                    st.error("Failed to decrypt your encryption key. Contact support.")
                else:
                    st.session_state["authenticated"] = True
                    st.session_state["username"] = username
                    st.session_state["user_key"] = user_key
                    st.session_state["page"] = "journal"
                    st.rerun()

    with col2:
        if st.button("Forgot password?", use_container_width=True):
            st.session_state["auth_mode"] = "reset"
            st.rerun()

    st.markdown("---")
    st.caption("No account?")
    if st.button("Create account", use_container_width=True):
        st.session_state["auth_mode"] = "signup"
        st.rerun()


def show_signup_page():
    st.title("DailyMood")
    st.subheader("Create your account")

    username = st.text_input("Username")
    password = st.text_input("Password", type="password")
    confirm_password = st.text_input("Confirm password", type="password")

    security_questions = [
        "What is your first pet's name?",
        "What is your mother's maiden name?",
        "What city were you born in?",
        "What is your favorite book?",
        "What was the name of your first school?",
        "What is your childhood best friend's name?",
    ]
    security_question = st.selectbox("Security question", security_questions)
    security_answer = st.text_input("Your answer", type="password")

    if st.button("Create account", use_container_width=True):
        if not username.strip():
            st.error("Username is required.")
        elif len(password) < 6:
            st.error("Password must be at least 6 characters.")
        elif password != confirm_password:
            st.error("Passwords do not match.")
        elif not security_answer.strip():
            st.error("Security answer is required.")
        else:
            users = load_users()
            if username in users:
                st.error("Username already exists.")
            else:
                ensure_directories()

                user_key = generate_user_key()
                salt = b64encode(generate_salt()).decode()

                kek_pwd = derive_kek(password, b64decode(salt.encode()))
                wrapped_pwd = wrap_user_key(user_key, kek_pwd)

                salt_secret = b64encode(generate_salt()).decode()
                kek_secret = derive_kek(security_answer, b64decode(salt_secret.encode()))
                wrapped_secret = wrap_user_key(user_key, kek_secret)

                password_hash = hash_password(password, salt)

                users[username] = {
                    "created_at": datetime.now().isoformat(),
                    "salt": salt,
                    "password_hash": password_hash,
                    "entry_key_encrypted_with_pwd": wrapped_pwd,
                    "entry_key_salt_pwd": salt,
                    "entry_key_encrypted_with_secret": wrapped_secret,
                    "entry_key_salt_secret": salt_secret,
                    "security_question": security_question,
                }
                save_users(users)

                st.success("Account created! You can now log in.")
                st.session_state["auth_mode"] = "login"
                st.rerun()

    if st.button("Back to login"):
        st.session_state["auth_mode"] = "login"
        st.rerun()


def show_password_reset_page():
    st.title("DailyMood")
    st.subheader("Reset your password")

    if "reset_step" not in st.session_state:
        st.session_state["reset_step"] = "username"

    if st.session_state["reset_step"] == "username":
        username = st.text_input("Enter your username")
        if st.button("Continue", use_container_width=True):
            users = load_users()
            if username not in users:
                st.error("User not found.")
            else:
                st.session_state["reset_username"] = username
                st.session_state["reset_question"] = users[username]["security_question"]
                st.session_state["reset_step"] = "answer"
                st.rerun()

    elif st.session_state["reset_step"] == "answer":
        st.info(f"Security question: {st.session_state['reset_question']}")
        answer = st.text_input("Your answer", type="password")
        if st.button("Verify", use_container_width=True):
            users = load_users()
            username = st.session_state["reset_username"]
            user_data = users[username]
            secret_salt = b64decode(user_data["entry_key_salt_secret"].encode())
            kek_secret = derive_kek(answer, secret_salt)
            user_key = unwrap_user_key(user_data["entry_key_encrypted_with_secret"], kek_secret)
            if user_key is None:
                st.error("Incorrect answer.")
            else:
                st.session_state["reset_user_key"] = user_key
                st.session_state["reset_step"] = "new_password"
                st.rerun()

    elif st.session_state["reset_step"] == "new_password":
        new_password = st.text_input("New password", type="password")
        confirm = st.text_input("Confirm new password", type="password")
        if st.button("Reset password", use_container_width=True):
            if len(new_password) < 6:
                st.error("Password must be at least 6 characters.")
            elif new_password != confirm:
                st.error("Passwords do not match.")
            else:
                users = load_users()
                username = st.session_state["reset_username"]
                user_key = st.session_state["reset_user_key"]

                new_salt = b64encode(generate_salt()).decode()
                new_kek = derive_kek(new_password, b64decode(new_salt.encode()))
                new_wrapped = wrap_user_key(user_key, new_kek)
                new_hash = hash_password(new_password, new_salt)

                users[username]["salt"] = new_salt
                users[username]["password_hash"] = new_hash
                users[username]["entry_key_encrypted_with_pwd"] = new_wrapped
                users[username]["entry_key_salt_pwd"] = new_salt
                save_users(users)

                st.success("Password reset! You can now log in.")
                st.session_state["auth_mode"] = "login"
                for key in ["reset_step", "reset_username", "reset_question", "reset_user_key"]:
                    st.session_state.pop(key, None)
                st.rerun()

    if st.button("Back to login"):
        st.session_state["auth_mode"] = "login"
        for key in ["reset_step", "reset_username", "reset_question", "reset_user_key"]:
            st.session_state.pop(key, None)
        st.rerun()


def require_auth():
    if "authenticated" not in st.session_state:
        st.session_state["authenticated"] = False
    if not st.session_state["authenticated"]:
        if "auth_mode" not in st.session_state:
            st.session_state["auth_mode"] = "login"
        if st.session_state["auth_mode"] == "login":
            show_login_page()
        elif st.session_state["auth_mode"] == "signup":
            show_signup_page()
        elif st.session_state["auth_mode"] == "reset":
            show_password_reset_page()
        return False
    return True
