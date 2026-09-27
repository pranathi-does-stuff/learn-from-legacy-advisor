/**
 * Section 3 Controller (Campus Involvement & Co-Curriculars)
 * Implements:
 * 1. Suppressed early recommendations (recommendations and match cards appear ONLY in Stage C final report).
 * 2. Sequential 3-Question Flow:
 *    - Question 1: Popular Matches Checklist (tailored by major & industry, guaranteed 6-8 options).
 *    - Question 2: Other Organizations & Initiatives (live autocomplete search bar + chips + custom input).
 *    - Question 3: Campus Impact Statement (large paragraph textarea for outlier detection).
 * 3. Stage C Final Report:
 *    - Gemini API outlier advice in Mentor Thought Bubble.
 *    - Dynamic visual involvement metrics (engagement score progress bar, leadership density, outlier status).
 *    - Data Table: Most popular campus organizations in database.
 *    - Top 3 Alumni Involvement & Outlier Match Cards at the bottom.
 */
document.addEventListener("DOMContentLoaded", async () => {
    const state = QuizApp.getQuizState();
    let sec3Data = QuizApp.getSectionData(3);
    const shouldClearInputsOnReload = QuizApp.shouldResetFormInputsOnReload();
    if (shouldClearInputsOnReload) {
        const clearedSection3Answers = {
            selectedActivities: [],
            otherOrganizations: [],
            customActivity: "",
            noPopularActivities: false,
            noOtherOrganizations: false,
            campusImpact: "",
            impactStatement: "",
            noImpactStatement: false,
            noCurrentActivities: false,
        };
        Object.assign(state.user, clearedSection3Answers);
        QuizApp.updateUserData(clearedSection3Answers);
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

    // Substep Blocks (Screens 1, 2, 3)
    const subPopular = document.getElementById("substep-popular-activities");
    const subOther = document.getElementById("substep-other-orgs");
    const subImpact = document.getElementById("substep-impact-statement");

    // Screen 1 Elements
    const industryLabel = document.getElementById("student-industry-label");
    const popularGrid = document.getElementById("popular-activities-grid");
    const popularSpinner = document.getElementById("popular-activities-spinner");
    const nonePopularCheckbox = document.getElementById("none-popular-activities");
    const btnToOtherOrgs = document.getElementById("btn-to-other-orgs");

    // Screen 2 Elements (Autocomplete Search Bar)
    const orgSearchInput = document.getElementById("org-search-input");
    const orgDropdown = document.getElementById("org-autocomplete-dropdown");
    const selectedOrgChips = document.getElementById("selected-org-chips");
    const customOrgInput = document.getElementById("custom-org-input");
    const noneOtherCheckbox = document.getElementById("none-other-orgs");
    const btnBackToPopular = document.getElementById("btn-back-to-popular");
    const btnToImpactStatement = document.getElementById("btn-to-impact-statement");

    // Screen 3 Elements (Impact Statement Textarea)
    const campusImpactTextarea = document.getElementById("campus-impact-statement");
    const noImpactCheckbox = document.getElementById("no-impact-statement");
    const btnBackToOtherOrgs = document.getElementById("btn-back-to-other-orgs");
    const btnSubmitReport = document.getElementById("btn-submit-involvement-report");
    const spinnerGenerateReport = document.getElementById("spinner-generate-report");

    // Initialize State Tracking Sets
    const selectedActivities = new Set(shouldClearInputsOnReload ? [] : (state.user.selectedActivities || []));
    const otherOrganizations = new Set(shouldClearInputsOnReload ? [] : (state.user.otherOrganizations || []));
    if (customOrgInput && !shouldClearInputsOnReload && state.user.customActivity) {
        customOrgInput.value = state.user.customActivity;
    }
    if (campusImpactTextarea && !shouldClearInputsOnReload && (state.user.campusImpact || state.user.impactStatement)) {
        campusImpactTextarea.value = state.user.campusImpact || state.user.impactStatement || "";
    }
    if (nonePopularCheckbox && !shouldClearInputsOnReload && state.user.noPopularActivities) {
        nonePopularCheckbox.checked = true;
    }
    if (noneOtherCheckbox && !shouldClearInputsOnReload && state.user.noOtherOrganizations) {
        noneOtherCheckbox.checked = true;
    }
    if (noImpactCheckbox && !shouldClearInputsOnReload && state.user.noImpactStatement) {
        noImpactCheckbox.checked = true;
    }

    // Set Dynamic Label
    if (industryLabel) {
        industryLabel.textContent = state.user.targetCompanyIndustry || state.user.careerGoals || state.user.major || "your chosen field";
    }

    const showValidationError = (id, message) => {
        const error = document.getElementById(id);
        if (error) {
            error.textContent = message;
            error.hidden = false;
        }
    };

    const clearValidationError = (id) => {
        const error = document.getElementById(id);
        if (error) {
            error.hidden = true;
        }
    };

    // Start Avatar 3's intro speech as soon as the page is initialized.
    void (async () => {
        try {
            await QuizApp.playAvatarDialogue(introText, 3);
        } catch (e) {
            console.log("Intro audio playback info:", e);
        }
    })();

    if (introReplayBtn) {
        introReplayBtn.addEventListener("click", () => {
            QuizApp.playAvatarDialogue(introText, 3);
        });
    }

    // Screen Switcher Helper
    const showSubstep = (activeStepEl) => {
        [subPopular, subOther, subImpact].forEach((el) => {
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

    // Start Section 3 Questions Button (Removes intro stage & opens Screen 1 in split layout)
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
                showSubstep(subPopular);
                QuizApp.playAvatarDialogue("Let's look at popular student organizations and competitive teams aligned with your field.", 3);
            }
            loadInvolvementOptions();
        });
    }

    // Fallback default activities (Guarantees at least 10 student organizations & competitive teams are ALWAYS present)
    const STATIC_FALLBACK_ACTIVITIES = [
        {
            name: "Association for Computing Machinery Student Chapter",
            category: "Student Organization",
            description: "UMBC's premier computing society hosting technical workshops, tech talks, and hack sessions.",
            skills: "Algorithms, Software Engineering, Tech Networking, Peer Collaboration",
        },
        {
            name: "Data Science Collective",
            category: "Student Organization",
            description: "Student community exploring predictive modeling, data visualization, and applied ML pipelines.",
            skills: "Python, Machine Learning, Data Wrangling, Statistical Modeling, SQL",
        },
        {
            name: "Google Developer Student Club",
            category: "Student Organization",
            description: "Google-supported student chapter building mobile, cloud, and web projects for local communities.",
            skills: "Flutter, Firebase, GCP, Web Development",
        },
        {
            name: "Retriever Cyber Club",
            category: "Student Organization",
            description: "Hands-on security workshops, blue/red teaming labs, and CTF tournament preparations.",
            skills: "Network Security, Penetration Testing, Linux Admin, Incident Response",
        },
        {
            name: "Capture the Flag Team",
            category: "Competitive Team",
            description: "Competitive cybersecurity team competing in regional & national collegiate CTF tournaments.",
            skills: "Binary Exploitation, Cryptography, Reverse Engineering, Web Security",
        },
        {
            name: "Open Source Society",
            category: "Student Organization",
            description: "Collaborative developers contributing to major open-source repositories and tooling.",
            skills: "Git/GitHub, Code Review, CI/CD, Collaborative Development",
        },
        {
            name: "Retriever Robotics",
            category: "Student Organization",
            description: "Build autonomous and teleoperated robots for intercollegiate engineering challenges.",
            skills: "Embedded C/C++, ROS, Microcontrollers, Hardware/Software Integration",
        },
        {
            name: "Collegiate Cyber Defense Team",
            category: "Competitive Team",
            description: "Defensive security squad defending live enterprise infrastructure against red team attacks in CCDC.",
            skills: "System Hardening, Firewall Configuration, SIEM Monitoring, Active Directory",
        },
        {
            name: "Women in Computing",
            category: "Student Organization",
            description: "Empowering women and non-binary students in technology through mentorship and industry panels.",
            skills: "Leadership, Industry Networking, Career Development, Mentorship",
        },
        {
            name: "Programming Contest Team",
            category: "Competitive Team",
            description: "UMBC's competitive algorithm squad training for ICPC collegiate challenges.",
            skills: "Advanced Algorithms, Dynamic Programming, Graph Theory, C++",
        },
    ];

    let cachedOptions = null;

    // Load Activities & Organizations from API
    const loadInvolvementOptions = async () => {
        if (cachedOptions) return cachedOptions;
        try {
            const params = new URLSearchParams({
                major: state.user.major || "Computer Science",
                majorTrack: state.user.majorTrack || "",
                targetCompanyIndustry: state.user.targetCompanyIndustry || "",
                careerGoals: state.user.careerGoals || "",
            });
            const res = await fetch(`/api/involvement-options?${params.toString()}`);
            if (res.ok) {
                cachedOptions = await res.json();
                const activities = (cachedOptions.popular_activities && cachedOptions.popular_activities.length >= 4)
                    ? cachedOptions.popular_activities
                    : STATIC_FALLBACK_ACTIVITIES;
                renderScreen1Popular(activities);
                renderOtherOrgChips();
                return cachedOptions;
            }
        } catch (err) {
            console.warn("Failed fetching involvement options, loading fallback defaults:", err);
        } finally {
            if (popularSpinner) popularSpinner.style.display = "none";
        }

        // Guaranteed fallback render
        renderScreen1Popular(STATIC_FALLBACK_ACTIVITIES);
        renderOtherOrgChips();
    };

    // =========================================================================
    // SCREEN 1: POPULAR MATCHES CHECKLIST
    // =========================================================================
    const renderScreen1Popular = (activities) => {
        if (!popularGrid) return;
        popularGrid.innerHTML = "";

        //const listToRender = (activities && activities.length > 0) ? activities : STATIC_FALLBACK_ACTIVITIES;
        const listToRender = (activities) ? activities : [];

        listToRender.forEach((act) => {
            const isChecked = selectedActivities.has(act.name);
            const card = document.createElement("div");
            card.className = `course-check-item ${isChecked ? "checked" : ""}`;
            card.innerHTML = `
                <div class="course-chk-box">${isChecked ? "✓" : ""}</div>
                <div class="course-chk-info">
                    <div class="course-chk-top">
                        <span class="course-chk-code">${QuizApp.escapeHtml(act.name)}</span>
                        <span class="course-chk-level" style="background:rgba(230, 81, 0, 0.12); color:#E65100;">${QuizApp.escapeHtml(act.category || "Club")}</span>
                    </div>
                    <div class="course-chk-title" style="font-weight:400; font-size:0.85rem; color:var(--text-secondary); margin-top:0.35rem;">
                        ${QuizApp.escapeHtml(act.description || "")}
                    </div>
                    ${act.skills ? `<div class="course-chk-tags" style="margin-top:0.35rem;">Skills: ${QuizApp.escapeHtml(act.skills)}</div>` : ""}
                </div>
            `;

            card.addEventListener("click", () => {
                const nowChecked = !selectedActivities.has(act.name);
                if (nowChecked) {
                    selectedActivities.add(act.name);
                    if (nonePopularCheckbox) nonePopularCheckbox.checked = false;
                    card.classList.add("checked");
                    card.querySelector(".course-chk-box").textContent = "✓";
                } else {
                    selectedActivities.delete(act.name);
                    card.classList.remove("checked");
                    card.querySelector(".course-chk-box").textContent = "";
                }
                QuizApp.updateUserData({
                    selectedActivities: Array.from(selectedActivities),
                    noPopularActivities: false,
                    noCurrentActivities: false,
                });
                clearValidationError("popular-activities-error");
            });

            popularGrid.appendChild(card);
        });
    };

    if (nonePopularCheckbox) {
        nonePopularCheckbox.addEventListener("change", () => {
            if (nonePopularCheckbox.checked) {
                selectedActivities.clear();
                popularGrid?.querySelectorAll(".course-check-item").forEach((card) => {
                    card.classList.remove("checked");
                    const box = card.querySelector(".course-chk-box");
                    if (box) box.textContent = "";
                });
            }
            QuizApp.updateUserData({
                selectedActivities: Array.from(selectedActivities),
                noPopularActivities: Boolean(nonePopularCheckbox.checked),
            });
            clearValidationError("popular-activities-error");
        });
    }

    if (btnToOtherOrgs) {
        btnToOtherOrgs.addEventListener("click", () => {
            if (!selectedActivities.size && !nonePopularCheckbox?.checked) {
                showValidationError("popular-activities-error", "Please select any activities you participate in or confirm that you are not involved in any listed.");
                return;
            }
            QuizApp.updateUserData({
                selectedActivities: Array.from(selectedActivities),
                noPopularActivities: Boolean(nonePopularCheckbox?.checked),
            });
            showSubstep(subOther);
            QuizApp.playAvatarDialogue("Great, now search or add any other student clubs, hackathons, or campus initiatives.", 3);
        });
    }

    // =========================================================================
    // SCREEN 2: OTHER ORGANIZATIONS & INITIATIVES (AUTOCOMPLETE SEARCH BAR)
    // =========================================================================
    const renderOtherOrgChips = () => {
        if (!selectedOrgChips) return;
        selectedOrgChips.innerHTML = "";

        if (otherOrganizations.size === 0) {
            selectedOrgChips.innerHTML = '<span style="color:var(--text-muted); font-size:0.85rem;">No additional organizations added yet. Use the search bar above to add clubs.</span>';
            return;
        }

        otherOrganizations.forEach((orgName) => {
            const chip = document.createElement("span");
            chip.className = "planned-course-chip";
            chip.style.borderColor = "var(--avatar-orange)";
            chip.innerHTML = `
                <span>${QuizApp.escapeHtml(orgName)}</span>
                <button type="button" class="chip-remove-btn" title="Remove ${QuizApp.escapeHtml(orgName)}">&times;</button>
            `;
            chip.querySelector(".chip-remove-btn").addEventListener("click", () => {
                otherOrganizations.delete(orgName);
                renderOtherOrgChips();
                QuizApp.updateUserData({ otherOrganizations: Array.from(otherOrganizations) });
            });
            selectedOrgChips.appendChild(chip);
        });
    };

    const renderOrgAutocompleteDropdown = (results) => {
        if (!orgDropdown) return;
        orgDropdown.innerHTML = "";

        if (!results || results.length === 0) {
            orgDropdown.innerHTML = `<div class="autocomplete-empty">No matching clubs or activities found. You can add custom initiatives in the field below.</div>`;
            orgDropdown.hidden = false;
            return;
        }

        results.forEach((item) => {
            const isAlreadyAdded = otherOrganizations.has(item.name);
            const el = document.createElement("div");
            el.className = `autocomplete-item ${isAlreadyAdded ? "highlighted" : ""}`;
            el.innerHTML = `
                <div class="autocomplete-item-top">
                    <span class="autocomplete-item-code">${QuizApp.escapeHtml(item.name)}</span>
                    <span class="autocomplete-item-credits" style="background:rgba(230, 81, 0, 0.1); color:#E65100;">${QuizApp.escapeHtml(item.category || "Student Org")}</span>
                </div>
                <div class="autocomplete-item-title">${QuizApp.escapeHtml(item.description || "")}</div>
                ${item.skills ? `<div style="font-size:0.75rem; color:var(--text-muted); margin-top:0.2rem;">Skills: ${QuizApp.escapeHtml(item.skills)}</div>` : ""}
            `;

            el.addEventListener("click", () => {
                otherOrganizations.add(item.name);
                if (noneOtherCheckbox) noneOtherCheckbox.checked = false;
                renderOtherOrgChips();
                QuizApp.updateUserData({ otherOrganizations: Array.from(otherOrganizations), noOtherOrganizations: false });
                clearValidationError("other-orgs-error");
                if (orgSearchInput) orgSearchInput.value = "";
                orgDropdown.hidden = true;
            });
            orgDropdown.appendChild(el);
        });
        orgDropdown.hidden = false;
    };

    let orgSearchTimer = null;
    if (orgSearchInput) {
        orgSearchInput.addEventListener("input", (e) => {
            clearTimeout(orgSearchTimer);
            const query = e.target.value.trim();
            if (!query) {
                if (orgDropdown) orgDropdown.hidden = true;
                return;
            }
            orgSearchTimer = setTimeout(async () => {
                try {
                    const res = await fetch(`/api/search-organizations?q=${encodeURIComponent(query)}`);
                    if (res.ok) {
                        const data = await res.json();
                        renderOrgAutocompleteDropdown(data.results || []);
                    }
                } catch (err) {
                    console.warn("Org autocomplete search error:", err);
                }
            }, 180);
        });

        orgSearchInput.addEventListener("focus", () => {
            if (orgSearchInput.value.trim().length > 0 && orgDropdown && orgDropdown.children.length > 0) {
                orgDropdown.hidden = false;
            }
        });
    }

    document.addEventListener("click", (e) => {
        if (orgDropdown && !orgDropdown.contains(e.target) && e.target !== orgSearchInput) {
            orgDropdown.hidden = true;
        }
    });

    if (customOrgInput) {
        customOrgInput.addEventListener("input", () => {
            if (customOrgInput.value.trim() && noneOtherCheckbox) {
                noneOtherCheckbox.checked = false;
            }
            QuizApp.updateUserData({
                customActivity: customOrgInput.value.trim(),
                noOtherOrganizations: false,
            });
            clearValidationError("other-orgs-error");
        });
    }

    if (noneOtherCheckbox) {
        noneOtherCheckbox.addEventListener("change", () => {
            if (noneOtherCheckbox.checked) {
                otherOrganizations.clear();
                renderOtherOrgChips();
                if (customOrgInput) customOrgInput.value = "";
            }
            QuizApp.updateUserData({
                otherOrganizations: Array.from(otherOrganizations),
                customActivity: customOrgInput?.value || "",
                noOtherOrganizations: Boolean(noneOtherCheckbox.checked),
            });
            clearValidationError("other-orgs-error");
        });
    }

    if (btnBackToPopular) {
        btnBackToPopular.addEventListener("click", () => {
            showSubstep(subPopular);
            QuizApp.playAvatarDialogue("Review or update your selected student organizations and teams.", 3);
        });
    }

    if (btnToImpactStatement) {
        btnToImpactStatement.addEventListener("click", () => {
            const hasCustom = Boolean(customOrgInput?.value.trim());
            const hasSelectedOrgs = otherOrganizations.size > 0;
            const hasCheckedNone = Boolean(noneOtherCheckbox?.checked);

            if (!hasSelectedOrgs && !hasCustom && !hasCheckedNone) {
                showValidationError("other-orgs-error", "Please add any other organizations, enter independent projects/leadership, or check the box to confirm you have none.");
                return;
            }

            QuizApp.updateUserData({
                otherOrganizations: Array.from(otherOrganizations),
                customActivity: customOrgInput?.value.trim() || "",
                noOtherOrganizations: hasCheckedNone,
            });
            showSubstep(subImpact);
            QuizApp.playAvatarDialogue("Tell me about your distinctive campus contributions, leadership, or personal project initiatives.", 3);
        });
    }

    // =========================================================================
    // SCREEN 3: CAMPUS IMPACT STATEMENT (PARAGRAPH TEXTAREA)
    // =========================================================================
    if (campusImpactTextarea) {
        campusImpactTextarea.addEventListener("input", () => {
            if (campusImpactTextarea.value.trim() && noImpactCheckbox) {
                noImpactCheckbox.checked = false;
            }
            QuizApp.updateUserData({
                campusImpact: campusImpactTextarea.value.trim(),
                impactStatement: campusImpactTextarea.value.trim(),
                noImpactStatement: false,
            });
            clearValidationError("impact-statement-error");
        });
    }

    if (noImpactCheckbox) {
        noImpactCheckbox.addEventListener("change", () => {
            if (noImpactCheckbox.checked) {
                if (campusImpactTextarea) campusImpactTextarea.value = "";
            }
            QuizApp.updateUserData({
                campusImpact: campusImpactTextarea?.value || "",
                impactStatement: campusImpactTextarea?.value || "",
                noImpactStatement: Boolean(noImpactCheckbox.checked),
            });
            clearValidationError("impact-statement-error");
        });
    }

    if (btnBackToOtherOrgs) {
        btnBackToOtherOrgs.addEventListener("click", () => {
            showSubstep(subOther);
            QuizApp.playAvatarDialogue("Review or update your other campus organizations.", 3);
        });
    }

    // =========================================================================
    // STAGE C: SUBMIT QUESTION 3 & GENERATE SECTION 3 FINAL REPORT
    // =========================================================================
    if (btnSubmitReport) {
        btnSubmitReport.addEventListener("click", async () => {
            const impactVal = campusImpactTextarea ? campusImpactTextarea.value.trim() : "";
            const hasCheckedNoImpact = Boolean(noImpactCheckbox?.checked);

            if (!impactVal && !hasCheckedNoImpact) {
                showValidationError("impact-statement-error", "Please write a brief impact statement describing what you've done outside academics, or check the box to confirm you do not have any yet.");
                return;
            }

            if (spinnerGenerateReport) {
                spinnerGenerateReport.hidden = false;
                spinnerGenerateReport.removeAttribute("hidden");
            }
            btnSubmitReport.disabled = true;

            QuizApp.updateUserData({
                selectedActivities: Array.from(selectedActivities),
                otherOrganizations: Array.from(otherOrganizations),
                customActivity: customOrgInput?.value.trim() || "",
                campusImpact: impactVal,
                impactStatement: impactVal,
                noImpactStatement: hasCheckedNoImpact,
                noCurrentActivities: (selectedActivities.size === 0 && otherOrganizations.size === 0 && !customOrgInput?.value.trim()),
            });

            const updatedState = QuizApp.getQuizState();

            try {
                const res = await fetch("/api/generate-report", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        section_name: "campus_involvement",
                        user_data: updatedState.user,
                    }),
                });

                if (res.ok) {
                    const reportData = await res.json();
                    QuizApp.saveSectionData(3, reportData);

                    // Hide Question Stage & Reveal Section 3 Final Report Stage (Split Grid Layout)
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

                    // Render Visual Metrics (Monochromatic Orange), Campus Clubs Table, and Top 3 Outlier Alumni Matches
                    renderInvolvementMetrics(reportData.involvement_analysis);
                    renderCampusClubsTable(reportData.involvement_analysis?.popular_clubs_table || []);
                    renderTopAlumniMatches(reportData.matches || []);

                    // Play Mentor Speech
                    if (reportData.text) {
                        QuizApp.playReportAudio(reportData.text, reportData.audio, 3);
                    }
                } else {
                    alert("The server encountered an error while analyzing your campus involvement. Please try again.");
                }
            } catch (err) {
                console.error("Error generating Section 3 involvement report:", err);
                alert("Unable to generate involvement report. Please check your connection and try again.");
            } finally {
                if (spinnerGenerateReport) spinnerGenerateReport.hidden = true;
                btnSubmitReport.disabled = false;
            }
        });
    }

    // =========================================================================
    // DATA VISUALIZATION RENDERING FUNCTIONS (STRICTLY MONOCHROMATIC ORANGE)
    // =========================================================================

    // 1. Render Visual Metrics (Progress Bar, Leadership Density, Outlier Status - Unified Orange Palette)
    const renderInvolvementMetrics = (analysis) => {
        const container = document.getElementById("involvement-metrics-container");
        if (!container || !analysis) return;

        const score = analysis.engagement_score || 75;
        const leadership = analysis.leadership_factor || "Moderate (Active Contributor)";
        const leadershipDesc = analysis.leadership_desc || "Engaged in campus initiatives.";
        const outlierStatus = analysis.outlier_status || "Standard Curriculum Path";
        const outlierSummary = analysis.outlier_summary || "Aligned with standard departmental milestones.";
        const alignmentPct = analysis.alignment_pct || "84%";

        container.innerHTML = `
            <div class="involvement-metric-grid">
                <!-- Metric 1: Engagement Score & Progress Bar -->
                <div class="analysis-card" style="border-left: 4px solid var(--avatar-orange);">
                    <div class="analysis-card-header">
                        <span class="analysis-card-title">📈 Campus Engagement Score</span>
                        <span class="analysis-count-badge badge-orange">${score}%</span>
                    </div>
                    <div class="metric-bar-wrap">
                        <div class="metric-bar-fill" style="width: ${score}%;"></div>
                    </div>
                    <p style="font-size:0.78rem; color:var(--text-secondary); margin-top:0.6rem;">
                        ${QuizApp.escapeHtml(analysis.engagement_rating || "Competitive Engagement")} across extracurricular &amp; co-curricular activities.
                    </p>
                </div>

                <!-- Metric 2: Leadership Density -->
                <div class="analysis-card" style="border-left: 4px solid var(--avatar-orange);">
                    <div class="analysis-card-header">
                        <span class="analysis-card-title">👑 Leadership Density</span>
                        <span class="analysis-count-badge badge-orange">${QuizApp.escapeHtml(leadership.split(" ")[0])}</span>
                    </div>
                    <h4 style="font-size:0.95rem; margin:0.4rem 0 0.2rem 0; color:var(--text-primary);">${QuizApp.escapeHtml(leadership)}</h4>
                    <p style="font-size:0.78rem; color:var(--text-secondary);">
                        ${QuizApp.escapeHtml(leadershipDesc)}
                    </p>
                </div>

                <!-- Metric 3: Outlier & Distinctive Match Status -->
                <div class="analysis-card" style="border-left: 4px solid var(--avatar-orange);">
                    <div class="analysis-card-header">
                        <span class="analysis-card-title">⚡ Outlier Trajectory Match</span>
                        <span class="analysis-count-badge badge-orange">${QuizApp.escapeHtml(outlierStatus.split(" ")[0])}</span>
                    </div>
                    <h4 style="font-size:0.95rem; margin:0.4rem 0 0.2rem 0; color:var(--text-primary);">${QuizApp.escapeHtml(outlierStatus)}</h4>
                    <p style="font-size:0.78rem; color:var(--text-secondary);">
                        ${QuizApp.escapeHtml(outlierSummary)}
                    </p>
                </div>

                <!-- Metric 4: Industry Alignment -->
                <div class="analysis-card" style="border-left: 4px solid var(--avatar-orange);">
                    <div class="analysis-card-header">
                        <span class="analysis-card-title">🎯 Career Field Alignment</span>
                        <span class="analysis-count-badge badge-orange">${QuizApp.escapeHtml(alignmentPct)}</span>
                    </div>
                    <h4 style="font-size:0.95rem; margin:0.4rem 0 0.2rem 0; color:var(--text-primary);">Strong Synergy</h4>
                    <p style="font-size:0.78rem; color:var(--text-secondary);">
                        Activities strongly reinforce target competencies for ${QuizApp.escapeHtml(state.user.targetCompanyIndustry || state.user.major || "tech industry")} roles.
                    </p>
                </div>
            </div>
        `;
    };

    // 2. Render Data Table: Most Popular Campus Organizations in Database (Unified Orange Styling)
    const renderCampusClubsTable = (tableData) => {
        const tbody = document.getElementById("clubs-table-body");
        if (!tbody) return;
        tbody.innerHTML = "";

        if (!tableData || tableData.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:1rem; color:var(--text-muted);">No club participation statistics available.</td></tr>`;
            return;
        }

        tableData.forEach((row) => {
            const tr = document.createElement("tr");

            tr.innerHTML = `
                <td><span class="club-rank-badge" style="border-color:rgba(245,158,11,0.4); color:var(--avatar-orange);">#${row.rank}</span></td>
                <td>
                    <strong style="color:var(--text-primary);">${QuizApp.escapeHtml(row.name)}</strong>
                    ${row.skills ? `<div style="font-size:0.72rem; color:var(--text-muted); margin-top:0.15rem;">Skills: ${QuizApp.escapeHtml(row.skills)}</div>` : ""}
                </td>
                <td><span class="analysis-count-badge badge-orange">${QuizApp.escapeHtml(row.category)}</span></td>
                <td><strong style="color:var(--text-primary);">${row.student_count}</strong> <span style="font-size:0.78rem; color:var(--text-muted);">students</span></td>
                <td><span style="font-size:0.8rem; font-weight:600; color:var(--avatar-orange);">${QuizApp.escapeHtml(row.relevance)}</span></td>
            `;
            tbody.appendChild(tr);
        });
    };

    // 3. Render Top 3 Alumni Involvement & Outlier Match Cards (Unified Orange)
    const renderTopAlumniMatches = (matches) => {
        const grid = document.getElementById("section-3-matches-grid");
        if (!grid) return;
        grid.innerHTML = "";

        if (!matches || matches.length === 0) {
            grid.innerHTML = `<p style="color:var(--text-muted); font-size:0.9rem;">No direct alumni matches found.</p>`;
            return;
        }

        matches.forEach((m, idx) => {
            const card = document.createElement("div");
            card.className = "alumni-card";

            let actsHtml = "";
            if (m.activities && Array.isArray(m.activities)) {
                actsHtml = m.activities
                    .map((a) => `<span class="highlight-tag" style="background:rgba(245, 158, 11, 0.12); color:#b45309; border:1px solid rgba(245, 158, 11, 0.35);">${QuizApp.escapeHtml(a.experience_name || a)}</span>`)
                    .join("");
            } else {
                actsHtml = '<span class="highlight-tag" style="background:rgba(245, 158, 11, 0.12); color:#b45309; border:1px solid rgba(245, 158, 11, 0.35);">ACM Student Chapter</span><span class="highlight-tag" style="background:rgba(245, 158, 11, 0.12); color:#b45309; border:1px solid rgba(245, 158, 11, 0.35);">Capture the Flag Team</span>';
            }

            const outlierStory = m.outlier_insight || m.outlier_story || "Leveraged high-ownership hackathon prototypes and leadership roles to stand out in recruiter screens.";

            card.innerHTML = `
                <div>
                    <div class="card-top-row">
                        <span class="alum-id-badge" style="background:rgba(245, 158, 11, 0.12); color:#b45309;">Alumni Match #${idx + 1}</span>
                        <span class="alum-salary-badge">${QuizApp.escapeHtml(m.first_job_annual_salary_usd || "$102,000")}</span>
                    </div>
                    <h4 class="alum-role-title">${QuizApp.escapeHtml(m.first_job_title || "Software Solutions Engineer")}</h4>
                    <p class="alum-employer">${QuizApp.escapeHtml(m.first_employer || "Booz Allen Hamilton")} &bull; <span style="color:var(--avatar-orange); font-weight:600;">${QuizApp.escapeHtml(state.user.major || "Computer Science")}</span></p>
                    <div style="background-color:var(--bg-inset); padding:0.75rem; border-radius:6px; margin: 0.6rem 0; border:1px solid var(--border-subtle);">
                        <span style="font-size:0.68rem; text-transform:uppercase; color:var(--text-muted); font-weight:700; letter-spacing:0.04em;">Outlier Trajectory Insight</span>
                        <p style="font-size:0.78rem; color:var(--text-secondary); margin-top:0.25rem; line-height:1.4;">
                            ${QuizApp.escapeHtml(outlierStory)}
                        </p>
                    </div>
                </div>
                <div class="alum-highlight-tags" style="margin-top:0.5rem;">
                    <span style="font-size:0.72rem; color:var(--text-muted); display:block; width:100%; margin-bottom:0.25rem; font-weight:600;">Key Involvements:</span>
                    ${actsHtml}
                </div>
            `;
            grid.appendChild(card);
        });
    };

    // Proceed to Section 4 Button
    const btnNext = document.getElementById("btn-next-to-section-4");
    if (btnNext) {
        btnNext.addEventListener("click", () => {
            QuizApp.stopAllSpeech();
            QuizApp.navigateWithTransition("/loading?next=4");
        });
    }

    QuizApp.bindVoiceReplayListeners(3);
});
