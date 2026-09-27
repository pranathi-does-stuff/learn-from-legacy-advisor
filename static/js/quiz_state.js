/**
 * Global Quiz State & Cross-Page Persistence Engine
 * Maintains user answers, section reports, and audio engine across all pages.
 */
const STORAGE_KEY = "legacy_advisory_state_v2";

const DEFAULT_QUIZ_STATE = {
    user: {
        classYear: "Freshman",
        name: "",
        major: "Computer Science",
        majorTrack: "General",
        minor: "None",
        gpa: "3.65",
        creditsCompleted: "45",
        targetCompanyIndustry: "Software Products",
        targetSalary: "$105,000",
        targetLocation: "Baltimore / Washington DC / Remote",
        careerGoals: "Software Engineer",
        expectedGradYear: "2028",
        selectedActivities: ["HackUMBC", "ACM Student Chapter"],
        customActivity: "",
        skills: "Python, Java, Git, SQL, Linux",
        internships: "",
    },
    sections: {
        1: null,
        2: null,
        3: null,
        4: null,
        5: null,
    },
    voiceEnabled: true,
};

const QuizApp = {
    getQuizState() {
        try {
            const raw = sessionStorage.getItem(STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                return {
                    user: { ...DEFAULT_QUIZ_STATE.user, ...(parsed.user || {}) },
                    sections: { ...DEFAULT_QUIZ_STATE.sections, ...(parsed.sections || {}) },
                    voiceEnabled: parsed.voiceEnabled !== undefined ? parsed.voiceEnabled : true,
                };
            }
        } catch (e) {
            console.warn("Error reading quiz state from sessionStorage:", e);
        }
        return JSON.parse(JSON.stringify(DEFAULT_QUIZ_STATE));
    },

    saveQuizState(state) {
        try {
            sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        } catch (e) {
            console.warn("Error saving quiz state to sessionStorage:", e);
        }
    },

    updateUserData(partialUser) {
        const state = this.getQuizState();
        state.user = { ...state.user, ...partialUser };
        this.saveQuizState(state);
        return state.user;
    },

    saveSectionData(sectionNum, data) {
        const state = this.getQuizState();
        state.sections[sectionNum] = data;
        this.saveQuizState(state);
    },

    getSectionData(sectionNum) {
        const state = this.getQuizState();
        return state.sections[sectionNum] || null;
    },

    resetQuizState() {
        sessionStorage.removeItem(STORAGE_KEY);
    },

    // Audio Playback Engine
    currentAudio: null,

    stopAllSpeech() {
        if (this.currentAudio) {
            this.currentAudio.pause();
            this.currentAudio.currentTime = 0;
            this.currentAudio = null;
        }
        if (window.speechSynthesis && window.speechSynthesis.speaking) {
            window.speechSynthesis.cancel();
        }
        this.setAudioWavesVisual(false);
    },

    setAudioWavesVisual(isActive) {
        const wavesList = document.querySelectorAll(".audio-waves");
        wavesList.forEach((w) => {
            w.hidden = !isActive;
        });
        const playBtnLabel = document.getElementById("voice-btn-label");
        if (playBtnLabel) {
            playBtnLabel.textContent = isActive ? "Speaking..." : "Play Voice";
        }
    },

    playBase64Audio(base64Mp3) {
        return new Promise((resolve, reject) => {
            this.stopAllSpeech();
            if (!base64Mp3) return resolve(false);

            try {
                const audioEl = document.getElementById("advisor-audio-element") || new Audio();
                audioEl.src = `data:audio/mp3;base64,${base64Mp3}`;
                this.currentAudio = audioEl;

                this.setAudioWavesVisual(true);

                audioEl.onended = () => {
                    this.setAudioWavesVisual(false);
                    this.currentAudio = null;
                    resolve(true);
                };

                audioEl.onerror = (err) => {
                    this.setAudioWavesVisual(false);
                    this.currentAudio = null;
                    resolve(false);
                };

                const playPromise = audioEl.play();
                if (playPromise !== undefined) {
                    playPromise.catch((err) => {
                        console.log("Audio autoplay prevented or error:", err);
                        this.setAudioWavesVisual(false);
                        resolve(false);
                    });
                }
            } catch (e) {
                this.setAudioWavesVisual(false);
                resolve(false);
            }
        });
    },

    speakWebSpeech(text, avatarNum) {
        return new Promise((resolve) => {
            this.stopAllSpeech();
            if (!("speechSynthesis" in window) || !text) return resolve(false);

            try {
                const utterance = new SpeechSynthesisUtterance(text);
                utterance.rate = 1.0;

                const pitches = { 1: 1.0, 2: 1.05, 3: 0.95, 4: 1.1, 5: 1.0 };
                utterance.pitch = pitches[avatarNum] || 1.0;

                this.setAudioWavesVisual(true);

                utterance.onend = () => {
                    this.setAudioWavesVisual(false);
                    resolve(true);
                };
                utterance.onerror = () => {
                    this.setAudioWavesVisual(false);
                    resolve(false);
                };

                window.speechSynthesis.speak(utterance);
            } catch (e) {
                this.setAudioWavesVisual(false);
                resolve(false);
            }
        });
    },

    async playReportAudio(text, base64Audio, avatarNum = 1) {
        if (base64Audio) {
            const played = await this.playBase64Audio(base64Audio);
            if (played) return;
        }
        if (text) {
            await this.speakWebSpeech(text, avatarNum);
        }
    },

    avatarSayTextOnly(text, avatarNum) {
        const bubble = document.getElementById("thought-bubble");
        const bubbleText = document.getElementById("thought-bubble-text");
        if (bubbleText) {
            bubbleText.textContent = text;
        }
        if (bubble) {
            bubble.classList.remove("pop");
            void bubble.offsetWidth;
            bubble.classList.add("pop");
        }
    },

    escapeHtml(str) {
        if (str === null || str === undefined) return "";
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    },

    // Hardcoded instant text reactions
    HARDCODED_REACTIONS: {
        classYear: (val) => {
            const r = {
                Freshman: "Excellent! Starting in your Freshman year gives you maximum runway to target gateway electives and internships.",
                Sophomore: "Sophomore year is critical! You are poised to clear gateway prerequisites and land your first research or tech role.",
                Junior: "Junior standing! We are focusing immediately on upper-level electives, technical leadership, and summer internships.",
                Senior: "Senior year! Our priority is capstone excellence, interview preparation, and negotiating top starting compensation.",
                "More than 4 years": "Understood. We will streamline your remaining requirements to accelerate degree completion and industry transition.",
            };
            return r[val] || `Noted your standing as ${val}.`;
        },
        major: (val) => `Selected ${val}. Benchmarking against alumni distributions in Tiger Data.`,
        track: (val) => `Specializing in ${val}. Aligning upper-level electives.`,
        gpa: (val) => {
            const n = parseFloat(val);
            if (isNaN(n)) return "Enter your cumulative GPA to see alumni benchmarks.";
            if (n >= 3.8) return `Exceptional ${n.toFixed(2)} GPA! You qualify for top honors and competitive research programs.`;
            if (n >= 3.5) return `Solid ${n.toFixed(2)} GPA! You meet requirements for major defense contractors and top tech firms.`;
            if (n >= 3.0) return `Good standing at ${n.toFixed(2)} GPA. We will highlight project portfolios and internships.`;
            return `Noted ${n.toFixed(2)} GPA. We will emphasize hands-on project accomplishments and technical certifications.`;
        },
        credits: (val) => `Logged ${val} earned credits. Updating graduation timeline.`,
        industry: (val) => `Targeting ${val}. Benchmarking against top compensation trajectories in this sector.`,
        salary: (val) => `Targeting ${val} starting compensation. Highlighting top quartile alumni milestones.`,
        goals: (val) => `Targeting ${val}. Tailoring elective and internship recommendations.`,
        activity: (name) => `Added ${name} to your profile. Co-curricular engagement builds crucial leadership signals.`,
        customActivity: (name) => `Added "${name}". Unique initiatives differentiate you in technical screens.`,
        skill: (name) => `Added ${name}. High-yield skill aligned with alumni job requirements.`,
        skillsInput: (val) => `Updated skills: "${val}". Matching against employer requirements.`,
        internshipsInput: (val) => `Logged work experience: "${val}". Internships correlate with 40%+ higher starting offers.`,
    },

    bindVoiceReplayListeners() {
        const replayBtn = document.getElementById("voice-replay-btn") || document.getElementById("intro-replay-voice-btn");
        if (replayBtn) {
            replayBtn.addEventListener("click", () => {
                const bubbleText = document.getElementById("thought-bubble-text") || document.getElementById("advisor-intro-message");
                const text = bubbleText ? bubbleText.textContent.trim() : "";
                if (text) {
                    this.speakWebSpeech(text, 1);
                }
            });
        }
    },
};

window.QuizApp = QuizApp;
