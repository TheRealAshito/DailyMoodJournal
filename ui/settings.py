import os
from datetime import datetime
from base64 import b64decode, b64encode
import streamlit as st
from config import load_users, save_users, USERS_FILE
from crypto import (
    generate_salt,
    derive_kek,
    wrap_user_key,
    hash_password,
    verify_password,
    unwrap_user_key,
)
from export_import import build_export_archive, process_import_files


def show_settings():
    username = st.session_state["username"]
    users = load_users()
    user_data = users.get(username, {})

    st.header("Settings")

    tab1, tab2, tab3, tab4 = st.tabs(["Profile", "Theme", "Password", "Export / Import"])

    with tab1:
        st.subheader("Profile")
        st.write(f"**Username**: {username}")
        created_at = user_data.get("created_at", "Unknown")
        st.write(f"**Account created**: {created_at}")
        st.write(f"**Security question**: {user_data.get('security_question', 'N/A')}")

    with tab2:
        st.subheader("Theme")
        current_theme = st.session_state.get("theme", "light")
        new_theme = st.toggle(
            "Dark mode",
            value=(current_theme == "dark"),
        )
        if new_theme:
            st.session_state["theme"] = "dark"
        else:
            st.session_state["theme"] = "light"
        st.caption("Changes take effect immediately.")

    with tab3:
        st.subheader("Change Password")
        old_password = st.text_input("Current password", type="password", key="cp_old")
        new_password = st.text_input("New password", type="password", key="cp_new")
        confirm_password = st.text_input("Confirm new password", type="password", key="cp_confirm")

        if st.button("Change Password"):
            if not verify_password(old_password, user_data["salt"], user_data["password_hash"]):
                st.error("Current password is incorrect.")
            elif len(new_password) < 6:
                st.error("New password must be at least 6 characters.")
            elif new_password != confirm_password:
                st.error("New passwords do not match.")
            else:
                user_key = st.session_state.get("user_key")
                new_salt = generate_salt()
                salt_str = user_data["entry_key_salt_pwd"]
                salt_bytes = b64decode(salt_str.encode())

                old_kek = derive_kek(old_password, salt_bytes)
                user_key_check = unwrap_user_key(user_data["entry_key_encrypted_with_pwd"], old_kek)

                if user_key_check is None:
                    st.error("Failed to decrypt encryption key.")
                    return

                new_salt_str = b64encode(new_salt).decode()
                new_kek = derive_kek(new_password, new_salt)
                new_wrapped = wrap_user_key(user_key, new_kek)
                new_hash = hash_password(new_password, new_salt_str)

                users[username]["salt"] = new_salt_str
                users[username]["password_hash"] = new_hash
                users[username]["entry_key_encrypted_with_pwd"] = new_wrapped
                users[username]["entry_key_salt_pwd"] = new_salt_str
                save_users(users)

                st.success("Password changed successfully!")

    with tab4:
        st.subheader("Export Entries")
        export_fmt = st.selectbox("Format", ["tar.gz", "zip"])
        export_password = st.text_input(
            "Archive password (optional, AES encrypted)",
            type="password",
            key="export_password",
        )

        if st.button("Build Export"):
            archive_data = build_export_archive(username, export_fmt, export_password if export_password else None)
            if archive_data is None:
                st.warning("No entries to export.")
            else:
                ext = "tar.gz" if export_fmt == "tar.gz" else "zip"
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                st.download_button(
                    label="Download Export",
                    data=archive_data,
                    file_name=f"dailymood_export_{username}_{timestamp}.{ext}",
                    mime="application/gzip" if export_fmt == "tar.gz" else "application/zip",
                )
                st.success("Export ready! Click the download button above.")

        st.markdown("---")
        st.subheader("Import Entries")
        st.caption("Upload an exported archive (.tar.gz, .zip) or plain .md / .txt files.")

        uploaded_files = st.file_uploader(
            "Choose files",
            accept_multiple_files=True,
            type=["tar.gz", "tgz", "zip", "md", "txt"],
        )

        if uploaded_files and st.button("Import"):
            imported, skipped = process_import_files(username, uploaded_files)
            if imported > 0:
                st.success(f"Imported {imported} entries. {skipped} skipped (duplicates or invalid).")
            else:
                st.warning(f"No valid entries found. {skipped} files skipped.")
