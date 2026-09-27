/**
 * Section 2 Controller (Course Advising & Electives)
 * Implements:
 * 1. Suppressed early recommendations (recommendations only appear in Stage C report).
 * 2. Sequential 3-Question Flow (Screen 1: Required -> Screen 2: Electives -> Screen 3: Planned).
 * 3. Section 2 Final Report with 5-Card Class Analysis breakdown and Top 3 Alumni Matches at the bottom.
 */
document.addEventListener("DOMContentLoaded", async () => {
    const state = QuizApp.getQuizState();
    const shouldClearSelectionsOnReload = QuizApp.shouldResetFormInputsOnReload();
    if (shouldClearSelectionsOnReload) {
        const clearedSection2Answers = {
            takenRequiredCourses: [],
            noRequiredCourses: false,
            interestedElectives: [],
            customInterestedElectives: "",
            noInterestedElectives: false,
            takenElectives: [],
            customElectives: "",
            noElectives: false,
            plannedCourses: [],
            customPlannedCourses: "",
            noPlannedCourses: false,
        };
        Object.assign(state.user, clearedSection2Answers);
        QuizApp.updateUserData(clearedSection2Answers);
    }

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
    const zeroCreditCourseNote = document.getElementById("zero-credit-course-note");
    const creditValue = state.user.creditsCompleted;
    const hasRecordedCredits = creditValue !== null && creditValue !== undefined && String(creditValue).trim() !== "";
    const completedCredits = hasRecordedCredits ? Number(creditValue) : NaN;
    const hasZeroCompletedCredits = hasRecordedCredits && completedCredits === 0;
    const isEarlyCreditStudent = Number.isFinite(completedCredits) && completedCredits < 30;
    const shouldSkipCompletedCourseQuestions = hasZeroCompletedCredits;

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
    const electivesQuestionHeading = document.getElementById("electives-question-heading");
    const electivesQuestionDescription = document.getElementById("electives-question-description");
    const customElectivesLabel = document.getElementById("custom-electives-label");
    const noneElectivesLabel = document.getElementById("none-electives-label");
    const btnBackToRequired = document.getElementById("btn-back-to-required");
    const btnToPlanned = document.getElementById("btn-to-planned");

    // Screen 3 Elements (Live Autocomplete Search Bar)
    const searchInput = document.getElementById("planned-course-search");
    const dropdownMenu = document.getElementById("autocomplete-dropdown");
    const chipsContainer = document.getElementById("planned-courses-chips");
    const btnBackToElectives = document.getElementById("btn-back-to-electives");
    const btnSubmitReport = document.getElementById("btn-submit-course-report");
    const spinnerGenerateReport = document.getElementById("spinner-generate-report");

    if (shouldSkipCompletedCourseQuestions) {
        if (btnBackToElectives) btnBackToElectives.hidden = true;
        if (zeroCreditCourseNote) zeroCreditCourseNote.hidden = false;
        const plannedQuestionLabel = subPlanned?.querySelector(".step-badge.active-pill");
        if (plannedQuestionLabel) plannedQuestionLabel.textContent = "Question 1 of 1";
    }

    // Populate Dynamic Labels from Saved State
    if (majorLabel && state.user.major) {
        majorLabel.textContent = state.user.major;
    }
    if (industryLabel) {
        industryLabel.textContent = state.user.targetCompanyIndustry || state.user.careerGoals || "your chosen field";
    }

    // Initialize course tracking sets
    const takenRequired = new Set(shouldClearSelectionsOnReload ? [] : (state.user.takenRequiredCourses || []));
    const electiveResponseMode = isEarlyCreditStudent ? "interest" : "completed";
    const selectedElectives = new Set(shouldClearSelectionsOnReload ? [] : (isEarlyCreditStudent ? (state.user.interestedElectives || []) : (state.user.takenElectives || [])));
    const plannedCourses = new Set(shouldClearSelectionsOnReload ? [] : (state.user.plannedCourses || []));
    if (noneRequiredCheckbox) noneRequiredCheckbox.checked = !shouldClearSelectionsOnReload && Boolean(state.user.noRequiredCourses);
    if (noneElectivesCheckbox) noneElectivesCheckbox.checked = !shouldClearSelectionsOnReload && Boolean(isEarlyCreditStudent ? state.user.noInterestedElectives : state.user.noElectives);
    if (customElectivesInput) customElectivesInput.value = shouldClearSelectionsOnReload ? "" : (isEarlyCreditStudent ? (state.user.customInterestedElectives || "") : (state.user.customElectives || ""));
    if (shouldClearSelectionsOnReload && searchInput) searchInput.value = "";
    if (shouldClearSelectionsOnReload && dropdownMenu) dropdownMenu.hidden = true;

    const saveElectiveAnswer = () => {
        const customValue = customElectivesInput?.value || "";
        const noSelection = Boolean(noneElectivesCheckbox?.checked);
        if (isEarlyCreditStudent) {
            QuizApp.updateUserData({
                interestedElectives: Array.from(selectedElectives),
                customInterestedElectives: customValue,
                noInterestedElectives: noSelection,
                takenElectives: [],
                customElectives: "",
                noElectives: false,
            });
        } else {
            QuizApp.updateUserData({
                takenElectives: Array.from(selectedElectives),
                customElectives: customValue,
                noElectives: noSelection,
            });
        }
    };

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

    // Start Avatar 2's intro speech as soon as the page is initialized.
    void (async () => {
        try {
            await QuizApp.playAvatarDialogue(introText, 2);
        } catch (e) {
            console.log("Intro audio playback:", e);
        }
    })();

    if (introReplayBtn) {
        introReplayBtn.addEventListener("click", () => {
            QuizApp.playAvatarDialogue(introText, 2);
        });
    }

    // Begin Section Button (Removes intro stage & opens Screen 1 in split layout)
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
                if (shouldSkipCompletedCourseQuestions) {
                    takenRequired.clear();
                    selectedElectives.clear();
                    if (noneRequiredCheckbox) noneRequiredCheckbox.checked = true;
                    if (noneElectivesCheckbox) noneElectivesCheckbox.checked = true;
                    if (customElectivesInput) customElectivesInput.value = "";
                    QuizApp.updateUserData({
                        takenRequiredCourses: [],
                        noRequiredCourses: true,
                        interestedElectives: [],
                        customInterestedElectives: "",
                        noInterestedElectives: false,
                        takenElectives: [],
                        customElectives: "",
                        noElectives: false,
                    });
                    showSubstep(subElectives);
                    QuizApp.playAvatarDialogue("Since you are just starting out with no completed credits, tell me which electives you are interested in taking. I will use them to recommend a pathway, not count them as completed.", 2);
                } else {
                    showSubstep(subRequired);
                    QuizApp.playAvatarDialogue("Let's review the required core courses for your major. Check off any that you have completed.", 2);
                }
            }
            loadCourseOptions();
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
                minor: state.user.minor || "",
                majorTrack: state.user.majorTrack || "",
                creditsCompleted: state.user.creditsCompleted || "15",
                classYear: state.user.classYear || "",
                targetCompanyIndustry: state.user.targetCompanyIndustry || "",
                careerGoals: state.user.careerGoals || "",
            });
            const res = await fetch(`/api/course-options?${params.toString()}`);
            if (res.ok) {
                cachedCourseOptions = await res.json();
                renderScreen1Required(cachedCourseOptions.required_courses || []);
                renderScreen2Electives(cachedCourseOptions.popular_electives || []);

                // Dynamic Text Phrasing for Electives based on Credits
                if (electivesQuestionHeading) {
                    const phrasing = cachedCourseOptions.dynamic_phrasing || (isEarlyCreditStudent ? "Are you interested in taking any of these electives?" : "Which of these electives have you taken?");
                    electivesQuestionHeading.innerHTML = `${phrasing} <span class="required-indicator">Required response</span>`;
                }
                if (electiveResponseMode === "interest") {
                    if (electivesQuestionDescription) electivesQuestionDescription.innerHTML = `Choose electives that sound interesting from courses popular with alumni in <strong id="student-industry-label" style="color:var(--accent-emerald);">${QuizApp.escapeHtml(state.user.targetCompanyIndustry || state.user.careerGoals || "your target field")}</strong>. These will guide your recommended pathway and will not be recorded as completed.`;
                    if (customElectivesLabel) customElectivesLabel.textContent = "Other Electives or Topics You Are Interested In (Comma-separated, Optional)";
                    if (noneElectivesLabel) noneElectivesLabel.textContent = " I am not interested in any of these or other electives right now.";
                    if (customElectivesInput) customElectivesInput.placeholder = "e.g. CMSC 491 (Deep Learning), MATH 221";
                }

                renderPlannedChips();
                return cachedCourseOptions;
            }
        } catch (err) {
            console.warn("Failed to load course options:", err);
        } finally {
            if (requiredSpinner) requiredSpinner.style.display = "none";
            if (electivesSpinner) electivesSpinner.style.display = "none";
        }
    };

    // Render Screen 1: Required Core Checklist (Tiered & Major-Specific)
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
            const isChecked = selectedElectives.has(e.course_id);
            const card = document.createElement("div");
            card.className = `course-check-item ${isChecked ? "checked" : ""}`;
            card.innerHTML = `
                <div class="course-chk-box">${isChecked ? "✓" : ""}</div>
                <div class="course-chk-info">
                    <div class="course-chk-top">
                        <span class="course-chk-code">${QuizApp.escapeHtml(e.course_id)}</span>
                        <span class="course-chk-credits">${QuizApp.escapeHtml(e.credits)} Credits</span>
                        <span class="course-chk-level" style="background:rgba(112, 75, 137, 0.12); color:#59366F;">Popular Elective</span>
                    </div>
                    <div class="course-chk-title">${QuizApp.escapeHtml(e.course_title)}</div>
                    ${e.skill_tags ? `<div class="course-chk-tags">${QuizApp.escapeHtml(e.skill_tags)}</div>` : ""}
                </div>
            `;
            card.addEventListener("click", () => {
                const nowChecked = !selectedElectives.has(e.course_id);
                if (nowChecked) {
                    selectedElectives.add(e.course_id);
                    if (noneElectivesCheckbox) noneElectivesCheckbox.checked = false;
                    card.classList.add("checked");
                    card.querySelector(".course-chk-box").textContent = "✓";
                } else {
                    selectedElectives.delete(e.course_id);
                    card.classList.remove("checked");
                    card.querySelector(".course-chk-box").textContent = "";
                }
                saveElectiveAnswer();
                clearValidationError("electives-error");
            });
            popularGrid.appendChild(card);
        });
    };

    // =========================================================================
    // SCREEN 3: LIVE AUTOCOMPLETE SEARCH BAR & CHIPS BEHAVIOR
    // =========================================================================
    const renderPlannedChips = () => {
        if (!chipsContainer) return;
        chipsContainer.innerHTML = "";
        if (plannedCourses.size === 0) {
            chipsContainer.innerHTML = '<span style="color:var(--text-muted); font-size:0.85rem;">No courses planned yet. Search and select classes from the dropdown.</span>';
            return;
        }

        plannedCourses.forEach((cId) => {
            const chip = document.createElement("span");
            chip.className = "planned-course-chip";
            chip.innerHTML = `
                <span>${QuizApp.escapeHtml(cId)}</span>
                <button type="button" class="chip-remove-btn" title="Remove ${QuizApp.escapeHtml(cId)}">&times;</button>
            `;
            chip.querySelector(".chip-remove-btn").addEventListener("click", () => {
                plannedCourses.delete(cId);
                renderPlannedChips();
                QuizApp.updateUserData({ plannedCourses: Array.from(plannedCourses) });
            });
            chipsContainer.appendChild(chip);
        });
    };

    const renderAutocompleteDropdown = (results) => {
        if (!dropdownMenu) return;
        dropdownMenu.innerHTML = "";

        if (!results || results.length === 0) {
            dropdownMenu.innerHTML = `<div class="autocomplete-empty">No matching courses found in catalog.</div>`;
            dropdownMenu.hidden = false;
            return;
        }

        results.forEach((item) => {
            const isAlreadyAdded = plannedCourses.has(item.course_id);
            const el = document.createElement("div");
            el.className = `autocomplete-item ${isAlreadyAdded ? "highlighted" : ""}`;
            el.innerHTML = `
                <div class="autocomplete-item-top">
                    <span class="autocomplete-item-code">${QuizApp.escapeHtml(item.course_id)}</span>
                    <span class="autocomplete-item-credits">${item.credits} Credits &bull; ${QuizApp.escapeHtml(item.course_level || "Upper")}</span>
                </div>
                <div class="autocomplete-item-title">${QuizApp.escapeHtml(item.course_title)}</div>
                ${item.skill_tags ? `<div style="font-size:0.75rem; color:var(--text-muted); margin-top:0.2rem;">${QuizApp.escapeHtml(item.skill_tags)}</div>` : ""}
            `;
            el.addEventListener("click", () => {
                plannedCourses.add(item.course_id);
                renderPlannedChips();
                QuizApp.updateUserData({ plannedCourses: Array.from(plannedCourses) });
                clearValidationError("planned-courses-error");
                if (searchInput) searchInput.value = "";
                dropdownMenu.hidden = true;
            });
            dropdownMenu.appendChild(el);
        });
        dropdownMenu.hidden = false;
    };

    let autocompleteTimer = null;
    if (searchInput) {
        searchInput.addEventListener("input", (e) => {
            clearTimeout(autocompleteTimer);
            const query = e.target.value.trim();
            if (!query) {
                if (dropdownMenu) dropdownMenu.hidden = true;
                return;
            }
            autocompleteTimer = setTimeout(async () => {
                try {
                    const res = await fetch(`/api/search-classes?q=${encodeURIComponent(query)}`);
                    if (res.ok) {
                        const data = await res.json();
                        renderAutocompleteDropdown(data.results || []);
                    }
                } catch (err) {
                    console.warn("Autocomplete fetch error:", err);
                }
            }, 180);
        });

        searchInput.addEventListener("focus", () => {
            if (searchInput.value.trim().length > 0 && dropdownMenu && dropdownMenu.children.length > 0) {
                dropdownMenu.hidden = false;
            }
        });
    }

    document.addEventListener("click", (e) => {
        if (dropdownMenu && !dropdownMenu.contains(e.target) && e.target !== searchInput) {
            dropdownMenu.hidden = true;
        }
    });

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
            selectedElectives.clear();
            clearChecklist(popularGrid);
            if (customElectivesInput) customElectivesInput.value = "";
        }
        saveElectiveAnswer();
        clearValidationError("electives-error");
    });

    customElectivesInput?.addEventListener("input", () => {
        if (customElectivesInput.value.trim()) {
            if (noneElectivesCheckbox) noneElectivesCheckbox.checked = false;
            saveElectiveAnswer();
        }
        clearValidationError("electives-error");
    });

    // Screen Navigation Listeners
    if (btnToElectives) {
        btnToElectives.addEventListener("click", () => {
            if (!takenRequired.size && !noneRequiredCheckbox?.checked) {
                showValidationError("required-courses-error", "Select any completed courses or confirm that you have not taken any listed.");
                return;
            }
            QuizApp.updateUserData({ takenRequiredCourses: Array.from(takenRequired), noRequiredCourses: Boolean(noneRequiredCheckbox?.checked) });
            showSubstep(subElectives);
            const electivePrompt = isEarlyCreditStudent
                ? (completedCredits === 0
                    ? "Since you are just getting started, which of these electives are you interested in taking? I will use your choices to build a recommended pathway, not mark them as completed."
                    : `With ${completedCredits} completed credits, which of these electives are you interested in taking next? I will use your choices to build a recommended pathway, not mark them as completed.`)
                : "Great, now let's look at the electives you have completed.";
            QuizApp.playAvatarDialogue(electivePrompt, 2);
        });
    }

    if (btnBackToRequired) {
        btnBackToRequired.addEventListener("click", () => {
            showSubstep(subRequired);
            QuizApp.playAvatarDialogue("Review or update your required core coursework.", 2);
        });
    }

    if (btnToPlanned) {
        btnToPlanned.addEventListener("click", () => {
            if (!selectedElectives.size && !customElectivesInput?.value.trim() && !noneElectivesCheckbox?.checked) {
                showValidationError("electives-error", isEarlyCreditStudent ? "Select electives that interest you, enter other interests, or confirm that none interest you right now." : "Select any electives, enter other electives, or confirm that you have not taken any.");
                return;
            }
            if (customElectivesInput) {
                const customVal = customElectivesInput.value.trim();
                if (customVal && !isEarlyCreditStudent) {
                    customVal.split(",").forEach((c) => {
                        const clean = c.trim().toUpperCase().replace(" ", "");
                        if (clean) selectedElectives.add(clean);
                    });
                }
            }
            saveElectiveAnswer();
            showSubstep(subPlanned);
            QuizApp.playAvatarDialogue(isEarlyCreditStudent ? "Excellent. I will use those interests to shape your recommended pathway. Now select courses you are considering for your upcoming schedule." : "Excellent. Now search and select upcoming courses from the catalog to build your planned schedule.", 2);
        });
    }

    if (btnBackToElectives) {
        btnBackToElectives.addEventListener("click", () => {
            showSubstep(subElectives);
            QuizApp.playAvatarDialogue("Review or update your elective selections.", 2);
        });
    }

    // Submit Question 3 -> Generate Section 2 Report
    if (btnSubmitReport) {
        btnSubmitReport.addEventListener("click", async () => {
            const spinner = document.getElementById("spinner-generate-report");
            if (spinner) {
                spinner.hidden = false;
                spinner.removeAttribute("hidden");
            }
            btnSubmitReport.disabled = true;

            QuizApp.updateUserData({
                takenRequiredCourses: Array.from(takenRequired),
                takenElectives: isEarlyCreditStudent ? [] : Array.from(selectedElectives),
                interestedElectives: isEarlyCreditStudent ? Array.from(selectedElectives) : [],
                customInterestedElectives: isEarlyCreditStudent ? (customElectivesInput?.value.trim() || "") : "",
                plannedCourses: Array.from(plannedCourses),
                noPlannedCourses: plannedCourses.size === 0,
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

                    // Hide Question Stage & Reveal Section 2 Final Report Stage (Split Grid Layout)
                    if (questionsStage) {
                        questionsStage.hidden = true;
                        questionsStage.style.display = "none";
                    }
                    if (reportStage) {
                        reportStage.hidden = false;
                        reportStage.removeAttribute("hidden");
                        reportStage.style.display = "grid";
                        document.querySelector(".page-wrapper")?.classList.add("section1-immersive");
                        window.scrollTo({ top: 0, behavior: "smooth" });
                    }

                    // Render 5-Card Class Analysis breakdown (Monochromatic Green) and Top 3 Matches at the bottom
                    renderClassAnalysis(reportData.class_analysis);
                    renderTopAlumniMatches(reportData.matches);

                    // Play Avatar 2 speech synthesis
                    if (reportData.text) {
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

    // Render Class Analysis Comparative Breakdown (Strictly Monochromatic Emerald Green Theme)
    const renderClassAnalysis = (analysis) => {
        const container = document.getElementById("class-analysis-container");
        if (!container || !analysis) return;

        const completedReq = analysis.completed_required || [];
        const missingReq = analysis.missing_required || [];
        const completedElec = analysis.completed_electives || [];
        const interestedElec = analysis.interested_electives || [];
        const isInterestReport = analysis.elective_response_mode === "interest";
        const displayedElectives = isInterestReport ? interestedElec : completedElec;
        const recommendedElec = analysis.recommended_electives || [];
        const plannedList = analysis.planned_courses || [];

        container.innerHTML = `
            <!-- Card 1: Completed Required Core -->
            <div class="analysis-card" style="border-left: 4px solid var(--accent-emerald);">
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
            <div class="analysis-card" style="border-left: 4px solid var(--accent-emerald);">
                <div class="analysis-card-header">
                    <span class="analysis-card-title">${QuizApp.escapeHtml(analysis.missing_required_title || "⚠️ Remaining Required Core")}</span>
                    <span class="analysis-count-badge badge-completed">${missingReq.length} Remaining</span>
                </div>
                <p style="font-size:0.8rem; color:var(--text-secondary); margin-bottom:0.6rem;">
                    ${QuizApp.escapeHtml(analysis.missing_required_subtitle || "Major core courses still needed for degree:")}
                </p>
                <div class="analysis-course-list">
                    ${missingReq.length > 0 ? missingReq.slice(0, 8).map((c) => `
                        <span class="analysis-course-pill pill-green" title="${QuizApp.escapeHtml(c.course_title)}">
                            <strong>${QuizApp.escapeHtml(c.course_id)}</strong> &bull; ${QuizApp.escapeHtml(c.credits)}cr
                        </span>
                    `).join("") : `<span style="color:var(--accent-emerald); font-size:0.8rem;">✓ All core requirements cleared!</span>`}
                </div>
                ${analysis.missing_required_note ? `<p style="font-size:0.75rem; color:var(--accent-emerald); margin-top:0.4rem; font-style:italic;">${QuizApp.escapeHtml(analysis.missing_required_note)}</p>` : ""}
            </div>

            <!-- Card 3: Elective history or freshman interests -->
            <div class="analysis-card" style="border-left: 4px solid var(--accent-emerald);">
                <div class="analysis-card-header">
                    <span class="analysis-card-title">${isInterestReport ? "💡 Electives You're Interested In" : "🌟 Completed Electives"}</span>
                    <span class="analysis-count-badge badge-completed">${displayedElectives.length} ${isInterestReport ? "Interests" : "Taken"}</span>
                </div>
                <p style="font-size:0.8rem; color:var(--text-secondary); margin-bottom:0.6rem;">${isInterestReport ? "These are interests that shape your pathway; they are not counted as completed coursework." : "Electives &amp; specialized coursework recorded:"}</p>
                <div class="analysis-course-list">
                    ${displayedElectives.length > 0 ? displayedElectives.map((c) => `
                        <span class="analysis-course-pill pill-green" title="${QuizApp.escapeHtml(c.course_title)}">
                            <strong>${QuizApp.escapeHtml(c.course_id)}</strong>
                        </span>
                    `).join("") : `<span style="color:var(--text-muted); font-size:0.8rem;">${isInterestReport ? "No elective interests selected yet" : "No electives taken yet"}</span>`}
                </div>
            </div>

            <!-- Card 4: Recommended High-Yield Electives for Career -->
            <div class="analysis-card" style="border-left: 4px solid var(--accent-emerald);">
                <div class="analysis-card-header">
                    <span class="analysis-card-title">${isInterestReport ? "🧭 Recommended Elective Pathway" : "🚀 Top Career Electives"}</span>
                    <span class="analysis-count-badge badge-completed">${isInterestReport ? "Next Steps" : "Dataset Matches"}</span>
                </div>
                <p style="font-size:0.8rem; color:var(--text-secondary); margin-bottom:0.6rem;">${isInterestReport ? "Your interests are prioritized first, alongside courses aligned with your goals." : "High-yield electives taken by alumni in your industry:"}</p>
                <div class="analysis-course-list">
                    ${recommendedElec.length > 0 ? recommendedElec.map((c) => `
                        <span class="analysis-course-pill pill-green" title="Skills: ${QuizApp.escapeHtml(c.skill_tags || '')}">
                            <strong>${QuizApp.escapeHtml(c.course_id)}</strong> (${QuizApp.escapeHtml(c.course_title)})
                        </span>
                    `).join("") : `<span style="color:var(--text-muted); font-size:0.8rem;">Standard elective tracks</span>`}
                </div>
            </div>

            <!-- Card 5: Planned Coursework Roadmap -->
            <div class="analysis-card" style="grid-column: 1 / -1; border-left: 4px solid var(--accent-emerald);">
                <div class="analysis-card-header">
                    <span class="analysis-card-title">📅 Planned Coursework Roadmap</span>
                    <span class="analysis-count-badge badge-completed">${plannedList.length} Planned</span>
                </div>
                <p style="font-size:0.8rem; color:var(--text-secondary); margin-bottom:0.6rem;">Your upcoming target courses:</p>
                <div class="analysis-course-list">
                    ${plannedList.length > 0 ? plannedList.map((c) => `
                        <span class="analysis-course-pill pill-green">
                            <strong>${QuizApp.escapeHtml(c.course_id)}</strong> &bull; ${QuizApp.escapeHtml(c.course_title)}
                        </span>
                    `).join("") : `<span style="color:var(--text-muted); font-size:0.8rem;">None specified</span>`}
                    ${analysis.custom_planned ? `<span class="analysis-course-pill pill-green">Notes: ${QuizApp.escapeHtml(analysis.custom_planned)}</span>` : ""}
                </div>
            </div>
        `;
    };

    // Render Top 3 Alumni Matches at the bottom of the report (Monochromatic Green)
    const renderTopAlumniMatches = (matches) => {
        const grid = document.getElementById("section-2-matches-grid");
        if (!grid) return;
        grid.innerHTML = "";

        if (!matches || matches.length === 0) {
            grid.innerHTML = `<p style="color:var(--text-muted); font-size:0.9rem;">No direct alumni matches found.</p>`;
            return;
        }

        matches.forEach((m, idx) => {
            const card = document.createElement("div");
            card.className = "alumni-card";
            const electivesList = (m.key_electives || ["CMSC 471 (AI)", "CMSC 441 (Algorithms)"])
                .map((el) => `<span class="highlight-tag" style="background:rgba(32, 88, 62, 0.1); color:#20583E; border:1px solid rgba(32, 88, 62, 0.3);">${QuizApp.escapeHtml(el)}</span>`)
                .join("");

            card.innerHTML = `
                <div>
                    <div class="card-top-row">
                        <span class="alum-id-badge" style="background:rgba(32, 88, 62, 0.12); color:#20583E;">Alumni Match #${idx + 1}</span>
                        <span class="alum-salary-badge">${QuizApp.escapeHtml(m.first_job_annual_salary_usd || "$105,000")}</span>
                    </div>
                    <h4 class="alum-role-title">${QuizApp.escapeHtml(m.first_job_title || "Software Engineer")}</h4>
                    <p class="alum-employer">${QuizApp.escapeHtml(m.first_employer || "Tech Leader")} &bull; <span style="color:var(--accent-emerald); font-weight:600;">${QuizApp.escapeHtml(state.user.major || "Computer Science")}</span></p>
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
            QuizApp.navigateWithTransition("/loading?next=3");
        });
    }

    QuizApp.bindVoiceReplayListeners(2);
});
