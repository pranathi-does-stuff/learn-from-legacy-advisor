/**
 * Section 2 Controller (Course Advising & Electives)
 */
document.addEventListener("DOMContentLoaded", async () => {
    const state = QuizApp.getQuizState();
    let sec2Data = QuizApp.getSectionData(2);

    // Introduction Stage Elements
    const introStage = document.getElementById("section-intro-stage");
    const questionsStage = document.getElementById("section-questions-stage");
    const btnStartQuestions = document.getElementById("btn-start-section-questions");
    const introMsgEl = document.getElementById("advisor-intro-message");
    const introText = introMsgEl ? introMsgEl.textContent.trim() : "";
    const introReplayBtn = document.getElementById("intro-replay-voice-btn");

    const base64Audio = sec2Data ? sec2Data.audio : null;

    // Auto-play voice on load
    setTimeout(async () => {
        try {
            await QuizApp.playReportAudio(introText, base64Audio, 2);
        } catch (e) {
            console.log("Intro audio playback info:", e);
        }
    }, 400);

    if (introReplayBtn) {
        introReplayBtn.addEventListener("click", () => {
            QuizApp.playReportAudio(introText, base64Audio, 2);
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

    const renderMatches = (data) => {
        if (!data) return;

        if (data.text) {
            QuizApp.avatarSayTextOnly(data.text, 2);
        }

        const grid = document.getElementById("section-2-matches-grid");
        const matches = data.matches || [];

        if (grid) {
            grid.innerHTML = "";
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
                        <p class="alum-employer">${QuizApp.escapeHtml(m.first_employer || "Tech Company")} &bull; <span style="color:var(--avatar-green);">${QuizApp.escapeHtml(state.user.major)}</span></p>
                        <p style="font-size:0.83rem; color:var(--text-secondary); margin-bottom:0.75rem;">
                            ${QuizApp.escapeHtml(m.recommendation_note || "Mastered core algorithms and systems programming sequences early.")}
                        </p>
                    </div>
                    <div class="alum-highlight-tags">
                        ${electivesList}
                    </div>
                `;
                grid.appendChild(card);
            });
        }

        const checklistContainer = document.getElementById("interactive-course-checklist");
        if (checklistContainer) {
            checklistContainer.innerHTML = "";
            const sampleCourses = [
                { id: "CMSC 201", title: "Computer Science I (Python)", type: "Core" },
                { id: "CMSC 202", title: "Computer Science II (C++)", type: "Core" },
                { id: "CMSC 341", title: "Data Structures", type: "Gateway Core" },
                { id: "CMSC 313", title: "Assembly & Computer Organization", type: "Core" },
                { id: "CMSC 441", title: "Design & Analysis of Algorithms", type: "Advanced Core" },
                { id: "CMSC 471", title: "Artificial Intelligence", type: "High-Yield Elective" },
                { id: "CMSC 426", title: "Principles of Computer Security", type: "Elective" },
                { id: "CMSC 461", title: "Database Management Systems", type: "Elective" },
                { id: "CMSC 447", title: "Software Engineering Capstone", type: "Capstone" },
            ];

            const checkedList = state.user.checkedCourses || ["CMSC 201", "CMSC 202"];

            sampleCourses.forEach((c) => {
                const item = document.createElement("div");
                item.className = `checklist-item ${checkedList.includes(c.id) ? "checked" : ""}`;
                item.innerHTML = `
                    <div class="chk-box">${checkedList.includes(c.id) ? "✓" : ""}</div>
                    <div class="chk-details">
                        <span class="chk-id">${QuizApp.escapeHtml(c.id)} &bull; ${QuizApp.escapeHtml(c.type)}</span>
                        <span class="chk-title">${QuizApp.escapeHtml(c.title)}</span>
                    </div>
                `;
                item.addEventListener("click", () => {
                    item.classList.toggle("checked");
                    const isChecked = item.classList.contains("checked");
                    item.querySelector(".chk-box").textContent = isChecked ? "✓" : "";
                    let updated = state.user.checkedCourses || [];
                    if (isChecked) {
                        if (!updated.includes(c.id)) updated.push(c.id);
                        QuizApp.avatarSayTextOnly(`Marked ${c.id} (${c.title}) as planned/completed.`, 2);
                    } else {
                        updated = updated.filter((id) => id !== c.id);
                        QuizApp.avatarSayTextOnly(`Removed ${c.id} from your active course plan.`, 2);
                    }
                    state.user.checkedCourses = updated;
                    QuizApp.updateUserData({ checkedCourses: updated });
                });
                checklistContainer.appendChild(item);
            });
        }
    };

    if (!sec2Data) {
        try {
            const res = await fetch("/api/generate-report", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    section_name: "course_advising",
                    user_data: state.user,
                }),
            });
            if (res.ok) {
                sec2Data = await res.json();
                QuizApp.saveSectionData(2, sec2Data);
            }
        } catch (e) {
            console.warn("Could not fetch section 2 data:", e);
        }
    }

    renderMatches(sec2Data);

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
