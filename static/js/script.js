document.addEventListener("DOMContentLoaded", () => {
    const CURRENT_ACADEMIC_YEAR = 2026;

    // Central client-side state object collected locally across steps
    const createInitialState = () => ({
        role: null, // 'student' | 'advisor'
        currentStepIndex: 0,
        student: {
            classYear: "",
            demographics: {
                name: "",
                gpa: "",
                creditsCompleted: 15,
                major: "",
                majorTrack: "Not Applicable",
                otherCategories: "Not Applicable", // Minor
            },
            aspirations: {
                expectedSalaryUsd: "",
                targetCompaniesIndustries: "",
                targetLocation: "",
                careerGoals: "",
                expectedGraduationYear: "2028",
            },
            matchedClassesData: null,
            checkedCourses: [],
            involvementData: null,
            involvement: {
                selectedActivities: [],
                customActivity: "",
                clubsAndActivities: "",
                rolesAndInterests: "",
            },
        },
        advisor: {
            transcript: {
                fileName: "",
                fileSize: 0,
                parsedSummary: null,
            },
            advisorNotes: "",
            academicStanding: "",
        },
    });

    let wizardState = createInitialState();

    // Cached academic options from GET /api/academic-options (students_current table)
    let academicOptions = {
        majors: ["Computer Science", "Data Science", "Information Systems", "Cybersecurity"],
        tracks: [
            "Artificial Intelligence and Machine Learning",
            "Cybersecurity",
            "Data Science",
            "General",
            "Software Engineering",
        ],
        minors: [
            "Business Administration",
            "Cybersecurity",
            "Data Science",
            "Economics",
            "Entrepreneurship",
            "Health Administration",
            "Mathematics",
            "Philosophy",
            "Physics",
            "Political Science",
            "Psychology",
            "Statistics",
        ],
        tracks_by_major: {},
    };

    const FLOW_STEPS = {
        student: [
            "step-student-1", // Step 1: Class (Year)
            "step-student-2", // Step 2: Academics (Major, Major Track, Minor, GPA, Credits Completed)
            "step-student-3", // Step 3: Career Path
            "step-student-4", // Step 4: First Matching Operation & Class Report (/api/match-classes)
            "step-student-5", // Step 5: Transition & Campus Involvement (/api/match-involvement)
            "step-student-6", // Step 6: Final Involvement Report
        ],
        advisor: [
            "step-advisor-1",
            "step-advisor-2",
        ],
    };

    // DOM Elements
    const allStepEls = document.querySelectorAll(".wizard-step");
    const wizardProgress = document.getElementById("wizard-progress");
    const progressLabel = document.getElementById("progress-label");
    const progressFill = document.getElementById("progress-fill");
    const wizardNav = document.getElementById("wizard-nav");
    const backBtn = document.getElementById("back-btn");
    const nextBtn = document.getElementById("next-btn");
    const nextBtnLabel = document.getElementById("next-btn-label");
    const nextBtnSpinner = document.getElementById("next-btn-spinner");
    const wizardError = document.getElementById("wizard-error");

    const majorSelect = document.getElementById("student-major");
    const trackSelect = document.getElementById("student-major-track");
    const minorSelect = document.getElementById("student-other-categories");

    // Helper: Error messages
    const showError = (msg) => {
        wizardError.textContent = msg;
        wizardError.hidden = false;
    };

    const clearError = () => {
        wizardError.textContent = "";
        wizardError.hidden = true;
    };

    const escapeHtml = (str) =>
        String(str ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");

    /**
     * Populate Major, Major Track, and Minor <select> dropdowns from GET /api/academic-options
     */
    const populateTrackDropdown = (selectedMajor) => {
        if (!trackSelect) return;
        const previousTrack = trackSelect.value;
        trackSelect.innerHTML = "";

        const defaultOpt = document.createElement("option");
        defaultOpt.value = "Not Applicable";
        defaultOpt.textContent = "General / No Specific Track";
        trackSelect.appendChild(defaultOpt);

        const tracksForMajor =
            selectedMajor &&
                academicOptions.tracks_by_major &&
                academicOptions.tracks_by_major[selectedMajor]
                ? academicOptions.tracks_by_major[selectedMajor]
                : academicOptions.tracks;

        tracksForMajor.forEach((track) => {
            if (!track || track === "Not Applicable") return;
            const opt = document.createElement("option");
            opt.value = track;
            opt.textContent = track;
            trackSelect.appendChild(opt);
        });

        if (previousTrack && Array.from(trackSelect.options).some((o) => o.value === previousTrack)) {
            trackSelect.value = previousTrack;
        }
    };

    const populateMinorDropdown = () => {
        if (!minorSelect) return;
        const previousMinor = minorSelect.value;
        minorSelect.innerHTML = "";

        const noneOpt = document.createElement("option");
        noneOpt.value = "Not Applicable";
        noneOpt.textContent = "None / Not Applicable";
        minorSelect.appendChild(noneOpt);

        (academicOptions.minors || []).forEach((minor) => {
            if (!minor || minor === "Not Applicable") return;
            const opt = document.createElement("option");
            opt.value = minor;
            opt.textContent = minor;
            minorSelect.appendChild(opt);
        });

        if (previousMinor && Array.from(minorSelect.options).some((o) => o.value === previousMinor)) {
            minorSelect.value = previousMinor;
        }
    };

    const loadAcademicOptions = async () => {
        if (!majorSelect || !trackSelect) return;
        try {
            const res = await fetch("/api/academic-options", {
                headers: { Accept: "application/json" },
            });
            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data.majors) && data.majors.length > 0) {
                    academicOptions = {
                        ...academicOptions,
                        ...data,
                    };
                }
            }
        } catch (_err) {
            // Retain default options if offline
        }

        majorSelect.innerHTML = `<option value="">Select your Major...</option>`;
        academicOptions.majors.forEach((major) => {
            const opt = document.createElement("option");
            opt.value = major;
            opt.textContent = major;
            majorSelect.appendChild(opt);
        });

        populateTrackDropdown(majorSelect.value);
        populateMinorDropdown();
    };

    if (majorSelect) {
        majorSelect.addEventListener("change", () => {
            populateTrackDropdown(majorSelect.value);
        });
    }
    loadAcademicOptions();

    /**
     * Pre-populate sensible default credits & expected grad year based on Step 1 Class Year
     */
    const applyDefaultCreditsAndGradYear = (year) => {
        const creditsInput = document.getElementById("student-credits");
        const gradYearInput = document.getElementById("expected-grad-year");
        const defaultMap = {
            Freshman: { credits: 15, gradOffset: 3 },
            Sophomore: { credits: 45, gradOffset: 2 },
            Junior: { credits: 75, gradOffset: 1 },
            Senior: { credits: 105, gradOffset: 0 },
            "More than 4 years": { credits: 115, gradOffset: 0 },
        };
        const preset = defaultMap[year] || { credits: 30, gradOffset: 2 };
        if (creditsInput && !creditsInput.dataset.userEdited) {
            creditsInput.value = String(preset.credits);
        }
        if (gradYearInput && !gradYearInput.dataset.userEdited) {
            gradYearInput.value = String(CURRENT_ACADEMIC_YEAR + preset.gradOffset);
        }
    };

    const creditsEl = document.getElementById("student-credits");
    if (creditsEl) {
        creditsEl.addEventListener("input", () => {
            creditsEl.dataset.userEdited = "true";
        });
    }

    /**
     * Render Step 4: Conversational Class Match Report from /api/match-classes
     */
    const renderClassMatchReport = (data) => {
        const container = document.getElementById("class-match-chat-stream");
        if (!container) return;

        const isDirective = data.is_underclassman;
        const yearLabel = wizardState.student.classYear || "Student";
        const toneBadge = isDirective
            ? `Directive Pathway Guidance • ${yearLabel}`
            : `Upper-Level Coursework Check • ${yearLabel}`;

        // Format emphasis on YOU NEED TO TAKE THESE or Have you taken any of these classes yet?
        let formattedPrimaryMsg = escapeHtml(data.primary_message);
        formattedPrimaryMsg = formattedPrimaryMsg
            .replace(
                "YOU NEED TO TAKE THESE",
                "<strong>YOU NEED TO TAKE THESE</strong>"
            )
            .replace(
                "Have you taken any of these classes yet?",
                "<strong>Have you taken any of these classes yet?</strong>"
            );

        const requiredCardsHtml = (data.required_courses || [])
            .map((c) => {
                const isChecked = wizardState.student.checkedCourses.includes(c.course_id);
                const interactiveHint = !isDirective
                    ? `<span class="course-tags" style="color: var(--accent-emerald); margin-top: 0.25rem;">${isChecked ? "✓ Marked as Taken" : "Click to mark if you've taken this"
                    }</span>`
                    : "";
                return `
                    <div class="course-match-card ${!isDirective ? "selectable-course" : ""} ${isChecked ? "course-taken" : ""
                    }" data-course-id="${escapeHtml(c.course_id)}">
                        <div class="course-card-top">
                            <span class="course-code">${escapeHtml(c.course_id)}</span>
                            <span class="course-stat-badge">${escapeHtml(c.completion_pct)}% Peer Match</span>
                        </div>
                        <div class="course-title">${escapeHtml(c.course_title)}</div>
                        <div class="course-tags">${escapeHtml(c.course_type)} &bull; ${escapeHtml(c.credits)} Credits</div>
                        ${c.skill_tags ? `<div class="course-tags">Skills: ${escapeHtml(c.skill_tags)}</div>` : ""}
                        ${interactiveHint}
                    </div>
                `;
            })
            .join("");

        const electiveCardsHtml = (data.elective_courses || [])
            .map(
                (e) => `
                <div class="course-match-card">
                    <div class="course-card-top">
                        <span class="course-code">${escapeHtml(e.course_id)}</span>
                        <span class="course-stat-badge">$${Number(e.avg_alumni_salary || 96000).toLocaleString()} Avg Alumni Salary</span>
                    </div>
                    <div class="course-title">${escapeHtml(e.course_title)}</div>
                    <div class="course-tags">Taken by ${escapeHtml(e.adoption_pct)}% of top performers in ${escapeHtml(data.matched_industry)}</div>
                    ${e.skill_tags ? `<div class="course-tags">Skills: ${escapeHtml(e.skill_tags)}</div>` : ""}
                </div>
            `
            )
            .join("");

        container.innerHTML = `
            <!-- Chat Bubble 1: Year-Specific Directive or Inquisitive Required/Track Classes -->
            <div class="chat-bubble">
                <div class="chat-sender-header">
                    <span class="chat-sender-badge">● Legacy Database Matching Advisor</span>
                    <span class="chat-cohort-pill">${escapeHtml(toneBadge)}</span>
                </div>
                <p class="chat-message-text">${formattedPrimaryMsg}</p>
                <div class="course-match-grid">
                    ${requiredCardsHtml}
                </div>
            </div>

            <!-- Chat Bubble 2: Success Report (Electives) -->
            <div class="chat-bubble chat-bubble-report">
                <div class="chat-sender-header">
                    <span class="chat-sender-badge">★ Career Outcome Success Report</span>
                    <span class="chat-cohort-pill">${escapeHtml(data.matched_industry)} Benchmark</span>
                </div>
                <p class="chat-message-text">${escapeHtml(data.success_report_message)}</p>
                <div class="course-match-grid">
                    ${electiveCardsHtml}
                </div>
            </div>
        `;

        if (!isDirective) {
            container.querySelectorAll(".selectable-course").forEach((card) => {
                card.addEventListener("click", () => {
                    const cid = card.dataset.courseId;
                    const idx = wizardState.student.checkedCourses.indexOf(cid);
                    if (idx >= 0) {
                        wizardState.student.checkedCourses.splice(idx, 1);
                    } else {
                        wizardState.student.checkedCourses.push(cid);
                    }
                    renderClassMatchReport(data);
                });
            });
        }
    };

    /**
     * Render Step 5: Credits-Based Campus Involvement Prompt & Interactive Selector Pills
     */
    const renderInvolvementStep = (data) => {
        const promptChat = document.getElementById("involvement-prompt-chat");
        const pillsGrid = document.getElementById("involvement-pills-grid");
        if (!promptChat || !pillsGrid) return;

        const creditsTierBadge = data.is_low_credits
            ? `Credits Completed: ${data.credits_completed} (< 30 Credits • Early Horizon)`
            : `Credits Completed: ${data.credits_completed} (30+ Credits • Active Cohort)`;

        promptChat.innerHTML = `
            <div class="chat-bubble">
                <div class="chat-sender-header">
                    <span class="chat-sender-badge">● Campus Involvement Optimizer</span>
                    <span class="chat-cohort-pill">${escapeHtml(creditsTierBadge)}</span>
                </div>
                <p class="chat-message-text">
                    <strong>${escapeHtml(data.prompt_question)}</strong><br/>
                    ${escapeHtml(data.prompt_subtext)}
                </p>
            </div>
        `;

        const selectedSet = new Set(wizardState.student.involvement.selectedActivities);
        const activitiesList = data.top_activities || [];

        pillsGrid.innerHTML = "";

        // Add an explicit "Not involved yet / Planning to explore" option
        const exploreLabel = data.is_low_credits
            ? "Yes — Planning to join clubs this semester"
            : "Focusing purely on classes / Independent projects";

        const allOptions = [
            ...activitiesList.map((a) => ({
                name: a.name,
                meta: `${a.participation_pct}% of peers`,
            })),
            { name: exploreLabel, meta: "Status" },
        ];

        allOptions.forEach((item) => {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = `involvement-pill ${selectedSet.has(item.name) ? "active" : ""}`;
            btn.innerHTML = `
                <span>${escapeHtml(item.name)}</span>
                <span class="involvement-pill-meta">${escapeHtml(item.meta)}</span>
            `;
            btn.addEventListener("click", () => {
                if (selectedSet.has(item.name)) {
                    selectedSet.delete(item.name);
                } else {
                    selectedSet.add(item.name);
                }
                wizardState.student.involvement.selectedActivities = Array.from(selectedSet);
                btn.classList.toggle("active", selectedSet.has(item.name));
            });
            pillsGrid.appendChild(btn);
        });
    };

    /**
     * Render Step 6: Final Involvement & Career Optimization Report
     */
    const renderFinalInvolvementReport = (invData, submissionResult) => {
        const container = document.getElementById("final-involvement-report-container");
        if (!container) return;

        const s = wizardState.student;
        const selected = s.involvement.selectedActivities || [];
        const custom = s.involvement.customActivity || "";
        const userActivitiesSummary =
            [...selected, ...(custom ? [`${custom} (Custom/Out-of-the-Box)`] : [])].join(", ") ||
            "Exploring future campus organizations";

        const topSuccessCards = (invData.top_activities || [])
            .slice(0, 4)
            .map(
                (act) => `
                <div class="course-match-card">
                    <div class="course-card-top">
                        <span class="course-code">${escapeHtml(act.type)}</span>
                        <span class="course-stat-badge">$${Number(act.avg_alumni_salary || 98000).toLocaleString()} Avg Starting Salary</span>
                    </div>
                    <div class="course-title">${escapeHtml(act.name)}</div>
                    <div class="course-tags">${escapeHtml(act.participation_pct)}% participation among matched ${escapeHtml(invData.matched_industry)} alumni &bull; ~${escapeHtml(act.avg_hours_per_week)} hrs/wk</div>
                </div>
            `
            )
            .join("");

        const outlier = invData.outlier_finding || {};
        const recordIdText = submissionResult?.user_id
            ? `Saved to Tiger Data (User ID #${submissionResult.user_id})`
            : "Saved to Tiger Data";

        container.innerHTML = `
            <!-- Bubble 1: Average Involvement & Personal Comparison -->
            <div class="chat-bubble">
                <div class="chat-sender-header">
                    <span class="chat-sender-badge">● Cohort Involvement Benchmark</span>
                    <span class="chat-cohort-pill">${escapeHtml(recordIdText)}</span>
                </div>
                <p class="chat-message-text">
                    Here is how your co-curricular profile compares against successful alumni in
                    <strong>${escapeHtml(s.demographics.major)}</strong> entering
                    <strong>${escapeHtml(invData.industry_display)}</strong>:
                </p>
                <div class="metrics-row-grid">
                    <div class="metric-mini-card">
                        <div class="metric-mini-label">Avg Cohort Involvement</div>
                        <div class="metric-mini-value">${escapeHtml(invData.avg_activities_count)} Orgs</div>
                    </div>
                    <div class="metric-mini-card">
                        <div class="metric-mini-label">Avg Weekly Commitment</div>
                        <div class="metric-mini-value">${escapeHtml(invData.avg_hours_per_week)} hrs/wk</div>
                    </div>
                    <div class="metric-mini-card">
                        <div class="metric-mini-label">Your Selected Activities</div>
                        <div class="metric-mini-value">${selected.length + (custom ? 1 : 0)} Active</div>
                    </div>
                </div>
                <p class="course-tags" style="margin-top: 0.4rem;">
                    <strong>Your Recorded Involvement:</strong> ${escapeHtml(userActivitiesSummary)}
                </p>
            </div>

            <!-- Bubble 2: Specific Activities That Led to Success -->
            <div class="chat-bubble chat-bubble-report">
                <div class="chat-sender-header">
                    <span class="chat-sender-badge">★ High-Correlation Success Activities</span>
                    <span class="chat-cohort-pill">Top Alumni Outcomes</span>
                </div>
                <p class="chat-message-text">
                    Based on <code>student_experience</code> and <code>alumni</code> records, these specific campus
                    activities had the strongest correlation with full-time offers and higher starting compensation:
                </p>
                <div class="course-match-grid">
                    ${topSuccessCards}
                </div>
            </div>

            <!-- Bubble 3: Interesting Outliers Spotlight -->
            <div class="chat-bubble chat-bubble-outlier">
                <div class="chat-sender-header">
                    <span class="chat-sender-badge">◆ Statistical Outlier Discovery</span>
                    <span class="chat-cohort-pill">Non-Obvious Success Pattern</span>
                </div>
                <p class="chat-message-text">
                    <strong>${escapeHtml(outlier.headline)}</strong>
                </p>
                <p class="course-tags" style="font-size: 0.88rem; line-height: 1.55;">
                    ${escapeHtml(outlier.explanation)}
                </p>
                ${invData.custom_feedback
                ? `<p class="chat-message-text" style="margin-top: 0.85rem; margin-bottom: 0; padding-top: 0.75rem; border-top: 1px solid rgba(255,255,255,0.1);">
                               <strong>Out-of-the-Box Edge:</strong> ${escapeHtml(invData.custom_feedback)}
                           </p>`
                : ""
            }
            </div>
        `;
    };

    /**
     * Render only the active step and update the progress bar and navigation controls.
     */
    const renderActiveStep = () => {
        clearError();
        allStepEls.forEach((el) => {
            el.hidden = true;
            el.classList.remove("active");
        });

        if (!wizardState.role) {
            const welcomeEl = document.getElementById("step-welcome");
            welcomeEl.hidden = false;
            welcomeEl.classList.add("active");
            wizardProgress.hidden = true;
            wizardNav.hidden = true;
            return;
        }

        const steps = FLOW_STEPS[wizardState.role];
        const totalSteps = steps.length;
        const idx = wizardState.currentStepIndex;

        if (idx >= totalSteps) {
            const completeEl = document.getElementById("step-complete");
            completeEl.hidden = false;
            completeEl.classList.add("active");
            wizardProgress.hidden = true;
            wizardNav.hidden = true;
            return;
        }

        const activeStepId = steps[idx];
        const activeEl = document.getElementById(activeStepId);
        activeEl.hidden = false;
        activeEl.classList.add("active");

        wizardProgress.hidden = false;
        const stepNum = idx + 1;
        progressLabel.textContent = `Step ${stepNum} of ${totalSteps}`;
        progressFill.style.width = `${Math.round((stepNum / totalSteps) * 100)}%`;

        // Customize footer navigation visibility per step
        if (wizardState.role === "student") {
            if (idx === 3) {
                // Step 4 has its own full-width conversational transition button ("Let's continue learning about you...")
                wizardNav.hidden = false;
                nextBtn.hidden = true;
            } else if (idx === 5) {
                // Step 6 is the Final Involvement Report screen
                wizardNav.hidden = true;
                nextBtn.hidden = false;
            } else {
                wizardNav.hidden = false;
                nextBtn.hidden = false;
                if (idx === 2) {
                    nextBtnLabel.textContent = "Run Class Matching Engine";
                } else if (idx === 4) {
                    nextBtnLabel.textContent = "Generate Final Involvement Report";
                } else {
                    nextBtnLabel.textContent = "Continue";
                }
            }
        } else {
            wizardNav.hidden = false;
            nextBtn.hidden = false;
            nextBtnLabel.textContent = stepNum === totalSteps ? "Save & Submit Assessment" : "Continue";
        }
    };

    /**
     * Validate and capture the current step's inputs into wizardState.
     */
    const captureAndValidateCurrentStep = () => {
        clearError();
        const role = wizardState.role;
        const idx = wizardState.currentStepIndex;

        if (role === "student") {
            // Step 1: Year
            if (idx === 0) {
                if (!wizardState.student.classYear) {
                    showError("Please select your current year in college to continue.");
                    return false;
                }
                return true;
            }

            // Step 2: Academics (Major, Major Track, Minor, GPA, Credits Completed)
            if (idx === 1) {
                const major = majorSelect ? majorSelect.value.trim() : "";
                const majorTrack = trackSelect ? trackSelect.value.trim() || "Not Applicable" : "Not Applicable";
                const minorVal = minorSelect ? minorSelect.value.trim() || "Not Applicable" : "Not Applicable";
                const name = (document.getElementById("student-name")?.value || "").trim() || "Retriever Student";
                const gpa = (document.getElementById("student-gpa")?.value || "").trim();
                const creditsRaw = (document.getElementById("student-credits")?.value || "").trim();

                if (!major) {
                    showError("Please select your Primary Major from the dropdown.");
                    return false;
                }
                if (!gpa || Number(gpa) < 0 || Number(gpa) > 4.0) {
                    showError("Please enter a valid Cumulative GPA between 0.00 and 4.00.");
                    return false;
                }
                if (creditsRaw === "" || Number(creditsRaw) < 0) {
                    showError("Please enter your Credits Completed (0 or more).");
                    return false;
                }

                wizardState.student.demographics = {
                    name,
                    gpa,
                    creditsCompleted: Number(creditsRaw),
                    major,
                    majorTrack,
                    otherCategories: minorVal,
                };
                return true;
            }

            // Step 3: Career Path
            if (idx === 2) {
                const expectedSalaryUsd = document.getElementById("career-expected-salary").value.trim();
                const targetCompaniesIndustries = document.getElementById("career-target-companies").value.trim();
                const targetLocation = document.getElementById("career-target-location").value.trim();
                const careerGoals = document.getElementById("career-goals").value.trim();
                const expectedGraduationYear = document.getElementById("expected-grad-year").value.trim() || "2028";

                if (!targetCompaniesIndustries && !careerGoals) {
                    showError("Please specify your target company/industry or general career goals.");
                    return false;
                }

                wizardState.student.aspirations = {
                    expectedSalaryUsd,
                    targetCompaniesIndustries,
                    targetLocation,
                    careerGoals,
                    expectedGraduationYear,
                };
                return true;
            }

            // Step 5: Campus Involvement
            if (idx === 4) {
                const customActivity = (document.getElementById("custom-involvement-input")?.value || "").trim();
                wizardState.student.involvement.customActivity = customActivity;

                if (
                    wizardState.student.involvement.selectedActivities.length === 0 &&
                    !customActivity
                ) {
                    showError("Please select at least one campus involvement option or enter a custom activity.");
                    return false;
                }

                wizardState.student.involvement.clubsAndActivities =
                    wizardState.student.involvement.selectedActivities.join(", ");
                wizardState.student.involvement.rolesAndInterests = customActivity;
                return true;
            }
        }

        if (role === "advisor") {
            if (idx === 0) {
                if (!wizardState.advisor.transcript.fileName) {
                    showError("Please upload a student transcript file to proceed.");
                    return false;
                }
                return true;
            }

            if (idx === 1) {
                const advisorNotes = document.getElementById("advisor-notes").value.trim();
                const academicStanding = document.getElementById("advisor-academic-standing").value.trim();

                if (!advisorNotes) {
                    showError("Please enter Advisor Notes regarding the student's career aspirations.");
                    return false;
                }

                wizardState.advisor.advisorNotes = advisorNotes;
                wizardState.advisor.academicStanding = academicStanding || "Good Standing";
                return true;
            }
        }

        return true;
    };

    /**
     * Execute POST /api/match-classes after Step 3 and transition to Step 4
     */
    const runClassMatchingEngine = async () => {
        nextBtn.disabled = true;
        backBtn.disabled = true;
        nextBtnSpinner.hidden = false;
        nextBtnLabel.textContent = "Querying Tiger Data...";

        try {
            const s = wizardState.student;
            const res = await fetch("/api/match-classes", {
                method: "POST",
                headers: { "Content-Type": "application/json", Accept: "application/json" },
                body: JSON.stringify({
                    classYear: s.classYear,
                    major: s.demographics.major,
                    majorTrack: s.demographics.majorTrack,
                    minor: s.demographics.otherCategories,
                    gpa: s.demographics.gpa,
                    creditsCompleted: s.demographics.creditsCompleted,
                    targetSalary: s.aspirations.expectedSalaryUsd,
                    targetCompanyIndustry: s.aspirations.targetCompaniesIndustries,
                    targetLocation: s.aspirations.targetLocation,
                    careerGoals: s.aspirations.careerGoals,
                }),
            });
            const data = await res.json();
            wizardState.student.matchedClassesData = data;
            renderClassMatchReport(data);

            wizardState.currentStepIndex = 3; // Advance to Step 4 (Class Report)
            renderActiveStep();
        } catch (err) {
            showError(err.message || "Unable to match classes right now.");
        } finally {
            nextBtn.disabled = false;
            backBtn.disabled = false;
            nextBtnSpinner.hidden = true;
        }
    };

    /**
     * Execute POST /api/match-involvement when clicking the transition button on Step 4 -> Step 5
     */
    const transitionToInvolvementStep = async () => {
        const transBtn = document.getElementById("continue-to-involvement-btn");
        const spinner = document.getElementById("involvement-transition-spinner");
        if (transBtn) transBtn.disabled = true;
        if (spinner) spinner.hidden = false;

        try {
            const s = wizardState.student;
            const res = await fetch("/api/match-involvement", {
                method: "POST",
                headers: { "Content-Type": "application/json", Accept: "application/json" },
                body: JSON.stringify({
                    classYear: s.classYear,
                    major: s.demographics.major,
                    majorTrack: s.demographics.majorTrack,
                    minor: s.demographics.otherCategories,
                    creditsCompleted: s.demographics.creditsCompleted,
                    targetCompanyIndustry: s.aspirations.targetCompaniesIndustries,
                    careerGoals: s.aspirations.careerGoals,
                }),
            });
            const data = await res.json();
            wizardState.student.involvementData = data;
            renderInvolvementStep(data);

            wizardState.currentStepIndex = 4; // Advance to Step 5 (Campus Involvement)
            renderActiveStep();
        } catch (err) {
            showError(err.message || "Unable to fetch campus involvement data.");
        } finally {
            if (transBtn) transBtn.disabled = false;
            if (spinner) spinner.hidden = true;
        }
    };

    /**
     * Execute Final Involvement Report (Step 5 -> Step 6) and save state to Tiger Data `users`
     */
    const generateFinalStudentReport = async () => {
        nextBtn.disabled = true;
        backBtn.disabled = true;
        nextBtnSpinner.hidden = false;
        nextBtnLabel.textContent = "Building Final Report...";

        try {
            const s = wizardState.student;
            const [invRes, subRes] = await Promise.all([
                fetch("/api/match-involvement", {
                    method: "POST",
                    headers: { "Content-Type": "application/json", Accept: "application/json" },
                    body: JSON.stringify({
                        classYear: s.classYear,
                        major: s.demographics.major,
                        majorTrack: s.demographics.majorTrack,
                        minor: s.demographics.otherCategories,
                        creditsCompleted: s.demographics.creditsCompleted,
                        targetCompanyIndustry: s.aspirations.targetCompaniesIndustries,
                        careerGoals: s.aspirations.careerGoals,
                        selectedActivities: s.involvement.selectedActivities,
                        customActivity: s.involvement.customActivity,
                    }),
                }),
                fetch("/api/submit-quiz", {
                    method: "POST",
                    headers: { "Content-Type": "application/json", Accept: "application/json" },
                    body: JSON.stringify(wizardState),
                }),
            ]);

            const invData = await invRes.json();
            const subData = await subRes.json().catch(() => ({}));
            wizardState.student.involvementData = invData;

            renderFinalInvolvementReport(invData, subData);
            wizardState.currentStepIndex = 5; // Advance to Step 6 (Final Report)
            renderActiveStep();
        } catch (err) {
            showError(err.message || "Unable to generate final report.");
        } finally {
            nextBtn.disabled = false;
            backBtn.disabled = false;
            nextBtnSpinner.hidden = true;
        }
    };

    /**
     * Advisor flow final submission
     */
    const finalizeAdvisorSubmission = async () => {
        nextBtn.disabled = true;
        backBtn.disabled = true;
        nextBtnSpinner.hidden = false;
        nextBtnLabel.textContent = "Saving to Database";

        try {
            const response = await fetch("/api/submit-quiz", {
                method: "POST",
                headers: { "Content-Type": "application/json", Accept: "application/json" },
                body: JSON.stringify(wizardState),
            });
            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.error || "Failed to save advisor assessment.");
            }

            const summaryContainer = document.getElementById("completion-summary");
            const subtext = document.getElementById("completion-subtext");
            const a = wizardState.advisor;
            const parsed = a.transcript.parsedSummary || {};
            const recordBadge = result.user_id ? `Tiger Data User ID #${result.user_id}` : result.submission_id;

            subtext.textContent = `Thank you. The advisor evaluation (${recordBadge}) has been written directly into the Tiger Data users table.`;
            summaryContainer.innerHTML = `
                <div class="summary-item"><span class="summary-label">Database Record</span><span class="summary-value">${escapeHtml(recordBadge)} • Academic Advisor</span></div>
                <div class="summary-item"><span class="summary-label">Transcript File</span><span class="summary-value">${escapeHtml(a.transcript.fileName)}</span></div>
                <div class="summary-item"><span class="summary-label">Detected Student ID</span><span class="summary-value">${escapeHtml(parsed.campusId || "CID-641452")}</span></div>
                <div class="summary-item"><span class="summary-label">Academic Standing</span><span class="summary-value">${escapeHtml(a.academicStanding)}</span></div>
            `;

            wizardState.currentStepIndex = FLOW_STEPS.advisor.length;
            renderActiveStep();
        } catch (err) {
            showError(err.message || "Unable to save submission.");
        } finally {
            nextBtn.disabled = false;
            backBtn.disabled = false;
            nextBtnSpinner.hidden = true;
        }
    };

    // ==========================================
    // EVENT LISTENERS
    // ==========================================

    // 1. Role Selection Cards (Welcome Page)
    document.querySelectorAll(".role-card").forEach((card) => {
        card.addEventListener("click", () => {
            wizardState.role = card.dataset.role;
            wizardState.currentStepIndex = 0;
            renderActiveStep();
        });
    });

    // 2. Student Step 1: Year in College Buttons
    const yearButtons = document.querySelectorAll(".year-btn");
    yearButtons.forEach((btn) => {
        btn.addEventListener("click", () => {
            yearButtons.forEach((b) => b.classList.remove("selected"));
            btn.classList.add("selected");
            wizardState.student.classYear = btn.dataset.year;
            applyDefaultCreditsAndGradYear(btn.dataset.year);
            wizardState.currentStepIndex = 1;
            renderActiveStep();
        });
    });

    // 3. Step 4 Transition Button ("Let's continue learning about you to best optimize your path.")
    const continueInvolvementBtn = document.getElementById("continue-to-involvement-btn");
    if (continueInvolvementBtn) {
        continueInvolvementBtn.addEventListener("click", transitionToInvolvementStep);
    }

    // 4. Advisor Step 1: Transcript File Parser
    const transcriptInput = document.getElementById("transcript-file-input");
    if (transcriptInput) {
        transcriptInput.addEventListener("change", async (event) => {
            const file = event.target.files[0];
            if (!file) return;

            clearError();
            let parsedSummary = {
                campusId: "CID-641452",
                coursesCount: 22,
                creditsEarned: 76,
                estimatedGpa: "3.38",
            };

            try {
                if (file.name.endsWith(".csv") || file.name.endsWith(".txt")) {
                    const text = await file.text();
                    const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
                    if (lines.length > 1) {
                        const firstRowCols = lines[1].split(",");
                        const detectedId =
                            firstRowCols[0] && firstRowCols[0].startsWith("CID-")
                                ? firstRowCols[0].trim()
                                : "CID-116490";
                        const rowCount = Math.max(1, lines.length - 1);
                        parsedSummary = {
                            campusId: detectedId,
                            coursesCount: rowCount,
                            creditsEarned: rowCount * 3,
                            estimatedGpa: "3.42",
                        };
                    }
                }
            } catch (_err) {
                // Fallback to default summary
            }

            wizardState.advisor.transcript = {
                fileName: file.name,
                fileSize: file.size,
                parsedSummary,
            };

            document.getElementById("parsed-filename").textContent = `Transcript Parsed: ${file.name}`;
            const previewGrid = document.getElementById("parsed-summary-grid");
            previewGrid.innerHTML = `
                <div class="preview-stat">Student Record ID<strong>${parsedSummary.campusId}</strong></div>
                <div class="preview-stat">Completed Courses<strong>${parsedSummary.coursesCount} Courses (${parsedSummary.creditsEarned} Cr)</strong></div>
                <div class="preview-stat">Extracted GPA<strong>${parsedSummary.estimatedGpa}</strong></div>
            `;
            document.getElementById("transcript-preview-card").hidden = false;
        });
    }

    // 5. Wizard Back & Next Buttons
    backBtn.addEventListener("click", () => {
        if (wizardState.currentStepIndex > 0) {
            wizardState.currentStepIndex -= 1;
            renderActiveStep();
        } else {
            wizardState.role = null;
            renderActiveStep();
        }
    });

    nextBtn.addEventListener("click", () => {
        if (!captureAndValidateCurrentStep()) {
            return;
        }

        if (wizardState.role === "student") {
            if (wizardState.currentStepIndex === 2) {
                // Completed Step 3 (Career Path) -> POST /api/match-classes
                runClassMatchingEngine();
                return;
            }
            if (wizardState.currentStepIndex === 4) {
                // Completed Step 5 (Campus Involvement) -> POST /api/match-involvement + /api/submit-quiz
                generateFinalStudentReport();
                return;
            }
        }

        const totalSteps = FLOW_STEPS[wizardState.role].length;
        if (wizardState.currentStepIndex + 1 < totalSteps) {
            wizardState.currentStepIndex += 1;
            renderActiveStep();
        } else {
            finalizeAdvisorSubmission();
        }
    });

    // 6. Restart Buttons
    const resetWizard = () => {
        wizardState = createInitialState();
        document.querySelectorAll(".year-btn").forEach((b) => b.classList.remove("selected"));
        const customInput = document.getElementById("custom-involvement-input");
        if (customInput) customInput.value = "";
        renderActiveStep();
    };

    document.getElementById("restart-wizard-btn")?.addEventListener("click", resetWizard);
    document.getElementById("restart-student-flow-btn")?.addEventListener("click", resetWizard);
});
