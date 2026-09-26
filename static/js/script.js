document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("start-form");
    const nameInput = document.getElementById("name-input");
    const submitBtn = document.getElementById("submit-btn");
    const btnLabel = submitBtn.querySelector(".btn-label");
    const btnSpinner = submitBtn.querySelector(".btn-spinner");
    const formError = document.getElementById("form-error");
    const greetingSection = document.getElementById("greeting-section");
    const greetingText = document.getElementById("greeting-text");

    const setLoading = (isLoading) => {
        submitBtn.disabled = isLoading;
        nameInput.disabled = isLoading;
        btnLabel.textContent = isLoading ? "Preparing" : "Continue";
        btnSpinner.hidden = !isLoading;
    };

    const showError = (message) => {
        formError.textContent = message;
        formError.hidden = false;
    };

    const clearError = () => {
        formError.textContent = "";
        formError.hidden = true;
    };

    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        clearError();

        const name = nameInput.value.trim();
        if (!name) {
            showError("Please enter your name to begin your consultation.");
            nameInput.focus();
            return;
        }

        setLoading(true);

        try {
            const response = await fetch("/api/start", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                },
                body: JSON.stringify({ name }),
            });

            const payload = await response.json();

            if (!response.ok) {
                throw new Error(payload.error || "Unable to complete request. Please try again.");
            }

            greetingText.textContent = payload.greeting;
            greetingSection.hidden = false;
        } catch (error) {
            showError(error.message || "A network error occurred. Please try again.");
        } finally {
            setLoading(false);
        }
    });
});
