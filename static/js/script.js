document.addEventListener("DOMContentLoaded", () => {
    // =========================================================================
    // STATE MANAGEMENT
    // =========================================================================
    const state = {
        currentScreen: 1,
        activeUserId: null,
        user: {
            classYear: "",
            major: "",
            majorTrack: "",
            minor: "",
            name: "",
            gpa: "",
            creditsCompleted: "",
            targetCompanyIndustry: "",
            targetSalary: "",
            targetLocation: "",
            expectedGradYear: "",
            careerGoals: "",
            selectedActivities: [],
            customActivity: "",
            skills: "",
            internships: "",
            checkedCourses: [],
        },
        sectionData: {
            1: null,
            2: null,
            3: null,
            4: null,
            5: null,
        },
        currentAudio: null,
        lastReportText: "",
        lastReportBase64Audio: "",
    };

    // =========================================================================
    // UNLOAD / REFRESH SESSION CLEANUP (VisibilityChange Beacon)
    // =========================================================================
    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden" && state.activeUserId) {
            const payload = JSON.stringify({ user_id: state.activeUserId });
            const blob = new Blob([payload], { type: "application/json" });
            const beaconSent = navigator.sendBeacon("/api/cleanup-user", blob);
            if (!beaconSent) {
                fetch("/api/cleanup-user", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: payload,
                    keepalive: true,
                }).catch(() => { });
            }
        }
    });

    window.addEventListener("pagehide", () => {
        if (state.activeUserId) {
            const payload = JSON.stringify({ user_id: state.activeUserId });
            const blob = new Blob([payload], { type: "application/json" });
            const beaconSent = navigator.sendBeacon("/api/cleanup-user", blob);
            if (!beaconSent) {
                fetch("/api/cleanup-user", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: payload,
                    keepalive: true,
                }).catch(() => { });
            }
        }
    });

    // Cached academic options
    let academicOptions = {
        majors: ["Computer Science", "Data Science", "Information Systems", "Cybersecurity", "Computer Engineering"],
        tracks: ["Artificial Intelligence and Machine Learning", "Cybersecurity", "Data Science", "General", "Software Engineering"],
        minors: ["Business Administration", "Cybersecurity", "Data Science", "Economics", "Mathematics", "Statistics"],
        tracks_by_major: {},
    };

    // DOM Elements
    const activeAvatarCircle = document.getElementById("active-avatar-circle");
    const avatarGlyph = document.getElementById("avatar-glyph");
    const avatarNumberBadge = document.getElementById("avatar-number-badge");
    const avatarNameTag = document.getElementById("avatar-name-tag");
    const thoughtPersonaTitle = document.getElementById("thought-persona-title");
    const thoughtBubbleText = document.getElementById("thought-bubble-text");
    const audioWaveAnim = document.getElementById("audio-wave-anim");
    const voiceReplayBtn = document.getElementById("voice-replay-btn");
    const voiceBtnLabel = document.getElementById("voice-btn-label");

    const progressLabel = document.getElementById("progress-label");
    const progressFill = document.getElementById("progress-fill");
    const wizardError = document.getElementById("wizard-error");

    const majorSelect = document.getElementById("student-major");
    const trackSelect = document.getElementById("student-major-track");
    const minorSelect = document.getElementById("student-minor");

    // =========================================================================
    // AUDIO ENGINE (Strictly for Reports & Explicit Replay)
    // =========================================================================

    const advisorAudioEl = document.getElementById("advisor-audio-element");
    let currentBlobUrl = null;
    let audioContextUnlocked = false;

    // Convert Base64 string to an audio/mpeg Blob
    const base64ToBlob = (base64, mimeType = "audio/mpeg") => {
        const cleanBase64 = base64.replace(/^data:audio\/\w+;base64,/, "");
        const byteCharacters = atob(cleanBase64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        return new Blob([byteArray], { type: mimeType });
    };

    // Prime/Unlock AudioContext and HTML5 Audio on user interactions
    const unlockAudio = () => {
        if (!audioContextUnlocked) {
            try {
                const AudioCtx = window.AudioContext || window.webkitAudioContext;
                if (AudioCtx) {
                    const ctx = new AudioCtx();
                    if (ctx.state === "suspended") ctx.resume();
                }
            } catch (_e) { }
            if (advisorAudioEl && !advisorAudioEl.dataset.unlocked) {
                advisorAudioEl.play().catch(() => { });
                advisorAudioEl.pause();
                advisorAudioEl.dataset.unlocked = "true";
            }
            audioContextUnlocked = true;
        }
    };
    document.addEventListener("click", unlockAudio);
    document.addEventListener("keydown", unlockAudio);

    const stopAllSpeech = () => {
        if (state.currentAudio) {
            try {
                state.currentAudio.pause();
                state.currentAudio.currentTime = 0;
            } catch (_e) { }
            state.currentAudio = null;
        }
        if (advisorAudioEl) {
            try {
                advisorAudioEl.pause();
                advisorAudioEl.currentTime = 0;
            } catch (_e) { }
        }
        if (window.speechSynthesis) {
            try {
                window.speechSynthesis.cancel();
            } catch (_e) { }
        }
        if (audioWaveAnim) audioWaveAnim.hidden = true;
        if (activeAvatarCircle) {
            activeAvatarCircle.classList.remove("speaking");
            activeAvatarCircle.classList.remove("pulse-prompt");
        }
        if (voiceBtnLabel) voiceBtnLabel.textContent = "Play Voice";
        if (voiceReplayBtn) voiceReplayBtn.classList.remove("pulse-prompt");
    };

    const speakViaWebSpeech = (text, avatarNum = 1) => {
        if (!window.speechSynthesis || !text) return;
        try {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(text);

            // Distinct pitch and rate per avatar persona
            if (avatarNum === 2) {
                utterance.pitch = 1.15;
                utterance.rate = 1.02;
            } else if (avatarNum === 3) {
                utterance.pitch = 1.22;
                utterance.rate = 1.08;
            } else if (avatarNum === 4) {
                utterance.pitch = 0.92;
                utterance.rate = 1.0;
            } else {
                utterance.pitch = 1.0;
                utterance.rate = 1.04;
            }

            const voices = window.speechSynthesis.getVoices();
            if (voices && voices.length > 0) {
                const preferredVoice = voices.find((v) =>
                    v.lang.startsWith("en") &&
                    (v.name.includes("Natural") || v.name.includes("Google") || v.name.includes("Samantha") || v.name.includes("Daniel") || v.name.includes("Alex"))
                );
                if (preferredVoice) utterance.voice = preferredVoice;
            }

            utterance.onstart = () => {
                if (audioWaveAnim) audioWaveAnim.hidden = false;
                if (activeAvatarCircle) activeAvatarCircle.classList.add("speaking");
                if (voiceBtnLabel) voiceBtnLabel.textContent = "Speaking...";
                if (voiceReplayBtn) voiceReplayBtn.classList.remove("pulse-prompt");
            };

            utterance.onend = () => {
                if (audioWaveAnim) audioWaveAnim.hidden = true;
                if (activeAvatarCircle) activeAvatarCircle.classList.remove("speaking");
                if (voiceBtnLabel) voiceBtnLabel.textContent = "Replay Voice";
            };

            utterance.onerror = () => {
                if (audioWaveAnim) audioWaveAnim.hidden = true;
                if (activeAvatarCircle) activeAvatarCircle.classList.remove("speaking");
                if (voiceBtnLabel) voiceBtnLabel.textContent = "Play Voice";
            };

            window.speechSynthesis.speak(utterance);
        } catch (err) {
            console.warn("Speech synthesis error:", err);
        }
    };

    const playReportAudio = (text, base64Audio = "", avatarNum = 1) => {
        stopAllSpeech();
        state.lastReportText = text;
        state.lastReportBase64Audio = base64Audio;

        if (base64Audio) {
            try {
                if (currentBlobUrl) {
                    URL.revokeObjectURL(currentBlobUrl);
                    currentBlobUrl = null;
                }
                const blob = base64ToBlob(base64Audio, "audio/mpeg");
                currentBlobUrl = URL.createObjectURL(blob);

                const audioEl = advisorAudioEl || new Audio();
                audioEl.src = currentBlobUrl;
                audioEl.load();

                audioEl.onplay = () => {
                    if (audioWaveAnim) audioWaveAnim.hidden = false;
                    if (activeAvatarCircle) activeAvatarCircle.classList.add("speaking");
                    if (voiceBtnLabel) voiceBtnLabel.textContent = "Speaking...";
                    if (voiceReplayBtn) voiceReplayBtn.classList.remove("pulse-prompt");
                };

                audioEl.onended = () => {
                    if (audioWaveAnim) audioWaveAnim.hidden = true;
                    if (activeAvatarCircle) activeAvatarCircle.classList.remove("speaking");
                    if (voiceBtnLabel) voiceBtnLabel.textContent = "Replay Voice";
                };

                audioEl.onpause = () => {
                    if (audioWaveAnim) audioWaveAnim.hidden = true;
                    if (activeAvatarCircle) activeAvatarCircle.classList.remove("speaking");
                    if (voiceBtnLabel && voiceBtnLabel.textContent === "Speaking...") {
                        voiceBtnLabel.textContent = "Replay Voice";
                    }
                };

                audioEl.onerror = (e) => {
                    console.warn("HTML5 audio playback error, falling back to Web Speech:", e);
                    speakViaWebSpeech(text, avatarNum);
                };

                state.currentAudio = audioEl;

                const playPromise = audioEl.play();
                if (playPromise !== undefined) {
                    playPromise.catch((err) => {
                        console.log("Autoplay was prevented by browser:", err);
                        // Make the voice button pulse so user can click to hear audio
                        if (voiceBtnLabel) voiceBtnLabel.textContent = "Play Voice";
                        if (voiceReplayBtn) voiceReplayBtn.classList.add("pulse-prompt");
                        // Fallback attempt with web speech
                        speakViaWebSpeech(text, avatarNum);
                    });
                }
                return;
            } catch (err) {
                console.warn("Audio initialization error:", err);
            }
        }

        // Fallback to Web Speech
        speakViaWebSpeech(text, avatarNum);
    };

    // =========================================================================
    // AVATAR UI & THOUGHT BUBBLE CONTROLLERS
    // =========================================================================

    const avatarConfigs = {
        1: {
            className: "avatar-1-blue",
            glyph: "🎓",
            numberBadge: "A1",
            nameTag: "Avatar 1 (Blue)",
            persona: "Academic Foundations Advisor",
        },
        2: {
            className: "avatar-2-green",
            glyph: "📚",
            numberBadge: "A2",
            nameTag: "Avatar 2 (Green)",
            persona: "Course Advising Specialist",
        },
        3: {
            className: "avatar-3-orange",
            glyph: "⚡",
            numberBadge: "A3",
            nameTag: "Avatar 3 (Orange)",
            persona: "Student Engagement Mentor",
        },
        4: {
            className: "avatar-4-purple",
            glyph: "💼",
            numberBadge: "A4",
            nameTag: "Avatar 4 (Purple)",
            persona: "Career & Industry Strategist",
        },
        5: {
            className: "avatar-1-blue",
            glyph: "🏆",
            numberBadge: "A1",
            nameTag: "Avatar 1 (Blue)",
            persona: "Executive Pathway Director",
        },
    };

    const setAvatar = (avatarNum) => {
        const config = avatarConfigs[avatarNum] || avatarConfigs[1];
        if (activeAvatarCircle) {
            activeAvatarCircle.className = `avatar-circle ${config.className}`;
        }
        if (avatarGlyph) avatarGlyph.textContent = config.glyph;
        if (avatarNumberBadge) avatarNumberBadge.textContent = config.numberBadge;
        if (avatarNameTag) avatarNameTag.textContent = config.nameTag;
        if (thoughtPersonaTitle) thoughtPersonaTitle.textContent = config.persona;

        // Update 4-Avatar dock indicators
        document.querySelectorAll(".dock-avatar-indicator").forEach((el) => {
            const avatarTarget = el.getAttribute("data-avatar");
            const expectedAvatar = (avatarNum === 5) ? "1" : String(avatarNum);
            el.classList.toggle("active", avatarTarget === expectedAvatar);
        });
    };

    /**
     * OPENING PROMPT / REPORT WITH VOICE:
     * Plays voice audio automatically for the first prompt when arriving on each page/screen.
     */
    const avatarSpeakPrompt = (text, avatarNum = 1, base64Audio = "") => {
        setAvatar(avatarNum);
        if (thoughtBubbleText) {
            const formatted = text.replace(
                /\b(Freshman|Sophomore|Junior|Senior|Computer Science|Data Science|Information Systems|Cybersecurity|Computer Engineering|GPA|Internships|Tiger Data|Algorithms|Electives|Starting Salary|Alumni)\b/gi,
                "<strong>$1</strong>"
            );
            thoughtBubbleText.innerHTML = formatted;
        }
        playReportAudio(text, base64Audio, avatarNum);
    };

    /**
     * TEXT-ONLY REACTION: Used for all subsequent real-time input interactions across every box & input.
     * Voice is NOT played on instant input reactions.
     */
    const avatarSayTextOnly = (text, avatarNum = 1) => {
        stopAllSpeech();
        setAvatar(avatarNum);
        if (thoughtBubbleText) {
            const formatted = text.replace(
                /\b(Freshman|Sophomore|Junior|Senior|Computer Science|Data Science|Information Systems|Cybersecurity|Computer Engineering|GPA|Internships|Tiger Data|Algorithms|Electives|Python|AWS|SQL|PostgreSQL|Docker|Machine Learning|Linux|Git)\b/gi,
                "<strong>$1</strong>"
            );
            thoughtBubbleText.innerHTML = formatted;
        }
        if (voiceBtnLabel) voiceBtnLabel.textContent = "Play Voice";
    };

    /**
     * REPORT REACTION: Used strictly when section reports are generated.
     * Updates thought bubble text AND triggers ElevenLabs TTS voice playback!
     */
    const avatarSayReportWithVoice = (text, avatarNum = 1, base64Audio = "") => {
        setAvatar(avatarNum);
        if (thoughtBubbleText) {
            const formatted = text.replace(
                /\b(Freshman|Sophomore|Junior|Senior|Computer Science|Data Science|Information Systems|Cybersecurity|GPA|Internships|Tiger Data|Algorithms|Electives|Starting Salary|Alumni)\b/gi,
                "<strong>$1</strong>"
            );
            thoughtBubbleText.innerHTML = formatted;
        }
        playReportAudio(text, base64Audio, avatarNum);
    };

    // =========================================================================
    // OPENING PROMPTS FOR EACH PAGE (VOICE AUTOPLAYS ON FIRST PROMPT)
    // =========================================================================

    const SCREEN_INTRO_PROMPTS = {
        1: {
            text: "Welcome to your personalized career & academic advising session! Select your college standing to get started.",
            avatar: 1,
        },
        2: {
            text: "Select your primary Major and concentration track so we can align your courses against historical transcripts.",
            avatar: 1,
        },
        3: {
            text: "What is your current cumulative GPA and completed credits? This helps calibrate your graduation pacing.",
            avatar: 1,
        },
        4: {
            text: "Now, define your target industry, compensation, and career goals so we can query Tiger Data for your baseline matches.",
            avatar: 1,
        },
        5: {
            text: "Avatar 2 is reviewing your major course sequences and high-yield electives against top-earning alumni.",
            avatar: 2,
        },
        6: {
            text: "Avatar 3 is matching your credits completed to high-impact campus organizations and creative activities.",
            avatar: 3,
        },
        7: {
            text: "Avatar 4 here! Tell me about the technical skills and frameworks you have built or are learning.",
            avatar: 4,
        },
        8: {
            text: "Next, describe your internships, co-ops, research roles, or campus jobs to benchmark against industry hiring.",
            avatar: 4,
        },
        9: {
            text: "Avatar 1 is synthesizing your coursework, campus involvement, and professional skills into your comprehensive report.",
            avatar: 1,
        },
    };

    // =========================================================================
    // HARDCODED INSTANT TEXT REACTIONS FOR EVERY SINGLE BOX AND INPUT
    // =========================================================================

    const HARDCODED_REACTIONS = {
        classYear: {
            Freshman: "Freshman selected.",
            Sophomore: "Sophomore selected.",
            Junior: "Junior selected.",
            Senior: "Senior selected.",
            "More than 4 years": "5th year or alum status selected.",
        },
        major: {
            "Computer Science": "Computer Science selected.",
            "Data Science": "Data Science selected.",
            "Information Systems": "Information Systems selected.",
            "Cybersecurity": "Cybersecurity selected.",
            "Computer Engineering": "Computer Engineering selected.",
        },
        track: (trackName) => {
            if (!trackName || trackName === "Not Applicable") {
                return "General track selected.";
            }
            return `${trackName} selected.`;
        },
        minor: (minorName) => {
            if (!minorName || minorName === "Not Applicable") {
                return "No minor selected.";
            }
            return `${minorName} minor selected.`;
        },
        name: (val) => {
            if (!val) return "Name field cleared.";
            return `${val} saved.`;
        },
        gpa: (val) => {
            const num = parseFloat(val) || 0;
            if (!val) return "GPA cleared.";
            return `GPA entered: ${num.toFixed(2)}.`;
        },
        credits: (val) => {
            const cr = parseInt(val, 10) || 0;
            if (!val) return "Credits cleared.";
            return `${cr} credits recorded.`;
        },
        targetCompanies: (val) => {
            if (!val) return "Industry field cleared.";
            return `Target industry set to ${val}.`;
        },
        salary: (val) => {
            if (!val) return "Salary field cleared.";
            return `Target salary set to ${val}.`;
        },
        location: (val) => {
            if (!val) return "Location field cleared.";
            return `Location set to ${val}.`;
        },
        gradYear: (val) => {
            if (!val) return "Graduation year cleared.";
            return `Graduation year set to ${val}.`;
        },
        careerGoals: (val) => {
            if (!val) return "Career goal cleared.";
            return `Career goal recorded: ${val}.`;
        },
        courseCheck: (courseId, courseTitle, isChecked) => {
            if (isChecked) {
                return `${courseId} marked as planned.`;
            }
            return `${courseId} removed from your plan.`;
        },
        activity: (name) => {
            if (!name) return "Activity cleared.";
            return `${name} selected.`;
        },
        customActivity: (val) => {
            if (!val) return "Custom activity cleared.";
            return `${val} saved to your activities.`;
        },
        skill: (name) => {
            if (!name) return "Skill cleared.";
            return `${name} added to your skills.`;
        },
        skillsInput: (val) => {
            if (!val) return "Skills field cleared.";
            return `Skills updated.`;
        },
        internshipsInput: (val) => {
            if (!val) return "Experience field cleared.";
            return `Experience updated.`;
        },
    };

    // =========================================================================
    // NAVIGATION & 1-QUESTION-PER-SCREEN PROGRESSION
    // =========================================================================

    const updateProgressDisplay = (screenNum) => {
        state.currentScreen = screenNum;
        const totalScreens = 9;
        const screenLabels = {
            1: "Step 1 of 9 • College Standing",
            2: "Step 2 of 9 • Academic Program",
            3: "Step 3 of 9 • GPA & Credit Progression",
            4: "Step 4 of 9 • Career Goals & Section 1 Report",
            5: "Step 5 of 9 • Section 2 Course Advising Report",
            6: "Step 6 of 9 • Section 3 Campus Involvement Report",
            7: "Step 7 of 9 • Section 4 Professional Skills",
            8: "Step 8 of 9 • Section 4 Internships & Experience Report",
            9: "Step 9 of 9 • Section 5 Comprehensive Final Report",
        };
        if (progressLabel) progressLabel.textContent = screenLabels[screenNum] || `Step ${screenNum} of ${totalScreens}`;
        if (progressFill) progressFill.style.width = `${Math.round((screenNum / totalScreens) * 100)}%`;
    };

    const goToScreen = (screenNum, shouldSpeakPrompt = true) => {
        updateProgressDisplay(screenNum);
        document.querySelectorAll(".interactive-screen").forEach((screen) => {
            const sNum = parseInt(screen.getAttribute("data-screen"), 10);
            if (sNum === screenNum) {
                screen.hidden = false;
                screen.classList.add("active");
            } else {
                screen.hidden = true;
                screen.classList.remove("active");
            }
        });
        window.scrollTo({ top: 0, behavior: "smooth" });

        if (shouldSpeakPrompt && SCREEN_INTRO_PROMPTS[screenNum]) {
            const intro = SCREEN_INTRO_PROMPTS[screenNum];
            avatarSpeakPrompt(intro.text, intro.avatar);
        }
    };

    const collectFormData = () => {
        state.user.name = document.getElementById("student-name")?.value.trim() || state.user.name;
        state.user.major = document.getElementById("student-major")?.value.trim() || state.user.major;
        state.user.majorTrack = document.getElementById("student-major-track")?.value.trim() || state.user.majorTrack;
        state.user.minor = document.getElementById("student-minor")?.value.trim() || state.user.minor;
        state.user.gpa = document.getElementById("student-gpa")?.value.trim() || state.user.gpa;
        state.user.creditsCompleted = parseInt(document.getElementById("student-credits")?.value, 10) || state.user.creditsCompleted;
        state.user.targetCompanyIndustry = document.getElementById("career-target-companies")?.value.trim() || state.user.targetCompanyIndustry;
        state.user.targetSalary = document.getElementById("career-expected-salary")?.value.trim() || state.user.targetSalary;
        state.user.targetLocation = document.getElementById("career-target-location")?.value.trim() || state.user.targetLocation;
        state.user.expectedGradYear = document.getElementById("expected-grad-year")?.value.trim() || state.user.expectedGradYear;
        state.user.careerGoals = document.getElementById("career-goals")?.value.trim() || state.user.careerGoals;
        state.user.skills = document.getElementById("user-skills-input")?.value.trim() || state.user.skills;
        state.user.internships = document.getElementById("user-internships-input")?.value.trim() || state.user.internships;
        state.user.customActivity = document.getElementById("custom-activity-input")?.value.trim() || state.user.customActivity;
        return state.user;
    };

    // =========================================================================
    // API REPORT PIPELINE (CALLED STRICTLY ON REPORT GENERATION)
    // =========================================================================

    const runReportPipeline = async (sectionName, sectionNum, avatarNum, spinnerEl, btnEl) => {
        collectFormData();
        if (spinnerEl) spinnerEl.hidden = false;
        if (btnEl) btnEl.disabled = true;
        clearError();

        try {
            const response = await fetch("/api/generate-report", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    section_name: sectionName,
                    user_data: state.user,
                }),
            });

            if (!response.ok) {
                throw new Error(`Server returned HTTP ${response.status}`);
            }

            const data = await response.json();
            state.sectionData[sectionNum] = data;

            // Update Avatar and Thought Bubble with Gemini Advice + ElevenLabs Audio
            avatarSayReportWithVoice(data.text, avatarNum, data.audio);

            // Render Tiger Data Matches
            if (sectionNum === 1) renderSection1Matches(data.matches);
            else if (sectionNum === 2) renderSection2Matches(data.matches);
            else if (sectionNum === 3) renderSection3Matches(data.matches);
            else if (sectionNum === 4) renderSection4Matches(data.matches);
            else if (sectionNum === 5) renderSection5Matches(data.matches);

            return data;
        } catch (err) {
            console.error(`Pipeline error on ${sectionName}:`, err);
            showError(`Unable to complete advisory analysis. ${err.message}`);
        } finally {
            if (spinnerEl) spinnerEl.hidden = true;
            if (btnEl) btnEl.disabled = false;
        }
    };

    // =========================================================================
    // TIGER DATA MATCH RENDERERS
    // =========================================================================

    const renderSection1Matches = (matches) => {
        const grid = document.getElementById("section-1-matches-grid");
        const container = document.getElementById("section-1-matches-container");
        if (!grid || !container) return;

        grid.innerHTML = "";
        (matches || []).forEach((m, idx) => {
            const card = document.createElement("div");
            card.className = "alumni-card";
            card.innerHTML = `
                <div>
                    <div class="card-top-row">
                        <span class="alum-id-badge">${escapeHtml(m.campus_id || `ALUM-${1000 + idx}`)}</span>
                        <span class="alum-salary-badge">${escapeHtml(m.first_job_annual_salary_usd || "$102,000")}</span>
                    </div>
                    <h4 class="alum-role-title">${escapeHtml(m.first_job_title || "Software Engineer")}</h4>
                    <p class="alum-employer">${escapeHtml(m.first_employer || "Amazon")} &bull; <span style="color:var(--accent-gold);">${escapeHtml(m.first_employer_industry || "Tech")}</span></p>
                    <div class="alum-stats-grid">
                        <div class="alum-stat-item">
                            <span>Final GPA</span>
                            <strong>${escapeHtml(m.final_gpa || "3.80")}</strong>
                        </div>
                        <div class="alum-stat-item">
                            <span>Time to Degree</span>
                            <strong>${escapeHtml(m.time_to_degree_years || "4.0")} Yrs</strong>
                        </div>
                    </div>
                </div>
                <div class="alum-highlight-tags">
                    <span class="highlight-tag">${escapeHtml(m.track || "Software Track")}</span>
                    <span class="highlight-tag" style="color:var(--accent-emerald);">Match: ${escapeHtml(m.match_score || 95)}%</span>
                </div>
            `;
            grid.appendChild(card);
        });

        container.hidden = false;
    };

    const renderSection2Matches = (matches) => {
        const grid = document.getElementById("section-2-matches-grid");
        const checklistGrid = document.getElementById("interactive-course-checklist");
        if (!grid) return;

        grid.innerHTML = "";
        (matches || []).forEach((m) => {
            const card = document.createElement("div");
            card.className = "alumni-card";
            const coursesList = (m.courses_taken || [])
                .slice(0, 3)
                .map((c) => `<span class="highlight-tag">${escapeHtml(c.course_id)}: ${escapeHtml(c.course_title)} (${c.grade || "A"})</span>`)
                .join("");

            card.innerHTML = `
                <div>
                    <div class="card-top-row">
                        <span class="alum-id-badge">${escapeHtml(m.campus_id)}</span>
                        <span class="alum-salary-badge">${escapeHtml(m.first_job_annual_salary_usd || "$105,000")}</span>
                    </div>
                    <h4 class="alum-role-title">${escapeHtml(m.first_job_title || "Software Engineer")}</h4>
                    <p class="alum-employer">${escapeHtml(m.first_employer || "Tech Leader")}</p>
                    <p style="font-size:0.8rem; color:var(--text-secondary); margin-bottom:0.6rem;">
                        ${escapeHtml(m.recommendation_note || "Key courses taken in junior/senior years drove technical interview success.")}
                    </p>
                </div>
                <div class="alum-highlight-tags" style="margin-top:0.4rem;">
                    ${coursesList}
                </div>
            `;
            grid.appendChild(card);
        });

        if (checklistGrid) {
            checklistGrid.innerHTML = "";
            const defaultCourses = [
                { id: "CMSC 202", title: "Computer Science II", type: "Core", credits: 4 },
                { id: "CMSC 341", title: "Data Structures", type: "Core", credits: 3 },
                { id: "CMSC 313", title: "Computer Organization & Assembly", type: "Core", credits: 3 },
                { id: "CMSC 441", title: "Design & Analysis of Algorithms", type: "Core", credits: 3 },
                { id: "CMSC 471", title: "Artificial Intelligence", type: "Elective", credits: 3 },
                { id: "CMSC 426", title: "Principles of Computer Security", type: "Elective", credits: 3 },
                { id: "CMSC 461", title: "Database Management Systems", type: "Elective", credits: 3 },
                { id: "CMSC 447", title: "Software Engineering I", type: "Capstone", credits: 3 },
            ];

            defaultCourses.forEach((c) => {
                const item = document.createElement("label");
                item.className = "course-check-item";
                const isChecked = state.user.checkedCourses.includes(c.id);
                if (isChecked) item.classList.add("checked");

                item.innerHTML = `
                    <input type="checkbox" value="${c.id}" ${isChecked ? "checked" : ""} />
                    <div class="course-check-info">
                        <span class="course-check-code">${escapeHtml(c.id)} &bull; ${escapeHtml(c.type)}</span>
                        <span class="course-check-title">${escapeHtml(c.title)} (${c.credits} cr)</span>
                    </div>
                `;

                item.querySelector("input").addEventListener("change", (e) => {
                    const checked = e.target.checked;
                    if (checked) {
                        item.classList.add("checked");
                        if (!state.user.checkedCourses.includes(c.id)) state.user.checkedCourses.push(c.id);
                    } else {
                        item.classList.remove("checked");
                        state.user.checkedCourses = state.user.checkedCourses.filter((id) => id !== c.id);
                    }
                    // Instant Text-Only Reaction for every course checkbox!
                    avatarSayTextOnly(HARDCODED_REACTIONS.courseCheck(c.id, c.title, checked), 2);
                });

                checklistGrid.appendChild(item);
            });
        }
    };

    const renderSection3Matches = (matches) => {
        const grid = document.getElementById("section-3-matches-grid");
        if (!grid) return;

        grid.innerHTML = "";
        (matches || []).forEach((m) => {
            const card = document.createElement("div");
            card.className = "alumni-card";
            const acts = (m.activities || [])
                .map((a) => `<span class="highlight-tag">${escapeHtml(a.experience_name)} (${escapeHtml(a.hours_per_week || "6")} hrs/wk)</span>`)
                .join("");

            card.innerHTML = `
                <div>
                    <div class="card-top-row">
                        <span class="alum-id-badge">${escapeHtml(m.campus_id)}</span>
                        <span class="alum-salary-badge">${escapeHtml(m.first_job_annual_salary_usd || "$98,000")}</span>
                    </div>
                    <h4 class="alum-role-title">${escapeHtml(m.first_job_title || "Engineer")}</h4>
                    <p class="alum-employer">${escapeHtml(m.first_employer || "Employer")}</p>
                    <p style="font-size:0.8rem; color:var(--text-secondary); margin-bottom:0.6rem;">
                        ${escapeHtml(m.outlier_insight || "Actively led campus technical initiatives, accelerating interview conversion.")}
                    </p>
                </div>
                <div class="alum-highlight-tags">
                    ${acts}
                </div>
            `;
            grid.appendChild(card);
        });
    };

    const renderSection4Matches = (matches) => {
        const grid = document.getElementById("section-4-matches-grid");
        if (!grid) return;

        grid.innerHTML = "";
        (matches || []).forEach((m) => {
            const card = document.createElement("div");
            card.className = "alumni-card";
            const skillsList = (m.skills_mastered || ["Python", "AWS", "SQL", "Git"])
                .map((s) => `<span class="highlight-tag" style="color:#59366F;">${escapeHtml(s)}</span>`)
                .join("");
            const internList = (m.internships_held || [])
                .slice(0, 2)
                .map((i) => `<div style="font-size:0.78rem; color:var(--text-secondary); margin-top:0.25rem;">&bull; ${escapeHtml(i)}</div>`)
                .join("");

            card.innerHTML = `
                <div>
                    <div class="card-top-row">
                        <span class="alum-id-badge">${escapeHtml(m.campus_id)}</span>
                        <span class="alum-salary-badge">${escapeHtml(m.first_job_annual_salary_usd || "$112,000")}</span>
                    </div>
                    <h4 class="alum-role-title">${escapeHtml(m.first_job_title || "Software Specialist")}</h4>
                    <p class="alum-employer">${escapeHtml(m.first_employer || "Tech Company")} &bull; <span style="color:var(--avatar-purple);">${escapeHtml(m.internship_count || 2)} Internships</span></p>
                    <div style="background-color:var(--bg-inset); padding:0.6rem; border-radius:6px; margin-bottom:0.6rem;">
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
    };

    const renderSection5Matches = (matches) => {
        const matrixContainer = document.getElementById("final-summary-matrix");
        const grid = document.getElementById("section-5-matches-grid");
        if (!matrixContainer || !grid) return;

        matrixContainer.innerHTML = `
            <div class="matrix-box">
                <span class="matrix-box-label">Class Year &amp; Major</span>
                <div class="matrix-box-val" style="font-size:1.05rem;">${escapeHtml(state.user.classYear)} &bull; ${escapeHtml(state.user.major)}</div>
            </div>
            <div class="matrix-box">
                <span class="matrix-box-label">Target Industry</span>
                <div class="matrix-box-val" style="font-size:1.05rem; color:var(--accent-emerald);">${escapeHtml(state.user.targetCompanyIndustry || "Software Products")}</div>
            </div>
            <div class="matrix-box">
                <span class="matrix-box-label">Target Starting Comp</span>
                <div class="matrix-box-val">${escapeHtml(state.user.targetSalary || "$105,000")}</div>
            </div>
            <div class="matrix-box">
                <span class="matrix-box-label">Credits &amp; GPA</span>
                <div class="matrix-box-val" style="font-size:1.05rem;">${escapeHtml(state.user.creditsCompleted)} cr &bull; ${escapeHtml(state.user.gpa || "3.65")} GPA</div>
            </div>
        `;

        grid.innerHTML = "";
        (matches || []).forEach((m) => {
            const card = document.createElement("div");
            card.className = "alumni-card";
            card.innerHTML = `
                <div>
                    <div class="card-top-row">
                        <span class="alum-id-badge">${escapeHtml(m.campus_id)}</span>
                        <span class="alum-salary-badge">${escapeHtml(m.first_job_annual_salary_usd || "$110,000")}</span>
                    </div>
                    <h4 class="alum-role-title">${escapeHtml(m.first_job_title || "Software Engineer")}</h4>
                    <p class="alum-employer">${escapeHtml(m.first_employer || "Amazon")} &bull; ${escapeHtml(m.major || "Computer Science")}</p>
                    <p style="font-size:0.83rem; color:var(--text-secondary); margin-bottom:0.75rem;">
                        ${escapeHtml(m.blueprint_summary || "Completed 4-year degree with 2 internships and top elective sequence.")}
                    </p>
                </div>
                <div class="alum-highlight-tags">
                    <span class="highlight-tag" style="color:var(--accent-gold);">${escapeHtml(m.internships || 2)} Internships</span>
                    <span class="highlight-tag">${escapeHtml(m.final_gpa || "3.8")} GPA</span>
                    <span class="highlight-tag" style="color:var(--accent-emerald);">4.0 Yrs</span>
                </div>
            `;
            grid.appendChild(card);
        });
    };

    // =========================================================================
    // EVENT LISTENERS: EVERY SINGLE BOX AND INPUT TRIGGERS TEXT-ONLY REACTION!
    // =========================================================================

    // SCREEN 1: Year in College Buttons
    document.querySelectorAll(".year-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
            document.querySelectorAll(".year-btn").forEach((b) => b.classList.remove("selected"));
            btn.classList.add("selected");
            const year = btn.getAttribute("data-year");
            state.user.classYear = year;

            // Instant Hardcoded Text-Only Reaction (Avatar 1 Blue)
            const reaction = HARDCODED_REACTIONS.classYear[year] || "Great selection! Let's examine your degree program next.";
            avatarSayTextOnly(reaction, 1);
        });
    });

    document.getElementById("btn-next-screen-1")?.addEventListener("click", () => {
        goToScreen(2);
    });

    // SCREEN 2: Major, Track, Minor, and Name Inputs
    if (majorSelect) {
        majorSelect.addEventListener("change", () => {
            populateTrackDropdown(majorSelect.value);
            state.user.major = majorSelect.value;
            const reaction = HARDCODED_REACTIONS.major[majorSelect.value] || `Excellent choice with ${majorSelect.value}!`;
            avatarSayTextOnly(reaction, 1);
        });
    }

    if (trackSelect) {
        trackSelect.addEventListener("change", () => {
            state.user.majorTrack = trackSelect.value;
            avatarSayTextOnly(HARDCODED_REACTIONS.track(trackSelect.value), 1);
        });
    }

    if (minorSelect) {
        minorSelect.addEventListener("change", () => {
            state.user.minor = minorSelect.value;
            avatarSayTextOnly(HARDCODED_REACTIONS.minor(minorSelect.value), 1);
        });
    }

    const nameInput = document.getElementById("student-name");
    if (nameInput) {
        nameInput.addEventListener("input", () => {
            state.user.name = nameInput.value.trim();
        });
        nameInput.addEventListener("blur", () => {
            if (nameInput.value.trim()) {
                avatarSayTextOnly(HARDCODED_REACTIONS.name(nameInput.value.trim()), 1);
            }
        });
    }

    document.getElementById("btn-next-screen-2")?.addEventListener("click", () => {
        collectFormData();
        goToScreen(3);
    });

    // SCREEN 3: GPA & Credits Inputs
    document.querySelectorAll(".gpa-pill").forEach((pill) => {
        pill.addEventListener("click", () => {
            document.querySelectorAll(".gpa-pill").forEach((p) => p.classList.remove("active"));
            pill.classList.add("active");
            const val = pill.getAttribute("data-val");
            const gpaInput = document.getElementById("student-gpa");
            if (gpaInput) gpaInput.value = val;
            state.user.gpa = val;
            avatarSayTextOnly(HARDCODED_REACTIONS.gpa(val), 1);
        });
    });

    const gpaInputEl = document.getElementById("student-gpa");
    if (gpaInputEl) {
        gpaInputEl.addEventListener("input", (e) => {
            state.user.gpa = e.target.value;
        });
        gpaInputEl.addEventListener("change", (e) => {
            avatarSayTextOnly(HARDCODED_REACTIONS.gpa(e.target.value), 1);
        });
    }

    const creditsInputEl = document.getElementById("student-credits");
    if (creditsInputEl) {
        creditsInputEl.addEventListener("input", (e) => {
            state.user.creditsCompleted = parseInt(e.target.value, 10) || 0;
        });
        creditsInputEl.addEventListener("change", (e) => {
            avatarSayTextOnly(HARDCODED_REACTIONS.credits(e.target.value), 1);
        });
    }

    document.getElementById("btn-next-screen-3")?.addEventListener("click", () => {
        collectFormData();
        goToScreen(4);
    });

    // SCREEN 4: Career Target Inputs
    const targetCompInput = document.getElementById("career-target-companies");
    if (targetCompInput) {
        targetCompInput.addEventListener("input", (e) => {
            state.user.targetCompanyIndustry = e.target.value;
        });
        targetCompInput.addEventListener("blur", (e) => {
            if (e.target.value.trim()) {
                avatarSayTextOnly(HARDCODED_REACTIONS.targetCompanies(e.target.value.trim()), 1);
            }
        });
    }

    const targetSalaryInput = document.getElementById("career-expected-salary");
    if (targetSalaryInput) {
        targetSalaryInput.addEventListener("input", (e) => {
            state.user.targetSalary = e.target.value;
        });
        targetSalaryInput.addEventListener("blur", (e) => {
            if (e.target.value.trim()) {
                avatarSayTextOnly(HARDCODED_REACTIONS.salary(e.target.value.trim()), 1);
            }
        });
    }

    const targetLocationInput = document.getElementById("career-target-location");
    if (targetLocationInput) {
        targetLocationInput.addEventListener("input", (e) => {
            state.user.targetLocation = e.target.value;
        });
        targetLocationInput.addEventListener("blur", (e) => {
            if (e.target.value.trim()) {
                avatarSayTextOnly(HARDCODED_REACTIONS.location(e.target.value.trim()), 1);
            }
        });
    }

    const gradYearInput = document.getElementById("expected-grad-year");
    if (gradYearInput) {
        gradYearInput.addEventListener("input", (e) => {
            state.user.expectedGradYear = e.target.value;
        });
        gradYearInput.addEventListener("change", (e) => {
            if (e.target.value.trim()) {
                avatarSayTextOnly(HARDCODED_REACTIONS.gradYear(e.target.value.trim()), 1);
            }
        });
    }

    const careerGoalsInput = document.getElementById("career-goals");
    if (careerGoalsInput) {
        careerGoalsInput.addEventListener("input", (e) => {
            state.user.careerGoals = e.target.value;
        });
        careerGoalsInput.addEventListener("blur", (e) => {
            if (e.target.value.trim()) {
                avatarSayTextOnly(HARDCODED_REACTIONS.careerGoals(e.target.value.trim()), 1);
            }
        });
    }

    // SCREEN 4: Section 1 Baseline Report Button (API CALL WITH VOICE)
    document.getElementById("btn-generate-section-1-report")?.addEventListener("click", async () => {
        const spinner = document.getElementById("spinner-section-1");
        const btn = document.getElementById("btn-generate-section-1-report");
        await runReportPipeline("basic_info", 1, 1, spinner, btn);
    });

    // SCREEN 4 -> SCREEN 5 (Section 2 Course Advising Report - API CALL WITH VOICE)
    document.getElementById("btn-next-to-section-2")?.addEventListener("click", async () => {
        goToScreen(5, false);
        await runReportPipeline("course_advising", 2, 2, null, null);
    });

    // SCREEN 5 -> SCREEN 6 (Section 3 Campus Involvement Report - API CALL WITH VOICE)
    document.getElementById("btn-next-to-section-3")?.addEventListener("click", async () => {
        goToScreen(6, false);
        document.querySelectorAll("#involvement-pills-container .involvement-pill").forEach((pill) => {
            const name = pill.getAttribute("data-name");
            pill.classList.toggle("active", state.user.selectedActivities.includes(name));
        });
        await runReportPipeline("campus_involvement", 3, 3, null, null);
    });

    // SCREEN 6: Activity Pills (Instant Text-Only Reaction)
    document.querySelectorAll("#involvement-pills-container .involvement-pill").forEach((pill) => {
        pill.addEventListener("click", () => {
            pill.classList.toggle("active");
            const name = pill.getAttribute("data-name");
            if (pill.classList.contains("active")) {
                if (!state.user.selectedActivities.includes(name)) state.user.selectedActivities.push(name);
                avatarSayTextOnly(HARDCODED_REACTIONS.activity(name), 3);
            } else {
                state.user.selectedActivities = state.user.selectedActivities.filter((a) => a !== name);
                avatarSayTextOnly(`Removed ${name} from your active involvement list.`, 3);
            }
        });
    });

    const customActivityInput = document.getElementById("custom-activity-input");
    if (customActivityInput) {
        customActivityInput.addEventListener("input", (e) => {
            state.user.customActivity = e.target.value;
        });
        customActivityInput.addEventListener("blur", (e) => {
            if (e.target.value.trim()) {
                avatarSayTextOnly(HARDCODED_REACTIONS.customActivity(e.target.value.trim()), 3);
            }
        });
    }

    document.getElementById("btn-update-involvement")?.addEventListener("click", async () => {
        const spinner = document.getElementById("spinner-section-3");
        const btn = document.getElementById("btn-update-involvement");
        await runReportPipeline("campus_involvement", 3, 3, spinner, btn);
    });

    // SCREEN 6 -> SCREEN 7 (Section 4 Professional Skills)
    document.getElementById("btn-next-to-section-4")?.addEventListener("click", () => {
        goToScreen(7);
    });

    // SCREEN 7: Skill Pills (Instant Text-Only Reaction)
    document.querySelectorAll("#quick-skills-container .skill-pill").forEach((pill) => {
        pill.addEventListener("click", () => {
            pill.classList.toggle("active");
            const skill = pill.getAttribute("data-skill");
            const input = document.getElementById("user-skills-input");
            if (!input) return;

            let currentSkills = input.value.split(",").map((s) => s.trim()).filter(Boolean);
            if (pill.classList.contains("active")) {
                if (!currentSkills.includes(skill)) currentSkills.push(skill);
                avatarSayTextOnly(HARDCODED_REACTIONS.skill(skill), 4);
            } else {
                currentSkills = currentSkills.filter((s) => s !== skill);
                avatarSayTextOnly(`Removed ${skill} from your skills list.`, 4);
            }
            input.value = currentSkills.join(", ");
            state.user.skills = input.value;
        });
    });

    const userSkillsInput = document.getElementById("user-skills-input");
    if (userSkillsInput) {
        userSkillsInput.addEventListener("input", (e) => {
            state.user.skills = e.target.value;
        });
        userSkillsInput.addEventListener("blur", (e) => {
            if (e.target.value.trim()) {
                avatarSayTextOnly(HARDCODED_REACTIONS.skillsInput(e.target.value.trim()), 4);
            }
        });
    }

    document.getElementById("btn-next-screen-7")?.addEventListener("click", () => {
        collectFormData();
        goToScreen(8);
    });

    // SCREEN 8: Internships Input
    const internshipsInput = document.getElementById("user-internships-input");
    if (internshipsInput) {
        internshipsInput.addEventListener("input", (e) => {
            state.user.internships = e.target.value;
        });
        internshipsInput.addEventListener("blur", (e) => {
            if (e.target.value.trim()) {
                avatarSayTextOnly(HARDCODED_REACTIONS.internshipsInput(e.target.value.trim()), 4);
            }
        });
    }

    // SCREEN 8: Section 4 Report Button (API CALL WITH VOICE)
    document.getElementById("btn-update-professional")?.addEventListener("click", async () => {
        const spinner = document.getElementById("spinner-section-4");
        const btn = document.getElementById("btn-update-professional");
        await runReportPipeline("professional_involvement", 4, 4, spinner, btn);
    });

    // SCREEN 8 -> SCREEN 9 (Section 5 Final Report - API CALL WITH VOICE)
    document.getElementById("btn-next-to-section-5")?.addEventListener("click", async () => {
        goToScreen(9, false);
        await runReportPipeline("final_report", 5, 1, null, null);
    });

    // Generic Back Buttons
    document.querySelectorAll(".btn-prev-screen").forEach((btn) => {
        btn.addEventListener("click", () => {
            const target = parseInt(btn.getAttribute("data-to"), 10);
            if (target) goToScreen(target);
        });
    });

    // Voice Replay Button (Explicitly Plays/Replays the Last Report Audio)
    if (voiceReplayBtn) {
        voiceReplayBtn.addEventListener("click", () => {
            unlockAudio();
            if (state.currentAudio && !state.currentAudio.paused) {
                stopAllSpeech();
            } else if (state.lastReportText) {
                playReportAudio(state.lastReportText, state.lastReportBase64Audio);
            } else if (thoughtBubbleText && thoughtBubbleText.textContent.trim()) {
                playReportAudio(thoughtBubbleText.textContent.trim(), "");
            }
        });
    }

    // Clicking the Avatar Circle also triggers/replays the voice!
    if (activeAvatarCircle) {
        activeAvatarCircle.addEventListener("click", () => {
            unlockAudio();
            if (state.currentAudio && !state.currentAudio.paused) {
                stopAllSpeech();
            } else if (state.lastReportText) {
                playReportAudio(state.lastReportText, state.lastReportBase64Audio);
            } else if (thoughtBubbleText && thoughtBubbleText.textContent.trim()) {
                playReportAudio(thoughtBubbleText.textContent.trim(), "");
            }
        });
    }

    // Save to Database Button
    document.getElementById("btn-save-to-db")?.addEventListener("click", async () => {
        const spinner = document.getElementById("spinner-save-db");
        const btn = document.getElementById("btn-save-to-db");
        const msgEl = document.getElementById("save-confirmation-msg");
        if (spinner) spinner.hidden = false;
        if (btn) btn.disabled = true;

        try {
            collectFormData();
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
                            clubsAndActivities: state.user.selectedActivities.join(", "),
                            rolesAndInterests: state.user.customActivity,
                        },
                        experience: {
                            projectsAndSkills: state.user.skills,
                            internshipsAndJobs: state.user.internships,
                        },
                    },
                }),
            });

            const result = await res.json();
            if (result.user_id) {
                state.activeUserId = result.user_id;
            }
            if (msgEl) {
                msgEl.hidden = false;
                msgEl.textContent = `✓ Report successfully saved to Tiger Data (Record ID: ${result.submission_id || "Saved"}).`;
            }
            avatarSayTextOnly("Your comprehensive career report has been officially saved to Tiger Data!", 1);
        } catch (err) {
            console.error("Save error:", err);
            showError("Unable to save report to database.");
        } finally {
            if (spinner) spinner.hidden = true;
            if (btn) btn.disabled = false;
        }
    });

    // Restart Quiz Button
    document.getElementById("btn-restart-quiz")?.addEventListener("click", () => {
        stopAllSpeech();
        if (confirm("Start a new student career assessment?")) {
            resetAllFormsAndState();
            window.location.reload();
        }
    });

    // =========================================================================
    // ACADEMIC OPTIONS POPULATOR
    // =========================================================================
    const populateTrackDropdown = (selectedMajor) => {
        if (!trackSelect) return;
        trackSelect.innerHTML = `<option value="" disabled selected>Select concentration / track...</option><option value="Not Applicable">General / No Specific Track</option>`;
        const tracks = (academicOptions.tracks_by_major && academicOptions.tracks_by_major[selectedMajor])
            ? academicOptions.tracks_by_major[selectedMajor]
            : academicOptions.tracks;

        (tracks || []).forEach((t) => {
            if (!t || t === "Not Applicable") return;
            const opt = document.createElement("option");
            opt.value = t;
            opt.textContent = t;
            trackSelect.appendChild(opt);
        });
        trackSelect.value = "";
    };

    const populateMinorDropdown = () => {
        if (!minorSelect) return;
        minorSelect.innerHTML = `<option value="" disabled selected>Select minor / secondary field...</option><option value="Not Applicable">None / Not Applicable</option>`;
        (academicOptions.minors || []).forEach((m) => {
            if (!m || m === "Not Applicable") return;
            const opt = document.createElement("option");
            opt.value = m;
            opt.textContent = m;
            minorSelect.appendChild(opt);
        });
        minorSelect.value = "";
    };

    const loadAcademicOptions = async () => {
        try {
            const res = await fetch("/api/academic-options");
            if (res.ok) {
                const data = await res.json();
                academicOptions = { ...academicOptions, ...data };
            }
        } catch (_err) {
            console.warn("Could not load dynamic options, using defaults.");
        }

        if (majorSelect) {
            majorSelect.innerHTML = `<option value="" disabled selected>Select your Major...</option>`;
            academicOptions.majors.forEach((m) => {
                const opt = document.createElement("option");
                opt.value = m;
                opt.textContent = m;
                majorSelect.appendChild(opt);
            });
            majorSelect.value = "";
            populateTrackDropdown("");
        }
        populateMinorDropdown();
    };

    // =========================================================================
    // STRICT ON-LOAD FORM & JAVASCRIPT STATE RESETS
    // =========================================================================
    const resetAllFormsAndState = () => {
        // Clear JavaScript State Objects
        state.activeUserId = null;
        state.currentScreen = 1;
        state.user = {
            classYear: "",
            major: "",
            majorTrack: "",
            minor: "",
            name: "",
            gpa: "",
            creditsCompleted: "",
            targetCompanyIndustry: "",
            targetSalary: "",
            targetLocation: "",
            expectedGradYear: "",
            careerGoals: "",
            selectedActivities: [],
            customActivity: "",
            skills: "",
            internships: "",
            checkedCourses: [],
        };
        state.sectionData = {
            1: null,
            2: null,
            3: null,
            4: null,
            5: null,
        };
        state.currentAudio = null;
        state.lastReportText = "";
        state.lastReportBase64Audio = "";

        // Clear web session storage
        try {
            sessionStorage.clear();
            localStorage.clear();
        } catch (_e) { }

        // Reset all text, number, and search inputs
        document.querySelectorAll('input[type="text"], input[type="number"], input[type="email"], input[type="search"], textarea').forEach((input) => {
            input.value = "";
        });

        // Reset all checkboxes and radios
        document.querySelectorAll('input[type="checkbox"], input[type="radio"]').forEach((input) => {
            input.checked = false;
        });

        // Reset all <select> dropdowns to default placeholder (<option value="" disabled selected>...</option>)
        document.querySelectorAll("select").forEach((select) => {
            select.selectedIndex = 0;
            select.value = "";
        });

        // Remove active / selected visual states from interactive pills & buttons
        document.querySelectorAll(".year-btn, .pill-option, .gpa-pill, .involvement-pill, .skill-pill, .course-check-item").forEach((el) => {
            el.classList.remove("selected", "active", "checked");
        });

        clearError();
        const saveMsg = document.getElementById("save-confirmation-msg");
        if (saveMsg) {
            saveMsg.hidden = true;
            saveMsg.textContent = "";
        }
    };

    // Helper functions
    const showError = (msg) => {
        if (!wizardError) return;
        wizardError.textContent = msg;
        wizardError.hidden = false;
    };
    const clearError = () => {
        if (!wizardError) return;
        wizardError.textContent = "";
        wizardError.hidden = true;
    };
    const escapeHtml = (str) =>
        String(str ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");

    // Initialize application: Strictly reset all forms & state, load options, and start on Screen 1
    resetAllFormsAndState();
    loadAcademicOptions();
    goToScreen(1);
});
