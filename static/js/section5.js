/**
 * Section 5 Controller (Final Report & Database Save)
 */
document.addEventListener("DOMContentLoaded", async () => {
    const state = QuizApp.getQuizState();
    let sec5Data = QuizApp.getSectionData(5);

    // Introduction Stage Elements
    const introStage = document.getElementById("section-intro-stage");
    const questionsStage = document.getElementById("section-questions-stage");
    const btnStartQuestions = document.getElementById("btn-start-section-questions");
    const introMsgEl = document.getElementById("advisor-intro-message");
    const introText = introMsgEl ? introMsgEl.textContent.trim() : "";
    const introReplayBtn = document.getElementById("intro-replay-voice-btn");

    const base64Audio = sec5Data ? sec5Data.audio : null;

    // Auto-play voice on load
    setTimeout(async () => {
        try {
            await QuizApp.playReportAudio(introText, base64Audio, 5);
        } catch (e) {
            console.log("Intro audio playback info:", e);
        }
    }, 400);

    if (introReplayBtn) {
        introReplayBtn.addEventListener("click", () => {
            QuizApp.playReportAudio(introText, base64Audio, 5);
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

    const renderMatrix = () => {
        const matrixContainer = document.getElementById("final-summary-matrix");
        if (!matrixContainer) return;

        matrixContainer.innerHTML = `
            <div class="matrix-box">
                <span class="matrix-box-label">Class Year &amp; Major</span>
                <div class="matrix-box-val" style="font-size:1.05rem;">${QuizApp.escapeHtml(state.user.classYear)} &bull; ${QuizApp.escapeHtml(state.user.major)}</div>
            </div>
            <div class="matrix-box">
                <span class="matrix-box-label">Target Industry</span>
                <div class="matrix-box-val" style="font-size:1.05rem; color:var(--accent-emerald);">${QuizApp.escapeHtml(state.user.targetCompanyIndustry || "Software Products")}</div>
            </div>
            <div class="matrix-box">
                <span class="matrix-box-label">Target Starting Comp</span>
                <div class="matrix-box-val">${QuizApp.escapeHtml(state.user.targetSalary || "$105,000")}</div>
            </div>
            <div class="matrix-box">
                <span class="matrix-box-label">Credits &amp; GPA</span>
                <div class="matrix-box-val" style="font-size:1.05rem;">${QuizApp.escapeHtml(state.user.creditsCompleted)} cr &bull; ${QuizApp.escapeHtml(state.user.gpa || "3.65")} GPA</div>
            </div>
        `;
    };

    const renderMatches = (data) => {
        if (!data) return;

        if (data.text) {
            QuizApp.avatarSayTextOnly(data.text, 5);
        }

        const grid = document.getElementById("section-5-matches-grid");
        const matches = data.matches || [];

        if (grid) {
            grid.innerHTML = "";
            matches.forEach((m) => {
                const card = document.createElement("div");
                card.className = "alumni-card";
                card.innerHTML = `
                    <div>
                        <div class="card-top-row">
                            <span class="alum-id-badge">${QuizApp.escapeHtml(m.campus_id)}</span>
                            <span class="alum-salary-badge">${QuizApp.escapeHtml(m.first_job_annual_salary_usd || "$110,000")}</span>
                        </div>
                        <h4 class="alum-role-title">${QuizApp.escapeHtml(m.first_job_title || "Software Engineer")}</h4>
                        <p class="alum-employer">${QuizApp.escapeHtml(m.first_employer || "Amazon")} &bull; ${QuizApp.escapeHtml(m.major || "Computer Science")}</p>
                        <p style="font-size:0.83rem; color:var(--text-secondary); margin-bottom:0.75rem;">
                            ${QuizApp.escapeHtml(m.blueprint_summary || "Completed 4-year degree with 2 internships and top elective sequence.")}
                        </p>
                    </div>
                    <div class="alum-highlight-tags">
                        <span class="highlight-tag" style="color:var(--accent-gold);">${QuizApp.escapeHtml(m.internships || 2)} Internships</span>
                        <span class="highlight-tag">${QuizApp.escapeHtml(m.final_gpa || "3.8")} GPA</span>
                        <span class="highlight-tag" style="color:var(--accent-emerald);">4.0 Yrs</span>
                    </div>
                `;
                grid.appendChild(card);
            });
        }
    };

    renderMatrix();

    if (!sec5Data) {
        try {
            const res = await fetch("/api/generate-report", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    section_name: "final_report",
                    user_data: state.user,
                }),
            });
            if (res.ok) {
                sec5Data = await res.json();
                QuizApp.saveSectionData(5, sec5Data);
            }
        } catch (e) {
            console.warn("Could not fetch section 5 data:", e);
        }
    }

    renderMatches(sec5Data);

    // Save to Database Button
    const btnSave = document.getElementById("btn-save-to-db");
    const spinner = document.getElementById("spinner-save-db");
    const msgEl = document.getElementById("save-confirmation-msg");

    if (btnSave) {
        btnSave.addEventListener("click", async () => {
            if (spinner) spinner.hidden = false;
            btnSave.disabled = true;

            try {
                const res = await fetch("/api/submit-quiz", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        role: "student",
                        student: {
                            classYear: state.user.classYear,
                            demographics: {
                                name: state.user.name,
                                major: state.user.major,
                                majorTrack: state.user.majorTrack,
                                otherCategories: state.user.minor,
                                gpa: state.user.gpa,
                                creditsCompleted: state.user.creditsCompleted,
                            },
                            aspirations: {
                                targetCompaniesIndustries: state.user.targetCompanyIndustry,
                                expectedSalaryUsd: state.user.targetSalary,
                                targetLocation: state.user.targetLocation,
                                careerGoals: state.user.careerGoals,
                                expectedGraduationYear: state.user.expectedGradYear,
                            },
                            involvement: {
                                clubsAndActivities: (state.user.selectedActivities || []).join(", "),
                                rolesAndInterests: state.user.customActivity || "",
                            },
                            experience: {
                                projectsAndSkills: state.user.skills || "",
                                internshipsAndJobs: state.user.internships || "",
                            },
                        },
                    }),
                });

                const result = await res.json();
                if (result.user_id) {
                    const s = QuizApp.getQuizState();
                    s.activeUserId = result.user_id;
                    QuizApp.saveQuizState(s);
                }
                if (msgEl) {
                    msgEl.hidden = false;
                    msgEl.textContent = `✓ Report successfully saved to Tiger Data (Record ID: ${result.submission_id || "Saved"}).`;
                }
                QuizApp.avatarSayTextOnly("Your comprehensive career report has been officially saved to Tiger Data!", 5);
            } catch (err) {
                console.error("Save error:", err);
                alert("Unable to save report to database.");
            } finally {
                if (spinner) spinner.hidden = true;
                btnSave.disabled = false;
            }
        });
    }

    // Restart Quiz Button
    const btnRestart = document.getElementById("btn-restart-quiz");
    if (btnRestart) {
        btnRestart.addEventListener("click", () => {
            QuizApp.stopAllSpeech();
            if (confirm("Start a new student career assessment?")) {
                QuizApp.resetQuizState();
                window.location.href = "/section/1";
            }
        });
    }

    QuizApp.bindVoiceReplayListeners();
});
