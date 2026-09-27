/**
 * Section 5 Controller: Synthesis, Final Blueprint Report, Ultimate Match & Action Timeline
 * Implements strict layout parity with Section 1, two separate text/audio events (Intro vs Report),
 * and strict audio cleanup to eliminate voice stuttering.
 */

// Global Audio Reference & Voice Constants
let currentAudio = null;
const SECTION_1_VOICE_ID = "ktHrlQPfUoEUQDP8xbm1";

document.addEventListener("DOMContentLoaded", async () => {
    const state = QuizApp.getQuizState();
    let sec5Data = QuizApp.getSectionData(5);

    // DOM Elements: Stage A (Intro) & Stage B (Report Dashboard)
    const introStage = document.getElementById("section-intro-stage");
    const questionsStage = document.getElementById("section-questions-stage");
    const btnStartQuestions = document.getElementById("btn-start-section-questions");
    const introReplayBtn = document.getElementById("intro-replay-voice-btn");
    const thoughtReplayBtn = document.getElementById("voice-replay-btn");
    const thoughtBubbleText = document.getElementById("thought-bubble-text");
    const introText = document.getElementById("advisor-intro-message")?.textContent?.trim() || "";

    let speechRequestId = 0;
    let voiceBlocked = false;

    // Strict Audio Cleanup: Prevents overlapping / stuttering voices
    const stopAudio = () => {
        if (currentAudio) {
            try {
                currentAudio.pause();
                currentAudio.currentTime = 0;
            } catch (_e) { }
            currentAudio = null;
        }
        QuizApp.stopAllSpeech();
    };

    // Play voice via ElevenLabs API strictly using Section 1 Voice ID
    const playElevenLabsVoice = async (text) => {
        const message = String(text || "").trim();
        if (!message) return;

        const requestId = ++speechRequestId;
        stopAudio();
        QuizApp.avatarSayTextOnly(message, 1);

        if (!voiceBlocked) {
            try {
                const response = await fetch("/api/section1-voice", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        text: message,
                        voice_id: SECTION_1_VOICE_ID,
                    }),
                });
                if (requestId !== speechRequestId) return;

                if (response.status === 402) {
                    const data = await response.json();
                    voiceBlocked = true;
                    console.warn(data.error || "Voice unavailable on plan.");
                } else if (response.ok) {
                    const data = await response.json();
                    if (data.audio) {
                        await QuizApp.playBase64Audio(data.audio);
                        return;
                    }
                }
            } catch (e) {
                console.warn("Voice playback failed:", e);
            }
        }

        if (requestId === speechRequestId) {
            await QuizApp.speakWebSpeech(message, 1);
        }
    };

    // =========================================================================
    // EVENT A: INTRO SCREEN (Hardcoded Text & Audio)
    // =========================================================================
    const playIntroVoice = () => {
        playElevenLabsVoice(introText);
    };

    // Start the final advisor's intro speech as soon as the page is initialized.
    playIntroVoice();

    if (introReplayBtn) {
        introReplayBtn.addEventListener("click", () => {
            playIntroVoice();
        });
    }

    // =========================================================================
    // EVENT B: REPORT DASHBOARD TRANSITION & DYNAMIC GEMINI SYNTHESIS
    // =========================================================================
    const triggerReportScreen = async () => {
        // 1. Strict audio cleanup before transition
        stopAudio();

        // 2. Switch Stage A -> Stage B with centered layout below avatar
        if (introStage) {
            introStage.remove();
        }
        if (questionsStage) {
            questionsStage.hidden = false;
            questionsStage.removeAttribute("hidden");
            questionsStage.style.display = "block";
            document.querySelector(".page-wrapper")?.classList.remove("section1-immersive");
            document.querySelector(".page-wrapper")?.classList.add("section5-blueprint-view");
            window.scrollTo({ top: 0, behavior: "smooth" });
        }

        // 3. Render cached data or fetch live from /api/generate-report
        if (!sec5Data || !Array.isArray(sec5Data.timeline_steps) || sec5Data.timeline_steps.length === 0) {
            QuizApp.avatarSayTextOnly("Analyzing your complete multi-dimensional profile against historical alumni benchmarks...", 1);
            try {
                const res = await fetch("/api/generate-report", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        section_name: "final_report",
                        voice_id: SECTION_1_VOICE_ID,
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

        // 4. Render UI components
        renderConciseDashboard(sec5Data);
        renderUltimateMatch(sec5Data);
        renderTimeline(sec5Data);

        // 5. Update thought bubble with dynamically generated Gemini text & play voice
        if (sec5Data && sec5Data.text) {
            QuizApp.avatarSayTextOnly(sec5Data.text, 1);
            if (sec5Data.audio) {
                const played = await QuizApp.playBase64Audio(sec5Data.audio);
                if (!played) {
                    await QuizApp.speakWebSpeech(sec5Data.text, 1);
                }
            } else {
                playElevenLabsVoice(sec5Data.text);
            }
        }
    };

    if (btnStartQuestions) {
        btnStartQuestions.addEventListener("click", () => {
            triggerReportScreen();
        });
    }

    // Replay button in Stage B thought bubble (Replays dynamic Gemini report voice)
    if (thoughtReplayBtn) {
        thoughtReplayBtn.addEventListener("click", () => {
            if (sec5Data && sec5Data.audio) {
                stopAudio();
                QuizApp.playBase64Audio(sec5Data.audio);
            } else {
                const text = thoughtBubbleText ? thoughtBubbleText.textContent.trim() : "";
                if (text) {
                    playElevenLabsVoice(text);
                }
            }
        });
    }

    // Helper: Generate recommended campus opportunities based on major and target industry
    const getTargetedClubRecommendations = (major, industry) => {
        const ind = (industry || "").toLowerCase();
        const maj = (major || "").toLowerCase();

        if (ind.includes("cyber") || maj.includes("cyber")) {
            return ["Retriever Cyber Club", "Capture the Flag (CTF) Team"];
        }
        if (ind.includes("data") || ind.includes("finance") || maj.includes("data")) {
            return ["Data Science Collective", "ACM Student Chapter"];
        }
        if (ind.includes("defense") || maj.includes("engineering")) {
            return ["Retriever Robotics", "IEEE Student Branch"];
        }
        return ["Association for Computing Machinery Student Chapter", "Open Source Society"];
    };

    // Helper: Generate recommended career next steps
    const getCareerRecommendations = (classYear, industry, skills) => {
        const isUnderclass = classYear === "Freshman" || classYear === "Sophomore";
        const ind = industry || "Software Products";

        if (isUnderclass) {
            return [
                `Target on-campus IT or undergraduate lab research to build hands-on credentials in ${ind}.`,
                `Publish a public GitHub repository showcasing core project competencies before sophomore summer.`,
            ];
        } else {
            return [
                `Submit 25+ targeted applications during the Fall recruiting cycle for top employers in ${ind}.`,
                `Complete structured systems design and technical interview sprints to target $105,000+ offers.`,
            ];
        }
    };

    // 1. Render Concise Dashboard (4 Bulleted Sections)
    const renderConciseDashboard = (data) => {
        const user = state.user || {};
        const classAnalysis = (data && data.class_analysis) || (state.sections[2] && state.sections[2].class_analysis) || {};
        const invAnalysis = (data && data.involvement_analysis) || (state.sections[3] && state.sections[3].involvement_analysis) || {};

        // SECTION A: BASIC INFORMATION
        const basicList = document.getElementById("section5-basic-info-list");
        if (basicList) {
            const studentName = user.name ? user.name : "Undergraduate Student";
            const classStanding = user.classYear || "Freshman";
            const major = user.major || "Computer Science";
            const track = user.majorTrack && user.majorTrack !== "Not Applicable" ? user.majorTrack : "General Curriculum";
            const minor = user.minor && user.minor !== "None" ? user.minor : "None declared";
            const gpa = user.gpa ? `${user.gpa} GPA` : "3.60 GPA";
            const credits = user.creditsCompleted ? `${user.creditsCompleted} Credits Completed` : "15 Credits Completed";
            const industry = user.targetCompanyIndustry || "Software Products";
            const careerGoal = user.careerGoals || "Software Engineering";
            const salary = user.targetSalary || "$105,000";
            const location = user.targetLocation || "Mid-Atlantic / Remote";

            basicList.innerHTML = `
                <li><strong>Student &amp; Standing:</strong> ${QuizApp.escapeHtml(studentName)} &bull; ${QuizApp.escapeHtml(classStanding)}</li>
                <li><strong>Major &amp; Specialization:</strong> ${QuizApp.escapeHtml(major)} (${QuizApp.escapeHtml(track)})</li>
                <li><strong>Academic Metrics:</strong> ${QuizApp.escapeHtml(gpa)} &bull; ${QuizApp.escapeHtml(credits)}</li>
                <li><strong>Minor / Focus:</strong> ${QuizApp.escapeHtml(minor)}</li>
                <li><strong>Target Industry &amp; Role:</strong> ${QuizApp.escapeHtml(industry)} &bull; ${QuizApp.escapeHtml(careerGoal)}</li>
                <li><strong>Target Compensation:</strong> ${QuizApp.escapeHtml(salary)} &bull; ${QuizApp.escapeHtml(location)}</li>
            `;
        }

        // SECTION B: REMAINING COURSEWORK (CONDITIONAL)
        // If missing courses array is empty, do NOT render this HTML container in the DOM at all!
        const remainingContainer = document.getElementById("section5-remaining-courses-container");
        const remainingList = document.getElementById("section5-remaining-courses-list");
        const missingCourses = (classAnalysis && Array.isArray(classAnalysis.missing_required))
            ? classAnalysis.missing_required
            : [];

        const isExplicitlyCleared = user.noRequiredCourses === true;

        if (isExplicitlyCleared || missingCourses.length === 0) {
            if (remainingContainer) {
                remainingContainer.remove();
            }
        } else if (remainingList) {
            remainingList.innerHTML = "";
            missingCourses.slice(0, 6).forEach((c) => {
                const li = document.createElement("li");
                li.innerHTML = `<strong>${QuizApp.escapeHtml(c.course_id)}:</strong> ${QuizApp.escapeHtml(c.course_title)} (${QuizApp.escapeHtml(c.credits || 3)} credits)`;
                remainingList.appendChild(li);
            });
            if (missingCourses.length > 6) {
                const extraLi = document.createElement("li");
                extraLi.innerHTML = `<em>+ ${missingCourses.length - 6} additional major elective requirements</em>`;
                remainingList.appendChild(extraLi);
            }
        }

        // SECTION C: CAMPUS INVOLVEMENT
        const invList = document.getElementById("section5-campus-involvement-list");
        if (invList) {
            const allActivities = []
                .concat(user.selectedActivities || [])
                .concat(user.otherOrganizations || [])
                .concat(user.customActivity ? [user.customActivity] : [])
                .filter(Boolean);

            const activitiesStr = allActivities.length > 0
                ? allActivities.join(", ")
                : (user.noCurrentActivities ? "Currently exploring student organizations" : "ACM Student Chapter, Open Source Society");

            const leadershipSummary = invAnalysis.leadership_factor || "Active Technical Contributor";
            const outlierNote = invAnalysis.outlier_status && invAnalysis.outlier_status !== "Standard"
                ? ` &bull; ${invAnalysis.outlier_status}`
                : "";

            const recommendations = getTargetedClubRecommendations(user.major, user.targetCompanyIndustry);

            invList.innerHTML = `
                <li><strong>Current Engagement:</strong> ${QuizApp.escapeHtml(activitiesStr)}</li>
                <li><strong>Leadership Assessment:</strong> ${QuizApp.escapeHtml(leadershipSummary)}${QuizApp.escapeHtml(outlierNote)}</li>
                <li><strong>Recommended Opportunities:</strong> Join <strong>${QuizApp.escapeHtml(recommendations[0])}</strong> and <strong>${QuizApp.escapeHtml(recommendations[1])}</strong> for portfolio growth.</li>
            `;
        }

        // SECTION D: CAREER EXPERIENCE
        const expList = document.getElementById("section5-career-experience-list");
        if (expList) {
            const skillsStr = user.skills && user.skills.trim()
                ? user.skills.trim()
                : "Python, Git, Data Structures, Relational Databases";

            const internStr = user.internships && user.internships.trim()
                ? user.internships.trim()
                : (user.noPriorExperience ? "Actively seeking first industry placement / co-op" : "Targeting summer internship opportunities");

            const careerRecs = getCareerRecommendations(user.classYear, user.targetCompanyIndustry, user.skills);

            expList.innerHTML = `
                <li><strong>Technical Competencies:</strong> ${QuizApp.escapeHtml(skillsStr)}</li>
                <li><strong>Work &amp; Internship History:</strong> ${QuizApp.escapeHtml(internStr)}</li>
                <li><strong>Strategic Next Steps:</strong> ${QuizApp.escapeHtml(careerRecs[0])}</li>
                <li><strong>Recruiting Milestone:</strong> ${QuizApp.escapeHtml(careerRecs[1])}</li>
            `;
        }
    };

    // 2. Render The Ultimate Match (1 Single Absolute Best Match)
    const renderUltimateMatch = (data) => {
        const container = document.getElementById("section5-ultimate-match-card");
        if (!container || !data) return;

        const ultimate = data.ultimate_match || (data.matches && data.matches[0]) || {
            first_employer: "Amazon Web Services",
            first_job_title: "Software Development Engineer",
            first_job_annual_salary_usd: "$114,000",
            first_employer_industry: "Software Products",
            major: state.user.major || "Computer Science",
            track: state.user.majorTrack || "Software Engineering",
            final_gpa: 3.84,
            time_to_degree_years: "4.0 Years",
            internships: "2 Summer Internships",
            key_involvements: ["ACM Student Chapter", "Open Source Society"],
            key_courses: ["CMSC 441 (Algorithms)", "CMSC 471 (AI)", "CMSC 447 (Software Eng)"],
            strategic_takeaway: "Maintained a strong academic record in core systems, led collaborative student chapter builds, completed 2 summer internships, and locked in a top-tier return offer.",
            match_confidence: "98% Pathway Synergy",
        };

        const involvementsList = Array.isArray(ultimate.key_involvements)
            ? ultimate.key_involvements.join(", ")
            : "ACM Student Chapter, Open Source Society";

        const coursesList = Array.isArray(ultimate.key_courses)
            ? ultimate.key_courses.join(", ")
            : "CMSC 441, CMSC 471, CMSC 447";

        container.innerHTML = `
            <div class="ultimate-match-top">
                <div class="ultimate-badge-group">
                    <span class="alum-id-badge" style="background:var(--accent-gold-subtle); color:var(--accent-gold); font-weight:700;">
                        🌟 Ultimate Blueprint Match
                    </span>
                    <span class="alum-salary-badge" style="font-size:0.85rem;">
                        ${QuizApp.escapeHtml(ultimate.first_job_annual_salary_usd || "$115,000")} Starting Offer
                    </span>
                </div>
                <span class="highlight-tag" style="color:var(--accent-emerald); font-weight:600;">
                    ${QuizApp.escapeHtml(ultimate.match_confidence || "98% Pathway Synergy")}
                </span>
            </div>

            <h4 class="ultimate-role-heading">
                ${QuizApp.escapeHtml(ultimate.first_job_title || "Software Engineer")} at ${QuizApp.escapeHtml(ultimate.first_employer || "Amazon Web Services")}
            </h4>
            <p class="ultimate-employer-sub">
                ${QuizApp.escapeHtml(ultimate.first_employer_industry || "Software Products")} &bull; ${QuizApp.escapeHtml(ultimate.major || state.user.major)} (${QuizApp.escapeHtml(ultimate.track || "Standard Track")})
            </p>

            <div class="ultimate-stats-grid">
                <div class="ultimate-stat-block">
                    <span class="ultimate-stat-label">Graduation Pacing</span>
                    <span class="ultimate-stat-value">${QuizApp.escapeHtml(ultimate.time_to_degree_years || "4.0 Years")}</span>
                </div>
                <div class="ultimate-stat-block">
                    <span class="ultimate-stat-label">Academic Benchmark</span>
                    <span class="ultimate-stat-value">${QuizApp.escapeHtml(ultimate.final_gpa || "3.85")} Final GPA</span>
                </div>
                <div class="ultimate-stat-block">
                    <span class="ultimate-stat-label">Experience Ladder</span>
                    <span class="ultimate-stat-value">${QuizApp.escapeHtml(ultimate.internships || "2 Internships")}</span>
                </div>
                <div class="ultimate-stat-block">
                    <span class="ultimate-stat-label">Key Involvements</span>
                    <span class="ultimate-stat-value" style="font-size:0.82rem;">${QuizApp.escapeHtml(involvementsList)}</span>
                </div>
                <div class="ultimate-stat-block" style="grid-column: 1 / -1;">
                    <span class="ultimate-stat-label">Critical Course Sequence</span>
                    <span class="ultimate-stat-value" style="font-size:0.82rem; color:var(--accent-gold);">${QuizApp.escapeHtml(coursesList)}</span>
                </div>
            </div>

            <div class="ultimate-takeaway-box">
                <strong>Strategic Takeaway:</strong> "${QuizApp.escapeHtml(ultimate.strategic_takeaway || "Leveraged structured coursework, student organization leadership, and early internship applications to command premium compensation upon graduation.")}"
            </div>
        `;
    };

    // 3. Render Next Steps Horizontal Timeline
    const renderTimeline = (data) => {
        const track = document.getElementById("section5-timeline-track");
        if (!track) return;

        const steps = data?.timeline_steps;

        track.innerHTML = "";
        if (!Array.isArray(steps) || steps.length === 0) {
            track.textContent = "Your personalized next steps will appear once your profile is complete.";
            return;
        }
        steps.forEach((step) => {
            const node = document.createElement("div");
            node.className = "timeline-node";
            node.innerHTML = `
                <div class="timeline-timeframe-tag">${QuizApp.escapeHtml(step.timeframe || "Action Item")}</div>
                <div class="timeline-marker"></div>
                <div class="timeline-node-body">
                    <div class="timeline-node-title">${QuizApp.escapeHtml(step.title || "Step")}</div>
                    <div class="timeline-node-desc">${QuizApp.escapeHtml(step.description || "")}</div>
                    <span class="timeline-node-badge">${QuizApp.escapeHtml(step.badge || "Priority")}</span>
                </div>
            `;
            track.appendChild(node);
        });
    };

    // Sophisticated Print Dossier Handler: Opens dedicated formal dossier in new tab
    const handlePrintDossier = () => {
        stopAudio();
        const fullState = QuizApp.getQuizState() || {};

        // Send clean user payload to prevent 413 Payload Too Large
        const cleanPayload = {
            user: fullState.user || {},
        };

        const form = document.createElement("form");
        form.method = "POST";
        form.action = "/print-report";
        form.target = "_blank";
        form.style.display = "none";

        const input = document.createElement("input");
        input.type = "hidden";
        input.name = "state_json";
        input.value = JSON.stringify(cleanPayload);

        form.appendChild(input);
        document.body.appendChild(form);
        form.submit();
        form.remove();
    };

    const btnPrintBottom = document.getElementById("btn-print-report-bottom");

    if (btnPrintBottom) {
        btnPrintBottom.addEventListener("click", handlePrintDossier);
    }

    // Restart Quiz Button
    const btnRestart = document.getElementById("btn-restart-quiz");
    if (btnRestart) {
        btnRestart.addEventListener("click", () => {
            stopAudio();
            if (confirm("Start a new student career assessment?")) {
                QuizApp.resetQuizState();
                QuizApp.navigateWithTransition("/section/1");
            }
        });
    }

    QuizApp.bindVoiceReplayListeners();
});
