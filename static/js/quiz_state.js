/**
 * Global Quiz State & Cross-Page Persistence Engine
 * Maintains user answers, section reports, and audio engine across all pages.
 */
const STORAGE_KEY = "legacy_advisory_state_v2";

const DEFAULT_QUIZ_STATE = {
    activeUserId: null,
    user: {
        classYear: "",
        name: "",
        major: "",
        majorTrack: "",
        minor: "",
        gpa: "",
        creditsCompleted: "",
        targetCompanyIndustry: "",
        targetSalary: "",
        targetLocation: "",
        careerGoals: "",
        expectedGradYear: "2028",
        selectedActivities: [],
        customActivity: "",
        skills: "",
        skillsList: [],
        experienceCategories: [],
        categoryDetails: {},
        jobRoles: [],
        internships: "",
        noRequiredCourses: false,
        noElectives: false,
        noPlannedCourses: false,
        noCurrentActivities: false,
        noPriorExperience: false,
        noPriorJobExperience: false,
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

// Global session cleanup on unload, page close, or hard refresh
document.addEventListener("visibilitychange", () => {
    try {
        const state = QuizApp.getQuizState();
        if (document.visibilityState === "hidden" && state && state.activeUserId) {
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
    } catch (_e) { }
});

window.addEventListener("pagehide", () => {
    try {
        const state = QuizApp.getQuizState();
        if (state && state.activeUserId) {
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
    } catch (_e) { }
});

const QuizApp = {
    shouldResetFormInputsOnReload() {
        const navEntries = performance.getEntriesByType ? performance.getEntriesByType("navigation") : [];
        if (navEntries.length > 0) {
            return navEntries[0].type === "reload";
        }

        if (window.performance && window.performance.navigation) {
            return window.performance.navigation.type === 1;
        }

        return false;
    },

    getQuizState() {
        try {
            const raw = sessionStorage.getItem(STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                return {
                    activeUserId: parsed.activeUserId !== undefined ? parsed.activeUserId : null,
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

    // Audio Playback Engine (Strict Audio Management)
    currentAudio: null,

    stopAllSpeech() {
        if (this.currentAudio) {
            try {
                this.currentAudio.pause();
                this.currentAudio.currentTime = 0;
            } catch (_e) { }
            this.currentAudio = null;
        }
        if (window.currentAudio) {
            try {
                window.currentAudio.pause();
                window.currentAudio.currentTime = 0;
            } catch (_e) { }
            window.currentAudio = null;
        }
        if (window.speechSynthesis) {
            try {
                window.speechSynthesis.cancel();
            } catch (_e) { }
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
        return new Promise((resolve) => {
            this.stopAllSpeech();
            if (!base64Mp3) return resolve(false);

            try {
                const audioEl = document.getElementById("advisor-audio-element") || new Audio();
                audioEl.src = `data:audio/mp3;base64,${base64Mp3}`;
                this.currentAudio = audioEl;
                window.currentAudio = audioEl;

                this.setAudioWavesVisual(true);

                audioEl.onended = () => {
                    this.setAudioWavesVisual(false);
                    this.currentAudio = null;
                    window.currentAudio = null;
                    resolve(true);
                };

                audioEl.onpause = () => {
                    this.setAudioWavesVisual(false);
                };

                audioEl.onerror = () => {
                    this.setAudioWavesVisual(false);
                    this.currentAudio = null;
                    window.currentAudio = null;
                    resolve(false);
                };

                const playPromise = audioEl.play();
                if (playPromise !== undefined) {
                    playPromise.catch((err) => {
                        console.log("Audio autoplay prevented or error:", err);
                        this.setAudioWavesVisual(false);

                        // If autoplay blocked by browser policy, queue playback on first user interaction
                        const unlockHandler = () => {
                            document.removeEventListener("pointerdown", unlockHandler);
                            document.removeEventListener("click", unlockHandler);
                            audioEl.play().then(() => {
                                this.setAudioWavesVisual(true);
                            }).catch(() => { });
                        };
                        document.addEventListener("pointerdown", unlockHandler, { once: true });
                        document.addEventListener("click", unlockHandler, { once: true });

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
                if (window.speechSynthesis.paused) {
                    window.speechSynthesis.resume();
                }
                window.speechSynthesis.cancel();

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

    async playAvatarDialogue(text, avatarNum = 1) {
        if (!text) return;
        this.avatarSayTextOnly(text, avatarNum);

        // Attempt server-side ElevenLabs audio generation
        try {
            const res = await fetch("/api/section-voice", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text: text, avatar_num: avatarNum }),
            });
            if (res.ok) {
                const data = await res.json();
                if (data.audio) {
                    const played = await this.playBase64Audio(data.audio);
                    if (played) return;
                }
            }
        } catch (_e) { }

        // Fallback to Web Speech API
        await this.speakWebSpeech(text, avatarNum);
    },

    avatarSayTextOnly(text, avatarNum) {
        const introMsg = document.getElementById("advisor-intro-message");
        if (introMsg) {
            introMsg.textContent = text;
        }
        const bubbleText = document.getElementById("thought-bubble-text");
        if (bubbleText) {
            bubbleText.textContent = text;
        }
        const reportBubbleText = document.getElementById("report-thought-bubble-text");
        if (reportBubbleText) {
            reportBubbleText.textContent = text;
        }

        const bubble = document.getElementById("thought-bubble");
        if (bubble) {
            bubble.classList.remove("pop");
            void bubble.offsetWidth;
            bubble.classList.add("pop");
        }
        const reportBubble = document.getElementById("report-thought-bubble");
        if (reportBubble) {
            reportBubble.classList.remove("pop");
            void reportBubble.offsetWidth;
            reportBubble.classList.add("pop");
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

    bindVoiceReplayListeners(avatarNum = 1) {
        const replayBtn = document.getElementById("voice-replay-btn");
        if (replayBtn) {
            replayBtn.onclick = () => {
                const bubbleText = document.getElementById("thought-bubble-text") || document.getElementById("report-thought-bubble-text");
                const text = bubbleText ? bubbleText.textContent.trim() : "";
                if (text) {
                    this.playAvatarDialogue(text, avatarNum);
                }
            };
        }
        const introReplayBtn = document.getElementById("intro-replay-voice-btn");
        if (introReplayBtn) {
            introReplayBtn.onclick = () => {
                const introText = document.getElementById("advisor-intro-message")?.textContent?.trim() || "";
                if (introText) {
                    this.playAvatarDialogue(introText, avatarNum);
                }
            };
        }
    },
};

window.QuizApp = QuizApp;
