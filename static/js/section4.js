/**
 * Section 4 Controller (Professional Skills & Internships)
 */
document.addEventListener("DOMContentLoaded", async () => {
    const state = QuizApp.getQuizState();
    let sec4Data = QuizApp.getSectionData(4);

    // Introduction Stage Elements
    const introStage = document.getElementById("section-intro-stage");
    const questionsStage = document.getElementById("section-questions-stage");
    const btnStartQuestions = document.getElementById("btn-start-section-questions");
    const introMsgEl = document.getElementById("advisor-intro-message");
    const introText = introMsgEl ? introMsgEl.textContent.trim() : "";
    const introReplayBtn = document.getElementById("intro-replay-voice-btn");

    const base64Audio = sec4Data ? sec4Data.audio : null;

    // Auto-play voice on load
    setTimeout(async () => {
        try {
            await QuizApp.playReportAudio(introText, base64Audio, 4);
        } catch (e) {
            console.log("Intro audio playback info:", e);
        }
    }, 400);

    if (introReplayBtn) {
        introReplayBtn.addEventListener("click", () => {
            QuizApp.playReportAudio(introText, base64Audio, 4);
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

    const skillsInput = document.getElementById("user-skills-input");
    const internshipsInput = document.getElementById("user-internships-input");

    if (skillsInput) skillsInput.value = state.user.skills || "Python, SQL, AWS, Git, Linux";
    if (internshipsInput) internshipsInput.value = state.user.internships || "";

    const syncSkillPills = () => {
        const currentSkills = (skillsInput?.value || "").split(",").map((s) => s.trim().toLowerCase());
        document.querySelectorAll("#quick-skills-container .skill-pill").forEach((pill) => {
            const skill = (pill.getAttribute("data-skill") || "").toLowerCase();
            const isActive = currentSkills.some((s) => s && skill.includes(s));
            pill.classList.toggle("active", isActive);
        });
    };
    syncSkillPills();

    const renderMatches = (data) => {
        if (!data) return;

        if (data.text) {
            QuizApp.avatarSayTextOnly(data.text, 4);
        }

        const grid = document.getElementById("section-4-matches-grid");
        const matches = data.matches || [];

        if (grid) {
            grid.innerHTML = "";
            matches.forEach((m) => {
                const card = document.createElement("div");
                card.className = "alumni-card";
                const skillsList = (m.skills_mastered || ["Python", "AWS", "SQL", "Git"])
                    .map((s) => `<span class="highlight-tag" style="color:#c4b5fd;">${QuizApp.escapeHtml(s)}</span>`)
                    .join("");
                const internList = (m.internships_held || [])
                    .slice(0, 2)
                    .map((i) => `<div style="font-size:0.78rem; color:var(--text-secondary); margin-top:0.25rem;">&bull; ${QuizApp.escapeHtml(i)}</div>`)
                    .join("");

                card.innerHTML = `
                    <div>
                        <div class="card-top-row">
                            <span class="alum-id-badge">${QuizApp.escapeHtml(m.campus_id)}</span>
                            <span class="alum-salary-badge">${QuizApp.escapeHtml(m.first_job_annual_salary_usd || "$112,000")}</span>
                        </div>
                        <h4 class="alum-role-title">${QuizApp.escapeHtml(m.first_job_title || "Software Specialist")}</h4>
                        <p class="alum-employer">${QuizApp.escapeHtml(m.first_employer || "Tech Company")} &bull; <span style="color:var(--avatar-purple);">${QuizApp.escapeHtml(m.internship_count || 2)} Internships</span></p>
                        <div style="background-color:rgba(0,0,0,0.25); padding:0.6rem; border-radius:6px; margin-bottom:0.6rem;">
                            <span style="font-size:0.68rem; text-transform:uppercase; color:var(--text-muted); font-weight:600;">Internship History</span>
                            ${internList || "<div style='font-size:0.78rem; color:var(--text-secondary);'>Pre-grad summer internship</div>"}
                        </div>
                    </div>
                    <div class="alum-highlight-tags">
                        ${skillsList}
                    </div>
                `;
                grid.appendChild(card);
            });
        }
    };

    if (!sec4Data) {
        try {
            const res = await fetch("/api/generate-report", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    section_name: "professional_involvement",
                    user_data: state.user,
                }),
            });
            if (res.ok) {
                sec4Data = await res.json();
                QuizApp.saveSectionData(4, sec4Data);
            }
        } catch (e) {
            console.warn("Could not fetch section 4 data:", e);
        }
    }

    renderMatches(sec4Data);

    // Skill Pills Click Handlers
    document.querySelectorAll("#quick-skills-container .skill-pill").forEach((pill) => {
        pill.addEventListener("click", () => {
            pill.classList.toggle("active");
            const skill = pill.getAttribute("data-skill");
            let list = (skillsInput?.value || "").split(",").map((s) => s.trim()).filter(Boolean);

            if (pill.classList.contains("active")) {
                if (!list.includes(skill)) list.push(skill);
                QuizApp.avatarSayTextOnly(QuizApp.HARDCODED_REACTIONS.skill(skill), 4);
            } else {
                list = list.filter((s) => s !== skill);
                QuizApp.avatarSayTextOnly(`Removed ${skill} from your skills list.`, 4);
            }
            if (skillsInput) skillsInput.value = list.join(", ");
            QuizApp.updateUserData({ skills: skillsInput?.value || "" });
        });
    });

    if (skillsInput) {
        skillsInput.addEventListener("input", (e) => {
            QuizApp.updateUserData({ skills: e.target.value });
            syncSkillPills();
        });
        skillsInput.addEventListener("blur", (e) => {
            if (e.target.value.trim()) {
                QuizApp.avatarSayTextOnly(QuizApp.HARDCODED_REACTIONS.skillsInput(e.target.value.trim()), 4);
            }
        });
    }

    if (internshipsInput) {
        internshipsInput.addEventListener("input", (e) => {
            QuizApp.updateUserData({ internships: e.target.value });
        });
        internshipsInput.addEventListener("blur", (e) => {
            if (e.target.value.trim()) {
                QuizApp.avatarSayTextOnly(QuizApp.HARDCODED_REACTIONS.internshipsInput(e.target.value.trim()), 4);
            }
        });
    }

    // Update Professional Matches Button
    const btnUpdate = document.getElementById("btn-update-professional");
    const spinner = document.getElementById("spinner-section-4");

    if (btnUpdate) {
        btnUpdate.addEventListener("click", async () => {
            if (spinner) spinner.hidden = false;
            btnUpdate.disabled = true;

            try {
                const res = await fetch("/api/generate-report", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        section_name: "professional_involvement",
                        user_data: QuizApp.getQuizState().user,
                    }),
                });
                if (res.ok) {
                    const data = await res.json();
                    QuizApp.saveSectionData(4, data);
                    renderMatches(data);
                    QuizApp.playReportAudio(data.text, data.audio, 4);
                }
            } catch (err) {
                console.error("Update professional error:", err);
            } finally {
                if (spinner) spinner.hidden = true;
                btnUpdate.disabled = false;
            }
        });
    }

    // Proceed Button
    const btnNext = document.getElementById("btn-next-to-section-5");
    if (btnNext) {
        btnNext.addEventListener("click", () => {
            QuizApp.stopAllSpeech();
            window.location.href = "/loading?next=5";
        });
    }

    QuizApp.bindVoiceReplayListeners();
});
