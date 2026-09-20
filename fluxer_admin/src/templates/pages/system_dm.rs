// SPDX-License-Identifier: AGPL-3.0-or-later

use crate::{
    config::AdminConfig,
    middleware::auth::AuthContext,
    templates::{
        components::{
            error_display::error_alert,
            form::{
                FORM_TEXTAREA_CLASS, checkbox, csrf_input, form_actions, form_field_group,
                submit_button,
            },
            page_container::{card, page_header},
        },
        layout::admin_layout,
    },
};
use maud::{Markup, PreEscaped, html};

pub struct SystemDmParams<'a> {
    pub form_error: Option<&'a str>,
    pub csrf_token: &'a str,
    pub user_count: Option<u64>,
    pub can_send_to_all: bool,
}

pub fn system_dm_page(
    config: &AdminConfig,
    auth: &AuthContext,
    params: &SystemDmParams<'_>,
) -> Markup {
    let base = &config.base_path;
    let jobs_url = format!("{base}/jobs?task_type=sendSystemDm");
    let content = html! {
        (page_header("System DMs", None))

        (card(html! {
            div class="flex flex-col gap-4" {
                h2 class="text-base font-semibold text-neutral-900" {
                    "Send a system DM"
                }
                p class="text-sm text-neutral-500" {
                    "Sent from the official Fluxer system account. Each recipient \
                     will receive the same content as a DM. Progress is observable \
                     on the "
                    a href=(jobs_url) class="font-medium text-neutral-900 hover:underline" {
                        "Jobs page"
                    }
                    " (filtered to "
                    code { "sendSystemDm" }
                    ")."
                }

                @if let Some(err) = params.form_error {
                    (error_alert(err))
                }

                form method="post" action={(base) "/system-dms"} {
                    (csrf_input(params.csrf_token))
                    div class="flex flex-col gap-4" {
                        div class="rounded-lg border border-neutral-200 bg-neutral-50/70 p-3" {
                            @if params.can_send_to_all {
                                @let label = match params.user_count {
                                    Some(count) => format!("Send to all active users (~{count} registered)"),
                                    None => "Send to all active users".to_string(),
                                };
                                (checkbox("all_users", "true", &label, false, true))
                                p class="mt-1 ml-6 text-xs text-neutral-500" {
                                    "When enabled, automatically delivers this system DM to every registered user account that has not been deleted or scheduled for deletion. Excludes bots and system accounts."
                                }
                            } @else {
                                @let count_str = params.user_count.map(|c| c.to_string()).unwrap_or_else(|| ">1,000".to_string());
                                @let label = format!("Send to all active users (Unavailable: {count_str} users registered, limit is 1,000)");
                                (checkbox("all_users", "true", &label, false, false))
                                p class="mt-1 ml-6 text-xs text-amber-600" {
                                    "Broadcast to all users is limited to instances with 1,000 or fewer users to protect gateway performance and prevent notification storms. Please specify recipient user IDs directly."
                                }
                            }
                        }

                        div id="user-ids-container" class="flex flex-col gap-1 transition-opacity duration-150" {
                            (form_field_group(
                                "Recipient user IDs", "system-dm-user-ids",
                                true, None,
                                Some("One per line. Snowflake IDs only."),
                                html! {
                                    textarea id="system-dm-user-ids" name="user_ids"
                                        required rows="10"
                                        placeholder="1234567890123456789\n9876543210987654321"
                                        class=(FORM_TEXTAREA_CLASS) {}
                                },
                            ))
                        }
                        (form_field_group(
                            "Content", "system-dm-content",
                            true, None, None,
                            html! {
                                textarea id="system-dm-content" name="content"
                                    required rows="6" maxlength="4000"
                                    class=(FORM_TEXTAREA_CLASS) {}
                            },
                        ))
                        (form_actions(html! {
                            (submit_button("Queue send"))
                        }))
                    }
                }
            }
        }))
        script {
            (PreEscaped(r#"
                (function() {
                    const checkbox = document.querySelector('input[name="all_users"]');
                    const textarea = document.getElementById('system-dm-user-ids');
                    const container = document.getElementById('user-ids-container');
                    if (!checkbox || !textarea || !container) return;

                    function updateState() {
                        if (checkbox.checked) {
                            textarea.disabled = true;
                            textarea.removeAttribute('required');
                            container.classList.add('opacity-40', 'pointer-events-none');
                        } else {
                            textarea.disabled = false;
                            textarea.setAttribute('required', '');
                            container.classList.remove('opacity-40', 'pointer-events-none');
                        }
                    }

                    checkbox.addEventListener('change', updateState);
                    updateState();
                })();
            "#))
        }
    };
    admin_layout(config, auth, "System DMs", "system-dms", None, content)
}
