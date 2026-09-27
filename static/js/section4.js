/**
 * Section 4 Controller: Professional Involvement (Skills, Experiences & Job Roles)
 * Sequential 3-Screen Question Flow + Category Detail Popups + Stage C Final Report
 */
document.addEventListener("DOMContentLoaded", async () => {
    const state = QuizApp.getQuizState();
    let sec4Data = QuizApp.getSectionData(4);
    const shouldClearInputsOnReload = QuizApp.shouldResetFormInputsOnReload();

    // =========================================================================
    // CATEGORY METADATA DEFINITIONS (7 EXACT CATEGORIES)
    // =========================================================================
    const CATEGORY_METADATA = {
        "Internships": {
            icon: "💼",
            title: "Internship Experience Details",
            badge: "Industry Internship",
            field1: { label: "Internship Role / Title", placeholder: "e.g., Software Engineering Intern, Systems Analyst", key: "title" },
            field2: { label: "Company / Employer", placeholder: "e.g., Northrop Grumman, Amazon, T. Rowe Price", key: "employer" },
            field3: { label: "Time Active / Term", placeholder: "e.g., Summer 2025 (3 Months)", key: "timeActive" },
            desc: { label: "Key Responsibilities & Impact", placeholder: "e.g., Built automated testing pipelines in Python, resolved backend bugs, participated in daily sprint reviews...", key: "description" },
        },
        "Co-op": {
            icon: "🏢",
            title: "Co-op Experience Details",
            badge: "Full-Time Co-op",
            field1: { label: "Co-op Role Title", placeholder: "e.g., Systems Engineering Co-op, Embedded SWE Co-op", key: "title" },
            field2: { label: "Company / Organization", placeholder: "e.g., GE Aerospace, Toyota, Johns Hopkins APL", key: "employer" },
            field3: { label: "Time Active / Duration", placeholder: "e.g., Spring & Fall 2024 (6 Months)", key: "timeActive" },
            desc: { label: "Key Responsibilities & Scope", placeholder: "e.g., Rotational engineering placement, verified hardware/software integration, tested telemetry...", key: "description" },
        },
        "Research": {
            icon: "🔬",
            title: "Research Experience Details",
            badge: "Academic & Lab Research",
            field1: { label: "Lab / Project Name", placeholder: "e.g., Autonomous Robotics Lab, NLP Research Group", key: "title" },
            field2: { label: "Faculty Advisor / Institution", placeholder: "e.g., Dr. Nicholas / UMBC CSEE Dept", key: "employer" },
            field3: { label: "Time Active / Duration", placeholder: "e.g., Fall 2024 – Present (2 Semesters)", key: "timeActive" },
            desc: { label: "Research Focus & Contributions", placeholder: "e.g., Trained deep learning models on PyTorch, evaluated dataset metrics, co-authored conference paper...", key: "description" },
        },
        "Tutoring": {
            icon: "📚",
            title: "Tutoring & Academic Support Details",
            badge: "Academic Instruction",
            field1: { label: "Course / Subject Taught", placeholder: "e.g., CMSC 201, Data Structures, Calculus I/II", key: "title" },
            field2: { label: "Department / Organization", placeholder: "e.g., UMBC Academic Success Center, CS Department", key: "employer" },
            field3: { label: "Time Active / Duration", placeholder: "e.g., Academic Year 2024–2025 (10 hrs/week)", key: "timeActive" },
            desc: { label: "Key Responsibilities & Impact", placeholder: "e.g., Mentored 40+ students weekly in programming fundamentals, debugged lab code, led exam review sessions...", key: "description" },
        },
        "Campus Job": {
            icon: "🏛️",
            title: "Campus Job Experience Details",
            badge: "On-Campus Employment",
            field1: { label: "Job Title / Role", placeholder: "e.g., Student IT Helpdesk Specialist, Lab Assistant", key: "title" },
            field2: { label: "Campus Department / Office", placeholder: "e.g., Division of Information Technology (DoIT), Library", key: "employer" },
            field3: { label: "Time Active / Duration", placeholder: "e.g., 2 Semesters (10-15 hrs/week)", key: "timeActive" },
            desc: { label: "Key Responsibilities & Duties", placeholder: "e.g., Supported campus network setup, managed hardware inventory, resolved student technical tickets...", key: "description" },
        },
        "Peer Mentoring": {
            icon: "🤝",
            title: "Peer Mentoring & Leadership Details",
            badge: "Student Mentorship",
            field1: { label: "Program / Organization", placeholder: "e.g., CWIT Scholars, First-Year Experience, Meyerhoff", key: "title" },
            field2: { label: "Role / Position", placeholder: "e.g., Peer Mentor, Lead Student Ambassador", key: "employer" },
            field3: { label: "Time Active / Duration", placeholder: "e.g., Fall 2024 – Spring 2025", key: "timeActive" },
            desc: { label: "Mentoring Focus & Activities", placeholder: "e.g., Mentored 8 incoming STEM freshmen on coursework planning, study strategies, and campus opportunities...", key: "description" },
        },
        "Certifications": {
            icon: "📜",
            title: "Industry Certifications & Credentials",
            badge: "Technical Credential",
            field1: { label: "Certification Name", placeholder: "e.g., AWS Certified Cloud Practitioner, CompTIA Security+", key: "title" },
            field2: { label: "Issuing Organization / Vendor", placeholder: "e.g., Amazon Web Services, CompTIA, Microsoft, Cisco", key: "employer" },
            field3: { label: "Date Earned / Validity", placeholder: "e.g., June 2025, Active", key: "timeActive" },
            desc: { label: "Skills Validated & Scope", placeholder: "e.g., Validated expertise in cloud infrastructure, IAM security policies, VPC networking, and automation...", key: "description" },
        },
    };

    // =========================================================================
    // STAGE A: STANDALONE INTRO SCREEN
    // =========================================================================
    const introStage = document.getElementById("section-intro-stage");
    const questionsStage = document.getElementById("section-questions-stage");
    const reportStage = document.getElementById("section-report-stage");
    const btnStartQuestions = document.getElementById("btn-start-section-questions");
    const introMsgEl = document.getElementById("advisor-intro-message");
    const introText = introMsgEl ? introMsgEl.textContent.trim() : "";
    const introReplayBtn = document.getElementById("intro-replay-voice-btn");

    // Start Avatar 4's intro speech as soon as the page is initialized.
    void (async () => {
        try {
            await QuizApp.playAvatarDialogue(introText, 4);
        } catch (e) {
            console.log("Intro audio playback info:", e);
        }
    })();

    if (introReplayBtn) {
        introReplayBtn.addEventListener("click", () => {
            QuizApp.playAvatarDialogue(introText, 4);
        });
    }

    if (btnStartQuestions) {
        btnStartQuestions.addEventListener("click", () => {
            QuizApp.stopAllSpeech();
            if (introStage) {
                introStage.hidden = true;
                introStage.style.display = "none";
                introStage.remove();
            }
            if (questionsStage) {
                questionsStage.hidden = false;
                questionsStage.removeAttribute("hidden");
                questionsStage.style.display = "grid";
                document.querySelector(".page-wrapper")?.classList.add("section1-immersive");
            }
            showScreen(1);
            QuizApp.playAvatarDialogue("Add your core technical and soft skills, or pick from popular keywords.", 4);
            window.scrollTo({ top: 0, behavior: "smooth" });
        });
    }

    // =========================================================================
    // SCREEN CONTROLLER (1: Skills, 2: Categories, 3: Job Roles)
    // =========================================================================
    const screen1 = document.getElementById("substep-general-skills");
    const screen2 = document.getElementById("substep-experience-categories");
    const screen3 = document.getElementById("substep-job-experience");

    const showScreen = (screenNumber) => {
        if (screen1) screen1.hidden = (screenNumber !== 1);
        if (screen2) screen2.hidden = (screenNumber !== 2);
        if (screen3) screen3.hidden = (screenNumber !== 3);
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    // =========================================================================
    // SCREEN 1: DYNAMIC TAG-INPUT (GENERAL SKILLS)
    // =========================================================================
    const chipsWrapper = document.getElementById("skills-chips-wrapper");
    const tagInput = document.getElementById("skills-tag-input");
    const suggestedPillsContainer = document.getElementById("suggested-skills-pills");
    const skillsError = document.getElementById("skills-required-error");
    const btnToCategories = document.getElementById("btn-to-experience-categories");

    let activeSkills = [];
    if (!shouldClearInputsOnReload) {
        if (Array.isArray(state.user.skillsList) && state.user.skillsList.length > 0) {
            activeSkills = [...state.user.skillsList];
        } else if (state.user.skills) {
            activeSkills = state.user.skills.split(",").map(s => s.trim()).filter(Boolean);
        }
    }

    const syncSuggestedPills = () => {
        const lowerList = activeSkills.map(s => s.toLowerCase());
        suggestedPillsContainer?.querySelectorAll(".skill-pill").forEach(pill => {
            const skill = (pill.getAttribute("data-skill") || pill.textContent).trim().toLowerCase();
            const isActive = lowerList.some(s => s === skill || s.includes(skill) || skill.includes(s));
            pill.classList.toggle("active", isActive);
        });
    };

    const renderSuggestedSkills = (skills) => {
        if (!suggestedPillsContainer) return;
        suggestedPillsContainer.replaceChildren();

        if (!Array.isArray(skills) || skills.length === 0) {
            const message = document.createElement("span");
            message.style.cssText = "color:var(--text-muted); font-size:0.85rem;";
            message.textContent = "No matched alumni skill tags are available yet.";
            suggestedPillsContainer.appendChild(message);
            return;
        }

        skills.forEach((skill) => {
            const pill = document.createElement("button");
            pill.type = "button";
            pill.className = "skill-pill";
            pill.dataset.skill = skill;
            pill.textContent = skill;
            suggestedPillsContainer.appendChild(pill);
        });
        syncSuggestedPills();
    };

    const loadAlumniSkillSuggestions = async () => {
        if (!suggestedPillsContainer) return;
        try {
            const response = await fetch("/api/professional-skill-suggestions", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ user_data: QuizApp.getQuizState().user }),
            });
            if (!response.ok) throw new Error(`Skill suggestions request failed (${response.status})`);
            const data = await response.json();
            renderSuggestedSkills(data.skills);
        } catch (error) {
            console.warn("Could not load alumni-matched skill suggestions:", error);
            renderSuggestedSkills([]);
        }
    };

    const renderSkillsChips = () => {
        if (!chipsWrapper) return;
        chipsWrapper.replaceChildren();

        activeSkills.forEach((skill, idx) => {
            const chip = document.createElement("span");
            chip.className = "tag-chip";
            chip.innerHTML = `
                <span class="tag-chip-label">${QuizApp.escapeHtml(skill)}</span>
                <button type="button" class="tag-chip-remove" data-index="${idx}" title="Remove ${QuizApp.escapeHtml(skill)}" aria-label="Remove ${QuizApp.escapeHtml(skill)}">&times;</button>
            `;
            chipsWrapper.appendChild(chip);
        });

        chipsWrapper.querySelectorAll(".tag-chip-remove").forEach(btn => {
            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                const index = parseInt(btn.getAttribute("data-index"), 10);
                if (!isNaN(index) && index >= 0 && index < activeSkills.length) {
                    const removed = activeSkills.splice(index, 1)[0];
                    renderSkillsChips();
                    syncSuggestedPills();
                    saveSkillsState();
                    QuizApp.avatarSayTextOnly(`Removed ${removed} from skills.`, 4);
                }
            });
        });

        syncSuggestedPills();
    };

    const addSkill = (val) => {
        const cleaned = (val || "").trim().replace(/^[,;\s]+|[,;\s]+$/g, "");
        if (!cleaned) return false;

        if (!activeSkills.some(s => s.toLowerCase() === cleaned.toLowerCase())) {
            activeSkills.push(cleaned);
            renderSkillsChips();
            saveSkillsState();
            if (skillsError) skillsError.hidden = true;
            return true;
        }
        return false;
    };

    const saveSkillsState = () => {
        QuizApp.updateUserData({
            skills: activeSkills.join(", "),
            skillsList: activeSkills,
        });
    };

    if (tagInput) {
        tagInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.key === ",") {
                e.preventDefault();
                const val = tagInput.value;
                if (val.trim()) {
                    if (addSkill(val)) {
                        tagInput.value = "";
                    }
                }
            } else if (e.key === "Backspace" && !tagInput.value && activeSkills.length > 0) {
                activeSkills.pop();
                renderSkillsChips();
                saveSkillsState();
            }
        });

        tagInput.addEventListener("blur", () => {
            const val = tagInput.value;
            if (val.trim()) {
                if (addSkill(val)) {
                    tagInput.value = "";
                }
            }
        });
    }

    suggestedPillsContainer?.addEventListener("click", (event) => {
        const pill = event.target.closest(".skill-pill");
        if (!pill || !suggestedPillsContainer.contains(pill)) return;
        const skill = (pill.getAttribute("data-skill") || pill.textContent).trim();
        if (!skill) return;
        const index = activeSkills.findIndex(s => s.toLowerCase() === skill.toLowerCase());

        if (index >= 0) {
            activeSkills.splice(index, 1);
            renderSkillsChips();
            saveSkillsState();
            QuizApp.avatarSayTextOnly(`Removed ${skill}.`, 4);
        } else {
            addSkill(skill);
            QuizApp.avatarSayTextOnly(QuizApp.HARDCODED_REACTIONS.skill(skill), 4);
        }
    });

    renderSkillsChips();
    loadAlumniSkillSuggestions();

    if (btnToCategories) {
        btnToCategories.addEventListener("click", () => {
            if (tagInput && tagInput.value.trim()) {
                addSkill(tagInput.value.trim());
                tagInput.value = "";
            }

            if (activeSkills.length === 0) {
                if (skillsError) {
                    skillsError.textContent = "Please add at least one technical or soft skill before continuing.";
                    skillsError.hidden = false;
                }
                if (tagInput) tagInput.focus();
                return;
            }

            saveSkillsState();
            showScreen(2);
            QuizApp.playAvatarDialogue("Now select any experiential learning categories you have completed.", 4);
        });
    }

    // =========================================================================
    // SCREEN 2: EXPERIENCE CATEGORIES + DYNAMIC DETAIL POPUPS / PANELS
    // =========================================================================
    const categoryCards = document.querySelectorAll(".experience-category-card");
    const categoryDetailsContainer = document.getElementById("category-details-container");
    const noneCategoriesCheckbox = document.getElementById("none-experience-categories");
    const categoriesError = document.getElementById("experience-categories-error");
    const btnBackToSkills = document.getElementById("btn-back-to-skills");
    const btnToJobExperience = document.getElementById("btn-to-job-experience");

    let savedCategories = (!shouldClearInputsOnReload && Array.isArray(state.user.experienceCategories))
        ? state.user.experienceCategories
        : [];

    let categoryDetailsMap = (!shouldClearInputsOnReload && state.user.categoryDetails && typeof state.user.categoryDetails === "object")
        ? { ...state.user.categoryDetails }
        : {};

    const getBaseCategoryName = (detailKey) => String(detailKey).replace(/ #\d+$/, "");

    const addCategoryEntry = (baseCategory) => {
        let entryNumber = 2;
        while (categoryDetailsMap[`${baseCategory} #${entryNumber}`]) entryNumber += 1;
        const detailKey = `${baseCategory} #${entryNumber}`;
        categoryDetailsMap[detailKey] = {};
        syncCategoryDetailsPanels();
        categoryDetailsContainer?.querySelector(`.category-detail-panel[data-category="${detailKey}"] input`)?.focus();
    };

    const createCategoryDetailPanel = (detailKey) => {
        const baseCategory = getBaseCategoryName(detailKey);
        const meta = CATEGORY_METADATA[baseCategory] || {
            icon: "💼",
            title: `${baseCategory} Details`,
            badge: "Experience Category",
            field1: { label: "Role / Position", placeholder: "e.g., Role Title", key: "title" },
            field2: { label: "Organization / Employer", placeholder: "e.g., Organization", key: "employer" },
            field3: { label: "Time Active / Duration", placeholder: "e.g., Term / Duration", key: "timeActive" },
            desc: { label: "Key Responsibilities & Highlights", placeholder: "e.g., Summary of key activities and impact...", key: "description" },
        };

        const existing = categoryDetailsMap[detailKey] || {};
        const entryLabel = detailKey === baseCategory ? meta.title : `${meta.title} (${detailKey})`;
        const val1 = existing.title || "";
        const val2 = existing.employer || "";
        const val3 = existing.timeActive || "";
        const valDesc = existing.description || "";

        const panel = document.createElement("div");
        panel.className = "category-detail-panel";
        panel.dataset.category = detailKey;

        panel.innerHTML = `
            <div class="category-detail-header">
                <div class="category-detail-title">
                    <span>${meta.icon}</span>
                    <span>${entryLabel}</span>
                </div>
                <div style="display:flex; align-items:center; gap:0.5rem;">
                    <span class="category-detail-badge">${meta.badge}</span>
                    <button type="button" class="secondary-btn btn-add-category-instance" data-category="${QuizApp.escapeHtml(baseCategory)}" style="padding:0.35rem 0.55rem; font-size:0.72rem;">+ Add another ${QuizApp.escapeHtml(baseCategory)}</button>
                </div>
            </div>
            <div class="category-detail-grid">
                <div class="form-field">
                    <label class="field-label">${meta.field1.label} <span class="required-indicator">Required</span></label>
                    <input type="text" class="text-input cat-input-field" data-cat="${detailKey}" data-field="${meta.field1.key}" placeholder="${meta.field1.placeholder}" value="${QuizApp.escapeHtml(val1)}" />
                </div>
                <div class="form-field">
                    <label class="field-label">${meta.field2.label} <span class="required-indicator">Required</span></label>
                    <input type="text" class="text-input cat-input-field" data-cat="${detailKey}" data-field="${meta.field2.key}" placeholder="${meta.field2.placeholder}" value="${QuizApp.escapeHtml(val2)}" />
                </div>
                <div class="form-field">
                    <label class="field-label">${meta.field3.label} <span class="required-indicator">Required</span></label>
                    <input type="text" class="text-input cat-input-field" data-cat="${detailKey}" data-field="${meta.field3.key}" placeholder="${meta.field3.placeholder}" value="${QuizApp.escapeHtml(val3)}" />
                </div>
            </div>
            <div class="form-field">
                <label class="field-label">${meta.desc.label} <span class="required-indicator">Required</span></label>
                <textarea class="text-input cat-input-field" data-cat="${detailKey}" data-field="${meta.desc.key}" rows="2" placeholder="${meta.desc.placeholder}">${QuizApp.escapeHtml(valDesc)}</textarea>
            </div>
        `;

        panel.querySelectorAll(".cat-input-field").forEach(input => {
            input.addEventListener("input", () => {
                const cat = input.dataset.cat;
                const field = input.dataset.field;
                if (!categoryDetailsMap[cat]) {
                    categoryDetailsMap[cat] = {};
                }
                categoryDetailsMap[cat][field] = input.value.trim();
                QuizApp.updateUserData({ categoryDetails: categoryDetailsMap });
                if (categoriesError) categoriesError.hidden = true;
            });
        });

        panel.querySelector(".btn-add-category-instance")?.addEventListener("click", () => {
            addCategoryEntry(baseCategory);
        });

        return panel;
    };

    const syncCategoryDetailsPanels = () => {
        if (!categoryDetailsContainer) return;
        const selectedCats = getSelectedCategories();

        if (selectedCats.length === 0) {
            categoryDetailsContainer.style.display = "none";
            categoryDetailsContainer.replaceChildren();
            return;
        }

        categoryDetailsContainer.style.display = "flex";

        // Remove panels for unselected categories
        categoryDetailsContainer.querySelectorAll(".category-detail-panel").forEach(panel => {
            const cat = panel.dataset.category;
            if (!selectedCats.includes(getBaseCategoryName(cat))) {
                panel.remove();
                delete categoryDetailsMap[cat];
            }
        });

        // Add panels for newly selected categories
        selectedCats.forEach(cat => {
            let existingPanel = categoryDetailsContainer.querySelector(`.category-detail-panel[data-category="${cat}"]`);
            if (!existingPanel) {
                const newPanel = createCategoryDetailPanel(cat);
                categoryDetailsContainer.appendChild(newPanel);
            }
        });

        Object.keys(categoryDetailsMap)
            .filter(cat => cat !== getBaseCategoryName(cat) && selectedCats.includes(getBaseCategoryName(cat)))
            .forEach(cat => {
                if (!categoryDetailsContainer.querySelector(`.category-detail-panel[data-category="${cat}"]`)) {
                    categoryDetailsContainer.appendChild(createCategoryDetailPanel(cat));
                }
            });

        QuizApp.updateUserData({ categoryDetails: categoryDetailsMap });
    };

    categoryCards.forEach(card => {
        const checkbox = card.querySelector(".experience-cat-checkbox");
        const val = checkbox ? checkbox.value : card.getAttribute("data-category");

        if (savedCategories.includes(val)) {
            if (checkbox) checkbox.checked = true;
            card.classList.add("selected");
        }

        card.addEventListener("click", (e) => {
            if (e.target !== checkbox) {
                if (checkbox) checkbox.checked = !checkbox.checked;
            }
            card.classList.toggle("selected", Boolean(checkbox && checkbox.checked));

            if (checkbox && checkbox.checked && noneCategoriesCheckbox) {
                noneCategoriesCheckbox.checked = false;
            }

            if (categoriesError) categoriesError.hidden = true;
            syncSelectedCategories();
            syncCategoryDetailsPanels();
        });
    });

    if (noneCategoriesCheckbox) {
        noneCategoriesCheckbox.checked = (!shouldClearInputsOnReload && Boolean(state.user.noPriorExperience) && savedCategories.length === 0);

        noneCategoriesCheckbox.addEventListener("change", () => {
            if (noneCategoriesCheckbox.checked) {
                categoryCards.forEach(card => {
                    const cb = card.querySelector(".experience-cat-checkbox");
                    if (cb) cb.checked = false;
                    card.classList.remove("selected");
                });
                categoryDetailsMap = {};
                syncCategoryDetailsPanels();
            }
            if (categoriesError) categoriesError.hidden = true;
            syncSelectedCategories();
        });
    }

    const getSelectedCategories = () => {
        const selected = [];
        categoryCards.forEach(card => {
            const cb = card.querySelector(".experience-cat-checkbox");
            if (cb && cb.checked) {
                selected.push(cb.value);
            }
        });
        return selected;
    };

    const syncSelectedCategories = () => {
        const cats = getSelectedCategories();
        const isNone = Boolean(noneCategoriesCheckbox && noneCategoriesCheckbox.checked);
        QuizApp.updateUserData({
            experienceCategories: cats,
            categoryDetails: categoryDetailsMap,
            noPriorExperience: isNone,
        });
    };

    // Initial render of category details if previously selected
    syncCategoryDetailsPanels();

    if (btnBackToSkills) {
        btnBackToSkills.addEventListener("click", () => {
            showScreen(1);
            QuizApp.playAvatarDialogue("Review or update your technical and professional skills.", 4);
        });
    }

    if (btnToJobExperience) {
        btnToJobExperience.addEventListener("click", () => {
            const cats = getSelectedCategories();
            const isNone = Boolean(noneCategoriesCheckbox && noneCategoriesCheckbox.checked);

            if (cats.length === 0 && !isNone) {
                if (categoriesError) {
                    categoriesError.textContent = "Please select at least one experience category or confirm you have not completed any yet.";
                    categoriesError.hidden = false;
                }
                return;
            }

            syncSelectedCategories();

            // Pre-populate Screen 3 if user added category details and has no custom roles yet
            prefillJobRolesFromCategoryDetails();

            showScreen(3);
            QuizApp.playAvatarDialogue("Your campus jobs are carried over. Add any additional employment roles not already listed.", 4);
        });
    }

    // =========================================================================
    // SCREEN 3: JOB EXPERIENCE (DYNAMIC ROLES)
    // =========================================================================
    const jobRolesContainer = document.getElementById("job-roles-container");
    const btnAddJobRole = document.getElementById("btn-add-job-role");
    const noJobExpCheckbox = document.getElementById("no-prior-job-experience");
    const jobExpError = document.getElementById("job-experience-error");
    const btnBackToCategories = document.getElementById("btn-back-to-categories");
    const btnSubmitReport = document.getElementById("btn-submit-professional-report");
    const spinner = document.getElementById("spinner-generate-report");

    if (btnBackToCategories) {
        btnBackToCategories.addEventListener("click", () => {
            showScreen(2);
            QuizApp.playAvatarDialogue("Review your selected experiential categories.", 4);
        });
    }

    let roleCounter = 0;

    const createJobRoleCard = (title = "", company = "", impact = "", canDelete = true) => {
        roleCounter++;
        const card = document.createElement("div");
        card.className = "job-role-card";
        card.dataset.roleIndex = String(roleCounter);

        const deleteButtonHtml = canDelete
            ? `<button type="button" class="btn-remove-role" title="Remove this role">&times; Remove Role</button>`
            : ``;

        card.innerHTML = `
            <div class="job-role-header">
                <span class="job-role-badge">Role #${roleCounter}</span>
                ${deleteButtonHtml}
            </div>
            <div class="form-grid" style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem; margin-top:0.75rem;">
                <div class="form-field">
                    <label class="field-label">Employment Title <span class="required-indicator">Required</span></label>
                    <input type="text" class="text-input role-title-input" placeholder="e.g., Retail Associate, Community Volunteer, or Freelance Developer" value="${QuizApp.escapeHtml(title)}" />
                </div>
                <div class="form-field">
                    <label class="field-label">Company / Organization <span class="required-indicator">Required</span></label>
                    <input type="text" class="text-input role-company-input" placeholder="e.g., UMBC Department of Computer Science, Northrop Grumman, YMCA" value="${QuizApp.escapeHtml(company)}" />
                </div>
            </div>
            <div class="form-field" style="margin-top: 0.85rem;">
                <label class="field-label">Key Responsibilities &amp; Impact <span class="required-indicator">Required</span></label>
                <textarea class="text-input role-impact-input" rows="3" placeholder="e.g., Mentored 40+ students in Python fundamentals, debugged code in weekly labs, and led grading sessions...">${QuizApp.escapeHtml(impact)}</textarea>
            </div>
        `;

        card.querySelectorAll("input, textarea").forEach(input => {
            input.addEventListener("input", () => {
                if (input.value.trim() && noJobExpCheckbox) {
                    noJobExpCheckbox.checked = false;
                }
                if (jobExpError) jobExpError.hidden = true;
            });
        });

        const removeBtn = card.querySelector(".btn-remove-role");
        if (removeBtn) {
            removeBtn.addEventListener("click", () => {
                card.remove();
                renumberRoleBadges();
            });
        }

        return card;
    };

    const renumberRoleBadges = () => {
        const cards = jobRolesContainer.querySelectorAll(".job-role-card");
        cards.forEach((card, idx) => {
            const badge = card.querySelector(".job-role-badge");
            if (badge) badge.textContent = `Role #${idx + 1}`;
        });
        roleCounter = cards.length;
    };

    const prefillJobRolesFromCategoryDetails = () => {
        const currentRoles = collectJobRoles();
        if (currentRoles.length > 0) return; // User already entered roles

        // Campus jobs are the only category entries carried into additional employment.
        const candidateRoles = [];
        Object.entries(categoryDetailsMap)
            .filter(([detailKey]) => getBaseCategoryName(detailKey) === "Campus Job")
            .forEach(([cat, d]) => {
            if (d && (d.title || d.employer || d.description)) {
                candidateRoles.push({
                    title: d.title || `${cat} Role`,
                    company: d.employer || "Organization",
                    impact: d.description || `Completed ${d.timeActive || '1 term'} active milestone.`,
                });
            }
        });

        if (candidateRoles.length > 0 && jobRolesContainer) {
            jobRolesContainer.replaceChildren();
            candidateRoles.forEach((r, idx) => {
                jobRolesContainer.appendChild(createJobRoleCard(r.title, r.company, r.impact, idx > 0));
            });
            renumberRoleBadges();
        }
    };

    const savedJobRoles = (!shouldClearInputsOnReload && Array.isArray(state.user.jobRoles) && state.user.jobRoles.length > 0)
        ? state.user.jobRoles
        : [];

    if (jobRolesContainer) {
        jobRolesContainer.replaceChildren();
        if (savedJobRoles.length > 0) {
            savedJobRoles.forEach((r, idx) => {
                jobRolesContainer.appendChild(createJobRoleCard(r.title || "", r.company || "", r.impact || "", idx > 0));
            });
        } else {
            jobRolesContainer.appendChild(createJobRoleCard("", "", "", false));
        }
    }

    if (noJobExpCheckbox) {
        noJobExpCheckbox.checked = (!shouldClearInputsOnReload && Boolean(state.user.noPriorJobExperience));

        noJobExpCheckbox.addEventListener("change", () => {
            if (noJobExpCheckbox.checked) {
                jobRolesContainer.querySelectorAll("input, textarea").forEach(el => {
                    el.value = "";
                });
            }
            if (jobExpError) jobExpError.hidden = true;
        });
    }

    if (btnAddJobRole) {
        btnAddJobRole.addEventListener("click", () => {
            if (noJobExpCheckbox) noJobExpCheckbox.checked = false;
            const newCard = createJobRoleCard("", "", "", true);
            jobRolesContainer.appendChild(newCard);
            renumberRoleBadges();
            const firstInput = newCard.querySelector(".role-title-input");
            if (firstInput) firstInput.focus();
        });
    }

    if (btnBackToCategories) {
        btnBackToCategories.addEventListener("click", () => {
            showScreen(2);
        });
    }

    // =========================================================================
    // SUBMISSION & STAGE C REPORT RENDERING
    // =========================================================================
    const collectJobRoles = () => {
        const roles = [];
        if (!jobRolesContainer) return roles;
        jobRolesContainer.querySelectorAll(".job-role-card").forEach(card => {
            const title = (card.querySelector(".role-title-input")?.value || "").trim();
            const company = (card.querySelector(".role-company-input")?.value || "").trim();
            const impact = (card.querySelector(".role-impact-input")?.value || "").trim();
            if (title || company || impact) {
                roles.push({ title, company, impact });
            }
        });
        return roles;
    };

    const renderStageCReport = (data) => {
        if (!data) return;

        // 1. Thought Bubble & Audio
        const reportThoughtBubble = document.getElementById("report-thought-bubble-text") ||
            document.querySelector("#section-report-stage .thought-text");
        if (reportThoughtBubble && data.text) {
            reportThoughtBubble.textContent = data.text;
        }

        // Play Report Audio
        QuizApp.stopAllSpeech();
        if (data.text) {
            QuizApp.playReportAudio(data.text, data.audio, 4);
        }

        const voiceReplayBtn = document.getElementById("report-voice-replay-btn") ||
            document.querySelector("#section-report-stage .voice-replay-btn");
        if (voiceReplayBtn) {
            voiceReplayBtn.onclick = () => {
                QuizApp.playReportAudio(data.text || reportThoughtBubble?.textContent, data.audio, 4);
            };
        }

        const profAnalysis = data.professional_analysis || {};

        // 2. Render Recommended Companies
        const companiesGrid = document.getElementById("recommended-companies-grid");
        if (companiesGrid) {
            companiesGrid.replaceChildren();
            const companies = profAnalysis.recommended_companies || [];
            companies.forEach(c => {
                const card = document.createElement("div");
                card.className = "company-showcase-card";
                card.innerHTML = `
                    <div class="company-card-top">
                        <span class="company-title">${QuizApp.escapeHtml(c.name)}</span>
                        <span class="company-hire-badge">${QuizApp.escapeHtml(c.hire_rate || "High Fit")}</span>
                    </div>
                    <div class="company-subtext"><strong>Sector:</strong> ${QuizApp.escapeHtml(c.industry || "Technology")}</div>
                    <div class="company-subtext"><strong>Entry Roles:</strong> ${QuizApp.escapeHtml(c.role_sample || "Software Specialist")}</div>
                    <div class="company-alumni-count">📊 ${QuizApp.escapeHtml(c.alumni_count || 25)}+ Alumni Placed</div>
                `;
                companiesGrid.appendChild(card);
            });
        }

        // 3. Render Opportunities to Pursue
        const oppGrid = document.getElementById("opportunities-grid");
        if (oppGrid) {
            oppGrid.replaceChildren();
            const opps = profAnalysis.opportunities_to_pursue || [];
            opps.forEach(op => {
                const card = document.createElement("div");
                card.className = "opportunity-item-card";
                card.innerHTML = `
                    <div class="opp-badge-row">
                        <span class="opp-badge">${QuizApp.escapeHtml(op.badge || "Strategy")}</span>
                        <span class="opp-timeframe">${QuizApp.escapeHtml(op.timeframe || "Target Cycle")}</span>
                    </div>
                    <div class="opp-title">${QuizApp.escapeHtml(op.title)}</div>
                    <div class="opp-desc">${QuizApp.escapeHtml(op.description)}</div>
                `;
                oppGrid.appendChild(card);
            });
        }

        // 4. Render Top 3 Alumni Matches (No database IDs displayed!)
        const matchesGrid = document.getElementById("section-4-matches-grid");
        if (matchesGrid) {
            matchesGrid.replaceChildren();
            const matches = data.matches || [];
            matches.forEach((m, idx) => {
                const card = document.createElement("div");
                card.className = "alumni-card";

                const skillsList = (m.skills_mastered || ["Python", "AWS", "SQL", "Git"])
                    .map(s => `<span class="highlight-tag" style="color:var(--avatar-purple);">${QuizApp.escapeHtml(s)}</span>`)
                    .join("");

                const internList = (m.internships_held || [])
                    .slice(0, 2)
                    .map(i => `<div style="font-size:0.78rem; color:var(--text-secondary); margin-top:0.25rem;">&bull; ${QuizApp.escapeHtml(i)}</div>`)
                    .join("");

                card.innerHTML = `
                    <div>
                        <div class="card-top-row">
                            <span class="alum-id-badge">Alumni Match #${idx + 1}</span>
                            <span class="alum-salary-badge">${QuizApp.escapeHtml(m.first_job_annual_salary_usd || "$112,000")}</span>
                        </div>
                        <h4 class="alum-role-title">${QuizApp.escapeHtml(m.first_job_title || "Software Specialist")}</h4>
                        <p class="alum-employer">${QuizApp.escapeHtml(m.first_employer || "Tech Leader")} &bull; <span style="color:var(--avatar-purple); font-weight:600;">${QuizApp.escapeHtml(m.internship_count || 2)} Internships</span></p>
                        
                        <div style="background-color:var(--bg-inset); padding:0.6rem; border-radius:6px; margin-bottom:0.6rem;">
                            <span style="font-size:0.68rem; text-transform:uppercase; color:var(--text-muted); font-weight:600;">Internship &amp; Milestone History</span>
                            ${internList || "<div style='font-size:0.78rem; color:var(--text-secondary);'>Summer Industry Internship</div>"}
                        </div>
                        <p style="font-size:0.78rem; color:var(--text-muted); font-style:italic;">${QuizApp.escapeHtml(m.industry_alignment || "Strong career outcome in target industry.")}</p>
                    </div>
                    <div class="alum-highlight-tags" style="margin-top:0.75rem;">
                        ${skillsList}
                    </div>
                `;
                matchesGrid.appendChild(card);
            });
        }
    };

    if (btnSubmitReport) {
        btnSubmitReport.addEventListener("click", async () => {
            let roles = collectJobRoles();
            const isNoJobExp = Boolean(noJobExpCheckbox && noJobExpCheckbox.checked);
            const hasCatDetails = Object.keys(categoryDetailsMap).length > 0;
            const hasCats = (getSelectedCategories() || []).length > 0;

            // If user has not filled role inputs in Screen 3, but has category details from Screen 2, synthesize them
            if (roles.length === 0 && hasCatDetails) {
                Object.entries(categoryDetailsMap).forEach(([cat, d]) => {
                    if (d && (d.title || d.employer || d.description)) {
                        roles.push({
                            title: d.title || `${cat} Experience`,
                            company: d.employer || "UMBC / Organization",
                            impact: d.description || `Active for ${d.timeActive || '1 term'}`,
                        });
                    }
                });
            }

            if (roles.length === 0 && !isNoJobExp && !hasCats) {
                if (jobExpError) {
                    jobExpError.textContent = "Please fill in at least one job role, or check 'I do not have prior job experience yet.'";
                    jobExpError.hidden = false;
                }
                return;
            }

            QuizApp.updateUserData({
                jobRoles: roles,
                categoryDetails: categoryDetailsMap,
                experienceCategories: getSelectedCategories(),
                noPriorJobExperience: isNoJobExp,
                internships: roles.map(r => `${r.title} at ${r.company}: ${r.impact}`).join("; "),
            });

            if (spinner) spinner.hidden = false;
            btnSubmitReport.disabled = true;
            if (jobExpError) jobExpError.hidden = true;

            try {
                const currentState = QuizApp.getQuizState();
                const res = await fetch("/api/generate-report", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        section_name: "professional_involvement",
                        user_data: currentState.user,
                    }),
                });

                if (res.ok) {
                    sec4Data = await res.json();
                    QuizApp.saveSectionData(4, sec4Data);

                    // Switch to report stage (Split Grid Layout)
                    if (questionsStage) {
                        questionsStage.hidden = true;
                        questionsStage.style.display = "none";
                    }
                    if (reportStage) {
                        reportStage.hidden = false;
                        reportStage.removeAttribute("hidden");
                        reportStage.style.display = "grid";
                        document.querySelector(".page-wrapper")?.classList.add("section1-immersive");
                    }
                    renderStageCReport(sec4Data);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                } else {
                    const errJson = await res.json().catch(() => ({}));
                    if (jobExpError) {
                        jobExpError.textContent = `Report generation could not complete (${res.status}: ${errJson.error || res.statusText}). Please try again.`;
                        jobExpError.hidden = false;
                    }
                }
            } catch (err) {
                console.error("Section 4 report generation error:", err);
                if (jobExpError) {
                    jobExpError.textContent = "An unexpected error occurred while generating the report. Please try again.";
                    jobExpError.hidden = false;
                }
            } finally {
                if (spinner) spinner.hidden = true;
                btnSubmitReport.disabled = false;
            }
        });
    }

    // =========================================================================
    // PROCEED TO SECTION 5
    // =========================================================================
    const btnNextToSection5 = document.getElementById("btn-next-to-section-5");
    if (btnNextToSection5) {
        btnNextToSection5.addEventListener("click", () => {
            QuizApp.stopAllSpeech();
            QuizApp.navigateWithTransition("/loading?next=5");
        });
    }

    // Bind speech replay listeners
    QuizApp.bindVoiceReplayListeners(4);
});
