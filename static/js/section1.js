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
                questionsStage.style.display = "grid";
                document.querySelector(".page-wrapper")?.classList.add("section1-immersive");
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

    const shouldClearInputsOnReload = QuizApp.shouldResetFormInputsOnReload();
    const showRequiredError = (id, message) => {
        const error = document.getElementById(id);
        if (error) {
            error.textContent = message;
            error.hidden = false;
        }
    };
    const clearRequiredError = (id) => {
        const error = document.getElementById(id);
        if (error) error.hidden = true;
    };

    // Keep the saved quiz state intact, but clear the visible form on reload so users can re-enter answers.
    if (nameInput) nameInput.value = shouldClearInputsOnReload ? "" : (state.user.name || "");
    if (gpaInput) gpaInput.value = shouldClearInputsOnReload ? "" : (state.user.gpa || "");
    if (creditsInput) creditsInput.value = shouldClearInputsOnReload ? "" : (state.user.creditsCompleted || "");
    if (industryInput) industryInput.value = shouldClearInputsOnReload ? "" : (state.user.targetCompanyIndustry || "");
    if (salaryInput) salaryInput.value = shouldClearInputsOnReload ? "" : (state.user.targetSalary || "");
    if (goalsInput) goalsInput.value = shouldClearInputsOnReload ? "" : (state.user.careerGoals || "");

    let tracksByMajor = {};

    // Load academic options
    try {
        const res = await fetch("/api/academic-options");
        if (res.ok) {
            const data = await res.json();
            tracksByMajor = data.tracks_by_major || {};
            const allTracks = (data.tracks || []).filter(Boolean);
            const majorByTrack = Object.entries(tracksByMajor).reduce((acc, [major, tracks]) => {
                tracks.forEach((track) => {
                    if (track && !acc[track]) {
                        acc[track] = major;
                    }
                });
                return acc;
            }, {});

            if (majorSelect) {
                majorSelect.innerHTML = '<option value="" selected disabled>Choose one</option>';
                (data.majors || []).forEach((m) => {
                    const opt = document.createElement("option");
                    opt.value = m;
                    opt.textContent = m;
                    if (!shouldClearInputsOnReload && state.user.major === m) {
                        opt.selected = true;
                    }
                    majorSelect.appendChild(opt);
                });

                if (shouldClearInputsOnReload) {
                    majorSelect.value = "";
                }
            }

            const updateTracks = (selMajor = "") => {
                if (!trackSelect) return;
                trackSelect.innerHTML = '<option value="" selected>Choose one</option>';

                const tList = selMajor ? (tracksByMajor[selMajor] || []) : allTracks;
                const options = tList.length ? tList : allTracks;

                options.forEach((t) => {
                    if (!t || t === "General" && selMajor) {
                        return;
                    }
                    const opt = document.createElement("option");
                    opt.value = t;
                    opt.textContent = t;
                    if (!shouldClearInputsOnReload && state.user.majorTrack === t) {
                        opt.selected = true;
                    }
                    trackSelect.appendChild(opt);
                });

                if (shouldClearInputsOnReload || !state.user.majorTrack || !options.includes(state.user.majorTrack)) {
                    trackSelect.value = "";
                }
            };

            updateTracks("");

            if (minorSelect) {
                minorSelect.innerHTML = '<option value="" selected>Choose one</option><option value="None">None</option>';
                (data.minors || []).forEach((min) => {
                    const opt = document.createElement("option");
                    opt.value = min;
                    opt.textContent = min;
                    if (!shouldClearInputsOnReload && state.user.minor === min) {
                        opt.selected = true;
                    }
                    minorSelect.appendChild(opt);
                });

                if (shouldClearInputsOnReload) {
                    minorSelect.value = "";
                }
            }

            majorSelect.addEventListener("change", (e) => {
                const sel = e.target.value;
                QuizApp.updateUserData({ major: sel, majorTrack: "" });
                updateTracks(sel);
                if (sel) {
                    QuizApp.avatarSayTextOnly(QuizApp.HARDCODED_REACTIONS.major(sel), 1);
                }
            });

            trackSelect.addEventListener("change", (e) => {
                const selectedTrack = e.target.value;
                if (!selectedTrack) {
                    return;
                }

                const matchedMajor = majorByTrack[selectedTrack] || "";
                if (matchedMajor) {
                    majorSelect.value = matchedMajor;
                    QuizApp.updateUserData({ major: matchedMajor, majorTrack: selectedTrack });
                } else {
                    QuizApp.updateUserData({ majorTrack: selectedTrack });
                }
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
            clearRequiredError("standing-required-error");
            QuizApp.avatarSayTextOnly(QuizApp.HARDCODED_REACTIONS.classYear(val), 1);
        });
    });

    document.getElementById("btn-to-substep-major")?.addEventListener("click", () => {
        if (!document.querySelector('#substep-standing .pill-option[data-name="classYear"].active')) {
            showRequiredError("standing-required-error", "Choose your college standing before continuing.");
            return;
        }
        clearRequiredError("standing-required-error");
        showSubstep(subMajor);
        QuizApp.avatarSayTextOnly("Select your primary major and track to load curriculum pathways.", 1);
    });

    document.getElementById("btn-back-to-standing")?.addEventListener("click", () => {
        showSubstep(subStanding);
        QuizApp.avatarSayTextOnly("Review or update your college standing. Choose the option that best describes your current status.", 1);
    });

    document.getElementById("btn-to-substep-gpa")?.addEventListener("click", () => {
        if (!majorSelect?.value || !industryInput?.value.trim()) {
            showRequiredError("major-required-error", "Choose a primary major and enter a target industry or dream employer before continuing.");
            if (!majorSelect?.value) majorSelect?.focus();
            else industryInput?.focus();
            return;
        }
        clearRequiredError("major-required-error");
        QuizApp.updateUserData({
            name: nameInput?.value || "",
            major: majorSelect.value,
            majorTrack: trackSelect?.value || "",
            minor: minorSelect?.value || "",
            targetCompanyIndustry: industryInput.value.trim(),
            targetSalary: salaryInput?.value || "",
            careerGoals: goalsInput?.value || "",
        });
        showSubstep(subGpa);
        QuizApp.avatarSayTextOnly("Let's record your cumulative GPA and earned credit total.", 1);
    });

    document.getElementById("btn-back-to-major")?.addEventListener("click", () => {
        showSubstep(subMajor);
        QuizApp.avatarSayTextOnly("Review or update your major, track, minor, and career goals before continuing.", 1);
    });

    // Real-time reactions for GPA and Credits
    gpaInput?.addEventListener("input", (e) => {
        QuizApp.updateUserData({ gpa: e.target.value });
        clearRequiredError("gpa-required-error");
    });
    gpaInput?.addEventListener("blur", (e) => {
        QuizApp.avatarSayTextOnly(QuizApp.HARDCODED_REACTIONS.gpa(e.target.value), 1);
    });

    creditsInput?.addEventListener("input", (e) => {
        QuizApp.updateUserData({ creditsCompleted: e.target.value });
        clearRequiredError("gpa-required-error");
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
            }
        } catch (e) {
            console.warn("Could not generate baseline report:", e);
        }
    };

    document.getElementById("btn-to-substep-aspirations")?.addEventListener("click", () => {
        if (!gpaInput?.value || !gpaInput.checkValidity() || !creditsInput?.value || !creditsInput.checkValidity()) {
            showRequiredError("gpa-required-error", "Enter a valid GPA from 0.00 to 4.00 and total earned credits before continuing.");
            if (!gpaInput?.value || !gpaInput.checkValidity()) gpaInput?.focus();
            else creditsInput?.focus();
            return;
        }
        clearRequiredError("gpa-required-error");
        QuizApp.updateUserData({
            gpa: gpaInput.value,
            creditsCompleted: creditsInput.value,
        });
        showSubstep(subAspirations);
        const thankYouMessage = "Thank you for sharing your academic profile, goals, and background. Our advisor team is excited to help you explore your options and build a personalized plan.";
        QuizApp.avatarSayTextOnly(thankYouMessage, 1);
        QuizApp.speakWebSpeech(thankYouMessage, 1);
        loadBaselineReport();
    });

    document.getElementById("btn-back-to-gpa")?.addEventListener("click", () => {
        showSubstep(subGpa);
        QuizApp.avatarSayTextOnly("Review or update your GPA and completed credits before continuing.", 1);
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
        const user = QuizApp.getQuizState().user;
        if (!user.classYear || !user.major || !user.targetCompanyIndustry?.trim() || !user.gpa || !user.creditsCompleted) {
            showSubstep(!user.classYear ? subStanding : (!user.gpa || !user.creditsCompleted ? subGpa : subMajor));
            showRequiredError(!user.classYear ? "standing-required-error" : (!user.gpa || !user.creditsCompleted ? "gpa-required-error" : "major-required-error"), "Complete the required information on this step before continuing.");
            return;
        }
        QuizApp.stopAllSpeech();
        QuizApp.updateUserData({
            targetCompanyIndustry: industryInput?.value.trim() || "",
            targetSalary: salaryInput?.value || "",
            careerGoals: goalsInput?.value || "",
        });
        window.location.href = "/loading?next=2";
    });

    QuizApp.bindVoiceReplayListeners();
});
