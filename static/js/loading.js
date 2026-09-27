/**
 * Dedicated Loading Transition Controller
 * Runs an asynchronous 2.5–3.5s delay while pre-fetching Gemini/Tiger Data report,
 * then smoothly redirects to the next section's standalone intro page.
 */
document.addEventListener("DOMContentLoaded", async () => {
    const loadingScreen = document.getElementById("loading-screen");
    if (!loadingScreen) return;

    const nextSec = parseInt(loadingScreen.getAttribute("data-next-sec") || "2", 10);
    const state = QuizApp.getQuizState();

    const sectionApiNames = {
        1: "basic_info",
        2: "course_advising",
        3: "campus_involvement",
        4: "professional_involvement",
        5: "final_report",
    };

    const sectionName = sectionApiNames[nextSec] || "course_advising";

    // Set a minimum timer of 2.5 to 3.5 seconds to ensure smooth visual transition
    const minDelayPromise = new Promise((resolve) => setTimeout(resolve, 2800));

    // Concurrently fetch the next section's Tiger Data & Gemini report
    const fetchReportPromise = (async () => {
        try {
            const res = await fetch("/api/generate-report", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    section_name: sectionName,
                    user_data: state.user,
                }),
            });
            if (res.ok) {
                const data = await res.json();
                QuizApp.saveSectionData(nextSec, data);
                return data;
            }
        } catch (e) {
            console.warn("Could not pre-fetch report during loading transition:", e);
        }
        return null;
    })();

    // Wait for both the minimum delay AND the API response
    await Promise.all([minDelayPromise, fetchReportPromise]);

    // Transition smoothly to the combined section page (starts on Avatar Introduction stage)
    window.location.href = `/section/${nextSec}`;
});
