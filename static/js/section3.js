/**
 * Section 3 Controller (Campus Involvement & Co-Curriculars)
 */
document.addEventListener("DOMContentLoaded", async () => {
    const state = QuizApp.getQuizState();
    let sec3Data = QuizApp.getSectionData(3);

    // Introduction Stage Elements
    const introStage = document.getElementById("section-intro-stage");
    const questionsStage = document.getElementById("section-questions-stage");
    const btnStartQuestions = document.getElementById("btn-start-section-questions");
    const introMsgEl = document.getElementById("advisor-intro-message");
    const introText = introMsgEl ? introMsgEl.textContent.trim() : "";
    const introReplayBtn = document.getElementById("intro-replay-voice-btn");

    const base64Audio = sec3Data ? sec3Data.audio : null;

    // Auto-play voice on load
    setTimeout(async () => {
        try {
            await QuizApp.playReportAudio(introText, base64Audio, 3);
        } catch (e) {
            console.log("Intro audio playback info:", e);
        }
    }, 400);

    if (introReplayBtn) {
        introReplayBtn.addEventListener("click", () => {
            QuizApp.playReportAudio(introText, base64Audio, 3);
        });
    }

    if (btnStartQuestions) {
        btnStartQuestions.addEventListener("click", () => {
            QuizApp.stopAllSpeech();
            if (introStage) {
                introStage.remove();
            }
            if (questionsStage) {
                questionsStage.hidden = false;
                questionsStage.removeAttribute("hidden");
                questionsStage.style.display = "block";
                window.scrollTo({ top: 0, behavior: "smooth" });
            }
        });
    }

    const customInput = document.getElementById("custom-activity-input");
    if (customInput) {
        customInput.value = state.user.customActivity || "";
    }

    // Set initial active pills
    document.querySelectorAll("#involvement-pills-container .involvement-pill").forEach((pill) => {
        const name = pill.getAttribute("data-name");
        pill.classList.toggle("active", (state.user.selectedActivities || []).includes(name));
    });

    const renderMatches = (data) => {
        if (!data) return;

        if (data.text) {
            QuizApp.avatarSayTextOnly(data.text, 3);
        }

        const grid = document.getElementById("section-3-matches-grid");
        const matches = data.matches || [];

        if (grid) {
            grid.innerHTML = "";
            matches.forEach((m) => {
                const card = document.createElement("div");
                card.className = "alumni-card";
                const actsList = (m.activities_joined || ["HackUMBC", "ACM Student Chapter"])
                    .map((a) => `<span class="highlight-tag" style="color:#fdba74;">${QuizApp.escapeHtml(a)}</span>`)
                    .join("");

                card.innerHTML = `
                    <div>
                        <div class="card-top-row">
                            <span class="alum-id-badge">${QuizApp.escapeHtml(m.campus_id)}</span>
                            <span class="alum-salary-badge">${QuizApp.escapeHtml(m.first_job_annual_salary_usd || "$108,000")}</span>
                        </div>
                        <h4 class="alum-role-title">${QuizApp.escapeHtml(m.first_job_title || "Software Engineer")}</h4>
                        <p class="alum-employer">${QuizApp.escapeHtml(m.first_employer || "Amazon")} &bull; <span style="color:var(--avatar-orange);">${QuizApp.escapeHtml(m.major || "Computer Science")}</span></p>
                        <div style="background-color:rgba(0,0,0,0.25); padding:0.6rem; border-radius:6px; margin-bottom:0.6rem;">
                            <span style="font-size:0.68rem; text-transform:uppercase; color:var(--text-muted); font-weight:600;">Campus Engagement Record</span>
                            <p style="font-size:0.78rem; color:var(--text-secondary); margin-top:0.25rem;">
                                ${QuizApp.escapeHtml(m.outlier_story || "Built award-winning hackathon project and led student workshops.")}
                            </p>
                        </div>
                    </div>
                    <div class="alum-highlight-tags">
                        ${actsList}
                    </div>
                `;
                grid.appendChild(card);
            });
        }
    };

    if (!sec3Data) {
        try {
            const res = await fetch("/api/generate-report", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    section_name: "campus_involvement",
                    user_data: state.user,
                }),
            });
            if (res.ok) {
                sec3Data = await res.json();
                QuizApp.saveSectionData(3, sec3Data);
            }
        } catch (e) {
            console.warn("Could not fetch section 3 data:", e);
        }
    }

    renderMatches(sec3Data);

    // Pill Click Handlers
    document.querySelectorAll("#involvement-pills-container .involvement-pill").forEach((pill) => {
        pill.addEventListener("click", () => {
            pill.classList.toggle("active");
            const name = pill.getAttribute("data-name");
            let list = state.user.selectedActivities || [];

            if (pill.classList.contains("active")) {
                if (!list.includes(name)) list.push(name);
                QuizApp.avatarSayTextOnly(QuizApp.HARDCODED_REACTIONS.activity(name), 3);
            } else {
                list = list.filter((a) => a !== name);
                QuizApp.avatarSayTextOnly(`Removed ${name} from your active involvement list.`, 3);
            }
            state.user.selectedActivities = list;
            QuizApp.updateUserData({ selectedActivities: list });
        });
    });

    if (customInput) {
        customInput.addEventListener("input", (e) => {
            QuizApp.updateUserData({ customActivity: e.target.value });
        });
        customInput.addEventListener("blur", (e) => {
            if (e.target.value.trim()) {
                QuizApp.avatarSayTextOnly(QuizApp.HARDCODED_REACTIONS.customActivity(e.target.value.trim()), 3);
            }
        });
    }

    // Update Involvement Matches Button
    const btnUpdate = document.getElementById("btn-update-involvement");
    const spinner = document.getElementById("spinner-section-3");

    if (btnUpdate) {
        btnUpdate.addEventListener("click", async () => {
            if (spinner) spinner.hidden = false;
            btnUpdate.disabled = true;

            try {
                const res = await fetch("/api/generate-report", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        section_name: "campus_involvement",
                        user_data: QuizApp.getQuizState().user,
                    }),
                });
                if (res.ok) {
                    const data = await res.json();
                    QuizApp.saveSectionData(3, data);
                    renderMatches(data);
                    QuizApp.playReportAudio(data.text, data.audio, 3);
                }
            } catch (err) {
                console.error("Update involvement error:", err);
            } finally {
                if (spinner) spinner.hidden = true;
                btnUpdate.disabled = false;
            }
        });
    }

    // Proceed Button
    const btnNext = document.getElementById("btn-next-to-section-4");
    if (btnNext) {
        btnNext.addEventListener("click", () => {
            QuizApp.stopAllSpeech();
            window.location.href = "/loading?next=4";
        });
    }

    QuizApp.bindVoiceReplayListeners();
});
