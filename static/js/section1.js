/**
 * Section 1 Controller (Academic Foundations & Basic Info)
 */
document.addEventListener("DOMContentLoaded", async () => {
    const state = QuizApp.getQuizState();

    // Introduction Stage Elements
    const introStage = document.getElementById("section-intro-stage");
    const questionsStage = document.getElementById("section-questions-stage");
    const btnStartQuestions = document.getElementById("btn-start-section-questions");
    const introMsgEl = document.getElementById("advisor-intro-message");
    const introText = introMsgEl ? introMsgEl.textContent.trim() : "";
    const introReplayBtn = document.getElementById("intro-replay-voice-btn");

    // Check cached audio
    const cachedData = QuizApp.getSectionData(1);
    const base64Audio = cachedData ? cachedData.audio : null;

    // Auto-play voice on load
    setTimeout(async () => {
        try {
            await QuizApp.playReportAudio(introText, base64Audio, 1);
        } catch (e) {
            console.log("Intro audio playback info:", e);
        }
    }, 400);

    if (introReplayBtn) {
        introReplayBtn.addEventListener("click", () => {
            QuizApp.playReportAudio(introText, base64Audio, 1);
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

    // Question Stage DOM Elements
    const subStanding = document.getElementById("substep-standing");
    const subMajor = document.getElementById("substep-major");
    const subGpa = document.getElementById("substep-gpa");
    const subAspirations = document.getElementById("substep-aspirations");

    const majorSelect = document.getElementById("major-select");
    const trackSelect = document.getElementById("track-select");
    const minorSelect = document.getElementById("minor-select");
    const nameInput = document.getElementById("user-name-input");
    const gpaInput = document.getElementById("gpa-input");
    const creditsInput = document.getElementById("credits-input");
    const industryInput = document.getElementById("target-industry-input");
    const salaryInput = document.getElementById("target-salary-input");
    const goalsInput = document.getElementById("career-goals-input");

    // Populate initial inputs from state
    if (nameInput) nameInput.value = state.user.name || "";
    if (gpaInput) gpaInput.value = state.user.gpa || "3.65";
    if (creditsInput) creditsInput.value = state.user.creditsCompleted || "45";
    if (industryInput) industryInput.value = state.user.targetCompanyIndustry || "Software Products";
    if (salaryInput) salaryInput.value = state.user.targetSalary || "$105,000";
    if (goalsInput) goalsInput.value = state.user.careerGoals || "Software Engineer";

    // Highlight standing pill
    document.querySelectorAll('#substep-standing .pill-option[data-name="classYear"]').forEach((pill) => {
        if (pill.getAttribute("data-value") === state.user.classYear) {
            pill.classList.add("active");
        } else {
            pill.classList.remove("active");
        }
    });

    let tracksByMajor = {};

    // Load academic options
    try {
        const res = await fetch("/api/academic-options");
        if (res.ok) {
            const data = await res.json();
            tracksByMajor = data.tracks_by_major || {};

            if (majorSelect) {
                majorSelect.innerHTML = "";
                (data.majors || ["Computer Science", "Data Science", "Information Systems"]).forEach((m) => {
                    const opt = document.createElement("option");
                    opt.value = m;
                    opt.textContent = m;
                    if (m === state.user.major) opt.selected = true;
                    majorSelect.appendChild(opt);
                });
            }

            const updateTracks = (selMajor) => {
                if (!trackSelect) return;
                trackSelect.innerHTML = '<option value="General">General Track</option>';
                const tList = tracksByMajor[selMajor] || [];
                tList.forEach((t) => {
                    if (t && t !== "General") {
                        const opt = document.createElement("option");
                        opt.value = t;
                        opt.textContent = t;
                        if (t === state.user.majorTrack) opt.selected = true;
                        trackSelect.appendChild(opt);
                    }
                });
            };

            updateTracks(majorSelect.value || state.user.major);

            if (minorSelect) {
                minorSelect.innerHTML = '<option value="None">None</option>';
                (data.minors || ["Cybersecurity", "Data Science", "Economics", "Mathematics"]).forEach((min) => {
                    const opt = document.createElement("option");
                    opt.value = min;
                    opt.textContent = min;
                    if (min === state.user.minor) opt.selected = true;
                    minorSelect.appendChild(opt);
                });
            }

            majorSelect.addEventListener("change", (e) => {
                const sel = e.target.value;
                QuizApp.updateUserData({ major: sel, majorTrack: "General" });
                updateTracks(sel);
                QuizApp.avatarSayTextOnly(QuizApp.HARDCODED_REACTIONS.major(sel), 1);
            });
        }
    } catch (e) {
        console.warn("Could not load dynamic academic options:", e);
    }

    // Sub-step Navigation
    const showSubstep = (blockToShow) => {
        [subStanding, subMajor, subGpa, subAspirations].forEach((b) => {
            if (b) b.hidden = true;
        });
        if (blockToShow) {
            blockToShow.hidden = false;
            window.scrollTo({ top: 0, behavior: "smooth" });
        }
    };

    // Standing Pills Click
    document.querySelectorAll('#substep-standing .pill-option[data-name="classYear"]').forEach((pill) => {
        pill.addEventListener("click", () => {
            document.querySelectorAll('#substep-standing .pill-option[data-name="classYear"]').forEach((p) => p.classList.remove("active"));
            pill.classList.add("active");
            const val = pill.getAttribute("data-value");
            QuizApp.updateUserData({ classYear: val });
            QuizApp.avatarSayTextOnly(QuizApp.HARDCODED_REACTIONS.classYear(val), 1);
        });
    });

    document.getElementById("btn-to-substep-major")?.addEventListener("click", () => {
        showSubstep(subMajor);
        QuizApp.avatarSayTextOnly("Select your primary major and track to load curriculum pathways.", 1);
    });

    document.getElementById("btn-back-to-standing")?.addEventListener("click", () => {
        showSubstep(subStanding);
    });

    document.getElementById("btn-to-substep-gpa")?.addEventListener("click", () => {
        QuizApp.updateUserData({
            name: nameInput?.value || "",
            major: majorSelect?.value || "Computer Science",
            majorTrack: trackSelect?.value || "General",
            minor: minorSelect?.value || "None",
        });
        showSubstep(subGpa);
        QuizApp.avatarSayTextOnly("Let's record your cumulative GPA and earned credit total.", 1);
    });

    document.getElementById("btn-back-to-major")?.addEventListener("click", () => {
        showSubstep(subMajor);
    });

    // Real-time reactions for GPA and Credits
    gpaInput?.addEventListener("input", (e) => {
        QuizApp.updateUserData({ gpa: e.target.value });
    });
    gpaInput?.addEventListener("blur", (e) => {
        QuizApp.avatarSayTextOnly(QuizApp.HARDCODED_REACTIONS.gpa(e.target.value), 1);
    });

    creditsInput?.addEventListener("input", (e) => {
        QuizApp.updateUserData({ creditsCompleted: e.target.value });
    });
    creditsInput?.addEventListener("blur", (e) => {
        QuizApp.avatarSayTextOnly(QuizApp.HARDCODED_REACTIONS.credits(e.target.value), 1);
    });

    // Sub-step Aspirations & Baseline Matches
    const renderMatches = (matches) => {
        const grid = document.getElementById("section-1-matches-grid");
        if (!grid) return;
        grid.innerHTML = "";
        (matches || []).forEach((m) => {
            const card = document.createElement("div");
            card.className = "alumni-card";
            card.innerHTML = `
                <div>
                    <div class="card-top-row">
                        <span class="alum-id-badge">${QuizApp.escapeHtml(m.campus_id)}</span>
                        <span class="alum-salary-badge">${QuizApp.escapeHtml(m.first_job_annual_salary_usd || "$105,000")}</span>
                    </div>
                    <h4 class="alum-role-title">${QuizApp.escapeHtml(m.first_job_title || "Software Engineer")}</h4>
                    <p class="alum-employer">${QuizApp.escapeHtml(m.first_employer || "Amazon Web Services")} &bull; ${QuizApp.escapeHtml(m.first_employer_industry || "Tech")}</p>
                    <p style="font-size:0.83rem; color:var(--text-secondary); margin-bottom:0.75rem;">
                        ${QuizApp.escapeHtml(m.match_reason || "Matched on major & career trajectory")}
                    </p>
                </div>
                <div class="alum-highlight-tags">
                    <span class="highlight-tag">${QuizApp.escapeHtml(m.final_gpa || 3.8)} GPA</span>
                    <span class="highlight-tag">${QuizApp.escapeHtml(m.time_to_degree_years || 4.0)} Yrs</span>
                    <span class="highlight-tag" style="color:var(--accent-gold);">${QuizApp.escapeHtml(m.track || "Standard")}</span>
                </div>
            `;
            grid.appendChild(card);
        });
    };

    const loadBaselineReport = async () => {
        try {
            const res = await fetch("/api/generate-report", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    section_name: "basic_info",
                    user_data: QuizApp.getQuizState().user,
                }),
            });
            if (res.ok) {
                const data = await res.json();
                QuizApp.saveSectionData(1, data);
                if (data.matches) renderMatches(data.matches);
                if (data.text) QuizApp.avatarSayTextOnly(data.text, 1);
            }
        } catch (e) {
            console.warn("Could not generate baseline report:", e);
        }
    };

    document.getElementById("btn-to-substep-aspirations")?.addEventListener("click", () => {
        QuizApp.updateUserData({
            gpa: gpaInput?.value || "3.65",
            creditsCompleted: creditsInput?.value || "45",
        });
        showSubstep(subAspirations);
        loadBaselineReport();
    });

    document.getElementById("btn-back-to-gpa")?.addEventListener("click", () => {
        showSubstep(subGpa);
    });

    industryInput?.addEventListener("input", (e) => {
        QuizApp.updateUserData({ targetCompanyIndustry: e.target.value });
    });
    industryInput?.addEventListener("blur", (e) => {
        QuizApp.avatarSayTextOnly(QuizApp.HARDCODED_REACTIONS.industry(e.target.value), 1);
        loadBaselineReport();
    });

    salaryInput?.addEventListener("input", (e) => {
        QuizApp.updateUserData({ targetSalary: e.target.value });
    });
    salaryInput?.addEventListener("blur", (e) => {
        QuizApp.avatarSayTextOnly(QuizApp.HARDCODED_REACTIONS.salary(e.target.value), 1);
    });

    goalsInput?.addEventListener("input", (e) => {
        QuizApp.updateUserData({ careerGoals: e.target.value });
    });
    goalsInput?.addEventListener("blur", (e) => {
        QuizApp.avatarSayTextOnly(QuizApp.HARDCODED_REACTIONS.goals(e.target.value), 1);
    });

    // Proceed to Section 2 Loading Screen
    document.getElementById("btn-next-to-section-2")?.addEventListener("click", () => {
        QuizApp.stopAllSpeech();
        QuizApp.updateUserData({
            targetCompanyIndustry: industryInput?.value || "Software Products",
            targetSalary: salaryInput?.value || "$105,000",
            careerGoals: goalsInput?.value || "Software Engineer",
        });
        window.location.href = "/loading?next=2";
    });

    QuizApp.bindVoiceReplayListeners();
});
