/**
 * Section 2 Controller (Course Advising & Electives)
 * Implements:
 * 1. Suppressed early recommendations (recommendations only appear in Stage C report).
 * 2. Sequential 3-Question Flow (Screen 1: Required -> Screen 2: Electives -> Screen 3: Planned).
 * 3. Section 2 Final Report with 5-Card Class Analysis breakdown and Top 3 Alumni Matches at the bottom.
 */
document.addEventListener("DOMContentLoaded", async () => {
    const state = QuizApp.getQuizState();

    // Stage Containers
    const introStage = document.getElementById("section-intro-stage");
    const questionsStage = document.getElementById("section-questions-stage");
    const reportStage = document.getElementById("section-report-stage");

    // Intro Stage Elements
    const btnStartQuestions = document.getElementById("btn-start-section-questions");
    const introMsgEl = document.getElementById("advisor-intro-message");
    const introText = introMsgEl ? introMsgEl.textContent.trim() : "";
    const introReplayBtn = document.getElementById("intro-replay-voice-btn");

    // Sequential Substeps (Screens 1, 2, 3)
    const subRequired = document.getElementById("substep-required-courses");
    const subElectives = document.getElementById("substep-electives");
    const subPlanned = document.getElementById("substep-planned");

    // Screen 1 Elements
    const majorLabel = document.getElementById("student-major-label");
    const requiredGrid = document.getElementById("required-courses-grid");
    const requiredSpinner = document.getElementById("required-loading-spinner");
    const btnToElectives = document.getElementById("btn-to-electives");
    const noneRequiredCheckbox = document.getElementById("none-required-courses");

    // Screen 2 Elements
    const industryLabel = document.getElementById("student-industry-label");
    const popularGrid = document.getElementById("popular-electives-grid");
    const electivesSpinner = document.getElementById("electives-loading-spinner");
    const customElectivesInput = document.getElementById("custom-electives-input");
    const noneElectivesCheckbox = document.getElementById("none-electives");
    const btnBackToRequired = document.getElementById("btn-back-to-required");
    const btnToPlanned = document.getElementById("btn-to-planned");

    // Screen 3 Elements
    const catalogPills = document.getElementById("catalog-course-pills");
    const customPlannedInput = document.getElementById("custom-planned-input");
    const noPlannedCoursesCheckbox = document.getElementById("no-planned-courses");
    const btnBackToElectives = document.getElementById("btn-back-to-electives");
    const btnSubmitReport = document.getElementById("btn-submit-course-report");
    const spinnerGenerateReport = document.getElementById("spinner-generate-report");

    // Populate Dynamic Labels from Saved State
    if (majorLabel && state.user.major) {
        majorLabel.textContent = state.user.major;
    }
    if (industryLabel) {
        industryLabel.textContent = state.user.targetCompanyIndustry || state.user.careerGoals || "your chosen field";
    }

    // Initialize course tracking sets
    const takenRequired = new Set(state.user.takenRequiredCourses || []);
    const takenElectives = new Set(state.user.takenElectives || []);
    const plannedCourses = new Set(state.user.plannedCourses || []);
    if (noneRequiredCheckbox) noneRequiredCheckbox.checked = Boolean(state.user.noRequiredCourses);
    if (noneElectivesCheckbox) noneElectivesCheckbox.checked = Boolean(state.user.noElectives);
    if (noPlannedCoursesCheckbox) noPlannedCoursesCheckbox.checked = Boolean(state.user.noPlannedCourses);

    const showValidationError = (id, message) => {
        const error = document.getElementById(id);
        if (error) {
            error.textContent = message;
            error.hidden = false;
        }
    };
    const clearValidationError = (id) => {
        const error = document.getElementById(id);
        if (error) error.hidden = true;
    };

    // Play Avatar 2 Intro Speech
    setTimeout(async () => {
        try {
            await QuizApp.playReportAudio(introText, null, 2);
        } catch (e) {
            console.log("Intro audio playback:", e);
        }
    }, 300);

    if (introReplayBtn) {
        introReplayBtn.addEventListener("click", () => {
            QuizApp.playReportAudio(introText, null, 2);
        });
    }

    // Helper: Screen Switcher (Ensures one screen per step)
    const showSubstep = (activeStepEl) => {
        [subRequired, subElectives, subPlanned].forEach((el) => {
            if (el) {
                el.hidden = true;
                el.style.display = "none";
            }
        });
        if (activeStepEl) {
            activeStepEl.hidden = false;
            activeStepEl.removeAttribute("hidden");
            activeStepEl.style.display = "block";
            window.scrollTo({ top: 0, behavior: "smooth" });
        }
    };

    // Fetch Course Options from Backend (/api/course-options)
    let cachedCourseOptions = null;
    const loadCourseOptions = async () => {
        if (cachedCourseOptions) return cachedCourseOptions;
        try {
            const params = new URLSearchParams({
                major: state.user.major || "Computer Science",
                targetCompanyIndustry: state.user.targetCompanyIndustry || "",
                careerGoals: state.user.careerGoals || "",
            });
            const res = await fetch(`/api/course-options?${params.toString()}`);
            if (res.ok) {
                cachedCourseOptions = await res.json();
                renderScreen1Required(cachedCourseOptions.required_courses || []);
                renderScreen2Electives(cachedCourseOptions.popular_electives || []);
                renderScreen3CatalogPills(cachedCourseOptions.all_catalog_courses || []);
                return cachedCourseOptions;
            }
        } catch (err) {
            console.warn("Failed to load course options:", err);
        } finally {
            if (requiredSpinner) requiredSpinner.style.display = "none";
            if (electivesSpinner) electivesSpinner.style.display = "none";
        }
    };

    // Render Screen 1: Required Core Checklist
    const renderScreen1Required = (courses) => {
        if (!requiredGrid) return;
        requiredGrid.innerHTML = "";

        if (!courses || courses.length === 0) {
            requiredGrid.innerHTML = `<p style="color:var(--text-muted); font-size:0.9rem;">No major core requirements found.</p>`;
            return;
        }

        courses.forEach((c) => {
            const isChecked = takenRequired.has(c.course_id);
            const card = document.createElement("div");
            card.className = `course-check-item ${isChecked ? "checked" : ""}`;
            card.innerHTML = `
                <div class="course-chk-box">${isChecked ? "✓" : ""}</div>
                <div class="course-chk-info">
                    <div class="course-chk-top">
                        <span class="course-chk-code">${QuizApp.escapeHtml(c.course_id)}</span>
                        <span class="course-chk-credits">${QuizApp.escapeHtml(c.credits)} Credits</span>
                        <span class="course-chk-level">${QuizApp.escapeHtml(c.course_level || "Core")}</span>
                    </div>
                    <div class="course-chk-title">${QuizApp.escapeHtml(c.course_title)}</div>
                    ${c.skill_tags ? `<div class="course-chk-tags">${QuizApp.escapeHtml(c.skill_tags)}</div>` : ""}
                </div>
            `;
            card.addEventListener("click", () => {
                const nowChecked = !takenRequired.has(c.course_id);
                if (nowChecked) {
                    takenRequired.add(c.course_id);
                    if (noneRequiredCheckbox) noneRequiredCheckbox.checked = false;
                    card.classList.add("checked");
                    card.querySelector(".course-chk-box").textContent = "✓";
                } else {
                    takenRequired.delete(c.course_id);
                    card.classList.remove("checked");
                    card.querySelector(".course-chk-box").textContent = "";
                }
                QuizApp.updateUserData({ takenRequiredCourses: Array.from(takenRequired), noRequiredCourses: false });
                clearValidationError("required-courses-error");
            });
            requiredGrid.appendChild(card);
        });
    };

    // Render Screen 2: Popular Electives Checklist
    const renderScreen2Electives = (electives) => {
        if (!popularGrid) return;
        popularGrid.innerHTML = "";

        if (!electives || electives.length === 0) {
            popularGrid.innerHTML = `<p style="color:var(--text-muted); font-size:0.9rem;">No elective data found.</p>`;
            return;
        }

        electives.forEach((e) => {
            const isChecked = takenElectives.has(e.course_id);
            const card = document.createElement("div");
            card.className = `course-check-item ${isChecked ? "checked" : ""}`;
            card.innerHTML = `
                <div class="course-chk-box">${isChecked ? "✓" : ""}</div>
                <div class="course-chk-info">
                    <div class="course-chk-top">
                        <span class="course-chk-code">${QuizApp.escapeHtml(e.course_id)}</span>
                        <span class="course-chk-credits">${QuizApp.escapeHtml(e.credits)} Credits</span>
                        <span class="course-chk-level" style="background:rgba(168, 85, 247, 0.2); color:#d8b4fe;">Popular Elective</span>
                    </div>
                    <div class="course-chk-title">${QuizApp.escapeHtml(e.course_title)}</div>
                    ${e.skill_tags ? `<div class="course-chk-tags">${QuizApp.escapeHtml(e.skill_tags)}</div>` : ""}
                </div>
            `;
            card.addEventListener("click", () => {
                const nowChecked = !takenElectives.has(e.course_id);
                if (nowChecked) {
                    takenElectives.add(e.course_id);
                    if (noneElectivesCheckbox) noneElectivesCheckbox.checked = false;
                    card.classList.add("checked");
                    card.querySelector(".course-chk-box").textContent = "✓";
                } else {
                    takenElectives.delete(e.course_id);
                    card.classList.remove("checked");
                    card.querySelector(".course-chk-box").textContent = "";
                }
                QuizApp.updateUserData({ takenElectives: Array.from(takenElectives), noElectives: false });
                clearValidationError("electives-error");
            });
            popularGrid.appendChild(card);
        });
    };

    // Render Screen 3: Planned Courses Catalog Pills
    const renderScreen3CatalogPills = (allCatalog) => {
        if (!catalogPills) return;
        catalogPills.innerHTML = "";

        allCatalog.forEach((c) => {
            const isSelected = plannedCourses.has(c.course_id);
            const pill = document.createElement("button");
            pill.type = "button";
            pill.className = `skill-pill ${isSelected ? "active" : ""}`;
            pill.textContent = `${c.course_id} - ${c.course_title}`;
            pill.addEventListener("click", () => {
                const nowSelected = !plannedCourses.has(c.course_id);
                if (nowSelected) {
                    plannedCourses.add(c.course_id);
                    if (noPlannedCoursesCheckbox) noPlannedCoursesCheckbox.checked = false;
                    pill.classList.add("active");
                } else {
                    plannedCourses.delete(c.course_id);
                    pill.classList.remove("active");
                }
                QuizApp.updateUserData({ plannedCourses: Array.from(plannedCourses), noPlannedCourses: false });
                clearValidationError("planned-courses-error");
            });
            catalogPills.appendChild(pill);
        });
    };

    const clearChecklist = (grid) => {
        grid?.querySelectorAll(".course-check-item").forEach((card) => {
            card.classList.remove("checked");
            const box = card.querySelector(".course-chk-box");
            if (box) box.textContent = "";
        });
    };

    noneRequiredCheckbox?.addEventListener("change", () => {
        if (noneRequiredCheckbox.checked) {
            takenRequired.clear();
            clearChecklist(requiredGrid);
        }
        QuizApp.updateUserData({ takenRequiredCourses: Array.from(takenRequired), noRequiredCourses: noneRequiredCheckbox.checked });
        clearValidationError("required-courses-error");
    });

    noneElectivesCheckbox?.addEventListener("change", () => {
        if (noneElectivesCheckbox.checked) {
            takenElectives.clear();
            clearChecklist(popularGrid);
            if (customElectivesInput) customElectivesInput.value = "";
        }
        QuizApp.updateUserData({ takenElectives: Array.from(takenElectives), customElectives: customElectivesInput?.value || "", noElectives: noneElectivesCheckbox.checked });
        clearValidationError("electives-error");
    });

    noPlannedCoursesCheckbox?.addEventListener("change", () => {
        if (noPlannedCoursesCheckbox.checked) {
            plannedCourses.clear();
            catalogPills?.querySelectorAll(".skill-pill.active").forEach((pill) => pill.classList.remove("active"));
            if (customPlannedInput) customPlannedInput.value = "";
        }
        QuizApp.updateUserData({ plannedCourses: Array.from(plannedCourses), customPlannedCourses: customPlannedInput?.value || "", noPlannedCourses: noPlannedCoursesCheckbox.checked });
        clearValidationError("planned-courses-error");
    });

    customElectivesInput?.addEventListener("input", () => {
        if (customElectivesInput.value.trim()) {
            if (noneElectivesCheckbox) noneElectivesCheckbox.checked = false;
            QuizApp.updateUserData({ customElectives: customElectivesInput.value, noElectives: false });
        }
        clearValidationError("electives-error");
    });
    customPlannedInput?.addEventListener("input", () => {
        if (customPlannedInput.value.trim()) {
            if (noPlannedCoursesCheckbox) noPlannedCoursesCheckbox.checked = false;
            QuizApp.updateUserData({ customPlannedCourses: customPlannedInput.value, noPlannedCourses: false });
        }
        clearValidationError("planned-courses-error");
    });

    // Begin Section Button (Removes intro stage & opens Screen 1)
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
                showSubstep(subRequired);
            }
            loadCourseOptions();
        });
    }

    // Screen Navigation Listeners
    if (btnToElectives) {
        btnToElectives.addEventListener("click", () => {
            if (!takenRequired.size && !noneRequiredCheckbox?.checked) {
                showValidationError("required-courses-error", "Select any completed courses or confirm that you have not taken any listed.");
                return;
            }
            QuizApp.updateUserData({ takenRequiredCourses: Array.from(takenRequired), noRequiredCourses: Boolean(noneRequiredCheckbox?.checked) });
            showSubstep(subElectives);
        });
    }

    if (btnBackToRequired) {
        btnBackToRequired.addEventListener("click", () => {
            showSubstep(subRequired);
        });
    }

    if (btnToPlanned) {
        btnToPlanned.addEventListener("click", () => {
            if (!takenElectives.size && !customElectivesInput?.value.trim() && !noneElectivesCheckbox?.checked) {
                showValidationError("electives-error", "Select any electives, enter other electives, or confirm that you have not taken any.");
                return;
            }
            if (customElectivesInput) {
                const customVal = customElectivesInput.value.trim();
                QuizApp.updateUserData({ customElectives: customVal });
                if (customVal) {
                    customVal.split(",").forEach((c) => {
                        const clean = c.trim().toUpperCase().replace(" ", "");
                        if (clean) takenElectives.add(clean);
                    });
                }
            }
            QuizApp.updateUserData({ takenElectives: Array.from(takenElectives), noElectives: Boolean(noneElectivesCheckbox?.checked) });
            showSubstep(subPlanned);
        });
    }

    if (btnBackToElectives) {
        btnBackToElectives.addEventListener("click", () => {
            showSubstep(subElectives);
        });
    }

    // Submit Question 3 -> Generate Section 2 Report
    if (btnSubmitReport) {
        btnSubmitReport.addEventListener("click", async () => {
            if (!plannedCourses.size && !customPlannedInput?.value.trim() && !noPlannedCoursesCheckbox?.checked) {
                showValidationError("planned-courses-error", "Select planned courses, enter them below, or confirm that you do not have any planned yet.");
                return;
            }
            const spinner = document.getElementById("spinner-generate-report");
            if (spinner) {
                spinner.hidden = false;
                spinner.removeAttribute("hidden");
            }
            btnSubmitReport.disabled = true;

            const customPlanned = customPlannedInput ? customPlannedInput.value.trim() : "";
            QuizApp.updateUserData({
                takenRequiredCourses: Array.from(takenRequired),
                takenElectives: Array.from(takenElectives),
                plannedCourses: Array.from(plannedCourses),
                customPlannedCourses: customPlanned,
                noPlannedCourses: Boolean(noPlannedCoursesCheckbox?.checked),
            });

            const updatedState = QuizApp.getQuizState();

            try {
                const res = await fetch("/api/generate-report", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        section_name: "course_advising",
                        user_data: updatedState.user,
                    }),
                });

                if (res.ok) {
                    const reportData = await res.json();
                    QuizApp.saveSectionData(2, reportData);

                    // Hide Question Stage & Reveal Section 2 Final Report Stage
                    if (questionsStage) {
                        questionsStage.hidden = true;
                        questionsStage.style.display = "none";
                    }
                    if (reportStage) {
                        reportStage.hidden = false;
                        reportStage.removeAttribute("hidden");
                        reportStage.style.display = "block";
                        window.scrollTo({ top: 0, behavior: "smooth" });
                    }

                    // Render 5-Card Class Analysis breakdown and Top 3 Matches at the bottom
                    renderClassAnalysis(reportData.class_analysis);
                    renderTopAlumniMatches(reportData.matches);

                    // Play Avatar 2 speech synthesis
                    if (reportData.text) {
                        QuizApp.avatarSayTextOnly(reportData.text, 2);
                    }
                    if (reportData.audio) {
                        QuizApp.playReportAudio(reportData.text, reportData.audio, 2);
                    }
                } else {
                    alert("Server returned an error while generating course analysis. Please try again.");
                }
            } catch (err) {
                console.error("Error generating Section 2 report:", err);
                alert("Unable to generate course report. Please check your connection and try again.");
            } finally {
                if (spinner) spinner.hidden = true;
                btnSubmitReport.disabled = false;
            }
        });
    }

    // Render Class Analysis Comparative Breakdown
    const renderClassAnalysis = (analysis) => {
        const container = document.getElementById("class-analysis-container");
        if (!container || !analysis) return;

        const completedReq = analysis.completed_required || [];
        const missingReq = analysis.missing_required || [];
        const completedElec = analysis.completed_electives || [];
        const recommendedElec = analysis.recommended_electives || [];
        const plannedList = analysis.planned_courses || [];

        container.innerHTML = `
            <!-- Card 1: Completed Required Core -->
            <div class="analysis-card">
                <div class="analysis-card-header">
                    <span class="analysis-card-title">✅ Completed Required Core</span>
                    <span class="analysis-count-badge badge-completed">${completedReq.length} Courses</span>
                </div>
                <p style="font-size:0.8rem; color:var(--text-secondary); margin-bottom:0.6rem;">Foundational core requirements fulfilled:</p>
                <div class="analysis-course-list">
                    ${completedReq.length > 0 ? completedReq.map((c) => `
                        <span class="analysis-course-pill pill-green" title="${QuizApp.escapeHtml(c.course_title)}">
                            <strong>${QuizApp.escapeHtml(c.course_id)}</strong> &bull; ${QuizApp.escapeHtml(c.credits)}cr
                        </span>
                    `).join("") : `<span style="color:var(--text-muted); font-size:0.8rem;">None marked yet</span>`}
                </div>
            </div>

            <!-- Card 2: Remaining Required Core -->
            <div class="analysis-card">
                <div class="analysis-card-header">
                    <span class="analysis-card-title">⚠️ Remaining Required Core</span>
                    <span class="analysis-count-badge badge-missing">${missingReq.length} Remaining</span>
                </div>
                <p style="font-size:0.8rem; color:var(--text-secondary); margin-bottom:0.6rem;">Major core courses still needed for degree:</p>
                <div class="analysis-course-list">
                    ${missingReq.length > 0 ? missingReq.slice(0, 8).map((c) => `
                        <span class="analysis-course-pill pill-amber" title="${QuizApp.escapeHtml(c.course_title)}">
                            <strong>${QuizApp.escapeHtml(c.course_id)}</strong> &bull; ${QuizApp.escapeHtml(c.credits)}cr
                        </span>
                    `).join("") : `<span style="color:var(--accent-emerald); font-size:0.8rem;">✓ All core requirements cleared!</span>`}
                </div>
            </div>

            <!-- Card 3: Completed Electives -->
            <div class="analysis-card">
                <div class="analysis-card-header">
                    <span class="analysis-card-title">🌟 Completed Electives</span>
                    <span class="analysis-count-badge badge-completed">${completedElec.length} Taken</span>
                </div>
                <p style="font-size:0.8rem; color:var(--text-secondary); margin-bottom:0.6rem;">Electives &amp; specialized coursework recorded:</p>
                <div class="analysis-course-list">
                    ${completedElec.length > 0 ? completedElec.map((c) => `
                        <span class="analysis-course-pill pill-green" title="${QuizApp.escapeHtml(c.course_title)}">
                            <strong>${QuizApp.escapeHtml(c.course_id)}</strong>
                        </span>
                    `).join("") : `<span style="color:var(--text-muted); font-size:0.8rem;">No electives taken yet</span>`}
                </div>
            </div>

            <!-- Card 4: Recommended High-Yield Electives for Career -->
            <div class="analysis-card">
                <div class="analysis-card-header">
                    <span class="analysis-card-title">🚀 Top Career Electives</span>
                    <span class="analysis-count-badge badge-recommended">Dataset Matches</span>
                </div>
                <p style="font-size:0.8rem; color:var(--text-secondary); margin-bottom:0.6rem;">High-yield electives taken by top-earning alumni in your industry:</p>
                <div class="analysis-course-list">
                    ${recommendedElec.length > 0 ? recommendedElec.map((c) => `
                        <span class="analysis-course-pill pill-purple" title="Skills: ${QuizApp.escapeHtml(c.skill_tags || '')}">
                            <strong>${QuizApp.escapeHtml(c.course_id)}</strong> (${QuizApp.escapeHtml(c.course_title)})
                        </span>
                    `).join("") : `<span style="color:var(--text-muted); font-size:0.8rem;">Standard elective tracks</span>`}
                </div>
            </div>

            <!-- Card 5: Planned Coursework Roadmap -->
            <div class="analysis-card" style="grid-column: 1 / -1;">
                <div class="analysis-card-header">
                    <span class="analysis-card-title">📅 Planned Coursework Roadmap</span>
                    <span class="analysis-count-badge badge-planned">${plannedList.length} Planned</span>
                </div>
                <p style="font-size:0.8rem; color:var(--text-secondary); margin-bottom:0.6rem;">Your upcoming target courses:</p>
                <div class="analysis-course-list">
                    ${plannedList.length > 0 ? plannedList.map((c) => `
                        <span class="analysis-course-pill pill-blue">
                            <strong>${QuizApp.escapeHtml(c.course_id)}</strong> &bull; ${QuizApp.escapeHtml(c.course_title)}
                        </span>
                    `).join("") : `<span style="color:var(--text-muted); font-size:0.8rem;">None specified</span>`}
                    ${analysis.custom_planned ? `<span class="analysis-course-pill pill-blue">Notes: ${QuizApp.escapeHtml(analysis.custom_planned)}</span>` : ""}
                </div>
            </div>
        `;
    };

    // Render Top 3 Alumni Matches at the bottom of the report
    const renderTopAlumniMatches = (matches) => {
        const grid = document.getElementById("section-2-matches-grid");
        if (!grid) return;
        grid.innerHTML = "";

        if (!matches || matches.length === 0) {
            grid.innerHTML = `<p style="color:var(--text-muted); font-size:0.9rem;">No direct alumni matches found.</p>`;
            return;
        }

        matches.forEach((m) => {
            const card = document.createElement("div");
            card.className = "alumni-card";
            const electivesList = (m.key_electives || ["CMSC 471 (AI)", "CMSC 441 (Algorithms)"])
                .map((el) => `<span class="highlight-tag" style="color:#86efac;">${QuizApp.escapeHtml(el)}</span>`)
                .join("");

            card.innerHTML = `
                <div>
                    <div class="card-top-row">
                        <span class="alum-id-badge">${QuizApp.escapeHtml(m.campus_id)}</span>
                        <span class="alum-salary-badge">${QuizApp.escapeHtml(m.first_job_annual_salary_usd || "$105,000")}</span>
                    </div>
                    <h4 class="alum-role-title">${QuizApp.escapeHtml(m.first_job_title || "Software Engineer")}</h4>
                    <p class="alum-employer">${QuizApp.escapeHtml(m.first_employer || "Tech Leader")} &bull; <span style="color:var(--avatar-green);">${QuizApp.escapeHtml(state.user.major || "Computer Science")}</span></p>
                    <p style="font-size:0.83rem; color:var(--text-secondary); margin-bottom:0.75rem;">
                        ${QuizApp.escapeHtml(m.match_reason || "Shared core sequences with high-earning career outcome.")}
                    </p>
                </div>
                <div class="alum-highlight-tags">
                    <span style="font-size:0.72rem; color:var(--text-muted); display:block; width:100%; margin-bottom:0.25rem;">Key Electives Taken:</span>
                    ${electivesList}
                </div>
            `;
            grid.appendChild(card);
        });
    };

    // Proceed to Section 3 Loading Screen
    const btnNext = document.getElementById("btn-next-to-section-3");
    if (btnNext) {
        btnNext.addEventListener("click", () => {
            QuizApp.stopAllSpeech();
            window.location.href = "/loading?next=3";
        });
    }

    QuizApp.bindVoiceReplayListeners();
});
