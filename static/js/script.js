document.addEventListener("DOMContentLoaded", () => {
    // =========================================================================
    // STATE MANAGEMENT
    // =========================================================================
    const state = {
        currentScreen: 1,
        user: {
            classYear: "Freshman",
            major: "Computer Science",
            majorTrack: "Not Applicable",
            minor: "Not Applicable",
            name: "",
            gpa: "3.65",
            creditsCompleted: 18,
            targetCompanyIndustry: "Software Products",
            targetSalary: "$105,000",
            targetLocation: "Washington DC Metro • Remote",
            expectedGradYear: "2028",
            careerGoals: "Land a Software Development Engineer role at a leading tech firm.",
            selectedActivities: ["HackUMBC", "ACM Student Chapter"],
            customActivity: "",
            skills: "Python, SQL, AWS, Git, Linux",
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
            className: "avatar-3-yellow",
            glyph: "⚡",
            numberBadge: "A3",
            nameTag: "Avatar 3 (Yellow)",
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
        "intro-1": {
            text: "Hello! I am your Academic Foundations Advisor in Blue. I will guide you through Section 1: Basic Information, establishing your college standing, degree concentration, GPA velocity, and baseline career goals.",
            avatar: 1,
        },
        1: {
            text: "Select your college standing to get started. Avatar 1 will adapt its advice and milestones to your academic stage.",
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
        "intro-2": {
            text: "Hi there! I am your Course Advising Specialist in Green. Welcome to Section 2: Course Advising. I will walk you through prerequisite roadmaps, high-yield elective sequences, and course benchmarks from top-earning alumni in your field.",
            avatar: 2,
        },
        5: {
            text: "Avatar 2 is reviewing your major course sequences and high-yield electives against top-earning alumni.",
            avatar: 2,
        },
        "intro-3": {
            text: "Hey! I am your Student Engagement Mentor in Yellow. Welcome to Section 3: Campus Involvement. I will walk you through high-impact student organizations, hackathons, and creative outlier activities that give your resume a decisive edge.",
            avatar: 3,
        },
        6: {
            text: "Avatar 3 is matching your credits completed to high-impact campus organizations and creative activities.",
            avatar: 3,
        },
        "intro-4": {
            text: "Greetings! I am your Career and Industry Strategist in Purple. Welcome to Section 4: Professional Involvement. I will walk you through calibrating your technical stack, frameworks, and internship experiences against industry hiring standards.",
            avatar: 4,
        },
        7: {
            text: "Tell me about the technical skills and frameworks you have built or are learning.",
            avatar: 4,
        },
        8: {
            text: "Next, describe your internships, co-ops, research roles, or campus jobs to benchmark against industry hiring.",
            avatar: 4,
        },
        "intro-5": {
            text: "Welcome back! I am your Academic Advisor in Blue. Welcome to Section 5: Final Report. I will synthesize your coursework, campus involvement, professional skills, and Tiger Data benchmarks into your comprehensive career roadmap.",
            avatar: 1,
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
            Freshman: "Welcome! As a Freshman, you're building your foundation—focusing on core programming and calculus early unlocks high-paying junior internships.",
            Sophomore: "Sophomore year is the pivotal gateway stage—time to lock down Data Structures and Systems prerequisites for recruitment.",
            Junior: "Junior year is prime time! You should be targeting upper-level electives in AI, Cloud, or Security and securing your major summer internship.",
            Senior: "Senior year is capstone and career launch! Let's optimize your remaining electives and convert your experience into top-tier offers.",
            "More than 4 years": "Extended academic progression allows you to tailor a high-impact trajectory and maximize hands-on co-ops and industry experience.",
        },
        major: {
            "Computer Science": "Computer Science has our largest alumni dataset—graduates excel in Software Engineering, Cloud Architecture, and Defense roles.",
            "Data Science": "Data Science is in high demand! Our alumni frequently land quantitative developer and machine learning engineering positions.",
            "Information Systems": "Information Systems graduates excel in Cloud Consulting, Enterprise Architecture, and Systems Integration.",
            "Cybersecurity": "Cybersecurity is a massive growth sector with prominent alumni placement across federal defense and security contractors.",
            "Computer Engineering": "Computer Engineering offers a powerful blend of embedded hardware and low-level software systems engineering.",
        },
        track: (trackName) => {
            if (!trackName || trackName === "Not Applicable") {
                return "General Track selected—gives you maximum flexibility to tailor electives across multiple software disciplines.";
            }
            return `${trackName} concentration selected—this specialized track aligns directly with high-demand industry engineering roles.`;
        },
        minor: (minorName) => {
            if (!minorName || minorName === "Not Applicable") {
                return "No minor selected—focusing 100% of your elective bandwidth on your primary major requirements.";
            }
            return `Adding a ${minorName} minor strengthens your interdisciplinary profile and creates a distinctive resume differentiator.`;
        },
        name: (val) => {
            if (!val) return "Welcome! Let's build your personalized academic and career trajectory.";
            return `Nice to meet you, ${val}! Let's customize your degree roadmap and benchmark your career path against Tiger Data.`;
        },
        gpa: (val) => {
            const num = parseFloat(val) || 3.5;
            if (num >= 3.8) return `A ${num.toFixed(2)} GPA places you in the top tier! That gives you strong leverage for selective tech fellowships and research roles.`;
            if (num >= 3.4) return `A ${num.toFixed(2)} GPA is very strong! You meet the GPA benchmark for over 90% of top technology and defense employers.`;
            return `A ${num.toFixed(2)} GPA gives you a solid base. We will emphasize your technical project portfolio and practical skill tags.`;
        },
        credits: (val) => {
            const cr = parseInt(val, 10) || 0;
            if (cr < 30) return `${cr} credits completed: You're in your foundation phase (Year 1 pace). Focus on prerequisite gateway sequences.`;
            if (cr < 60) return `${cr} credits completed: Sophomore pacing. Ideal time to declare specialized tracks and prepare for hackathons.`;
            if (cr < 90) return `${cr} credits completed: Junior pacing! You are in the prime window for high-yield electives and recruiting.`;
            return `${cr} credits completed: Senior standing! You are nearing graduation—focus on capstone completion and full-time placement.`;
        },
        targetCompanies: (val) => {
            if (!val) return "Tell us which industry or target employers you are aiming for.";
            return `Targeting "${val}": Our alumni network has extensive placement and historical hiring data across this sector!`;
        },
        salary: (val) => {
            if (!val) return "Enter your compensation goal so we can benchmark against alumni starting offers.";
            return `Target salary of ${val}: We will compare your course and internship selections against alumni who hit this salary tier.`;
        },
        location: (val) => {
            if (!val) return "Let us know your preferred work regions (e.g., DC/Baltimore Metro, West Coast, Remote).";
            return `Preferred location "${val}": We'll benchmark regional cost-of-living and top employer hubs in this market.`;
        },
        gradYear: (val) => {
            if (!val) return "Enter your expected graduation year.";
            return `Target graduation in ${val}: We will calibrate your remaining semesters into a semester-by-semester milestone plan.`;
        },
        careerGoals: (val) => {
            if (!val) return "Summarize your long-term career aspirations.";
            return `Career vision noted: We will match your trajectory with alumni who successfully achieved similar goals.`;
        },
        courseCheck: (courseId, courseTitle, isChecked) => {
            if (isChecked) {
                return `Added ${courseId} (${courseTitle}) to your plan! Alumni who completed this course gained critical technical interview mastery.`;
            }
            return `Removed ${courseId} from your active plan.`;
        },
        activity: (name) => {
            const map = {
                HackUMBC: "HackUMBC is fantastic! Alumni who participated reported building high-impact portfolio projects that impressed tech recruiters.",
                "ACM Student Chapter": "ACM membership builds a strong peer network and provides hands-on workshops in systems and web architecture.",
                "Data Science Collective": "Data Science Collective connects you with analytics challenges and machine learning workshops.",
                "Capture The Flag Team": "CTF competition directly proves hands-on offensive/defensive security skills to defense & tech recruiters.",
                "Undergraduate Research Assistant": "Undergraduate research establishes deep domain mastery and opens doors to top R&D engineering roles.",
                "Computing Peer Mentor": "Peer mentoring demonstrates leadership and communication—qualities highly rated in hiring loops.",
                "Game Developers Club": "Game Dev is a distinctive 12% outlier activity! Recruiters value the full-cycle project design experience.",
                "Entrepreneurship Club": "Entrepreneurship involvement shows initiative, product sense, and cross-functional leadership.",
            };
            return map[name] || `Involvement in ${name} adds distinctive leadership and teamwork stories to your career portfolio.`;
        },
        customActivity: (val) => {
            if (!val) return "Enter any unusual hobbies or unique creative passions you pursue.";
            return `"${val}" added! Niche activities make for memorable personal narratives during behavioral recruiter screens.`;
        },
        skill: (name) => {
            return `Skill "${name}" added! This is one of the top-ranked skill tags in alumni job descriptions.`;
        },
        skillsInput: (val) => {
            if (!val) return "List your primary programming languages, frameworks, tools, and technical competencies.";
            return `Technical stack updated: These skills will be benchmarked against alumni who landed in your target industry.`;
        },
        internshipsInput: (val) => {
            if (!val) return "Describe any internships, research roles, co-ops, or campus jobs you have held or are targeting.";
            return `Experience record updated: Internships are the #1 predictor of top-tier starting compensation in our dataset.`;
        },
    };

    // =========================================================================
    // NAVIGATION & 1-QUESTION-PER-SCREEN PROGRESSION
    // =========================================================================

    const avatarStage = document.getElementById("avatar-stage");

    const progressConfig = {
        "intro-1": { label: "Section 1 Introduction • Basic Information", pct: 5 },
        "1": { label: "Section 1 • Step 1 of 4 (College Standing)", pct: 12 },
        "2": { label: "Section 1 • Step 2 of 4 (Academic Program)", pct: 20 },
        "3": { label: "Section 1 • Step 3 of 4 (GPA & Credits)", pct: 28 },
        "4": { label: "Section 1 • Step 4 of 4 (Career Goals & Baseline Report)", pct: 36 },
        "intro-2": { label: "Section 2 Introduction • Course Advising", pct: 44 },
        "5": { label: "Section 2 • Course Advising & Elective Strategy", pct: 52 },
        "intro-3": { label: "Section 3 Introduction • Campus Involvement", pct: 60 },
        "6": { label: "Section 3 • Campus Involvement & Organizations", pct: 68 },
        "intro-4": { label: "Section 4 Introduction • Professional Involvement", pct: 76 },
        "7": { label: "Section 4 • Step 1 of 2 (Technical Skills)", pct: 82 },
        "8": { label: "Section 4 • Step 2 of 2 (Internships & Jobs)", pct: 88 },
        "intro-5": { label: "Section 5 Introduction • Comprehensive Final Report", pct: 94 },
        "9": { label: "Section 5 • Comprehensive Career Roadmap", pct: 100 },
        "loading": { label: "Querying Tiger Data & Calibrating Model...", pct: 50 },
    };

    const updateProgressDisplay = (screenKey) => {
        const key = String(screenKey);
        state.currentScreen = key;
        const config = progressConfig[key] || { label: `Section View (${key})`, pct: 50 };
        if (progressLabel) progressLabel.textContent = config.label;
        if (progressFill) progressFill.style.width = `${config.pct}%`;
    };

    const goToScreen = (screenKey, shouldSpeakPrompt = true) => {
        const key = String(screenKey);
        updateProgressDisplay(key);
        const isIntro = key.startsWith("intro-");
        const isLoading = key === "loading";

        // Hide top thought bubble stage on intro & loading screens so hero avatar is front & center
        if (avatarStage) {
            avatarStage.hidden = isIntro || isLoading;
        }

        document.querySelectorAll(".interactive-screen").forEach((screen) => {
            const sKey = String(screen.getAttribute("data-screen"));
            if (sKey === key) {
                screen.hidden = false;
                screen.classList.add("active");
            } else {
                screen.hidden = true;
                screen.classList.remove("active");
            }
        });
        window.scrollTo({ top: 0, behavior: "smooth" });

        if (shouldSpeakPrompt && SCREEN_INTRO_PROMPTS[key]) {
            const intro = SCREEN_INTRO_PROMPTS[key];
            if (isIntro) {
                // Speak static intro voice via Web Speech synthesis (Zero Gemini API calls)
                speakViaWebSpeech(intro.text, intro.avatar);
            } else {
                // Speak opening question prompt
                avatarSpeakPrompt(intro.text, intro.avatar);
            }
        }
    };

    const showLoadingScreen = (title = "Querying Tiger Data...", subtitle = "Benchmarking historical student transcripts and synthesizing personalized recommendations...") => {
        stopAllSpeech();
        const titleEl = document.getElementById("loading-status-title");
        const subEl = document.getElementById("loading-status-subtitle");
        if (titleEl) titleEl.textContent = title;
        if (subEl) subEl.textContent = subtitle;
        goToScreen("loading", false);
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
                .map((s) => `<span class="highlight-tag" style="color:#c4b5fd;">${escapeHtml(s)}</span>`)
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

    // SECTION 1 INTRO: Start Section 1 Button
    document.getElementById("btn-start-section-1")?.addEventListener("click", () => {
        goToScreen(1);
    });

    // SCREEN 4: Section 1 Baseline Report Button (API CALL WITH VOICE)
    document.getElementById("btn-generate-section-1-report")?.addEventListener("click", async () => {
        const spinner = document.getElementById("spinner-section-1");
        const btn = document.getElementById("btn-generate-section-1-report");
        await runReportPipeline("basic_info", 1, 1, spinner, btn);
    });

    // SCREEN 4 -> SECTION 2 INTRO
    document.getElementById("btn-next-to-section-2")?.addEventListener("click", () => {
        goToScreen("intro-2");
    });

    // SECTION 2 INTRO: Start Section 2 Button (SHOW LOADING -> API CALL -> SCREEN 5)
    document.getElementById("btn-start-section-2")?.addEventListener("click", async () => {
        showLoadingScreen(
            "Analyzing Course Catalog & Tiger Data...",
            "Avatar 2 (Green) is matching course sequences and electives against top-earning alumni..."
        );
        await runReportPipeline("course_advising", 2, 2, null, null);
        goToScreen(5, false);
    });

    // SCREEN 5 -> SECTION 3 INTRO
    document.getElementById("btn-next-to-section-3")?.addEventListener("click", () => {
        goToScreen("intro-3");
    });

    // SECTION 3 INTRO: Start Section 3 Button (SHOW LOADING -> API CALL -> SCREEN 6)
    document.getElementById("btn-start-section-3")?.addEventListener("click", async () => {
        showLoadingScreen(
            "Querying Campus Organizations & Activities...",
            "Avatar 3 (Yellow) is analyzing extracurricular footprints of top-earning alumni..."
        );
        document.querySelectorAll("#involvement-pills-container .involvement-pill").forEach((pill) => {
            const name = pill.getAttribute("data-name");
            pill.classList.toggle("active", state.user.selectedActivities.includes(name));
        });
        await runReportPipeline("campus_involvement", 3, 3, null, null);
        goToScreen(6, false);
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

    // SCREEN 6 -> SECTION 4 INTRO
    document.getElementById("btn-next-to-section-4")?.addEventListener("click", () => {
        goToScreen("intro-4");
    });

    // SECTION 4 INTRO: Start Section 4 Button
    document.getElementById("btn-start-section-4")?.addEventListener("click", () => {
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

    // SCREEN 8 -> SECTION 5 INTRO
    document.getElementById("btn-next-to-section-5")?.addEventListener("click", () => {
        goToScreen("intro-5");
    });

    // SECTION 5 INTRO: Start Section 5 Button (SHOW LOADING -> API CALL -> SCREEN 9)
    document.getElementById("btn-start-section-5")?.addEventListener("click", async () => {
        showLoadingScreen(
            "Compiling Comprehensive Career Synthesis...",
            "Avatar 1 (Blue) is compiling your 4-year degree plan and final alumni dossiers..."
        );
        await runReportPipeline("final_report", 5, 1, null, null);
        goToScreen(9, false);
    });

    // Generic Back Buttons (Supports numeric and string screen keys)
    document.querySelectorAll(".btn-prev-screen").forEach((btn) => {
        btn.addEventListener("click", () => {
            const target = btn.getAttribute("data-to");
            if (target) goToScreen(target);
        });
    });

    // Intro Hero Spotlight and Speech Card Click-to-Replay
    document.querySelectorAll(".section-intro-card").forEach((card) => {
        const circle = card.querySelector(".hero-avatar-circle");
        const speech = card.querySelector(".section-intro-speech-box");
        const screenEl = card.closest(".interactive-screen");
        const playIntroSpeech = () => {
            const screenKey = screenEl?.getAttribute("data-screen");
            if (screenKey && SCREEN_INTRO_PROMPTS[screenKey]) {
                unlockAudio();
                const intro = SCREEN_INTRO_PROMPTS[screenKey];
                speakViaWebSpeech(intro.text, intro.avatar);
            }
        };
        circle?.addEventListener("click", playIntroSpeech);
        speech?.addEventListener("click", playIntroSpeech);
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
            window.location.reload();
        }
    });

    // =========================================================================
    // ACADEMIC OPTIONS POPULATOR
    // =========================================================================
    const populateTrackDropdown = (selectedMajor) => {
        if (!trackSelect) return;
        trackSelect.innerHTML = `<option value="Not Applicable">General / No Specific Track</option>`;
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
    };

    const populateMinorDropdown = () => {
        if (!minorSelect) return;
        minorSelect.innerHTML = `<option value="Not Applicable">None / Not Applicable</option>`;
        (academicOptions.minors || []).forEach((m) => {
            if (!m || m === "Not Applicable") return;
            const opt = document.createElement("option");
            opt.value = m;
            opt.textContent = m;
            minorSelect.appendChild(opt);
        });
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
            majorSelect.innerHTML = `<option value="">Select your Major...</option>`;
            academicOptions.majors.forEach((m) => {
                const opt = document.createElement("option");
                opt.value = m;
                opt.textContent = m;
                if (m === "Computer Science") opt.selected = true;
                majorSelect.appendChild(opt);
            });
            populateTrackDropdown(majorSelect.value);
        }
        populateMinorDropdown();
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

    // Initialize application: Start on Section 1 Intro with opening prompt voice
    loadAcademicOptions();
    goToScreen("intro-1");
});
